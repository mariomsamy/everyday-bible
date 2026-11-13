import { useState } from 'react';
import { BookmarkSimple, Microphone, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { useDictation } from '../useDictation';
import { useT } from '../i18n';

interface Props {
  /** Context reference, shown as a pill. Without it, no pill. */
  context?: string;
  /** With this, the pill gets a × that discards the context. */
  onClearContext?: () => void;
  placeholder: string;
  disabled?: boolean;
  onSubmit: (question: string) => void;
}

/** Question field with the reference as a pill and voice dictation. Same in the prompt and on the answer screen. */
export function PromptField({ context, onClearContext, placeholder, disabled, onSubmit }: Props) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const mic = useDictation(question, setQuestion);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const asked = question.trim();
    if (!asked || disabled) return;
    mic.stop();
    setQuestion('');
    onSubmit(asked);
  };

  return (
    <form className="ask-field" onSubmit={submit}>
      {context && (
        <span className="ask-pill">
          <BookmarkSimple size={15} weight="light" aria-hidden="true" />
          <span>{context}</span>
          {onClearContext && (
            <button type="button" onClick={onClearContext} aria-label={t('askRemoveContext')}>
              <X size={13} weight="bold" />
            </button>
          )}
        </span>
      )}
      <div className="ask-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={600}
          enterKeyHint="send"
          disabled={disabled}
        />
        {mic.supported && (
          <button
            type="button"
            className={`ask-mic${mic.listening ? ' on' : ''}`}
            onClick={mic.toggle}
            aria-pressed={mic.listening}
            aria-label={mic.listening ? t('askMicStop') : t('askMic')}
            disabled={disabled}
          >
            <Microphone size={22} weight="regular" />
          </button>
        )}
        <button type="submit" className="ask-send" disabled={!question.trim() || disabled} aria-label={t('askSend')}>
          <PaperPlaneTilt size={20} weight="fill" />
        </button>
      </div>
    </form>
  );
}
