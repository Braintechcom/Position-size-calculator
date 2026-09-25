/*
    Service worker for the Position Size Calculator PWA.

    Strategy:
    - App shell (HTML/CSS/JS/icons/manifest) is cached on install
      and served cache-first, so the calculator itself works fully
      offline.
    - The live FX rate API call (open.er-api.com) is NOT cached
      here — it's a network-only fetch made directly from the
      page. If the device is offline, that fetch fails and the
      app already shows a "use manual rate" fallback.
*/

const CACHE_NAME = "position-size-calc-v1";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", (event) => {

    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", (event) => {

    const url = new URL(event.request.url);

    // Never intercept the live FX rate API — always go to network.
    if (url.hostname === "open.er-api.com") {
        return;
    }

    // Only handle GET requests for same-origin app shell files.
    if (event.request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {

            if (cached) {
                return cached;
            }

            return fetch(event.request)
                .then((response) => {

                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, clone);
                        });
                    }

                    return response;
                })
                .catch(() => {
                    // Fallback to the app shell for navigation requests offline.
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                });
        })
    );
});
