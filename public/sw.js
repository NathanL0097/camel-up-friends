const CACHE_NAME = "friends-tabletop-shell-v8";
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/socket.io/socket.io.js",
  "/styles.css",
  "/games/mobile-responsive.css",
  "/game-ui-system.css?v=20260904-2",
  "/product-quality.css?v=20260906-1",
  "/platform-audio.js",
  "/game-art.js",
  "/game-moments.js",
  "/room-identities.js",
  "/assets/game-marks.svg",
  "/assets/western-landscape.svg",
  "/assets/avalon-arch.svg",
  "/assets/salem-woodcut.svg",
  "/assets/casino-deco.svg",
  "/assets/race-poster.svg",
  "/pwa.js",
  "/manifest.webmanifest",
  "/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("friends-tabletop-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const navigation = request.mode === "navigate";
  const staticAsset = ["script", "style", "image", "font", "manifest"].includes(request.destination);
  // Never store API responses, room credentials, or Socket.IO transports.
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") ||
      (url.pathname.startsWith("/socket.io/") && url.pathname !== "/socket.io/socket.io.js") ||
      (!navigation && !staticAsset)) return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && staticAsset) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      if (navigation) return (await cache.match("/index.html")) || Response.error();
      // HTML returned as JavaScript/CSS causes misleading parse errors offline.
      return Response.error();
    })
  );
});
