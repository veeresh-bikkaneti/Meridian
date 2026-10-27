# BRANCH_STATUS — fix/a11y-reload-announcement

**Branch:** `fix/a11y-reload-announcement` (pushed via API replay;
PR #248 open — merge remains Liz's word)
**Base:** origin/main @ `985f5214` (merged `origin/main` after PR #217 landed; originally built on `d26b90a` / `5f6164b` / `5f24c6c5`)
**State: BUILD COMPLETE — all five gates run; awaiting the
independent Reality Checker gate.** It supersedes the previous
contents of this file (the `fix/storyteller-pending-tap` branch
record, whose history lives on its own PR).

## Scope (exactly this — no drive-by changes)

Tier 2 council round (manifest
`.council/manifests/2026-10-25-a11y-reload-announcement.md`, signed
before any production code) fixing the two PR #245 follow-ups Liz
approved on 2026-10-25 ("Yes fix them both"), reversing the earlier
knowingly-accept of review items A11Y-2/A11Y-1/A11Y-4:

1. **Announcement dwell** — `src/lib/chunk-recovery.ts`: when
   MapErrorBoundary's error card is already on screen at the 1_500 ms
   decision point, the auto-reload defers once by
   `CHUNK_ANNOUNCE_DWELL_MS` (10_000), giving the card at least that
   much additional dwell before navigation. The deferred decision
   re-checks the stale offer, the episode latch, and the card
   itself; if the card has gone, the reload stands down. The probe
   matches the boundary's own copy (`MAP_ERROR_CARD_COPY`), never a
   generic alert.
2. **Post-reload notice** — every auto-reload, and the boundary's
   manual "Try again" (`map-error-boundary.tsx`), writes a
   timestamped flag (`meridian.chunkReloadNotice`); the next boot
   consumes it (`game-app.tsx`), which shows a `role="status"`
   notice — "Meridian had to reload. You're back! Keep playing!" —
   with a Close button and no auto-dismiss timer. Show-once holds
   where the flag's removal succeeds; removal is best-effort, so a
   surviving flag can show the notice once more at a later boot
   inside its freshness window (pinned, knowingly, by unit 13-Uf).

Preserved, pinned by the existing contracts: episode latch,
stale-offer stand-down, idempotent install, unrelated errors never
reload. No new dependencies, no game-logic changes.

Claim discipline (manifest D10): the claim is *additional dwell*,
not that any announcement is guaranteed complete; WCAG 3.2.5 remains
AAA-unmet (mitigated, not cured). Race pin (D1): a card that renders
after the decision point gets no deferral — a documented non-fix,
stated in the module header verbatim.

## Spike (Branch A — B's mandatory pre-11-E gate)

Pre-fix build, safari-launch recipe (context-abort
`**/satellite-map*.js`, no synthetic dispatch): card at
alertAtMs=5532 after the click, recovery navigation at navAtMs=6887,
guard stamp present (log `spike-run2.log`). Recovery DOES engage on
the real SatelliteMap path — 11-E is the primary variant.

## Commits

1. `e51478d` — docs(council): signed manifest
2. `128558f` — test(recovery): RED contracts (unit file: **28
   failing of 58** in the full-file RED run, log `red-unit.log`,
   with the predicted signatures; a 29th contract, 11-U3, was
   strengthened immediately after that run and verified failing in
   a targeted run before implementation)
3. `59dba35` — fix(recovery): dwell + notice implementation;
   game-app consume/render; boundary retry flag
4. `d4b7163` — docs(council): footprint revision recorded
   (chunk-recovery.ts +173 vs +140 estimate; same files/functions)
5. `d8fa834` — fix(recovery): card copy U+2019 (see Defect record)
6. `b2e0f0a` — docs(council): gate-round defect record
7. `58b4023` — test(e2e): 11-E / 13-E / 14-E / 6-E2

## Defect record (found by this round's own oracle)

First Playwright run: 11-E failed, dwell Received 1364 — the probe
never matched in production because `MAP_ERROR_CARD_COPY` used an
ASCII apostrophe and the boundary renders `&rsquo;` (U+2019); unit
12-Ua passed against a stub mirroring the same wrong character.
Fixed in `d8fa834`; 11-U0 now pins the copy codepoint-for-codepoint
and 12-Ua builds its stub text from the constant.

## Gates (logs in `~/workspace/meridian-a11y-announce/logs/`)

| Gate | Result |
| :--- | :--- |
| `npx tsc --noEmit` | clean, exit 0 (`gate-tsc.log`) |
| `npm test` | scripts **832 pass / 0 fail / 9 skipped**; src **1568 pass / 0 fail** (`gate-npm-test.log`) — chunk-recovery file 58/58 (29 prior + 29 new/amended) |
| `node scripts/lint-cards.mjs` | **GATE PASSED**, exit 0 (`gate-lint.log`) |
| `npm run build:pages` | green, exit 0 (`gate2-build.log`) |
| Playwright chunk-recovery (desktop) | **9 passed / 0 failed** (`gate2-pw-chunk-recovery.log`) — 5 prior + 11-E, 13-E, 14-E, 6-E2 |
| Playwright observability | **3 passed / 0 failed** (`gate2-pw-observability.log`) |
| Playwright safari-launch | **4 passed / 0 failed** (`gate2-pw-safari-launch.log`) — incl. the manual Try again card path |
| Playwright crash-watchdog | **3 passed / 1 failed** (`gate2-pw-crash-watchdog.log`) — the one failure is the proven pre-existing stale-build breadcrumb assertion (spec L217, expected `data_chunk_load_start`, got `storyteller_ready`), identical on pristine `a59ee4c`; baseline-matched, not a regression, not worse |

Gate-log timing note (Reality Checker fix round): the `gate-tsc.log`
and `gate-npm-test.log` runs predate the U+2019 fix commit
(`d8fa834`, a one-string change). Both gates were re-run at the
final head by the independent Reality Checker with identical
results (tsc clean; scripts 832/0/9, src 1568/0), and the
chunk-recovery unit file was re-run by the crew at `d8fa834`
(58/58) and again in this fix round.

## Mutation record

- Unit: deferral disabled → 10 failures; cancellation re-check
  disabled → 11-U4 fails; notice write removed → 14-U1 + 11-U fail
  (logs `mutation-1-nodefer.log`, `mutation-2-nocancel.log`,
  `mutation-3-nonotice.log`). Restored file: 58/58.
- E2E: deferral disabled → rebuild → 11-E FAILS (Expected
  ≥ 10_000, Received 1579; log `mut-e2e-11e.log`); revert +
  rebuild + full chunk-recovery spec re-run: 9 passed (log
  `gate3-pw-chunk-recovery.log`).

## Untested / not claimed

- No live screen-reader pass (NVDA/JAWS/VoiceOver/TalkBack) — the
  dwell is a timing guarantee measured by the oracles, not a
  heard-announcement observation. This untested item stays open.
- No throttled-network run; full Playwright suite not run
  (targeted specs only, per the round's scope).
- Notice render coverage: the main GameApp return only (manifest
  D7); early-return error screens do not show it, though the flag
  is still consumed at boot.
- Councilor A's Scenario 8 (card renders after the decision point)
  is a recorded unresolved objection + documented non-fix (D1).

## Fix Round 3 (2026-10-26) — Home Toast Slot Below Header Rows + Merge `origin/main` (`985f5214`)

### Why Round 2 (`71fd843`) Was Blocked
- **Round 1 (`2dba089`)** rendered `chunk-reload-notice` using `.agep-toast` (`position: fixed; bottom: max(24px, ...)`) with a bare `className="ml-3 font-bold"` Close button (`< 44x44px` tap target), floating over home page content.
- **Round 2 (`71fd843`)** moved `chunk-reload-notice` to a top-fixed banner (`fixed inset-x-4 top-16 z-50`, `y = 64..120px`). While `tutorial-invite` was visible above `<header className="hv5-nav">`, the header was pushed down to `y >= 146px`. Once `tutorial-invite` was dismissed (**post-dismiss**), `<header className="hv5-nav">` shifted up to `y = 32..119px` (desktop, 1 row) and `y = 32..248px` (mobile `<=680px`, wrapped rows), causing the fixed `top-16` toast to overlap the header links/buttons across all 6 viewports (`320x568`, `375x667`, `390x844`, `768x1024`, `1024x768`, `1280x800`).

### Round 3 Fix (`src/components/game-app.tsx`, `tests/e2e/chunk-recovery.desktop.spec.ts`)
- Added `homeToast?: ReactNode` to `Choose` in `src/components/game-app.tsx`, rendering the post-reload notice in normal document flow in a dedicated home toast slot immediately below `</header>` (`<header className="hv5-nav">`) and above `<div className="hv5-bento">`.
- Styled `chunk-reload-notice` as `relative z-10 mt-3 mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-surface pl-4 pr-1 py-1 text-sm text-fg shadow-xl` with a `44x44px` Close button (`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-bold hover:bg-fg/10`).
- Extended E2E test `13-E` in `tests/e2e/chunk-recovery.desktop.spec.ts` to verify across all 6 viewports (`320x568`, `375x667`, `390x844`, `768x1024`, `1024x768`, `1280x800`), both **pre-dismiss** and **post-dismiss** of `tutorial-invite`:
  - `chunk-reload-notice` sits strictly below `header.hv5-nav` (`nBox.y >= hBox.y + hBox.height - 1`) and above `.hv5-bento` (`nBox.y + nBox.height <= bBox.y + 1`).
  - Zero bounding-box overlap (`overlapX * overlapY === 0`) with all 8 `header.hv5-nav button, header.hv5-nav a` elements.
  - Close button tap target is `44x44px` (`>= 44x44px`).

### 6-Viewport Bounding-Box Proof (Pre-Dismiss & Post-Dismiss)

| State | Viewport | `header.hv5-nav` Y (px) | `chunk-reload-notice` Rect `(x, y, w×h)` | Gap Below Header (px) | `.hv5-bento` Top Y (px) | Gap Above Bento (px) | Close Target (px) | Header Links Checked | Max Overlap Area (px²) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| pre-dismiss | `320x568` | `204..420` | `(20, 430, 280x54)` | `10` | `490` | `6` | `44x44` | 8 | `0` |
| pre-dismiss | `375x667` | `202..418` | `(20, 430, 335x54)` | `12` | `490` | `6` | `44x44` | 8 | `0` |
| pre-dismiss | `390x844` | `202..418` | `(20, 430, 350x54)` | `12` | `490` | `6` | `44x44` | 8 | `0` |
| pre-dismiss | `768x1024` | `150..245` | `(160, 257, 448x54)` | `12` | `317` | `6` | `44x44` | 8 | `0` |
| pre-dismiss | `1024x768` | `150..236` | `(288, 248, 448x54)` | `12` | `308` | `6` | `44x44` | 8 | `0` |
| pre-dismiss | `1280x800` | `150..237` | `(416, 249, 448x54)` | `12` | `309` | `6` | `44x44` | 8 | `0` |
| post-dismiss | `320x568` | `32..248` | `(20, 260, 280x54)` | `12` | `320` | `6` | `44x44` | 8 | `0` |
| post-dismiss | `375x667` | `32..248` | `(20, 260, 335x54)` | `12` | `320` | `6` | `44x44` | 8 | `0` |
| post-dismiss | `390x844` | `32..248` | `(20, 260, 350x54)` | `12` | `320` | `6` | `44x44` | 8 | `0` |
| post-dismiss | `768x1024` | `32..127` | `(160, 139, 448x54)` | `12` | `199` | `6` | `44x44` | 8 | `0` |
| post-dismiss | `1024x768` | `32..118` | `(288, 130, 448x54)` | `12` | `190` | `6` | `44x44` | 8 | `0` |
| post-dismiss | `1280x800` | `32..119` | `(416, 131, 448x54)` | `12` | `191` | `6` | `44x44` | 8 | `0` |

### Round 3 Gate Results (on merged `origin/main` `985f5214`)

| Gate | Result |
| :--- | :--- |
| `npx tsc --noEmit` | **PASS** (exit 0, 0 errors) |
| `npm test` | **PASS** — scripts **832 pass / 0 fail / 9 skipped**; src **1670 pass / 0 fail** (`src/lib/chunk-recovery.test.ts` **84/84 pass**) |
| `node scripts/lint-cards.mjs` | **GATE PASSED** (exit 0) |
| `npm run build:pages` | **PASS** (exit 0, `dist/client` built cleanly) |
| `npx playwright test tests/e2e/chunk-recovery.desktop.spec.ts --workers=1` | **19 passed / 0 failed** (3.0m, incl. 6-viewport pre/post-dismiss `13-E`) |
