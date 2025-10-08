// Summary: Choose and run the right analysis method for each preset
import { AnalysisRunner, AnalysisResult, AnalysisPresetKey } from './analysisTypes';
import { analyzeWithGemini, PRESET_PROMPTS } from './geminiAnalysis';
import { analyzeWithGeminiNano } from './geminiNanoAnalysis';
import { JobContentExtract, processLocationData } from './jobParser';
import { langchainRunner } from './langchain/langchainRunner';
import { getUseLangChain, getUseGeminiNano } from './localStorage';

// Gemini Nano runner (browser-based AI)
// geminiNanoRunner: Run analysis using the browser Gemini Nano model
export const geminiNanoRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  const resp = await analyzeWithGeminiNano(preset, jobContents);
  return {
    analysis_summary: resp.analysis_summary,
    data_points: resp.data_points
  };
};

// Default runner using Gemini AI for skills and certs
// geminiRunner: Use server Gemini API for skills and certs analysis
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
// experienceRunner: Find and count experience-year mentions in job texts
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

// getExperienceRange: Convert years number to a labeled range
function getExperienceRange(years: number): string {
  if (years <= 2) return '0-2 years';
  if (years <= 5) return '3-5 years';
  if (years <= 10) return '5-10 years';
  return '10+ years';
}

// Local runner for location analysis
// locationRunner: Count jobs per location and return top results
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
// educationRunner: Detect education levels and count how often they appear
export const educationRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  if (preset !== 'education') {
    throw new Error(`Education runner only supports 'education' preset`);
  }

  const educationData: { [key: string]: number } = {};
  
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
// analysisRunner: Pick the best runner based on settings and preset
export const analysisRunner: AnalysisRunner = async (apiKey, model, preset, jobContents) => {
  const useLangChain = getUseLangChain();
  const useGeminiNano = getUseGeminiNano();
  
  if (useGeminiNano) {
    console.log(`[AnalysisRunner] Using Gemini Nano for ${preset} analysis`);
    try {
      return await geminiNanoRunner(apiKey, model, preset, jobContents);
    } catch (error: any) {
      console.error(`[AnalysisRunner] Gemini Nano failed:`, error);
      throw new Error(`Gemini Nano analysis failed: ${error.message}`);
    }
  }
  
  if (useLangChain && (preset === 'skills' || preset === 'certs')) {
    console.log(`[AnalysisRunner] Using LangChain for ${preset} analysis`);
    try {
      return await langchainRunner(apiKey, model, preset, jobContents);
    } catch (error: any) {
      console.error(`[AnalysisRunner] LangChain failed, falling back to Gemini SDK:`, error);
      return geminiRunner(apiKey, model, preset, jobContents);
    }
  }
  
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
