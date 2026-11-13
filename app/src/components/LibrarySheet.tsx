import { useMemo, useRef, useState } from 'react';
import { ArrowClockwise, CheckCircle, CloudArrowDown, CloudCheck, Translate } from '@phosphor-icons/react';
import { SearchField } from './SearchField';
import { Sheet } from './Sheet';
import { VERSIONS, abbrOf, type VersionInfo } from '../data/catalog';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUI } from '../state/ui';
import { useT } from '../i18n';
import { Chip } from './Chip';
import { Empty } from './Empty';
import { ProgressBar } from './ProgressBar';

const COVERAGE = { nt: 'covNt', ot: 'covOt', partial: 'covPartial' } as const;

export function LibrarySheet() {
  const t = useT();
  const [q, setQ] = useState('');
  const { versionId, uiLang, set } = useSettings();
  const { installed, downloading, failed, download } = useLibrary();
  const { notify, close } = useUI();
  // First use, with no Bible on the device: the first download should lead straight to the text.
  const firstRun = useRef(Object.keys(installed).length === 0);

  const names = useMemo(() => new Intl.DisplayNames([uiLang], { type: 'language' }), [uiLang]);
  const native = (code: string) => {
    try {
      return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? '';
    } catch {
      return '';
    }
  };

  const matches = (v: VersionInfo) => {
    const term = q.trim().toLowerCase();
    return !term || `${names.of(v.lang) ?? v.lang} ${native(v.lang)} ${v.name} ${abbrOf(v.id)}`.toLowerCase().includes(term);
  };

  // Downloaded versions go in their own group, with the one in use first.
  const mineIds = new Set(Object.keys(installed));
  const mine = VERSIONS.filter((v) => mineIds.has(v.id) && matches(v)).sort(
    (a, b) => Number(b.id === versionId) - Number(a.id === versionId) || a.name.localeCompare(b.name),
  );

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, VersionInfo[]>();
    for (const v of VERSIONS) {
      if (installed[v.id]) continue;
      const label = `${names.of(v.lang) ?? v.lang} ${native(v.lang)} ${v.name} ${abbrOf(v.id)}`.toLowerCase();
      if (term && !label.includes(term)) continue;
      map.set(v.lang, [...(map.get(v.lang) ?? []), v]);
    }
    // First the language chosen by the user (by default, the browser's), then the other browser languages
    // and finally the rest in alphabetical order by localized name.
    const prefs = [uiLang, ...(navigator.languages ?? [])].map((l) => l.toLowerCase().split('-')[0]);
    const rank = (code: string) => {
      const i = prefs.indexOf(code);
      return i < 0 ? prefs.length : i;
    };
    const collator = new Intl.Collator(uiLang);
    return [...map.entries()].sort(
      ([a], [b]) => rank(a) - rank(b) || collator.compare(names.of(a) ?? a, names.of(b) ?? b),
    );
  }, [q, names, uiLang, installed]);

  const choose = (id: string, key: 'versionToast' | 'versionDownloaded' = 'versionToast') => {
    set('versionId', id);
    notify(t(key, { abbr: abbrOf(id) }));
  };

  /** Choosing an installed version closes the sheet; the toast says the version changed. */
  const pick = (id: string) => {
    if (id !== versionId) choose(id);
    close();
  };

  const get = async (id: string) => {
    if (await download(id)) {
      choose(id, 'versionDownloaded');
      if (firstRun.current) close();
    }
    else notify(navigator.onLine ? t('downloadError') : t('offlineShort'));
  };

  const renderRow = (v: VersionInfo) => {
      const isDown = !!installed[v.id];
      const prog = downloading[v.id];
      const active = v.id === versionId;
      return (
        <div key={v.id} className={`ver ${active ? 'active' : ''}`}>
          <button
            className="grow"
            disabled={!isDown}
            onClick={() => pick(v.id)}
            aria-label={`${v.name}${active ? `, ${t('selected')}` : ''}`}
          >
            <div className="nm">{v.name}</div>
            <div className="meta">
              <span className="abbr">{abbrOf(v.id)}</span>
            {mineIds.has(v.id) && <Chip>{names.of(v.lang) ?? v.lang}</Chip>}
              {v.coverage && <Chip>{t(COVERAGE[v.coverage])}</Chip>}
              {v.rtl && <Chip>RTL</Chip>}
              {active ? <Chip accent>{t('inUse')}</Chip> : isDown && <Chip>{t('downloaded')}</Chip>}
              <span className="abbr light">{t.mb(v.sizeMb)}</span>
            </div>
            {!isDown && failed[v.id] && prog === undefined && (
              <div className="ver-err" role="alert">{failed[v.id] === 'offline' ? t('offlineShort') : t('downloadError')}</div>
            )}
          </button>
          <div className="state">
            {prog !== undefined ? (
              <div className="ver-prog" role="status" aria-label={`${v.name} ${Math.round(prog * 100)}%`}>
                <span>{Math.round(prog * 100)}%</span>
                <ProgressBar value={prog} />
              </div>
            ) : !isDown ? (
              <button className="icon-btn" aria-label={failed[v.id] ? t('retryDownload', { name: v.name }) : t('downloadVersion', { name: v.name })} onClick={() => get(v.id)}>
                {failed[v.id] ? <ArrowClockwise size={26} weight="bold" color="var(--danger)" /> : <CloudArrowDown size={26} weight="light" />}
              </button>
            ) : active ? (
              <CheckCircle size={26} weight="fill" aria-label={t('inUse')} />
            ) : (
              <CloudCheck size={26} weight="light" aria-label={t('downloaded')} />
            )}
          </div>
        </div>
      );
  };

  return (
    <Sheet
      title={t('library')}
      icon={Translate}
      onClose={close}
      tall
      pinned={<SearchField value={q} onChange={setQ} placeholder={t('searchLibrary')} aria-label={t('searchLibrary')} />}
    >
      {mine.length === 0 && groups.length === 0 && <Empty compact>{t('noVersions')}</Empty>}

      {mine.length > 0 && (
        <section>
          <h2 className="lang-title">{t('myVersions')}</h2>
          {mine.map(renderRow)}
        </section>
      )}

      {groups.map(([lang, versions]) => {
        const nat = native(lang);
        const loc = names.of(lang) ?? lang;
        return (
          <section key={lang}>
            <h2 className="lang-title">
              {loc}
              {nat && nat !== loc && <small>{nat}</small>}
            </h2>
            {versions.map(renderRow)}
          </section>
        );
      })}
      <p className="hint mt-24">{t('libraryFooter', { n: VERSIONS.length })}</p>
    </Sheet>
  );
}
