# BRANCH_STATUS — fix/html-cache-control

**Branch:** `fix/html-cache-control`
**Base:** origin/main @ `76630ba` (PR #212 merge)
**State: BUILT — awaiting owner review / merge.** All gates below are
green on this branch. The fix is not called done until the post-merge
live probe (Acceptance, below) passes with verbatim results posted on
the PR after the owner merges and the Worker deploys.

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
starts with `text/html` **and** it has no Cache-Control yet. It never
overrides an existing value, and non-HTML responses (JSON / API /
errors — e.g. `/api/contact`'s `no-store`) are returned untouched.

Full write-up: `docs/reviews/2026-10-22-html-cache-control.md`.

## Files touched

- `src/lib/security-headers.ts` — `HTML_CACHE_CONTROL` constant +
  `withHtmlCacheControl` helper (mirrors `withSecurityHeaders`,
  including the immutable-headers copy fallback); top doc note.
- `src/start.ts` — middleware body now
  `withHtmlCacheControl(withSecurityHeaders(result.response))`;
  header comment extended. CSRF middleware untouched.
- `src/lib/security-headers.test.ts` — 4 new tests (constant equals
  the literal value; HTML without a value gets it; HTML with
  `no-store` keeps it; JSON without a value stays without one).
  The existing drift test is unchanged and still passes.
- `public/_headers` — **comments only.** No rule line or value
  changes; the `/*` block is byte-identical. The `/` + `/index.html`
  comment, the honesty note, and the contract-of-record paragraph
  now state that those rules cover asset-served copies only and that
  rendered HTML gets its header from the middleware.
- `docs/reviews/2026-10-22-html-cache-control.md` — NEW review/ADR
  doc (problem, live evidence, decision, acceptance mapping,
  risks/rollback, post-merge probe).
- `README.md` — "Security headers" section only: one added sentence
  pair on the middleware's HTML Cache-Control.
- `BRANCH_STATUS.md` — this file (replaces main's #212 record).

Not touched (per brief): `src/server.ts`,
`src/lib/server/server-fn-guard.ts`, any wrangler/Cloudflare config.

## Gates (this branch, run 2026-10-22)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts **808 pass / 0 fail / 9 skip** (817 tests);
      src **1477 pass / 0 fail** (main baseline 1473 + 4 new tests)
- [x] `node scripts/lint-cards.mjs` — **GATE PASSED**
- [x] `npm run build:pages` — green; `dist/client/_headers`
      byte-identical to `public/_headers` (diff-verified);
      `scripts/security-headers.test.mjs` passes 3/3 against the
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
      **The fix is not done until this probe is reported.**
