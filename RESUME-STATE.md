# RESUME-STATE — U11 clue-render lane (PR #370)

**STOOD DOWN 2026-11-08 ~16:2x UTC** under the owner's sequential
pipeline law (Veeresh, voice 2026-11-08 ~09:15 CST: one lane at a
time on this VM). This lane is **queue position 3**: (1) Watson-station
cure, (2) PR #364 follow, (3) U11. Reactivation comes from Chitti when
lane 2 merges. Until then: no renders, no builds, no E2E, no panel.

## Where the lane stands

- **Branch:** `feat/u11-clue-renders` · **Tip:** `93a8fe52`
  (== origin, pushed, worktree clean) · **Base at build time:** main
  `9e49da3` (PR #365). Main will have moved by reactivation — merge up
  first (keep both BRANCH_STATUS records), never force-push.
- **PR:** #370 OPEN — "U11: core-deck clue reads for all 387 cases
  (closes FG-3)". Body source of truth:
  `~/workspace/meridian-detective-evidence/u11/PR_BODY.md`.

## Renders — COMPLETE, nothing in flight

- **387/387 core cases carry all five clue reads (1,935 reads).**
  Pilot (cases 0–19): ≈16.9 s/case at concurrency 4, 19% flagged,
  worst case 479,225 B. Full batch done in 5 runs (the pipeline's
  double-stall throw killed 4; renders are idempotent per line, so
  each restart resumed). No render process is running at stand-down.
- **Manifest state:** `coverage.core` = 387 · `coverage.coreHolds` =
  [] (zero holds) · `coverage.answers` = 497. Gate clean on the real
  tree: "manifest clean (4462 entries verified)".
- **Sizes:** core clue audio 148,830,955 B (141.9 MB); detective
  audio tree 239 MB total (base was ~93 MB). Entry JS chunk
  unchanged: 457,847 B — this PR touches zero `src/` files.
- **Budget:** zero cases over the 500,000 B/case budget. Five cases
  (28, 54, 87, 144, 289) busted it on one very slow take each and
  were cured by re-encoding the affected clips at 32 kbit/s (16
  files; pitch/duration re-measured identical). Worst remaining:
  case 350 at 497,081 B (99.4%).
- **Flagged disposition (explicit in the PR body):** 314 of 1,935
  reads ship flagged — 103 outside Watson's family band (78–127 Hz,
  each named with its Hz), 6 under the 100 wpm pace floor (named
  with wpm), the rest inside-band pitch flags. A cure pass
  re-rendered all 103 outside-band lines fresh: 0 landed in band —
  the shipped takes stand. Full list:
  `~/workspace/meridian-detective-evidence/u11/final-flagged.json`.
- If a re-render is ever needed (not expected): from the worktree
  root, `node scripts/detective/render-audio.mjs --cases <a-b>
  --concurrency 4 --json`. Warning: "ok" lines skip, but flagged
  lines re-render on every non-force run — never re-run a wide
  selection casually.

## Gates already green on tip `93a8fe52`

- typecheck clean · `npm test`: scripts 1,028 pass / 0 fail /
  11 skipped, src 2,266/2,266 · worker 145/145 · lint-cards GATE
  PASSED · `build:pages` green.
- **Manifest gate + sabotage controls:** the extended gate
  (`checkCoreCoverage` in `scripts/detective/audio-manifest.mjs`)
  fails the build on an unclaimed/incomplete core case. Proven on a
  copied tree: emptied entry (case 42) bites, over-budget pad
  (case 10) bites, dropped case (case 77) bites.
- **Silo QA: PASS**, keyed to PR #370 + `93a8fe52` (isolated
  worktree `~/workspace/meridian-u11-silo`, deps installed; gate,
  typecheck, lint, all suites independently green; silo's own
  sabotage control bites). **Any new commit voids this key** — the
  Playwright-project fix below changes the tip, so re-key.
