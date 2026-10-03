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
- [ ] Crew A: boot-path audit (Safari-unsafe APIs, top-level side effects, SW timing, session/score restore, live map on menu)
- [ ] Crew B: map-on-boot hypothesis (SatelliteMap/WebGL/Esri init failure modes; what changed in map init recently)
- [ ] Crew C: SW update catch-22 + escape hatch design
- [ ] Crew D: bisect pre-#38/#39/#40 builds in WebKit Playwright

## Pending
- [ ] Root cause → fix through full gates (unit, tsc, lint-cards, build, tech-arch review, tone/docs/a11y review, E2E incl. Safari-boot) → PR → merge → live verify
- [ ] If desktop WebKit can't repro: ranked iOS-only suspects + field-question answers

## Rules
- Minimal launch fix only. Do NOT ship anything that strands users further (no SW change that could wedge old clients).
- Push early and often; stage named files only, never `git add -A`.
