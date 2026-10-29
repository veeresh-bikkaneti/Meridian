# BRANCH_STATUS — fix/endgame-editions

- **Branch:** `fix/endgame-editions` (no PR yet — PR opens after gates + panel)
- **Base:** `origin/main` at `b09a5c36` ("Start over" history reset + Review-card overlay fix, #281)
- **Task:** The "End game" button is not visible in GeoDetective, Cold Trail, or other new editions (owner's report, verbatim). Make the same End game control available inside those edition screens so a player can end the session and see the session summary from anywhere, exactly as in the classic Globe/Country/State run screens.
- **State:** **STAGE 3 DONE, STAGE 4 PANEL VERDICT: BLOCKED (2 seats) → CYCLE-4 CURE IN PROGRESS.** Tier-2 council complete (see below); Stage 2 built per the manifest (commits `816de50` tests, `cc133c3` implementation); Stage 3 gates ran green on the Stage-2 tip (see below); the Stage-4 panel then BLOCKED the tip (2 seats BLOCKED, 10 APPROVE-WITH-NITS, 1 APPROVE) and the cure below answers both BLOCKs plus the cheap nits in one pass (cycle 4 of the repo's 5-cycle cap; Stage 2 used 3). Next: gates on the cured tip, then panel re-vote, then Stage 5 PR. NO MERGE (owner's explicit per-PR word only, after panel verdict).

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

## Cycle-4 cure (panel BLOCKs + cheap nits, 2026-10-29)

- BLOCK 1 — Accessibility (WCAG 4.1.3, 2.4.3): `handleModeEndGame` now sets the persistent `mapModeAnnouncer` to the Game-over totals string in classic's exact format, and a mode-only GameApp effect moves focus to `summary-done` on mode-summary mount (classic summaries gain no autofocus). Mode Done also sets `landHomeFocusRef` so focus lands on the home heading (the landHomeFocus pattern applies cleanly: Done lands on home, which renders `headingRef`). `RunSummaryCard`'s header comment now states the announcement split (classic via Play's region, mode via the persistent announcer) instead of claiming the card's own aria-live region. Classic behavior byte-identical.
- BLOCK 2 — UX (S4/S5 on reveal/result): both mode header rows are now `position: sticky; top: 0` with solid `atlas-bg-1` background (page scroll, no internal container, so sticky on the row itself sticks); the GeoDetective reveal section and the Cold Trail result heading carry `scroll-mt-20` so their untouched scroll/focus landings stop below the sticky bar. No second End game button; no change to the reveal `scrollIntoView` or result focus calls. Recorded as manifest §5A (R5 amendment, Chair sign-off 2026-10-29). Correction inside this cure (disclosed, not silent): the first Trail placement put the sticky row inside `<header>` and the F3 test still failed at y = −81.5 — a sticky element cannot stick past its short parent's box. The row is now a direct child of `<main>` (DOM/visual order unchanged: row, eyebrow, title, intro), and F3 passes.
- Cheap nits, all cured: mode branch passes `modeSummary.dateKey` captured at End game time (state type widened to `SessionSummary & { dateKey: string }`); README reworded + Cold Trail load-error button clause + reload-loses-summary clause; TrailScreen WHY comments for `onEndGame` and the error-return button; GUARD comment lines above both activation pre-End halves; S11 zero-End-game assertions in all four mode-summary tests; Geo activation now asserts full loop-blob string equality; single-`evaluate()` rect calls also cover case-number / stars and Next mystery / Next case; width ≥ 44 + x ≥ 0 + x + width ≤ viewport added to visibility assertions; mobile helper takes exact per-pass labels ("Solve a mystery" 1st, "Resume your case" 2nd); one Geo keyboard Tab/Enter test; one mode-summary reload test (E6 parity); Cold Trail F3 E2E added (solve → result → End game → Done → re-enter → same result).
- NOT cured (open/owner items, carried): 0/0 disclosure copy (owner Q2, locked-copy exclusion); Play again relabel "Back to case" (owner Q1); Cold Trail home resume cue (needs owner-worded label); idle-end + End game fresh 0/0 edge (pre-existing behavior newly exposed, out of scope); dedicated Parade-dismiss → End game test (dismissal covered by celebration-overlay tests; End game reads no Parade state).
- Footprint + cap ruling (Chair accounting): branch total `+1037/−321` vs the manifest's `+900/−200` cap. Excluding the manifest file itself (`+171/−0`) and this file's whole-file supersession (`+40/−299`, per the file's own convention), code + tests + README = `+826/−22`, within cap. The cap question is thereby answered as accounting, not scope creep.
- Per-spec E2E commands (all serialized under `flock ~/workspace/.e2e.lock`, `--workers=1`, with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` — see Environment notes):
  - `npx playwright test --workers=1 --project=geodetective --grep endgame tests/e2e/geodetective.spec.ts`
  - `npx playwright test --workers=1 --project=coldtrail --grep endgame tests/e2e/coldtrail.spec.ts`
  - `npx playwright test --workers=1 --project=mobile tests/e2e/mode-endgame.mobile.spec.ts`
  - `npx playwright test --workers=1 --project=endless-game tests/e2e/endless-game.spec.ts`

## Pending

- [ ] Panel re-vote on the cured tip; then PR opened; NO MERGE (owner's explicit per-PR word only, after panel verdict).
- [ ] Push: plain `git push` is 401-blocked on this machine (do not retry). Owner route, per the 2026-10-28 reconnection (Dinesh reconnected the custom.github credential via secure entry): verify FIRST with the helper's harmless proof-of-access read (GET /repos/veeresh-bikkaneti/Meridian) before any push, then use the Git Data API helper route (`gh_push_wave2.py`, parameterized --base/--head/--branch/--repo/--local) — git transport over HTTPS is NOT covered by that connection, so plain `git push` is not the path.

## Environment notes

- Node v24.22.1 local; CI Node 22.x is canonical — a local pass is an early signal only.
- Playwright runs on the bundled Chromium (chromium-1248) via the config's own `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override (CI-equivalent path): `PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`. `/opt/meta-chromium` is currently broken: launch fails with "Hatch WebGL domain policy required" (and the first Stage-3 E2E run was SIGTERM-killed mid-endless-game before that failure appeared). `/home/box/node22/bin`, `/tmp/node22/bin`, `/usr/bin/google-chrome` do not exist here.
- Commit author for this branch's agent commits: `Lotus <lotus@local>` (local marker, not the owner's identity) — set per-commit via `-c` flags since no git identity is configured on this machine.
