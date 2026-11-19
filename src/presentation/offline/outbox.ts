"use client";

// File d'attente hors-ligne : des requêtes POST idempotentes stockées en
// IndexedDB puis rejouées au retour du réseau (ici + Background Sync côté SW).

export const DB_NAME = "schoolflow";
export const STORE = "outbox";
export const SYNC_TAG = "outbox-flush";

export interface OutboxItem {
  id: string;
  url: string;
  body: unknown;
  createdAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const r = fn(db.transaction(STORE, mode).objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function enqueue(url: string, body: unknown): Promise<OutboxItem> {
  const item: OutboxItem = { id: crypto.randomUUID(), url, body, createdAt: Date.now() };
  await tx("readwrite", (s) => s.add(item));
  await requestBackgroundSync();
  return item;
}

export const listOutbox = () => tx<OutboxItem[]>("readonly", (s) => s.getAll());
const remove = (id: string) => tx("readwrite", (s) => s.delete(id));

/** Rejoue toute la file ; retire les éléments acceptés (2xx) ou définitivement rejetés (4xx hors 408/429). */
export async function flushOutbox(): Promise<{ sent: number; left: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { sent: 0, left: (await listOutbox()).length };
  const items = await listOutbox();
  let sent = 0;
  for (const it of items) {
    try {
      const res = await fetch(it.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": it.id },
        body: JSON.stringify(it.body),
        credentials: "same-origin",
      });
      if (res.ok) {
        await remove(it.id);
        sent++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        // Rejet métier définitif (validation, autorisation) : inutile de rejouer indéfiniment.
        await remove(it.id);
      }
    } catch {
      break; // réseau indisponible : on garde le reste pour plus tard
    }
  }
  return { sent, left: (await listOutbox()).length };
}

async function requestBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    // @ts-expect-error sync non typé dans lib.dom
    await reg?.sync?.register(SYNC_TAG);
  } catch {
    /* Background Sync indisponible : le flush au retour du réseau prend le relais. */
  }
}
