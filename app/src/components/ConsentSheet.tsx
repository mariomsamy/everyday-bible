import { useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { useAnalytics } from '../analytics';
import { useUI } from '../state/ui';
import { useT } from '../i18n';
import { go } from '../router';

/**
 * First-run privacy choice. Everything optional is OFF unless the person confirms they are an adult
 * (or have a guardian's permission) and turns each option on. Closing the sheet means "only what is needed".
 */
export function ConsentSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const a = useAnalytics();
  const [adult, setAdult] = useState(false);
  const [stats, setStats] = useState(false);
  const [mkt, setMkt] = useState(false);

  const save = (all: boolean) => {
    const ok = all && adult;
    a.setAdult(ok);
    a.setConsent(ok && stats);
    a.setMarketing(ok && mkt);
    close();
  };

  return (
    <Sheet title={t('consentTitle')} icon={ShieldCheck} onClose={() => save(false)}>
      <p className="hint" style={{ paddingTop: 0 }}>{t('consentBody')}</p>
      <label className="check"><input type="checkbox" checked={adult} onChange={(e) => { setAdult(e.target.checked); if (!e.target.checked) { setStats(false); setMkt(false); } }} /><span>{t('consentAdult')}</span></label>
      <label className="check"><input type="checkbox" checked={stats} disabled={!adult} onChange={(e) => setStats(e.target.checked)} /><span><b>{t('consentStats')}</b><small>{t('consentStatsSub')}</small></span></label>
      <label className="check"><input type="checkbox" checked={mkt} disabled={!adult} onChange={(e) => setMkt(e.target.checked)} /><span><b>{t('consentMarketing')}</b><small>{t('consentMarketingSub')}</small></span></label>
      {!adult && <p className="hint">{t('adultRequired')}</p>}
      <div className="share-actions">
        <Button variant="primary" block onClick={() => save(true)} disabled={!adult}>{t('consentSave')}</Button>
        <Button block onClick={() => save(false)}>{t('consentEssential')}</Button>
        <Button block onClick={() => { save(false); go('/privacy'); }}>{t('consentMore')}</Button>
      </div>
    </Sheet>
  );
}
