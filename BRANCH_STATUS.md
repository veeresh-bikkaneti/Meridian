# BRANCH_STATUS.md — fix/kofi-cloud-mobile

Owner: Dinesh · Branch: `feat/scout-map` · Base: origin/main @ f07dad3 · Created: 2026-10-08
Feature: Meridian "Scout Map" lite map mode (PBIs 1–10 from ~/workspace/your_files/meridian-scout-map-pbis.md).
Standing rules: PRs only, owner merges; named-file staging only; gates before handover (tsc, npm test, lint-cards, build:pages, Playwright).

## Rebase 2026-10-09 (onto origin/main@fc35798 — #109 Scout Map merged)

- 1 conflict, docs-only: BRANCH_STATUS.md — kept this branch's doc, dropped
  main's scout-map rebase record (that work is merged).
- Pre-push gates pending on final head (tsc, npm test, lint-cards, build:pages).
- Do NOT merge — PR #111 open, owner merges.

## Done
- Branch created off origin/main @ f07dad3.
- PBI-1: `src/map/capability.ts` — qualification module (order: manual toggle >
  map-attributed prior-crash flag > WebGL probe > deviceMemory; 7-day decay on
  auto assignments; SSR/test-safe; no UA read). Gates: tsc clean, npm test
  green (fail 0), logic smoke-checked in node.
- PBI-2: mode threaded through `src/map/map-options.ts` → `satellite-map.tsx`
  (`mapMode` prop, fail-closed to "full"; scout → DPR cap 1 via
  SCOUT_PIXEL_RATIO_CAP, maxZoom 3 flat / 2 globe; mapModeRef for PBI-5).
  Full-mode path byte-identical. Gates: tsc clean, npm test 852/852 green.
- PBI-3: scout outline renderer — new `src/map/scout-style.ts` (label-free,
  tile-free style from shared atlas-data.ts geometry: land fill + coast +
  borders, NO geometry fork, ZERO labels); satellite-map mounts it in scout
  mode, skips tile lifecycle (starts "ready"), starfield, motion
  (ZoomSpaceController forced reduced-motion); CelebrationOverlay gains
  motionOff (confetti off in scout). Full-mode path byte-identical.
  Gates: tsc clean, lint-cards GATE PASSED, build:pages green.
- PBI-4: static fallback — `scripts/gen-scout-fallback.mjs` generates
  `public/scout-fallback.svg` (18.5 kB ≤ 100 kB, coast mesh, no labels,
  preserveAspectRatio="none"); new `src/map/scout-fallback.tsx` (exact
  equirectangular tap→lon/lat mapping, keyboard crosshair, marks/spot);
  satellite-map drops to it when scout outline construction/render fails;
  reveal completes immediately so scoring/rounds proceed.
  Gates: tsc clean, lint-cards GATE PASSED, build:pages green.
- QA handover: `src/map/capability.test.ts` added to the `npm test` script
  (22/22 pass); capability.ts documents the settled semantics — Q1 (offer on
  source==="prior-crash" only, enforced by the PBI-6 boot modal), Q2 (record
  stores source+setAt; stale auto records decay to null; re-demotion needs a
  fresh qualifying event), Q3 (writeStoredMapMode only on new qualifying
  event/state change; resolveMapMode never writes).
- PBI-5: webglcontextlost → state-preserving scout switch + deferred note.
  satellite-map: `onWebglContextLost(view)` prop (viewport handoff, full-mode
  mounts only — repeat-storm guard) + `initialView` prop (re-opens mid-SPACE
  like the tile-Retry restore). GameApp owns mapMode (threaded Play →
  PlayLoaded → SatelliteMap; remount via nonce-key, never mid-round);
  switch writes meridian:map-mode=scout/"contextlost" (Q3). Deferred note:
  GameApp-level sibling of ResultCard, fixed inset-x-4 top-16 z-50,
  role="status", verbatim copy, keyed to switch event + place id, clears on
  Continue/dismiss — never mid-round.
