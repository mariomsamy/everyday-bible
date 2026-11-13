/** AI client. By default it talks to this app's own server (/api/ai/ask), switched on from the admin page.
 * VITE_AI_URL can still point to an external service. */
export const AI_URL: string = import.meta.env.VITE_AI_URL ?? '';
/** Live binding: set once at startup from /api/config (see runtimeConfig.ts) before the first render. */
export let aiEnabled = AI_URL.length > 0;
export function setAiEnabled(on: boolean) { aiEnabled = on; }

export interface AiPassage {
  ref: string;
  version: string;
  text: string;
  /** The whole chapter, when the passage is a selection: where the pill goes back to when a verse is removed. */
  wide?: { ref: string; text: string };
  /** Passages the app found related to this one, each "Reference: text". Used by the Relate shortcut. */
  related?: string[];
  /** A search by theme: there is no passage, and the AI answers with a list of passages. */
  topic?: boolean;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** limit: too many questions in one minute. daily: this device's daily limit. busy: the service quota ran out. */
export type AiErrorKind = 'offline' | 'limit' | 'daily' | 'busy' | 'failed';

export class AiError extends Error {
  constructor(public kind: AiErrorKind) {
    super(kind);
  }
}

interface Request {
  question: string;
  passage: AiPassage;
  lang: string;
  history: AiMessage[];
  signal: AbortSignal;
  onText: (chunk: string) => void;
}

/** Sends the question and delivers the answer piece by piece, reading the event stream in OpenAI format. */
export async function askAI({ question, passage, lang, history, signal, onText }: Request): Promise<void> {
  let res: Response;
  try {
    res = await fetch(AI_URL ? `${AI_URL.replace(/\/$/, '')}/ask` : '/api/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, passage: { ref: passage.ref, version: passage.version, text: passage.text, related: passage.related }, mode: passage.topic ? 'topic' : undefined, lang, history }),
      signal,
    });
  } catch {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    throw new AiError(navigator.onLine === false ? 'offline' : 'failed');
  }
  if (!res.ok || !res.body) {
    if (res.status !== 429) throw new AiError('failed');
    const code = await res.json().then((j) => j?.error, () => undefined);
    throw new AiError(code === 'daily_limit' ? 'daily' : code === 'quota' ? 'busy' : 'limit');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let got = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 65_536) throw new Error('line too long'); // a stream line without a newline must not grow without bound
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const piece = JSON.parse(data).choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece) {
            got = true;
            onText(piece);
          }
        } catch {
          /* incomplete line or of another type */
        }
      }
    }
  } catch {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    throw new AiError(got ? 'failed' : navigator.onLine === false ? 'offline' : 'failed');
  }
  if (!got) throw new AiError('failed');
}
