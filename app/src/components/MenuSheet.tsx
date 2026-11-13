import { useSettings } from '../state/settings';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { CalendarCheck, ChartLineUp, DeviceMobile, GearSix, Notepad, ShareNetwork, Translate, CaretRight, Globe, SignOut, UserCircle } from '@phosphor-icons/react';
import { accountAvailable, useAccount, warmAccount } from '../state/account';
import { Sheet } from './Sheet';
import { useUI } from '../state/ui';
import { go, type Route } from '../router';
import { useT } from '../i18n';
import { appUrl } from '../link';
import { checkForUpdate } from '../update';
import { installAvailable, requestInstall, subscribeInstall } from '../install';
import { shareOrCopy } from '../share';
import { Row } from './Row';

export function MenuSheet() {
  const t = useT();
  const { close, open, notify } = useUI();
  const canInstall = useSyncExternalStore(subscribeInstall, installAvailable);

  const nav = (r: Route) => {
    close();
    go(r);
  };

  const share = async () => {
    const url = appUrl();
    close();
    const result = await shareOrCopy({ title: t('appName'), text: t('shareText'), url });
    if (result === 'copied') notify(t('linkCopied'));
    else if (result === 'failed') notify(t('linkCopyFailed'));
  };

  const user = useAccount((s) => s.user);
  const canSignIn = accountAvailable() && !user;
  useEffect(() => {
    if (accountAvailable()) void warmAccount().catch(() => undefined);
  }, []);

  const signIn = async () => {
    const result = await useAccount.getState().signIn();
    if (result === 'restored') notify(t('accountRestored'));
    else if (result === 'offline') notify(t('signInOffline'));
    else if (result === 'failed') notify(t('signInFailed'));
  };

  const [checking, setChecking] = useState(false);
  // Redundant shortcut for the Settings update: tapping the version checks for and applies the latest one.
  const update = async () => {
    if (checking) return;
    setChecking(true);
    const r = await checkForUpdate();
    setChecking(false);
    notify(t(r === 'updating' ? 'updateFound' : r === 'offline' ? 'updateOffline' : 'updateLatest'));
  };

  const signOut = () => void useAccount.getState().signOut().catch(() => notify(t('signInFailed')));

  const all = [
    ...(canSignIn ? [{ icon: UserCircle, label: t('signIn'), run: signIn }] : []),
    { icon: Notepad, label: t('study'), run: () => open('study') },
    { icon: CalendarCheck, label: t('plan'), run: () => nav('/plan') },
    { icon: ChartLineUp, label: t('progress'), run: () => nav('/progress') },
    { icon: Translate, label: t('library'), run: () => open('library') },
    { icon: GearSix, label: t('settings'), run: () => nav('/settings') },
    { icon: Globe, label: t.lang === 'ar' ? 'English' : 'العربية', run: () => { useSettings.getState().set('uiLang', t.lang === 'ar' ? 'en' : 'ar'); close(); } },
    { icon: ShareNetwork, label: t('shareApp'), run: share },
    {
      icon: DeviceMobile,
      label: t('install'),
      run: async () => {
        // The native prompt comes before closing the menu: closing touches the history and would interfere with the prompt.
        if (await requestInstall()) close();
        else open('install');
      },
    },
  ];
  const items = canInstall ? all : all.filter((i) => i.icon !== DeviceMobile);

  return (
    <Sheet title={t('menu')} hideTitle onClose={close}>
      <ul>
        {items.map(({ icon: Icon, label, run }) => (
          <li key={label}>
            <Row icon={Icon} iconSize={26} title={label} onClick={run} end={<CaretRight className="flip" size={18} weight="light" color="var(--muted)" />} />
          </li>
        ))}
      </ul>
      {user && (
        <div className="menu-account">
          {user.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : <UserCircle size={36} weight="light" aria-hidden="true" />}
          <b>{user.name}</b>
          <button className="menu-signout" onClick={signOut}>
            <SignOut size={18} weight="regular" aria-hidden="true" />
            {t('signOut')}
          </button>
        </div>
      )}
      <button className="menu-version" onClick={update} disabled={checking}>{checking ? t('updateChecking') : t('updateApp')}</button>
    </Sheet>
  );
}
