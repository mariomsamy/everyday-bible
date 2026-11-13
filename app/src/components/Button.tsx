import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import type { Icon, IconWeight } from '@phosphor-icons/react';

interface Look {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  /** Takes the available width. The icon goes to the edge of the button and the text is centered. */
  block?: boolean;
  icon?: Icon;
  iconSide?: 'left' | 'right';
  iconWeight?: IconWeight;
  /** Extra class for the icon (for example `flip` to mirror arrows in right-to-left). */
  iconClass?: string;
  children: ReactNode;
}

const classes = ({ variant = 'secondary', size = 'md', block, icon, iconSide = 'left' }: Look, extra?: string) =>
  ['btn', variant === 'primary' && 'primary', size === 'sm' && 'sm', block && 'block', icon && (iconSide === 'left' ? 'lead' : 'trail'), extra]
    .filter(Boolean)
    .join(' ');

function Content({ icon: Glyph, iconSide = 'left', iconWeight = 'regular', iconClass, size = 'md', children }: Look) {
  if (!Glyph) return <>{children}</>;
  const glyph = <Glyph className={iconClass} size={size === 'sm' ? 16 : 18} weight={iconWeight} aria-hidden="true" />;
  return iconSide === 'left' ? <>{glyph}{children}</> : <>{children}{glyph}</>;
}

/** Primary or secondary button, with no icon or with an icon on the left or right. */
export function Button({ variant, size, block, icon, iconSide, iconWeight, iconClass, className, children, type = 'button', ...rest }: Look & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const look = { variant, size, block, icon, iconSide, iconWeight, iconClass, children };
  return (
    <button type={type} className={classes(look, className)} {...rest}>
      <Content {...look} />
    </button>
  );
}

/** Same look as the button, for links. */
export function ButtonLink({ variant, size, block, icon, iconSide, iconWeight, iconClass, className, children, ...rest }: Look & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>) {
  const look = { variant, size, block, icon, iconSide, iconWeight, iconClass, children };
  return (
    <a className={classes(look, className)} {...rest}>
      <Content {...look} />
    </a>
  );
}

/** Secondary round button, icon and border only. The label becomes aria-label and tooltip. */
export function IconButton({ icon: Glyph, label, tone, iconWeight = 'light', className, type = 'button', ...rest }: {
  icon: Icon;
  label: string;
  tone?: 'danger' | 'muted';
  iconWeight?: IconWeight;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label' | 'title'>) {
  return (
    <button type={type} className={['btn-round', tone, className].filter(Boolean).join(' ')} aria-label={label} title={label} {...rest}>
      <Glyph size={22} weight={iconWeight} aria-hidden="true" />
    </button>
  );
}
