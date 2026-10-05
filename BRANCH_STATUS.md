# BRANCH_STATUS.md — fix/globe-naming-pin-legend

**Branch:** `fix/globe-naming-pin-legend` off `origin/main` @ `ea3117b`
**Worktree:** `~/workspace/meridian-worktrees/globe-pin-legend`
**Mission:** Two Veeresh-approved items (2026-10-05): (1) globe-edition symmetric country-level pin-compare naming; (2) pin-legend copy rewrite. Veeresh merges.

## Scope
- [ ] **Item 1 — Globe naming: symmetric country-level.** DONE <date> (frontend-developer + ux-architect + code-reviewer). `revealPinLine` globe branch now returns `Your pin: {playerCountry} · True spot: {truthCountry}` (e.g. "Your pin: Brazil · True spot: Angola") — admin-1 and the "near <city>" detail path are not used in globe. City-level "near Cuiabá" naming PARKED (not built) — backlog note at `docs/globe-naming-followup.md`. State edition byte-identical (regression lock); country edition detail path untouched.
- [ ] **Item 2 — Pin legend rewrite.** DONE <date>. Miss-subscript legend (visible text + `title`) now reads "Your pin is your guess · the gold mark is the true spot." — no pin recolor (per decision).
- [ ] **Gates:** `tsc --noEmit` · `npm test` · `lint-cards` GATE PASSED · `build:pages` · Playwright E2E on changed paths (reveal-pin-compare, reveal-your-pin-country-globe, reveal-bearing, gap-view-reveal, result-card-dismiss + state-story legend assertions).
- [ ] **Self-review:** code-reviewer + software-architect — ZERO BLOCKERS required before report.

## Rules
- Stage named files only. Push early and often. No regressions: PR #58 Your-pin lines (country/state), PR #60 bearing headline, gold mark, all editions.
- Learning outcomes first. No labels on the map — ever.
