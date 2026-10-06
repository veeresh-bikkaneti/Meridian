# BRANCH_STATUS.md — feat/geodetective-unlimited

**Branch:** `feat/geodetective-unlimited` (off `origin/main` @ `f0db7ba`, post-#70 Detective's Atlas merge)
**Task:** GeoDetective goes FULLY UNLIMITED (Veeresh decision, 2026-10-06). The one-mystery-per-day model is dead — no daily gate, no UTC rollover. Players solve mystery after mystery.
**Status:** 🟡 E2E PHASE — designer signed off; full Playwright suite running under flock lock

## Crew
- **Orchestrator:** branch hygiene, quality gates, E2E, software-architect review, PR, completion report
- **Agent 1 — Game Designer:** ✅ spec delivered + ✅ playtest sign-off (48/48 scripted checks; 2 non-blocking nits — reveal auto-scroll FIXED by orchestrator, seam-reload heads-up is E2E-author-only)
- **Agent 2 — Game Developer:** ✅ implementation complete, all gates green, pushed to origin (completion delivery hit a runtime hiccup; work intact in git)

## What's done
- [x] Fresh worktree at `~/workspace/meridian-worktrees/geodetective-unlimited`, branch off origin/main (f0db7ba)
- [x] Code study: `src/game/loop/` (LoopScreen, engine, store, day, types), `share.ts`, entry point (`game-app.tsx:1453` "Solve today's mystery"), E2E specs (`geodetective.spec.ts`, `geodetective.reduced.spec.ts`)
- [x] Game Designer: unlimited-mode mechanic spec v1 (deal flow, Next-mystery moment, streak, share, entry rename, storage versioning, 9 edge cases, 10 playtest failure states, 4 flippable calls for Veeresh)
- [x] Developer: implemented per spec — v2 deck store (`meridian.loop.v2`, Fisher–Yates via `crypto.getRandomValues`, 404 rollback, fail-closed validation, v1 archive inert), `?loop-puzzle=` seam (`?loop-date=` removed), LoopScreen deal/resume/Next-mystery/reveal rework, entry copy ("🔎 Solve a mystery" / "▶️ Resume your case" + streak line)
- [x] Unit tests: 71 loop tests (deck exactly-once over 387, reshuffle cycle++, rollback, blocked-storage fallback, streak transitions, round-trip, v1-inert, full-session engine integration); full suite 711/711 green
- [x] Quality gates: `npx tsc --noEmit` clean, `node scripts/lint-cards.mjs` GATE PASSED, `npm run build:pages` green
- [x] E2E specs rewritten per §6 (real-deck win AND loss paths, Next-mystery different-puzzle asserts, resume, finished-reveal reload, copy regression) — NOT yet run (orchestrator runs under flock after playtest)
- [x] Commits pushed to origin (see log)

- [x] Orchestrator: designer playtest nit fixed — reveal card scrolls into view on completion (reduced-motion aware)
- [x] `npm run build:pages` green on final code (buildId 06be340)

## What's pending
1. ~~Designer: mechanic spec~~ ✅ delivered
2. ~~Developer: implement spec~~ ✅ done
3. ~~Unit tests~~ ✅ done (deal/progression/storage/streak, no-repeat-until-exhausted, reshuffle, persistence round-trip)
4. ~~Designer playtest sign-off~~ ✅ signed off (48/48 checks)
5. Full Playwright E2E via `flock ~/workspace/.e2e.lock --workers=1` — 🟡 RUNNING
6. Software-architect review — zero blockers required
7. Open PR (Veeresh merges — do NOT merge)

## Non-negotiables (untouched by this change)
5 guesses, clue ladder Geography→Climate→History→Hook→Giveaway, Detective's Atlas satellite map, rings + direction arrows, duplicate blocking, ocean-tap fail-closed, screen-reader announcements, kid-friendly blurbs.
