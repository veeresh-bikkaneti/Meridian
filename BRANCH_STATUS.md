# BRANCH_STATUS — fix/crash-report-background-classification (2026-10-12)

**PUSH OK, DO NOT MERGE** — owner merges.

## What this fixes (plain language)

Two Android crash reports arrived with the identical signature: `suspected_crash`,
no error, last milestone `storyteller_ready`. Investigation showed the crash
reporter **cannot tell the difference** between two very different events:

1. Android killing the tab while the game is on screen (a real problem), and
2. Android killing a *backgrounded* tab for memory (routine phone behavior —
   the user switches apps or locks the phone, the OS reclaims the tab).

Both look exactly the same in the report. Chasing a memory bug from this
evidence would be guessing.

**The fix makes every future report self-classifying:**
- The app now records a `backgrounded` milestone when the tab is hidden and a
  `foregrounded` milestone when it returns.
- A future `suspected_crash` ending at `backgrounded` = the OS killed a
  backgrounded tab (expected, not a bug). Anything else = a real foreground
  kill worth investigating.

**Companion fix found during verification:** the `storyteller_ready` milestone
was being re-recorded on *every React render* (the `onLoaded` callback was an
inline arrow, so the mascot's preload effect re-ran each render). That spammed
the breadcrumb trail and would have overwritten the new `backgrounded`
milestone. Both call sites now use a stable `useCallback` — the milestone
fires once, when the figure actually loads.

## What changed (files)

- `src/lib/observability.ts` — `backgrounded`/`foregrounded` milestones;
  `visibilitychange` listener installed once in `init()` (injectable document
  for tests; silent no-op without a DOM).
- `src/lib/observability.test.ts` — 4 new unit tests.
- `src/components/storyteller.tsx` — stable `handleFigureLoaded` callback.
- `src/components/storyteller-home.tsx` — stable `handleFigureLoaded` callback.
- `tests/e2e/crash-classification.mobile.spec.ts` — new black-box E2E spec.

## What was verified

- [x] `npx tsc --noEmit` clean
- [x] `npm test` — 1190/1190 (incl. 4 new visibility tests)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` green
- [x] New E2E spec passes on rebuilt dist (mobile 390×844)
- [x] Existing storyteller E2E suite: 6/6 (narration watchdogs untouched)
- [x] Full next-boot classification path covered by unit test
      (backgrounded trail → `suspected_crash` carries `lastMilestone: "backgrounded"`)

## Deliberately NOT changed

- The #136 narration watchdogs and audio paths are untouched (verified by the
  6/6 storyteller suite).
- The crash-report worker needs no change — `lastMilestone` is already
  forwarded; "backgrounded" reads clearly in the Discord alert.
- No memory "optimization" was shipped on a guess. The sprite sheets
  (12.6 MB decoded) and the map are the real memory holders, but shrinking
  them without proof of the kill mechanism would be theater.

## Pending

- [ ] Scrum panel review
- [ ] Rebase to zero conflicts + full suite re-run
- [ ] Screen recording of verification
- [ ] Open PR (never merge)
