// Summary: Shared types for analysis results and runner interfaces
export interface DataPoint {
  label: string;
  value: number;
  category?: string;
}

export interface AnalysisResult {
  // analysis_summary: Short text summary of the analysis
  analysis_summary: string;
  // data_points: Array of counted items from analysis
  data_points: DataPoint[];
}

export type AnalysisPresetKey = 'skills' | 'certs' | 'experience' | 'location' | 'education';

// AnalysisRunner: Function type to run an analysis preset
export type AnalysisRunner = (
  apiKey: string,
  model: string,
  preset: AnalysisPresetKey,
  jobContents: any[]
) => Promise<AnalysisResult>;

// Section state for UI
export interface AnalysisSectionState {
  loading: boolean;
  result: AnalysisResult | null;
  error: string | null;
}
