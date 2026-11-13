// Applies the theme before the first paint to avoid a flash.
try {
  var s = JSON.parse(localStorage.getItem('ob:settings') || '{}');
  var t = s.theme || 'auto';
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
} catch (e) {}
// On Android the installed PWA already shows the system splash, so ours is left out.
if (/Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches) document.documentElement.classList.add('no-splash');

// Language/direction before first paint, to avoid a flash of the wrong layout.
try {
  var l = JSON.parse(localStorage.getItem('ob:settings') || '{}').uiLang;
  if (l === 'en' && localStorage.getItem('ob:lang-ar-default')) { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; }
} catch (e) {}
