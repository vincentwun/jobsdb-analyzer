// Safe localStorage utility functions
import { STORAGE_KEYS, DEFAULT_VALUES } from './constants';

/**
 * Safely save value to localStorage with error handling
 */
export function saveToLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
    return false;
  }
}

/**
 * Safely get value from localStorage with fallback
 */
export function getFromLocalStorage(key: string, fallback: string = ''): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

/**
 * Get Gemini API key from localStorage
 */
export function getGeminiApiKey(): string | null {
  const key = getFromLocalStorage(STORAGE_KEYS.GEMINI_API_KEY);
  return key || null;
}

/**
 * Get selected Gemini model from localStorage
 */
export function getGeminiModel(): string {
  return getFromLocalStorage(STORAGE_KEYS.GEMINI_MODEL, DEFAULT_VALUES.GEMINI_MODEL);
}

/**
 * Get whether to use LangChain from localStorage
 */
export function getUseLangChain(): boolean {
  const value = getFromLocalStorage(STORAGE_KEYS.USE_LANGCHAIN, String(DEFAULT_VALUES.USE_LANGCHAIN));
  return value === 'true';
}
