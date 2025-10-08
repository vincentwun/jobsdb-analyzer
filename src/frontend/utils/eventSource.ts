// Summary: Small helpers for server-sent events and token creation
// safeCloseEventSource: Close an EventSource safely if it exists
export function safeCloseEventSource(eventSource: EventSource | null): void {
  if (!eventSource) return;
  try {
    eventSource.close();
  } catch (err) {
    console.error('Error closing EventSource:', err);
  }
}

// parseSSEData: Parse JSON data from an SSE MessageEvent
export function parseSSEData<T = any>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch (err) {
    console.error('Failed to parse SSE data:', err);
    return null;
  }
}

// generateToken: Create a short random token string
export function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
