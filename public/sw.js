// Service worker SchoolFlow — cache app-shell + offline (lecture seule).
// L'écriture hors-ligne (outbox) est gérée côté app via IndexedDB, pas ici.
const VERSION = "sf-v2";
const OUTBOX_DB = "schoolflow";
const OUTBOX_STORE = "outbox";
const SYNC_TAG = "outbox-flush";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icon.svg"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

// --- File hors-ligne (outbox) : rejeu via Background Sync, même app fermée ---
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushOutbox());
});

function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(OUTBOX_DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(OUTBOX_STORE)) r.result.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbAll(db) {
  return new Promise((resolve, reject) => {
    const r = db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbDel(db, id) {
  return new Promise((resolve) => {
    const r = db.transaction(OUTBOX_STORE, "readwrite").objectStore(OUTBOX_STORE).delete(id);
    r.onsuccess = r.onerror = () => resolve();
  });
}

async function flushOutbox() {
  const db = await idb();
  const items = await idbAll(db);
  for (const it of items) {
    try {
      const res = await fetch(it.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(it.body),
        credentials: "same-origin",
      });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        await idbDel(db, it.id);
      }
    } catch {
      break; // toujours hors ligne : SyncManager relancera
    }
  }
  const clients = await self.clients.matchAll();
  clients.forEach((c) => c.postMessage("flush-outbox"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // POST (server actions / API) : jamais interceptés
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Assets immuables Next → cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon")) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => put(STATIC, request, res))),
    );
    return;
  }

  // Navigations (pages) → network-first, repli cache puis page offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => put(PAGES, request, res))
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Autres GET (data, images) → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request).then((res) => put(PAGES, request, res)).catch(() => hit);
      return hit || net;
    }),
  );
});

function put(cacheName, request, response) {
  if (response && response.ok && response.type === "basic") {
    const clone = response.clone();
    caches.open(cacheName).then((c) => c.put(request, clone));
  }
  return response;
}
