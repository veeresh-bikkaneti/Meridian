# BRANCH_STATUS — fix/html-cache-control

**Branch:** `fix/html-cache-control`
**Base:** origin/main @ `76630ba` (PR #212 merge)
**State: BUILT + PANEL CURE APPLIED — awaiting panel re-vote, then
owner review / merge.** Round-1 panel: NOT READY on record accuracy
only (code approved unanimously; benchmark PASS). The cure round
(canonical-doc currency, "errors untouched" wording, the validator
honesty fix, casing + fallback tests, the `/` drift pin) is applied
on this tip. All gates below are green. The fix is not called done
until the post-merge live probe (Acceptance, below) passes with
verbatim results posted on the PR after the owner merges and the
Worker deploys.

**Owner ruling (Veeresh, 2026-10-22): "18 go (plain value)"** — WI-18
proceeds, with the plain Cache-Control value and no `s-maxage`.
This branch closes issue #227.

## What this fixes, and why

Cloudflare never applies `public/_headers` to Worker-rendered
responses. Every HTML page on the live `meridian` worker is
server-rendered by TanStack, so `/`, `/privacy` and the 404 page
served **no Cache-Control at all** (live-verified 2026-10-22: all 7
security headers present, Cache-Control absent — proof the
`src/start.ts` middleware runs live; it just never set this header).
Static files already carry theirs from `_headers` and are unchanged.

The middleware now also sends, for rendered HTML only:

```
Cache-Control: public, max-age=0, must-revalidate
```

Deliberately **no `s-maxage`**: rendered pages can carry per-request
state, and edge caching them needs the owner's explicit say-so. The
`_headers` `/` rule's `s-maxage=60` only ever applied to an
asset-served copy, which production does not serve.

How it works: `withHtmlCacheControl` (new, in
`src/lib/security-headers.ts`, next to the new `HTML_CACHE_CONTROL`
constant) sets the header only when the response's content type
starts with `text/html` (case-insensitive) **and** it has no
Cache-Control yet. It never overrides an existing value. HTML
responses — including HTML error pages, such as the 404 — get the
default unless they already carry a Cache-Control; non-HTML
responses (e.g. `/api/contact`'s JSON `no-store`) are returned
untouched.

Full write-up: `docs/reviews/2026-10-22-html-cache-control.md`.

## Files touched

- `src/lib/security-headers.ts` — `HTML_CACHE_CONTROL` constant +
  `withHtmlCacheControl` helper (mirrors `withSecurityHeaders`,
  including the immutable-headers copy fallback); top doc note.
  Cure round: docstring states the gate positively (HTML error
  pages included); the content-type check is case-insensitive.
- `src/start.ts` — middleware body now
  `withHtmlCacheControl(withSecurityHeaders(result.response))`;
  header comment extended. CSRF middleware untouched.
- `src/lib/security-headers.test.ts` — 6 new tests (constant equals
  the literal value; HTML without a value gets it; HTML with
  `no-store` keeps it; JSON without a value stays without one;
  mixed-case content type matches; immutable-headers copy fallback).
  The existing drift test is unchanged and still passes.
- `scripts/security-headers.test.mjs` — cure round: one new test
  pinning the asset-served `/` + `/index.html` rules to their
  literal `s-maxage=60` value (drift pin for the deliberate
  divergence from `HTML_CACHE_CONTROL`).
- `public/_headers` — **comments only.** No rule line or value
  changes; the `/*` block is byte-identical. The `/` + `/index.html`
  comment, the honesty note, and the contract-of-record paragraph
  now state that those rules cover asset-served copies only and that
  rendered HTML gets its header from the middleware.
- `docs/security-headers.md` — cure round: the canonical doc brought
  current (delivery table credits the middleware with the HTML
  Cache-Control; caching table gains the rendered-HTML row, marks
  `/` + `/index.html` asset-served only, and states the carved-files
  detach **+ set** truth from PR #212).
- `docs/reviews/2026-10-22-html-cache-control.md` — NEW review/ADR
  doc (problem, live evidence, decision, acceptance mapping,
  risks/rollback, post-merge probe); cure round corrected the
  "cheap 304" claim (no validator is set) and the error-page wording.
- `README.md` — "Security headers" section only: one added sentence
  on the middleware's HTML Cache-Control.
- `BRANCH_STATUS.md` — this file (replaces main's #212 record).

Not touched (per brief): `src/server.ts`,
`src/lib/server/server-fn-guard.ts`, any wrangler/Cloudflare config.

## Gates (this branch, run 2026-10-22)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts **809 pass / 0 fail / 9 skip** (818 tests;
      main baseline 808 + the cure-round drift pin);
      src **1479 pass / 0 fail** (main baseline 1473 + 6 new tests)
- [x] `node scripts/lint-cards.mjs` — **GATE PASSED**
- [x] `npm run build:pages` — green; `dist/client/_headers`
      byte-identical to `public/_headers` (diff-verified);
      `scripts/security-headers.test.mjs` passes 4/4 against the
      comment-updated `_headers`

## Acceptance — post-merge live probe (still owed)

- [ ] Owner's review + merge word
- [ ] After deploy, probe https://meridian.knowledgetest.workers.dev
      and post the verbatim output on the PR (commands in
      `docs/reviews/2026-10-22-html-cache-control.md`):
      `/`, `/privacy` and a 404 path must each show exactly one
      `Cache-Control: public, max-age=0, must-revalidate` alongside
      the 7 security headers, and a static file (e.g. `/flags.json`,
      `no-cache`) must be unchanged.
      `/_shell.html` is **expected-inert** in this probe (definition
      carried from the #212 record, which `public/_headers` cites):
      it exists in the build output, but the app server answers 404
      for it today — the same signature `/` had — so a bare or 404
      result for it is expected, not a failure.
      **The fix is not done until this probe is reported.**
