// Tsakani Sessions service worker — minimal cache-first with offline fallback
// v4, 2 November 2026: a new name so every installed worker updates. A worker
// installed while the site was on Vercel keeps the CSP it came with, which
// blocks photos.tsakanisessions.co.za, and an unchanged sw.js never replaces it.
const CACHE_NAME = "tsakani-v4";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  "/services",
  "/shop",
  "/events",
  "/gallery",
  "/offline",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Other origins go straight to the network: gallery photos on R2, Google
  // avatars, YouTube thumbnails. The worker never cached them (opaque), and
  // fetching them here would hold them to the worker's own CSP.
  if (new URL(request.url).origin !== self.location.origin) return;

  // Skip non-GET, admin, and API requests
  if (request.method !== "GET") return;
  if (request.url.includes("/admin") || request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for next time
        if (response.ok && response.type === "basic") {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(async () => {
        // Offline — try cache first, then offline page
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.headers.get("accept")?.includes("text/html")) {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
        }

        return new Response("Offline", { status: 503 });
      })
  );
});
