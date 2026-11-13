import catalog from './catalog.json';

export interface VersionInfo {
  id: string;
  lang: string; // ISO code, used with Intl.DisplayNames
  name: string;
  sizeMb: number;
  books: number;
  coverage?: 'nt' | 'ot' | 'partial';
  rtl?: boolean;
}

/** Commit of the text source the catalog was generated from. Downloads use the same commit. */
export const CATALOG_SHA: string = catalog.sha;
export const VERSIONS = catalog.versions as VersionInfo[];

export const abbrOf = (id: string) => id.split('_').slice(1).join('_').toUpperCase();
export const findVersion = (id: string) => VERSIONS.find((v) => v.id === id);

/** First version choice per UI language. Only applies if that language has nothing downloaded yet. */
const SUGGESTED: Record<string, string> = { ar: 'ar_kehm', en: 'en_web' };
export const suggestedVersion = (uiLang: string) => SUGGESTED[uiLang] ?? 'ar_kehm';

/** Own server first (works where third-party CDNs are blocked); the public CDN is only a fallback. */
export let cdnFallback = true;
export function setCdnFallback(on: boolean) { cdnFallback = on; }
export const versionUrls = (id: string) => [
  `/texts/${id}.json`,
  ...(cdnFallback
    ? [
        `https://cdn.jsdelivr.net/gh/thiagobodruk/bible@${CATALOG_SHA}/json/${id}.json`,
        `https://raw.githubusercontent.com/thiagobodruk/bible/${CATALOG_SHA}/json/${id}.json`,
      ]
    : []),
];
