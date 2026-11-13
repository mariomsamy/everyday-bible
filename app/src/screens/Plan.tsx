import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, CalendarCheck, CheckCircle, Circle, Lifebuoy, Trash } from '@phosphor-icons/react';
import { useBookName, useBooks } from '../hooks';
import { useT } from '../i18n';
import { chapterRefs, catchUp, createPlan, usePlanStatus, useProgress } from '../state/progress';
import { useSettings } from '../state/settings';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { addDays, parseKey, projectedFinish, type Scope } from '../progress/plan';
import { fmtDate, fmtNum, minutesFor } from '../progress/format';
import { go } from '../router';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { Row } from '../components/Row';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';

const PRESETS = [30, 60, 90, 180, 365, 730];
const SCOPES: Scope[] = ['all', 'canon', 'ot', 'nt'];
const SCOPE_KEY = { all: 'scopeCanon', canon: 'scopeCanon', ot: 'scopeOt', nt: 'scopeNt' } as const;

export function Plan() {
  const { plan } = usePlanStatus();
  const t = useT();
  return (
    <div className="screen">
      <ScreenHeader title={t('plan')} />
      <div className="screen-body">{plan ? <Active /> : <Create />}</div>
    </div>
  );
}

function durationLabel(t: ReturnType<typeof useT>, n: number) {
  if (n === 365) return t('planYear');
  if (n === 730) return t('planYearsN', { n: 2 });
  if (n >= 60 && n % 30 === 0 && n < 365) return t('planMonthsN', { n: n / 30 });
  return t('planDaysN', { n });
}

