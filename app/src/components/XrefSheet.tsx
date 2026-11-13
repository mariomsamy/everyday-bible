import { useEffect, useState } from 'react';
import { LinkSimple } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { useUI } from '../state/ui';
import { useStudy } from '../state/study';
import { useSettings } from '../state/settings';
import { useBookName } from '../hooks';
import { loadBook } from '../data/bible';
import { xrefsFor, type Xref } from '../data/xrefs';
import { refLabel } from '../ref';
import { go } from '../router';
import { useT } from '../i18n';

interface Item extends Xref {
  verses: { n: number; text: string }[];
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: Item[] };

/** Verses related to the selected ones, in the text of the version in use. Tapping one opens the reading. */
export function XrefSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const { book, chapter, selection, goTo } = useStudy();
  const versionId = useSettings((s) => s.versionId);
  const bookName = useBookName();
  const [state, setState] = useState<State>({ status: 'loading' });
  const selKey = selection.join(',');

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    (async () => {
      const refs = await xrefsFor(book, chapter, selKey.split(',').map(Number));
      const items = await Promise.all(
        refs.map(async (x): Promise<Item | null> => {
          const chap = (await loadBook(versionId, x.book).catch(() => undefined))?.chapters[x.chapter - 1];
          if (!chap) return null;
          const verses: Item['verses'] = [];
          for (let n = x.first; n <= x.last && chap[n - 1] !== undefined; n++) verses.push({ n, text: chap[n - 1] });
          return verses.length ? { ...x, verses } : null;
        }),
      );
      if (live) setState({ status: 'ready', items: items.filter((i): i is Item => i !== null) });
    })().catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [book, chapter, selKey, versionId]);

  const read = (x: Xref) => {
    // Scroll first: the verse focus triggered by goTo scrolls to the verse and must not be undone.
    scrollTo(0, 0);
    goTo(x.book, x.chapter, x.first);
    close();
    go('/');
  };

  return (
    <Sheet title={t('xrefsTitle')} icon={LinkSimple} onClose={close}>
      {state.status === 'loading' && <div className="compare-wait" aria-busy="true" />}
      {state.status === 'error' && <p className="hint" role="status">{t('xrefsError')}</p>}
      {state.status === 'ready' && state.items.length === 0 && <p className="hint" role="status">{t('xrefsEmpty')}</p>}
      {state.status === 'ready' && state.items.length > 0 && (
        <div className="compare">
          {state.items.map((x) => (
            <button key={`${x.book}.${x.chapter}.${x.first}-${x.last}`} className="compare-item" onClick={() => read(x)}>
              <span className="compare-head">
                <b>{refLabel(bookName(x.book), x.chapter, x.first, x.last)}</b>
              </span>
              <span className="compare-text">
                {x.verses.map((v) => (
                  <span key={v.n}>
                    {x.verses.length > 1 && <sup className="vn">{v.n}</sup>}
                    {v.text}{' '}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
