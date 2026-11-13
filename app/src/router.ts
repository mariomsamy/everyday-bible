import { useSyncExternalStore } from 'react';

export type Route = '/' | '/settings' | '/privacy' | '/terms' | '/plan' | '/progress';

const read = (): Route => {
  const p = location.hash.replace(/^#/, '') || '/';
  return (['/', '/settings', '/privacy', '/terms', '/plan', '/progress'].includes(p) ? p : '/') as Route;
};

const subscribe = (cb: () => void) => {
  addEventListener('hashchange', cb);
  return () => removeEventListener('hashchange', cb);
};

export const useRoute = () => useSyncExternalStore(subscribe, read);
export const go = (r: Route) => {
  location.hash = r === '/' ? '' : r;
};
export const back = () => (history.length > 1 ? history.back() : go('/'));
