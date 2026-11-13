// Tells a plain keyword search from a request meant for the AI, such as "texts about perseverance".
// It runs on the device, so nothing is sent until the reader chooses to ask.

/** Words that start a request or a question, per language (compared without accents). */
const LEADS: Record<string, string[]> = {
  en: ['verses', 'passages', 'texts', 'scriptures', 'what', 'how', 'why', 'who', 'where', 'when', 'which', 'show', 'find', 'list', 'give', 'tell', 'explain', 'does', 'is', 'are', 'can'],
  'pt-BR': ['versiculos', 'passagens', 'textos', 'trechos', 'o que', 'como', 'por que', 'porque', 'quem', 'onde', 'quando', 'qual', 'quais', 'traga', 'mostre', 'liste', 'busque', 'encontre', 'explique', 'existe', 'a biblia'],
  es: ['versiculos', 'pasajes', 'textos', 'que', 'como', 'por que', 'quien', 'donde', 'cuando', 'cual', 'cuales', 'muestra', 'busca', 'dame', 'explica'],
  fr: ['versets', 'passages', 'textes', 'que', 'quoi', 'comment', 'pourquoi', 'qui', 'ou', 'quand', 'quel', 'quels', 'montre', 'trouve', 'donne', 'explique'],
  de: ['verse', 'stellen', 'texte', 'was', 'wie', 'warum', 'wer', 'wo', 'wann', 'welche', 'zeige', 'finde', 'nenne', 'erklare'],
  'zh-CN': ['有哪些', '哪些', '什么', '为什么', '如何', '怎么', '请', '找', '关于'],
  ja: ['どんな', '何', 'なぜ', 'どう', '教えて', '探して', '聖句', '箇所'],
};

/** From this many words a search is taken as a sentence, not as keywords. */
export const PROMPT_WORDS = 4;

const flat = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** True when the text reads like a request: it ends in "?", has several words, or opens with a request or question word. */
export function looksLikePrompt(query: string, lang: string): boolean {
  const q = flat(query);
  if (!q) return false;
  if (/[?？]\s*$/.test(q)) return true;
  if (q.split(/\s+/).length >= PROMPT_WORDS) return true;
  const leads = LEADS[lang] ?? LEADS.en;
  if (/[぀-ヿ㐀-鿿]/.test(q)) return q.length >= 3 && leads.some((l) => q.startsWith(l));
  const words = q.split(/\s+/);
  return words.length >= 2 && leads.some((l) => (q === l || q.startsWith(`${l} `)) && words.length >= l.split(' ').length + 1);
}
