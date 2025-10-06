import React, { useState, FormEvent, ChangeEvent } from 'react';

interface ScrapeFormData {
  region: string;
  pagesMode: string;
  numPages: string;
  keywords: string;
}

export const IndexPage: React.FC = () => {
  const [formData, setFormData] = useState<ScrapeFormData>({
    region: 'hk',
    pagesMode: 'custom',
    numPages: '',
    keywords: ''
  });

  const [progress, setProgress] = useState(0);
  const [resultLog, setResultLog] = useState<string>('Submit to run scraper; results will be shown here when complete.');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePagesModeChange = (value: string) => {
    setFormData(prev => ({ ...prev, pagesMode: value, numPages: value === 'custom' ? prev.numPages : '' }));
  };

  const genToken = (): string => {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResultLog('');
    setProgress(0);
    setIsLoading(true);

    const token = genToken();
    const evt = new EventSource(`/scrape/stream?token=${encodeURIComponent(token)}`);

    evt.addEventListener('progress', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (typeof d.percent === 'number') {
          setProgress(d.percent);
          setResultLog(d.text || `Progress: ${d.percent}%`);
        }
      } catch (err) {
        console.error('Progress parse error:', err);
      }
    });

    evt.addEventListener('log', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        setResultLog(d.text || '');
      } catch (e) {
        console.error('Log parse error:', e);
      }
    });

    evt.addEventListener('error', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        setResultLog(`Error: ${d.error || ''}`);
      } catch (err) {
        setResultLog('Error occurred');
      }
      try {
        evt.close();
      } catch (e) {
        console.error('Close error:', e);
      }
      setIsLoading(false);
    });

    evt.addEventListener('done', () => {
      setProgress(100);
      try {
        evt.close();
      } catch (e) {
        console.error('Close error:', e);
      }
      setIsLoading(false);
    });

    const payload = {
      ...formData,
      token
    };

    try {
      const res = await fetch('/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        setResultLog(err.error || JSON.stringify(err));
        try {
          evt.close();
        } catch (e) {
          console.error('Close error:', e);
        }
        setIsLoading(false);
        return;
      }

      const json = await res.json();
      setResultLog(`Saved file: ${json.file}`);
      setProgress(100);

      // Redirect to result page
      setTimeout(() => {
        window.location.href = `/result.html?file=${encodeURIComponent(json.file)}`;
      }, 1000);
    } catch (e) {
      setResultLog(e instanceof Error ? e.message : String(e));
      try {
        evt.close();
      } catch (err) {
        console.error('Close error:', err);
      }
      setIsLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>Search Filter</h2>
      <div className="grid grid-gap-top">
        <div>
          <form id="scrapeForm" onSubmit={handleSubmit}>
            <div className="field">
              <label>Location</label>
              <div className="row">
                <label className="pill">
                  <input
                    type="radio"
                    name="region"
                    value="hk"
                    checked={formData.region === 'hk'}
                    onChange={handleInputChange}
                  />
                  <span>HK</span>
                </label>
                <label className="pill">
                  <input
                    type="radio"
                    name="region"
                    value="th"
                    checked={formData.region === 'th'}
                    onChange={handleInputChange}
                  />
                  <span>TH</span>
                </label>
              </div>
            </div>

            <div className="field">
              <label>Pages</label>
              <div className="row">
                <label className="pill">
                  <input
                    type="radio"
                    name="pagesMode"
                    value="max"
                    checked={formData.pagesMode === 'max'}
                    onChange={(e) => handlePagesModeChange(e.target.value)}
                  />
                  <span>Max</span>
                </label>
                <label className="pill">
                  <input
                    type="radio"
                    name="pagesMode"
                    value="custom"
                    checked={formData.pagesMode === 'custom'}
                    onChange={(e) => handlePagesModeChange(e.target.value)}
                  />
                  <span>Custom</span>
                </label>
                <input
                  id="numPages"
                  type="number"
                  name="numPages"
                  placeholder="pages"
                  min="1"
                  className="num-pages-input"
                  disabled={formData.pagesMode !== 'custom'}
                  value={formData.numPages}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="field">
              <label>Keywords (comma separated)</label>
              <input
                id="keywords"
                name="keywords"
                placeholder="e.g. cloud engineer, aws"
                value={formData.keywords}
                onChange={handleInputChange}
              />
            </div>

            <div className="actions">
              <button type="submit" className="primary btn-accent" disabled={isLoading}>
                {isLoading ? 'Running...' : 'Run Scraper'}
              </button>
            </div>
          </form>
        </div>

        <aside>
          <div className="preview-label">Result preview</div>
          <div id="resultBox">
            <div id="progressWrap" className="progress-wrap">
              <div className="progress-label">Progress</div>
              <div className="progress-track">
                <div
                  id="progressBar"
                  className="progress-bar"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div id="progressPercent" className="progress-percent">
                {progress}%
              </div>
            </div>
            <div id="resultLog" className="result-log">
              {resultLog || <em>Submit to run scraper; results will be shown here when complete.</em>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
