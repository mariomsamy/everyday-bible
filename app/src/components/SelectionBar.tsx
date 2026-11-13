import { BookOpenText, Copy, LinkSimple, Note, ShareNetwork, Sparkle, TextColumns } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { vkey, useStudy, type HlColor } from '../state/study';
import { useUI } from '../state/ui';
import { abbrOf } from '../data/catalog';
import { useBookName, useChapter } from '../hooks';
import { useSettings } from '../state/settings';
import { refLabel } from '../ref';
import { aiEnabled } from '../ai';
import { trackFeature } from '../analytics';
import { useAsk } from '../state/ask';
import { useT } from '../i18n';
import { copyText } from '../share';
import { ColorSwatches } from './ColorSwatches';
import { SheetAction } from './SheetAction';

/** Actions for the selected verses. It is a bottom sheet with no dimmed backdrop, so verses stay tappable. */
export function SelectionBar() {
  const t = useT();
  const { book, chapter, selection, highlights, paint, clearSelection } = useStudy();
  const open = useUI((s) => s.open);
  const notify = useUI((s) => s.notify);
  const versionId = useSettings((s) => s.versionId);
  const bookName = useBookName();
  const text = useChapter(book, chapter);
  const verses = text.status === 'ready' ? text.verses : [];
  const texts = Object.fromEntries(selection.map((v) => [v, verses[v - 1]]));
  const active = (c: HlColor) => selection.every((v) => highlights[vkey(book, chapter, v)]?.color === c);

  const citation = () => {
    const first = selection[0];
    const last = selection[selection.length - 1];
    const body = selection.map((v) => verses[v - 1]).join('\n');
    const ref = `${refLabel(bookName(book), chapter, first, last)} (${abbrOf(versionId)})`;
    return `${body}
${ref}`;
  };

  const copy = async () => {
    const ok = await copyText(citation());
    if (ok) trackFeature('copy');
    notify(t(ok ? 'copied' : 'copyFailed'));
  };

  const share = () => open('share');

  return (
    <Sheet
      modeless
      icon={BookOpenText}
      title={refLabel(bookName(book), chapter, selection[0], selection[selection.length - 1])}
      onClose={clearSelection}
    >
      <ColorSwatches label={t('highlightColor')} pressed={(c) => c !== null && active(c)} onPick={(c) => {
          paint(c, texts);
          // Picking a color finishes the action: the sheet closes and the highlight shows.
          clearSelection();
        }} />
      <div className={`sheet-actions${aiEnabled ? '' : ' five'}`}>
        <SheetAction icon={Note} onClick={() => open('note')}>{t('note')}</SheetAction>
        {aiEnabled && <SheetAction icon={Sparkle} onClick={() => useAsk.getState().openBar()}>{t('askAction')}</SheetAction>}
        <SheetAction icon={TextColumns} onClick={() => open('compare')}>{t('compare')}</SheetAction>
        <SheetAction icon={LinkSimple} onClick={() => open('xrefs')}>{t('xrefs')}</SheetAction>
        <SheetAction icon={Copy} onClick={copy}>{t('copy')}</SheetAction>
        <SheetAction icon={ShareNetwork} onClick={share}>{t('share')}</SheetAction>
      </div>
    </Sheet>
  );
}
