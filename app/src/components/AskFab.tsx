import { Sparkle } from '@phosphor-icons/react';
import { useAsk } from '../state/ask';
import { useT } from '../i18n';

/** Floating button that opens the AI prompt. Comes back when the sheet closes. */
export function AskFab() {
  const t = useT();
  return (
    <button className="ask-fab" onClick={() => useAsk.getState().openBar()} aria-label={t('ask')}>
      <Sparkle size={26} weight="regular" />
    </button>
  );
}
