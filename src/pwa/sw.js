// Tombstone worker — §9.5 is on hold.
//
// The caching worker served the previously-deployed build on every visit, so fixes shipped
// and verified live were reported, correctly, as "I refreshed and nothing is different".
// A worker already installed in a browser keeps control until it is removed, so this exists
// to remove it: any browser that still checks for an update gets this, which deletes every
// cache and unregisters itself. src/pwa/register.ts does the same from the page side.
//
// Offline support went with it. It should come back when the app is worth keeping offline.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      await self.registration.unregister();
      // Reload any open page, so it stops being served by a worker that no longer exists.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});

// Never intercept a request. Everything, including /api/, goes straight to the network.
