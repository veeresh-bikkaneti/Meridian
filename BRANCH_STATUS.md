# BRANCH_STATUS — fix/entry-home-landing

- **Branch:** `fix/entry-home-landing` · **Base:** `main` @ `9e49da3` (PR #365 merged + live; re-checked via gh api at branch start — main had not moved)

## Task capsule

TASK / requested outcome: Owner order (Veeresh, 2026-11-08): "Page by
default is loading GeoDetective — we should always push the player onto
homescreen." A bare visit must always land on Home. An in-flight
GeoDetective case is offered back on Home as "Resume your case" (the
designed PR #365 behaviour); an in-flight Cold Trail case gets the
mirrored offer on its Home card.

VERIFIED MECHANISM (evidence: `~/workspace/meridian-entry-evidence/`):
localStorage flag `meridian.loop.open`="1", read at first render in
`src/components/game-app.tsx` (`useState(() => readLoopOpen())`); render
precedence put LoopScreen ahead of Home. Flag set on card tap, cleared
only on explicit leave — so any later visit (new tab, next day) booted
straight into GeoDetective, and the flag alone (no store) auto-dealt a
fresh case. Cold Trail twin: `meridian.coldtrail.open`.

Interpretations considered and selected reading:
- Challenge links `#c=` are explicit intent (a tapped link) — mc1 direct
  entry stays untouched.
- A deliberate refresh now also lands on Home (with the Resume offer) —
  the owner's words are "always push the player onto homescreen", with
  no refresh exception.
- sessionStorage map-run restore (`meridian.run` etc.) is a separate
  same-session mechanism — out of scope, untouched.

Tier and rationale: Tier 1/2 boundary — a routing bug with a verified
mechanism and a brief that names exact files and acceptance; built solo
per the dispatch brief, checker = the parent-run review pipeline.

Files in scope: `src/components/game-app.tsx`,
`src/game/loop/store.ts`, `src/game/loop/types.ts`,
`src/game/coldtrail/store.ts`, their unit tests, the E2E specs that
pinned reload-resume, the new entry-routing E2E spec, README +
`docs/geodetective.md` + handbook decision record, this file.
Protected / out of scope (NOT touched): `DetectiveHost.tsx`,
`detective-state.ts`, `companion.ts`, `follow.ts`, challenge `#c=`
handling, sessionStorage run restore.

## The fix

1. `loopOpen` / `coldTrailOpen` boot state is `false` on every visit —
   the persisted open flags are never read at boot.
2. `readLoopOpen`/`writeLoopOpen` and `readColdTrailOpen`/
   `writeColdTrailOpen` are removed with all call sites (they became
   dead). The key constants stay, documented as legacy, only so the
   "Start over" reset can delete stale values from older versions.
3. Cold Trail reachability: TrailScreen already resumes an in-flight
   case from its store when opened, but Home gave no sign of it. Added
   `peekColdTrailProgress()` (mirrors `peekLoopProgress`, read-only, no
   migration side effects) and the Cold Trail Home card now offers
   "Resume your trail" when a case is mid-play in either deck's store.

## Status

- [x] Source fix (game-app boot state, flag read/write removal, Cold Trail peek + Home resume label)
- [x] Unit tests re-pinned / added (lazy-boundary pins, coldtrail peek tests, loop peek flag-alone test)
- [x] E2E specs re-pinned (geodetective, geodetective-hint, scout-toggle BLOCK-4, reset-history, chunk-boundary-copy)
- [x] NEW E2E written: entry-routing spec at 390 + 768 + 1280 with render-level screenshots (run pending gates below)
- [x] Docs: README, docs/geodetective.md, handbook ch.02 decision record ("Entry always lands on Home")
- [x] Gates (all run on this branch, sequential E2E under flock, `--workers=1`):
  - `npx tsc --noEmit` — clean
  - `npm test` — scripts 1032 tests (1021 pass, 0 fail) + src 2269/2269 pass
  - `npm run test:worker` — 145/145 pass
  - `node scripts/lint-cards.mjs` — GATE PASSED
  - `npm run build:pages` — green
  - E2E new entry-routing spec — 16/16 pass, 22 screenshots in `tests/e2e/evidence/entry-routing/`
  - E2E regression: geodetective-hint 6/6 · chunk-boundary-copy 2/2 · reset-history + scout-toggle + coldtrail 28/28 · friend-challenge mc2-boot 5 pass + 1 scripted-manual skip · friend-challenge desktop: 3 tests failed twice under VM load 14–20 (timeouts / browser-closed), then passed 3/3 on this branch at healthy load and 3/3 on unmodified main — contention flake, evidenced
  - E2E known pre-existing failure (not this change): geodetective.spec "win path" share-URL assertion expects the Workers origin; a `build:pages` artifact bakes the Pages origin into share text (`src/game/share.ts` reads Vite `BASE_URL`; that file and the build are untouched by this PR, so the assertion fails identically on main with a Pages build)
- [x] PR opened: #368 — https://github.com/veeresh-bikkaneti/Meridian/pull/368
