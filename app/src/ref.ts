// In right-to-left text the numeric part ("3:16-17") must stay left-to-right, or it renders as "17-3:16".
// U+2066 (LRI) ... U+2069 (PDI) isolates it.
const rtl = () => typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
const isolate = (s: string) => (rtl() ? `⁦${s}⁩` : s);

export const refLabel = (bookName: string, chapter: number, v1?: number, v2?: number) => {
  if (v1 === undefined) return `${bookName} ${isolate(String(chapter))}`;
  const nums = v2 !== undefined && v2 !== v1 ? `${chapter}:${v1}-${v2}` : `${chapter}:${v1}`;
  return `${bookName} ${isolate(nums)}`;
};
