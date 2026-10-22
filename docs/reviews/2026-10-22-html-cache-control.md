# HTML Cache-Control from the Worker (WI-18, 2026-10-22)

Branch: `fix/html-cache-control` — based on `origin/main` at `76630ba`
(the PR #212 merge). This closes issue #227.

This document is written for a new reader. If you only remember one
thing, remember this: **the file that sets caching for static files
cannot set caching for pages the server draws itself — so the server
now sends that one header itself.**

## The problem, in plain words

Meridian is served by a Cloudflare Worker. When someone visits, the
Worker does not hand back a ready-made HTML file — it *renders* the
page on the spot (TanStack Start server-rendering). That distinction
matters because of one Cloudflare rule:

> `public/_headers` is only applied to **static asset** responses.
> It is never applied to responses produced by Worker code.

So every rule in `_headers` works for files (scripts, images, the
service worker), and none of it ever reaches a rendered page.

### Live evidence (probed 2026-10-22)

Probing the live site, `https://meridian.knowledgetest.workers.dev`:

- `/`, `/privacy`, and the 404 page all carry the **7 security
  headers** (Content-Security-Policy, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
  Cross-Origin-Opener-Policy, Strict-Transport-Security) — but **no
  `Cache-Control` at all**.
- Static files carry their `Cache-Control` from `_headers`, exactly
  as expected.

Why did the security headers arrive but not the caching header? The
security headers are added by a piece of code that runs inside the
Worker for every response — the request middleware in `src/start.ts`.
That is proof the middleware runs live. It simply never set
`Cache-Control`. This change teaches it to.

A page with no `Cache-Control` is not broken, but its caching is left
to whatever a browser or proxy guesses. For a kids' site that ships
updates often, we want one clear, written-down answer: *revalidate
every time, so a deploy is never stuck behind a stale copy.*

## The decision (ADR)

**Rendered HTML gets exactly:**

```
Cache-Control: public, max-age=0, must-revalidate
```

What that means, piece by piece:

- `public` — anyone (browser or shared cache) may store it.
- `max-age=0` — it is stale the moment it arrives…
- `must-revalidate` — …so the browser must check with the server
  before reusing it. A fresh deploy is seen right away, and the
  check itself is cheap (an unchanged page answers "not modified").

**Deliberately no `s-maxage`.** `s-maxage` would let the *edge*
(Cloudflare's shared cache) keep a rendered page and serve it to
other visitors without checking. Rendered pages can carry
per-request state — what is true for one visitor's response is not
automatically safe to hand to the next visitor. Edge caching them
needs the owner's explicit say-so, and he did not give it.

- **Owner ruling (Veeresh, 2026-10-22): "18 go (plain value)"** —
  the plain value above, no `s-maxage`.
- Note the contrast with `_headers`: its `/` rule carries
  `s-maxage=60`, but that rule only ever applied to an *asset-served*
  copy of the document — a copy production does not serve. The rule
  stays in the file as the policy of record for any asset-served
  root; it is not the live behaviour, and its comments now say so.

No new hosts, no third parties, no cookies or identifiers are
involved in this change. It is one response header, set by our own
Worker, at $0 cost.

## The change

Four code/comment surfaces, nothing else:

| File | What changed |
| --- | --- |
| `src/lib/security-headers.ts` | New constant `HTML_CACHE_CONTROL` and new helper `withHtmlCacheControl(response)`. |
| `src/start.ts` | The existing request middleware now runs the response through `withHtmlCacheControl` as well as `withSecurityHeaders`. Nothing else in the file changed — the CSRF middleware is untouched. |
| `src/lib/security-headers.test.ts` | Four new unit tests (see Acceptance, item 4). |
| `public/_headers` | **Comments only.** No rule line or value changed, and the `/*` security block is byte-identical. The comments now tell the truth: the `/` rules cover asset-served copies only, and rendered HTML gets its header from the middleware. |

Plus documentation: this file, one or two sentences in the README's
"Security headers" section, and `BRANCH_STATUS.md`.

### How the rule works

`withHtmlCacheControl` follows the same shape as the existing
`withSecurityHeaders` helper, including its fallback: if a response's
headers cannot be changed (they can be frozen, for example on a
`fetch()` passthrough), it returns a copy with the header added
instead of failing.

It sets the header only when **both** are true:

1. The response's content type starts with `text/html` — it really
   is a rendered document.
2. The response has **no** `Cache-Control` yet.

And it never overrides. That restraint is the point:

- A route that already chose a value keeps it. For example, an HTML
  response carrying `no-store` stays `no-store`.
- Non-HTML responses are returned untouched. JSON, API and error
  responses must stay exactly as their routes set them — for
  example `/api/contact` answers with `no-store`, and this helper
  does not go near it (it is not HTML in the first place).

## Acceptance criteria — how each one is met

The five criteria from the WI-18 handoff:

1. **Rendered pages get exactly one Cache-Control, plus the security
   headers.** The middleware applies `withSecurityHeaders` first,
   then `withHtmlCacheControl`, which adds the single default value
   only when none exists — so there is exactly one, never a doubled
   or comma-joined value. Final proof is the post-merge live probe
   below (owed after the owner merges and the Worker deploys).
2. **Static files are unchanged.** `_headers` changed in comments
   only — verified by diff: every changed line is a `#` comment, the
   `/*` block is byte-identical, and the built
   `dist/client/_headers` is byte-identical to `public/_headers`.
   The drift test (`src/lib/security-headers.test.ts`) and
   `scripts/security-headers.test.mjs` (3/3) still pass.
3. **Non-HTML responses are untouched.** The helper checks the
   content type first and returns anything that is not `text/html`
   exactly as it arrived; a unit test pins this.
4. **Unit tests cover the new behaviour.** Four new tests in
   `src/lib/security-headers.test.ts`: the constant equals the
   literal `public, max-age=0, must-revalidate`; an HTML response
   (`text/html; charset=utf-8`) without a value gets exactly that
   value; an HTML response with `no-store` keeps `no-store`; a JSON
   response without a value still has none afterwards. The existing
   drift test passes unchanged.
5. **Build and end-to-end stay green.** `npm run build:pages` is
   green on this branch (see Gates). The Playwright E2E suite runs
   against the built artifact in the normal pipeline; this change is
   additive response-header logic with no page, route or content
   change, and the post-merge live probe below is the end-to-end
   check on the real Worker.

### Gates on this branch (run 2026-10-22)

- `npx tsc --noEmit` — clean
- `npm test` — scripts **808 pass / 0 fail / 9 skip** (817 tests);
  src **1477 pass / 0 fail** (1473 on main + the 4 new tests)
- `node scripts/lint-cards.mjs` — **GATE PASSED**
- `npm run build:pages` — green; `dist/client/_headers`
  byte-identical to `public/_headers` (diff-verified)

## Risks and rollback

- **Risk is small and one-directional.** The middleware change is
  additive: it only fills in a header that was missing, only on
  HTML, and never replaces a value a route chose. The worst
  realistic outcome is a browser revalidating a page it previously
  guessed it could reuse — which is the intended behaviour.
- **What it does not do:** it does not cache anything at the edge
  (no `s-maxage`), it does not touch `src/server.ts` or the
  server-function guard, and it does not change any Cloudflare or
  wrangler configuration.
- **Rollback:** revert this PR. Nothing is stored anywhere, no data
  changes shape, and the previous behaviour (no `Cache-Control` on
  rendered pages) returns with the revert deploy.

## Post-merge verification (owed after owner merge + deploy)

Run this against the deployed Worker and post the real output on
the PR. Pass = `/`, `/privacy` and the 404 page each show exactly
one `Cache-Control: public, max-age=0, must-revalidate` alongside
the 7 security headers, and a static file still shows its
`_headers` value.

```sh
for path in / /privacy /no-such-page; do
  echo "== $path"
  curl -sI "https://meridian.knowledgetest.workers.dev$path" \
    | grep -i -E '^(HTTP|cache-control|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin-opener-policy|strict-transport-security)'
done

# A static file must be unchanged (its _headers value, not the middleware's):
curl -sI https://meridian.knowledgetest.workers.dev/flags.json | grep -i '^cache-control'
# Expected: Cache-Control: no-cache
```

**The fix is not called done until this probe is reported.**
