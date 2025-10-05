document.addEventListener('DOMContentLoaded', () => {
  // form and result behavior
  const form = document.getElementById('scrapeForm');
  const numPagesInput = document.getElementById('numPages');
  const resultBox = document.getElementById('resultBox');

  document.querySelectorAll('input[name="pagesMode"]').forEach(el => {
    el.addEventListener('change', (e) => {
      numPagesInput.disabled = e.target.value === 'max';
    })
  })

  // helper: random token
  function genToken(){
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function updateProgress(pct, text){
    const bar = document.getElementById('progressBar');
    const percent = document.getElementById('progressPercent');
    const log = document.getElementById('resultLog');
    if(bar) bar.style.width = pct + '%';
    if(percent) percent.innerText = pct + '%';
    if(text && log){
      log.innerText = text.trim();
    }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    document.getElementById('resultLog').innerHTML = '';
    updateProgress(0, 'Starting...');

    const token = genToken();
    const evt = new EventSource('/scrape/stream?token=' + encodeURIComponent(token));

    evt.addEventListener('progress', (e) => {
      try{
        const d = JSON.parse(e.data);
        if(typeof d.percent === 'number') updateProgress(d.percent, d.text || ('Progress: ' + d.percent + '%'));
      }catch(err){}
    });
    evt.addEventListener('log', (e) => {
      try{ const d = JSON.parse(e.data); document.getElementById('resultLog').innerText = d.text || ''; }catch(e){}
    });
    evt.addEventListener('error', (e) => {
      try{ const d = JSON.parse(e.data); document.getElementById('resultLog').innerText = 'Error: ' + (d.error||''); }catch(err){}
      try{ evt.close(); }catch(e){}
    });
    evt.addEventListener('done', (e) => {
      try{ const d = JSON.parse(e.data); updateProgress(100, 'Completed'); }catch(err){}
      try{ evt.close(); }catch(e){}
    });

    const formData = new FormData(form);
    const payload = {
      region: formData.get('region'),
      pagesMode: formData.get('pagesMode'),
      numPages: formData.get('numPages') || '',
      keywords: document.getElementById('keywords').value || '',
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
        document.getElementById('resultLog').innerHTML = '<pre>' + (err.error || JSON.stringify(err)) + '</pre>';
        try{ evt.close(); }catch(e){}
        return;
      }
      const json = await res.json();
      document.getElementById('resultLog').innerHTML = `<div>Saved file: <strong>${json.file}</strong></div><div style="margin-top:8px"><a href="/result.html?file=${encodeURIComponent(json.file)}">View result</a></div>`;
      updateProgress(100, 'Completed');
      
      // Redirect to result page with file parameter
      setTimeout(() => {
        window.location.href = `/result.html?file=${encodeURIComponent(json.file)}`;
      }, 1000);
    } catch (e) {
      document.getElementById('resultLog').innerHTML = '<pre>' + e.toString() + '</pre>';
      try{ evt.close(); }catch(err){}
    }
  });
});
