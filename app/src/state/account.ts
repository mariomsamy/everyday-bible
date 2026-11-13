import { create } from 'zustand';

// This app has no accounts by design (no registration, no personal data). The module keeps the small API the
// original screens call, so they compile unchanged, but it is inert: `accountAvailable()` is false,
// so every sign-in entry point is hidden.

export interface Profile {
  name: string;
  photo: string | null;
}

export type SignInResult = 'ok' | 'restored' | 'cancelled' | 'offline' | 'failed';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export const accountAvailable = () => false;
export const warmAccount = (): Promise<void> => Promise.resolve();
export const initAccount = () => undefined;

interface AccountStore {
  user: Profile | null;
  sync: SyncStatus;
  busy: boolean;
  signIn: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAccount = create<AccountStore>(() => ({
  user: null,
  sync: 'idle',
  busy: false,
  signIn: async () => 'failed',
  signOut: async () => undefined,
  deleteAccount: async () => undefined,
}));
