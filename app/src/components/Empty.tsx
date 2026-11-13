import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

/** Empty state: icon, message and a smaller hint. `compact` is for sheets and short lists. */
export function Empty({ icon: Glyph, iconSize = 40, compact, hint, children }: { icon?: Icon; iconSize?: number; compact?: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={compact ? 'empty compact' : 'empty'}>
      {Glyph && <Glyph size={iconSize} weight="light" />}
      <p>{children}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}
