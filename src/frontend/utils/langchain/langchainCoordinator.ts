// Summary: Break job arrays into token-based chunks to avoid model input limits.
// Includes a simple token estimator that handles CJK vs Latin text density.
export function estimateTokenCount(text: string): number {
  // Count CJK characters to estimate token density.
  const cjkChars = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g)?.length || 0;
  const totalChars = text.length;
  const cjkRatio = cjkChars / totalChars;

  if (cjkRatio > 0.5) {
    return Math.ceil(totalChars / 1.8);
  } else if (cjkRatio > 0.1) {
    return Math.ceil(totalChars / 2.5);
  } else {
    return Math.ceil(totalChars / 4);
  }
}

export interface DataChunk<T> {
  index: number;
  data: T[];
  tokenCount: number;
}

// splitJobData: group jobs into chunks so each chunk stays under token limit.
export function splitJobData<T>(
  jobs: T[],
  maxTokensPerChunk: number = 100000
): DataChunk<T>[] {
  const chunks: DataChunk<T>[] = [];
  let currentChunk: T[] = [];
  let currentTokenCount = 0;
  let chunkIndex = 0;

  for (const job of jobs) {
    const jobText = JSON.stringify(job);
    const jobTokens = estimateTokenCount(jobText);

    if (jobTokens > maxTokensPerChunk) {
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          data: currentChunk,
          tokenCount: currentTokenCount
        });
        currentChunk = [];
        currentTokenCount = 0;
      }
      chunks.push({
        index: chunkIndex++,
        data: [job],
        tokenCount: jobTokens
      });
      continue;
    }

    if (currentTokenCount + jobTokens > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        data: currentChunk,
        tokenCount: currentTokenCount
      });
      currentChunk = [];
      currentTokenCount = 0;
    }

    currentChunk.push(job);
    currentTokenCount += jobTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      data: currentChunk,
      tokenCount: currentTokenCount
    });
  }

  return chunks;
}

export interface CoordinatorResult<T> {
  totalJobs: number;
  totalTokens: number;
  chunks: DataChunk<T>[];
  strategy: 'single' | 'parallel';
}

// coordinateAnalysis: create chunks and provide simple metadata for the run.
export function coordinateAnalysis<T>(
  jobs: T[],
  maxTokensPerChunk: number = 100000
): CoordinatorResult<T> {
  const totalText = JSON.stringify(jobs);
  const totalTokens = estimateTokenCount(totalText);
  const chunks = splitJobData(jobs, maxTokensPerChunk);

  return {
    totalJobs: jobs.length,
    totalTokens,
    chunks,
    strategy: chunks.length === 1 ? 'single' : 'parallel'
  };
}
