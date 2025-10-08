// Summary: App-wide constant keys, defaults, and chart settings
export const STORAGE_KEYS = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',
  USE_GEMINI_NANO: 'USE_GEMINI_NANO',
  USE_LANGCHAIN: 'USE_LANGCHAIN',
  SELECTED_RESULT_FILE: 'SELECTED_RESULT_FILE'
} as const;

export const DEFAULT_VALUES = {
  // GEMINI_MODEL: Default model to use for Gemini API calls
  GEMINI_MODEL: 'gemini-2.5-flash-lite',
  // DEBOUNCE_DELAY: Milliseconds for debounced UI inputs
  DEBOUNCE_DELAY: 500,
  // STATUS_DISPLAY_DURATION: How long to show status messages (ms)
  STATUS_DISPLAY_DURATION: 2500,
  // Features toggles default values
  USE_GEMINI_NANO: false,
  USE_LANGCHAIN: false
} as const;

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-flash-lite-latest', label: 'Gemini 2.5 Flash Lite Latest' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-flash-latest', label: 'Gemini 2.5 Flash Latest' },
] as const;

export const CHART_CONFIG = {
  MAX_TOP_ITEMS: 15,
  COLORS: {
    // primary/secondary/tertiary: Colors for charts
    primary: 'rgba(59, 130, 246, 0.8)',
    secondary: 'rgba(16, 185, 129, 0.8)',
    tertiary: 'rgba(249, 115, 22, 0.8)'
  }
} as const;
