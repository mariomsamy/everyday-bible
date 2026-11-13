import { Check, CloudArrowDown, DownloadSimple, List, Translate } from '@phosphor-icons/react';
import { abbrOf, findVersion, suggestedVersion } from '../data/catalog';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUI } from '../state/ui';
import { useIncoming, applyIncoming } from '../state/incoming';
import { Button } from './Button';
import { LangToggle } from './LangToggle';
import { useT } from '../i18n';
import { ProgressBar } from './ProgressBar';

/** First launch: no version on the device yet. Offers the one suggested for the language and leads to the Library. */
function useFirstDownload() {
  const uiLang = useSettings((s) => s.uiLang);
  const set = useSettings((s) => s.set);
  const { downloading, failed, download } = useLibrary();
  const incoming = useIncoming((s) => s.incoming);
  const hasOther = useLibrary((s) => Object.keys(s.installed).length > 0);
  const current = useSettings((s) => s.versionId);

  const id = incoming?.versionId ?? suggestedVersion(uiLang);
  const progress = downloading[id];

  const start = async () => {
    set('versionId', id);
    if ((await download(id)) && incoming) applyIncoming();
  };

  return { id, v: findVersion(id)!, progress, busy: progress !== undefined, failure: failed[id], start, incoming, hasOther, current };
}

/** Text for downloading the first Bible, used on the last intro screen and on the home screen with no versions. */
export function DownloadInfo({ iconSize }: { iconSize: number }) {
  const t = useT();
  return (
    <>
      <CloudArrowDown size={iconSize} weight="light" />
      <h1>{t('welcomeTitle')}</h1>
      <p>{t('welcomeBody')}</p>
    </>
  );
}

/** Actions for downloading the first Bible: download the suggested one, keep the current one or pick another. */
export function DownloadActions({ onChooseOther, trailing }: { onChooseOther: () => void; trailing?: boolean }) {
  const t = useT();
  const { id, v, progress, busy, failure, start, incoming, hasOther, current } = useFirstDownload();
  const side = trailing ? 'right' : 'left';
  return (
    <>
      <Button variant="primary" block icon={busy ? undefined : DownloadSimple} iconSide={side} onClick={start} disabled={busy}>
        {busy ? t('downloadingBtn', { pct: Math.round(progress * 100) }) : t('downloadBtn', { abbr: abbrOf(id), size: t.mb(v.sizeMb) })}
      </Button>
      {busy && <ProgressBar value={progress} />}
      {failure && (
        <p className="error" role="alert">
          {failure === 'offline' ? t('offlineError') : t('downloadError')}
        </p>
      )}
      {incoming && hasOther && (
        <Button block icon={Check} iconSide={side} onClick={() => useIncoming.getState().clear()}>
          {t('keepCurrent', { abbr: abbrOf(current) })}
        </Button>
      )}
      <Button block icon={Translate} iconSide={side} onClick={onChooseOther}>{t('chooseOther')}</Button>
    </>
  );
}

/** First launch with no version on the device, after the intro. */
export function Welcome() {
  const t = useT();
  const open = useUI((s) => s.open);

  return (
    <div className="reader">
      <header className="topbar">
        <div className="topbar-in">
          <b className="brand-name">{t('appName')}</b>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => open('menu')} aria-label={t('menu')}><List size={24} weight="light" /></button>
        </div>
      </header>
      <main className="welcome">
      <LangToggle />
        <div className="intro-body">
          <DownloadInfo iconSize={56} />
        </div>
        <div className="intro-foot">
          <DownloadActions trailing onChooseOther={() => open('library')} />
        </div>
      </main>
    </div>
  );
}
