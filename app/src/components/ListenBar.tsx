import { Gear, Pause, Play, X } from '@phosphor-icons/react';
import { pause, play, RATES, stop, useListen } from '../listen';
import { useUI } from '../state/ui';
import { useStudy } from '../state/study';
import { useBookName } from '../hooks';
import { refLabel } from '../ref';
import { useT } from '../i18n';
import { Button } from './Button';

/** Floating controls for read-aloud playback. */
export function ListenBar() {
  const t = useT();
  const open = useUI((s) => s.open);
  const { status, verse, rate, setRate } = useListen();
  const { book, chapter } = useStudy();
  const bookName = useBookName();
  const playing = status === 'playing';
  const nextRate = () => setRate(RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length]);

  return (
    <div className="listen-bar" role="region" aria-label={t('listenTitle')}>
      <button className="icon-btn" onClick={playing ? pause : play} aria-label={playing ? t('listenPause') : t('listenPlay')}>
        {playing ? <Pause size={26} weight="fill" /> : <Play size={26} weight="fill" />}
      </button>
      <span className="grow">{refLabel(bookName(book), chapter, verse ?? undefined)}</span>
      <Button size="sm" onClick={nextRate} aria-label={t('listenSpeed')}>{rate}×</Button>
      <button className="icon-btn" onClick={() => open('listen')} aria-label={t('listenSettings')}><Gear size={22} weight="light" /></button>
      <button className="icon-btn" onClick={stop} aria-label={t('listenStop')}><X size={22} weight="light" /></button>
    </div>
  );
}
