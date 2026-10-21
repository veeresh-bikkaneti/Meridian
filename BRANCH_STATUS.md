# BRANCH_STATUS — fix/headers-explicit-cache

**State: REBASED onto current main (2026-10-22) with the `_headers`
union applied (below). The panel re-vote on the pre-rebase tip was
READY, with this union pre-adjudicated in that vote; awaiting the
owner's merge word. The fix is not called done until the post-merge
live probe (Acceptance, below) passes with verbatim results.**

**Base:** origin/main @ `05916f8` (after #207, #222 and #226 merged) —
rebased 2026-10-22 by Chitti on the owner's explicit order (rebase +
force-push, the #207 exception pattern). Conflicts: `public/_headers`
and this file. This file was resolved by keeping this branch's own
record and updating this section. (An earlier mechanical rebase
during the 2026-10-21 panel pipeline, from `41e1121` onto `b430d28`,
is superseded by this one.)

**Owner ruling (Veeresh, 2026-10-21, verbatim): "Fix with explicit
header lines"** — his decision on the PR #203 post-deploy probe caveat.

## What this fixes

PR #203 gave content-hashed `/assets/*` an immutable Cache-Control rule
and carved the three stable-named mutable files out of it with
Cloudflare's `! Cache-Control` detach, on the theory that the platform
default (`public, max-age=0, must-revalidate`) would resume for them.
The post-deploy probe disproved the theory: the detach deletes the
response's Cache-Control outright — the platform default is part of the
response being edited — so the three carved files shipped with **no
Cache-Control at all** (ETag only), and the HTML at `/` served no
Cache-Control and no validator. This branch reworks `public/_headers`
so the carved files and the HTML documents carry **explicit**
`Cache-Control: public, max-age=0, must-revalidate` lines that actually
take effect, while hashed `/assets/*` keep exactly the immutable rule.

## Why the construction cannot comma-join

Semantics — Cloudflare Workers docs
(developers.cloudflare.com/workers/static-assets/headers/), confirmed
against the production asset-worker source (cloudflare/workers-sdk,
`asset-worker/src/utils/headers.ts` `attachCustomHeaders` +
`utils/rules-engine.ts`) and the 2026-10-21 live probes:

- A request inherits the headers of **every** matching rule; rules are
  stored keyed by URL pattern (so **one block per path** — a second
  block for the same path is not a separate rule) and applied **in file
  order**; **within one rule, detachments run before sets**.
- The **first** Cache-Control set from the file **replaces** the
  response's current value (which is how the wildcard's set replaces
  the platform default today — live-verified: hashed assets serve
  `immutable` alone). A **second** set **appends** (comma-join) — unless
  a detach has emptied the header in between.
- Each carved block therefore pairs `! Cache-Control` with the explicit
  set in the **same block**: the wildcard's immutable value is deleted
  first, and the set then stands alone as the path's only Cache-Control
  value. No other rule in the file sets Cache-Control for those paths.

## Effective Cache-Control by path class

| Path class | Rules matched | Before (live probe, 2026-10-21, build `41e1121`) | After this PR (derived) |
|---|---|---|---|
| Hashed `/assets/*` (JS/CSS/fonts) | `/assets/*` set | `public, max-age=31536000, immutable` ✓ | unchanged — `public, max-age=31536000, immutable` |
| `/assets/maplibre-gl-worker.mjs` | wildcard set → carved detach+set | **none** (ETag only) | `public, max-age=0, must-revalidate` (sole value) |
| `/assets/maplibre-gl-shared.mjs` | wildcard set → carved detach+set | **none** (ETag only) | `public, max-age=0, must-revalidate` (sole value) |
| `/assets/storyteller/storyteller-assets.json` | wildcard set → carved detach+set | **none** (ETag only) | `public, max-age=0, must-revalidate` (sole value) |
| `/flags.json` | own set (first set) | `public, max-age=0, must-revalidate` (platform default) | `no-cache` — main's explicit rule wins in the union (stricter; a kill switch must never be served stale) |
| `/` (root document) | own set | **none**, no ETag/Last-Modified | rule present — see honesty note below; probe decides |
| `/offline`, `/offline.html` | own sets | platform default `must-revalidate` (asset-served; `/offline.html` 307s to `/offline`) | unchanged value, now explicit |
| `/_shell.html` | own set | **404 from the app server** (live probe 2026-10-21 — no ETag, no CF-Cache-Status; the same signature as `/`) | rule kept as **policy of record**; expected-inert until the path is asset-served (see Acceptance) |
| Everything else — `/audio/*`, `/icons/*`, `/images/*`, `/loop/*`, `/__grok/*`, `favicon.svg`, `og.jpg`, `x-banner.jpg`, `scout-fallback.svg` | **no rule** | platform default `public, max-age=0, must-revalidate` + ETag (samples live-verified) | unchanged — deliberately no rule (see the file's comments). (`/sw.js`, `/build-meta.json` and `/manifest.webmanifest` are NOT in this class: they carry main's explicit `no-cache` rules, kept by the union.) |

