# BRANCH_STATUS — fix/endgame-editions

- **Branch:** `fix/endgame-editions` (no PR yet — PR opens after gates + panel)
- **Base:** `origin/main` at `b09a5c36` ("Start over" history reset + Review-card overlay fix, #281)
- **Task:** The "End game" button is not visible in GeoDetective, Cold Trail, or other new editions (owner's report, verbatim). Make the same End game control available inside those edition screens so a player can end the session and see the session summary from anywhere, exactly as in the classic Globe/Country/State run screens.
- **State:** **MANIFEST SIGNED — BUILD NOT STARTED.** Tier-2 council complete (see below); no implementation code written yet. Next: RED tests per the manifest, then minimal GREEN.

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

## Pending

- [ ] RED tests (unit source-pins + E2E in existing specs + mobile spec) — must fail with the predicted signatures before GREEN.
- [ ] Minimal GREEN implementation per the manifest (mode buttons + handler + GameApp-level mode-summary branch + `showPlayAgain` prop + focus-to-Done fallback).
- [ ] Docs: README + any doc the change touches, beginner-readable tone; code comments explain the why.
- [ ] All 5 gates on the final tip: `npx tsc --noEmit` · `npm test && npm run test:worker` · `node scripts/lint-cards.mjs` · `npm run build:pages` · `flock ~/workspace/.e2e.lock npx playwright test --workers=1`.
- [ ] Full panel review (12-role + DevEx) on the final tip; cure → re-vote if needed.
- [ ] PR opened; NO MERGE (owner's explicit per-PR word only, after panel verdict).
- [ ] Push: gh CLI is 401 on this machine (token invalid) — push/PR creation may need the owner route; if blocked, the branch + package are staged locally and the blocker is reported with evidence.

## Environment notes

- Node v24.22.1 local; CI Node 22.x is canonical — a local pass is an early signal only.
- Playwright bundled Chromium (to be verified at gate stage). `/home/box/node22/bin`, `/tmp/node22/bin`, `/usr/bin/google-chrome` do not exist here.
- Commit author for this branch's agent commits: `Lotus <lotus@local>` (local marker, not the owner's identity) — set per-commit via `-c` flags since no git identity is configured on this machine.
