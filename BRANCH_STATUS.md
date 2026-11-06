# BRANCH_STATUS — feat/crash-provenance-gate

Task: crash-report provenance gate, Slices 1+2 (Tier 2; manifest: ~/workspace/meridian-prov-gate/MANIFEST.md, approved by Liz 2026-11-05).
Base: origin/main 851886bc0f733abe85182980ffb7b8afd2396319.

## Done
- [x] Branch created from current origin/main; base SHA recorded
- [x] Manifest finalised (build copy, Chair-lift verbatim, execution token issued)
- [x] Arena: C1 guard-clause chain picked + C3/C2 grafts — synthesis in ~/workspace/meridian-prov-gate/arena/SYNTHESIS.md
- [x] RED tests first (61cc6ba) — suite failed to load pre-implementation (no provenanceOf/buildCantTellAlert exports); log: ~/workspace/meridian-prov-gate/logs/build-red.log
- [x] Slice 1 (0d96d50): provenanceOf gate + counting dims + corroborated-only threshold — worker suite 168/174, only Slice-2 escalation contracts failing (build-slice1.log)
- [x] Slice 2 (130bddd): can't-tell escalation in recordTelemetry + buildCantTellAlert — worker suite 174/174 (build-slice2.log)
- [x] Gates on final tip: test:worker 174/174 · typecheck:worker clean · npx tsc --noEmit clean · npm test green (scripts 990 pass/0 fail, src 2107/2107) · observability-field-parity green unmodified (logs in ~/workspace/meridian-prov-gate/logs/build-*.log)
- [x] Test-strengthening fix round (F1–F4, test file only): W9′ gate outcomes via handleRequest, C1′/C2′ history-length pins, E6 log capture, stub-arm session-mismatch pin — test:worker 175/175 · typecheck:worker clean (logs: fix-tests.log, fix-typecheck.log)
- [x] Swarm verification (4 workers: gates PASS, contracts PASS after fix round, privacy PASS, prober 5/6 mutations caught + M2 pin added) + independent Reality Checker: **READY** (REALITY-CHECK.md, ~/workspace/meridian-prov-gate/)
- [~] Push attempt — no PR, no merge, no deploy (NOT done by the build crew; coordinator's step)
- [x] Blocker fix (2026-11-06, Rock): P4b′ linked arm required lastMilestone, so the route error boundary (src/lib/error-component.tsx) and region-chunk load failure (src/components/game-app.tsx) js_error — sessionId, no lastMilestone — were uncorroborated and stopped paging. Linked now = sessionId ∧ (lastMilestone ∨ numeric msSinceBootStart, which emit() derives from the same breadcrumb). Added real-client init()+emit() tests for both sites (forward once) + wake-check / periodic-probe probe pins (no forward). Mutation (fix reverted): 3 tests fail. Merged main 1b38cb3. Gates: npm ci · tsc · typecheck:worker · build · npm test · test:worker 181/181 · lint-cards GATE PASSED · build:pages — all exit 0. Local Playwright not run (worker-only); GitHub CI e2e is the e2e gate. No merge, no deploy.

## Notes
- C1′/C2′ run as a live init() drive in the worker test file (ruling a) — no fixture fallback needed; the import runs under both the worker test runner and typecheck:worker.
- One existing #311 threshold test fixture gained a captured error so it stays developer_needed (not a can't-tell candidate) — its intent (threshold, not escalation) is preserved.
- Protected functions/files untouched: diff is only workers/crash-report/src/index.ts + index.test.ts + this file.
