import { registerSW } from 'virtual:pwa-register';

let registration: ServiceWorkerRegistration | undefined;
let waiting = false;

const apply = registerSW({
  onNeedRefresh() {
    waiting = true;
  },
  onRegisteredSW(_url, r) {
    registration = r;
  },
});

/**
 * Activates the waiting worker and reloads when it takes over the page.
 * On iOS the controllerchange event may not arrive, so it also listens to the worker itself
 * and reloads on a timeout if nothing happens.
 */
function activate() {
  const w = registration?.waiting;
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  w?.addEventListener('statechange', () => w.state === 'activated' && reload());
  void apply(false);
  w?.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(reload, 4000);
}

const RECHECK = 10 * 60 * 1000;
let lastCheck = Date.now();

/**
 * The new version waits in the background and takes over when the app goes out of view, without interrupting reading.
 * When returning to the app, it checks for a new version (at most every 10 minutes), which will take over on the next exit.
 */
export function initUpdates() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (waiting) activate();
    } else if (!waiting && registration && Date.now() - lastCheck > RECHECK) {
      lastCheck = Date.now();
      registration.update().catch(() => {});
    }
  });
}

export type UpdateResult = 'updating' | 'latest' | 'offline';

const TIMEOUT = 20000;

/** Waits for the worker to reach one of the states, or gives up at the timeout. */
const until = (w: ServiceWorker, states: ServiceWorkerState[]) =>
  new Promise<void>((resolve) => {
    if (states.includes(w.state)) return resolve();
    w.addEventListener('statechange', () => states.includes(w.state) && resolve());
    setTimeout(resolve, TIMEOUT);
  });

/** Checks for a new version now and, if there is one, applies it and reloads the page. */
export async function checkForUpdate(): Promise<UpdateResult> {
  if (waiting) {
    activate();
    return 'updating';
  }
  if (!registration) return 'latest';
  const before = registration.active;
  let found: ServiceWorker | null = null;
  try {
    await registration.update();
    found = registration.installing;
    if (found) await until(found, ['installed', 'activated', 'redundant']);
  } catch {
    return 'offline';
  }
  if (registration.waiting) {
    activate();
    return 'updating';
  }
  // The new worker already took over on its own (for example, on the first session): just reload.
  if (registration.active !== before) {
    location.reload();
    return 'updating';
  }
  return 'latest';
}

export interface BuildInfo {
  version: string;
  build: string;
}

export const currentBuild: BuildInfo = { version: __APP_VERSION__, build: __APP_BUILD__ };

/** "1.0.0 (a1b2c3d)" */
export const buildLabel = (b: BuildInfo) => `v${b.version} (${b.build})`;

/** What is published right now. Null without a connection or outside the published site. */
export async function fetchLatestBuild(): Promise<BuildInfo | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as Partial<BuildInfo>;
    return typeof j.version === 'string' && typeof j.build === 'string' ? { version: j.version, build: j.build } : null;
  } catch {
    return null;
  }
}
