import { CheckCircle, Circle } from '@phosphor-icons/react';
import { Button } from './Button';
import { useProgress, usePlanStatus } from '../state/progress';
import { useUI } from '../state/ui';
import { useT } from '../i18n';
import { isoDate, key, status } from '../progress/plan';

/** "Mark as read" at the end of a chapter. Tapping again undoes it. */
export function ReadMark({ book, chapter }: { book: string; chapter: number }) {
  const t = useT();
  const done = useProgress((s) => !!s.read[key(book, chapter)]);
  const notify = useUI((s) => s.notify);
  const { plan } = usePlanStatus();
  const toggle = () => {
    const p = useProgress.getState();
    if (done) return p.unmark(book, chapter);
    p.mark(book, chapter);
    // A finished day deserves a word. Computed after the mark so it includes this chapter.
    const st = usePlanStatusNow();
    notify(plan && st && st.today.length > 0 && st.todayDone === st.today.length ? t('todayDone') : t('chapterMarked'));
  };
  return (
    <Button block variant={done ? 'secondary' : 'primary'} icon={done ? CheckCircle : Circle} iconWeight={done ? 'fill' : 'regular'} aria-pressed={done} onClick={toggle}>
      {done ? t('markedRead') : t('markRead')}
    </Button>
  );
}

function usePlanStatusNow() {
  const { plan, read } = useProgress.getState();
  return plan ? status(plan, read, isoDate()) : null;
}
