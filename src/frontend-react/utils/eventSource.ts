// Brief: Utilities for SSE handling and token generation
export function safeCloseEventSource(eventSource: EventSource | null): void {
  if (!eventSource) return;
  try {
    eventSource.close();
  } catch (err) {
    console.error('Error closing EventSource:', err);
  }
}

export function parseSSEData<T = any>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch (err) {
    console.error('Failed to parse SSE data:', err);
    return null;
  }
}

export function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
