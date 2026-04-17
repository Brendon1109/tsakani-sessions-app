// Tsakani Sessions service worker — minimal cache-first with offline fallback
const CACHE_NAME = "tsakani-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  "/services",
  "/shop",
  "/events",
  "/gallery",
  "/offline",
  "/images/tsakani-logo.png",
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
