/**
 * Extract abstract and content from JobsDB JSON data
 */

export interface JobContentExtract {
  abstract: string;
  content: string;
}

/**
 * Recursively collect all 'abstract' and 'content' fields from an object
 */
function collectAbstractAndContent(obj: any, results: JobContentExtract[]): void {
  if (obj == null) return;
  if (typeof obj === 'string') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectAbstractAndContent(item, results);
    }
    return;
  }

  if (typeof obj === 'object') {
    let abstract = '';
    let content = '';

    // Check if this object has abstract or content
    if ('abstract' in obj && typeof obj.abstract === 'string') {
      abstract = obj.abstract.trim();
    }
    if ('content' in obj && typeof obj.content === 'string') {
      content = obj.content.trim();
    }

    // If we found both, add to results
    if (abstract || content) {
      results.push({ abstract, content });
    }

    // Recurse into nested objects
    for (const value of Object.values(obj)) {
      collectAbstractAndContent(value, results);
    }
  }
}

/**
 * Extract all abstract and content from JobsDB JSON
 */
export function extractJobContent(jsonData: any): JobContentExtract[] {
  const results: JobContentExtract[] = [];
  collectAbstractAndContent(jsonData, results);
  return results;
}

/**
 * Format extracted content for LLM input
 */
export function formatForLLM(extracts: JobContentExtract[]): string {
  return extracts
    .map((item, index) => {
      const parts: string[] = [];

      if (item.abstract) {
        parts.push(`Abstract: ${item.abstract}`);
      }
      if (item.content) {
        parts.push(`Content: ${item.content}`);
      }

      return `=== Job ${index + 1} ===\n${parts.join('\n\n')}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Split text into chunks to avoid token limits
 */
export function chunkText(text: string, maxChars: number = 30000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  const lines = text.split('\n');

  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + line : line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
