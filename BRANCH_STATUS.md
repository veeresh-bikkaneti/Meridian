# BRANCH_STATUS — fix/209-210-211-chunk-territory

**Branch:** `fix/209-210-211-chunk-territory`
**Base:** `main` at `5f24c6c` (2026-10-26)
**State: BUILT + GATES GREEN (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 1 of 3. Not merged —
merge is the owner's word.

## Scope (all three issues come from the PR #203 review panel)

- **#209 — territory/chunk load has no timeout.** A *hung* import
  never settles, so every awaiter sat behind its loading fallback
  forever. Now bounded at 10 s everywhere it matters:
  `territory.ts` races its atlas load (timeout evicts like a failure;
  preload still never rejects, still fail-closed; the boot restore's
  deferred commit therefore always settles), `src/lib/chunk-timeout.ts`
  adds `withChunkTimeout`/`ChunkLoadTimeoutError`, and game-app races
  the Loop/Trail/SatelliteMap lazy factories and openRun's
  places+territory await. A timeout lands in the EXISTING recoverable
  paths (boundary card / start-error catch), stale-probe included.
- **#210 — stale-deploy chunk failure showed the generic map card.**
  First checked against open PR #248 (`fix/a11y-reload-announcement`):
  it does **NOT** cover #210 — #248 is announcement dwell + a
  post-reload notice layered on #245's auto-reload; it never probes
  staleness inside the boundary and keeps the map-only copy. Here,
  `MapErrorBoundary` probes `isNewBuildDeployed()` once per error:
  stale → the approved "A new version of Meridian is available." +
  Refresh card; otherwise destination-neutral copy naming the
  wrapped surface (`surface` prop — GeoDetective / Cold Trail sites
  pass theirs; the map site keeps "the map", so #248's
  `MAP_ERROR_CARD_COPY` dwell probe still matches the map card when
  that branch rebases).
- **#211 — perf follow-ups.** (1) The focus-triggered territory
  prefetch is gated on Save-Data (`prefetchTerritoryDataOnFocus`;
  pointer intent ungated; the home-globe precedent). (2) Trail's
  fail-closed heading now carries `caseHeadingRef` + `tabIndex={-1}`
  — arrival-focus parity with Loop in one line. (3) A source-pin in
  `territory-lazy-boundary.test.ts`: scoring never starts the load,
  and in game-app every awaited preload sits before the commit that
  scores from it.

## Files

- `src/game/territory.ts`, `src/game/territory-timeout.test.ts` (#209)
- `src/lib/chunk-timeout.ts`, `src/lib/chunk-timeout.test.ts` (#209)
- `src/components/game-app.tsx` (#209 wraps + #210 surface props +
  #211 Save-Data focus gate)
- `src/components/map-error-boundary.tsx`,
  `src/components/map-error-boundary.test.ts` (#210)
- `src/game/coldtrail/TrailScreen.tsx`,
  `src/game/coldtrail/trail-heading-focus.test.ts` (#211 item 2)
- `src/game/territory-lazy-boundary.test.ts` (#211 items 1+3 pins;
  two F2b pins updated for the #209 preload signature)
- `src/components/game-app-lazy-boundary.test.ts` (#209 wiring pins;
  branch pins updated for the #210 surface props; focus hook updated)
- `tests/e2e/chunk-boundary-copy.desktop.spec.ts` (#210 E2E: real
  aborted LoopScreen chunk → neutral GeoDetective card; + stubbed
  build-meta mismatch → new-version prompt)
- `docs/handbook/02-game-design-decisions.md` (§11 extended)

## Panel-spec amendment (2026-10-26, after the squad specs landed)

Four refinements from the UX/Frontend squad's full spec, folded in
before panel review:

- **#209 zombie guard:** a territory import that lands AFTER its
  timeout is now discarded via a load-generation check — it no
  longer populates the cache or double-counts the conversion seam;
  the retry owns the cache. Executed pin in territory-timeout.test.ts.
- **#209 HomeGlobe:** its lazy factory is timeout-wrapped too — a
  hang lands on the existing GlobeChunkFallback.
- **#210 one-shot guard:** the boundary's Refresh offer honors the
  shared `meridian.staleRefresh` guard (probe skipped once armed;
  Refresh arms it) — parity with openRun / LoopScreen, pinned
  against game-app's identical key literal.
- **#211 item 3, executed:** `scoring-territory-pin.test.ts` pins
  the money invariant with real calls — regionBonus 0 before the
  preload, +15 after.

## Gates (2026-10-26, this head)

- [x] `npx tsc --noEmit` — clean, exit 0
- [x] `npm test` — scripts 832 pass / 0 fail / 9 skipped;
      src 1652/1652 pass (incl. the amendment pins)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- [x] Playwright `--workers=1`: chunk-boundary-copy **2/2** (new
      #210 legs) + chunk-recovery **15/15** (neighbors, incl. the
      6-E stand-down oracle) = 17/17; coldtrail **11/11** (Trail
      heading neighbor, pre-amendment head)

## Out of scope / sequencing notes

- PR #248 (Liz's crew) also touches `map-error-boundary.tsx`
  (retry-path notice flag). Whichever lands second rebases; the map
  card's heading copy is unchanged by this branch so #248's dwell
  probe constant keeps matching.
- PR #245's chunk-recovery auto-reload is untouched and composes:
  it may reload a stale tab on its own schedule; this branch's card
  is the visible, tappable recovery while it is on screen.
- No merge, no branch-protection changes.

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
