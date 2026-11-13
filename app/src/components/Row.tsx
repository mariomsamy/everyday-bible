import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

type Props = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** HTML element of the row. Defaults to `button`. */
  as?: 'button' | 'a' | 'div' | 'label';
  icon?: Icon;
  iconSize?: number;
  title: ReactNode;
  /** Gray supporting lines below the title. Accepts several. */
  sub?: ReactNode;
  /** Small text above the title. */
  eyebrow?: ReactNode;
  /** Content on the right: arrow, button, checkbox. */
  end?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
};

/** List row: optional icon, title with supporting text and something on the right. */
export function Row({ as = 'button', icon: Glyph, iconSize = 24, title, sub, eyebrow, end, danger, className, children, ...rest }: Props) {
  const subs = (Array.isArray(sub) ? sub : [sub]).filter(Boolean);
  return createElement(
    as,
    { className: ['row', danger && 'danger', className].filter(Boolean).join(' '), ...rest },
    Glyph && <Glyph size={iconSize} weight="light" />,
    <span className="grow">
      {eyebrow && <span className="sub">{eyebrow}</span>}
      <span className="title">{title}</span>
      {subs.map((s, i) => <span className="sub" key={i}>{s}</span>)}
    </span>,
    end,
    children,
  );
}
