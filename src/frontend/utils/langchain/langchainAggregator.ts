// Summary: Combine and summarize DataPoint arrays from multiple LangChain workers.
// This file merges counts by label, sorts results, and computes simple stats.
import { DataPoint } from '../analysisTypes';
import { WorkerResult } from './langchainWorker';

// mergeDataPoints: add up values for the same label across worker results.
function mergeDataPoints(dataPointsArrays: DataPoint[][]): DataPoint[] {
  const merged = new Map<string, number>();

  for (const dataPoints of dataPointsArrays) {
    for (const point of dataPoints) {
      const current = merged.get(point.label) || 0;
      merged.set(point.label, current + point.value);
    }
  }

  return Array.from(merged.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export interface AggregatorResult {
  totalWorkers: number;
  successfulWorkers: number;
  failedWorkers: number;
  data: DataPoint[];
  errors: string[];
}

// aggregateResults: merge worker outputs, return top N labels and simple metadata.
export function aggregateResults(
  workerResults: WorkerResult[],
  topN: number = 15
): AggregatorResult {
  const successfulResults = workerResults.filter(r => !r.error);
  const failedResults = workerResults.filter(r => r.error);

  const allDataPoints = successfulResults.map(r => r.data);
  const mergedData = mergeDataPoints(allDataPoints);

  const topData = mergedData.slice(0, topN);

  return {
    totalWorkers: workerResults.length,
    successfulWorkers: successfulResults.length,
    failedWorkers: failedResults.length,
    data: topData,
    errors: failedResults.map(r => `Chunk ${r.chunkIndex}: ${r.error}`),
  };
}

// Calculate statistics for aggregated data
// calculateStats: compute total, average, max and min for a DataPoint array.
export function calculateStats(data: DataPoint[]): {
  total: number;
  average: number;
  max: number;
  min: number;
} {
  if (data.length === 0) {
    return { total: 0, average: 0, max: 0, min: 0 };
  }

  const values = data.map(d => d.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  const average = total / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  return { total, average, max, min };
}
