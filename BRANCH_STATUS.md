# BRANCH_STATUS — feat/geodetective-loop

Cold Trail vertical slice: the GeoDetective-style smuggler-triangulation loop.
One case = 3 timestamped sightings → place 3 radius rings → tap the
interception guess → score reveal (km from the true hideout).

## Done (frontend developer)
- Case deck generator `scripts/build-coldtrail.mjs` → `src/game/coldtrail/cases.generated.json`
  (60 cases, deterministic seed; hideout = difficulty-2 real city 50k–2M pop;
  3 witness anchors ≥300k pop, 250–4000 km, spread octants; radius vague by
  difficulty — 25 km steps tier 2, 50 km tier 3).
- Runtime: `src/game/coldtrail/` — types, cases (fail-closed validation),
  engine (score/verdict/informant math, pure), store (`meridian.coldtrail.v1`,
  fail-open), `TrailScreen`, `SightingCard`, `InterceptConfirm`.
- `LoopMap` extended with optional Cold-Trail props only: `freeTap` +
  `onMapTap` (raw-coordinate taps, no place-index fetch), `evidenceRings` /
  `evidenceMarks` (witness rings via existing ringPolygon + gold dots),
  `mapLabel`. Default loop behavior untouched.
- Menu: "❄️ Cold Trail" dossier card → `TrailScreen` (own screen branch in
  game-app.tsx, like the loop edition).
- Paid informant included (trivial): 1⭐ tightens one ring 50%; wallet starts
  at 2⭐, +1⭐ per closed case.
- Tests: engine/cases unit (7), build-script test (2),
  e2e `tests/e2e/coldtrail.spec.ts` (2, project `coldtrail` in playwright.config).

## Done (QA tester, commit 4b628df)
- `store.test.ts` + `edge.test.ts` (22 tests), package.json test-script wiring.
  Cold Trail suite: 29/29 green.

## Gates (all on the combined tree)
- `tsc --noEmit`: clean
- `npm test`: scripts 478 (471 pass, 0 fail) · src 866/866 pass
- `node scripts/lint-cards.mjs`: GATE PASSED
- `npm run build:pages`: green
- Playwright: coldtrail 2/2 pass; geodetective 15/15 pass (2 infra flakes —
  trace-file ENOENT on context close — green on retry, unrelated to this change)

## Pending / open
- No merge, no push (per task instructions).
- Deferred per pitch: 30s blitz mode, 10min chain mode, streak multipliers.
- Judgment call: difficulty-3 hideouts skipped — in this dataset tier 3 is
  overwhelmingly city districts/small towns (verified); tier-2 real cities
  match the "recognizable but not trivial" intent.
- `scripts/build-coldtrail.mjs` is NOT wired into prebuild; the generated JSON
  is checked in and re-runnable via `node --experimental-strip-types`.
