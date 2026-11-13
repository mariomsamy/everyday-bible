import { useMemo } from 'react';
import { Flame } from '@phosphor-icons/react';
import { BOOKS } from '../data/books';
import { useBookName } from '../hooks';
import { useT } from '../i18n';
import { TOTAL_CHAPTERS, useProgress, useToday } from '../state/progress';
import { useSettings } from '../state/settings';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { addDays, key, streak } from '../progress/plan';
import { fmtNum } from '../progress/format';
import { go } from '../router';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';

export function Progress() {
  const t = useT();
  const lang = useSettings((s) => s.uiLang);
  const read = useProgress((s) => s.read);
  const today = useToday();
  const bookName = useBookName();
  const notify = useUI((s) => s.notify);

  const dates = useMemo(() => Object.values(read), [read]);
  const count = dates.length;
  const days30 = useMemo(() => {
    const per = new Map<string, number>();
    for (const d of dates) per.set(d, (per.get(d) ?? 0) + 1);
    return Array.from({ length: 30 }, (_, i) => { const d = addDays(today, i - 29); return { d, n: per.get(d) ?? 0 }; });
  }, [dates, today]);
  const week = days30.slice(-7).reduce((s, x) => s + x.n, 0);
  const max = Math.max(1, ...days30.map((x) => x.n));
  const fire = streak(dates, today);

  const openBook = (id: string, chapters: number) => {
    const next = Array.from({ length: chapters }, (_, i) => i + 1).find((c) => !read[key(id, c)]) ?? 1;
    useStudy.getState().goTo(id, next);
    go('/');
  };

  const groups = [
    { title: t('testamentOld'), books: BOOKS.filter((b) => b.testament === 'AT') },
    { title: t('testamentNew'), books: BOOKS.filter((b) => b.testament === 'NT') },
  ];

  return (
    <div className="screen">
      <ScreenHeader title={t('progressTitle')} />
      <div className="screen-body">
        <Section>
          <div className="stat-grid">
            <div className="stat"><b>{fmtNum((count / TOTAL_CHAPTERS) * 100, lang, 1)}%</b><span>{t('progressOverall', { read: fmtNum(count, lang), total: fmtNum(TOTAL_CHAPTERS, lang) })}</span></div>
            <div className="stat"><b><Flame size={20} weight="fill" aria-hidden="true" /> {fmtNum(fire, lang)}</b><span>{t('progressStreak')}</span></div>
            <div className="stat"><b>{fmtNum(week, lang)}</b><span>{t('progressThisWeek')}</span></div>
          </div>
          <ProgressBar value={count / TOTAL_CHAPTERS} />
          {count === 0 && <p className="hint">{t('progressNone')}</p>}
        </Section>

        <Section title={t('progressLast30')}>
          <div className="bars" role="img" aria-label={t('progressLast30')}>
            {days30.map(({ d, n }) => <i key={d} title={`${d}: ${n}`} style={{ height: `${(n / max) * 100}%` }} data-on={n > 0} />)}
          </div>
        </Section>

        {groups.map((g) => {
          const books = g.books;
          if (books.length === 0) return null;
          return (
            <Section key={g.title} title={g.title}>
              <ul className="book-prog">
                {books.map((b) => {
                  const n = Array.from({ length: b.chapters }, (_, i) => read[key(b.id, i + 1)]).filter(Boolean).length;
                  return (
                    <li key={b.id}>
                      <button onClick={() => openBook(b.id, b.chapters)} aria-label={`${bookName(b.id)} ${n}/${b.chapters}`}>
                        <span className="nm">{bookName(b.id)}</span>
                        <span className="ct">{n}/{b.chapters}</span>
                        <span className="bar"><i style={{ width: `${(n / b.chapters) * 100}%` }} data-done={n === b.chapters} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          );
        })}

        <Section>
          <Button block onClick={() => { if (confirm(t('progressResetConfirm'))) { useProgress.getState().reset(); notify(t('progressResetDone')); } }}>{t('progressReset')}</Button>
          <p className="hint">{t('progressResetHint')}</p>
        </Section>
      </div>
    </div>
  );
}
