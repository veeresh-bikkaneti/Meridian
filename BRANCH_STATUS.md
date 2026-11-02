# Branch status — fix/267-reload-reveal-units

- **Branch:** `fix/267-reload-reveal-units`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #267 (Meridian issue-clearing wave,
PR W1) — make `tests/e2e/reload-reveal.desktop.spec.ts` pass on current
main by fixing its stale distance-unit expectation, prove it with a green
solo E2E run, and open the PR. Test-only fix; product code does not change.

Tier and rationale: Tier 1 — one bug, one file, clear repro (diagnosis
below matched the predicted failure signature exactly).

Done condition / evidence: diagnosis reproduced on unmodified main
(1 failed / 2 passed, the failure being the headline regex); after the
fix the same spec solo = 3/3 pass; mutation proof sealed; PR opened
against main. NO MERGE — merging is the owner's step.

Files in scope: `tests/e2e/reload-reveal.desktop.spec.ts` (one line) +
this file. Out of scope: product code, `.github/workflows/` (CI e2e list
surface is owned by open PR #265; whether this spec joins the CI list is
the owner's separate call, per the wave brief for #267).

## What changed and why

- The miss-headline regex at spec:87 accepted only metric units:
  `(km|m)`. The product renders miles for en-US players (per issue #267,
  since PR #138), so the diagnosis run's headline —
  `"Result: 110 mi northwest of your pin"` — could never match.
- Fix: `(km|m)` → `(km|mi|m)`. "mi" is ordered before "m" so miles match
  before metres. Every other assertion in the file is untouched. The
  test's intent is to prove the result card re-renders after a mid-reveal
  reload, not to prove the unit.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/267/`)

- [x] Diagnosis on unmodified main: `build-pages-diagnosis.log` /
  `.exit` (=0); `e2e-before.log` / `e2e-before.exit` (=1) —
  **1 failed, 2 passed**; the single failure is the headline regex
  (`Expected pattern: /(km|m)/`, received `"110 mi northwest of your pin"`).
- [x] After the fix: `e2e-after.log` / `e2e-after.exit` (=0) — **3 passed**.
- [x] Mutation proof: `mutation-unit.log` / `mutation-unit.exit` (=0) —
  unit-level regex check against the actual received headline string from
  the sealed diagnosis log: the old `(km|m)` regex fails it, the new
  regex passes it (and still passes km and m headlines).
- [x] Redundancy audit: `redundancy-grep.log` — grep for `miss-headline`
  and `of your pin` across `tests/e2e/`. This test's rehydration
  expectation lives at one site (this spec, line 87); the fix adds no
  duplicate. Similar pre-existing headline patterns in other specs are
  separate surfaces, untouched by this PR and outside #267's scope.

## Status

- [x] Diagnosis reproduced and sealed
- [x] One-line regex fix
- [x] Solo E2E green (3/3), sealed
- [x] Mutation proof sealed
- [x] PR opened against main (linked to #267, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only
