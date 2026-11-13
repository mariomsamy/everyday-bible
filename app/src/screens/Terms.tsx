import { LegalDoc } from '../components/LegalDoc';
import { TERMS } from '../terms';
import { useT } from '../i18n';

export function Terms() {
  const t = useT();
  return <LegalDoc title={t('terms')} doc={TERMS[t.lang]} />;
}
