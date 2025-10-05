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

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    resultBox.innerHTML = '<em>Running scraper...</em>';
    const formData = new FormData(form);
    const payload = {
      region: formData.get('region'),
      pagesMode: formData.get('pagesMode'),
      numPages: formData.get('numPages') || '',
      keywords: document.getElementById('keywords').value || ''
    };
    try {
      const res = await fetch('/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        resultBox.innerHTML = '<pre>' + (err.error || JSON.stringify(err)) + '</pre>';
        return;
      }
      const json = await res.json();
      resultBox.innerHTML = `<div>Saved file: <strong>${json.file}</strong></div><div style="margin-top:8px"><a href="/result.html?file=${encodeURIComponent(json.file)}" target="_blank">View result</a></div><pre>${json.content.slice(0,1000)}${json.content.length>1000? '\n\n...truncated...':''}</pre>`;
      // populate Result tab view
      resultMeta.innerText = json.file || '—';
      jsonView.innerText = json.content || '';
      // switch to Result tab automatically
      showTab('result');
    } catch (e) {
      resultBox.innerHTML = '<pre>' + e.toString() + '</pre>';
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
