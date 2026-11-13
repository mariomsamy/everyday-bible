import { create } from 'zustand';
import { TERMS_VERSION } from '../terms';
import { getJson, setJson } from '../storage';

/** Acceptance of the terms and policy: stored on the device and, when there is an account, also in `users/{uid}.terms`. */
const KEY = 'ob:terms';

export interface Acceptance {
  version: string;
  at: number;
}

export function savedAcceptance(): Acceptance | null {
  const a = getJson<{ version?: unknown; at?: unknown } | null>(KEY, null);
  return a && typeof a.version === 'string' && Number.isFinite(a.at) ? (a as Acceptance) : null;
}

interface TermsStore {
  /** Acceptance checkbox on the initial intro. Starts checked. */
  checked: boolean;
  setChecked: (v: boolean) => void;
  /** Records the acceptance now. */
  accept: () => void;
}

export const useTerms = create<TermsStore>((set) => ({
  checked: true,
  setChecked: (checked) => set({ checked }),
  accept: () => {
    // Accepting the terms does NOT include statistics or pixels: those have their own opt-in (ConsentSheet).
    // Without storage the acceptance holds for this session and is asked again on the next open.
    setJson(KEY, { version: TERMS_VERSION, at: Date.now() } satisfies Acceptance);
  },
}));
