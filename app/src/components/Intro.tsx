import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpenText, GoogleLogo, Sparkle, SunHorizon, UserCircle } from '@phosphor-icons/react';
import { accountAvailable, useAccount, warmAccount } from '../state/account';
import { markIntroViewed, useIntro } from '../state/intro';
import { useDevotional } from '../state/devotional';
import { track } from '../analytics';
import { useTerms } from '../state/terms';
import { useUI } from '../state/ui';
import { Button } from './Button';
import { DownloadActions, DownloadInfo } from './Welcome';
import { useT } from '../i18n';
import { LangToggle } from './LangToggle';

type Step = 'signin' | 'offline' | 'study' | 'devotional' | 'download';

const ICONS = { signin: UserCircle, offline: BookOpenText, study: Sparkle, devotional: SunHorizon } as const;

/** Acceptance box for the terms of use and privacy policy, with links to both texts. */
function TermsCheck() {
  const t = useT();
  const checked = useTerms((s) => s.checked);
  const setChecked = useTerms((s) => s.setChecked);
  const [before, rest] = t('acceptTerms').split('{terms}');
  const [between, after] = rest.split('{privacy}');
  return (
    <label className="terms-check">
      <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      <span>
        {before}<a href="#/terms">{t('termsLink')}</a>{between}<a href="#/privacy">{t('privacyLink')}</a>{after}
      </span>
    </label>
  );
}

/** First launch, after the splash: sign in with Google (or skip) and three intro screens. */
export function Intro() {
  const t = useT();
  const notify = useUI((s) => s.notify);
  const finish = useIntro((s) => s.finish);
  const user = useAccount((s) => s.user);
  const busy = useAccount((s) => s.busy);
  // Users already signed in don't see the sign-in step: once login completes, the same index points to the next slide.
  const steps = useMemo<Step[]>(() => [...(accountAvailable() && !user ? (['signin'] as const) : []), 'offline', 'study', 'download'], [user]);
  const [i, setI] = useState(0);
  const step = steps[i];
  useEffect(() => {
    markIntroViewed();
    track('intro_step', { step });
  }, [step]);
  const Icon = step === 'download' ? null : ICONS[step];
  

  useEffect(() => {
    if (accountAvailable()) void warmAccount().catch(() => undefined);
  }, []);

  const accepted = useTerms((s) => s.checked);
  // Without accepting the terms there is no way to sign in or move on.
  const next = () => {
    if (step === 'signin' && !accepted) return;
    setI((n) => Math.min(n + 1, steps.length - 1));
  };
  const prev = () => setI((n) => Math.max(n - 1, 0));

  // Swiping or using the arrows moves forward and back between slides.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    touch.current = null;
    if (!from) return;
    const dx = e.changedTouches[0].clientX - from.x;
    const dy = e.changedTouches[0].clientY - from.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next();
    else prev();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next();
      else if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) prev();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [steps.length, step, accepted]);

  const signIn = async () => {
    useTerms.getState().accept();
    const result = await useAccount.getState().signIn();
    if (result === 'restored') notify(t('accountRestored'));
    else if (result === 'offline') notify(t('signInOffline'));
    else if (result === 'failed') notify(t('signInFailed'));
  };

  const title = { signin: 'signInTitle', offline: 'introOfflineTitle', study: 'introStudyTitle', devotional: 'introDevotionalTitle' } as const;
  const body = { signin: 'signInBody', offline: 'introOfflineBody', study: 'introStudyBody', devotional: 'introDevotionalBody' } as const;

  // Choosing another version opens the Library over the reader, once the intro is gone.
  const chooseOther = () => {
    finish();
    useUI.getState().open('library');
  };

  return (
    <main className="intro" aria-label={t('appName')} onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={onTouchEnd}>
      <LangToggle />
      <div className="intro-body" key={step}>
        {step === 'download' || !Icon ? (
          <DownloadInfo iconSize={56} />
        ) : (
          <>
            <Icon size={56} weight="light" aria-hidden="true" />
            <h1>{t(title[step])}</h1>
            <p>{t(body[step])}</p>
          </>
        )}
      </div>
      <div className="intro-foot">
        <div className="intro-dots" role="img" aria-label={t('introStep', { n: i + 1, total: steps.length })}>
          {steps.map((s, k) => (
            <i key={s} className={k === i ? 'on' : undefined} />
          ))}
        </div>
        {step === 'download' ? (
          <DownloadActions trailing onChooseOther={chooseOther} />
        ) : step === 'devotional' ? (
          <>
            <Button variant="primary" block onClick={() => { useDevotional.getState().enable('intro'); next(); }}>{t('introDevotionalEnable')}</Button>
            <Button block onClick={() => { useDevotional.getState().markAsked(); next(); }}>{t('devotionalNotNow')}</Button>
            <p className="intro-hint">{t('introDevotionalHint')}</p>
          </>
        ) : step === 'signin' ? (
          <Button variant="primary" block icon={GoogleLogo} iconSide="right" iconWeight="bold" onClick={signIn} disabled={busy || !accepted}>{t('signIn')}</Button>
        ) : (
          <Button variant="primary" block icon={ArrowRight} iconClass="flip" iconSide="right" iconWeight="bold" onClick={next}>{t('next')}</Button>
        )}
        {step === 'signin' && (
          <>
            <Button block icon={ArrowRight} iconClass="flip" iconSide="right" disabled={!accepted} onClick={() => { useTerms.getState().accept(); next(); }}>{t('skip')}</Button>
            <TermsCheck />
          </>
        )}
      </div>
    </main>
  );
}
