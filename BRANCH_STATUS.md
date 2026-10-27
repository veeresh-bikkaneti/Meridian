# BRANCH_STATUS — fix/234-crash-worker-dev-boot

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#234)

`npx wrangler dev -c wrangler.toml` in `workers/crash-report` could
not boot: workerd validates every named export of the entry module
as a handler, and `src/index.ts` exports plain constants
(`ANOMALY_MIN_COUNT = 3`, plus seven more primitives and several
arrays) alongside the handler for its unit tests — the boot died on
the alphabetically first one. De-exporting them one by one would be
whack-a-mole and would break the tests that import four of them.

Fix (structural, local-dev only):

- New `workers/crash-report/src/dev-entry.ts`: a thin wrapper that
  re-exports only the default handler.
- `wrangler.toml`: `main` now points at `src/dev-entry.ts`, with a
  comment explaining why. Production never reads this file — a
  release bundles `src/index.ts` directly and uploads it through
  the API (README, "The release, step by step"), so production is
  untouched.
- README Files section documents the wrapper.

## Files

- `workers/crash-report/src/dev-entry.ts` (new)
- `workers/crash-report/wrangler.toml` (`main` + comment)
- `workers/crash-report/README.md` (Files section)
- `BRANCH_STATUS.md` (this file)

## Gates

