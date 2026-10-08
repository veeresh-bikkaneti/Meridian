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
