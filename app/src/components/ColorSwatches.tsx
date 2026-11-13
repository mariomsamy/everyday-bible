import { HL_COLORS, type HlColor } from '../state/study';
import { useT } from '../i18n';

interface Props {
  label: string;
  /** Tells whether the color appears selected. `null` is the "all" option. */
  pressed: (color: HlColor | null) => boolean;
  onPick: (color: HlColor) => void;
  /** When present, shows the "all" option before the colors (used in filters). */
  onAll?: () => void;
  /** Label of each color: "Highlight with …" (default) or just the color name (filters). */
  describe?: 'paint' | 'name';
}

/** Highlight color picker, used when highlighting, noting and filtering. */
export function ColorSwatches({ label, pressed, onPick, onAll, describe = 'paint' }: Props) {
  const t = useT();
  const nameOf = (c: HlColor) => (describe === 'name' ? t(c) : t('highlightWith', { color: t(c).toLowerCase() }));
  return (
    <div className="sheet-colors" role="group" aria-label={label}>
      {onAll && <button className="swatch all" aria-pressed={pressed(null)} aria-label={t('allColors')} onClick={onAll} />}
      {HL_COLORS.map((c) => (
        <button key={c} className={`swatch c-${c}`} aria-pressed={pressed(c)} aria-label={nameOf(c)} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}
