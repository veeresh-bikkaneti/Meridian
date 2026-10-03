# BRANCH_STATUS.md — crash-investigation (P0)

**Branch:** `crash-investigation` · **Base:** `origin/main` @ `eee96c8`
**Incident:** Veeresh on iPhone Safari gets "A problem repeatedly occurred on https://veeresh-bikkaneti.github.io/Meridian/" (iOS killed the web content process) when entering **Arkansas** (state edition). Crash repeats on reload. Last good game: country edition on the pre-#38 build.

## Done
- [x] Worktree created at `~/workspace/meridian-worktrees/crash-investigation` on `crash-investigation` @ `eee96c8` (replaced stale endgame-share BRANCH_STATUS.md inherited via the #40 merge)
- [x] `node_modules` symlinked from sibling worktree (no download)
- [x] System Chromium located at `/opt/meta-chromium/chrome` for Playwright repro

## Pending
- [ ] Repro: build:pages + Playwright Arkansas state-edition flow (Chromium); bisect vs build `1152076` if needed
- [ ] Entry-path audit: `startRun` → chunk load → pool build → deal → camera animation; state vs country edition diff
- [ ] Data audit: Arkansas chunk vs other state chunks for pathological records
- [ ] Live-site check: production URL load, console errors, build-meta vs origin/main
- [ ] iOS-only suspects enumerated (SW lifecycle, Intl.DisplayNames fallback option, MapLibre memory) + phone-side isolation steps for Veeresh
- [ ] Root cause → fix PR through full gates → merge → live verification, OR written ruled-out report

## Rules
- Minimal crash fix only. No game-behavior, scoring, or data changes beyond the fix.
- Push early and often; stage named files only, never `git add -A`.
