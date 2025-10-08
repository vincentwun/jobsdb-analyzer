// Summary: Small wrappers to read/write app settings in localStorage
import { STORAGE_KEYS, DEFAULT_VALUES } from './constants';

// saveToLocalStorage: Save a string value under a key, return success flag
export function saveToLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
    return false;
  }
}

// getFromLocalStorage: Read a string value or return a fallback
export function getFromLocalStorage(key: string, fallback: string = ''): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

// getGeminiApiKey: Return stored Gemini API key or null
export function getGeminiApiKey(): string | null {
  const key = getFromLocalStorage(STORAGE_KEYS.GEMINI_API_KEY);
  return key || null;
}

// getGeminiModel: Return stored model or default model
export function getGeminiModel(): string {
  return getFromLocalStorage(STORAGE_KEYS.GEMINI_MODEL, DEFAULT_VALUES.GEMINI_MODEL);
}

// getUseLangChain: Return boolean flag read from storage
export function getUseLangChain(): boolean {
  const value = getFromLocalStorage(STORAGE_KEYS.USE_LANGCHAIN, String(DEFAULT_VALUES.USE_LANGCHAIN));
  return value === 'true';
}

// getUseGeminiNano: Return boolean flag read from storage
export function getUseGeminiNano(): boolean {
  const value = getFromLocalStorage(STORAGE_KEYS.USE_GEMINI_NANO, String(DEFAULT_VALUES.USE_GEMINI_NANO));
  return value === 'true';
}

// getSelectedResultFile: Return last selected result filename
export function getSelectedResultFile(): string {
  return getFromLocalStorage(STORAGE_KEYS.SELECTED_RESULT_FILE, '');
}

// saveSelectedResultFile: Save selected result filename
export function saveSelectedResultFile(filename: string): boolean {
  return saveToLocalStorage(STORAGE_KEYS.SELECTED_RESULT_FILE, filename);
}
