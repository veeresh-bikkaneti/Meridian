# BRANCH_STATUS — feat/age-profile-followups

**Branch:** `feat/age-profile-followups`
**Base:** origin/main@64c82d6 (2026-10-09; PR #112 quick-fixes merged)
**Spec:** `~/workspace/specs/age-profile-followups.md` (+ office-hours/eng/devex reviews)
**Goal:** goal_b3eb80f458ba
**Status:** IN PROGRESS — build phase (coordinator + 2 devs)

## Owner decisions (all confirmed 2026-10-09 — implement exactly)
- **B1** run-config injection: `getBandConfig(band)` snapshotted once at run start; unset == today's production values (unit-gated per loop)
- **B2** DELETE mid-run grown-ups staging entirely: remove `pending-change` (3 statuses → 2), delete timeout + footer "updating…" chip + picker pending note; save writes immediately; in-memory deferredBand applies at next boundary
- **B3** uniform ghost speaker icon (same slot as 8–10, 44px, no label) + kid-set onboarding preference (Always/Sometimes/Never, asked once, never nags)
- **B4** "Clean Round" badge for no-hint runs — cosmetic ONLY, never points

## Invariants (non-negotiable)
- Scoring identical across bands · band changes at next boundary, never mid-run · band invisible to child · no age numbers / easy-hard copy on child surfaces · locked copy verbatim (≤140-char band descriptions in bands.ts)

## Work split
- **Dev A:** B1 (getBandConfig + run snapshot) + B2 (store simplification) — `src/game/age-profile/*`, loop run constructors, AgePicker/AgeProfileSettings staging hunks
- **Dev B:** B3 (read-aloud + onboarding pref) + B4 (Clean Round badge) — ReadAloudButton, story cards, passport badges
- **Tester** (after devs): full gates (tsc, lint-cards, build:pages, npm test) + relevant Playwright + mobile 390×844 QA + zero console errors

## Gates (on final head, before PR)
- [ ] `npx tsc --noEmit` clean
- [ ] `node scripts/lint-cards.mjs` GATE PASSED
- [ ] `npm run build:pages` green
- [ ] full `npm test` green
- [ ] relevant Playwright green
- [ ] mobile 390×844 QA + zero console errors

## Rules
- Named files only staged, never `git add -A`
- Open PR, NEVER merge (owner merges)

## Log
- 2026-10-09: branch created off 64c82d6; worktree ~/workspace/meridian-agefollow; Dev A + Dev B dispatched in parallel
- 2026-10-09: Dev B done (B3 uniform ghost speaker + kid pref + B4 Clean Round badge); Dev A done (B1 getBandConfig + run snapshot + B2 staging deleted); coordinator integrated (footer chip deleted, Clean Round round-end hookup in LoopScreen, ReadAloudPrefPrompt mounted on home); tsc clean
- 2026-10-09 (Dev B): B3 + B4 done, working tree only — ReadAloudButton uniform ghost icon (8-10 ≡ 11-13), read-aloud-pref.ts (key meridian.readAloudPref.v1), ReadAloudPrefPrompt.tsx, src/game/passport/badges.ts (Clean Round, cosmetic-only), age-profile.css hunks; 27 new tests green; tsc clean on own files (2 pre-existing errors in Dev A's in-progress run.ts/game-app.tsx); result-card.tsx comment hunk only
