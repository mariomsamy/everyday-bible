import { ArrowLeft } from '@phosphor-icons/react';
import { back } from '../router';
import { useT } from '../i18n';

export function ScreenHeader({ title }: { title: string }) {
  const t = useT();
  return (
    <header className="screen-head">
      <button className="icon-btn" onClick={back} aria-label={t('back')}>
        <ArrowLeft className="flip" size={24} weight="light" />
      </button>
      <h1>{title}</h1>
    </header>
  );
}
