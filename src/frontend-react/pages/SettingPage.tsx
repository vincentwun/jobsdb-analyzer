import React, { useState, useEffect, FormEvent } from 'react';

export const SettingPage: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('GEMINI_API_KEY') || '';
    setApiKey(stored);
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
      showStatus('✓ Saved');
    } catch (err) {
      console.error('Failed to save API key', err);
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
      <p className="muted-note">Enter your Gemini API Key (stored locally in localStorage)</p>

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

        <div className="setting-actions">
          <button id="saveSettings" className="btn-accent" onClick={handleSave}>
            <i className="fas fa-floppy-disk" aria-hidden="true" style={{ marginRight: '6px' }}></i>
            Save
          </button>
          {saveStatus && (
            <div id="saveStatus" className="save-status" style={{ display: 'block' }}>
              {saveStatus}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
