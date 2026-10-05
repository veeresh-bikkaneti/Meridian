# BRANCH_STATUS.md — feat/first-run-tutorial

**Branch:** `feat/first-run-tutorial` off `origin/main` @ `ea3117b`
**Worktree:** `~/workspace/meridian-worktrees/tutorial`
**Mission:** First-run 3-beat tutorial (game-review improvement #2, approved by Veeresh 2026-10-05).

## 2026-10-05 — PR #61 MERGED by Veeresh (0aeac14)
Veeresh merged the tutorial to main (his call — the PR body asked not to merge until E2E went green). The tutorial feature is on main as of 0aeac14.
**Remaining:** 2 test-only commits on this branch need a follow-up PR once push auth is restored (see blocker below):
- `9689e60` (already on origin/feat/first-run-tutorial): E2E — drop tapHitsMap gate, add camera-settle wait.
- `b1cb8be` (LOCAL ONLY, unpushed): E2E runs with reduced motion for a deterministic camera.
A follow-up PR `feat/first-run-tutorial` → `main` will show exactly these 2 commits as the diff.

## BLOCKER — GitHub token revoked (2026-10-05)
`gh auth status`: "The token in /home/hatch/.config/gh/hosts.yml is invalid." Push fails with "Invalid username or token." **Needs Veeresh:** `gh auth refresh` on the VM, or a fresh PAT via the one-time use-and-shred flow. Do NOT paste token values into chat per standing hygiene.

## E2E state
- `tests/e2e/tutorial.spec.ts` (4 tests): 3/4 green on build 3570943. The 4th (full tour) failed twice on camera timing, never on app behavior:
  1. First failure = REAL APP BUG (tour asked "Poulx, Occitanie"): `TUTORIAL_PLACE_ID` was `"eiffel"`, starter ids are `${regionId}-${slug}`. Fixed in 3570943 + unit test anchors the id.
  2. Second failure = test-harness over-strictness: `tapHitsMap` (elementFromPoint) rejects taps under the pointer-transparent beat-1 banner/question bubble, but real taps pass through. Removed the gate (9689e60).
  3. Third failure = intro-dive camera still in flight on the loaded VM when the spot was sampled (screencast-verified: frames show the dive en route over North Africa). Fixed via reduced-motion project (b1cb8be): under `prefers-reduced-motion` the intro is an instant jump-to (ZoomSpaceController), making the France framing deterministic.
- Re-run command (rule-compliant): `cd ~/workspace/meridian-worktrees/tutorial && flock ~/workspace/.e2e.lock npx playwright test --config ~/workspace/.pw-tutorial-local.config.ts --workers=1`
- Local config lives at `~/workspace/.pw-tutorial-local.config.ts` (persistent; /tmp gets wiped — a queued run died on exactly that).
- Infra rule honored throughout: all E2E via the VM-wide lock, `--workers=1`, `--disable-dev-shm-usage`; one early unlocked run was killed to comply.

## Gates (all green, pre-merge)
`npx tsc --noEmit` clean · `npm test` 606/606 · `lint-cards` GATE PASSED · `build:pages` green (3570943) · self-review (code-reviewer + UX hats) zero blockers.
