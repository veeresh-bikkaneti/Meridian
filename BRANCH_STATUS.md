# BRANCH_STATUS — fix/coldtrail-placement-followups

Branch: `fix/coldtrail-placement-followups` · Base: origin/main @ c416187 · Created: 2026-10-10.
**PUSH OK, DO NOT MERGE** — owner merges.

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical:
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`

## Done (2026-10-10) — two owner-requested follow-ups, all gates green

### 1. Crosshair cursor defeated by MapLibre CSS — FIXED
**Root cause:** `LoopMap.tsx` set a Tailwind `cursor-crosshair` class on the map
container div, but MapLibre's stylesheet gives `.maplibregl-canvas` its own
`cursor: grab` rule. The canvas is the element under the pointer, so its rule
wins and the crosshair never rendered.
**Fix:** Set the cursor directly on MapLibre's canvas via
`map.getCanvas().style.cursor = "crosshair"` in the existing `placementActive`
effect (alongside the keyboard disable/enable). Cleared on placement end.
Removed the defeated container-level class.
**Test:** New e2e asserts computed canvas cursor is `crosshair` during
placement and not-crosshair after Escape.

### 2. Disjoint-rings centroid marker suppressed — FIXED
**Root cause:** When the 3 locked rings shared no common area, the overlap
lens rendered a gold centroid dot. The centroid is geometrically meaningless
when rings are disjoint — the dot reads as a fake "answer" point.
**Fix (owner's call: suppress):** No centroid dot and no pulse when disjoint.
The rings stay visible so the player can adjust. Hint copy is now honest:
"All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift
it closer." (was: "tap where they cross"). The `tripleOverlap` geometry
function is unchanged (centroid still computed as the pulse anchor when a
real polygon exists).
**Tests:** New e2e locks 3 far-apart rings → asserts no `overlap-centroid`
feature, no polygon, no pulse, and the honest hint copy. Unit test names
updated (centroid no longer a "fallback marker").

## Gates (final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1082/1082 pass
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green (`dist/client/_shell.html` exists)
- [x] Playwright coldtrail: 8/9 pass (2 new tests green); mobile 4/4 pass
- [x] Locked copy: untouched (4 changed files contain no locked strings)
- [x] Zero console errors in passing runs

## Known pre-existing failure (NOT caused by this branch)
`coldtrail.spec.ts` » "full slice" fails on unmodified origin/main@9b0a8a1
(verified via `git stash`): the overlap source has 0 features after 3 locks.
Pre-dates this branch; unrelated to the crosshair/centroid changes.

## Rebase 2026-10-10 (d045128)
- Rebasing onto origin/main@ce88939 (#122 merged) — clean, zero conflicts (1 commit replayed).
- Gates on d045128: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1082/1082 · Playwright coldtrail 8/9 (1 pre-existing "full slice" failure, fails on unmodified main too) · locked copy byte-identical.
