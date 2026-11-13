import { useState } from 'react';
import { Check, Note, Trash, X } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { useUI } from '../state/ui';
import { useStudy, vkey, type HlColor } from '../state/study';
import { useBookName, useChapter } from '../hooks';
import { refLabel } from '../ref';
import { useT } from '../i18n';
import { Button, IconButton } from './Button';
import { ColorSwatches } from './ColorSwatches';

const MAX = 500;

/** Passage to edit outside the reader, for example in My study. Without it, the current selection applies. */
export interface NoteTarget {
  book: string;
  chapter: number;
  v1: number;
  v2: number;
  excerpt: string;
}

/** Highlight color, note text and deletion for the same passage, in a single sheet. */
export function NoteSheet({ target, onClose }: { target?: NoteTarget; onClose?: () => void }) {
  const t = useT();
  const closeSheet = useUI((s) => s.close);
  const notify = useUI((s) => s.notify);
  const { book: curBook, chapter: curChapter, selection, notes, highlights, saveNote, deleteNote, setColor, clearSelection } = useStudy();
  const book = target?.book ?? curBook;
  const chapter = target?.chapter ?? curChapter;
  const first = target?.v1 ?? selection[0];
  const last = target?.v2 ?? selection[selection.length - 1];
  const existing = notes.find((n) => n.book === book && n.chapter === chapter && first >= n.verseStart && first <= n.verseEnd);
  const v1 = existing?.verseStart ?? first;
  const v2 = existing?.verseEnd ?? last;
  const initialColor = highlights[vkey(book, chapter, v1)]?.color ?? null;
  const [text, setText] = useState(existing?.text ?? '');
  const [color, setPicked] = useState<HlColor | null>(initialColor);
  const bookName = useBookName();
  const chapterText = useChapter(book, chapter);
  const verses = chapterText.status === 'ready' ? chapterText.verses : [];
  const verseTexts = Object.fromEntries(Array.from({ length: v2 - v1 + 1 }, (_, i) => [v1 + i, verses[v1 + i - 1] ?? target?.excerpt ?? '']));
  const excerpt = existing?.excerpt ?? target?.excerpt ?? Object.values(verseTexts).join(' ');

  const cancel = onClose ?? closeSheet;
  const done = () => {
    if (!target) clearSelection();
    cancel();
  };

  const onSave = () => {
    if (!text.trim()) {
      if (existing) deleteNote(existing.id);
    } else {
      saveNote(text.trim(), excerpt, existing?.id, { book, chapter, verseStart: v1, verseEnd: v2 });
      notify(t('noteSaved'));
    }
    if (color !== initialColor) setColor(book, chapter, v1, v2, color, verseTexts);
    done();
  };

  const onDelete = () => {
    if (existing) deleteNote(existing.id);
    if (initialColor) setColor(book, chapter, v1, v2, null, {});
    done();
    notify(t(existing ? 'noteDeleted' : 'deleted'));
  };

  return (
    <Sheet title={existing ? t('noteEdit') : t('noteNew')} icon={Note} onClose={cancel}>
      <div className="note-ref">{refLabel(bookName(book), chapter, v1, v2)}</div>
      <blockquote className="note-quote">{excerpt}</blockquote>
      <ColorSwatches label={t('highlightColor')} pressed={(c) => color === c} onPick={(c) => setPicked(color === c ? null : c)} />
      <textarea
        className="note-input"
        value={text}
        maxLength={MAX}
        autoFocus
        placeholder={t('notePlaceholder')}
        aria-label={t('noteLabel')}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="counter">{text.length} / {MAX}</div>
      <div className="actions">
        {(existing || initialColor) && <IconButton icon={Trash} tone="muted" label={t('delete')} onClick={onDelete} />}
        <span className="grow" />
        <Button icon={X} onClick={cancel}>{t('cancel')}</Button>
        <Button variant="primary" icon={Check} onClick={onSave}>{t('save')}</Button>
      </div>
    </Sheet>
  );
}
