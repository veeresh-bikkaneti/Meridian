# BRANCH_STATUS.md — feat/geodetective-unlimited

**Branch:** `feat/geodetective-unlimited` (off `origin/main` @ `f0db7ba`, post-#70 Detective's Atlas merge)
**Task:** GeoDetective goes FULLY UNLIMITED (Veeresh decision, 2026-10-06). The one-mystery-per-day model is dead — no daily gate, no UTC rollover. Players solve mystery after mystery.
**Status:** 🟢 BUILD PHASE (spec approved → developer implementing)

## Crew
- **Orchestrator:** branch hygiene, quality gates, E2E, software-architect review, PR, completion report
- **Agent 1 — Game Designer:** ✅ spec delivered (`~/workspace/your_files/geodetective-unlimited-spec.md`); playtest sign-off pending post-build
- **Agent 2 — Game Developer:** 🟡 implementing spec in `src/game/loop/` + unit tests

## What's done
- [x] Fresh worktree at `~/workspace/meridian-worktrees/geodetective-unlimited`, branch off origin/main (f0db7ba)
- [x] Code study: `src/game/loop/` (LoopScreen, engine, store, day, types), `share.ts`, entry point (`game-app.tsx:1453` "Solve today's mystery"), E2E specs (`geodetective.spec.ts`, `geodetective.reduced.spec.ts`)
- [x] Game Designer: unlimited-mode mechanic spec v1 (deal flow, Next-mystery moment, streak, share, entry rename, storage versioning, 9 edge cases, 10 playtest failure states, 4 flippable calls for Veeresh)

## What's pending
1. Designer: mechanic spec (deal flow, Next-mystery moment, streak, share, entry rename, storage versioning, edge cases)
2. Developer: implement spec (no gameplay logic until spec lands)
3. Unit tests: deal/progression/storage/streak, no-repeat-until-exhausted, reshuffle, persistence round-trip
4. Designer playtest sign-off (via dev server)
5. Full Playwright E2E via `flock ~/workspace/.e2e.lock --workers=1`: two-consecutive-mysteries spec, reload-persistence spec, existing GeoDetective specs, no regressions in Globe/Country/State
6. Software-architect review — zero blockers
7. Open PR (Veeresh merges — do NOT merge)

## Non-negotiables (untouched by this change)
5 guesses, clue ladder Geography→Climate→History→Hook→Giveaway, Detective's Atlas satellite map, rings + direction arrows, duplicate blocking, ocean-tap fail-closed, screen-reader announcements, kid-friendly blurbs.
