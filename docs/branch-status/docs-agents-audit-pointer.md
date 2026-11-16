# docs/agents-audit-pointer - branch status

**Task:** Point a cold-start agent at the audit checklist that landed
in #502. Two additions in AGENTS.md only, plus this eval card. Draft
PR only - Veeresh merges. Built on origin/main `0d47ad5f`.

**Pass/fail lines (written first):**

- PASS: `docs/ops/project-audit-checklist.md` exists on origin/main.
- PASS: the cold-start list names that file immediately after the
  orchestration entry.
- PASS: the exact line `**Running an audit?** Use docs/ops/project-audit-checklist.md. AGENTS.md wins if they differ.` sits under the "Orchestrating helpers?" line.
- PASS: `git diff origin/main -- AGENTS.md` is only those two additions.
- PASS: `node scripts/knowledge-graph.test.mjs` is green.
- PASS: the eval card's should-trigger cases fail on baseline and pass
  on the candidate; should-not-trigger cases pass on both.
- PASS: `npm run check:provenance` passes for origin/main..HEAD.
- PASS: one commit, Conventional Commits, authored as Veeresh, no AI
  tool name anywhere.

TASK / requested outcome: a cold-start agent can find
`docs/ops/project-audit-checklist.md` from AGENTS.md.
Interpretations considered and selected reading: #502 added the
checklist but not an AGENTS.md pointer; this change is the missing
pointer only.
Tier and rationale: never Tier 0 (AGENTS.md changes; eval discipline,
reference section E).
Done condition / scenarios / evidence that will prove it: the eval
card below, plus the docs and provenance gates.
Files in scope: AGENTS.md (two pointer lines) and this status file.
Out of scope: the checklist body, orchestration.md, graph.json
(integrator-only).
Verify command: the gates listed above.
Commit and PR plan: one commit on `docs/agents-audit-pointer`, draft
PR to main, no merge.

## Eval card (reference section E)

Recorded before the candidate run. Target revision: this branch tip.
Prompt version: AGENTS.md at origin/main `0d47ad5f` plus two pointer
lines. Grader: deterministic file checks (grep and diff) in this
worktree. Repetition rule: one run, because the grader is not
stochastic.

| Case  | Claim under test                                                  | Input / trigger                                                  | Expected behaviour                                                                                                       | Should trigger     |
| :---- | :---------------------------------------------------------------- | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :----------------- |
| AP-01 | The cold-start list names the audit checklist after orchestration | An agent reads the AGENTS.md cold-start note                     | `docs/ops/project-audit-checklist.md` appears after `docs/ops/orchestration.md` in that list                             | should-trigger     |
| AP-02 | An audit is pointed at the checklist, and AGENTS.md still wins    | An agent reads the paragraph under "Orchestrating helpers?"      | The next line is exactly `**Running an audit?** Use docs/ops/project-audit-checklist.md. AGENTS.md wins if they differ.` | should-trigger     |
| AP-03 | A non-audit task is not told to open the checklist                | An agent starts a typo fix or helper orchestration with no audit | The new pointer is gated by "Running an audit?" and cold-start item (6) says "when you run an audit"                     | should-not-trigger |
| AP-04 | No other AGENTS.md rule is rewritten                              | `git diff origin/main -- AGENTS.md`                              | Only the two pointer additions; authority, gates, and the existing orchestration line stay as they were                  | should-not-trigger |

Side effects that block promotion: any safeguard violation (zero
tolerance); a vendor or model name written into a doc; rewriting any
other AGENTS.md line; weakening a gate or an assertion.

Baseline: origin/main `0d47ad5f` (this worktree before the AGENTS.md
edit). Candidate: the same tree after the two pointer lines.

## Status

Eval card recorded, then baseline run, then the AGENTS.md edit, then
the candidate run, all in this worktree on 2026-11-16 (America/Chicago).

Baseline (origin/main `0d47ad5f`, before the AGENTS.md edit):

- AP-01 FAIL (checklist absent from the cold-start list)
- AP-02 FAIL (pointer line absent)
- AP-03 PASS (checklist not named, so a non-audit start is not sent there)
- AP-04 PASS (no AGENTS.md diff)

Candidate (after the two pointer lines):

- AP-01 PASS
- AP-02 PASS (exact line under "Orchestrating helpers?")
- AP-03 PASS (item (6) is "when you run an audit"; helpers line unchanged)
- AP-04 PASS (`git diff origin/main -- AGENTS.md` is only those two additions)

Gates:

- `docs/ops/project-audit-checklist.md` exists on origin/main.
- `node scripts/knowledge-graph.test.mjs`: 4 pass, 0 fail.
- `npx prettier --check docs/branch-status/docs-agents-audit-pointer.md`: clean after format.
- `npx prettier --check AGENTS.md`: FAILS on main too. Pristine
  `origin/main:AGENTS.md` fails the same check. Formatting the
  candidate and formatting pristine main differ only by the two
  intended pointer lines, so the new lines add no new violation. Not
  reformatted.
- `npm run check:provenance`: re-run after commit.

Verdict: promote. Should-trigger cases failed on baseline and passed
on the candidate. Should-not-trigger cases passed on both. No blocking
side effects.

## Graph

- No new nodes. The checklist file already exists.
- Proposed edge (integrator folds this in): AGENTS.md `governs`
  `docs/ops/project-audit-checklist.md`, same shape as the
  orchestration playbook edge.
