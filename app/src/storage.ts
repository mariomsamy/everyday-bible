// Safe localStorage access: private mode, full quota or blocked storage never bring the app down.

/** Reads a string. If storage fails, returns `onError` (`null` by default). */
export function getItem(key: string, onError: string | null = null): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return onError;
  }
}

export function setItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* no persistence: the value only lasts for this session */
  }
}

export function removeItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no storage, nothing to clear */
  }
}

/** Reads JSON. Missing, invalid or unreadable returns `fallback`. */
export function getJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

export function setJson(key: string, value: unknown) {
  setItem(key, JSON.stringify(value));
}
