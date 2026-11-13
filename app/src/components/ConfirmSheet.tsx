import { Trash, X, type Icon } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { useT } from '../i18n';
import { Button } from './Button';

interface Props {
  title: string;
  text: string;
  /** Label of the confirm button. */
  confirmLabel: string;
  /** Icon of the title and the confirm button. */
  icon?: Icon;
  /** Disables the buttons while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for an irreversible action: text, Cancel and the main action. It is the only pattern for deleting in the app. */
export function ConfirmSheet({ title, text, confirmLabel, icon: Icon = Trash, busy, onConfirm, onCancel }: Props) {
  const t = useT();
  return (
    <Sheet title={title} icon={Icon} onClose={onCancel}>
      <p className="confirm-text">{text}</p>
      <div className="actions">
        <span className="grow" />
        <Button icon={X} onClick={onCancel} disabled={busy}>{t('cancel')}</Button>
        <Button variant="primary" icon={Icon} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
