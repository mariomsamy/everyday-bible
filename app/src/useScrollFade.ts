import { useCallback, useRef } from 'react';

const FADE = '28px';

/**
 * Ref callback for a row that scrolls sideways: sets --fl and --fr to the width of the fade at each edge that still has
 * content hidden beyond it, and 0 where there is none. CSS draws the fade with them.
 */
export function useScrollFade<T extends HTMLElement>() {
  const stop = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.style.setProperty('--fl', el.scrollLeft > 2 ? FADE : '0px');
      el.style.setProperty('--fr', el.scrollLeft < max - 2 ? FADE : '0px');
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    for (const child of el.children) resize.observe(child);
    stop.current = () => {
      el.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);
}
