// Frontend logic for sidebar injection
function injectSidebar(): void {
  // prefer an explicit inject target if present
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar[data-inject]') || document.querySelector<HTMLElement>('aside.sidebar');
  if (!sidebar) return;

  // If sidebar already contains nav links, don't re-insert (idempotent)
  const existingNav = sidebar.querySelector('.nav');
  if (!existingNav) {
    sidebar.innerHTML = `
      <div class="logo">JobsDB Analyzer</div>
      <nav class="nav" role="navigation">
        <a href="/" class="nav-link">Home</a>
        <a href="/result.html" class="nav-link">Result</a>
        <a href="/analysis.html" class="nav-link">Analysis</a>
        <a href="/setting.html" class="nav-link">Settings</a>
      </nav>
    `;
  }

  // mark active link robustly
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const links = sidebar.querySelectorAll<HTMLAnchorElement>('.nav-link');
  links.forEach(link => {
    try {
      const href = link.getAttribute('href') || '';
      // Resolve relative href against current location
      const resolved = new URL(href, window.location.origin).pathname.replace(/\/$/, '') || '/';
      if (resolved === currentPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    } catch (e) {
      // If URL fails, fallback to simple compare
      if (link.getAttribute('href') === currentPath) link.classList.add('active');
    }
  });
}

// Run the injection logic once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  injectSidebar();
});
