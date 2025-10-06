// Brief: Types used by analysis runners and UI sections
export interface DataPoint {
  label: string;
  value: number;
  category?: string;
}

export interface AnalysisResult {
  analysis_summary: string;
  data_points: DataPoint[];
}

export type AnalysisPresetKey = 'skills' | 'certs' | 'experience' | 'location' | 'education';

// Runner interface for executing analysis
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
