# BRANCH_STATUS.md — fix/hint-default-on

## What
Issue #182: the hint bulb never appeared for any player who had not
set an age profile — every fresh visitor. The unset profile resolved
to the 11-13 band, whose hint policy is "none", so the hint panel
rendered nothing and nobody was told hints exist.

Owner decision, 2026-10-20: "Change the default so everyone gets the
hint bulb". — "we dont check the age of the player, so we need the
hints on by default"

Fix: a run with NO age profile set now snapshots the hint policy
"one-per-round" (the bulb shows, one hint per place — the 8-10 shape).
Everything else about the default stays exactly as it was.

## The bug, plainly
- The game never checks the player's age. The "band" comes from a
  parent-set profile stored on the device; most players never set one.
- With no profile, the run config resolved through the 11-13 row of
  the policy table — "none" — so `HintPanel` returned null. The bulb
  was off by default for almost everyone, silently.
- Found by the owner playing the live site; confirmed by a fresh-
  profile inspection of production (Globe game: End game present,
  no bulb anywhere).

## Done (2026-10-20)
- `src/game/age-profile/run-config.ts`: new named constant
  `DEFAULT_HINT_POLICY = "one-per-round"` with the owner's words and
  the why in plain language. `getBandConfig(null)` now carries it;
  `getBandConfig("11-13")` still carries "none" — an explicit 11-13
  profile is a parent's deliberate choice and is NOT overridden.
  The snapshot's `band` field still records "11-13" for unset runs,
  and every other number (rounds, tolerance, clues, duel seconds)
  is byte-identical to before.
- Snapshot sites now pass the profile's RAW band (`loadProfile().band`,
  null when unset) instead of the pre-resolved band, so the default
  actually reaches the snapshot: `src/game/run.ts` (run start + the
  pre-snapshot resume backfill) and `src/game/loop/store.ts`
  (GeoDetective deal). For any explicitly set profile the snapshots
  are unchanged, value for value.
- `src/game/loop/LoopScreen.tsx`: GeoDetective now reads the hint
  policy from the mystery's own persisted deal snapshot
  (`puzzle.dealBandConfig.hintPolicy`) — the deal-time source the
  #113 contract always intended — falling back to the old recompute
  only for pre-snapshot puzzles. A no-profile player's GeoDetective
  bulb therefore shows too; a mystery dealt BEFORE this fix keeps
  the policy it was dealt with until the next deal (snapshot rules).
  The quiz follows the same snapshot rule: a run already in flight
  when this deploys keeps the policy it started with, so for quiz
  players the bulb appears from their next run.
- Consumer audit (each verified in code):
  - `hintButtonState` / `canUseHint`: pure functions of the policy —
    "one-per-round" gives visible → disabled-after-one-use. ✓
  - `mascotOffersHint`: fires only for "free" (5-7) — the default
    policy can never trigger the mascot offer. Proven by unit pin
    at several miss counts. ✓
  - Quiz dock (`game-app.tsx`): reads the run snapshot's policy —
    the bulb now renders in the bottom-right dock during aim. ✓
  - Clean Round badge (`passport/badges.ts`): keys off the snapshot
    BAND field (still "11-13") + hints used + win — never the policy.
    A default player who uses a hint gets no badge (same as any
    hint user); one who never taps still earns it. No change needed
    and none made; existing unit pins cover both cases. ✓
  - Everything else that reads the band (`resolveBand` consumers:
    loop locks, pin tolerance, read-aloud mode, story mapping,
    GeoDetective clue/cap config): untouched — `resolveBand` itself
    did not change, and the snapshot's band field did not change,
    so the ONLY behavioral delta is hint availability for
    unset-profile runs. ✓
- Unit tests: run-config gate updated deliberately (the gate's own
  header says intentional changes update it) — the unset contract is
  now "production numbers + hintPolicy one-per-round"; new pins for
  null-vs-explicit-11-13 (identical except the policy), bulb state
  under the default, mascot-offer exclusion; startRun/resume snapshot
  pins for unset (hints on) and explicit 11-13 (hints off); the loop
  store snapshot pin now mirrors the production call. Mutation check:
  reverting the one-line policy change fails 10 of the 20 tests in
  the two config test files.
- E2E: new tests in `tests/e2e/hint-button.spec.ts` (no profile →
  bulb visible in the aim dock → tap → directional hint shows →
  button disables) and `tests/e2e/geodetective-hint.spec.ts`
  (no profile → same flow in GeoDetective). The explicit-11-13
  "no bulb" pins already in both specs still stand.
- Docs: this file; the stale comments in run-config.ts / run.ts /
  loop store / LoopScreen / hint-panel now describe the default
  honestly; handbook chapter 02 gained section 13 recording the
  per-band hint policy (owner 2026-10-09) and the 2026-10-20 ruling
  that supersedes its default behavior.

## Post-panel (2026-10-20)
- Panel verdict: READY, zero BLOCKs. The owner chose the panel's
  optional docs cure + a re-vote before merging: "Add the small docs
  cure, re-vote, then merge".
- Rebased onto origin/main `89e474c` (PR #179 landed after this
  branch was cut): the only conflict was this file; resolved by
  keeping this branch's record.
- Docs cure applied: the stale `getBandConfig(resolveBand())`
  headers corrected (run-config.ts, loop/types.ts) to describe the
  raw-band snapshot; `DEFAULT_HINT_POLICY` re-exported from the
  age-profile barrel; the quiz in-flight-run caveat added here and
  in handbook §13; the owner's quoted words now contain exactly his
  words (periods outside the quote marks) in this file, handbook
  §13, and run-config.ts; §13's paraphrase-in-quotes replaced with
  the real hint string ("Look toward the northern part of the
  map!").

## Pending
- Rule-13 re-vote on this cured tip (panel). The owner's merge word
  is GIVEN, conditional on that re-vote returning READY.
- Merge after the re-vote.

## Gates (2026-10-20, this branch)
- `npx tsc --noEmit` — clean.
- `npm test` — green: scripts suite 799 tests (790 pass, 9 skip,
  0 fail); src suite 1,366 pass, 0 fail.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — green.
- Playwright (built artifact, --workers=1, VITE_KOFI_URL set):
  hint-button (11) + geodetective-hint (5) + clean-round-badge (4)
  combined run 20/20; age-profile-gate desktop spec 1/1;
  geodetective main spec 18/18. One transient failure in an early
  combined run — the pre-existing "11-13: no hint button at all" test
  failed inside the `startGlobeRun` setup helper (helpers.ts:156)
  under heavy VM load immediately after a service restart; the clean
  combined re-run passed 20/20, including that test. (Corrected
  2026-10-20: an earlier draft of this note misattributed the flake
  to the new GeoDetective default test.)
