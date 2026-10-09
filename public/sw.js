/**
 * Meridian service worker — static GitHub Pages build.
 *
 * Design (per Veeresh's requirement): background update polling with a
 * user-approved activation, NEVER an aggressive cache clear or forced
 * reload. Active game states survive until the player taps "Update".
 *
 * VERSION carries the build id, stamped in by scripts/fingerprint-sw.mjs
 * (postbuild:pages) — never edit the __BUILD_ID__ placeholder by hand.
 * Browsers detect SW updates by byte-comparing this file, so a fresh
 * VERSION per deploy is what makes the update toast fire at all. It also
 * versions the cache names, so each deploy gets clean caches.
 *
 * Strategy:
 * - install: precache the app shell + offline page under a VERSIONED cache.
 *   No skipWaiting here — the new worker waits until the user approves.
 * - activate: delete only caches from older VERSIONS, then claim clients
 *   (claiming does not reload pages).
 * - fetch:
 *   - navigations → network-first, fall back to cache, then offline.html
 *   - /Meridian/flags.json → network-first with a small versioned cache,
 *     fall back to the cached flags only when the network fails. A remote
 *     kill decision must propagate immediately — never serve a stale
 *     flags.json when the network works, even for clients whose SW update
 *     is still waiting (see note below).
 *   - same-origin static assets (JS/CSS/images/data chunks, home-page comet
 *     TTS audio, __grok PWA assets, loop edition data) → cache-first,
 *     populating the cache on network hits (stale-while-revalidate would
 *     also work; cache-first keeps chunk URLs — which are content-hashed —
 *     stable and fast).
 *     Loop clue data (/Meridian/loop/, ~13 MB total) is cache-first at
 *     RUNTIME only — the whole deck is deliberately NOT precached at install
 *     (too big for a background install, especially on the older devices
 *     this game targets). Only loop/manifest.json (60 bytes) is precached
 *     so resume + search always work offline; clues and loop/names.json
 *     (11.5 MB) populate the cache on first online use and are then fully
 *     playable offline.
 *   - everything else (map tiles, cross-origin) → pass through untouched
 *   - same-origin non-asset, non-flags requests (build-meta.json, API-ish)
 *     → network only. Note: service workers deployed BEFORE this rule
 *     handle flags.json with this network-default fallback, so a remote
 *     kill decision still reaches old clients whenever they are online —
 *     they just lose the offline-cache fallback until their SW updates.
 * - message { type: "SKIP_WAITING" } → self.skipWaiting(), sent only from
 *   the in-app "Update available" toast after the user taps it.
 */

const VERSION = "meridian-__BUILD_ID__";
const SHELL_CACHE = `meridian-shell-${VERSION}`;
const ASSET_CACHE = `meridian-assets-${VERSION}`;
const FLAGS_CACHE = `meridian-flags-${VERSION}`;
const OFFLINE_URL = "/Meridian/offline.html";
const START_URL = "/Meridian/";
const FLAGS_URL = "/Meridian/flags.json";

const SHELL_URLS = [START_URL, OFFLINE_URL, "/Meridian/manifest.webmanifest"];

// Tiny loop bootstrap files precached at install so resume + search work
// offline even before the loop screen is ever opened. Deliberately NOT the
// whole /Meridian/loop/ deck: clues (~1.5 MB) and names.json (11.5 MB) are
// runtime-cached on first online use instead (see the strategy note above).
const LOOP_PRECACHE_URLS = ["/Meridian/loop/manifest.json"];
// Storyteller home handoff (H1): runtime-cache preferred over install
// precache for oldest devices. Install-precache ONLY the idle pose +
// greet-01 mp3; the pointing pose + greet-02…06 mp3s lazy-load via the
// runtime cache-first static-asset handler below (isStaticAsset covers
// /Meridian/audio/, /Meridian/images/ and /Meridian/assets/).
// Each asset is added individually so one missing file (e.g. greet-01.mp3
// before the TruthTeller voice lands) never blocks the others.
const STORYTELLER_H1_PRECACHE_URLS = [
  "/Meridian/images/storyteller/storyteller.jpg",
  "/Meridian/audio/storyteller/greet-01.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // A failed precache must never block installation; runtime caching
        // still covers the shell on first visit.
      })
      .then(() => caches.open(ASSET_CACHE))
      .then((cache) => cache.addAll(LOOP_PRECACHE_URLS))
      .catch(() => {
        // Same fail-soft rule: a missing manifest at install time must not
        // block the worker; the runtime cache-first handler covers it.
      }),
  );
  // Best-effort: the storyteller H1 assets land in the versioned asset
  // cache so the home greeting works offline. A failure here must never
  // block installation — and one missing asset must not block the others.
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) =>
      Promise.allSettled(
        STORYTELLER_H1_PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {}),
        ),
      ),
    ),
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
                k.startsWith("meridian-assets-") ||
                k.startsWith("meridian-flags-"),
            )
            .filter(
              (k) =>
                k !== SHELL_CACHE && k !== ASSET_CACHE && k !== FLAGS_CACHE,
            )
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
    // Home-page comet greeting TTS (synthesized SFX needs no caching —
    // only this TTS audio is a real file).
    pathname.startsWith("/Meridian/audio/") ||
    // Storyteller H1 poses + storyteller-assets.json manifest: runtime
    // cache-first (lazy-load; only the idle pose is install-precached).
    pathname.startsWith("/Meridian/images/") ||
    // __grok PWA install-page assets.
    pathname.startsWith("/Meridian/__grok/") ||
    // Loop edition data: runtime cache-first only (see install — the deck
    // itself is never precached; clues/names.json populate on first use).
    // NOTE: fetchJson uses `cache: "no-store"`; that does NOT bypass the
    // service worker — the fetch event still fires, caches.match() still
    // hits, and the network response is still cached. Verified by the
    // offline Playwright spec (tests/e2e/offline-content.spec.ts).
    pathname.startsWith("/Meridian/loop/") ||
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
          // Only cache successful responses — a 404 shell must never
          // become the offline fallback.
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(START_URL, copy));
          }
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

  // Feature flags: network-first. A remote kill decision must reach
  // clients immediately — never serve a stale cached flags.json when the
  // network works. Fall back to the last-known flags only when the network
  // fails (offline), and the page itself falls back to its baked-in
  // defaults when even that is absent. The response is cached on success
  // so the offline fallback exists.
  if (url.pathname === FLAGS_URL) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(FLAGS_CACHE).then((c) => c.put(FLAGS_URL, copy));
          }
          return res;
        })
        .catch(() => caches.match(FLAGS_URL)),
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