- PBI-8: observability — `mapMode` stamped on every observability event via
  setReportMapMode (GameApp applies it on every assignment); `tileErrors`
  on the crash breadcrumb (satellite-map syncs the tile-status count;
  suggestive only, never a switch signal) → suspected_crash carries both.
  flags.json has NO generator (hand-maintained static file) — a static
  mapMode value would be misinformation, so mapMode observability lives in
  the crash reports. Watchdog boot_failure NOT stamped: the inline script
  has a hard 5120-byte budget with 12 bytes of headroom (pre-PBI-8: 5108),
  and boot_failure fires when the app never boots — the map never mounted,
  so the mode isn't attributive for that failure class.
- PBI-6: map-attributed prior-crash boot offer. observability.init()
  detects unclean shutdown + trail ending at map_init_start/map_ready →
  wasMapAttributedCrash(); GameApp boot effect qualifies pre-mount —
  a FRESH source==="prior-crash" decision shows the dedicated modal
  (fixed inset-0 z-50, role=dialog aria-modal, focus primary on open,
  focus returns to home heading, data-testid=scout-boot-offer) on the home
  render, once per boot; "Use Scout Map" writes manual scout, "Not now" /
  Esc / scrim declines and stays full (Q1: offer, not force — the modal
  fires on prior-crash ONLY). capability.ts preserves the stored source
  on decisions (Q2 settlement).
- PBI-7: settings toggle. 44×44 frosted round button (Layers icon,
  data-testid=map-mode-button) in the Play top-bar left cluster beside
  SoundToggle; popover (absolute top-full left-0 mt-2 w-64, frosted) with
  the verbatim label + explainer + role=switch row (On/Off). Writes
  meridian:map-mode as manual (Q3); takes effect on the NEXT place mount —
  never remounts mid-round. Esc closes, focus returns to the button;
  live-region announces "Scout Map on/off — applies from the next place".
  CelebrationOverlay wired with motionOff in scout (confetti off).

## Pending (sequenced)
- [x] PBI-1 capability.ts — DONE (commit 0032325).
- [x] PBI-2 thread mode through map-options.ts → satellite-map.tsx — DONE (commit b0de59f).
- [x] PBI-3 scout outline renderer, label-free — DONE (commit 5debfc1).
- [x] PBI-4 static fallback asset (≤100 kB, pin-drop mapping) — DONE (commit c6659c8).
- [x] PBI-5 webglcontextlost → state-preserving switch + deferred note — DONE (commit bd68802).
- [x] PBI-6 map-attributed prior-crash boot offer — DONE (commit be6fa34).
- [x] PBI-7 settings toggle UI — DONE (commit 7db37ed).
- [x] PBI-8 observability: mapMode in crash reports + tile_failed counts — DONE (commit d29ad34).
- [x] PBI-9 E2E regression — DONE. All 24 scout E2E green (6 spec files:
  false-demotion golden 3/3, offer 7/7, context-lost 3/3, switch-note 6/6,
  throttled 1/1, toggle 4/4); 874/874 unit green; tsc clean; lint-cards
  GATE PASSED; build:pages green.
- [x] PBI-10 PR opened, never merged — PR #109
  https://github.com/veeresh-bikkaneti/Meridian/pull/109 (verified loads).

