import { CalendarCheck } from '@phosphor-icons/react';
import { useBookName } from '../hooks';
import { useT } from '../i18n';
import { usePlanStatus } from '../state/progress';
import { parseKey } from '../progress/plan';
import { go } from '../router';

/** Slim reminder of today's reading above the chapter, shown only when a plan exists and today has work left. */
export function PlanStrip() {
  const t = useT();
  const bookName = useBookName();
  const { plan, st } = usePlanStatus();
  if (!plan || !st || st.today.length === 0 || st.todayDone >= st.today.length) return null;
  const first = parseKey(st.today[0]);
  const last = parseKey(st.today[st.today.length - 1]);
  const range = st.today.length === 1 || (first.book === last.book && first.chapter === last.chapter)
    ? `${bookName(first.book)} ${first.chapter}`
    : first.book === last.book ? `${bookName(first.book)} ${first.chapter}–${last.chapter}` : `${bookName(first.book)} ${first.chapter} → ${bookName(last.book)} ${last.chapter}`;
  return (
    <button className="plan-strip" onClick={() => go('/plan')}>
      <CalendarCheck size={20} weight="light" aria-hidden="true" />
      <span><b>{t('planStripToday')}</b> · {range}</span>
      <i>{st.todayDone}/{st.today.length}</i>
    </button>
  );
}
