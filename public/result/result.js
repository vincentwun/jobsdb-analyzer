async function load(){
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  if(!file){ document.getElementById('jsonView').innerText = 'No file specified'; return }
  const res = await fetch(`/results/${encodeURIComponent(file)}`);
  if(!res.ok){ document.getElementById('jsonView').innerText = 'Failed to load result'; return }
  const text = await res.text();
  document.getElementById('meta').innerText = file;
  document.getElementById('jsonView').innerText = text;
}
load();
