import { LegalDoc } from '../components/LegalDoc';
import { PRIVACY } from '../privacy';
import { useT } from '../i18n';

export function Privacy() {
  const t = useT();
  return <LegalDoc title={t('privacy')} doc={PRIVACY[t.lang]} />;
}
