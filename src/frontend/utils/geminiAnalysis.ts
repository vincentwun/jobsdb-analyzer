// Summary: Helpers to call Gemini API and shape the JSON response
import { GoogleGenAI, Type } from '@google/genai';
import { JobContentExtract } from './jobParser';

// AnalysisDataPoint: Single counted item from AI response
export interface AnalysisDataPoint {
  label: string;
  value: number;
  category: string;
}

// GeminiAnalysisResponse: Expected JSON shape from Gemini
export interface GeminiAnalysisResponse {
  analysis_summary: string;
  data_points: AnalysisDataPoint[];
}

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    analysis_summary: {
      type: Type.STRING,
      description: "Brief summary of findings"
    },
    data_points: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { 
            type: Type.STRING, 
            description: "Item name (skill, certification, etc.)" 
          },
          value: { 
            type: Type.INTEGER, 
            description: "Integer frequency count (how many times this item appears)" 
          },
          category: { 
            type: Type.STRING, 
            description: "Category classification" 
          }
        },
        required: ["label", "value", "category"],
        propertyOrdering: ["label", "value", "category"]
      }
    }
  },
  required: ["analysis_summary", "data_points"],
  propertyOrdering: ["analysis_summary", "data_points"]
};

// PRESET_PROMPTS: Prompts and schema for each preset
export const PRESET_PROMPTS = {
  skills: {
    title: 'Technical Skills Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract the most common technical skills, programming languages, cloud platforms, and tools.

Focus on skills like: Python, Java, JavaScript, TypeScript, Go, C++, SQL, Docker, Kubernetes, AWS, Azure, GCP, Terraform, Jenkins, Git, React, Node.js, etc.

Group similar items (e.g., 'AWS', 'Amazon Web Services' -> 'AWS').

CRITICAL INSTRUCTIONS:
- For each skill, count how many DIFFERENT job postings mention it
- The 'value' field MUST be a WHOLE NUMBER (integer) representing the actual count
- DO NOT use percentages, decimals, or ratios
`,
    schema: ANALYSIS_RESPONSE_SCHEMA
  },
  certs: {
    title: 'Certification Requirements Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract required professional certifications and qualifications.

Focus on certifications like: AWS Certified Solutions Architect (SAA), Azure Administrator (AZ-104), Google Cloud Professional, CISSP, PMP, CKA (Certified Kubernetes Administrator), Terraform Associate, etc.

Group similar items.

CRITICAL INSTRUCTIONS:
- For each certification, count how many DIFFERENT job postings require it
- The 'value' field MUST be a WHOLE NUMBER (integer) representing the actual count
- DO NOT use percentages, decimals, or ratios
`,
    schema: ANALYSIS_RESPONSE_SCHEMA
  }
};

// analyzeWithGemini: Send prompt to Gemini API and parse JSON response
export async function analyzeWithGemini(
  apiKey: string,
  model: string,
  presetKey: string,
  jobContents: JobContentExtract[]
): Promise<GeminiAnalysisResponse> {
  const preset = PRESET_PROMPTS[presetKey as keyof typeof PRESET_PROMPTS];
  
  if (!preset) {
    throw new Error(`Invalid preset: ${presetKey}`);
  }

  const combinedText = jobContents
    .map((job, idx) => `Job ${idx + 1}:\nSummary: ${job.abstract}\nDetails: ${job.content}`)
    .join('\n\n');

  const promptText = `${preset.systemPrompt}\n\nJob Descriptions:\n${combinedText}`;

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: promptText,
    config: {
      responseMimeType: "application/json",
      responseSchema: preset.schema
    }
  });

  const resultText = response.text;
  
  if (!resultText) {
    throw new Error('Empty response from Gemini API');
  }

  const parsedResult: GeminiAnalysisResponse = JSON.parse(resultText);

  return normalizeAnalysisResult(parsedResult, jobContents.length);
}

// normalizeAnalysisResult: Ensure numbers are integers and scale if needed
function normalizeAnalysisResult(
  result: GeminiAnalysisResponse,
  totalJobs: number
): GeminiAnalysisResponse {
  const maxValue = Math.max(...result.data_points.map(dp => dp.value));
  const scalingNeeded = maxValue < 1 && maxValue > 0;
  
  return {
    ...result,
    data_points: result.data_points.map(dp => ({
      ...dp,
      value: Math.round(scalingNeeded ? dp.value * totalJobs : dp.value)
    }))
  };
}
