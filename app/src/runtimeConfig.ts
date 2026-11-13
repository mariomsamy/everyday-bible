import { setAiEnabled } from './ai';
import { setCdnFallback } from './data/catalog';

export interface PixelConfig { meta?: string; tiktok?: string; snap?: string; ga4?: string }
interface RuntimeConfig { pixels?: PixelConfig; ai?: { enabled?: boolean }; cdn?: boolean }

let cached: Promise<RuntimeConfig> | null = null;

/** Settings the owner controls from the admin page (pixels, AI on/off). Fetched once; offline or failing means "nothing extra". */
export function runtimeConfig(): Promise<RuntimeConfig> {
  cached ??= fetch('/api/config', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<RuntimeConfig>) : {}))
    .catch(() => ({}));
  return cached;
}

/** Applies the config before the first render, but never waits more than `ms` (slow network must not block the app). */
export async function applyRuntimeConfig(ms = 1500): Promise<void> {
  const c = await Promise.race([runtimeConfig(), new Promise<RuntimeConfig>((r) => setTimeout(() => r({}), ms))]);
  if (c.ai?.enabled) setAiEnabled(true);
  if (c.cdn === false) setCdnFallback(false);
}
