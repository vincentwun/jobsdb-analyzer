document.addEventListener('DOMContentLoaded', () => {
  // form and result behavior
  const form = document.getElementById('scrapeForm') as HTMLFormElement | null;
  const numPagesInput = document.getElementById('numPages') as HTMLInputElement | null;
  const keywordsInput = document.getElementById('keywords') as HTMLInputElement | null;
  const resultLog = document.getElementById('resultLog') as HTMLElement | null;

  if (!form || !numPagesInput || !keywordsInput || !resultLog) {
    console.error('One or more required elements are missing from the DOM');
    return;
  }

  document.querySelectorAll('input[name="pagesMode"]').forEach(el => {
    el.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (numPagesInput) {
        numPagesInput.disabled = target.value === 'max';
      }
    });
  });

  // helper: random token
  function genToken(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function updateProgress(pct: number, text?: string): void {
    const bar = document.getElementById('progressBar') as HTMLElement | null;
    const percent = document.getElementById('progressPercent') as HTMLElement | null;
    
    if (bar) bar.style.width = pct + '%';
    if (percent) percent.innerText = pct + '%';
    if (text && resultLog) {
      resultLog.innerText = text.trim();
    }
  }

  form.addEventListener('submit', async (ev: SubmitEvent) => {
    ev.preventDefault();
    if (resultLog) {
      resultLog.innerHTML = '';
    }
    updateProgress(0, 'Starting...');

    const token = genToken();
    const evt = new EventSource('/scrape/stream?token=' + encodeURIComponent(token));

    evt.addEventListener('progress', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (typeof d.percent === 'number') {
          updateProgress(d.percent, d.text || ('Progress: ' + d.percent + '%'));
        }
      } catch (err) { }
    });

    evt.addEventListener('log', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (resultLog) resultLog.innerText = d.text || '';
      } catch (e) { }
    });

    evt.addEventListener('error', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (resultLog) resultLog.innerText = 'Error: ' + (d.error || '');
      } catch (err) { }
      try { evt.close(); } catch (e) { }
    });

    evt.addEventListener('done', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        updateProgress(100, 'Completed');
      } catch (err) { }
      try { evt.close(); } catch (e) { }
    });

    const formData = new FormData(form);
    const payload = {
      region: formData.get('region'),
      pagesMode: formData.get('pagesMode'),
      numPages: formData.get('numPages') || '',
      keywords: keywordsInput.value || '',
      token
    };

    try {
      const res = await fetch('/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resultLog) return;

      if (!res.ok) {
        const err = await res.json();
        resultLog.innerHTML = '<pre>' + (err.error || JSON.stringify(err)) + '</pre>';
        try { evt.close(); } catch (e) { }
        return;
      }
      const json = await res.json();
      resultLog.innerHTML = `<div>Saved file: <strong>${json.file}</strong></div><div style="margin-top:8px"><a href="/result.html?file=${encodeURIComponent(json.file)}">View result</a></div>`;
      updateProgress(100, 'Completed');

      // Redirect to result page with file parameter
      setTimeout(() => {
        window.location.href = `/result.html?file=${encodeURIComponent(json.file)}`;
      }, 1000);
    } catch (e) {
      if (resultLog) {
        resultLog.innerHTML = '<pre>' + (e instanceof Error ? e.message : String(e)) + '</pre>';
      }
      try { evt.close(); } catch (err) { }
    }
  });
});
