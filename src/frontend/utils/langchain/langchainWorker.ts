import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DataPoint } from '../analysisTypes';

// Summary: Send job texts to LangChain, parse JSON results, and return DataPoint arrays.
export interface WorkerResult {
  chunkIndex: number;
  data: DataPoint[];
  error?: string;
}

// extractSkills: ask the model to find top technical skills and parse returned JSON.
async function extractSkills(
  apiKey: string,
  model: string,
  jobContents: string[]
): Promise<DataPoint[]> {
  console.log('[extractSkills] Job count:', jobContents.length);
  console.log('[extractSkills] First job preview:', jobContents[0]?.substring(0, 100));

  const llm = new ChatGoogleGenerativeAI({
    apiKey,
    model: model,
    temperature: 0,
  });

  const prompt = `Analyze the following job descriptions and extract the most required technical skills.
Return a JSON array of objects with 'label' (skill name) and 'value' (frequency count).
Focus on technical skills like programming languages, frameworks, tools, and technologies.
Sort by frequency in descending order and return top 15 skills.

Job descriptions:
${jobContents.join('\n---\n')}

Response format:
{
  "data": [
    { "label": "Python", "value": 25 },
    { "label": "JavaScript", "value": 20 }
  ]
}`;

  const messages = [
    new SystemMessage('You are an expert job market analyst specializing in technical skills extraction.'),
    new HumanMessage(prompt)
  ];

  const response = await llm.invoke(messages);
  const content = response.content.toString();

  console.log('[LangChain Worker] Raw response:', content.substring(0, 200));

  // NOTICE: Response parsing is fragile; try code block JSON first, then any JSON object.
  let jsonText = content.match(/```json\s*([\s\S]*?)```/)?.[1];

  if (!jsonText) {
    jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  }

  if (!jsonText) {
    console.error('[LangChain Worker] No JSON found in response');
    throw new Error('Failed to parse JSON from response');
  }

  const parsed = JSON.parse(jsonText);

  if (!parsed.data || !Array.isArray(parsed.data)) {
    console.error('[LangChain Worker] Invalid data structure:', parsed);
    throw new Error('Invalid response format: missing or invalid data array');
  }

  return parsed.data;
}

// extractCertifications: ask the model to find top certifications and parse returned JSON.
async function extractCertifications(
  apiKey: string,
  model: string,
  jobContents: string[]
): Promise<DataPoint[]> {
  console.log('[extractCertifications] Job count:', jobContents.length);
  console.log('[extractCertifications] First job preview:', jobContents[0]?.substring(0, 100));

  const llm = new ChatGoogleGenerativeAI({
    apiKey,
    model: model,
    temperature: 0,
  });

  const prompt = `Analyze the following job descriptions and extract the most required professional certifications.
Return a JSON array of objects with 'label' (certification name) and 'value' (frequency count).
Focus on industry certifications like AWS, Azure, PMP, CISSP, etc.
Sort by frequency in descending order and return top 15 certifications.

Job descriptions:
${jobContents.join('\n---\n')}

Response format:
{
  "data": [
    { "label": "AWS Certified Solutions Architect", "value": 15 },
    { "label": "PMP", "value": 10 }
  ]
}`;

  const messages = [
    new SystemMessage('You are an expert job market analyst specializing in professional certifications.'),
    new HumanMessage(prompt)
  ];

  const response = await llm.invoke(messages);
  const content = response.content.toString();

  console.log('[LangChain Worker] Raw response (certs):', content.substring(0, 200));

  // NOTICE: Response parsing is fragile; try code block JSON first, then any JSON object.
  let jsonText = content.match(/```json\s*([\s\S]*?)```/)?.[1];

  if (!jsonText) {
    jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  }

  if (!jsonText) {
    console.error('[LangChain Worker] No JSON found in response. Full response:', content);
    throw new Error('Failed to parse JSON from response');
  }

  const parsed = JSON.parse(jsonText);

  if (!parsed.data || !Array.isArray(parsed.data)) {
    console.error('[LangChain Worker] Invalid data structure:', parsed);
    throw new Error('Invalid response format: missing or invalid data array');
  }

  return parsed.data;
}

// Worker agent main function
// processChunk: entry point for a worker to process one chunk and return results.
export async function processChunk(
  apiKey: string,
  model: string,
  chunkIndex: number,
  jobContents: string[],
  analysisType: 'skills' | 'certs'
): Promise<WorkerResult> {
  try {
    console.log(`[Worker ${chunkIndex}] Processing ${jobContents.length} jobs for ${analysisType}...`);

    let data: DataPoint[];

    if (analysisType === 'skills') {
      data = await extractSkills(apiKey, model, jobContents);
    } else {
      data = await extractCertifications(apiKey, model, jobContents);
    }

    console.log(`[Worker ${chunkIndex}] Successfully extracted ${data.length} items`);

    return {
      chunkIndex,
      data,
    };
  } catch (error: any) {
    console.error(`[Worker ${chunkIndex}] Error:`, error);
    return {
      chunkIndex,
      data: [],
      error: error.message || 'Processing failed',
    };
  }
}
