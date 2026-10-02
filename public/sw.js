/**
 * Meridian service worker — static GitHub Pages build.
 *
 * Design (per Veeresh's requirement): background update polling with a
 * user-approved activation, NEVER an aggressive cache clear or forced
 * reload. Active game states survive until the player taps "Update".
 *
 * Strategy:
 * - install: precache the app shell + offline page under a VERSIONED cache.
 *   No skipWaiting here — the new worker waits until the user approves.
 * - activate: delete only caches from older VERSIONS, then claim clients
 *   (claiming does not reload pages).
 * - fetch:
 *   - navigations → network-first, fall back to cache, then offline.html
 *   - same-origin static assets (JS/CSS/images/data chunks) → cache-first,
 *     populating the cache on network hits (stale-while-revalidate would
 *     also work; cache-first keeps chunk URLs — which are content-hashed —
 *     stable and fast)
 *   - everything else (map tiles, cross-origin) → pass through untouched
 * - message { type: "SKIP_WAITING" } → self.skipWaiting(), sent only from
 *   the in-app "Update available" toast after the user taps it.
 */

const VERSION = "meridian-v1";
const SHELL_CACHE = `meridian-shell-${VERSION}`;
const ASSET_CACHE = `meridian-assets-${VERSION}`;
const OFFLINE_URL = "/Meridian/offline.html";
const START_URL = "/Meridian/";

const SHELL_URLS = [START_URL, OFFLINE_URL, "/Meridian/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // A failed precache must never block installation; runtime caching
        // still covers the shell on first visit.
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith("meridian-shell-") ||
                k.startsWith("meridian-assets-"),
            )
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/Meridian/assets/") ||
    pathname.startsWith("/Meridian/icons/") ||
    pathname === "/Meridian/favicon.svg" ||
    pathname === "/Meridian/manifest.webmanifest" ||
    pathname.startsWith("/Meridian/data/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!isSameOrigin(request.url)) return; // map tiles etc.: untouched

  // Navigations: network-first so a new deploy is picked up; fall back to
  // the cached shell, then the offline page. Never serve a stale shell
  // when the network works.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(START_URL, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(START_URL)
            .then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Versioned static assets: cache-first (content-hashed URLs are immutable).
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Same-origin non-asset requests (build-meta.json, API-ish): network only.
});
