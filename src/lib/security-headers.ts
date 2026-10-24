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
 * - blob: workers: MapLibre starts its tile worker from a blob URL.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://server.arcgisonline.com",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://server.arcgisonline.com https://meridian-crash-report.knowledgetest.workers.dev https://cloudflareinsights.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
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
