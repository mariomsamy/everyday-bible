import { useT } from '../i18n';

/** Download progress bar. `value` goes from 0 to 1. */
export function ProgressBar({ value }: { value: number }) {
  const t = useT();
  const pct = Math.round(value * 100);
  return (
    <div className="progress" role="progressbar" aria-label={t('downloading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i style={{ width: `${value * 100}%` }} />
    </div>
  );
}
