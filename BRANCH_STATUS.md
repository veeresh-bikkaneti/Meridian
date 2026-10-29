# BRANCH_STATUS — fix/endgame-editions

- **Branch:** `fix/endgame-editions` (no PR yet — PR opens after gates + panel)
- **Base:** `origin/main` at `b09a5c36` ("Start over" history reset + Review-card overlay fix, #281)
- **Task:** The "End game" button is not visible in GeoDetective, Cold Trail, or other new editions (owner's report, verbatim). Make the same End game control available inside those edition screens so a player can end the session and see the session summary from anywhere, exactly as in the classic Globe/Country/State run screens.
- **State:** **STAGE 2 DONE — GREEN, GATES RUN, PANEL PENDING.** Tier-2 council complete (see below); RED → GREEN built per the manifest (commits `816de50` tests, `cc133c3` implementation). Next: Stage 3 gates on the final tip (already run once here — see below), then Stage 4 panel, then Stage 5 PR. NO MERGE (owner's explicit per-PR word only, after panel verdict).

## Council record (Tier 2, protocol `docs/ops/agent-council-protocol.md`)

- Manifest: `.council/manifests/2026-10-28-endgame-editions.md` — SIGNED by the Chair (status APPROVED, token `AUTH_RUN_TDD_IMPLEMENTATION`), committed as this branch's first commit together with this file.
- Seats: Chair (coordinator) · Councilor A (ATDD + surface inventory) · Councilor B (TDD contracts + RED signatures) · Councilor C (adversarial, separate agent, 2 challenge rounds used).
- Surface inventory (verified): exactly TWO mode screens exist (GeoDetective, Cold Trail) — review, challenge, tutorial are states inside classic run chrome, not separate screens. End game: PRESENT in classic run (aim + story/done), review playing, challenge playing (different result: "Route complete", no session summary), tutorial practice; ADDED in GeoDetective (mid-case, loading, load-error, reveal-unacknowledged) and Cold Trail (mid-case, result-unacknowledged, load-error return); NOT APPLICABLE everywhere else (home/picker, menus, summary itself, review-complete, challenge-complete, settings, grown-up gate, contact/privacy/credits, boot splash, notices/overlays).
- Semantics ruling (Chair): same session-end action as classic via the existing session-end request path; in-progress case left intact and resumable on return. Seam pins: NEW GameApp-level `modeSummary` state (PlayLoaded summary state untouched); render order `if (run)` → `if (modeSummary)` → `if (loopOpen)` → `if (coldTrailOpen)` → home; mode handler calls `handleEndGame` + `clearDrop`, clears ONLY the mode open flag, never `endRun`/`onReplay`; mode Done mirrors classic Done minus run ops and clears no mode store. Placement: header row next to the leave control in every header-bearing return, plus its own button in Cold Trail's `!caseData` return; label "End game", `min-h-[44px]`, no overlap (single-`evaluate()` rect assertions, 360×740 AND 390×844).
- Carried dissent (C round 1, overruled by Chair ruling, recorded verbatim in the manifest §6): (1) Play again on mode summaries is "resume", not a fresh run — Chair ruling: OMIT Play again on mode summaries (`showPlayAgain` prop, default true; classic unchanged); owner open question 1: relabel vs omit vs other. (2) A mode-only 0/0 "Game over" card discloses nothing about excluded mode play — Chair ruling: no new copy (the 0/0 card is pre-existing classic behavior); owner open question 2: order disclosure copy, or accept the 0/0 framing.
- Round-2 blocker fixed by amendment (not overruled): the Cold Trail error-branch E2E seed is unseedable (index wraps modulo deck length; `sanitizeInt` coerces) — error branch is covered by the unit source-pin only.
- Out of scope (explicit): mode scoring/streaks/wallets; classic End game behavior; redesign beyond the control's placement; case abandonment (separate owner strand); disclosure copy (open question 2); any locked/owner-approved copy change.

## Done

- [x] Fresh clone on persistent disk (`~/workspace/meridian-endgame-clone`), main `b09a5c36` verified; did NOT touch `~/workspace/meridian` or `~/workspace/meridian-build`.
- [x] AGENTS.md + council protocol read in full; Tier 2 confirmed; root cause re-verified with real line cites.
- [x] Council: A scenarios + inventory, B contracts + RED signatures, C round 1 CHALLENGE (5 blocks + 3 notes), C round 2 CHALLENGE (1 blocker + 3 notes) — all dispositioned; manifest SIGNED.

## Done (Stage 2)

- [x] RED tests (unit source-pins + E2E in existing specs + mobile spec) — all failed with the predicted signatures before GREEN (unit 11/11, exit 1; E2E mode tests on the missing End game button; all guards pass).
- [x] Minimal GREEN implementation per the manifest (mode buttons + handler + GameApp-level mode-summary branch + `showPlayAgain` prop + focus-to-Done fallback). Classic flow untouched: classic summaries pass nothing and behave identically.
- [x] Docs: README (GeoDetective section: End game in modes, session-only totals, case resumes) + this file; code comments explain the why.
- [x] Gates run on the final tip: `npx tsc --noEmit` clean · `npm test` 1785 pass / 0 fail · `npm run test:worker` 85 pass / 0 fail · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green · E2E (serialized, `--workers=1`): geodetective endgame 6/6, coldtrail endgame 5/5, mobile 2/2, endless-game full 3/3 — all green.
- [x] Footprint: implementation +122/−20 lines; tests + docs dominate (see `git diff --stat origin/main...HEAD`).

## Known pre-existing failures (NOT caused by this branch — evidence in the Stage 2 report)

- `session-score` 6/8 fail on this VM: the once-per-lifetime first-win Parade modal blocks clicks in that untouched spec (12 celebration-overlay intercepts in the log; 2 failure screenshots show "Your first discovery!" over the story card). Same failure reproduced pre-fix in RED phase. Celebration/banking code is untouched by this branch.
- `endgame-share` 0/2 fail: strict-mode violation — the dialog holds two `p[aria-live="polite"]` regions (score ShareButton + challenge ShareButton) whenever a challenge URL exists. Base source (`b09a5c36`) already renders both ShareButtons; this branch's card diff touches none of that. The spec file is untouched.
- Neither spec was modified to hide these; both are flagged for the panel/owner, not papered over.

## Deviations from the manifest (all disclosed, none silent)

- Seeded mode entry after globe seeding uses pushState + home-card click (GeoDetective) / direct home-card click (Cold Trail) instead of the specs' goto helpers: a reload drops the seed boot's `?idle-ms` (the 2-minute watchdog then kills the session mid-test) and restores the paused classic run instead of home. The `?loop-puzzle=218` seam itself is unchanged and still read at LoopScreen mount.
- Seeded tests pre-seed `meridian.firstWinCelebrated = "1"` (the repo's own game-sfx/reset-history pattern) so the Parade modal does not block the seeded flow; mode-only tests do not need it.
- Mobile GeoDetective helper accepts "Resume your case" as well as "Solve a mystery" on the second viewport iteration (the first iteration leaves an in-progress case).
- `loop-screen-animate.test.ts` gains the new required `onEndGame` prop in its render call (construction sync only; no assertion changed).

## Pending

- [ ] Full panel review (12-role + DevEx) on the final tip; cure → re-vote if needed.
- [ ] PR opened; NO MERGE (owner's explicit per-PR word only, after panel verdict).
- [ ] Push: gh CLI is 401 on this machine (token invalid) — push/PR creation may need the owner route; if blocked, the branch + package are staged locally and the blocker is reported with evidence.

## Environment notes

- Node v24.22.1 local; CI Node 22.x is canonical — a local pass is an early signal only.
- Playwright bundled Chromium (to be verified at gate stage). `/home/box/node22/bin`, `/tmp/node22/bin`, `/usr/bin/google-chrome` do not exist here.
- Commit author for this branch's agent commits: `Lotus <lotus@local>` (local marker, not the owner's identity) — set per-commit via `-c` flags since no git identity is configured on this machine.
