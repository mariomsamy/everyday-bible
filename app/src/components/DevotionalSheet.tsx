import { useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, CaretRight, CloudArrowDown, Copy, ShareNetwork, SunHorizon } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { PromptField } from './PromptField';
import { ProgressBar } from './ProgressBar';
import { Button } from './Button';
import { useT } from '../i18n';
import { useUI } from '../state/ui';
import { useSettings } from '../state/settings';
import { useStudy } from '../state/study';
import { useAsk } from '../state/ask';
import { useDevotional } from '../state/devotional';
import { packLang, dateOfDayId, dayId, todayFor } from '../data/devotional';
import { loadBook } from '../data/bible';
import { abbrOf } from '../data/catalog';
import { useBookName } from '../hooks';
import { refLabel } from '../ref';
import { copyText, shareOrCopy } from '../share';
import { devotionalUrl } from '../link';
import { track } from '../analytics';
import { go } from '../router';

type Verse = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; texts: string[] };

/** The verse of the day, in the version being read, and a short devotional from the language pack. */
export function DevotionalSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const open = useUI((s) => s.open);
  const notify = useUI((s) => s.notify);
  const uiLang = useSettings((s) => s.uiLang);
  const versionId = useSettings((s) => s.versionId);
  const enabled = useSettings((s) => s.devotional);
  const { status, progress, pack, asked, load, enable, markAsked } = useDevotional();
  const bookName = useBookName();
  // A share link opens the devotional of the day it carries, in this year. Without one, it is today's.
  const day = useMemo(() => {
    const linked = useDevotional.getState().day;
    return (linked && dateOfDayId(linked)) || new Date();
  }, []);
  useEffect(() => {
    track('devotional_open', { source: useDevotional.getState().source });
    return () => useDevotional.setState({ day: null, source: 'menu' });
  }, []);
  const today = useMemo(() => todayFor(day), [day]);
  const { ref } = today;
  const [verse, setVerse] = useState<Verse>({ status: 'loading' });

  useEffect(() => {
    void load();
  }, [uiLang, load]);

  useEffect(() => {
    let live = true;
    setVerse({ status: 'loading' });
    void loadBook(versionId, ref.book).then((book) => {
      if (!live) return;
      const texts = book?.chapters[ref.chapter - 1]?.slice(ref.from - 1, ref.to ?? ref.from);
      setVerse(texts?.length ? { status: 'ready', texts } : { status: 'missing' });
    });
    return () => {
      live = false;
    };
  }, [versionId, ref]);

  const label = refLabel(bookName(ref.book), ref.chapter, ref.from, ref.to);
  const verseText = verse.status === 'ready' ? verse.texts.join(' ') : '';
  const devotional = status === 'ready' ? (pack?.moveable[today.key as keyof typeof pack.moveable] ?? pack?.days[today.key]) : undefined;
  const names = useMemo(() => new Intl.DisplayNames([uiLang], { type: 'language' }), [uiLang]);
  const date = new Intl.DateTimeFormat(uiLang, { day: 'numeric', month: 'long' }).format(day);

  // Chat-style markup (*bold*, _italic_, > quote) that WhatsApp and Telegram render.
  const text = () =>
    devotional
      ? [
          `*${devotional.title}*\n${date}`,
          `> ${verseText ? `_${verseText}_ — ` : ''}*${label}*`,
          ...devotional.paragraphs,
          `> *${t('devotionalToday')}:* ${devotional.today}`,
          `> *${t('devotionalPrayer')}:* ${devotional.prayer}`,
          devotionalUrl(dayId(day)),
        ].join('\n\n')
      : '';

  const copy = async () => {
    const ok = await copyText(text());
    if (ok) track('devotional_copy');
    notify(t(ok ? 'copied' : 'copyFailed'));
  };
  const share = async () => {
    const result = await shareOrCopy({ text: text() });
    if (result === 'shared' || result === 'copied') track('devotional_share', { result });
    if (result === 'copied') notify(t('copied'));
    else if (result === 'failed') notify(t('copyFailed'));
  };

  const readChapter = () => {
    // Scroll first: the verse focus triggered by goTo scrolls to the verse and must not be undone.
    track('devotional_read');
    scrollTo(0, 0);
    useStudy.getState().goTo(ref.book, ref.chapter, ref.from, ref.to);
    close();
    go('/');
  };

  const ask = (question: string) => {
    if (verse.status !== 'ready') return;
    track('devotional_ask');
    const passage = { ref: label, version: abbrOf(versionId), text: verse.texts.map((v, i) => `${ref.from + i} ${v}`).join('\n') };
    useAsk.getState().start(question, passage, uiLang);
    open('ask');
  };

  const pct = Math.round(progress * 100);

  return (
    <Sheet
      title={t('devotional')}
      icon={SunHorizon}
      onClose={close}
      tall
      compact
      trailing={
        devotional ? (
          <>
            <button className="icon-btn" onClick={share} aria-label={t('share')}><ShareNetwork size={22} weight="light" /></button>
            <button className="icon-btn" onClick={copy} aria-label={t('copy')}><Copy size={22} weight="light" /></button>
          </>
        ) : undefined
      }
      footer={
        <div className="ask-foot">
          <PromptField context={label} placeholder={t('devotionalAsk')} disabled={verse.status !== 'ready'} onSubmit={ask} />
        </div>
      }
    >
      <div className="dev">
        <div className="dev-date">{date}</div>
        {devotional && <h2 className="dev-title">{devotional.title}</h2>}
        <blockquote className="dev-verse">
          <button type="button" className="dev-verse-btn" title={t('devotionalRead')} disabled={verse.status !== 'ready'} onClick={readChapter}>
            {verse.status === 'ready' && <span className="q">{verseText}</span>}
            {verse.status === 'missing' && <span className="q">{t('devotionalMissing')}</span>}
            <cite>{label} · {abbrOf(versionId)}<CaretRight className="flip" size={12} weight="bold" aria-hidden="true" /></cite>
          </button>
        </blockquote>

        {status === 'ready' && devotional ? (
          <>
            <div className="dev-body">{devotional.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
            <div className="dev-box"><h3>{t('devotionalToday')}</h3><p>{devotional.today}</p></div>
            <div className="dev-prayer"><h3>{t('devotionalPrayer')}</h3><p>{devotional.prayer}</p></div>
            {!asked && !enabled && (
              <div className="dev-invite" role="group" aria-label={t('devotionalInviteTitle')}>
                <b>{t('devotionalInviteTitle')}</b>
                <p>{t('devotionalInviteBody')}</p>
                <div className="dev-invite-btns">
                  <Button variant="primary" size="sm" onClick={() => enable('invite')}>{t('devotionalEnable')}</Button>
                  <Button size="sm" onClick={markAsked}>{t('devotionalNotNow')}</Button>
                </div>
              </div>
            )}
          </>
        ) : status === 'error' || status === 'offline' ? (
          <div className="dev-load" role="alert">
            <p>{t(status === 'offline' ? 'offlineShort' : 'downloadError')}</p>
            <Button size="sm" icon={ArrowClockwise} onClick={() => void load()}>{t('askRetry')}</Button>
          </div>
        ) : status === 'loading' ? (
          <div className="dev-load" role="status">
            <CloudArrowDown size={32} weight="light" aria-hidden="true" />
            <ProgressBar value={progress} />
            <p className="lbl">{t('downloadingBtn', { pct })}</p>
            <p>{t('devotionalPack', { lang: names.of(packLang(uiLang)) ?? packLang(uiLang) })}</p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
