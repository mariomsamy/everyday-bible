import { getItem, setItem } from './storage';

const KEY = 'ob:hint-pager';

/** The gestures hint shows only once. Without available storage it does not show, to avoid repeating on every launch. */
export function hintPending(): boolean {
  return !getItem(KEY, '1');
}

export function markHintSeen() {
  setItem(KEY, '1');
}
