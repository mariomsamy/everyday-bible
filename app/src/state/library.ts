import { create } from 'zustand';
import { deleteVersion, saveVersion, type VersionMeta } from '../data/bible';
import { bookIndex } from '../data/books';
import { findVersion, versionUrls } from '../data/catalog';
import { dbAll } from '../db';
import type { WorkerIn, WorkerOut } from '../data/download.worker';

interface LibraryStore {
  ready: boolean;
  installed: Record<string, VersionMeta>;
  downloading: Record<string, number>; // 0..1
  failed: Record<string, string>;
  hydrate: () => Promise<void>;
  download: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  ready: false,
  installed: {},
  downloading: {},
  failed: {},

  hydrate: async () => {
    try {
      const metas = await dbAll<VersionMeta>('versions');
      set({ installed: Object.fromEntries(metas.map((m) => [m.id, m])), ready: true });
    } catch {
      set({ ready: true });
    }
    // Asks the browser not to evict the data on its own when space runs low.
    navigator.storage?.persist?.().catch(() => {});
  },

  download: async (id) => {
    const info = findVersion(id);
    const s = get();
    if (!info || s.downloading[id] !== undefined || s.installed[id]) return false;
    const clearFailure = ({ [id]: _, ...rest }: Record<string, string>) => rest;
    set((x) => ({ downloading: { ...x.downloading, [id]: 0 }, failed: clearFailure(x.failed) }));

    const finish = () => set((x) => ({ downloading: Object.fromEntries(Object.entries(x.downloading).filter(([k]) => k !== id)) }));

    try {
      const books = await new Promise<Extract<WorkerOut, { type: 'done' }>['books']>((resolve, reject) => {
        const worker = new Worker(new URL('../data/download.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<WorkerOut>) => {
          const m = e.data;
          if (m.type === 'progress') set((x) => ({ downloading: { ...x.downloading, [id]: m.value } }));
          else {
            worker.terminate();
            if (m.type === 'done') resolve(m.books);
            else reject(new Error(m.message));
          }
        };
        worker.onerror = () => {
          worker.terminate();
          reject(new Error('worker'));
        };
        const msg: WorkerIn = { id, urls: versionUrls(id), expectedBytes: info.sizeMb * 1048576 };
        worker.postMessage(msg);
      });
      const meta = await saveVersion(id, books, bookIndex);
      set((x) => ({ installed: { ...x.installed, [id]: meta } }));
      finish();
      return true;
    } catch (err) {
      const offline = !navigator.onLine;
      set((x) => ({ failed: { ...x.failed, [id]: offline ? 'offline' : err instanceof Error ? err.message : 'erro' } }));
      finish();
      return false;
    }
  },

  remove: async (id) => {
    await deleteVersion(id);
    set((x) => ({ installed: Object.fromEntries(Object.entries(x.installed).filter(([k]) => k !== id)) }));
  },
}));

export const downloadedMb = (ids: string[]) => ids.reduce((sum, id) => sum + (findVersion(id)?.sizeMb ?? 0), 0);
