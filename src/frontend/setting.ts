// Standalone settings page script
document.addEventListener('DOMContentLoaded', function () {
  const gemKeyInput = document.getElementById('gemKey') as HTMLInputElement | null;
  const saveBtn = document.getElementById('saveSettings') as HTMLButtonElement | null;
  const status = document.getElementById('saveStatus') as HTMLElement | null;

  if (!gemKeyInput || !saveBtn || !status) {
    console.error('Settings page: required DOM elements missing');
    return;
  }

  // Load existing key
  gemKeyInput.value = localStorage.getItem('GEMINI_API_KEY') || '';

  // Helper to show transient status message
  function showStatusMessage(text: string) {
    if (!status) return;
    status.textContent = text;
    status.style.display = 'block';
    window.setTimeout(() => { if (status) status.style.display = 'none'; }, 2500);
  }

  // Save button
  saveBtn.addEventListener('click', function () {
    const apiKey = gemKeyInput.value.trim();

    // simple validation
    if (!apiKey) {
      showStatusMessage('Please enter a Gemini API key');
      return;
    }

    try {
      localStorage.setItem('GEMINI_API_KEY', apiKey);
      showStatusMessage('✓ Saved');
    } catch (err) {
      console.error('Failed to save API key', err);
      showStatusMessage('Failed to save');
    }
  });

  // Allow Enter key to save
  gemKeyInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    }
  });
});
