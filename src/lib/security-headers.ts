/**
 * Security response headers. This is the ONE source of truth (review
 * follow-up on #207, 2026-10-21).
 *
 * Two delivery paths need the same headers:
 *
 * 1. Static assets. Cloudflare Workers static assets read
 *    `public/_headers` (copied to `dist/client/_headers`).
 * 2. Worker-generated responses. Cloudflare documents that `_headers` is
 *    NOT applied to responses produced by Worker code. On the live
 *    `meridian` worker, `/` and every route are server-rendered by TanStack
 *    Start, so the HTML only gets these headers if the worker adds them.
 *    `src/start.ts` registers `securityHeadersMiddleware` (below), which
 *    adds them to every response from the TanStack handler: SSR HTML,
 *    `/api/contact`, and redirects. The middleware also adds the default
 *    Cache-Control to rendered HTML (see `HTML_CACHE_CONTROL` below),
 *    because `_headers` never reaches those Worker responses either.
 *
 * `src/lib/security-headers.test.ts` parses `public/_headers` and fails if
 * its `/*` block drifts from SECURITY_HEADERS. Edit both together.
 *
 * The per-path Cache-Control rules in `_headers` have the same treatment:
 * PATH_CACHE_CONTROL mirrors them, and the test simulates that file and
 * fails on drift. `src/start.ts` applies the path rule to Worker
 * responses; `src/server.ts` does not, because its guard responses are
 * errors, not cacheable assets.
 *
 * CSP notes:
 * - script-src 'unsafe-inline' is still needed. TanStack Start's
 *   dehydration script is inline and changes with every SSR response (it
 *   carries per-request router state and timestamps), so no build-time
 *   hash can match it. The way out on the worker is a per-request nonce,
 *   which is tracked as a follow-up.
 * - static.cloudflareinsights.com / cloudflareinsights.com: the optional
 *   cookieless Cloudflare Web Analytics beacon, the ONLY analytics allowed.
 * - server.arcgisonline.com: Esri satellite and label tiles.
 * - meridian-crash-report.knowledgetest.workers.dev: first-party crash
 *   ingest. The contact form posts to /api/contact on this same worker,
 *   which 'self' covers.
 * - veeresh-bikkaneti.github.io: the journal movie clips (meridian-media
 *   Pages). media-src lets the <video> element load them; connect-src lets
 *   journal prefetch fetch() them. Without both, CSP blocks journal movies
 *   in production — the player shows the still, prefetch silently warms
 *   nothing.
 * - api.github.com: the /board page fetches public pull-request state
 *   from the GitHub REST API (no auth, no token). Nothing else about
 *   the board leaves the browser.
 *
 * - blob: workers: MapLibre starts its tile worker from a blob URL.
 * - challenges.cloudflare.com: the Cloudflare Turnstile widget (script +
 *   iframe) for the grown-ups feature-request form. The script is loaded
 *   only by src/board/feature-request-form.tsx, i.e. only on /board —
 *   the game's pages never request it.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://server.arcgisonline.com",
  "font-src 'self' data:",
  "media-src 'self' data: blob: https://veeresh-bikkaneti.github.io",
  "connect-src 'self' https://server.arcgisonline.com https://meridian-crash-report.knowledgetest.workers.dev https://cloudflareinsights.com https://veeresh-bikkaneti.github.io https://api.github.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob: https://challenges.cloudflare.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** Header name → value, in the order `public/_headers` lists them. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
});

/**
 * The Cache-Control every rendered HTML page should carry.
 *
 * Rendered HTML never passes through `public/_headers` — Cloudflare only
 * applies that file to static assets — so the Worker itself has to send
 * this, from the request middleware in `src/start.ts`.
 *
 * ADR note: this is deliberately the plain value, with no `s-maxage`.
 * Rendered pages can carry per-request state, and letting an edge cache
 * hold them needs the owner's explicit say-so. The owner chose the plain
 * value on 2026-10-22 (WI-18). The `_headers` `/` rule's `s-maxage=60`
 * only ever applied to an asset-served copy of the document, which
 * production does not serve.
 */
export const HTML_CACHE_CONTROL = "public, max-age=0, must-revalidate";

/**
 * The Cache-Control for content-hashed build assets (`/assets/*`).
 *
 * Any path under `/assets/` that is not listed in PATH_CACHE_CONTROL
 * below carries this value: a hashed URL never changes content, so it
 * is immutable for a year. `public/_headers` says the same thing with
 * its `/assets/*` rule; the test compares the two.
 */
