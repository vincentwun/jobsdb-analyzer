// EventSource utility for safe SSE handling

/**
 * Safely close an EventSource connection
 */
export function safeCloseEventSource(eventSource: EventSource | null): void {
  if (!eventSource) return;
  
  try {
    eventSource.close();
  } catch (err) {
    console.error('Error closing EventSource:', err);
  }
}

/**
 * Parse JSON data from SSE message event
 */
export function parseSSEData<T = any>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch (err) {
    console.error('Failed to parse SSE data:', err);
    return null;
  }
}

/**
 * Generate a random token for SSE connection
 */
export function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
