// Summary: Coordinate worker chunks, run LangChain workers, and aggregate results.
// The runner handles splitting, parallel processing, aggregation, and fallback.
import { AnalysisResult, AnalysisRunner, AnalysisPresetKey } from '../analysisTypes';
import { coordinateAnalysis } from './langchainCoordinator';
import { processChunk, WorkerResult } from './langchainWorker';
import { aggregateResults } from './langchainAggregator';

// langchainRunner: main exported runner used by the frontend to run AI analysis.
export const langchainRunner: AnalysisRunner = async (
  apiKey: string,
  model: string,
  preset: AnalysisPresetKey,
  data: string[] | any
): Promise<AnalysisResult> => {
  if (preset !== 'skills' && preset !== 'certs') {
    throw new Error(`LangChain runner does not support '${preset}' analysis yet`);
  }

  const jobContents = Array.isArray(data) ? data : [];

  if (jobContents.length === 0) {
    return {
      data_points: [],
      analysis_summary: 'No job data to analyze'
    };
  }

  console.log(`[Coordinator] Analyzing ${jobContents.length} jobs...`);
  const coordination = coordinateAnalysis(jobContents, 100000);

  console.log(`[Coordinator] Strategy: ${coordination.strategy}`);
  console.log(`[Coordinator] Total tokens: ${coordination.totalTokens}`);
  console.log(`[Coordinator] Chunks: ${coordination.chunks.length}`);
  console.log(`[Workers] Processing ${coordination.chunks.length} chunks...`);

  const workerPromises = coordination.chunks.map(chunk => 
    processChunk(
      apiKey,
      model,
      chunk.index,
      chunk.data,
      preset
    )
  );

  const workerResults: WorkerResult[] = await Promise.all(workerPromises);

  console.log(`[Aggregator] Merging results from ${workerResults.length} workers...`);
  const aggregated = aggregateResults(workerResults, 15);

  if (aggregated.failedWorkers > 0) {
    console.error(`[Aggregator] ${aggregated.failedWorkers} workers failed:`, aggregated.errors);

    if (aggregated.successfulWorkers === 0) {
      throw new Error(`All workers failed: ${aggregated.errors.join('; ')}`);
    }
  }

  const summary = [
    `Analyzed ${coordination.totalJobs} jobs`,
    `Strategy: ${coordination.strategy}`,
    `Workers: ${aggregated.successfulWorkers}/${aggregated.totalWorkers} successful`,
    aggregated.failedWorkers > 0 ? `Errors: ${aggregated.failedWorkers}` : null
  ].filter(Boolean).join(' | ');

  return {
    data_points: aggregated.data,
    analysis_summary: summary
  };
};
