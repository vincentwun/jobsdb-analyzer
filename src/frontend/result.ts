async function load(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  
  const jsonView = document.getElementById('jsonView');
  const meta = document.getElementById('meta');

  if (!jsonView || !meta) {
    console.error('Required elements not found');
    return;
  }

  if (!file) {
    jsonView.innerText = 'No file specified';
    return;
  }

  try {
    const res = await fetch(`/results/${encodeURIComponent(file)}`);
    if (!res.ok) {
      jsonView.innerText = 'Failed to load result';
      return;
    }
    const text = await res.text();
    meta.innerText = file;
    jsonView.innerText = text;
  } catch (e) {
    jsonView.innerText = 'Failed to load result: ' + (e instanceof Error ? e.message : String(e));
  }
}

load();
