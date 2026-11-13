import { useEffect, useRef, useState } from 'react';
import { dictationSupported, startDictation } from './stt';
import { useSettings } from './state/settings';
import { useUI } from './state/ui';
import { useT } from './i18n';
import { getItem, setItem } from './storage';

const MIC_NOTICE = 'ob:stt-notice';

// Without storage the notice doesn't show, to avoid repeating on every use.
const noticeSeen = () => getItem(MIC_NOTICE, '1') === '1';

/** Voice dictation into a text field: what is spoken is appended to the current text as it is recognized. */
export function useDictation(value: string, setValue: (v: string) => void, onStart?: () => void) {
  const t = useT();
  const uiLang = useSettings((s) => s.uiLang);
  const notify = useUI((s) => s.notify);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const toggle = () => {
    if (listening) return stopRef.current?.();
    if (!noticeSeen()) {
      notify(t('sttNotice'));
      setItem(MIC_NOTICE, '1');
    }
    const base = value.trim();
    stopRef.current = startDictation(uiLang, {
      onText: (spoken) => setValue(base ? `${base} ${spoken}` : spoken),
      onEnd: () => {
        setListening(false);
        stopRef.current = null;
      },
      onError: (kind) => notify(t(kind === 'denied' ? 'sttDenied' : kind === 'network' ? 'sttNetwork' : 'sttFailed')),
    });
    setListening(stopRef.current !== null);
    if (stopRef.current) onStart?.();
  };

  return { supported: dictationSupported(), listening, toggle, stop: () => stopRef.current?.() };
}
