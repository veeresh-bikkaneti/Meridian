# BRANCH_STATUS.md — fix/globe-naming-pin-legend

**Branch:** `fix/globe-naming-pin-legend` off `origin/main` @ `ea3117b`
**Worktree:** `~/workspace/meridian-worktrees/globe-pin-legend`
**Mission:** Two Veeresh-approved items (2026-10-05): (1) globe-edition symmetric country-level pin-compare naming; (2) pin-legend copy rewrite. Veeresh merges.

## Scope
- [x] **Item 1 — Globe naming: symmetric country-level.** DONE 2026-10-05 (frontend-developer + ux-architect + code-reviewer). `revealPinLine` globe branch now returns `Your pin: {playerCountry} · True spot: {truthCountry}` (e.g. "Your pin: Brazil · True spot: Angola") — admin-1 and the "near <city>" detail path are not used in globe. City-level "near Cuiabá" naming PARKED (not built) — backlog note at `docs/globe-naming-followup.md`. State edition byte-identical (regression lock); country edition detail path untouched.
- [x] **Item 2 — Pin legend rewrite.** DONE 2026-10-05. Miss-subscript legend (visible text + `title`) now reads "Your pin is your guess · the gold mark is the true spot." — no pin recolor (per decision).
- [x] **Gates (all green 2026-10-05):** `tsc --noEmit` CLEAN · `npm test` 595/595 PASS · `lint-cards` GATE PASSED · `build:pages` GREEN · Playwright E2E on changed paths (locked, `--workers=1`, `--disable-dev-shm-usage` local config, against the built artifact): **21/21 PASS** — reveal-pin-compare (4/4 incl. new "Your pin: Brazil · True spot: Hungary"), reveal-your-pin-country-globe (6/6 incl. new "Your pin: Spain · True spot: Hungary"), reveal-bearing, gap-view-reveal desktop + reduced (new legend copy asserted), result-card-dismiss, state-story (legend title selector).
- [x] **Flake triage (closed):** "country (Italy): ocean pin — no line, fail closed" failed once in the full run (phase "story" not "done": the fixed tap point (1360,780) landed ~130 km from the true spot, inside the ~144 km country hit radius — camera-geometry variance in the harness, not the app; my diff touches only card copy and cannot move the camera or change hit detection). Isolated re-run under the lock: PASS (29.8s). Root-caused, not deleted; zero assertion failures on changed copy in any run.
- [x] **Self-review:** code-reviewer + software-architect — clean: globe branch is fail-closed (null → no line), truth country funnels through the question-label funnel with a coordinate fallback, no new deps/I-O, comments document the parked decision. ZERO BLOCKERS in the code.

## Infra notes (2026-10-05)
- VM: 7.7 GB RAM, zero swap, /dev/shm 794 MB. Parent infra rule: ALL E2E via `flock ~/workspace/.e2e.lock`, `--workers=1`, Chromium `--disable-dev-shm-usage` in a LOCAL test config (`playwright.local.config.ts`, untracked — do not commit).
- Deviation: /tmp is a 512 MB tmpfs at 89% used (not 7.3 GB disk), so the run sets `TMPDIR=/home/hatch/workspace/.pw-tmp` (86 GB free) — Chromium's shm fallback honors TMPDIR.
- node_modules: worktree had none; symlinked `../gap-view-reveal/node_modules` (no downloads, no audit needed).
- The first (unlocked) E2E attempt was killed mid-run when the infra rule arrived; the locked re-run is the gate of record.

## Rules
- Stage named files only. Push early and often. No regressions: PR #58 Your-pin lines (country/state), PR #60 bearing headline, gold mark, all editions.
- Learning outcomes first. No labels on the map — ever.
