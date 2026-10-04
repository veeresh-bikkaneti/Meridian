# feat/reveal-pin-compare — status

Veeresh's request: on a wrong-answer reveal, name BOTH locations — "Your pin: Nebraska · True spot: District of Columbia." Today the card shows distance + pins but never names the player's pick.

Base: `origin/main` at `aa69434`.

## Plan
- [x] Worktree + branch `feat/reveal-pin-compare`; node_modules symlinked (never npm install); AGENTS.md read
- [x] Exploration: ResultCard miss block (`run.phase === "done"`), `Drop` has player pin lon/lat, `place` has true spot lon/lat, `territoryAt()` exists for country lookup, admin-1 data vendored (us-atlas states-10m, src/map/data/ne-50m-admin-1.json for AU/BR/CA/CN/IN)
- [x] Worker A: `src/game/reverse-geocode.ts` — `preloadAdmin1Boundaries()`, `resolvePin()`, `pinCompareLine()` + unit tests (11 tests green; data verified: DC present in us-atlas; world-atlas names the USA "United States of America")
- [x] Worker B: result-card wiring + `openRun` preload hook + card tests (result-card.tsx: `pinLine` useMemo + `data-testid="pin-compare-line"` under the miss distance `<p>`, fail-closed on null; game-app.tsx: `void preloadAdmin1Boundaries()` in `openRun` after `setMenu(null)`; 4 new renderToString card tests green — Nebraska/DC line, same-state line, null fail-closed, no line on hit. Gates: tsc clean, 490/490 unit tests, build:pages green)
- [ ] Gates: typecheck ✓ → build ✓ → tech-arch review ✓ PASS-WITH-NOTES → tone/docs/a11y review ✓ PASS-WITH-NOTES → E2E ✓ (2026-10-04) → PR → merge → live verify

## E2E — `tests/e2e/reveal-pin-compare.desktop.spec.ts` (2026-10-04, 4/4 green)
- miss in another country → card shows `pin-compare-line` = "Your pin: Bahia · True spot: Colombia" (seeded deal: El Tambo, Colombia; Bahia pin at 580,490)
- hit → no `pin-compare-line` element
- mid-ocean miss → no line; card otherwise identical (distance, subscript, source link)
- same-state miss (Nebraska drill-down) → "Right state, wrong town!"
- Determinism: globe deal is a per-session shuffle, so the spec seeds Date + Math.random + crypto.getRandomValues (mulberry32) via addInitScript — first place stable as "El Tambo, Colombia" across runs. Miss pins are fixed viewport points probed against the live camera/tap path; assertions use auto-retrying expect (line appears once the admin-1 preload resolves), no sleeps.
- Harness note: the shared VM runs several crews' Playwright suites concurrently (load avg 8–13); the spec uses a local `startGlobeRunPatient` (60 s map-mount waits, helpers.ts untouched) to stay deterministic under contention. The reveal camera was not touched (sibling crew owns it).
- Regression: `gap-view-reveal.desktop.spec.ts` re-run 2026-10-04 → 1 passed / 2 failed; both failures are camera/reveal-timing assertions (zoom level "2" vs "1"; phase timeout on tap-skip), not card content — the "hit" card test passed, so the pin-compare card changes are not the cause. Noted for the camera crew, not fixed here.

## Review dispositions (both PASS, no blockers — 2026-10-04)
- Tech-arch: lon/lat ordering verified correct at every boundary; same-admin1 branch airtight (caches are country-disjoint); fail-closed everywhere; jetsam constraint honored (no import-time JSON; ne-50m emitted as its own 1.4 MB lazy chunk). Notes: (1) loader duplication with `src/map/boundary-bands.ts` — genuine DRY note, deferred as tech debt (both lazy/post-boot, no crash risk; a shared loader would touch the sibling crew's map area); (2) inaccurate "done phase" comment — fixed; (3) card-test mock reimplements `pinCompareLine` — declined with reason: exact copy strings are asserted against the real module in `reverse-geocode.test.ts`, so drift is caught at the module boundary; component tests correctly mock at the module seam; (4) antimeridian/poles untested — guarded by try/catch, coverage note only; (5) US "Georgia" pin vs country Georgia → "Your pin: Georgia · True spot: Georgia" — odd, not incorrect, left as-is.
- Tone: "Right state, wrong town!" reads as a lesson, not a taunt; "United States of America" acceptable kid-facing copy (normalization, if ever wanted, lives in `reverse-geocode.ts` only, never `territory.ts`); placement/reading order correct; no live region needed; no new contrast debt.

## API contract (workers A and B build to this)
```ts
// src/game/reverse-geocode.ts
export type ResolvedPin = { admin1: string | null; country: string | null };
export function preloadAdmin1Boundaries(): Promise<void>; // idempotent, fire-and-forget in app, awaited in tests
export function resolvePin(lat: number, lon: number): ResolvedPin | null; // sync, never throws
export function pinCompareLine(player: ResolvedPin | null, truth: ResolvedPin | null): string | null;
```
- `pinCompareLine` returns null (render nothing) when either side unresolvable — fail closed.
- Same admin1 (+same country) → "Right state, wrong town!"; same country only → "Right country, wrong town!"; else "Your pin: {X} · True spot: {Y}" (admin1 preferred, country fallback).

## Constraints
- Admin-1 JSONs load ONLY via dynamic import inside preload (never static import — Safari jetsam lesson). `resolvePin` never triggers loading; unloaded → admin1 null.
- Do NOT touch the reveal camera / satellite-map / motion code — sibling crew `fix/wrong-answer-reveal-zoomout` owns it. Read-only.
- New test files must be registered in the `npm test` script list in package.json.
- Kid-friendly tone, no shaming, on every new word.
