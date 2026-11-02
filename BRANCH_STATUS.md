# BRANCH_STATUS — fix/298-reveal-spec-drift

- **Branch:** `fix/298-reveal-spec-drift`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: Issue #298 — six E2E reveal-spec failures on
main. Diagnose each from evidence, fix at the correct layer, open a PR.
STOP at PR-open; no Silo QA / panel / merge (separate dispatches).

Interpretations considered and selected reading: the issue's per-spec
bullets are a summary, not the diagnosis — the sealed sibling log
(`evidence/sibling-specs/siblings.log`) carries the real signatures and
they differ per spec (one is a recorder/timing signature, one is a
card-format signature, four are dealt-place signatures). Each spec gets
its own class: (a) stale expectation, (b) product/data defect,
(c) premise no longer reachable.

Tier and rationale: Tier 1 — E2E spec fixes against a clear repro; no
product design decision is taken on this branch. If any spec proves
class (b), the data/product fix + gate test lands here and is flagged
in the PR body.

Done condition / evidence: all six specs pass solo on this branch
(flock, --workers=1, bundled chromium-1243, VITE_KOFI_URL set), or carry
an explicit class-(c) disposition argued in the PR body; neighbour
reveal-spec sample green; repo gates sealed under
`~/workspace/meridian-issue-wave/evidence/298/` (tsc, npm test,
test:worker, lint-cards, build:pages).

Files in scope: tests/e2e/gap-view-reveal.desktop.spec.ts,
tests/e2e/reveal-pin-compare.desktop.spec.ts,
tests/e2e/reveal-your-pin-country-globe.desktop.spec.ts,
BRANCH_STATUS.md. helpers.ts / product / data only if a class-(b)
diagnosis proves it (none expected at start).

Frozen / off-limits: PRs #297/#299/#302/#305 and all other open PRs;
#307/#194/#221 in-flight surfaces.

## Status

- [x] Issue #298 + sealed sibling log read; ledger claim posted
- [x] Dataset proof gathered for India/Globe forced places (Easy
      "storied" curation excludes hook-less tier-1 places)
- [x] Solo repro of the six on unmodified main (sealed) — 6/6 failed,
      evidence/298/repro-main.log
- [x] Per-spec diagnosis table sealed — evidence/298/DIAGNOSIS.md
      (5x class (a) stale expectation; gap-view:177 timing-premise,
      disposition argued in PR body, spec left untouched)
- [x] Fixes landed + committed + pushed — 5 of 6 specs fixed in the two
      claimed files (pin-compare + your-pin-country-globe); gap-view
      untouched, class-(c) disposition argued in the PR body
- [x] Gates sealed (evidence/298/): tsc clean; npm test 850+1879 pass;
      test:worker 85 pass; lint-cards PASSED; build:pages green;
      E2E after-run (3 files, flock, workers=1, chromium-1243):
      13 passed / 1 failed — the 1 is gap-view:177's 1200 ms tap
      deadline only (tapAt=3387, cardAt=3538: the skip itself worked)
- [x] PR opened (stop): PR #312
