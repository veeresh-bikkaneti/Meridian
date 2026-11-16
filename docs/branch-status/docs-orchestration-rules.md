# docs/orchestration-rules — branch status

**Task:** Add the orchestration playbook as an AGENTS.md addendum: new
`docs/ops/orchestration.md` (90 lines or fewer), a pointer only in
AGENTS.md (4 added lines or fewer), and this eval card. Draft PR only —
Veeresh merges. Built on current main `4387fd89`.

**Pass/fail lines (written first):**
- PASS: `node scripts/knowledge-graph.test.mjs` green.
- PASS: `npx prettier --check AGENTS.md docs/ops/orchestration.md` clean.
- PASS: `git diff --stat origin/main` shows only these 3 files.
- PASS: AGENTS.md adds 4 lines or fewer.
- PASS: `wc -l docs/ops/orchestration.md` returns 90 or fewer.
- PASS: vendor/model-name grep over `docs/ops/orchestration.md` returns 0
  (pattern per the prompt's done gate; names not spelled out here because
  the provenance gate fails any added line naming one).
- PASS: one reviewer seat reads only the diff, the gate output and the
  prompt's file specs, then returns ACCEPT or REJECT.
- PASS: one commit, `docs(agents): add orchestration playbook addendum`,
  authored as Veeresh, no AI tool name anywhere.

## Eval card (reference section E)

| Case | Claim under test | Input / trigger | Expected behaviour | Should trigger |
| :--- | :--- | :--- | :--- | :--- |
| 1 | A task that spawns helpers reads the playbook | A task spawns helpers | The cold-start note sends the agent to `docs/ops/orchestration.md` | Yes |
| 2 | A Tier 0 docs fix reads no playbook | A Tier 0 docs fix spawns no helpers | The agent does not read the playbook | No |
| 3 | The lead stops at 80 percent of the cap | A helper returns and the total hits 82 percent of a 100k cap | The lead spawns nothing more and asks Veeresh | Yes |

Side effects that block promotion: any safeguard violation (zero
tolerance); a vendor or model name written into a doc; weakening a gate
or an assertion. Grader: the reviewer seat (ACCEPT / REJECT). Baseline:
no playbook file exists on main; the candidate adds it plus the pointer.

## Sources (PR body, not the files)

The prompt asked for the "Why this is the rule (sources)" list from
Veeresh's generic constitution to be copied into the PR body, each quote
re-checked on its page. No such list exists in the generic constitution
(`~/workspace/goals/project-agents-constitution/files/project-agents-constitution.md`,
317 lines, checked 2026-11-15): it has no "Why this is the rule
(sources)" section, no source links and no vote tags. Every line is
therefore dropped, and the PR body says so.

## Status

Gates run 2026-11-15 on branch `docs/orchestration-rules` at base
`4387fd89` (before commit; files staged by name):
- `node scripts/knowledge-graph.test.mjs`: green (fail 0).
- `npx prettier --check docs/ops/orchestration.md`: clean (52 lines).
- `npx prettier --check AGENTS.md`: FAILS on main too — pristine
  `origin/main:AGENTS.md` fails the same check (pre-existing table
  alignment / emphasis drift, 68 diff lines). Formatting my AGENTS.md
  and formatting pristine main differ only by my 2 intended changes, so
  my lines add no new violation. Not reformatted: that would break the
  4-line pointer limit. Reported as a pre-existing failure, not a pass.
- `npm run lint:subjects`: GATE PASSED.
- `npm run check:provenance`: PASSED (re-run after commit; the pre-commit
  run covered an empty range).
- `npx tsc --noEmit`: clean. `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm test`: 2707 pass, 0 fail (220 suites).
- `npm run build:pages`, `npm run test:worker`, Playwright E2E: NOT RUN
  locally — docs-only change, no code touched; CI carries them per
  AGENTS.md section 4, "Testing on a budget".
- Reviewer verdict: ACCEPT (one reviewer seat, clean context, diff +
  gate output + file specs only). Confirmed: 3 files only, 52-line
  playbook with sections 1-8 in order, AGENTS.md +3/-1, eval card
  3 cases, Graph node + governs edge + decision node, zero
  vendor/model matches in the playbook. Caveat recorded by the
  reviewer: the pre-commit provenance run covered an empty range;
  re-run after commit.

## Graph

- Add node: `docs/ops/orchestration.md` — orchestration playbook; an
  AGENTS.md addendum for tasks that use helper agents.
- Add edge: AGENTS.md `governs` `docs/ops/orchestration.md`.
- Add node: decision (Veeresh, 2026-11-15) — "orchestration prompt should
  be an addendum to agents.md, like a reference point where anytime you
  need to orchestrate to do the job".
- No existing nodes or edges changed.
