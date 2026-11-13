import { create } from 'zustand';

export type SheetName = 'menu' | 'navigator' | 'text' | 'install' | 'feedback' | 'listen' | 'note' | 'compare' | 'xrefs' | 'ask' | 'search' | 'library' | 'study' | 'devotional' | 'deleteAccount' | 'consent' | 'share' | null;

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface UIStore {
  sheet: SheetName;
  toast: Toast | null;
  /** While true, the page address stays at the app root instead of pointing to the chapter. */
  homeUrl: boolean;
  setHomeUrl: (on: boolean) => void;
  open: (s: Exclude<SheetName, null>) => void;
  close: () => void;
  notify: (message: string, action?: Toast['action']) => void;
  dismissToast: () => void;
}

let n = 0;
/** True while a history entry pushed by the open sheet exists: the system Back closes the sheet instead of leaving the screen. */
let pushed = false;
/** close() scheduled back(); an open() right after reuses the entry instead of pushing another. */
let backPending = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useUI = create<UIStore>((set) => ({
  sheet: null,
  toast: null,
  homeUrl: false,
  setHomeUrl: (homeUrl) => set({ homeUrl }),
  open: (sheet) => {
    if (backPending) {
      backPending = false;
      pushed = true;
    } else if (!pushed) {
      history.pushState({ ob: 'sheet' }, '');
      pushed = true;
    }
    set({ sheet });
  },
  close: () => {
    const wasPushed = pushed;
    pushed = false;
    set({ sheet: null });
    // Whoever closes the sheet usually navigates right after (close(); go(route)). So back() waits for that synchronous stretch
    // and only undoes the entry if it is still the current one; if the route changed, the navigation stands and there is nothing to go back to.
    if (wasPushed) {
      backPending = true;
      queueMicrotask(() => {
        if (!backPending) return;
        backPending = false;
        if (history.state?.ob === 'sheet') history.back();
      });
    }
  },
  notify: (message, action) => {
    clearTimeout(timer);
    set({ toast: { id: ++n, message, action } });
    timer = setTimeout(() => set({ toast: null }), action ? 8000 : 2600);
  },
  dismissToast: () => set({ toast: null }),
}));

addEventListener('popstate', () => {
  if (useUI.getState().sheet) {
    pushed = false;
    useUI.setState({ sheet: null });
  } else if (history.state?.ob === 'sheet') {
    // Sheet entry left behind (the route changed while the sheet was open): skip it.
    history.back();
  }
});
