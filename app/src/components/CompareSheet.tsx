import { useEffect, useState } from 'react';
import { CloudArrowDown, TextColumns } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { useUI } from '../state/ui';
import { useStudy } from '../state/study';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { loadBook } from '../data/bible';
import { abbrOf, findVersion } from '../data/catalog';
import { refLabel } from '../ref';
import { go } from '../router';
import { useT } from '../i18n';
import { Button } from './Button';

interface Row {
  id: string;
  bookName: string;
  verses: { n: number; text: string }[];
}

/** The selected verses side by side in all downloaded versions. Tapping a version opens the reading in it. */
export function CompareSheet() {
  const t = useT();
  const { close, open } = useUI();
  const { book, chapter, selection, goTo } = useStudy();
  const installed = useLibrary((s) => s.installed);
  const versionId = useSettings((s) => s.versionId);
  const setSetting = useSettings((s) => s.set);
  const [rows, setRows] = useState<Row[] | null>(null);

  const ids = Object.keys(installed).sort((a, b) => Number(b === versionId) - Number(a === versionId) || a.localeCompare(b));
  const idsKey = ids.join(',');
  const selKey = selection.join(',');

  useEffect(() => {
    let live = true;
    Promise.all(
      idsKey.split(',').filter(Boolean).map(async (id): Promise<Row | null> => {
        const b = await loadBook(id, book).catch(() => undefined);
        const chap = b?.chapters[chapter - 1];
        if (!b || !chap) return null;
        const verses = selKey.split(',').map(Number).filter((n) => chap[n - 1] !== undefined).map((n) => ({ n, text: chap[n - 1] }));
        return verses.length ? { id, bookName: b.name, verses } : null;
      }),
    ).then((r) => live && setRows(r.filter((x): x is Row => x !== null)));
    return () => {
      live = false;
    };
  }, [idsKey, selKey, book, chapter]);

  const first = selection[0];
  const last = selection[selection.length - 1];

  const read = (id: string) => {
    setSetting('versionId', id);
    // Scroll first: the verse focus triggered by goTo scrolls to the verse and must not be undone.
    scrollTo(0, 0);
    goTo(book, chapter, first);
    close();
    go('/');
  };

  const more = () => open('library');

  return (
    <Sheet title={t('compareTitle')} icon={TextColumns} onClose={close}>
      <div className="compare">
        {rows?.map((r) => (
          <button key={r.id} className="compare-item" onClick={() => read(r.id)}>
            <span className="compare-head">
              <b>{refLabel(r.bookName, chapter, first, last)} {abbrOf(r.id)}</b>
              <span>{findVersion(r.id)?.name ?? r.id}</span>
            </span>
            <span className="compare-text">
              {r.verses.map((v) => (
                <span key={v.n}>
                  <sup className="vn">{v.n}</sup>
                  {v.text}{' '}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <Button block icon={CloudArrowDown} onClick={more}>{t('compareMore')}</Button>
    </Sheet>
  );
}
