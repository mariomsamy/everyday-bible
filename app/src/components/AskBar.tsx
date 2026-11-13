import { Sparkle } from '@phosphor-icons/react';
import { PromptField } from './PromptField';
import { Sheet } from './Sheet';
import { type AiPassage } from '../ai';
import { useAsk } from '../state/ask';
import { useStudy } from '../state/study';
import { useSettings } from '../state/settings';
import { useUI } from '../state/ui';
import { abbrOf } from '../data/catalog';
import { useBookName, useChapter } from '../hooks';
import { refLabel } from '../ref';
import { loadBook } from '../data/bible';
import { xrefsFor } from '../data/xrefs';
import { trackFeature } from '../analytics';
import { useT } from '../i18n';
import { useScrollFade } from '../useScrollFade';

const MAX_TEXT = 3000;
/** Cross-references sent to the AI as a starting point, and how much of each text. */
const MAX_RELATED = 12;
const RELATED_SNIPPET = 160;

/** Question bar at the bottom of the reader. The context is the selection or, with no selection, the whole chapter. */
export function AskBar() {
  const t = useT();
  const { book, chapter, selection } = useStudy();
  const versionId = useSettings((s) => s.versionId);
  const uiLang = useSettings((s) => s.uiLang);
  const open = useUI((s) => s.open);
  const closeBar = useAsk((s) => s.closeBar);
  const bookName = useBookName();
  const text = useChapter(book, chapter);
  const chips = useScrollFade<HTMLDivElement>();

  const verses = text.status === 'ready' ? text.verses : [];
  const numbers = selection.length ? selection : verses.map((_, i) => i + 1);
  const ref = selection.length
    ? refLabel(bookName(book), chapter, selection[0], selection[selection.length - 1])
    : refLabel(bookName(book), chapter);

  const ask = (q: string, related?: string[]) => {
    const asked = q.trim();
    if (!asked || !verses.length) return;
    const passage: AiPassage = {
      ref,
      version: abbrOf(versionId),
      text: numbers.map((n) => `${n} ${verses[n - 1]}`).join('\n').slice(0, MAX_TEXT),
      wide: selection.length
        ? { ref: refLabel(bookName(book), chapter), text: verses.map((v, i) => `${i + 1} ${v}`).join('\n').slice(0, MAX_TEXT) }
        : undefined,
      related: related?.length ? related : undefined,
    };
    useAsk.getState().start(asked, passage, uiLang);
    open('ask');
  };

  /** Starts from the cross-references of the selection, which are only a lead: the AI may go further. */
  const relate = async () => {
    if (!verses.length) return;
    trackFeature('ask_relate');
    let related: string[] = [];
    try {
      const found = (await xrefsFor(book, chapter, numbers)).slice(0, MAX_RELATED);
      related = await Promise.all(
        found.map(async (x) => {
          const label = refLabel(bookName(x.book), x.chapter, x.first, x.last);
          const body = (await loadBook(versionId, x.book))?.chapters[x.chapter - 1]?.slice(x.first - 1, x.last).join(' ') ?? '';
          return body ? `${label}: ${body.slice(0, RELATED_SNIPPET)}` : label;
        }),
      );
    } catch {
      // Without the references file the AI still relates the passage on its own.
    }
    ask(t('askRelateQ'), related);
  };

  return (
    <Sheet modeless compact title={t('askTitle')} icon={Sparkle} onClose={closeBar}>
      <div className="ask-body">
        <div className="ask-chips" ref={chips}>
          <button className="chip-btn" onClick={() => ask(t('askSummaryQ'))}>{t('askSummary')}</button>
          <button className="chip-btn" onClick={() => ask(t('askExplainQ'))}>{t('askExplain')}</button>
          <button className="chip-btn" onClick={relate}>{t('askRelate')}</button>
          <button className="chip-btn" onClick={() => ask(t('askContextQ'))}>{t('askContext')}</button>
        </div>
        <PromptField
          context={ref}
          onClearContext={selection.length > 0 ? () => useStudy.getState().clearSelection() : undefined}
          placeholder={t('askPlaceholder')}
          disabled={!verses.length}
          onSubmit={ask}
        />
      </div>
    </Sheet>
  );
}
