import type { CSSProperties } from 'react';
import type { Settings } from '../state/settings';

const FONTS = { serif: 'var(--font-serif)', sans: 'var(--font-sans)', mono: 'var(--font-mono)' } as const;
const COLS = { narrow: '44rem', medium: '37rem', wide: '31rem' } as const;
// Extra side padding of the reader, added to the 10vw tap strips. On narrow screens this is what actually changes the text width.
const PADS = { narrow: '0px', medium: '3vw', wide: '7vw' } as const;
// The preview is a miniature of the reader, so it uses a percentage of its own width.
const PREVIEW_PADS = { narrow: '0%', medium: '7%', wide: '16%' } as const;

/** Reading variables shared by the reader and the text settings preview. */
export function readingVars(s: Pick<Settings, 'font' | 'fontSize' | 'lineHeight' | 'margins' | 'align'>): CSSProperties {
  return {
    '--rd-font': FONTS[s.font],
    '--rd-size': `${s.fontSize}px`,
    '--rd-lh': s.lineHeight,
    '--rd-col': COLS[s.margins],
    '--rd-pad': PADS[s.margins],
    '--rd-pv-pad': PREVIEW_PADS[s.margins],
    '--rd-align': s.align === 'justify' ? 'justify' : 'start',
    '--rd-hyph': s.align === 'justify' ? 'auto' : 'manual',
  } as CSSProperties;
}
