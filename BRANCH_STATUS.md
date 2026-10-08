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
- No merge, no push (per task instructions — PAT handoff is the parent's call).
- Pre-merge prep (rebased onto origin/main ae524e3 via --onto; base 7de5cc8 was
  rewritten upstream):
  - package.json test-script union (kept grandpa-tour.test.ts from main +
    coldtrail suites); game-app.tsx kept Cold Trail card + main's
    data-testid="tour-stop-editions"; BRANCH_STATUS kept branch version.
  - Fuzzy-radius: Math.round → Math.ceil (player-fair; deck regenerated,
    60 cases; generator test updated to ceil semantics).
  - A11y pass: focus into InterceptConfirm on open; focus result heading on
    reveal + case heading on next case; informant button now renders disabled
    with reason when unaffordable (was hidden); --gold-ink theme token fixes
    gold-text contrast in light mode (#8a6410). Reduced-motion already gated
    (home-rise, map flyTo). Known limit: map tap is pointer-only (shared
    LoopMap; same as the base loop edition) — keyboard crosshair is follow-up.
  - Gates re-run on rebased tip: tsc clean, npm test full green, lint-cards
    GATE PASSED, build:pages green, Playwright coldtrail 2/2.
- Deferred per pitch: 30s blitz mode, 10min chain mode, streak multipliers.
- Judgment call: difficulty-3 hideouts skipped — in this dataset tier 3 is
  overwhelmingly city districts/small towns (verified); tier-2 real cities
  match the "recognizable but not trivial" intent.
- `scripts/build-coldtrail.mjs` is NOT wired into prebuild; the generated JSON
  is checked in and re-runnable via `node --experimental-strip-types`.
