import type { UiLang } from './state/settings';

/** Dictation through the browser's speech recognition API. The transcription is done by the browser's own service. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type Ctor = new () => Recognition;

const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const dictationSupported = () => !!ctor();

const LOCALES: Record<UiLang, string> = { ar: 'ar-EG', en: 'en-US' };

export type DictationError = 'denied' | 'network' | 'failed';

interface Handlers {
  onText: (text: string) => void;
  onEnd: () => void;
  onError: (kind: DictationError) => void;
}

/** Starts listening. Returns a function that stops it. */
export function startDictation(lang: UiLang, { onText, onEnd, onError }: Handlers): (() => void) | null {
  const Recognizer = ctor();
  if (!Recognizer) return null;
  const rec = new Recognizer();
  rec.lang = LOCALES[lang];
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    onText(text.trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') onError('denied');
    else if (e.error === 'network') onError('network');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') onError('failed');
  };
  rec.onend = onEnd;
  try {
    rec.start();
  } catch {
    onError('failed');
    return null;
  }
  return () => rec.stop();
}
