import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/literata';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/reader.css';
import './styles/screens.css';
import './styles/features.css';
import App from './App';
import { initSettingsEffects } from './state/settings';
import { boot } from './boot';
import { initAccount } from './state/account';
import { initUpdates } from './update';
import { initAnalytics } from './analytics';
import { applyRuntimeConfig } from './runtimeConfig';

initSettingsEffects();
await applyRuntimeConfig();
boot();
initAccount();
initAnalytics();

initUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const SPLASH_MIN = 1200;
const SPLASH_MAX = 3000;

/** Removes the splash once the app has rendered and the fonts have loaded, but only after it has been visible for 1.2 s. */
const splash = document.getElementById('splash');
if (splash) {
  const fonts = document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve();
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const shown = Math.max(0, SPLASH_MIN - performance.now());
  void Promise.all([Promise.race([fonts, wait(SPLASH_MAX)]), wait(shown)]).then(() =>
    requestAnimationFrame(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 400);
    }),
  );
}