export const ASSETS_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Per-path Cache-Control, mirroring `public/_headers` (Phase 5.3).
 *
 * Exact paths only — the `/assets/*` wildcard above is the one prefix
 * rule, handled by `getPathCacheControl`. Every value here is copied
 * verbatim from `_headers`; the test simulates that file and fails on
 * drift, so edit both together.
 *
 * The `/` and `/index.html` rows carry `s-maxage=60`, but only for an
 * ASSET-served copy of the document. A Worker-rendered page must never
 * see it (owner rule, WI-18): `withPathCacheControl` skips HTML
 * responses, and the middleware runs it after `withHtmlCacheControl`,
 * which has already set the plain HTML value.
 */
export const PATH_CACHE_CONTROL: Readonly<Record<string, string>> = Object.freeze({
  "/assets/maplibre-gl-worker.mjs": "public, max-age=0, must-revalidate",
  "/assets/maplibre-gl-shared.mjs": "public, max-age=0, must-revalidate",
  "/assets/storyteller/storyteller-assets.json": "public, max-age=0, must-revalidate",
  "/sw.js": "no-cache",
  "/flags.json": "no-cache",
  "/build-meta.json": "no-cache",
  "/manifest.webmanifest": "no-cache",
  "/": "public, max-age=0, s-maxage=60, must-revalidate",
  "/index.html": "public, max-age=0, s-maxage=60, must-revalidate",
  "/offline": "public, max-age=0, must-revalidate",
  "/offline.html": "public, max-age=0, must-revalidate",
  "/_shell.html": "public, max-age=0, must-revalidate",
});

/**
 * The Cache-Control `public/_headers` would serve for `pathname`, or
 * `undefined` when no rule covers it (then the platform default applies
 * and this module stays silent). An exact table entry wins; otherwise
 * any path under `/assets/` gets the hashed-asset value.
 */
export function getPathCacheControl(pathname: string): string | undefined {
  const exact = PATH_CACHE_CONTROL[pathname];
  if (exact !== undefined) return exact;
  if (pathname.startsWith("/assets/")) return ASSETS_CACHE_CONTROL;
  return undefined;
}

/**
 * Add the security headers to a response. A header the route already set
 * is left alone, so a route can opt into something stricter. If the
 * response's headers are immutable (for example a fetch() passthrough), a
 * copy with the headers added is returned instead.
 */
export function withSecurityHeaders(response: Response): Response {
  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!headers.has(name)) headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

/**
 * Add the per-path Cache-Control to a Worker response.
 *
 * Only non-HTML responses without a Cache-Control yet: an HTML
 * response keeps the default `withHtmlCacheControl` sets (the plain
 * value, never the asset-served `s-maxage=60` row), a response the
 * route already labelled keeps its own value, and a path with no rule
 * (for example `/audio/*`, deliberately unlisted in `_headers`) is
 * left to the platform default. If the response's headers are
 * immutable, a copy is returned instead.
 */
export function withPathCacheControl(response: Response, pathname: string): Response {
  try {
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html") && !response.headers.has("cache-control")) {
      const value = getPathCacheControl(pathname);
      if (value !== undefined) response.headers.set("cache-control", value);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    const contentType = (headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html") && !headers.has("cache-control")) {
      const value = getPathCacheControl(pathname);
      if (value !== undefined) headers.set("cache-control", value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

/**
 * Add the default Cache-Control to a rendered HTML response.
 *
 * Only rendered documents get the default: a response whose content
 * type starts with `text/html` and which has no Cache-Control yet.
 * HTML responses — including HTML error pages, such as the 404 page —
 * get the default unless they already carry a Cache-Control. Non-HTML
 * responses are returned untouched: JSON and API responses (for
 * example `/api/contact`'s `no-store`) stay exactly as their routes
 * set them, and an existing Cache-Control is never overridden.
 * Content-Type values are case-insensitive (RFC 9110), so the check
 * lowercases before comparing. If the response's headers are
 * immutable, a copy is returned instead.
 */
export function withHtmlCacheControl(response: Response): Response {
  try {
    if (
      (response.headers.get("content-type") ?? "").toLowerCase().startsWith("text/html") &&
      !response.headers.has("cache-control")
    ) {
      response.headers.set("cache-control", HTML_CACHE_CONTROL);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    if ((headers.get("content-type") ?? "").toLowerCase().startsWith("text/html") && !headers.has("cache-control")) {
      headers.set("cache-control", HTML_CACHE_CONTROL);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}