- `npm run test:worker` — 42/42 pass.
- `npm run typecheck:worker` — clean.
- Boot proof (pinned wrangler from the worker's own `npm install`):
  `npx wrangler dev -c wrangler.toml` → "Ready on
  http://localhost:8787", `GET /health` → `{"ok":true}`,
  `POST /ingest` (README's example) → `{"ok":true,...}`; zero
  ANOMALY / "Incorrect type" errors in the log.
- Full root gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — feat/233-ssr-build-shape

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#233)

Adds `scripts/ssr-build-shape.test.mjs`, a post-build assertion that
fails loudly if a production build ever stops producing the
custom-entry SSR shape from PR #232:

- the emitted `node_modules/.nitro/vite/services/ssr/wrangler.json`
  must have `main: "index.js"`, `no_bundle: true`, and a `configPath`
  that resolves to the repo-root `wrangler.jsonc` (resolved path is
  compared, never a hardcoded absolute path — it embeds the checkout
  directory);
- the SSR bundle (`index.js` in the same directory) must still
  contain the server-fn guard literals that survive minification
  (`/_serverFn/`, `not found`, `method not allowed`, `no-store`).
  Identifiers are not asserted — minifiers rename them. No single
  literal proves the guard; the pin is the combination.

Design choice — artifact absence: on a fresh checkout with no build,
the tests skip with an explicit reason (precedent:
`scripts/share-card-built.test.mjs`). CI builds before it tests, so
the pin is live there; present-but-wrong fails loudly.

The issue's cheaper companion (vite.config.ts plugin-order assertion)
already exists in `scripts/grok-pwa-plugin.test.mjs` from the #232
cure round — not rebuilt here.

## Files

- `scripts/ssr-build-shape.test.mjs` (new)
- `BRANCH_STATUS.md` (this file)

## Gates

- No build present: 2 skipped with reason (by design).
- After `npm run build` (exit 0): 2/2 pass against the real artifact.
- Mutation check: flipping `no_bundle` to false in the emitted
  wrangler.json turns the suite red; restored, green.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — feat/213-headers-simulation

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#213)

Until now the only guard on `public/_headers` was a live post-merge
probe, plus literal pins that key rules by pattern and cannot prove
what a browser actually receives. This branch adds a parse-and-simulate
pin to `scripts/security-headers.test.mjs`:

- An order-preserving parser + a simulator of Cloudflare's documented
  semantics (every matching rule applies, in file order; detachments
  before sets within a rule; first set replaces, later sets append).
- Pins the single effective `Cache-Control` for every path class:
  hashed `/assets/*` = immutable; the 3 carved files = one
  `public, max-age=0, must-revalidate` value (the detach+set proof —
  a missing detach would comma-join and fail); `/sw.js`, `/flags.json`,
  `/build-meta.json`, `/manifest.webmanifest` = `no-cache`; `/` and
  `/index.html` = the `s-maxage=60` value; `/offline`, `/offline.html`,
  `/_shell.html` = the revalidate value; and **no rule at all** for
  `/audio/*` and other unlisted paths (they take the platform default
  and must never become immutable).
- Note vs the issue text: the unioned file's values win — `/flags.json`
  is `no-cache` (not the pre-union revalidate line) and `/` carries
  `s-maxage=60`; the pins follow the file on main.
- Docs: the `/_shell.html` Acceptance wording is now conjunctive and
  lives in the `_headers` comment itself (404 AND no ETag AND no
  CF-Cache-Status = expected-inert; an asset-served header-less 200 =
  FAIL) — the old pointer to an Acceptance definition in
  BRANCH_STATUS.md dangled. `docs/security-headers.md` gains the
  missing `/offline*` / `/_shell.html` and no-rule rows.

## Files

- `scripts/security-headers.test.mjs`
- `public/_headers` (comment only — no rule changes)
- `docs/security-headers.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- `node --test scripts/security-headers.test.mjs` — 9/9 pass.
- Mutation check: deleting a detach line turns the suite red (2 fails);
  restored, green again.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — fix/223-watchdog-byte-budget

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#223)

The crash watchdog's 5120-byte budget was silently broken in
production: the budget test's fixture build id was 10 chars (rendered
exactly 5120), but production ids are 12 chars in CI (5122 bytes) and
14 for the timestamp fallback (5124). Fix, keeping the 5120 budget
(raising it was rejected — the shave is free and the budget guards
bytes inlined into every shell load):

- `scripts/crash-watchdog.mjs`: the embedded-source RENAME map now
  also renames `crashWatchdogMain` → `M` and `CSS` → `G` in the
  shipped output (neither is an object key or property, so this is
  semantics-preserving; `buildId` was deliberately NOT renamed — it
  is a payload key). Measured after: 7-char 5097, 10-char 5100,
  12-char 5102, 14-char 5104 bytes.
- `scripts/crash-watchdog.test.mjs`: the budget test now renders all
  four real build-id lengths instead of only the 10-char fixture.
- `docs/reviews/2026-10-21-remaining.md`: the stale "5118 bytes" line
  corrected to the measured values, with the reasoning recorded.

## Files

- `scripts/crash-watchdog.mjs`
- `scripts/crash-watchdog.test.mjs`
- `docs/reviews/2026-10-21-remaining.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- `node --test scripts/crash-watchdog.test.mjs` — 42/42 pass.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — docs/221-194-observability-sync

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does

- **#221 (residual only):** most of the stale Phase-1 passages named in
  the issue were already cured on main. This branch fixes what was
  left: the Files-section description of `wrangler.toml` in
  `workers/crash-report/README.md` (it still claimed a commented-out
  KV block "awaiting merge" — the uncommented block with the real
  namespace id is on main via PR #204), two leftover `cf.py`
  references (the current helper is `cf-version.py` and secrets ride
  with a version upload), and the same stale `cf.py` wording in the
  `wrangler.toml` header comment.
- **#221 rider:** handbook ch07 §4 now carries the caveat that
  `smoke:crash` check 4 is a known open failure on the workers.dev
  root, so "(4/4)" is not fully green.
- **#194:** event-type lists synced to the source of truth.
  `docs/observability.md` gains the missing `boot_failure` and
  `tile_failed` rows; handbook ch07 gains `boot_failure`. Both places
  now say plainly: the worker accepts 7 types, the client type lists
  13 (adding `storyteller_shown` and the `narration_*` types), and
  the extra 6 stay client-side.

## Files

- `workers/crash-report/README.md`
- `workers/crash-report/wrangler.toml` (header comment only)
- `docs/observability.md`
- `docs/handbook/07-engineering-and-ops.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- Docs-only change; gate results recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — fix/154-item6-manual-full-tile-failure

**Branch:** `fix/154-item6-manual-full-tile-failure`
**Base:** `origin/main` at `9345b4c` (2026-10-27, synced with PR #263 and PR #197 / #154 item 1 merged on `main`)
**State: CORRECTED + BUILT (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 3 of 3. Not merged —
merge is the owner's word.

> **Correction (2026-10-26, after the first push):** this branch
> originally added a new WS-4 E2E leg for item 6. A deeper
> verification pass then found the scenario ALREADY pinned on main
> (see item 6 below) — the added leg was substantially duplicative
> and has been **withdrawn** (the ws4 spec is byte-identical to
> main again). What remains is the one genuinely open remainder:
> item 5's stale comment, in its mutated form. The branch name is
> kept (renaming would orphan the PR); its content is now item 5.

## Scope: #154 items 1–7 (item 1 is now merged on `main` via PR #197 / `16ec9b3`)

Verification against `origin/main` (`16ec9b3`), file/line
evidence. Final verdicts:

| Item | Status on main | Evidence |
| :--- | :--- | :--- |
| 1. Production test seam (`__meridianSuppressScoutOffer`) | FIXED (`16ec9b3`, PR #197) | Seam removed from `src/components/game-app.tsx`; harness spoofs device signals in `tests/e2e/helpers.ts`; inverted pin in `src/map/capability.test.ts` (L456-465) and E2E pin in `tests/e2e/scout-harness-suppression.desktop.spec.ts` |
| 2. Stale decay comment | FIXED | The filed comment is gone; game-app boot comments (L1281-1305) and capability.ts L181-183 state the post-#151 / post-2026-10-20 rule |
| 3. `planBootMapMode` dead `stored` param | FIXED | Signature is `planBootMapMode(decision)` (capability.ts:322); docstring L299-305 explicitly records the item-3 resolution; unit pins cover both branches |
| 4. Offer dialog `aria-describedby` | SUPERSEDED | `scout-boot-offer.tsx` returns 404 on main — the dialog was removed by the 2026-10-20 silent-auto-switch ruling; capability.test.ts pins that it must not come back |
| 5. motionmaxxing stale comment | **STILL OPEN (mutated) — FIXED BY THIS BRANCH** | See below |
| 6. Declined-offer + WS-4 coverage gap | **ALREADY FIXED on main** | `scout-capability-offer.desktop.spec.ts`: "settled manual full → WS-4 tile failure: visit switches to scout, manual record untouched" — seeds manual full, aborts tiles, pins the Try-again card, the session-only switch, the untouched record, and the switch note; its header cites the #154 item-6 lineage. (An earlier pass missed this test; the duplicate leg added for it was withdrawn — see the correction note.) |
| 7. No unit test for accept→`accepted=true` | SUPERSEDED | The accept path no longer exists at all; its successor pin is capability.test.ts "game-app wiring: boot applies the plan's persistSource as an auto record", plus auto-record-no-accepted-flag and legacy-accepted-never-decays tests |

## Item 5, mutated form (what this branch changes)

The filed phrase ("the VM boots in scout map mode") is gone, but
its replacement comment in `tests/e2e/motionmaxxing.spec.ts`
(L180-185) is itself stale post-2026-10-20: it says the failed
WebGL probe "raises the Scout Map choice dialog instead of booting
into scout silently; the session starts in full mode either way."
There is no dialog anymore, and unpinned this VM would now boot
into Scout SILENTLY. The helper it describes (`forceFullMapMode`)
is still correct — only its explanation was wrong. This branch
rewrites that one comment to describe the silent auto-switch
ruling and why the manual pin is still needed. Comment-only;
no behavior change.

**Diff (whole branch vs main):**
`tests/e2e/motionmaxxing.spec.ts` (one comment) + this file.

## Gates (synced with `origin/main` `16ec9b3`)

- [x] `npx tsc --noEmit && npm run typecheck:worker` — clean (exit 0)
- [x] `npm test && npm run test:worker` — scripts 832 pass / 9 skip / 0 fail (841 total), src 1670 pass / 0 fail, worker 85 pass / 0 fail
- [x] `node scripts/lint-cards.mjs` — `lint-cards: GATE PASSED`
- [x] `VITE_KOFI_URL=https://ko-fi.com/meridian npm run build:pages` — exit 0
- [x] Playwright E2E against built artifact:
      - `scout-capability-offer.desktop.spec.ts`: **13/13 passed** (including #154 item 6 test)
      - `scout-harness-suppression.desktop.spec.ts`: **2/2 passed** (#154 item 1 test)
      - `ws4-tile-fallback.desktop.spec.ts`: **3/3 passed**
      - `grownups-privacy-contact.desktop.spec.ts`: **3/3 passed**
      - `hydration-boot.desktop.spec.ts`: **1/1 passed**
      - `observability.spec.ts`: **3/3 passed**
      - `motionmaxxing.reduced.spec.ts`: **6/6 passed**
      - `motionmaxxing.spec.ts`: **5/6 passed** — including M5, the test that uses `forceFullMapMode` (the helper whose comment changed). The one failure is the pre-existing "tap storm" test: 90 s test-timeout on this contended VM; it never calls the helper, the branch diff is comment-only (zero runtime surface), and tap-storm pacing is a known test-budget problem (tracked as #191).

## Out of scope

- #154 item 1 / PR #197 (production test seam) — now merged on `main` as `16ec9b3`.
- No merge, no branch-protection changes.