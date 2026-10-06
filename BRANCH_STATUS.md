# BRANCH_STATUS.md — feat/geodetective-unlimited

**Branch:** `feat/geodetective-unlimited` (off `origin/main` @ `f0db7ba`, post-#70 Detective's Atlas merge)
**Task:** GeoDetective goes FULLY UNLIMITED (Veeresh decision, 2026-10-06). The one-mystery-per-day model is dead — no daily gate, no UTC rollover. Players solve mystery after mystery.
**Status:** 🟢 ALL GATES GREEN — PR ready (Veeresh merges)

## Follow-up: Veeresh's flippable-call decisions (2026-10-06 ~08:40 CDT)
Decisions: (1) share-heading date KEEP — no change; (2) streak in share YES — implemented; (3) skip-case button NO — no change; (4) 387-complete celebration YES — implemented.
- `npx tsc --noEmit` — clean
- `npm test` — **716/716** green (+5: 2 share streak tests, 3 store completedCycle tests)
- Playwright E2E (geodetective project): **17/17** green (+3: streak line in share text, celebration fires once on last case + Next mystery unblocked, no celebration mid-cycle)
- Commits: `5deeca8` (feature), `7e62e51` (E2E) — pushed to origin
- Implementation notes:
  - `shareLoopText` takes optional `streak`; appends `\n🔥 N` when > 0, hidden at 0/unset. ShareLoop passes the reveal's streak.
  - `LoopPuzzleState.completedCycle` set by `completePuzzle` when the deck is empty pre-completion (last undealt case); validator tolerates absence (back-compat). LoopReveal renders the celebration card with the cycle count; it never blocks "Next mystery".
- `lint-cards`: not run — no card content touched.

## Final gate summary (2026-10-06, buildId 8141867)
- `npx tsc --noEmit` — clean
- `npm test` — **711/711** green (71 loop tests: deck exactly-once over 387, reshuffle cycle++, 404 rollback, blocked-storage fallback, streak transitions, v1-inert)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Playwright E2E: GeoDetective **15/15** green; full suite 147 passed / 8 failed → all resolved (1 real app bug fixed: seam precedence; 2 test bugs fixed; 1 E2E duplicate-name flake fixed via data-entry-id; 1 pre-existing main failure: safari-launch boot-JS ceiling, fails identically on f0db7ba; 2 flakes passed on rerun)
- Game Designer: spec + playtest sign-off (48/48 checks)
- Software Architect: **APPROVED WITH FINDINGS, zero blockers** — all 5 findings addressed (mount catch safety net, two-tab limitation documented, stale comment fixed)

## What's pending
1. Open PR (Veeresh merges — do NOT merge)

## E2E final (2026-10-06)
- Full suite: 147 passed / 8 failed → all 8 accounted for:
  - 5 GeoDetective: 1 real app bug (seam clobbered open mystery — FIXED, resume branches now precede the seam) + 2 test bugs (share regex for random targets, "Editions" strict-mode — FIXED). Rerun: **15/15 green**.
  - 1 pre-existing: safari-launch boot-JS ceiling fails identically on pristine main (f0db7ba) — NOT a regression (routes chunk already 2.06 MB vs 1.8 MB ceiling on main; this branch adds +4 KB / +0.2%).
  - 2 flakes: review-deck:168, difficulty-picker:302 — both passed on rerun.
- Scratch main worktree at ~/workspace/meridian-scratch-main (kept for reference; node_modules symlinked).

## What's pending
1. ~~Full Playwright E2E~~ ✅ resolved (above)
2. Software-architect review — 🟡 RUNNING, zero blockers required
3. Open PR (Veeresh merges — do NOT merge)

## E2E findings (full suite 2026-10-06, buildId 06be340)
- **Real app bug (fixed):** `?loop-puzzle=` seam clobbered an open mystery — the seam branch ran before the resume branches, so a reload/return with the param still in the URL wiped in-progress guesses and re-dealt on finished reveals. Fixed: resume branches now take precedence; seam only pins when no mystery is open (spec §8#4 now holds; also resolves the designer's playtest nit #2 properly).
- **Test bug (fixed):** loss-path share asserted `/🟥{5} not solved/` — invalid for a random real-deck target (wrong guesses can be <2000 km → 🟧/🟨). Now `/[🟥🟧🟨]{5} not solved/`.
- **Test bug (fixed):** "Editions" locator matched 2 buttons on the win reveal (header "Editions" + reveal "Back to editions"); test now clicks "Back to editions".
- **Rerun:** geodetective.spec.ts + geodetective.reduced.spec.ts → **15/15 passed** (buildId 1dcd331).
- **Open:** review-deck.desktop, difficulty-picker, safari-launch failures — rerunning to determine flake vs regression.

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
