// Copy and share with whatever the device offers.

/** Copies to the clipboard. Returns `false` if the browser denies it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Opens the system share sheet. Without it, copies the link (or the text).
 * Closing the sheet without choosing anything is `cancelled`, not an error.
 */
export async function shareOrCopy(data: { title?: string; text?: string; url?: string }): Promise<ShareResult> {
  if (!navigator.share) return (await copyText(data.url ?? data.text ?? '')) ? 'copied' : 'failed';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
