// Minimal service worker for AziralPDF.
//
// Its only job is to satisfy the browser's PWA installability criteria so the
// "Install to computer" button in Settings works (Chromium fires
// `beforeinstallprompt` only when a service worker with a fetch handler is
// registered).
//
// It is deliberately network-only: it does NOT cache any assets. This avoids
// the classic PWA footgun of serving a stale build after a deploy.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler must exist for installability, but we intentionally let every
// request fall through to the network untouched (no caching).
self.addEventListener("fetch", () => {});
