/* Velocity Trade service worker — minimal, install-enabling, network-first. */
const CACHE = "vt-static-v2";
const SHELL = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
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
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // HTML and versioned modules must come from the current deployment. Never
  // serve an old app shell or substitute HTML for a missing JavaScript chunk.
  if (!SHELL.includes(url.pathname)) return;
  // Never cache API / server-function traffic.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_serverFn")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? Response.error())),
  );
});