- **CI on the tip: green** (run 42490430913: build, GitGuardian,
  e2e) — with the caveat in the next section: CI's e2e never
  included the new spec.

## ⚠️ BLOCKER found at stand-down — the E2E has NEVER run

The queued E2E run was believed stuck behind the shared flock. It
was not queued: its log
(`~/workspace/meridian-detective-evidence/u11/e2e-core-audio.log`,
166 B) shows it **failed at launch** with Playwright's
`Error: No tests found.` Root cause, verified by reading
`playwright.config.ts` end to end: **every project carries a
restrictive `testMatch` and none matches
`detective-core-audio.spec.ts`.** The repo convention (U9/U10) is
one project per detective spec — this spec never got one. CI runs
bare `npx playwright test`, so CI's green e2e check also silently
excludes the spec. The spec itself is sound (3 tests on core
case 5, Beersheba: fetch+play all five clues in order · tap-Watson
repeats the clue itself · solve-at-guess-2 flush).

## Exact resume sequence

1. Merge up current main into `feat/u11-clue-renders`; on the
   BRANCH_STATUS.md conflict keep both records. Re-run:
   `npm run typecheck` · `npm test` · `npm run test:worker` ·
   `node scripts/lint-cards.mjs` ·
   `node scripts/detective/check-audio-manifest.mjs`.
2. Add the missing Playwright project beside the other
   `detective-*` projects in `playwright.config.ts`:
   `{ name: "detective-core-audio", testMatch: /detective-core-audio\.spec\.ts/, use: { viewport: { width: 1440, height: 900 } } }`.
   Commit (named files only) + push. Tip changed → Silo QA re-key
   (step 4) is mandatory.
3. Build, then run the E2E at healthy load, detached (VM restarts
   kill attached sessions), sequentially under the flock:
   `npm run build:pages`, then
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome flock ~/workspace/.e2e.lock npx playwright test tests/e2e/detective-core-audio.spec.ts --project=detective-core-audio --workers=1`
   with output to
   `~/workspace/meridian-detective-evidence/u11/e2e-core-audio.log`.
   On PASS: append the result to PR #370's body and tick the
   BRANCH_STATUS E2E item (records commit + push). On FAIL:
   diagnose inside the 5-cycle cap — the playback machinery is
   diagnosis-proven, so suspect spec/harness first.
4. Silo QA re-key at the new tip (fresh checkout in
   `~/workspace/meridian-u11-silo`, `npm ci`, gate + suites +
   one sabotage control).
5. 13-seat panel BY NAME on the final tip, RETRO-LAW briefs
   (owner's promises + how to play only — no diffs, no
   implementation names). Game player
   (`~/.codex/agents/game-player.toml`) must LISTEN through full
   core cases at 390 + 1280 and attach a timed play log with the
   clue reads marked + screenshots; no artifacts = seat vacant =
   panel cannot declare READY. Then DevEx + benchmark (entry
   chunk baseline 457,847 B; audio-tree delta 93 MB → 239 MB).
6. On READY / READY-WITH-NITS (0 BLOCKs): fresh CI read seconds
   before merging, `gh pr merge 370 --squash`, verify main HEAD,
   record the tip SHA in
   `~/workspace/deleted-branches-2026-11-02.txt`, live-verify BOTH
   hosts (build-meta match + a played core case's clue fetch+play
   in the capture log).

## Evidence pointers

- Diagnosis of record:
  `~/workspace/meridian-detective-evidence/clue-read-diagnosis/DIAGNOSIS.md`
- U11 evidence folder: `~/workspace/meridian-detective-evidence/u11/`
  (PR_BODY.md · pilot-report.json · final-flagged.json ·
  e2e-core-audio.log · silo-npm-ci.log)
- Handbook ch.10 already records FG-3 as CLOSED by U11;
  BRANCH_STATUS.md carries the lane capsule + pending list.
