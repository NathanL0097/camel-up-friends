const CACHE_NAME = "friends-tabletop-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/games/mobile-responsive.css",
  "/games/casino-night.css",
  "/games/casino-night.js",
  "/pwa.js",
  "/manifest.webmanifest",
  "/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin || request.url.includes("/socket.io/")) return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && request.url.endsWith("/")) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});