## Notes
- Review finding vs current main: tile_failed counts do NOT flow into crash reports — folded into PBI-8.
- Spec correction made (2026-10-08): DPR premise corrected — touch devices already capped at 1.5 in map-options.ts.
- Coordinator QA-landing fixes (2026-10-08): the 15 initial E2E failures were
  test-harness/contract gaps, not implementation bugs — (1) re-seeding crash
  state on every reload (unrealistic: the app rotates the breadcrumb
  exactly-once at boot); (2) specs needing a FULL start on a SwiftShader VM
  (no capable-device spoof); (3) missing data-map-mode / data-max-zoom
  attributes (dev's own report flagged them as still needed); (4) no Tab trap
  in the offer modal (real a11y gap, now fixed).
- Real implementation bugs found by the E2E (fixed): (a) scout tile-status
  wedged at "loading" — the mount effect's retry dispatch reset scout's
  initial "ready"; (b) switch note never showed on a miss (phase "done") —
  now shows at round end on story OR done; (c) manual toggle applied
  mid-round (current round's confetti would vanish) — now QUEUED, applied at
  the next place mount via render-phase adjustment; toggle UI shows the
  queued choice; contextlost stays immediate and clears the queue.
- Q1/Q2/Q3 semantics confirmed settled in code (dev report): offer fires on
  fresh source==="prior-crash" only; stale auto records decay without
  re-demotion; writeStoredMapMode only on new qualifying events.

## QA (Software Tester — updated 2026-10-08)
- Gates (branch @ f07dad3 + QA commits, pre-scout-code): `npx tsc --noEmit` ✅ ·
  `npm test` ✅ (exit 0, 0 failures) · `node scripts/lint-cards.mjs` ✅ GATE PASSED ·
  `npm run build:pages` ✅ (EXIT:0, dist ready).
- Unit: `src/map/capability.test.ts` — 22/22 ✅, committed + pushed. Written
  against the dev's landed API (`MAP_MODE_STORAGE_KEY`, `{mode, source, setAt}`,
  `qualifyMapMode`/`readStoredMapMode`/`probeWebGL`/`resolveMapMode`). Covers:
  order precedence, decay (stale auto → null, manual never decays), SSR-safety,
  SwiftShader/llvmpipe probe patterns, fail-closed goldens, no-UA source scan.
  ⚠️ NOT yet in `npm test`: needs `src/map/capability.test.ts` added to the
  package.json `test` script (coordinator/dev — QA may not edit package.json).
- E2E (6 spec files, 24 tests, desktop project; all vs built artifact via
  serveBuiltArtifact, serialized with `flock ~/workspace/.e2e.lock --workers=1`):
  - `scout-false-demotion` P0 GOLDEN: 3/3 ✅ on current build (cold boot,
    crash-resume-to-menu, idle-kill return — capable spoof: NVIDIA renderer,
    deviceMemory 8, DPR 2; tiles requested; no offer). Fixed 1 QA bug: the
    ?idle-ms seam killed the return run — now dropped before the return run.
  - `scout-offer` fail-closed tests: 2/2 ✅ (no modal on clean boot, manual
    override suppresses).
  - Remaining 19 tests EXPECTED-RED until the dev lands PBI-5/6/7 (offer modal,
    toggle, switch note, data-map-mode wiring). They fail only on the missing
    feature, not on harness issues (verified listing: 24 tests parse).
- Dev contracts needed for the E2E to pass: `data-map-mode` + `data-max-zoom`
  on `.satellite-map` (follow the data-zoom pattern); `meridian:map-mode`
  record shape `{mode, source, setAt}`; offer accept-button label (accept-path
  test pending the label); note shows whenever the ResultCard is up
  (story AND done), hidden in aim.
- Open semantics for the coordinator (in capability.test.ts header):
  Q1 — prior-crash → scout at the qualify layer; the APP must show the offer
  modal when source === "prior-crash" (spec: offer, not force).
  Q2 — fresh auto record re-demotes without a fresh signal (7-day hysteresis)
  vs spec's "never demoted twice in a row without a fresh qualifying event".
  Q3 — decay only fires if the app does NOT rewrite the auto record every
  boot; confirm the write policy.
- P0 false-demotion status: no false demotion possible yet (scout code still
  landing); unit + E2E goldens in place and green where runnable.
- Reproduce:
  `flock ~/workspace/.e2e.lock npx playwright test --workers=1 --project=desktop <spec>`
  per spec file; unit: `node --experimental-strip-types --test src/map/capability.test.ts`.

## Rebase 2026-10-09 (onto origin/main@1bee70e — #103/#104/#105/#106 all landed)

- 21 commits replayed. 7 conflicts, all mechanical unions:
  - BRANCH_STATUS.md: docs-only, kept this branch's doc (PBI-1 commit).
  - src/map/satellite-map.tsx imports: kept main's `emitTileFailed` (#105) +
    scout's `SCOUT_MAX_ZOOM_FLAT/GLOBE` + `MapMode` (PBI-2); PBI-8's
    `recordTileErrors` joined the same import (PBI-8 commit).
  - satellite-map.tsx hook block: main's #105 `emitTileFailed` telemetry effect
    kept alongside PBI-4's `scoutFallback` state + effect (adjacent, both needed).
  - src/lib/observability.ts emit(): kept main's `device: coarseDeviceFacts()`
    (#105 COPPA-safe bucket) + scout's `mapMode: reportMapMode` (PBI-5/8).
  - package.json test list: main's union (incl. `error-component.test.ts`,
    coldtrail suites) + `src/map/capability.test.ts` inserted after
    `src/map/map-options.test.ts`.
  - src/components/game-app.tsx banner: kept #103's CometMascot banner row;
    h1 gained PBI-6's `data-testid="home-heading" tabIndex={-1}` (boot-offer
    focus return target) — verified scout-boot-offer.tsx focuses that selector.
