import { useState } from 'react';
import { ChatCircleText, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { useUI } from '../state/ui';
import { useStudy } from '../state/study';
import { useBookName } from '../hooks';
import { refLabel } from '../ref';
import { FEEDBACK_KINDS, feedbackUrl, type FeedbackKind } from '../feedback';
import { useT } from '../i18n';
import { Button, ButtonLink } from './Button';

const MAX = 2000;

export function FeedbackSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const { book, chapter } = useStudy();
  const bookName = useBookName();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');

  const empty = !text.trim();

  return (
    <Sheet title={t('feedback')} icon={ChatCircleText} onClose={close}>
      <select className="select" value={kind} aria-label={t('feedbackType')} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
        {FEEDBACK_KINDS.map((k) => <option key={k} value={k}>{t(`feedback_${k}`)}</option>)}
      </select>
      <textarea
        className="note-input mt-12"
        value={text}
        maxLength={MAX}
        autoFocus
        placeholder={t(`feedbackHint_${kind}`)}
        aria-label={t('feedbackMessage')}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="actions">
        <span className="grow" />
        <Button icon={X} onClick={close}>{t('cancel')}</Button>
        <ButtonLink
          variant="primary"
          icon={PaperPlaneTilt}
          href={empty ? undefined : feedbackUrl(kind, text, refLabel(bookName(book), chapter))}
          aria-disabled={empty}
          style={empty ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
          onClick={() => setTimeout(close, 0)}
        >
          {t('feedbackSend')}
        </ButtonLink>
      </div>
      <p className="hint">{t('feedbackNote')}</p>
    </Sheet>
  );
}
