# fix/safari-launch-outage — status

**Branch:** `fix/safari-launch-outage` · **Base:** `origin/main` @ `3c32085` (PR #41 live)

## Incident
P0: Safari users CANNOT LAUNCH https://veeresh-bikkaneti.github.io/Meridian/ — persists AFTER PR #41's crash-loop breaker (live build `3c3208570fe5` verified).

**Key deduction:** the breaker only stops auto-resume after a kill. "Cannot launch" = the trigger is in the BOOT path (fresh load, no saved run), where the breaker never engages. PR #41 fixed the loop, not the trigger. This branch owns the trigger.

## Done
- [x] Worktree `~/workspace/meridian-worktrees/safari-launch-outage`, branch `fix/safari-launch-outage` from `origin/main` (`3c32085`)
- [x] node_modules symlinked from sibling worktree (no download)
- [x] Read worktree AGENTS.md (gates: tsc, npm test, lint-cards, build:pages, E2E via serveBuiltArtifact on 127.0.0.1:4123/Meridian/)
- [x] Field questions drafted → sent to parent as first handoff

## In progress (4 parallel crews)
- [x] Crew D: bisect — DONE. All builds boot fine on desktop (3c32085 + 8f81e13, clean console, byte-identical heavy assets) → trigger is iOS-only. Ranked suspects: (1) stale SW on real iPhones, (2) jetsam memory kill at boot, (3) iOS API breakage #38–#41, (4) WebGL init, (5) iOS-version-specific. Bisect worktrees cleaned up.
- [x] Crew B: map-on-boot — DONE. **Premise correction: menu mounts NO map** (fresh load = plain DOM Choose + RegionList only; map mounts only after a run starts). Zero map-code changes in PRs #35–#41. Verdict: map init cannot kill the process before first paint. Latent hazard noted for later: `boundsFor(run)` fresh `[0,0,0,0]` array → remount churn on corrupt saved runs (not the fresh-load repro).
- [ ] Crew A: boot-path audit (Safari-unsafe APIs, top-level side effects, SW timing, session/score restore, live map on menu)
- [ ] Crew C: SW update catch-22 + escape hatch design

## Pending
- [ ] Root cause → fix through full gates (unit, tsc, lint-cards, build, tech-arch review, tone/docs/a11y review, E2E incl. Safari-boot) → PR → merge → live verify
- [ ] If desktop WebKit can't repro: ranked iOS-only suspects + field-question answers

## Rules
- Minimal launch fix only. Do NOT ship anything that strands users further (no SW change that could wedge old clients).
- Push early and often; stage named files only, never `git add -A`.
