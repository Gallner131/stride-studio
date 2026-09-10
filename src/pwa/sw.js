// Service worker — §9.5.
//
// Precaches the single-file app so it opens offline and instantly. Deliberately minimal:
// there is one HTML file and no runtime asset fetches (fonts are inlined, photos are local),
// so a cache-first shell plus stale-while-revalidate is the whole story.

const CACHE = "stride-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never intercept cross-origin requests, and never cache the Strava token endpoints.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Stale-while-revalidate: serve the cached shell immediately, refresh in the background,
  // and tell the page when a genuinely new version has arrived (§9.5).
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });

      const network = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const copy = response.clone();
            await cache.put(request, response.clone());
            if (cached) {
              const [fresh, old] = await Promise.all([copy.text(), cached.clone().text()]);
              if (fresh !== old) {
                const clients = await self.clients.matchAll();
                for (const client of clients) client.postMessage({ type: "update-available" });
              }
            }
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    }),
  );
});
