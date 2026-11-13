import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowsClockwise, DeviceMobile, Download, Export, FileText, ShieldCheck, Trash, UserMinus } from '@phosphor-icons/react';
import { ScreenHeader } from '../components/ScreenHeader';
import { abbrOf, findVersion } from '../data/catalog';
import { downloadedMb, useLibrary } from '../state/library';
import { downloadBackup, parseBackup } from '../backup';
import { useSettings, type UiLang } from '../state/settings';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { installAvailable, requestInstall, subscribeInstall } from '../install';
import { buildLabel, checkForUpdate, currentBuild, fetchLatestBuild, type BuildInfo } from '../update';
import { go } from '../router';
import { useAccount } from '../state/account';
import { useProgress } from '../state/progress';
import { forgetMe, useAnalytics } from '../analytics';
import { Segmented } from '../components/Segmented';
import { useT } from '../i18n';
import { Row } from '../components/Row';
import { Section } from '../components/Section';

const LANGS: { code: UiLang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
];

export function Settings() {
  const t = useT();
  const canInstall = useSyncExternalStore(subscribeInstall, installAvailable);
  const { uiLang, set } = useSettings();
  const { installed, remove } = useLibrary();
  const downloaded = Object.keys(installed);
  const fileInput = useRef<HTMLInputElement>(null);
  const { open, notify } = useUI();
  const account = useAccount((s) => s.user);
  const consent = useAnalytics((s) => s.consent);
  const setConsent = useAnalytics((s) => s.setConsent);
  const marketing = useAnalytics((s) => s.marketing);
  const setMarketing = useAnalytics((s) => s.setMarketing);
  const adult = useAnalytics((s) => s.adult);
  const setAdult = useAnalytics((s) => s.setAdult);
  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<BuildInfo | null>(null);
  const newer = latest && latest.build !== currentBuild.build ? latest : null;

  useEffect(() => {
    void fetchLatestBuild().then(setLatest);
  }, []);

  const update = async () => {
    setChecking(true);
    const [r, info] = await Promise.all([checkForUpdate(), fetchLatestBuild()]);
    if (info) setLatest(info);
    setChecking(false);
    notify(t(r === 'updating' ? 'updateFound' : r === 'offline' ? 'updateOffline' : 'updateLatest'));
  };
  const notes = useStudy((s) => s.notes.length);
  const highlights = useStudy((s) => Object.keys(s.highlights).length);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { highlights: hs, notes: ns, skipped, progress } = parseBackup(await file.text());
      await useStudy.getState().merge(hs, ns);
      // Progress merges: a chapter keeps its earliest date, and the current plan wins over the imported one.
      const cur = useProgress.getState();
      const read = { ...progress.read };
      for (const [k, d] of Object.entries(cur.read)) if (!read[k] || d < read[k]) read[k] = d;
      cur.replace({ read, plan: cur.plan ?? progress.plan });
      notify(skipped ? t('importedSkipped', { h: hs.length, n: ns.length, s: skipped }) : t('imported', { h: hs.length, n: ns.length }));
    } catch {
      notify(t('backupInvalid'));
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('settings')} />
      <div className="screen-body">
        <Section title={t('uiLanguage')}>
          <select
            className="select"
            value={uiLang}
            aria-label={t('uiLanguage')}
            onChange={(e) => set('uiLang', e.target.value as UiLang)}
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <p className="hint">{t('uiLanguageHint')}</p>
        </Section>

        <Section title={t('downloadedVersions')}>
          <div className="group">
            {downloaded.map((id) => {
              const v = findVersion(id);
              if (!v) return null;
              return (
                <Row
                  key={id}
                  as="div"
                  title={v.name}
                  sub={`${abbrOf(id)} · ${t.mb(v.sizeMb)}`}
                  end={
                    <button className="icon-btn" aria-label={t('removeVersion', { name: v.name })} onClick={async () => { await remove(id); notify(t('versionRemoved')); }}>
                      <Trash size={22} weight="light" />
                    </button>
                  }
                />
              );
            })}
          </div>
          <p className="hint">{t('usingMb', { size: t.mb(downloadedMb(downloaded)) })}</p>
        </Section>

        <Section title={t('yourData')}>
          <div className="group">
            <Row icon={Export} title={t('exportBackup')} sub={t('exportSub', { h: highlights, n: notes })} onClick={() => { downloadBackup(); notify(t('backupExported')); }} />
            <Row icon={Download} title={t('importBackup')} onClick={() => fileInput.current?.click()} />
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <p className="hint">{t(account ? 'dataHintSynced' : 'dataHint')}</p>
        </Section>

        <Section title={t('statsTitle')}>
          <Segmented
            label={t('statsTitle')}
            value={consent === 'granted' ? 'on' : 'off'}
            options={[{ value: 'on', label: t('on') }, { value: 'off', label: t('off') }]}
            onChange={(v) => setConsent(v === 'on')}
          />
          <p className="hint">{t('statsHint')}</p>
          <Section title={t('marketingTitle')}>
            <Segmented
              label={t('marketingTitle')}
              value={marketing === 'granted' ? 'on' : 'off'}
              options={[{ value: 'on', label: t('on') }, { value: 'off', label: t('off') }]}
              onChange={(v) => setMarketing(v === 'on')}
            />
            <p className="hint">{t('marketingHint')}</p>
          </Section>
          <label className="check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>{t('consentAdult')}</span></label>
          {!adult && <p className="hint">{t('adultRequired')}</p>}
          <div className="group">
            <Row icon={Trash} danger title={t('statsForget')} sub={t('statsForgetHint')} onClick={async () => notify(t((await forgetMe()) ? 'statsForgotten' : 'statsForgetFailed'))} />
          </div>
        </Section>

        <Section title={t('app')}>
          <div className="group">
            {canInstall && (
              <Row icon={DeviceMobile} title={t('install')} sub={t('installSub')} onClick={async () => { if (!(await requestInstall())) open('install'); }} />
            )}
            <Row
              icon={ArrowsClockwise}
              title={checking ? t('updateChecking') : t('updateApp')}
              sub={newer ? t('updateNew', { v: buildLabel(newer) }) : undefined}
              onClick={update}
              disabled={checking}
            />
            <Row icon={FileText} title={t('terms')} onClick={() => go('/terms')} />
            <Row icon={ShieldCheck} title={t('privacy')} onClick={() => go('/privacy')} />
          </div>
        </Section>

        {account && (
          <Section title={t('account')}>
            <div className="group">
              <Row icon={UserMinus} danger title={t('deleteAccount')} sub={t('deleteAccountSub')} onClick={() => open('deleteAccount')} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
