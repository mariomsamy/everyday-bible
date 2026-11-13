import { useEffect, useRef, useState } from 'react';
import { HandSwipeLeft, HandSwipeRight, HandTap } from '@phosphor-icons/react';
import { useAsk } from '../state/ask';
import { useT } from '../i18n';

const SWIPE_MS = 4400; // two loops of the gesture
const GUARD_MS = 1000; // after each step, quick taps don't skip the next one

/**
 * First-launch hints. First shows the paging gesture; then, with AI enabled, points to the
 * floating button and waits for a tap on it. Each step fades in and out; tapping outside or opening the prompt ends it.
 */
export function SwipeHint({ onDone, withAi }: { onDone: () => void; withAi: boolean }) {
  const t = useT();
  const [step, setStep] = useState<'swipe' | 'ai'>('swipe');
  const [leaving, setLeaving] = useState(false);
  const askOpen = useAsk((s) => s.bar);

  const shownAt = useRef(Date.now());

  const next = (auto = false) => {
    if (!auto && Date.now() - shownAt.current < GUARD_MS) return;
    if (withAi && step === 'swipe') {
      shownAt.current = Date.now();
      setStep('ai');
    } else {
      setLeaving(true);
    }
  };

  useEffect(() => {
    if (step !== 'swipe') return;
    const id = setTimeout(() => next(true), SWIPE_MS);
    return () => clearTimeout(id);
  });

  useEffect(() => {
    const onKey = () => next();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (askOpen) setLeaving(true);
  }, [askOpen]);

  return (
    <div
      className={`swipe-hint${step === 'ai' ? ' ai' : ''}${leaving ? ' leaving' : ''}`}
      role="status"
      onPointerDown={() => next()}
      onAnimationEnd={(e) => leaving && e.target === e.currentTarget && onDone()}
    >
      {step === 'swipe' ? (
        <div className="hint-step" key="swipe">
          {t.lang === 'ar' ? <HandSwipeRight className="swipe-icon" size={56} weight="light" aria-hidden="true" /> : <HandSwipeLeft className="swipe-icon" size={56} weight="light" aria-hidden="true" />}
          <p>{t('hintSwipe')}</p>
        </div>
      ) : (
        <div className="hint-step hint-ai" key="ai">
          <HandTap className="tap-icon" size={48} weight="light" aria-hidden="true" />
          <p>{t('hintAsk')}</p>
        </div>
      )}
    </div>
  );
}