- Pre-push gates pending on final head (tsc, npm test, lint-cards, build:pages,
  scout desktop e2e).
- Do NOT merge — PR #109 open, owner merges.

## Rebase 2026-10-09 (2nd, onto origin/main@4c3e83e — #108 storyteller voice + #110 age-band profiles landed mid-task)

## Pending

- Owner: PR review + merge (NEVER merge from here — open PR only).
- Phase 4: security validation (written expecting a hostile audit).
- Veeresh/owner: none — no secrets, no deploys, no flags touched.

## Rebase record (2026-10-08)

Rebased onto `main@8e2cc76` (picks up #103 comet banner, #104 facts-ladder,
#105 crash-pipeline, #107 sprint entry gates). 4 conflicts, all keep-both:

- `package.json` — test script: kept main's
  `src/hooks/use-online-status.test.ts` entry AND the feature's 3
  age-profile test files; kept main's `smoke:crash` script.
- `src/components/game-app.tsx` — `Choose` props: kept main's
  `tutorialInviteVisible` (Comet auto-greeting coordination) alongside the
  feature's `ageBand` / `agePending` / `onGrownUpOpen` (caller, destructure,
  and prop types).
- `src/game/generated-places.ts` — kept main's `factAttribution()` (per-kind
  source attribution) AND the feature's `factLadder()` (single-fact rung
  adaptor); both still compose in `toStarter` as before.
- `BRANCH_STATUS.md` — kept this (feature) doc; main's version documents the
  crash-pipeline branch.

Post-rebase fix (new commit on this branch): `requestChange` while a change
is pending and the requested band equals the effective band no longer
writes an invalid blob (which `validateProfile` rejects → silent reset to
`unset`/full access); the request is now treated as `cancelPending()`.
Regression test added to `store.test.ts`.

## Post-rebase verification (2026-10-08)

Rebase completed onto `main@8e2cc76`; feature commit is now `fc0d9d3`.

Fixes (new commit on this branch, not amended into the feature commit):
- `requestChange` bug: pending-change + re-pick of the currently-effective
  band now goes through `cancelPending()` instead of writing an invalid
  blob (`band === pendingBand` fails `validateProfile` → silent reset to
  `unset`/full access). Regression test added.
- Minor: `emitAgeProfileChanged` no longer re-exported from the
  `age-profile` facade (screens can't forge change events; the store
  imports it from `./events.ts` directly).
- Minor: `Starter.storyRung` narrowed from `string` to the exported
  `StoryRung` union.

Gates (all run post-rebase, post-fix):
- `npx tsc --noEmit` — clean
- `npm test` — 902/902 pass (889/889 pre-rebase; +13 from main's new
  tests plus the new regression test)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (prerender + SW fingerprint ok)
- Playwright E2E (targeted, desktop): 2/2 pass —
  `hit-story.desktop.spec.ts`, `result-card-dismiss.desktop.spec.ts`
  (full E2E suite not run; no age-profile-specific e2e specs exist)

Pending: PR blocked on `gh` auth in this environment (not logged into any
GitHub hosts) — push the branch and open the PR from an authenticated
machine. Phase 4 security validation still open.

## Review-findings fix pass (2026-10-08, frontend)

