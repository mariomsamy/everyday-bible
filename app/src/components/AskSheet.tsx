import { useEffect, useRef } from 'react';
import { ArrowClockwise, Copy, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { PromptField } from './PromptField';
import { Sheet } from './Sheet';
import { useAsk } from '../state/ask';
import { useSettings } from '../state/settings';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { useT } from '../i18n';
import { Button } from './Button';
import { copyText } from '../share';
import { AiText } from './AiText';

export function AskSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const notify = useUI((s) => s.notify);
  const uiLang = useSettings((s) => s.uiLang);
  const { passage, messages, status, error, followUp, retry, stop, widen } = useAsk();
  const end = useRef<HTMLDivElement>(null);
  const asked = useRef<HTMLDivElement>(null);
  const busy = status === 'loading' || status === 'streaming';
  const answer = messages[messages.length - 1];

  useEffect(() => () => stop(), [stop]);
  // On asking, the question moves to the top and the answer grows below it: readers start at the beginning, without scrolling up.
  // The text arrives gradually, so the scroll repeats until the question reaches the top, and then stops moving.
  const length = answer?.content.length;
  useEffect(() => {
    const q = asked.current;
    if (status === 'error') end.current?.scrollIntoView({ block: 'end' });
    else if (q && busy) {
      const top = q.getBoundingClientRect().top - (q.closest('.sheet-body')?.getBoundingClientRect().top ?? 0);
      if (top > 60) q.scrollIntoView({ block: 'start' });
    }
  }, [status, busy, messages.length, length]);

  const copy = async () => {
    const ok = await copyText(`${passage?.topic ? '' : passage?.ref ?? ''}\n\n${answer.content}`.trim());
    notify(t(ok ? 'copied' : 'copyFailed'));
  };

  const errorKey = ({ offline: 'askOffline', limit: 'askRateLimited', daily: 'askDaily', busy: 'askBusy', failed: 'askError' } as const)[error ?? 'failed'];

  return (
    <Sheet
      title={t('askTitle')}
      icon={Sparkle}
      onClose={close}
      tall
      compact
      footer={
        <div className="ask-foot">
          {status !== 'error' && (
            <PromptField
              context={passage?.topic ? undefined : passage?.ref ?? ''}
              onClearContext={passage?.wide ? () => { widen(); useStudy.getState().clearSelection(); } : undefined}
              placeholder={t('askFollowUp')}
              disabled={busy}
              onSubmit={(q) => followUp(q, uiLang)}
            />
          )}
        </div>
      }
      trailing={
        answer?.role === 'assistant' && answer.content && !busy ? (
          <button className="icon-btn" onClick={copy} aria-label={t('copy')}><Copy size={22} weight="light" /></button>
        ) : undefined
      }
    >
      <div className="ask-chat">
        {passage && <div className="ask-ref">{passage.topic ? t('askTopicRef', { abbr: passage.version }) : `${passage.ref} · ${passage.version}`}</div>}
        {messages.map((m, i) => (
          <div key={i} ref={i === messages.length - 2 ? asked : undefined} className={`ask-msg ${m.role}`}>
            {m.content ? (m.role === 'assistant' ? <AiText text={m.content} /> : m.content) : busy && i === messages.length - 1 ? <span className="ask-dots" role="status" aria-label={t('askThinking')}><i /><i /><i /></span> : null}
          </div>
        ))}
        {answer?.role === 'assistant' && answer.content && !busy && status !== 'error' && (
          <p className="ask-note">
            <WarningCircle size={14} weight="regular" aria-hidden="true" />
            {t('askDisclaimer')}
          </p>
        )}
        {status === 'error' && (
          <div className="ask-error" role="alert">
            <p>{t(errorKey)}</p>
            {error !== 'daily' && <Button size="sm" icon={ArrowClockwise} onClick={() => retry(uiLang)}>{t('askRetry')}</Button>}
          </div>
        )}
        <div ref={end} />
      </div>
    </Sheet>
  );
}

/** If the answer screen breaks, the failure shows up as a message from the AI itself, without technical details. */
export function AskCrash({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  const close = useUI((s) => s.close);
  const uiLang = useSettings((s) => s.uiLang);
  const { passage, messages } = useAsk.getState();
  const asked = messages.find((m) => m.role === 'user');

  const ask = (q: string) => {
    if (!passage) return;
    useAsk.getState().start(q, passage, uiLang);
    onRetry();
  };

  return (
    <Sheet
      title={t('askTitle')}
      icon={Sparkle}
      onClose={close}
      compact
      footer={
        passage && (
          <div className="ask-foot">
            <PromptField context={passage.ref} placeholder={t('askFollowUp')} onSubmit={ask} />
          </div>
        )
      }
    >
      <div className="ask-chat">
        {asked && <div className="ask-msg user">{asked.content}</div>}
        <div className="ask-msg assistant" role="alert">{t('askCrash')}</div>
        {asked && (
          <Button size="sm" icon={ArrowClockwise} onClick={() => ask(asked.content)}>{t('askRetry')}</Button>
        )}
      </div>
    </Sheet>
  );
}
