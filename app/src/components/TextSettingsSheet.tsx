import { ArrowCounterClockwise, TextAa, TextAlignJustify, TextAlignLeft } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { useSettings } from '../state/settings';
import { useUI } from '../state/ui';
import { readingVars } from './readingVars';
import { useT, type Key } from '../i18n';
import { Button } from './Button';

const THEMES = [
  { v: 'auto', label: 'themeAuto' },
  { v: 'light', label: 'themeLight' },
  { v: 'sepia', label: 'themeSepia' },
  { v: 'dark', label: 'themeDark' },
] as const satisfies readonly { v: string; label: Key }[];

const FONT_MIN = 14;
const FONT_MAX = 32;
const FONT_STEP = 2;
const LINE_HEIGHTS = [
  { v: 1.4, label: 'lhCompact', gap: 4 },
  { v: 1.7, label: 'lhNormal', gap: 6 },
  { v: 2, label: 'lhLoose', gap: 8 },
] as const satisfies readonly { v: number; label: Key; gap: number }[];
const MARGINS = [
  { v: 'narrow', label: 'marginsNarrow', inset: 2 },
  { v: 'medium', label: 'marginsMedium', inset: 6 },
  { v: 'wide', label: 'marginsWide', inset: 10 },
] as const satisfies readonly { v: string; label: Key; inset: number }[];

/** Miniature text lines. `gap` changes the vertical spacing and `inset` the side indent. */
function Lines({ gap = 6, inset = 3 }: { gap?: number; inset?: number }) {
  const start = (26 - 3 * gap) / 2;
  const ys = [0, 1, 2, 3].map((i) => start + i * gap);
  return (
    <svg width="28" height="26" viewBox="0 0 28 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {ys.map((y, i) => <line key={i} x1={inset} x2={28 - inset - (i === 3 ? 6 : 0)} y1={y} y2={y} />)}
    </svg>
  );
}

const nearest = (v: number) => LINE_HEIGHTS.reduce((a, b) => (Math.abs(b.v - v) < Math.abs(a.v - v) ? b : a));

export function TextSettingsSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const s = useSettings();

  return (
    <Sheet
      title={t('textSettings')}
      icon={TextAa}
      onClose={close}
      pinned={
        <div className="preview" style={readingVars(s)} aria-hidden="true">
          <div className={`preview-text vn-${s.verseNumbers}`} lang="en">
            <span className="vn">16</span>
            For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish.
          </div>
        </div>
      }
    >
      <div className="themes" role="group" aria-label={t('theme')}>
        {THEMES.map((th) => (
          <button key={th.v} className="theme-btn" aria-pressed={s.theme === th.v} onClick={() => s.set('theme', th.v)}>
            <span className={`sw t-${th.v}`}>Aa</span>
            {t(th.label)}
          </button>
        ))}
      </div>

      <div className="field">
        <span className="lbl">{t('size')} <span>{t('sizeValue', { n: s.fontSize })}</span></span>
        <div className="choice-row two" role="group" aria-label={t('size')}>
          <button
            className="choice"
            aria-label={t('smaller')}
            disabled={s.fontSize <= FONT_MIN}
            onClick={() => s.set('fontSize', Math.max(FONT_MIN, s.fontSize - FONT_STEP))}
          >
            <span style={{ fontSize: 15 }}>A</span>
          </button>
          <button
            className="choice"
            aria-label={t('larger')}
            disabled={s.fontSize >= FONT_MAX}
            onClick={() => s.set('fontSize', Math.min(FONT_MAX, s.fontSize + FONT_STEP))}
          >
            <span style={{ fontSize: 26 }}>A</span>
          </button>
        </div>
      </div>

      <div className="field">
        <span className="lbl">{t('font')}</span>
        <Segmented
          label={t('font')}
          value={s.font}
          onChange={(v) => s.set('font', v)}
          options={[
            { value: 'serif', label: <span style={{ fontFamily: 'var(--font-serif)' }}>{t('fontSerif')}</span> },
            { value: 'sans', label: <span style={{ fontFamily: 'var(--font-sans)' }}>{t('fontSans')}</span> },
            { value: 'mono', label: <span style={{ fontFamily: 'var(--font-mono)' }}>{t('fontMono')}</span> },
          ]}
        />
      </div>

      <div className="field">
        <span className="lbl">{t('lineHeight')}</span>
        <div className="choice-row" role="group" aria-label={t('lineHeight')}>
          {LINE_HEIGHTS.map((l) => (
            <button key={l.v} className="choice" aria-pressed={nearest(s.lineHeight).v === l.v} aria-label={t(l.label)} title={t(l.label)} onClick={() => s.set('lineHeight', l.v)}>
              <Lines gap={l.gap} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">{t('margins')}</span>
        <div className="choice-row" role="group" aria-label={t('margins')}>
          {MARGINS.map((m) => (
            <button key={m.v} className="choice" aria-pressed={s.margins === m.v} aria-label={t(m.label)} title={t(m.label)} onClick={() => s.set('margins', m.v)}>
              <Lines inset={m.inset} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">{t('alignment')}</span>
        <div className="choice-row two" role="group" aria-label={t('alignment')}>
          <button className="choice" aria-pressed={s.align === 'left'} aria-label={t('alignLeft')} title={t('alignLeft')} onClick={() => s.set('align', 'left')}>
            <TextAlignLeft size={26} weight="light" />
          </button>
          <button className="choice" aria-pressed={s.align === 'justify'} aria-label={t('alignJustify')} title={t('alignJustify')} onClick={() => s.set('align', 'justify')}>
            <TextAlignJustify size={26} weight="light" />
          </button>
        </div>
      </div>

      <div className="field">
        <span className="lbl">{t('verseNumbers')}</span>
        <Segmented
          label={t('verseNumbers')}
          value={s.verseNumbers}
          onChange={(v) => s.set('verseNumbers', v)}
          options={[
            { value: 'visible', label: t('vnVisible') },
            { value: 'subtle', label: t('vnSubtle') },
            { value: 'hidden', label: t('vnHidden') },
          ]}
        />
      </div>

      <div className="field">
        <span className="lbl">{t('layout')}</span>
        <Segmented
          label={t('layout')}
          value={s.textMode}
          onChange={(v) => s.set('textMode', v)}
          options={[
            { value: 'verses', label: t('layoutVerses') },
            { value: 'paragraph', label: t('layoutParagraph') },
          ]}
        />
      </div>

      <Button block className="mt-28" icon={ArrowCounterClockwise} onClick={s.resetText}>{t('resetText')}</Button>
    </Sheet>
  );
}
