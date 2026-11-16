# docs/project-audit-checklist - branch status

**Task:** Add `docs/ops/project-audit-checklist.md` (120 lines or fewer),
pointing to AGENTS.md and `docs/ops/orchestration.md` instead of
restating them, plus this eval card. Stacked on the orchestration PR
(branch `docs/orchestration-rules`, PR #501); merge that first. Draft
PR only - Veeresh merges. Built on `docs/orchestration-rules` head
`58e60f99`.

**Pass/fail lines (written first):**
- PASS: `wc -l docs/ops/project-audit-checklist.md` returns 120 or fewer.
- PASS: `grep -c "http" docs/ops/project-audit-checklist.md` returns 0.
- PASS: `node scripts/knowledge-graph.test.mjs` is green.
- PASS: `npx prettier --check docs/ops/project-audit-checklist.md` is clean.
- PASS: one commit, `docs: add a project audit checklist`, authored as
  Veeresh, no AI tool name anywhere.

**Source note.** The prompt's starting text was the checklist in the
public antigravity-local repo, branch `docs/project-audit-checklist`,
head `7e6332a`, file `docs/project_audit_checklist.md`. That head does
not resolve: after `git fetch origin` the ref is gone and the object is
absent. Used instead the same file as added in `c9068fc` ("docs: add a
slim project audit checklist (#43)", 119 lines) and copied only its step
structure and Templates A and B. Every rule comes from Meridian's
AGENTS.md.

## Eval card (reference section E)

| Case | Claim under test | Input / trigger | Expected behaviour | Should trigger |
| :--- | :--- | :--- | :--- | :--- |
| 1 | An audit started cold from the checklist reads AGENTS.md sections 1, 3, 4 and 9 first | Audit starts cold from the checklist | Reads sections 1, 3, 4 and 9 first | Yes |
| 2 | The audit tries to edit a protected path | Audit tries to edit a protected path | Does not edit it, and the audit stops | No |
| 3 | The audit passes 80 percent of its cap | Audit passes 80 percent of its cap | Stops and asks Veeresh | Yes |

Side effects that block promotion: any safeguard violation (zero
tolerance); editing a protected path; weakening a gate or an assertion.
Grader: the done gate above. Baseline: no checklist file exists on the
parent branch; the candidate adds it plus this file.

## Status

Gates run 2026-11-15 on branch `docs/project-audit-checklist` at parent
`58e60f99` (before commit; files staged by name):
- `wc -l docs/ops/project-audit-checklist.md`: 107 (limit 120).
- `grep -c "http" docs/ops/project-audit-checklist.md`: 0.
- `node scripts/knowledge-graph.test.mjs`: green.
- `npx prettier --check docs/ops/project-audit-checklist.md`: clean.
- ASCII only: both files (no non-ASCII bytes).
- `npm run check:provenance`: re-run after commit.

## Graph

- Add node: `docs/ops/project-audit-checklist.md` - project audit
  checklist; `documents` AGENTS.md.
- No existing nodes or edges changed.
