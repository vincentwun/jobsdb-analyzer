import React, { useState, useEffect, useRef } from 'react';
import { GEMINI_MODELS, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/constants';
import { saveToLocalStorage, getFromLocalStorage } from '../utils/localStorage';

export const SettingPage: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_VALUES.GEMINI_MODEL);
  const [saveStatus, setSaveStatus] = useState<string>('');
  
  // Flag to prevent auto-save on initial mount
  const initialLoadComplete = useRef<boolean>(false);

  // Load saved settings on mount
  useEffect(() => {
    const storedKey = getFromLocalStorage(STORAGE_KEYS.GEMINI_API_KEY);
    const storedModel = getFromLocalStorage(STORAGE_KEYS.GEMINI_MODEL, DEFAULT_VALUES.GEMINI_MODEL);
    setApiKey(storedKey);
    setSelectedModel(storedModel);

    // Mark initial load complete on next tick to prevent auto-save trigger
    setTimeout(() => {
      initialLoadComplete.current = true;
    }, 0);
  }, []);

  // Timer ref for debouncing apiKey saves
  const apiKeyTimer = useRef<number | null>(null);

  // Shared save helper to avoid repeating showStatus/error handling
  const saveSetting = (storageKey: string, value: string) => {
    const success = saveToLocalStorage(storageKey, value);
    showStatus(success ? '✓ Saved' : 'Failed to save');
  };

  // Auto-save API key when it changes (debounced)
  useEffect(() => {
    // Don't auto-save during initial load
    if (!initialLoadComplete.current) return;

    // Skip if unchanged or empty
    const stored = getFromLocalStorage(STORAGE_KEYS.GEMINI_API_KEY);
    const trimmedKey = apiKey.trim();
    if (trimmedKey === '' || trimmedKey === stored) return;

    if (apiKeyTimer.current) {
      clearTimeout(apiKeyTimer.current);
    }
    apiKeyTimer.current = window.setTimeout(() => {
      saveSetting(STORAGE_KEYS.GEMINI_API_KEY, trimmedKey);
      apiKeyTimer.current = null;
    }, DEFAULT_VALUES.DEBOUNCE_DELAY);

    return () => {
      if (apiKeyTimer.current) clearTimeout(apiKeyTimer.current);
    };
  }, [apiKey]);

  // Auto-save model when it changes (immediate)
  useEffect(() => {
    // Don't auto-save during initial load
    if (!initialLoadComplete.current) return;

    const storedModel = getFromLocalStorage(STORAGE_KEYS.GEMINI_MODEL);
    if (selectedModel === storedModel) return;
    saveSetting(STORAGE_KEYS.GEMINI_MODEL, selectedModel);
  }, [selectedModel]);

  const showStatus = (text: string) => {
    setSaveStatus(text);
    setTimeout(() => {
      setSaveStatus('');
    }, DEFAULT_VALUES.STATUS_DISPLAY_DURATION);
  };

  return (
    <section className="panel">
      <h2>Settings</h2>
      <p className="muted-note">Configure your Gemini API settings (auto-saved to localStorage)</p>

      <div className="settings-wrapper">
        <div className="setting-field">
          <label htmlFor="gemKey" className="setting-label">Gemini API Key</label>
          <input
            id="gemKey"
            type="password"
            className="setting-input"
            placeholder="Enter Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="setting-field">
          <label htmlFor="gemModel" className="setting-label">Gemini Model</label>
          <select
            id="gemModel"
            className="setting-input"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {GEMINI_MODELS.map(model => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {saveStatus && (
          <div className="save-status" style={{ marginTop: '12px', color: '#065f46' }}>
            {saveStatus}
          </div>
        )}
      </div>
    </section>
  );
};
