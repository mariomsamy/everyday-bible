import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

/** Action button of the selection sheet: large icon with a short label below. */
export function SheetAction({ icon: Glyph, onClick, children }: { icon: Icon; onClick: () => void; children: ReactNode }) {
  return (
    <button className="sheet-action" onClick={onClick}>
      <Glyph size={24} weight="light" />
      {children}
    </button>
  );
}