function Create() {
  const t = useT();
  const books = useBooks();
  const versionId = useSettings((s) => s.versionId);
  const lang = useSettings((s) => s.uiLang);
  const notify = useUI((s) => s.notify);
  const [scope, setScope] = useState<Scope>('canon');
  const [days, setDays] = useState(365);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [load, setLoad] = useState<{ chapters: number; verses: number } | null>(null);
  const ids = useMemo(() => books.map((b) => b.id), [books]);
  const scopes = SCOPES.filter((s) => s !== 'all');

  useEffect(() => {
    let live = true;
    void chapterRefs(versionId, ids, scope).then((refs) => live && setLoad({ chapters: refs.length, verses: refs.reduce((s, r) => s + r.verses, 0) }));
    return () => { live = false; };
  }, [versionId, ids, scope]);

  const valid = Number.isInteger(days) && days >= 1 && days <= 3650;
  const start = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await createPlan(versionId, ids, scope, days);
    } catch {
      notify(t('planNeedVersion'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title={t('planNoneTitle')}>
        <p className="hint" style={{ paddingTop: 0 }}>{t('planNoneBody')}</p>
      </Section>
      <Section title={t('planScope')}>
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label={t('planScope')}>
          {scopes.map((s) => <option key={s} value={s}>{t(SCOPE_KEY[s])}</option>)}
        </select>
      </Section>
      <Section title={t('planDuration')}>
        <div className="chips" role="group" aria-label={t('planDuration')}>
          {PRESETS.map((n) => (
            <button key={n} className="chip-btn" aria-pressed={!custom && days === n} onClick={() => { setCustom(false); setDays(n); }}>{durationLabel(t, n)}</button>
          ))}
          <button className="chip-btn" aria-pressed={custom} onClick={() => setCustom(true)}>{t('planCustom')}</button>
        </div>
        {custom && (
          <label className="field">
            <span>{t('planCustomDays')}</span>
            <input className="select" type="number" inputMode="numeric" min={1} max={3650} value={Number.isFinite(days) ? days : ''} onChange={(e) => setDays(e.target.value === '' ? NaN : Math.floor(Number(e.target.value)))} />
          </label>
        )}
        {load && valid && (
          <p className="hint">{t('planPreview', { ch: fmtNum(load.chapters / days, lang, load.chapters / days < 10 ? 1 : 0), min: fmtNum(minutesFor(load.verses / days), lang) })}</p>
        )}
      </Section>
      <Button variant="primary" block icon={CalendarCheck} onClick={start} disabled={!valid || busy || !load}>{busy ? t('planCreating') : t('planStart')}</Button>
    </>
  );
}

function Active() {
  const t = useT();
  const { plan, st, today } = usePlanStatus();
  const lang = useSettings((s) => s.uiLang);
  const versionId = useSettings((s) => s.versionId);
  const read = useProgress((s) => s.read);
  const bookName = useBookName();
  const notify = useUI((s) => s.notify);
  const [catchDays, setCatchDays] = useState(30);
  const [confirm, setConfirm] = useState(false);
  if (!plan || !st) return null;

  const open = (k: string) => {
    const { book, chapter } = parseKey(k);
    useStudy.getState().goTo(book, chapter);
    go('/');
  };
  const label = (k: string) => { const { book, chapter } = parseKey(k); return `${bookName(book)} ${chapter}`; };
  const remaining = st.total - st.read;
  const finish = addDays(plan.start, plan.days - 1);
  const proj = projectedFinish(Object.values(read), remaining, today);
  const markToday = () => {
    useProgress.getState().markMany(st.today);
    notify(t('todayDone'));
  };
  const paceText =
    st.pace === 'done' ? t('planFinished')
    : st.pace === 'notStarted' ? t('planNotStarted', { date: fmtDate(plan.start, lang) })
    : st.pace === 'ended' ? t('planEnded', { n: remaining })
    : st.pace === 'behind' ? t('planBehind', { n: -st.diff })
    : st.pace === 'ahead' ? t('planAhead', { n: st.read - plan.ends[st.d] })
    : t('planOnTrack');
  const showCatchUp = st.pace === 'behind' || st.pace === 'ended';

  return (
    <>
      <Section>
        <div className={`plan-card pace-${st.pace}`}>
          <div className="plan-day">{st.d >= 0 && st.d < plan.days ? t('planDayOf', { n: st.d + 1, total: plan.days }) : paceText}</div>
          <ProgressBar value={st.total ? st.read / st.total : 0} />
          <div className="plan-meta">
            <span>{t('progressOverall', { read: st.read, total: st.total })}</span>
            <b>{paceText}</b>
          </div>
        </div>
      </Section>

      {st.pace !== 'done' && st.pace !== 'notStarted' && (
        <Section title={t('planToday')}>
          {st.today.length === 0 ? (
            <p className="hint">{t('planRest')}</p>
          ) : (
            <>
              <div className="group">
                {st.today.map((k) => (
                  <Row key={k} icon={read[k] ? CheckCircle : Circle} title={label(k)} onClick={() => open(k)} className={read[k] ? 'is-read' : undefined} />
                ))}
              </div>
              {st.todayDone < st.today.length && (
                <Button block icon={CheckCircle} onClick={markToday}>{t('planReadToday')}</Button>
              )}
            </>
          )}
        </Section>
      )}

      {showCatchUp && (
        <Section title={t('planCatchUp')}>
          <p className="hint" style={{ paddingTop: 0 }}>{t('planCatchUpHint')}</p>
          <label className="field">
            <span>{t('planCustomDays')}</span>
            <input className="select" type="number" inputMode="numeric" min={1} max={3650} value={Number.isFinite(catchDays) ? catchDays : ''} onChange={(e) => setCatchDays(e.target.value === '' ? NaN : Math.floor(Number(e.target.value)))} />
          </label>
          <Button block icon={Lifebuoy} disabled={!(catchDays >= 1 && catchDays <= 3650)} onClick={() => void catchUp(versionId, catchDays).catch(() => notify(t('planNeedVersion')))}>{t('planCatchUpDo')}</Button>
        </Section>
      )}

      <Section>
        <p className="hint" style={{ paddingTop: 0 }}>{t('planFinishOn', { date: fmtDate(finish, lang) })}</p>
        {proj && st.pace !== 'done' && proj <= addDays(today, 1825) && <p className="hint">{t('planProjected', { date: fmtDate(proj, lang) })}</p>}
        <div className="group">
          <Row icon={BookOpenText} title={t('progress')} onClick={() => go('/progress')} />
          {!confirm ? (
            <Row icon={Trash} danger title={t('planDelete')} sub={t('planDeleteHint')} onClick={() => setConfirm(true)} />
          ) : (
            <Row icon={Trash} danger title={t('planDelete')} sub={t('planDeleteConfirm')} onClick={() => { useProgress.getState().setPlan(null); setConfirm(false); }} />
          )}
        </div>
      </Section>
    </>
  );
}
