import { DataPoint } from '../analysisTypes';
import { WorkerResult } from './langchainWorker';

// Merge data points from multiple workers
function mergeDataPoints(dataPointsArrays: DataPoint[][]): DataPoint[] {
  const merged = new Map<string, number>();

  // Aggregate values by label
  for (const dataPoints of dataPointsArrays) {
    for (const point of dataPoints) {
      const current = merged.get(point.label) || 0;
      merged.set(point.label, current + point.value);
    }
  }

  // Convert to array and sort by value
  return Array.from(merged.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

// Aggregator agent: merge results from all workers
export interface AggregatorResult {
  totalWorkers: number;
  successfulWorkers: number;
  failedWorkers: number;
  data: DataPoint[];
  errors: string[];
}

export function aggregateResults(
  workerResults: WorkerResult[],
  topN: number = 15
): AggregatorResult {
  const successfulResults = workerResults.filter(r => !r.error);
  const failedResults = workerResults.filter(r => r.error);

  const allDataPoints = successfulResults.map(r => r.data);
  const mergedData = mergeDataPoints(allDataPoints);

  // Take top N results
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
