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
 *    `/api/contact`, and redirects.
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
