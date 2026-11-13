// Minimal IndexedDB access. Everything the user generates lives here, only in this browser.
const NAME = 'open-bible';
const VERSION = 2;

export type StoreName = 'books' | 'versions' | 'highlights' | 'notes' | 'devotional';

let opened: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const make = (name: string, options?: IDBObjectStoreParameters) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
      };
      make('books'); // key: "<version>:<book>"
      make('versions', { keyPath: 'id' });
      make('highlights', { keyPath: 'key' });
      make('notes', { keyPath: 'id' });
      make('devotional'); // key: pack language
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opened = null;
      reject(req.error);
    };
  });
  return opened;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });

export async function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await open();
  return done(db.transaction(store).objectStore(store).get(key));
}

export async function dbAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  return done(db.transaction(store).objectStore(store).getAll());
}

/** Writes several records in a single transaction. For stores without a keyPath, provide the keys. */
export async function dbPut(store: StoreName, values: unknown[], keys?: IDBValidKey[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  values.forEach((v, i) => (keys ? os.put(v, keys[i]) : os.put(v)));
  await finished(tx);
}

export async function dbDelete(store: StoreName, keys: IDBValidKey[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  keys.forEach((k) => tx.objectStore(store).delete(k));
  await finished(tx);
}

/** Deletes all books of a version. */
export async function dbDeleteRange(store: StoreName, prefix: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(IDBKeyRange.bound(prefix, prefix + '￿'));
  await finished(tx);
}

export async function dbRange<T>(store: StoreName, prefix: string): Promise<T[]> {
  const db = await open();
  return done(db.transaction(store).objectStore(store).getAll(IDBKeyRange.bound(prefix, prefix + '￿')));
}
