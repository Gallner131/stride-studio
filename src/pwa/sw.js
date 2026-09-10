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

  // Network-first, falling back to the cache.
  //
  // This was stale-while-revalidate — `return cached ?? network` — which served the previous
  // build on every visit and refreshed in the background. The app is one HTML file, so that
  // meant the user was permanently one deploy behind, and further behind still if the tab
  // stayed open. Fixes were shipped, verified live, and reported as "nothing has changed",
  // which is exactly what the user was seeing.
  //
  // Offline still works: the cache answers whenever the network does not. The cost is a
  // network round trip on a warm start, for a ~140 KB file, which is the right trade for
  // never showing someone yesterday's app.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          // Tell any page that is already open when the build it is running has been
          // superseded, so a long-lived tab can offer a reload rather than drift.
          const cached = await cache.match(request, { ignoreSearch: true });
          if (cached) {
            const [fresh, old] = await Promise.all([response.clone().text(), cached.text()]);
            if (fresh !== old) {
              const clients = await self.clients.matchAll();
              for (const client of clients) client.postMessage({ type: "update-available" });
            }
          }
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw new Error("offline and not cached");
      }
    }),
  );
});
