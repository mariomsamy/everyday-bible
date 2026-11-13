import { useLibrary } from './state/library';
import { useSettings } from './state/settings';
import { useStudy } from './state/study';
import { applyIncoming, useIncoming } from './state/incoming';
import { track } from './analytics';

/** Loads what is in IndexedDB and fixes the version in use. */
export async function boot() {
  // Only the `?ref=` links are shared ones: the plain reading path is also where the app leaves the address after every visit.
  const shared = new URLSearchParams(location.search).has('ref');
  await Promise.all([useLibrary.getState().hydrate(), useStudy.getState().hydrate()]);
  const link = useIncoming.getState().incoming;
  if (link && shared) track('link_open', { kind: 'read' });
  if (link && useLibrary.getState().installed[link.versionId]) applyIncoming();
  reconcile();
  // If the version in use disappears (removal, browser cleanup), switches to another one that is still installed.
  useLibrary.subscribe(reconcile);
}

function reconcile() {
  const { installed } = useLibrary.getState();
  const { versionId, set } = useSettings.getState();
  const ids = Object.keys(installed);
  if (ids.length > 0 && !installed[versionId]) set('versionId', ids[0]);
}
