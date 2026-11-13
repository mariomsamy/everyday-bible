import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// The app is served from the root of its own domain by server/index.mjs
const base = '/';

const build = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';

// Publishes the build version and commit, so the app can tell what is new without downloading the service worker.
const versionFile: Plugin = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build }) });
  },
};

// Fills in the version on the splash, which lives in index.html and shows before any JavaScript runs.
const htmlVersion: Plugin = {
  name: 'html-version',
  transformIndexHtml: (html) => html.replace('%APP_VERSION%', pkg.version),
};

// GitHub Pages serves 404.html for unknown paths. With the same content as index, links like /pt_nvi/jn/3 open the app.
const spaFallback: Plugin = {
  name: 'spa-fallback',
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      const index = bundle['index.html'];
      if (index?.type === 'asset') this.emitFile({ type: 'asset', fileName: '404.html', source: index.source });
    },
  },
};

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    spaFallback,
    versionFile,
    htmlVersion,
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-64.png'],
      manifest: {
        id: base,
        name: 'الكتاب المقدس',
        short_name: 'الكتاب المقدس',
        description: 'اقرأ الكتاب المقدس بخطة تناسبك وتابع تقدّمك. مجاني، بدون حساب، ويعمل بلا إنترنت.',
        lang: 'ar',
        dir: 'rtl',
        categories: ['books', 'education', 'lifestyle'],
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf9f7',
        theme_color: '#faf9f7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['404.html', 'data/**'],
        cleanupOutdatedCaches: true,
        // Version texts come from a CDN and live in IndexedDB. The service worker only caches the app.
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/, /^\/data\//, /^\/texts\//, /^\/healthz/],
        // Cross-references are downloaded per book on first use, and then work offline.
        runtimeCaching: [
          // This function is copied into the service worker, where `base` does not exist, so the path is spelled out.
          { urlPattern: ({ url }) => url.pathname.startsWith('/xrefs/'), handler: 'StaleWhileRevalidate', options: { cacheName: 'xrefs' } },
        ],
      },
    }),
  ],
});
