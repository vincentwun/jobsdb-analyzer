// Brief: Dispatches analysis presets to appropriate local, Gemini, or LangChain runners
import { AnalysisRunner, AnalysisResult, AnalysisPresetKey } from './analysisTypes';
import { analyzeWithGemini, PRESET_PROMPTS } from './geminiAnalysis';
import { JobContentExtract, processLocationData } from './jobParser';
import { langchainRunner } from './langchain/langchainRunner';
import { getUseLangChain } from './localStorage';

// Default runner using Gemini AI for skills and certs
export const geminiRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  if (preset === 'skills' || preset === 'certs') {
    const resp = await analyzeWithGemini(apiKey, model, preset, jobContents);
    return {
      analysis_summary: resp.analysis_summary,
      data_points: resp.data_points
    };
  }
  throw new Error(`Gemini runner does not support preset: ${preset}`);
};

// Local runner for experience analysis
export const experienceRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  if (preset !== 'experience') {
    throw new Error(`Experience runner only supports 'experience' preset`);
  }

  const experienceData: { [key: string]: number } = {};
  
  jobContents.forEach((job: JobContentExtract) => {
    const text = `${job.abstract} ${job.content}`.toLowerCase();
    const matches = text.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/gi);
    
    if (matches) {
      matches.forEach(match => {
        const years = parseInt(match.match(/\d+/)?.[0] || '0', 10);
        if (years > 0 && years <= 20) {
          const range = getExperienceRange(years);
          experienceData[range] = (experienceData[range] || 0) + 1;
        }
      });
    }
  });

  const data_points = Object.entries(experienceData)
    .map(([label, value]) => ({ label, value, category: 'Experience' }))
    .sort((a, b) => {
      const orderMap: { [key: string]: number } = {
        '0-2 years': 1,
        '3-5 years': 2,
        '5-10 years': 3,
        '10+ years': 4
      };
      return (orderMap[a.label] || 99) - (orderMap[b.label] || 99);
    });

  return {
    analysis_summary: `Experience requirements distribution across ${jobContents.length} jobs`,
    data_points
  };
};

function getExperienceRange(years: number): string {
  if (years <= 2) return '0-2 years';
  if (years <= 5) return '3-5 years';
  if (years <= 10) return '5-10 years';
  return '10+ years';
}

// Local runner for location analysis
export const locationRunner: AnalysisRunner = async (apiKey, model, preset, jobData) => {
  if (preset !== 'location') {
    throw new Error(`Location runner only supports 'location' preset`);
  }

  const locationCounts = processLocationData(jobData);
  
  const data_points = Object.entries(locationCounts)
    .map(([label, value]) => ({ label, value, category: 'Location' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  return {
    analysis_summary: `Location distribution across job postings`,
    data_points
  };
};

// Local runner for education requirements analysis
export const educationRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  if (preset !== 'education') {
    throw new Error(`Education runner only supports 'education' preset`);
  }

  const educationData: { [key: string]: number } = {};
  
  // Education level patterns (English and Chinese)
  const educationPatterns = [
    { pattern: /\b(?:phd|ph\.d\.|doctorate|doctoral|博士)\b/gi, label: 'PhD / Doctorate' },
    { pattern: /\b(?:master|master'?s|硕士|碩士)\b/gi, label: "Master's Degree" },
    { pattern: /\b(?:bachelor|bachelor'?s|degree|学士|學士|本科)\b/gi, label: "Bachelor's Degree" },
    { pattern: /\b(?:diploma|associate|高级文凭|高級文憑|副学士|副學士)\b/gi, label: 'Diploma / Associate' },
    { pattern: /\b(?:high school|secondary|中学|中學|高中)\b/gi, label: 'High School' }
  ];

  jobContents.forEach((job: JobContentExtract) => {
    const text = `${job.abstract} ${job.content}`;
    
    educationPatterns.forEach(({ pattern, label }) => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        educationData[label] = (educationData[label] || 0) + 1;
      }
    });
  });

  const data_points = Object.entries(educationData)
    .map(([label, value]) => ({ label, value, category: 'Education' }))
    .sort((a, b) => b.value - a.value);

  return {
    analysis_summary: `Education requirements distribution across ${jobContents.length} jobs`,
    data_points
  };
};

// Combined runner that dispatches to appropriate runner based on preset
export const analysisRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  const useLangChain = getUseLangChain();
  
  // Use LangChain for skills and certs if enabled
  if (useLangChain && (preset === 'skills' || preset === 'certs')) {
    console.log(`[AnalysisRunner] Using LangChain for ${preset} analysis`);
    try {
      return await langchainRunner(apiKey, model, preset, jobContents);
    } catch (error: any) {
      console.error(`[AnalysisRunner] LangChain failed, falling back to Gemini SDK:`, error);
      // Fallback to Gemini SDK
      return geminiRunner(apiKey, model, preset, jobContents);
    }
  }
  
  // Otherwise use default runners
  switch (preset) {
    case 'skills':
    case 'certs':
      return geminiRunner(apiKey, model, preset, jobContents);
    case 'experience':
      return experienceRunner(apiKey, model, preset, jobContents);
    case 'location':
      return locationRunner(apiKey, model, preset, jobContents);
    case 'education':
      return educationRunner(apiKey, model, preset, jobContents);
    default:
      throw new Error(`Unknown preset: ${preset}`);
  }
};
