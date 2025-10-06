import React, { useState, useEffect, FormEvent } from 'react';

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

export const SettingPage: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-lite');
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    const storedKey = localStorage.getItem('GEMINI_API_KEY') || '';
    const storedModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
    setApiKey(storedKey);
    setSelectedModel(storedModel);
  }, []);

  const handleSave = (e?: FormEvent) => {
    if (e) e.preventDefault();

    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      showStatus('Please enter a Gemini API key');
      return;
    }

    try {
      localStorage.setItem('GEMINI_API_KEY', trimmedKey);
      localStorage.setItem('GEMINI_MODEL', selectedModel);
      showStatus('✓ Saved');
    } catch (err) {
      console.error('Failed to save settings', err);
      showStatus('Failed to save');
    }
  };

  const showStatus = (text: string) => {
    setSaveStatus(text);
    setTimeout(() => {
      setSaveStatus('');
    }, 2500);
  };

  return (
    <section className="panel">
      <h2>Settings</h2>
      <p className="muted-note">Configure your Gemini API settings (stored locally in localStorage)</p>

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
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
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

        <div className="setting-actions">
          <button id="saveSettings" className="btn-accent" onClick={handleSave}>
            <i className="fas fa-floppy-disk" aria-hidden="true" style={{ marginRight: '6px' }}></i>
            Save
          </button>
          {saveStatus && (
            <div id="saveStatus" className="save-status">
              {saveStatus}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
