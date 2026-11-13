import type { ReactNode } from 'react';

/** Block of a screen or sheet: uppercase title and the content right below. */
export function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
