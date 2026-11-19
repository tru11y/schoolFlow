// Service worker SchoolFlow — cache app-shell + offline (lecture seule).
// L'écriture hors-ligne (outbox) est gérée côté app via IndexedDB, pas ici.
const VERSION = "sf-v1";
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
