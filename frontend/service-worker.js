self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== "smart-tools-hub-v8").map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("smart-tools-hub-v8").then((cache) => cache.addAll([
      "/",
      "/index.html",
      "/advertise.html",
      "/tool.html",
      "/css/index.css",
      "/css/monetization.css",
      "/css/tool.css",
      "/js/main.js",
      "/js/monetization.js",
      "/js/tool.js",
      "/js/analytics.js"
    ]))
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open("smart-tools-hub-v8").then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
