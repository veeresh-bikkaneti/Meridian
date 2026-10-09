# BRANCH_STATUS — feat/quick-fixes-2026-10-09

Quick-fix sprint (Frontend/Webapp Developer) on top of origin/main@4c3e83e
(#110 age-profile merged). Two code fixes only: FIX B (round lengths) and
FIX C (grown-ups entry). Local branch; push + PR handled by the
coordinator after the Tester runs the Phase 2 gates. Merge stays the
user's call.

NOTE: the file previously described feat/age-profile-studio (its content
was carried onto this branch via main@4c3e83e). It now tracks THIS branch.

## Done

### FIX B — Round lengths: `pinsPerRun` in the difficulty data
- `src/game/age-profile/types.ts`: added `pinsPerRun: number` to
  `BandDifficulty`.
- `src/game/age-profile/bands.ts`: added `pinsPerRun` per band — 5-7 → 5,
  8-10 → 8, 11-13 → 12 (mirrors the `quizQuestions` column exactly).
  Existing table verified unchanged (quizQuestions 5/8/12, terrainImages
  4/6/8, capitalQuestions locked/8/12); parent-facing `description` strings
  untouched (design-agreed copy, ≤140 chars).
- `src/game/age-profile/difficulty.ts`: `pinsPerRun` added to
  `RoundLengths` and returned by `roundLengths()`.
- **ASPIRATIONAL / DATA-ONLY (Game Designer ruling):** the shipped
  quiz/main run is endless by design — it does NOT consume `pinsPerRun`
  (or `quizQuestions`). Capping the run is out of scope (a game-loop
  redesign). The value is exposed as a design target for future
  round-structured loops; nothing consumes it today (`roundLengths` has no
  consumers outside the age-profile index). Deliberately NOT wired into any
  run loop — no new game modes invented.
- `src/game/scoring.ts` left untouched: scoring is band-identical by design
  (`bandScoreMultiplier` returns 1) and the scoring display path is
  separate surface from this change. Designer note recorded for later: any
  future player-facing score from these loops must be %-only (4/5 = 6/8 =
  75%), never raw points (cross-band comparison trap).
- Regression test (P0-2) in `src/game/age-profile/store.test.ts`: start
  5-7 (pinsPerRun 5) → requestChange to 8-10 mid-run → staged; the running
  round still resolves 5; after `applyPendingAtBoundary()` the next run
  resolves 8. No soft-lock, finish count never changes mid-run.
- `src/game/age-profile/difficulty.test.ts`: pinsPerRun assertions per band.

### FIX C — Grown-ups entry
- **Cooldown persistence:** `src/components/age-profile/cooldown.ts` (new) —
  one timestamp under `meridian.grownupCooldown.v1` (namespaced like
  `meridian.ageProfile.v1`), zero PII (COPPA-safe). `writeCooldown` on
  cooldown start; `readCooldown` resumes a live deadline on remount and
  DELETES expired/absent/malformed values (never resurrects);
  `clearCooldown` when the cooldown ends (expiry leaves no key behind).
  Unit tests: `src/components/age-profile/cooldown.test.ts` (round-trip,
  still-cooling-after-remount, expired/malformed → null + key deleted,
  expiry cleanup). Registered in package.json's test script.
- `src/components/age-profile/GrownUpGate.tsx`: hydrates `cooldownUntil`
  from storage at mount (tick effect computes the live countdown from it,
  so the restored path is identical — stale timestamps self-resolve on the
  first tick); cooldown UI text unchanged ("Take a breath — try again in N
  seconds." + the no-permanent-lockout reassurance, no punishment tone).
  Mount-time focus now targets the cancel button when resuming a cooldown
  (the input isn't rendered during cooldown, so focus never lands on body).
- **Preserved exactly as written:** `newQuestion()` two-digit operands
  r(11,19)/r(12,29); `check()` early-returns when cooling (a 4th submit
  during cooldown is silently ignored); the digits/Backspace/Enter keyboard
  path and the Enter-on-`HTMLButtonElement` double-count guard; all aria
  roles (`dialog`/`aria-modal`/`aria-labelledby`, cooldown `role="status"`,
  error `role="alert"`, question `aria-live="polite"`).
- **Symmetric gating — verified by construction (no runtime test seam in
  the node:test harness; no DOM renderer configured):** `AgeProfileSettings`
  is the ONLY caller of the store mutations (`setBand`, `requestChange`,
  `resetProfile`), and its flow unconditionally starts at the `gate` step
  (GrownUpGate) before any picker/confirm — so EVERY effective band change,
  upgrade OR downgrade, passes the math gate. Both entry surfaces (home
  footer "For grown-ups" link and LockedLoop's `onGrownUpOpen`) open the
  same `openAgeSettings` flow; `applyPendingAtBoundary()` in game-app.tsx
  only applies changes that already passed the gate at staging time.

## Deferred (do not implement on this branch)
- Consuming `pinsPerRun` in any run loop; per-band progress indicators;
  second gated surface / third grown-ups entry point; duel 60s countdown;
  %-normalized per-run results display (scoring surface is separate);
  COPPA band-id event-payload check.

## Gates (local, run on this branch)
- `npx tsc --noEmit` — clean
- Related unit tests (age-profile rungs/difficulty/store + cooldown) — green
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
