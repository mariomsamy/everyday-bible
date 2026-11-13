import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenText, X } from '@phosphor-icons/react';
import { BOOKS } from '../data/books';
import { abbrOf } from '../data/catalog';
import { localBookName } from '../i18n/books';
import { useBooks, useChapter } from '../hooks';
import { refLabel } from '../ref';
import { findReferences, type RefTarget } from '../search';
import { useSettings } from '../state/settings';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { go } from '../router';
import { useT } from '../i18n';
import { Button } from './Button';

type Block =
  | { type: 'p'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'ul' | 'ol'; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

/** Splits the answer into paragraphs and lists. Headings become bold paragraphs. */
function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
    para = [];
  };
  for (const line of text.split('\n')) {
    const quote = QUOTE.exec(line);
    if (quote) {
      // Consecutive "> " lines make one quote.
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'quote') last.text += `\n${quote[1]}`;
      else blocks.push({ type: 'quote', text: quote[1] });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      flush();
      const type = bullet ? 'ul' : 'ol';
      const last = blocks[blocks.length - 1];
      if (last && last.type === type) last.items.push(item[1]);
      else blocks.push({ type, items: [item[1]] });
    } else if (!line.trim()) flush();
    else if (/^#{1,6}\s+/.test(line)) {
      flush();
      blocks.push({ type: 'p', text: `**${line.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '')}**` });
    } else para.push(line);
  }
  flush();
  return blocks;
}

/** Marks that wrap text: **bold** and *italic* or _italic_. */
const MARKS = /\*\*(.+?)\*\*|\*([^\s*][^*]*?)\*|_([^\s_][^_]*?)_/g;

function Passage({ target, onOpen, onClose }: { target: RefTarget; onOpen: () => void; onClose: () => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const versionId = useSettings((s) => s.versionId);
  const text = useChapter(target.book.id, target.chapter);
  const ready = text.status === 'ready';
  // The preview opens below the link; bring it to the middle of the visible area.
  useEffect(() => {
    if (ready) box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [ready]);
  if (text.status !== 'ready') return null;
  const { verse, verseEnd } = target;
  const first = verse ?? 1;
  const last = Math.min(verseEnd ?? (verse ?? 4), text.verses.length);
  const range = last > first;
  return (
    <div className="ref-preview" ref={box}>
      <div className="ref-preview-head">
        <b>{refLabel(target.book.name, target.chapter, verse, verseEnd)}</b>
        <span className="chip">{abbrOf(versionId)}</span>
        <button type="button" className="icon-btn ref-preview-close" onClick={onClose} aria-label={t('close')}>
          <X size={16} weight="bold" />
        </button>
      </div>
      <p>
        {text.verses.slice(first - 1, last).map((v, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            {range && <sup>{first + i} </sup>}
            {v}
          </Fragment>
        ))}
        {verse === undefined && last < text.verses.length && '…'}
      </p>
      <Button size="sm" icon={BookOpenText} onClick={onOpen}>{t('askOpenPassage')}</Button>
    </div>
  );
}

/** Answer of the AI: paragraphs, lists, bold and italic, and Bible references that open a preview of the passage. */
export function AiText({ text }: { text: string }) {
  const uiLang = useSettings((s) => s.uiLang);
  const versionBooks = useBooks();
  const close = useUI((s) => s.close);
  const goTo = useStudy((s) => s.goTo);
  // The link that is open, the line or list item that holds it (the preview goes right below it) and its passage.
  const [opened, setOpened] = useState<{ id: string; line: string; target: RefTarget } | null>(null);

  // Names from the version and from the interface language, both pointing to the books the version has.
  const books = useMemo(() => {
    const extra = versionBooks.flatMap((b) => {
      const i = BOOKS.findIndex((x) => x.id === b.id);
      const name = i >= 0 ? localBookName(uiLang, i) : undefined;
      return name && name !== b.name ? [{ ...b, name }] : [];
    });
    return [...versionBooks, ...extra];
  }, [versionBooks, uiLang]);
  const blocks = useMemo(() => parse(text), [text]);

  const open = (r: RefTarget) => {
    // Scroll first: the verse focus triggered by goTo scrolls to the verse and must not be undone.
    scrollTo(0, 0);
    goTo(r.book.id, r.chapter, r.verse, r.verseEnd);
    close();
    go('/');
  };

  const refs = (s: string, key: string, where: string, line: string) => {
    const found = findReferences(s, books);
    if (found.length === 0) return s;
    const out: React.ReactNode[] = [];
    let at = 0;
    found.forEach((f, i) => {
      const id = `${where}:${key}:${i}`;
      out.push(
        s.slice(at, f.start),
        <button
          key={id}
          type="button"
          className="ref-link"
          aria-expanded={opened?.id === id}
          onClick={() => setOpened(opened?.id === id ? null : { id, line, target: f.target })}
        >
          {s.slice(f.start, f.end)}
        </button>,
      );
      at = f.end;
    });
    out.push(s.slice(at));
    return out.map((n, i) => (typeof n === 'string' ? <Fragment key={i}>{n}</Fragment> : n));
  };

  const inline = (s: string, where: string, line: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let at = 0;
    for (const m of s.matchAll(MARKS)) {
      const i = m.index!;
      if (i > at) out.push(<Fragment key={`t${i}`}>{refs(s.slice(at, i), String(at), where, line)}</Fragment>);
      if (m[1] !== undefined) out.push(<strong key={`b${i}`}>{inline(m[1], `${where}b${i}`, line)}</strong>);
      else out.push(<em key={`i${i}`}>{inline(m[2] ?? m[3], `${where}i${i}`, line)}</em>);
      at = i + m[0].length;
    }
    if (at < s.length) out.push(<Fragment key={`t${at}`}>{refs(s.slice(at), String(at), where, line)}</Fragment>);
    return out;
  };

  const preview = (line: string) =>
    opened?.line === line && <Passage target={opened.target} onOpen={() => open(opened.target)} onClose={() => setOpened(null)} />;

  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.type === 'p' && (
            <div className="ai-para">
              {b.text.split('\n').map((ln, k) => (
                <Fragment key={k}>
                  <p>{inline(ln.trimEnd(), `p${i}-${k}`, `p${i}-${k}`)}</p>
                  {preview(`p${i}-${k}`)}
                </Fragment>
              ))}
            </div>
          )}
          {b.type === 'quote' && (
            <blockquote className="ai-quote">
              {b.text.split('\n').filter((ln) => ln.trim()).map((ln, k) => (
                <p key={k}>{inline(ln.trim(), `q${i}-${k}`, `q${i}-${k}`)}</p>
              ))}
            </blockquote>
          )}
          {b.type !== 'p' && b.type !== 'quote' &&
            (b.type === 'ul' ? (
              <ul>{b.items.map((it, j) => <li key={j}>{inline(it, `u${i}-${j}`, `u${i}-${j}`)}{preview(`u${i}-${j}`)}</li>)}</ul>
            ) : (
              <ol>{b.items.map((it, j) => <li key={j}>{inline(it, `o${i}-${j}`, `o${i}-${j}`)}{preview(`o${i}-${j}`)}</li>)}</ol>
            ))}
        </Fragment>
      ))}
    </>
  );
}
