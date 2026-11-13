import { create } from 'zustand';
import { readLinkFromLocation, type ReadLink } from '../link';
import { useSettings } from './settings';
import { useStudy } from './study';

interface IncomingStore {
  /** Reading requested by the page address, until applied or dismissed. */
  incoming: ReadLink | null;
  clear: () => void;
}

export const useIncoming = create<IncomingStore>((set) => ({
  incoming: readLinkFromLocation(),
  clear: () => set({ incoming: null }),
}));

/** Opens the link's book and chapter in the link's version. Only works with that version installed. */
export function applyIncoming() {
  const { incoming, clear } = useIncoming.getState();
  if (!incoming) return;
  useSettings.getState().set('versionId', incoming.versionId);
  useStudy.getState().goTo(incoming.book, incoming.chapter, incoming.verses?.from, incoming.verses?.to);
  clear();
}
