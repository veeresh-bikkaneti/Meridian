# BRANCH_STATUS — test/stub-crash-report-in-e2e (PR #320)

- **Branch:** `test/stub-crash-report-in-e2e` · **PR:** #320
- **Refreshed 2026-11-03** onto main `490fab0` (merge commit `541555a`, clean merge, no conflicts). The PR's three-file change (tests/e2e/helpers.ts, pinch-zoom.spec.ts, storyteller.spec.ts, +38/−2) is byte-identical to the original tip `c0a3ffc`'s change: hunk-for-hunk diff comparison identical except blob index lines.
- **Owner order (2026-11-03 22:38 CST):** "Refresh and pstack swarm and architecture and arena interrogate." This run: Phase 0 refresh (done) → swarm (posting inventory / refresh integrity / dependent surfaces) → architect + arena over the stub design → interrogate the final diff → stop at READY. No merge without the owner's per-PR word.
- **Supersession [observed]:** not superseded — current main stubs nothing for the crash-report host in serveBuiltArtifact or pinch-zoom; the observability specs pin the prod endpoint and intercept only for their own inspection, and storyteller's clean-console check still filters the beacon's network error instead of preventing the post.
- **Status:** refresh pushed; swarm / arena / interrogate in progress under the coordinator. Prior record for this branch (below the divider) is main's carried record and is kept intact.

## 2026-11-04 — Arena synthesis implemented (builder run)

Implemented `~/workspace/meridian-pr320-arena/SYNTHESIS.md` (candidate-1 base + grafts G1–G3 + fixes F1–F4) on this branch:

- `tests/e2e/helpers.ts`: `TelemetryEvent`/`TelemetryEscape`/`TelemetryLedger` + `createTelemetryLedger()` (F2: `payloads()` returns a copy); `TELEMETRY_ENDPOINT` derived from `OBSERVABILITY_INGEST_HOSTS[0]`; `handleTelemetry(route, ledger)` as the one policy entry point; `serveBuiltArtifact` returns the per-context ledger (WeakMap, G3 idempotent), registers once-per-context escape listeners (`response` status ≠ 204 + `requestfailed`) that also append JSON lines to the spill file at `MERIDIAN_E2E_TELEMETRY_SPILL`; `collectTelemetry(context, {flags?, endpoint?})` throws on an unserved context; `telemetryGuard(getLedger, {silent?})` for `test.afterEach` (G2). Header comment on `serveBuiltArtifact` states the contract once (serve first → collectors win dispatch → hand-rolled handlers call `handleTelemetry` before `continue()` → stubbed surfaces may show "sent" copy, assert on the ledger).
- `tests/e2e/pinch-zoom.spec.ts` (F3): call-site swap to `handleTelemetry` with a module-scope ledger; its own handler/spoof behaviour unchanged.
- `tests/e2e/storyteller.spec.ts`: bespoke `unstubbedTelemetry` listener + afterEach deleted; `tel = await serveBuiltArtifact(context)` + `test.afterEach(telemetryGuard(() => tel))`.
- Spill hooks (F4): `playwright.config.ts` gains `globalSetup`/`globalTeardown` → new `tests/e2e/telemetry-spill-setup.ts` / `telemetry-spill-teardown.ts`.
- `scripts/e2e-telemetry-guard.test.mjs`: source-scan rules (a)–(d) in the `npm test` scripts suite; `COLLECTOR_FILES` = the 4 inspecting specs.
- `tests/e2e/telemetry-harness.desktop.spec.ts` (G1): forced-`js_error` recorded via stub (A) and via collector (C); plain boot has no escapes (B). 3/3 pass [measured].

**Deviations recorded, not absorbed:**
- Guard EXEMPT does **not** start empty (contra F1): `tap-verify.spec.ts` [measured] imports nothing from `./helpers` — it inlines its own `serveBuiltArtifact` (written when helpers was untracked) and does not stub telemetry. It is the EXEMPT list's single entry, with the reason in the guard test; migrating it is a follow-up outside this scope. The arena inventory missed it.
- F4 demo spec was named `telemetry-spill-demo.desktop.spec.ts` (deleted after the run): the plain `.spec.ts` name matches no project `testMatch` in `playwright.config.ts`, so it would never have run.

**F4 demonstration [measured]:** the temporary demo spec (later 500 route on `TELEMETRY_ENDPOINT` + forced `js_error`) — the test itself passed, the run exited 1 at `globalTeardown` with the escape listed (`{"url":"https://meridian-crash-report.knowledgetest.workers.dev/ingest","status":500,"kind":"response"}`). A teardown throw **does** fail the run at this Playwright version; the `process.exitCode` fallback was not needed. Demo spec deleted.

**Guard negative proof [measured]:** a temporary spec importing nothing from `./helpers` failed rule (a) naming the file + fix; deleted, guard back to 4/4 green.

**Gates [measured]:** `npx tsc --noEmit` clean · `npm test` green (scripts 947 pass / 0 fail incl. the new guard; src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green (exit 0; two earlier attempts OOM-killed at prerender under VM contention, third completed) · Targeted E2E (flock, --workers=1, chromium-1243): telemetry-harness 3/3 · storyteller `-g "text-first render"` 1/1 · observability first test 1/1 · pinch-zoom full file 9 passed / 3 failed — the 3 globe zoom-step failures reproduce identically on the unmodified tip `1b88892` in a detached worktree (same dist, same Chromium), so they are pre-existing in this environment, not a regression of this change [measured]. Full E2E suite not run locally (CI's job, per brief).

**Environment note:** this worktree had no `node_modules`; `npm ci` aborted under VM contention, so `node_modules` was copied from a sibling worktree whose `package-lock.json` is byte-identical (md5 `bf080315…`). `dist/` and `node_modules/` are gitignored; nothing of either is committed.

---

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
