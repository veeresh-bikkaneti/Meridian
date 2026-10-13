# Run log

| time (UTC) | step | result |
| --- | --- | --- |
| 2026-10-13T18:58Z | startup: tips verified (main d7a0fc8, #148 3f3a62f, #150 62895ea, #149 192b2d8, #147 c86c6b1, sticky 60abd46) | match |
| 2026-10-13T18:59Z | LOCK taken (63b76bd) | pushed |
| 2026-10-13T19:00Z | consolidate: merged perf/globe-tier-split and chore/remove-unused-deps (plain merges: the LOCK commit made a fast-forward impossible; BRANCH_STATUS.md conflicts resolved) | ok |
| 2026-10-13T19:10Z | consolidate gates (artifacts/gates-consolidate.log): tsc, npm test 771 scripts + 1249 src, test:worker 18, typecheck:worker, lint-cards, build:pages, build | all exit 0 |
| 2026-10-13T20:05Z | step 0: ARCH-REVIEWER diff review of 62895ea + 192b2d8 | BLOCK (stale-places commit on Globe band change); saved docs/ops/reviews/step0-diff-review-tier-split-and-deps.md |
| 2026-10-13T20:06Z | step 0: ARCHITECT spec ws-0-globe-tier-flag.md written; sent back for revision to fold in review findings | pending |
| 2026-10-13T20:20Z | step 0: spec revised (load-key fix for the BLOCK, nits 3/4/5 folded in); PLAN REVIEW (opus) started | pending |
| 2026-10-13T20:35Z | step 0: PLAN REVIEW (opus) APPROVE-WITH-NITS (10 nits); UX-REVIEWER BLOCK on silent in-run failure of an offline "Try Medium" with the split ON; architect folding both into the spec | snapshot of in-progress spec committed |
| 2026-10-13T20:50Z | step 0: spec now includes UX-BLOCK fix (run-start notice, reload-based retry via sessionStorage meridian.pendingOpen, 3 E2E specs); PLAN REVIEW round 2 (opus) started | pending |
| 2026-10-13T21:30Z | step 0: round-2 PLAN REVIEW (opus) BLOCK -> spec revised (pending-open dropped, 4.10 reworked, a11y, copy); gate comparison: rerun of the 98 failing e2e tests: 93 fail on tier-split build vs 94 on main-equivalent; 92 common; T2-only: grandpa-tasting-tour:237 (flaky: fails 1/4 on main too); main-only: longname-tiers:511 and geodetective:388 (flaky) | no regression attributable to the tier split in this VM; 92 failures are pre-existing here (Chromium 141 VM) |
| 2026-10-13T21:45Z | ws-0 pass 1 (haiku worker): flag + helper + unit tests; tsc 0, npm test 771/1279 pass 0 fail, lint-cards PASSED, builds ok | green |
| 2026-10-13T21:55Z | ws-0 QA red-first: 4.6 forced-route 4/4 pass; 4.7 flag=true FAILS 3/3 (extra tier-2 id in Medium seen store = the stale-catalog bug), flag=false passes; 4.10 P1/P2 fail at first alert assertion (silent failure) | red as predicted; bug reproduced |
| 2026-10-13T22:20Z | ws-0 pass 2 (haiku worker): Play keyed load state (8b-8d) + run-start notice (15-18); tsc 0; npm test 771/1279 pass 0 fail; lint-cards PASSED; build:pages (KOFI) ok; new specs 8/8 pass (4.7 now green, 4.10 green); existing feature-flags/difficulty-picker/cleared-mode 24/24 pass | green; DIFF REVIEW pending |
| 2026-10-13T22:35Z | ws-0 DIFF REVIEWs: ARCH APPROVE-WITH-NITS; UX BLOCK on flag-ON (focus ring, stale box, copy, picker error) -> fixes round 1 (A-C by haiku worker, D by haiku QA); QA found a real bug (focus ring computed to none because ui/button outline-none wins) -> fixed with focus-visible:outline-solid; globe-promotion-offline 5/5 pass; unit 764+1279 pass; tsc, lint-cards ok | full E2E + UX re-review pending |
