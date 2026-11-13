import { create } from 'zustand';
import { useStudy } from './state/study';
import { detectIOS } from './install';
import { getItem, getJson, setItem, setJson } from './storage';

// Read-aloud with the system voices (Web Speech API). Reads one verse at a time,
// which lets us highlight the current passage and resume from where it stopped.

const KEY = 'ob:listen';

export const RATES = [0.75, 1, 1.25, 1.5] as const;

interface Prefs {
  rate: number;
  /** Identifier of the chosen voice, by language prefix. */
  voices: Record<string, string>;
  next: boolean;
}

const DEFAULT_PREFS: Prefs = { rate: 1, voices: {}, next: true };

const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...getJson<Partial<Prefs>>(KEY, {}) });

const savePrefs = (p: Prefs) => setJson(KEY, p);

export const listenSupported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

// Some browsers only load the voice list after the first query. Doing it at startup
// avoids waiting on the user's tap, which on iOS must start the speech.
if (listenSupported()) speechSynthesis.getVoices();

const base = (lang: string) => lang.toLowerCase().split(/[-_]/)[0];

/** System voices for the version's language. */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (!listenSupported()) return [];
  const b = base(lang);
  return speechSynthesis.getVoices().filter((v) => base(v.lang) === b);
}

/** Only the voice the person chose. Without a choice, the system uses the language's default voice: on iOS, some voices
 * that are listed are not downloaded and stay silent, and the default is the one we know works. */
function chosenVoice(lang: string): SpeechSynthesisVoice | undefined {
  const saved = loadPrefs().voices[base(lang)];
  return saved ? voicesFor(lang).find((v) => v.voiceURI === saved) : undefined;
}

type Status = 'idle' | 'playing' | 'paused';

interface ListenStore extends Prefs {
  status: Status;
  /** Verse being read (1 to n). */
  verse: number | null;
  /** The chapter ended and the next one still needs to be loaded to continue. */
  advancing: boolean;
  setRate: (r: number) => void;
  setVoice: (lang: string, uri: string) => void;
  setNext: (on: boolean) => void;
}

export const useListen = create<ListenStore>((set, get) => ({
  ...loadPrefs(),
  status: 'idle',
  verse: null,
  advancing: false,
  setRate: (rate) => {
    set({ rate });
    savePrefs(pick(get()));
    if (get().status === 'playing') speakAt(get().verse ?? 1);
  },
  setVoice: (lang, uri) => {
    set({ voices: { ...get().voices, [base(lang)]: uri } });
    savePrefs(pick(get()));
    if (get().status === 'playing') speakAt(get().verse ?? 1);
  },
  setNext: (next) => {
    set({ next });
    savePrefs(pick(get()));
  },
}));

const pick = ({ rate, voices, next }: Prefs): Prefs => ({ rate, voices, next });

let verses: string[] = [];
let lang = 'en';
// Each utterance gets a number; callbacks from cancelled utterances are ignored.
let token = 0;
/** Called when an utterance does not start. Set by the interface to show the notice. */
let onSilent: (() => void) | undefined;
export function setSilentHandler(fn: () => void) {
  onSilent = fn;
}
// The browser may garbage-collect the ongoing utterance if nobody keeps the reference.
let current: SpeechSynthesisUtterance | null = null;

function speakAt(n: number) {
  const token0 = ++token;
  if (n > verses.length) return finishChapter();
  // Calling speak() right after cancel() makes iOS and Chrome swallow the speech. It only cancels if something is ongoing
  // and, in that case, waits a moment before speaking again. The first tap speaks right away, still inside the gesture.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(() => {
      if (token0 === token) say(n, token0);
    }, 80);
  } else say(n, token0);
}

function say(n: number, token0: number) {
  const u = new SpeechSynthesisUtterance(verses[n - 1]);
  u.lang = lang;
  u.rate = useListen.getState().rate;
  const voice = chosenVoice(lang);
  if (voice) u.voice = voice;
  // If the speech does not start, it is almost always the silent switch or a voice without audio: it warns instead of staying mute.
  const silent = setTimeout(() => {
    if (token0 === token) onSilent?.();
  }, 4000);
  u.onstart = () => clearTimeout(silent);
  u.onend = () => {
    clearTimeout(silent);
    if (token0 === token) speakAt(n + 1);
  };
  u.onerror = () => {
    clearTimeout(silent);
    if (token0 === token) stop();
  };
  current = u;
  useListen.setState({ status: 'playing', verse: n, advancing: false });
  // On iOS the synthesizer can get stuck paused after a cancel.
  speechSynthesis.resume();
  speechSynthesis.speak(u);
}

function finishChapter() {
  if (useListen.getState().next && useStudy.getState().step(1)) {
    // The Reader resumes reading when the next chapter's text arrives.
    useListen.setState({ advancing: true });
    scrollTo(0, 0);
  } else stop();
}

/** Starts reading. Returns false when there is no voice for the language. */
export function start(text: string[], language: string, from = 1): boolean {
  if (!listenSupported() || text.length === 0) return false;
  if (voicesFor(language).length === 0) return false;
  verses = text;
  lang = language;
  speakAt(from);
  return true;
}

/** Continues reading in the newly opened chapter. */
export function resume(text: string[], language: string) {
  start(text, language, 1);
}

export function pause() {
  if (useListen.getState().status !== 'playing') return;
  token++;
  speechSynthesis.cancel();
  useListen.setState({ status: 'paused' });
}

export function play() {
  const { status, verse } = useListen.getState();
  if (status === 'paused') speakAt(verse ?? 1);
}

export function stop() {
  token++;
  if (listenSupported()) speechSynthesis.cancel();
  if (current) current.onend = current.onerror = null;
  current = null;
  useListen.setState({ status: 'idle', verse: null, advancing: false });
}


const HINT_KEY = 'ob:listen-hint';

/** On iOS the silent switch mutes the speech and the app has no way to know. Warns only once, before the first reading. */
export function silentHintDue(): boolean {
  if (!detectIOS()) return false;
  return !getItem(HINT_KEY, '1');
}

export function markSilentHintSeen() {
  setItem(HINT_KEY, '1');
}
