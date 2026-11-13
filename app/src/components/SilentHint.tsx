import { useState } from 'react';
import { SpeakerSlash } from '@phosphor-icons/react';
import { useT } from '../i18n';

/**
 * Silent mode notice on iOS, shown the first time the user asks to listen.
 * The tap closes the notice and starts playback in the same gesture, which iOS requires to unlock audio.
 */
export function SilentHint({ onConfirm, onDone }: { onConfirm: () => void; onDone: () => void }) {
  const t = useT();
  const [leaving, setLeaving] = useState(false);

  const confirm = () => {
    if (leaving) return;
    setLeaving(true);
    onConfirm();
  };

  return (
    <div
      className={`swipe-hint${leaving ? ' leaving' : ''}`}
      role="status"
      onPointerDown={confirm}
      onAnimationEnd={(e) => leaving && e.target === e.currentTarget && onDone()}
    >
      <div className="hint-step">
        <SpeakerSlash size={56} weight="light" aria-hidden="true" />
        <p>{t('listenIosHint')}</p>
      </div>
    </div>
  );
}