Game Designer + UI/UX Expert review findings at `bf455a7` — all fixed on
this branch:

P0:
- `age-profile.css` `.agep-screen` is now a full-viewport overlay
  (`position: fixed; inset: 0; z-index: 200; overflow-y: auto`) — the
  gate/picker replaces the screen instead of rendering below the fold.
  `game-app.tsx` wraps the home page in `<div inert>` while the settings
  are open, so Comet's banner, edition cards, and the footer link are
  non-interactive and out of the tab order.

P1:
- `AgeProfileSettings.tsx` — change toast is now the band-invisible
  `"Saved ✅"` (was naming the band label; child-visible leak).
- `LoopScreen.tsx` — locked band (5-7) no longer gets the hardest deal:
  the `??` fallback is now the EASIEST unlocked config (8-10) via
  `SAFE_DEAL_FALLBACK`, and the deal-time config is captured per mystery
  (`captureDealConfig`) and threaded to `LoopGame`/`LoopReveal`, so a
  mid-run band change never re-tunes an in-progress deal. Resume paths
  re-read the live band, fail-safe.
- `GrownUpGate.tsx` — Enter on a focused button no longer double-fires
  `check()` (keydown skips when `e.target` is a button; the button's own
  click is the single path). No more spurious fails on "Try another
  question".
- `game-app.tsx` — focus returns to the invoking control (footer
  "For grown-ups" link or locked-tile grown-up link) on close
  (`ageTriggerRef` + rAF after unmount).
- `AgePicker.tsx` — the selection ring follows the staged selection
  (`checked = selected === id`); `selected` already holds the pending band.

P2 (all trivial, all done):
- Esc dismisses both confirm dialogs (focus moves into the dialog on
  open — correct modal pattern — so the Esc handler fires).
- `LockedLoop.tsx` — `useId()` for title/msg ids (no more duplicates
  with several locked tiles).
- Picker cards get a non-color selected indicator (`✓` on the title).
- Change-confirm dialog shows the per-band consequence line
  (`band.whatChanges`, parent-safe behind the gate).

Tests: new `difficulty.test.ts` case locks the fail-safe contract
(fallback is the easiest unlocked deal, never the hardest); new
`tests/e2e/age-profile-gate.desktop.spec.ts` locks the overlay/inert,
ring, Esc, band-invisible toast, and focus-return behavior end to end.

Gates re-verified post-fix: `npx tsc --noEmit` clean · `npm test`
903/903 pass · `node scripts/lint-cards.mjs` GATE PASSED ·
`npm run build:pages` green · Playwright `age-profile-gate.desktop`
1/1 pass.

Out of scope (not built, per brief): wiring round lengths / hintPolicy /
distanceDisplay / mapLabelDensity; mid-run grown-ups entry points;
11-13 read-aloud button; anything on `verify/geodetective-clues`,
`feat/meridian-loop`, or other branches.

---

# BRANCH_STATUS — fix/kofi-cloud-mobile (rebased onto main@4c3e83e)

Ko-fi donation cloud appears sooner on mobile: shorten the mobile tasting-tour
walk (Option B — Game Designer + UI/UX Expert reconciled spec).

## Changed
- `src/components/grandpa-coffee-run.tsx` ONLY (mobile `tour` mode only;
  desktop `strip` untouched):
  - `TOUR_JOURNEY_CAP_MS`: `25_000` → `10_000`
  - `TOUR_TARGET_MS`: `20_000` → `6_000`
  - `TOUR_SIP_MS`: `1200` → `800`
  - `TOUR_POUR_MS` unchanged at `2800` (matches kettle-drop keyframes)
  - `measureTour`: stops trimmed to difficulty → geodetective → editions
- `tests/e2e/grandpa-tasting-tour.spec.ts`: sip-dwell sampling gap 450ms →
  250ms to fit the 800ms sip window (was racy under load).

## Explicitly untouched
- `showCloud` logic, once-per-session gate, `onTourHandoff` end state,
  grown-up gate copy (verbatim), offline/no-URL fail-closed, same-day
  behavior, tour-skip button, reduced-motion path, kid-safety copy.
  No CSS changes.
