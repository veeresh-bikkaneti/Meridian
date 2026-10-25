# BRANCH_STATUS — fix/a11y-reload-announcement

**Branch:** `fix/a11y-reload-announcement` (pushed via API replay;
PR #248 open — merge remains Liz's word)
**Base:** origin/main @ `5f6164b` (rebased 2026-10-25 after PR #247
merged; originally built on `d26b90a`, with PR #245's squash
`28c5fea` a verified ancestor — #242/#243 landed after it; the
in-scope files are byte-identical between `28c5fea` and `d26b90a`)
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
   consumes it exactly once (`game-app.tsx`) and shows a
   `role="status"` notice — "Meridian had to reload. You're back!
   Keep playing!" — with a Close button and no auto-dismiss timer.

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
2. `128558f` — test(recovery): RED contracts (unit file: 29 failing
   of 58 with the predicted signatures; log `red-unit.log`)
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