**Honesty note on `/`:** the root document is currently rendered by the
app server, not served as a static asset — its live response carries
neither the ETag nor the CF-Cache-Status header the asset server always
adds, and `_headers` only attaches to asset responses. The `/` rule is
included so the policy lives in one place and takes effect for any
asset-served root, but it likely cannot reach the server-rendered
document on the Cloudflare host today. The post-merge probe decides:
if `/` is still bare after this lands, the remainder is a **server-side
header**, which is out of this PR's scope and flagged for the owner.

**Honesty note on `/_shell.html`:** the file exists in the build
output, but the live path is answered by the app server with a 404 —
`_headers` cannot reach it today, the same limitation as `/`. The rule
stays as policy of record, and the Acceptance probe below defines a
bare/404 result for it as expected-inert.

## Probe findings recorded for the owner (no action in this PR)

- **`/audio/*` and `/icons/*` do NOT share the no-header condition.**
  Samples probed live 2026-10-21 (`/audio/storyteller/greet-01.mp3`,
  `/icons/icon-192.png`): `Cache-Control: public, max-age=0,
  must-revalidate` + ETag, CF-Cache-Status HIT — the platform default
  reaches them because no rule ever detached it. Nothing touched; they
  must never become immutable (stable names, mutable content).
- Correction to the #203-era record: `/flags.json`'s correct header was
  the **platform default**, not an explicit line — the old file had no
  flags rule. It has one now (same value, made explicit).

## Test pins

Searched `src/`, `tests/`, `scripts/`, `workers/` and `vite.config.ts`
for `_headers` / `Cache-Control` pins: **none exist** — nothing to
update. No new pin added; the post-merge live probe is the acceptance
mechanism.

## PR #207 collision — RESOLVED by the 2026-10-22 union

#207 landed first (squash `36bad5e`), then #222 (`1ca4c04`) and #226
(`05916f8`). The rebase above unioned the two `_headers` files on the
panel re-vote's pre-adjudicated terms: the `/*` security block is
byte-identical to main's; where both files set the same path, **main's
value wins and appears exactly once** (`/flags.json` is `no-cache` —
a kill switch must never be served stale; `/` and `/index.html` keep
main's `s-maxage=60` edge line); this branch contributes the
**detach+set form** on the three carved `/assets/` paths and the
`/offline`, `/offline.html` and `/_shell.html` rules. Two comment
corrections the re-vote ordered were applied in the same resolution:
the "deliberately no rule" list no longer names `/sw.js`,
`/build-meta.json` or `/manifest.webmanifest` (they carry explicit
no-cache rules), and the carved-blocks comment no longer repeats the
disproven "detach alone, platform default then applies" theory.

## Cure round (panel round 1 on `18bcd45`: NOT READY, BLOCK ×1)

Office Hours blocked on a record defect: this file's table and the
`_headers` comment claimed `/_shell.html` was asset-served and
covered, but live it answers 404 from the app server (like `/`), and
the Acceptance definition had no pass/fail meaning for that path.
The construction itself verified completely — the comma-join
derivation was re-derived from the asset-worker source by the
coordinator and three seats, and no served path's final value is
joined, doubled, or wrong. Cure (docs/comments only, no rule
change): the `/_shell.html` honesty is now mirrored in the
`_headers` comment and the table above, the Acceptance definition
gained the expected-inert rule for it, and the PR #207 note was
strengthened from "union" to per-pattern adjudication (plus the
union warning now lives inside `_headers` itself). The cured tip
returned for a rule-13 panel re-vote, which returned READY.

## Gates (this branch, 2026-10-21)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts **790 pass / 0 fail / 9 skip** (799 tests);
      src **1,399 pass / 0 fail** — baseline-exact
- [x] `node scripts/lint-cards.mjs` — **GATE PASSED**
- [x] `npm run build:pages` — green; `dist/client/_headers`
      byte-identical to the new `public/_headers` (diff-verified);
      dist enumeration confirms the only non-hashed files under
      `/assets` are the three carved files, and the only HTML documents
      in the output are `_shell.html` and `offline.html`

## Acceptance — post-merge live probe (the hard gate)

- [x] Panel review of this PR → READY (rule-13 re-vote on the cured
      tip; the 2026-10-22 rebase applied that vote's pre-adjudicated
      union — see State, above)
- [ ] Owner's merge word
- [ ] After deploy, probe **every path class** on
      https://meridian.knowledgetest.workers.dev and record verbatim
      results: a hashed asset, all three carved files, `/flags.json`,
      `/`, `/offline`, `/offline.html`, `/_shell.html`,
      `/build-meta.json`, one `/audio/*`, one `/icons/*`, `/sw.js`.
      Pass = carved files show exactly `Cache-Control: public,
      max-age=0, must-revalidate` as a **single value** (no comma-join,
      no `immutable` remnant), hashed assets still immutable, and the
      `/` result decides whether a server-side follow-up is needed.
      For `/_shell.html`, a 404 or header-less response is
      **expected-inert (a pass)** — the app server answers that path
      today, so the rule cannot take effect until it is asset-served;
      only an asset-served `/_shell.html` would be judged on its
      Cache-Control value.
      **The fix is not done until this probe is reported.**
- [ ] Header-cure update to this file after merge (standard pattern)
