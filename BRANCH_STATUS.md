# BRANCH_STATUS — feat/age-profile-studio

Age-profile system (Phase 3 engine implementation of the Phase 1 design +
Phase 2 UI/UX handoff): parent-set age band (5-7 / 8-10 / 11-13), local-only,
driving fact-ladder rung depth, loop availability, and difficulty. COPPA-safe
(no accounts, no PII, localStorage only), offline-first, static hosting.

NOTE: this working tree is shared with the feat/storyteller-mascot agent —
its staged files were left untouched in the index; this branch commits
named age-profile files only. The storyteller staged BRANCH_STATUS.md was
backed up to ~/workspace/storyteller-branch-status.staged-backup.md before
this file was rewritten.

## Done

- `src/game/age-profile/` — pure engine module:
  - `types.ts` — AgeBandId, LadderRung, AgeBand, AgeProfile, ProfileStatus,
    PlaceFacts, MappedStory, AgeProfileChangedEvent.
  - `bands.ts` — the 3 bands as DATA (descriptions verbatim from Phase 1 §1).
  - `rungs.ts` — pure `mapStory(band, facts)`: ceiling walk-down, degrade to
    history then blurb. NO fetch/storage/clock/Date.
  - `difficulty.ts` — pure `pinToleranceKm` (×1.5/×1.25/×1.0, clamps AFTER
    multiplier), `geodetectiveConfig`, `roundLengths`, `audioMode`,
    `loopsForBand`, `isLoopLocked`, `bandScoreMultiplier` (=1 always).
  - `store.ts` — SOLE owner of localStorage `meridian.ageProfile.v1`
    (schemaVersion 1): runtime validation on read, corrupt → unset default,
    10-min pending-change timeout, in-memory fallback on write failure.
  - `events.ts` — typed `ageprofile:changed` bus; game screens subscribe,
    never import the store. `index.ts` facade is the only import surface.
  - 33 unit tests (rungs/difficulty/store): ceilings, degrade paths,
    corrupt-blob fail-closed, transition invariants — all green, wired into
    `npm test`.
- `src/components/age-profile/` — lazy UI (React.lazy, zero initial bundle):
  `GrownUpGate.tsx` (arithmetic gate, keypad, 3-fail 60s cooldown),
  `AgePicker.tsx` (radiogroup, 3 cards), `AgeProfileSettings.tsx` (flow
  orchestrator — the ONLY store-mutation caller), `ReadAloudButton.tsx`
  (auto/button/off), `LockedLoop.tsx` (locked tile variant), CSS.
- Integration (followed existing patterns, no unrelated refactors):
  - Rung mapper wired into `generated-places.ts` card compose
    (`factLadder` adaptor; single-fact `kind` → one-entry ladder;
    plain-string fact → "hook"); `storyRung`/`audioAutoplay`/`factKind`
    threaded onto Starter; `storyForBand()` re-maps at card boundaries.
  - Mid-session: `requestChange(runInProgress)` stages pending-change;
    `applyPendingAtBoundary()` (facade-sanctioned) fires at each story-card
    reveal — current card untouched, next card uses the new band.
  - Pin tolerance: `pinToleranceKm(ageBand, …)` at both hit-judgment sites
    in `PlayLoaded`; review replays keep the original snapshot radius.
  - GeoDetective: `submitGuess` + `freshLoopPuzzleState` take optional band
    config (starting clues 3/1, guess cap 6/5); LoopScreen reads
    `geodetectiveConfig(resolveBand())` at each deal.
  - Home: "🔒 For grown-ups" footer entry (after review deck, before
    GrandpaCoffeeRun), locked GeoDetective dossier variant in place
    (verbatim "Ask a grown-up to open more games"), "updating…" chip while
    pending, onLoop guard, toast confirmations, read-aloud button on the
    result card.
- Gates: `npx tsc --noEmit` clean · `npm test` 889/889 pass ·
  `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green ·
  no `console.*` introduced.

## P0 fixes — architect review on the age-profile deal integration (2026-10-08)

Two P0s, both in the loop deal-config integration (zero coverage there):

- **P0-1 — 8-10's 6-guess deal vs the store validator.** `isLoopPuzzleState`
  (loop/store.ts) hard-required `guesses.length <= LOOP_MAX_GUESSES` (5),
  but the 8-10 deal plays 6 guesses — `writeLoopStoreV2` silently dropped
  any 8-10 mystery resolved on the 6th guess (win or loss), so reload
  resurrected it at 5 guesses "playing", replayable forever.
  Fix: guess caps now live in the band table
  (`BandDifficulty.guessCap`: 5-7=null, 8-10=6, 11-13=5; bands.ts);
  `geodetectiveConfig()` reads the table instead of a ternary; new
  `maxGuessCap()` (difficulty.ts, exported via the facade) derives the max
  deal cap from the table; the validator bounds `guesses.length` by it
  (loop/store.ts). Retuning a cap in bands.ts moves the bound automatically.
- **P0-2 — resume re-read the live band's deal → soft-lock.** The screen's
  deal config (`activeDealConfig`) fell back to `geodetectiveConfig(resolveBand())`
  whenever the in-memory capture was null — which is exactly the remount/resume
  case. An 8-10 mystery at 5 wrong guesses resumed under a band changed to
  11-13 (cap 5) made `submitGuess` no-op forever — no win/loss/abandon path,
  deck index lost.
  Fix: the deal-time config is persisted on the puzzle state at deal time
  (`LoopPuzzleState.dealStartClues`/`dealMaxGuesses`, optional — pre-snapshot
  stores fall back to the live band); `freshLoopPuzzleState` takes
  `(index, cycle, startClues, maxGuesses)` and snapshots both (all three deal
  sites pass the captured config's `startingClues` + `guessCap`); new
  `persistedDealConfig()` in LoopScreen resolves the store snapshot, and
  `activeDealConfig` now prefers it between the in-memory capture and the
  live band: `dealConfig ?? persistedDealConfig(store.current) ?? live ?? SAFE_DEAL_FALLBACK`.
- Tests (10 new/updated, all green): engine `maxGuesses:6` resolves on the
  6th guess (win + loss, 7th no-ops); 6-guess win AND loss survive the
  `writeLoopStoreV2` round-trip; 11-13 control (5-guess loss persists,
  7-guess blobs still rejected + dropped); resume-under-changed-band keeps
  the deal-time cap and never soft-locks (win and loss variants, asserting
  the live-band path no-ops — the old bug); pre-snapshot fallback;
  `maxGuessCap()` derivation; validator bound now 6-accepting/7-rejecting.
- Gates re-verified on the c53a658-based tree: tsc clean · `npm test` 912/912 ·
  lint-cards GATE PASSED · `npm run build:pages` green.

## Deviations from Phase 1/2 (all documented in the Phase 3 report)

1. Globe 8-10 tolerance is 937.5 km exactly (750×1.25); the Phase 1 table
   rounds to 940 for display — no rounding invented in the math.
2. 11-13 read-aloud "off" renders a quiet "🔊 Read aloud" text link instead
   of the spec'd overflow "⋯" menu (result card has no overflow menu yet).
3. Quiz round lengths (5/8/12) exposed in `roundLengths()` but NOT enforced:
   the shipped quiz is an endless run with no round concept; capping it is
   a gameplay refactor, out of scope. Same for terrain/capital/duel — params
   exposed, no tiles exist yet.
4. `mapStory` applies the 20-char minimum to `history` too (Phase 1 §2 as
   written); previously any non-empty history led the card.
5. Legacy plain-string `fact` maps to rung "hook" (lowest = visible to all
   bands), preserving pre-mapper behavior.

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
