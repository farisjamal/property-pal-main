// Applies the persisted (or system-preferred) color theme before first paint
// to prevent a flash of the wrong theme. Kept as an external file so the
// Content-Security-Policy can use `script-src 'self'` without inline allowances.
(function () {
  var stored = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
