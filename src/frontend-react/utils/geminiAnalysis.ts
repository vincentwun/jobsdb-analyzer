// Gemini AI analysis utilities
import { GoogleGenAI, Type } from '@google/genai';
import { JobContentExtract } from './jobParser';

export interface AnalysisDataPoint {
  label: string;
  value: number;
  category: string;
}

export interface GeminiAnalysisResponse {
  analysis_summary: string;
  data_points: AnalysisDataPoint[];
}

// Shared schema for analysis responses
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

export const PRESET_PROMPTS = {
  skills: {
    title: 'Technical Skills Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract the most common technical skills, programming languages, cloud platforms, and tools.

Focus on skills like: Python, Java, JavaScript, TypeScript, Go, C++, SQL, Docker, Kubernetes, AWS, Azure, GCP, Terraform, Jenkins, Git, React, Node.js, etc.

Group similar items (e.g., 'AWS', 'Amazon Web Services' → 'AWS'). 

CRITICAL INSTRUCTIONS:
- For each skill, count how many DIFFERENT job postings mention it
- The 'value' field MUST be a WHOLE NUMBER (integer) representing the actual count
- DO NOT use percentages, decimals, or ratios
- Example output format:
  {
    "analysis_summary": "Analysis of technical skills across job postings",
    "data_points": [
      {"label": "Python", "value": 15, "category": "Programming Language"},
      {"label": "Docker", "value": 12, "category": "Tool"},
      {"label": "AWS", "value": 10, "category": "Cloud Platform"}
    ]
  }

Note: The values 15, 12, 10 are integer counts, not 0.15, 0.12, 0.10.`,
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
- Example output format:
  {
    "analysis_summary": "Analysis of required certifications across job postings",
    "data_points": [
      {"label": "AWS Certified Solutions Architect", "value": 8, "category": "Cloud"},
      {"label": "CISSP", "value": 5, "category": "Security"},
      {"label": "PMP", "value": 3, "category": "Project Management"}
    ]
  }

Note: The values 8, 5, 3 are integer counts, not 0.8, 0.5, 0.3.`,
    schema: ANALYSIS_RESPONSE_SCHEMA
  }
};

/**
 * Call Gemini AI for structured analysis
 */
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

  // Combine job contents into a single text
  const combinedText = jobContents
    .map((job, idx) => `Job ${idx + 1}:\nSummary: ${job.abstract}\nDetails: ${job.content}`)
    .join('\n\n');

  const promptText = `${preset.systemPrompt}\n\nJob Descriptions:\n${combinedText}`;

  // Initialize Gemini AI
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

  // Post-process: ensure all values are integers
  return normalizeAnalysisResult(parsedResult, jobContents.length);
}

/**
 * Normalize analysis result to ensure integer values
 */
function normalizeAnalysisResult(
  result: GeminiAnalysisResponse,
  totalJobs: number
): GeminiAnalysisResponse {
  const maxValue = Math.max(...result.data_points.map(dp => dp.value));
  
  // If max value is less than 1, assume these are percentages/ratios and scale up
  const scalingNeeded = maxValue < 1 && maxValue > 0;
  
  return {
    ...result,
    data_points: result.data_points.map(dp => ({
      ...dp,
      value: Math.round(scalingNeeded ? dp.value * totalJobs : dp.value)
    }))
  };
}
