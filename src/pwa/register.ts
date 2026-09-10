// Service worker registration — §9.5.
//
// Best-effort: the app works without it, and a failure here must never stop the app
// loading. The update toast is the page's job, not the worker's.
export function registerServiceWorker(onUpdateAvailable: () => void): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  // file:// has no origin a worker can claim, and testers open the built file directly (§1.3).
  if (window.location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Nothing to do; the app simply will not work offline.
    });
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if ((event.data as { type?: string } | null)?.type === "update-available") onUpdateAvailable();
  });
}
