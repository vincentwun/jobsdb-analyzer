// Brief: Safe helpers for reading and writing settings to localStorage
import { STORAGE_KEYS, DEFAULT_VALUES } from './constants';

export function saveToLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
    return false;
  }
}

export function getFromLocalStorage(key: string, fallback: string = ''): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

export function getGeminiApiKey(): string | null {
  const key = getFromLocalStorage(STORAGE_KEYS.GEMINI_API_KEY);
  return key || null;
}

export function getGeminiModel(): string {
  return getFromLocalStorage(STORAGE_KEYS.GEMINI_MODEL, DEFAULT_VALUES.GEMINI_MODEL);
}

export function getUseLangChain(): boolean {
  const value = getFromLocalStorage(STORAGE_KEYS.USE_LANGCHAIN, String(DEFAULT_VALUES.USE_LANGCHAIN));
  return value === 'true';
}

export function getUseGeminiNano(): boolean {
  const value = getFromLocalStorage(STORAGE_KEYS.USE_GEMINI_NANO, String(DEFAULT_VALUES.USE_GEMINI_NANO));
  return value === 'true';
}

export function getSelectedResultFile(): string {
  return getFromLocalStorage(STORAGE_KEYS.SELECTED_RESULT_FILE, '');
}

export function saveSelectedResultFile(filename: string): boolean {
  return saveToLocalStorage(STORAGE_KEYS.SELECTED_RESULT_FILE, filename);
}
