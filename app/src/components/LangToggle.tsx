import { Translate } from '@phosphor-icons/react';
import { useSettings } from '../state/settings';

/** One-tap switch of the interface language, shown on the first screens. Always labelled in the language it switches to. */
export function LangToggle() {
  const uiLang = useSettings((s) => s.uiLang);
  const set = useSettings((s) => s.set);
  const next = uiLang === 'ar' ? 'en' : 'ar';
  return (
    <button className="lang-toggle" lang={next} onClick={() => set('uiLang', next)} aria-label={next === 'ar' ? 'العربية' : 'English'}>
      <Translate size={18} weight="light" aria-hidden="true" />
      {next === 'ar' ? 'العربية' : 'English'}
    </button>
  );
}
