# PR #364 finisher — GATES STATE (fourth finisher session, 2026-11-08 ~06:17 CST — resumed from this file; sessions 1–3 died in runtime daemon restarts, infrastructure only)

Branch `feat/holmes-follow` · tip under test: `342a5e4c017a5e5ade6edfbcb56e8bea84d1a222`
Worktree: `~/workspace/meridian-364-finish` (worktree of meridian-346-mergeup clone; local branch `finisher-364`, push via `HEAD:feat/holmes-follow` if cures are committed)
Base main at start: `9e49da3` (already merged up via `047739c`).

## Starting state (from brief, verified where marked)
- PR OPEN, MERGEABLE ✔ (gh, 2026-11-08)
- Fast gates green at tip on merged tree (brief): tsc clean · unit 2273/2273 · worker 145 · lint-cards PASSED · build green
- Classes A/C/D/E cured ✔ (per brief; C: watson-walk 8/8 twice, sampler unloosened)
- 7 owner negative tests posted in PR body; travel-overlap closed in `ac87cca`

## Gate progress
1. [~] Full-census E2E at healthy load (load ≲9) — DISPATCHED 2026-11-08 ~06:35 CST to census runner worker: full suite = 994 tests / 164 files / 64 projects (listed with VITE_KOFI_URL set; without it Playwright lists 0 — the env var is mandatory). Runner waits for load ≤9, runs under flock --workers=1, writes ~/workspace/meridian-364-evidence/census-full.log + census-summary.md with every failure bucketed FG-5-KILL / SELECTION_READ-MISS / OTHER. Never-run projects confirmed present: endings 2, replay 3, sound 10, swap 1, flag 2, stations 1, summary 3, reduced 14. tap-precision + p0-gaps list 0 tests (their spec files are absent from tests/e2e on this branch — census covers everything that exists).
2. [~] Play-style rest verification — DISPATCHED 2026-11-08 ~06:33 CST to visual-tester worker: standalone script ~/workspace/meridian-364-evidence/rest-verify.mjs modeled on detective-follow.spec.ts (recorder rate 3 + fulfillFlagsFollow + case 137 + real heading-tap gesture unlock; waitForSearchIdle; map scrolled into view). Cases: 1280 mouse rests ×2 (map points 0.66,0.30 + 0.40,0.62, ~5 s parked sampling, drift + distance-to-rest-point + clue-overlap max), 768 rest 1, 390 CDP touch-hold rest 1 (parked while finger down + after-lift check). Log: rest-verify-log.md in the same evidence dir. NOTE for panel use: recorder accelerates clips 3× — play-style evidence only; the clean-room no-clue-read finding is a SEPARATE lane (U11 renders approved by owner 2026-11-08), not this PR's panel question.
3. [~] Follow screenshots 390/768/1280 — folded into the Gate-2 worker run (follow-<width>-*.png in ~/workspace/meridian-364-evidence/): settled + rest-1 parked at all three widths + rest-2 at 1280 + after-lift at 390.
4. [ ] Silo QA delta re-key (fresh clone, key PR364+342a5e4)
5. [ ] 13-seat panel by name incl. Game player (timed log + screenshots)
6. [ ] DevEx + benchmark
7. [ ] Merge (fresh check read → squash → record tip SHA in ~/workspace/deleted-branches-2026-11-02.txt → live build-meta both hosts → live screenshots + live rest test)
8. [ ] Open question: closed-state SELECTION_READ capture misses in contended batches — diagnose during census

## Environment notes
- EDQUOT hit at session start; freed by deleting stale silo-QA clones of merged PRs #347/#348/#352/#354/#355/#357/#358/#359 (~128k inodes). Write probe OK after.
- Load at start: spiked 9.1, trending down (6.1/4.8/2.1 at last read). Census waits for ≲9 sustained, ideally lower.
- House E2E pattern: flock ~/workspace/.e2e.lock, --workers=1, PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome

## Coordination watch (fourth session, 2026-11-08 ~06:20 CST)
- main still `9e49da3` — nothing merged since #365; no merge-up owed.
- Watson-station cure: branch `feat/watson-station` @ `034535e` (test-only gap closure landed). NOT yet main / likely not yet a PR — if it merges first: merge-up + re-verify diff substance (it touches detective-state.ts + DetectiveHost.tsx comments; #364's state/host hunks intersect) + fast gates + detective E2E subset, note in PR body.
- U11 clue renders: owner APPROVED the full batch 2026-11-08 ~03:02 CST (386 core cases); no PR exists yet — watch for it; same merge-up rule if it lands first.
- PR #368 (entry routing, tip `edb7383`) is OPEN ahead in the queue — if it merges first: merge-up + fast gates + detective subset (boot-flag change, low intersection risk).
- Playwright projects enumerated from playwright.config.ts (authoritative): default (no suffix), desktop, mobile, reduced, tap-precision, p0-gaps, zoom-space, tap-verify, grandpa-tour, endless-game, scoring-v3, question-randomization, pinch-zoom, drilldown, desktop-gestures, highlight, session-score, pwa, detective-flag, detective-follow, detective-stations, detective-companion, detective-swap, detective-endings, detective-replay, detective-summary, detective-sound, detective-visibility, detective-staging, detective-watson-walk, detective-closed-state, detective-berth, feature-flags, question-labels, question-wrap, endgame-share, subdivision-labels, difficulty-picker, cleared-mode, crash-loop-breaker, observability, safari-launch, question-card-header, geodetective, geodetective-endgame, geodetective-unlabeled-tap, coldtrail, review-deck, tutorial, game-sfx, celebration, crash-watchdog, offline-content, facts-ladder-pilot, storyteller, clean-round-badge, hint-button, geodetective-hint, read-aloud-always, home-badges-readaloud, motionmaxxing, journal, search-hidden, round-loop-a11y, discarded-notice, motionmaxxing-reduced. Census runs ALL of them, --workers=1, flock, chromium-1243 executable. Never-run set per brief (confirm in run): detective-endings, detective-replay, detective-sound, detective-swap, detective-flag, detective-stations, detective-summary, reduced-project detective specs.

## Third finisher session resume (2026-11-08 ~06:09 CST)
- Prior two finisher sessions died in runtime daemon restarts (infrastructure).
- This session reuses this worktree at tip 342a5e4, verified: PR OPEN/MERGEABLE, remote feat/holmes-follow = 342a5e4, main still 9e49da3 (no station/U11 merge yet, no merge-up needed).
- Load at resume: 23.4 (contended) — census E2E waits for sustained ≲9.
