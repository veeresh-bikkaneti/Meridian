# feat/reveal-pin-compare — status

Veeresh's request: on a wrong-answer reveal, name BOTH locations — "Your pin: Nebraska · True spot: District of Columbia." Today the card shows distance + pins but never names the player's pick.

Base: `origin/main` at `aa69434`.

## Plan
- [x] Worktree + branch `feat/reveal-pin-compare`; node_modules symlinked (never npm install); AGENTS.md read
- [x] Exploration: ResultCard miss block (`run.phase === "done"`), `Drop` has player pin lon/lat, `place` has true spot lon/lat, `territoryAt()` exists for country lookup, admin-1 data vendored (us-atlas states-10m, src/map/data/ne-50m-admin-1.json for AU/BR/CA/CN/IN)
- [x] Worker A: `src/game/reverse-geocode.ts` — `preloadAdmin1Boundaries()`, `resolvePin()`, `pinCompareLine()` + unit tests (11 tests green; data verified: DC present in us-atlas; world-atlas names the USA "United States of America")
- [ ] Worker B: result-card wiring + `openRun` preload hook + card tests
- [ ] Gates: typecheck → build → tech-arch review → tone/docs/a11y review → E2E → PR → merge → live verify

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
