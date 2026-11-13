import { abbrOf } from './data/catalog';
import { useSettings } from './state/settings';
import { currentBuild, buildLabel } from './update';
import { isInstalled } from './install';
import { PRIVACY_EMAIL } from './privacy';

export type FeedbackKind = 'bug' | 'suggestion' | 'translation' | 'version';

export const FEEDBACK_KINDS: FeedbackKind[] = ['bug', 'suggestion', 'translation', 'version'];

const LABELS: Record<FeedbackKind, string> = {
  bug: 'bug',
  suggestion: 'enhancement',
  translation: 'translation',
  version: 'new version',
};

/** mailto: link with a pre-filled message, with the context that helps reproduce the problem. */
export function feedbackUrl(kind: FeedbackKind, message: string, passage: string): string {
  const { versionId, uiLang } = useSettings.getState();
  const context = [
    `- App: ${buildLabel(currentBuild)}`,
    `- Bible: ${abbrOf(versionId)} (${versionId})`,
    `- Passage: ${passage}`,
    `- Language: ${uiLang}`,
    `- Installed app: ${isInstalled() ? 'yes' : 'no'}`,
    `- Browser: ${navigator.userAgent}`,
  ].join('\n');
  const body = `${message.trim()}\n\n---\n${context}\n`;
  const title = message.trim().split('\n')[0].slice(0, 80);
  return `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(`[${LABELS[kind]}] ${title}`)}&body=${encodeURIComponent(body)}`;
}
