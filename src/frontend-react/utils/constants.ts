// Brief: Application-wide constants and default values
export const STORAGE_KEYS = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',
  USE_LANGCHAIN: 'USE_LANGCHAIN'
} as const;

export const DEFAULT_VALUES = {
  GEMINI_MODEL: 'gemini-2.5-flash-lite',
  DEBOUNCE_DELAY: 500,
  STATUS_DISPLAY_DURATION: 2500,
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
    primary: 'rgba(59, 130, 246, 0.8)',
    secondary: 'rgba(16, 185, 129, 0.8)',
    tertiary: 'rgba(249, 115, 22, 0.8)'
  }
} as const;
