// Estimate token count for text (supports mixed Chinese/English)
export function estimateTokenCount(text: string): number {
  // Detect CJK (Chinese/Japanese/Korean) characters
  const cjkChars = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g)?.length || 0;
  const totalChars = text.length;
  const cjkRatio = cjkChars / totalChars;

  if (cjkRatio > 0.5) {
    // Mostly CJK text: ~1.8 chars per token (more dense)
    return Math.ceil(totalChars / 1.8);
  } else if (cjkRatio > 0.1) {
    // Mixed CJK and English: ~2.5 chars per token
    return Math.ceil(totalChars / 2.5);
  } else {
    // Mostly English: ~4 chars per token
    return Math.ceil(totalChars / 4);
  }
}

// Split job data into chunks based on token limit
export interface DataChunk<T> {
  index: number;
  data: T[];
  tokenCount: number;
}

export function splitJobData<T>(
  jobs: T[],
  maxTokensPerChunk: number = 100000 // Conservative limit (Gemini supports 1M)
): DataChunk<T>[] {
  const chunks: DataChunk<T>[] = [];
  let currentChunk: T[] = [];
  let currentTokenCount = 0;
  let chunkIndex = 0;

  for (const job of jobs) {
    const jobText = JSON.stringify(job);
    const jobTokens = estimateTokenCount(jobText);

    // If single job exceeds limit, add it alone
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

    // Check if adding this job would exceed limit
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

  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      data: currentChunk,
      tokenCount: currentTokenCount
    });
  }

  return chunks;
}

// Coordinator agent: analyze and split data
export interface CoordinatorResult<T> {
  totalJobs: number;
  totalTokens: number;
  chunks: DataChunk<T>[];
  strategy: 'single' | 'parallel';
}

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
