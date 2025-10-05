document.addEventListener('DOMContentLoaded', () => {
  // tabs
  const tabs = document.querySelectorAll('.nav button');
  const sections = { home: document.getElementById('home'), result: document.getElementById('result'), analysis: document.getElementById('analysis') };

  function showTab(name){
    Object.keys(sections).forEach(k => {
      const el = sections[k];
      if(k === name){ el.style.display = ''; }
      else { el.style.display = 'none'; }
    });
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  }

  tabs.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // form and result behavior
  const form = document.getElementById('scrapeForm');
  const numPagesInput = document.getElementById('numPages');
  const resultBox = document.getElementById('resultBox');
  const jsonView = document.getElementById('jsonView');
  const resultMeta = document.getElementById('resultMeta');

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
      // append new text line (keep short)
      log.innerText = text.trim();
    }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    // prepare UI
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

    // send POST; server will still respond with final JSON
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
      // show saved file and content
      document.getElementById('resultLog').innerHTML = `<div>Saved file: <strong>${json.file}</strong></div><div style="margin-top:8px"><a href="/result.html?file=${encodeURIComponent(json.file)}" target="_blank">View result</a></div>`;
      resultMeta.innerText = json.file || '—';
      jsonView.innerText = json.content || '';
      updateProgress(100, 'Completed');
      showTab('result');
    } catch (e) {
      document.getElementById('resultLog').innerHTML = '<pre>' + e.toString() + '</pre>';
      try{ evt.close(); }catch(err){}
    }
  });

  // allow loading a saved result file by name into Result tab
  async function loadResultFile(file){
    if(!file) return;
    try{
      const res = await fetch(`/results/${encodeURIComponent(file)}`);
      if(!res.ok){ jsonView.innerText = 'Failed to load result'; return }
      const text = await res.text();
      resultMeta.innerText = file;
      jsonView.innerText = text;
      showTab('result');
    } catch(err){ jsonView.innerText = err.toString(); }
  }

  // if result.html was opened with ?file=..., support direct loading (when index.html is used with query param)
  (function tryLoadFromQuery(){
    try{
      const params = new URLSearchParams(window.location.search);
      const file = params.get('file');
      if(file) loadResultFile(file);
    }catch(e){}
  })();
});
