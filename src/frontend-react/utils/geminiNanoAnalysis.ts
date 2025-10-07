// Brief: Gemini Nano browser-based AI analysis (experimental)
import { JobContentExtract } from './jobParser';
import { GeminiAnalysisResponse } from './geminiAnalysis';

// Type definitions for Prompt API (browser-based Gemini Nano)
interface LanguageModelParams {
  defaultTemperature: number;
  maxTemperature: number;
  defaultTopK: number;
  maxTopK: number;
}

interface LanguageModelSession {
  prompt(text: string, options?: PromptOptions): Promise<string>;
  promptStreaming(text: string, options?: PromptOptions): ReadableStream;
  destroy(): void;
}

interface PromptOptions {
  responseConstraint?: any;
  omitResponseConstraintInput?: boolean;
}

interface LanguageModel {
  params(): Promise<LanguageModelParams>;
  availability(): Promise<'readily' | 'available' | 'after-download' | 'unavailable'>;
  create(options?: CreateOptions): Promise<LanguageModelSession>;
}

interface CreateOptions {
  temperature?: number;
  topK?: number;
  initialPrompts?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    prefix?: boolean;
  }>;
  expectedInputs?: Array<{
    type: 'text' | 'image' | 'audio';
    languages?: string[];
  }>;
  expectedOutputs?: Array<{
    type: 'text';
    languages?: string[];
  }>;
}

declare global {
  interface Window {
    LanguageModel?: LanguageModel;
  }
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    analysis_summary: {
      type: 'string'
    },
    data_points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'number' },
          category: { type: 'string' }
        },
        required: ['label', 'value', 'category']
      }
    }
  },
  required: ['analysis_summary', 'data_points']
};

const PRESET_PROMPTS = {
  skills: {
    title: 'Technical Skills Analysis',
    systemPrompt: `Analyze job descriptions and extract the most common technical skills. Count how many jobs mention each skill. Return JSON with analysis_summary and data_points array. Each data_point must have label (skill name), value (integer count), and category.`
  },
  certs: {
    title: 'Certification Requirements Analysis',
    systemPrompt: `Analyze job descriptions and extract required certifications. Count how many jobs require each certification. Return JSON with analysis_summary and data_points array. Each data_point must have label (cert name), value (integer count), and category.`
  },
  experience: {
    title: 'Experience Requirements Analysis',
    systemPrompt: `Analyze job descriptions and extract experience requirements in years. Count distribution. Return JSON with analysis_summary and data_points array. Each data_point must have label (e.g., "1-3 years"), value (integer count), and category.`
  },
  location: {
    title: 'Location Distribution Analysis',
    systemPrompt: `Analyze job descriptions and extract job locations. Count jobs per location. Return JSON with analysis_summary and data_points array. Each data_point must have label (location), value (integer count), and category.`
  },
  education: {
    title: 'Education Requirements Analysis',
    systemPrompt: `Analyze job descriptions and extract education requirements. Count distribution. Return JSON with analysis_summary and data_points array. Each data_point must have label (degree level), value (integer count), and category.`
  }
};

export async function checkGeminiNanoAvailability(): Promise<{
  available: boolean;
  status: 'readily' | 'after-download' | 'unavailable' | 'not-supported';
  message: string;
}> {
  if (!window.LanguageModel) {
    return {
      available: false,
      status: 'not-supported',
      message: 'Gemini Nano is not supported in this browser. Please use Chrome Canary with experimental features enabled.'
    };
  }

  try {
    const status = await window.LanguageModel.availability();
    
    // Handle 'readily' or 'available' status (model is ready)
    if (status === 'readily' || status === 'available') {
      return {
        available: true,
        status: 'readily',
        message: 'Gemini Nano is ready to use'
      };
    }
    
    // Handle 'after-download' status
    if (status === 'after-download') {
      return {
        available: false,
        status: 'after-download',
        message: 'Gemini Nano needs to be downloaded first. Please wait for the model to download.'
      };
    }
    
    // Handle 'unavailable' or any other status
    return {
      available: false,
      status: 'unavailable',
      message: `Gemini Nano is not available. Status: ${status}`
    };
  } catch (error) {
    return {
      available: false,
      status: 'unavailable',
      message: `Error checking availability: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function analyzeWithGeminiNano(
  presetKey: string,
  jobContents: JobContentExtract[]
): Promise<GeminiAnalysisResponse> {
  // Check if Gemini Nano is available
  if (!window.LanguageModel) {
    throw new Error('Gemini Nano is not supported in this browser');
  }

  const availability = await window.LanguageModel.availability();
  if (availability !== 'readily' && availability !== 'available') {
    throw new Error(`Gemini Nano is not ready. Status: ${availability}`);
  }

  const preset = PRESET_PROMPTS[presetKey as keyof typeof PRESET_PROMPTS];
  if (!preset) {
    throw new Error(`Invalid preset: ${presetKey}`);
  }

  // Create session with output language specification
  const session = await window.LanguageModel.create({
    temperature: 0.7,
    topK: 40,
    initialPrompts: [
      {
        role: 'system',
        content: preset.systemPrompt
      }
    ],
    expectedOutputs: [
      {
        type: 'text',
        languages: ['en']
      }
    ]
  });

  try {
    // Combine job contents
    const combinedText = jobContents
      .map((job, idx) => `Job ${idx + 1}:\nSummary: ${job.abstract}\nDetails: ${job.content}`)
      .join('\n\n');

    const promptText = `Analyze these job descriptions and return a JSON response following the schema:\n\n${combinedText}`;

    // Prompt with JSON schema constraint
    const result = await session.prompt(promptText, {
      responseConstraint: RESPONSE_SCHEMA,
      omitResponseConstraintInput: false
    });

    const parsedResult: GeminiAnalysisResponse = JSON.parse(result);

    // Normalize values to ensure they're integers
    return normalizeAnalysisResult(parsedResult, jobContents.length);
  } finally {
    session.destroy();
  }
}

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
