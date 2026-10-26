# BRANCH_STATUS — feat/crash-recovery-outcome

**Branch:** `feat/crash-recovery-outcome`
**Base:** `main` at `bce7f15` (includes Slice 1, PR #247, and the D6
loop fix, PR #249)
**State: STOPPED — build halted at a design-vs-suite collision
(2026-10-25).** Tier 2 council convened and the Consensus Manifest
signed (`~/workspace/meridian-crash-slice2/CONSENSUS-MANIFEST-slice2-build.md`).
The chunk-recovery half was built RED-first: all 14 new outcome
contracts (O1–O14 in `src/lib/chunk-recovery.test.ts`) pass, and the
protected behaviours of the 41 pre-existing latch tests are intact —
but 7 of those tests fail on their storage write counters, which are
global across keys (single-key era) and therefore count the Slice 2
outcome-marker writes the design mandates (§4 A4, §6 acceptance:
"marker written" at both the reload and the stand-down). The brief
requires the 41 to pass UNCHANGED and forbids improvising around a
design/code collision, so the build stopped before observability,
worker, wiring, and E2E work. Full evidence + the decision needed:
`~/workspace/meridian-crash-slice2/REPORT-slice2-build.md`.
**Not pushed, no PR, not merged, not deployed. Slice 3 not started.**
