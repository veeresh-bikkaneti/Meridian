# BRANCH_STATUS — fix/298-reveal-spec-drift

- **Branch:** `fix/298-reveal-spec-drift`
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
- 2026-11-03: re-check + refresh onto main `775d8b4` (#329). Re-check found the refresh trivially records-only: merge-tree conflict surface = BRANCH_STATUS.md alone, and no main commit since this branch's base touched either reveal spec. Records-only refresh: the spec diff stays byte-identical to the verified tip `78424db`; no re-vote. Standing merge condition unchanged: issue #313 (gap-view relative-bound rewrite + Sevilla comment fix) remains the filed follow-up per the panel ruling.
- 2026-11-03: merge-up onto main `0a6afa1` (#302) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's specs are unchanged from the re-gated tip `70dd362`. Checks re-read on the new tip before merging.

---

# Branch status — fix/296-idle-kill-locator

- **Branch:** `fix/296-idle-kill-locator`
TASK / requested outcome: For issue #296 (Meridian issue-clearing wave,
PR W4) — make `tests/e2e/scout-notice-session-end.desktop.spec.ts` pass
on current main by scoping its idle-kill text lookup into the visible
discarded-notice card, prove it with a green solo E2E run, and open
the PR. Test-only fix; product code does not change.

Tier and rationale: Tier 1 — one bug, one file, clear repro (diagnosis
below matched the coordinator's sealed failure signature exactly).

Done condition / evidence: diagnosis reproduced solo on unmodified
main (1 failed / 1 passed, the failure being the strict-mode violation
on the idle-kill text); after the fix the same spec solo = 2/2 pass;
PR opened against main. NO MERGE — merging is the owner's step.

Files in scope: `tests/e2e/scout-notice-session-end.desktop.spec.ts`
(one locator) + this file. Out of scope: product code, and the same
bare-text pattern in other specs (listed in the PR body, not fixed here).

## What changed and why

- At spec:91 the idle-kill assertion used a bare
  `page.getByText("Your game ended after 2 minutes of inactivity.")`.
  Since PR #287 the same text also lives in the sr-only announcer
  (`data-testid="discarded-notice-announcer"`, `role=status`), so the
  bare lookup resolves to 2 elements and Playwright strict mode fails
  it — even though the visible notice renders correctly.
- Fix: scope the lookup into the visible card —
  `page.getByTestId("discarded-notice").getByText("Your game ended after 2 minutes of inactivity.")`.
  No `.first()` band-aid, no assertion weakened: the test still proves
  the visible idle-kill notice is shown, then
  `map-switched-notice` count 0 and phase no longer `aim`.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/296/`)

- [x] Diagnosis on unmodified main: `build-pages-before.log` /
  `.exit` (=0); `e2e-before.log` / `e2e-before.exit` (=1) —
  **1 failed, 1 passed**; the single failure is the strict-mode
  violation at spec:91 (2 elements: `discarded-notice-announcer` +
  the visible card's paragraph), matching
  `evidence/verify/e2e-pins.log` on main `2a0527f`.
- [x] After the fix: `e2e-after.log` / `e2e-after.exit` (=0) —
  **2 passed**.
- [x] Redundancy / other-instances grep: `redundancy-grep.log` —
  grep for the exact idle-kill string across `tests/e2e/`. See PR body
  for the full list; only this spec is fixed in this PR.

## Status

- [x] Diagnosis reproduced and sealed
- [x] Scoped locator fix (visible card only)
- [x] Solo E2E green (2/2), sealed
- [x] PR opened against main (For #296, not closing it)
- [x] Panel round 1 on `2341296`: 5 APPROVE / 7 AWN / 0 BLOCK, DevEx
  PASS-WITH-NITS — cure applied for the DevEx MEDIUM (seconded by the
  Senior Architect): a comment at the scoped locator records WHY it is
  scoped, so a future "simplify this locator" edit cannot silently
  reintroduce the strict-mode failure. Sibling specs tracked in #303.
- [x] Cure re-verified solo: `e2e-cure.log` / `e2e-cure.exit` (=0) — 2 passed
- [ ] Panel re-vote on the cured tip — coordinator
- [ ] Merge — owner's explicit per-PR word only
- 2026-11-03: refresh onto main `775d8b4` (#329) ahead of the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records. The PR's spec diff is byte-identical to the panel-voted tip `5c39d2a`; supersession re-checked on current main (the bare-text lookup is still on main, the spec untouched since this branch's base) — not superseded. Records-only refresh: no re-vote.
