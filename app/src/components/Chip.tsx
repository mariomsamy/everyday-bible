import type { ReactNode } from 'react';

/** Small rounded label. `accent` highlights the current state. */
export function Chip({ accent, className, children, ...rest }: { accent?: boolean; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={['chip', accent && 'accent', className].filter(Boolean).join(' ')} {...rest}>{children}</span>;
}
