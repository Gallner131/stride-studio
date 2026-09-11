// Service worker — removed, deliberately. §9.5 is on hold.
//
// The worker cached the app shell. That is the right thing for a finished product and the
// wrong thing for one being changed several times a day: it served the previous build on
// every visit, so fixes were shipped, verified live, and reported as "I refreshed and
// nothing is different" — because nothing was. Switching it to network-first did not help
// enough either, because a worker already installed in someone's browser keeps control
// until it is explicitly removed.
//
// So this now does the opposite of registering: it removes any worker still installed and
// deletes every cache it left behind. Offline support goes with it. That is a real loss and
// it should come back — but not before the app is worth keeping offline, and not before
// there is a way to tell which build is on screen. Hence the build stamp in the header.
export function unregisterServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
    .catch(() => {
      // Nothing to do. The app works without this; it just may be a build behind once more.
    });

  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {});
  }
}
