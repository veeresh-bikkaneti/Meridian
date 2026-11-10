# Branch status — chore/model-neutral-agents

Stream 18 of the scaling push. **Process change — never Tier 0.** Changes
`AGENTS.md` and `docs/ops/agent-council-protocol.md`, so it follows
"Prompt, skill, and persona changes — eval discipline" in full and needs
owner review and the owner's explicit per-PR merge word.
Docs only. Base: origin/main `8dee5bad`.

**Status: READY FOR OWNER REVIEW (draft PR). Behavioural eval NOT RUN (see open).**

## Task capsule

```text
TASK: remove every vendor and model name from AGENTS.md and the council
  protocol, replacing them with the owner's rule; replace the root
  BRANCH_STATUS.md rule with the per-branch record docs/branch-status/<branch>.md.
Source of the ask: docs/scaling/plans/chore-model-neutral-agents.md (owner
  brief for stream 18, 2026-11-10; "owner's no-collision ask, 2026-11-10").
Reading chosen: "vendor and model name" = model family names (opus, sonnet,
  haiku) plus one harness's own tool names (`Agent`, `Grep`, `Glob`,
  `Explore`), which tie the protocol to one vendor's runtime. Generic
  words kept: "LLM" (card rule 5), "model tiers" (#231 clause), "never a
  model" (telemetry device class). Root BRANCH_STATUS.md itself is not
  deleted (outside my paths); only the rule text changes.
Tier: never Tier 0 (AGENTS.md tier table, exception for this file).
Done condition: eval card cases MN-01..MN-07 pass on the candidate and fail
  where expected on the baseline; diff touches no safeguard section; draft PR open.
Files in scope: AGENTS.md, docs/ops/agent-council-protocol.md, this file.
Out of scope (integrator): see "For the integrator" below.
Verification: deterministic grader (below), run twice per version in fresh
  temp dirs; node --test scripts/brand-check.test.mjs (reads AGENTS.md).
  No AGENTS.md code gates ran (docs only).
Budget: Tier 2-sized process change; within cap (estimated, no meter).
Approvals needed: owner review + explicit per-PR merge word; panel approval
  of the final tip; checker: a reviewer other than this branch's author.
```

## What changed

| File | Where | Removed | Replacement |
| :--- | :--- | :--- | :--- |
| AGENTS.md | Worker roles (was L332-333) | `(haiku` first, `sonnet` only if `haiku` cannot) | removed; "cheapest model that can do it" stays |
| AGENTS.md | Worker roles (was L352) | "The orchestrator stays on `opus`" | **Model rule (vendor-neutral)** with the owner's sentence verbatim, plus "names roles, never a vendor or model" |
| AGENTS.md | Worker roles (was L355-356) | `sonnet` / `haiku` | "a mid-tier model" / "the smallest model" |
| AGENTS.md | Tier table L71 | `BRANCH_STATUS.md` | the branch's own status record `docs/branch-status/<branch>.md` |
| AGENTS.md | Task capsule L211 | `BRANCH_STATUS.md` | the branch's `docs/branch-status/<branch>.md` |
| AGENTS.md | Working conventions (was L402) | that branch's `BRANCH_STATUS.md` | that branch's `docs/branch-status/<branch>.md` |
| AGENTS.md | Working conventions (was L403-407) | root BRANCH_STATUS.md rule + "pending decision" note | **Per-branch status record** rule; root file integrator-only |
| protocol | §1 L13 | the `Agent` tool | the agent runtime |
| protocol | §1 table | column "Model"; `opus`; `sonnet` or `haiku` (x3) | owner's rule verbatim above the table; column "Model tier"; "Strongest model the builder can afford"; "Cheapest capable model" |
| protocol | §3.1 L45 | `Grep`, `Glob`, the `Explore` agent | text search, file-pattern search, a read-only exploration subagent |
| protocol | §3.5 L70 | "stays on `opus`" | "stays on the strongest model the builder can afford" |
| protocol | §6.4 L174 | Update `BRANCH_STATUS.md` | Update `docs/branch-status/<branch>.md` (never the root file) |

No line in Non-negotiable safeguards, Constitution, Quality gates, Budget,
Card content rules, or the eval-discipline section changed (MN-07).

## Eval card (recorded before the candidate run)

Target revision: baseline = origin/main `8dee5bad` versions of both files;
candidate = this branch's tip. Prompt version: AGENTS.md "Merged edition,
2026-10-27" → this PR. Grader: deterministic text checks (`rg`), script
kept off-repo at `/workspace/model-neutral-eval/grade.sh` on the build VM
(no allowed repo path for it; its patterns are quoted below so anyone can
re-run them). Repetition rule: 2 runs per version, each in a fresh
`mktemp -d` copy; promote only if both runs are identical and every case
meets its threshold. Blocks promotion outright: any safeguard text change,
any edit outside the 3 allowed paths, any vendor/model name added.

| Case | Claim under test | Input | Expected | Trigger | Baseline | Candidate | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MN-01 | No vendor/model names | both files, case-insensitive `opus\|sonnet\|haiku\|claude\|anthropic\|openai\|chatgpt\|gpt-N\|gemini\|bard\|grok\|xai\|llama\|mistral\|mixtral\|deepseek\|qwen\|copilot\|cursor\|codex\|perplexity` | 0 | should-trigger | 9 | 0 | PASS |
| MN-02 | No single-harness tool names | `` `Agent` `Grep` `Glob` `Explore` `` | 0 | should-trigger | 2 | 0 | PASS |
| MN-03 | Owner's rule present verbatim | fixed-string match | 1 in each file | should-trigger | 0/0 | 1/1 | PASS |
| MN-04 | Per-branch record is the rule | `docs/branch-status/<branch>.md` | ≥4 AGENTS, ≥1 protocol | should-trigger | 1/0 | 4/1 | PASS |
| MN-05 | No instruction to write root BRANCH_STATUS.md | 5 instruction phrasings | 0 | should-trigger | 5 | 0 | PASS |
| MN-06a-c | Generic words stay (no over-removal) | "never a model", "no LLM near place data", "the law's silence on model tiers" | 1 each | should-not-trigger | 1/1/1 | 1/1/1 | PASS |
| MN-06d-f | Neighbouring rules stay | "AGENTS.md itself … is never Tier 0", "are not delegated on" (judgement roles), "Councilor C is always a separate agent" | 1 each | should-not-trigger | 1/1/1 | 1/1/1 | PASS |
| MN-07 | Safeguard sections untouched | sections owning each `git diff -U0` hunk | only Agent council (tier row), Task capsule, Worker roles, Working conventions; protocol §1, §3, §6 | should-not-trigger | n/a | as expected | PASS |
| MN-08 | Activation: a fresh agent given the candidate delegates "run tests and report" to a cheaper subagent without naming a vendor, and does NOT delegate a review verdict on cost grounds | fresh agent sessions | both behaviours | should-trigger / should-not-trigger | NOT RUN | NOT RUN | OPEN |
| MN-09 | Activation: a fresh agent writes its status to `docs/branch-status/<branch>.md` and does not touch root `BRANCH_STATUS.md` | fresh agent session | per-branch file only | should-trigger / should-not-trigger | NOT RUN | NOT RUN | OPEN |

Both grader runs per version were byte-identical. Other checks:
`node --test scripts/brand-check.test.mjs` (reads AGENTS.md): baseline
26 pass / 0 fail / 5 skip; candidate 26 pass / 0 fail / 5 skip. PASS.

Regression cases kept: MN-01..MN-07 (stable IDs). None contaminated.

## Open

- [ ] **MN-08 / MN-09 behavioural eval — NOT RUN.** Needs fresh agent
      sessions (baseline vs candidate) with a named checker who is not this
      branch's author. This branch cannot certify itself. Until run, the
      behavioural claim is UNVERIFIED; promotion needs the run or the
      owner's recorded risk acceptance for this item.
- [ ] Owner review + explicit per-PR merge word; panel approval of the final tip.
- [ ] Root `BRANCH_STATUS.md` still exists (not my path) — integrator decides.

## For the integrator (files outside my paths)

1. `BRANCH_STATUS.md` (root): now integrator-only; retire or mark it so.
2. `docs/handbook/08-how-we-work.md` L136 (and L53, L86): records "BRANCH_STATUS.md on every feature branch" (2026-10-02) as a decision of record; mark superseded by the 2026-11-10 per-branch rule (handbook rule: mark, never delete).
3. `docs/handbook/09-onboarding.md` L24, L58, L92: tells new agents to write root `BRANCH_STATUS.md`.
4. `docs/journal-movies.md` L59 and `docs/scaling/integrator-runbook.md` L64: root-file references; L64 waits on this stream.
5. `docs/ops/agent-roles.md` L3, L15, L18, L21, L27: names `sonnet`, `haiku`, `opus` per role.
6. `docs/scaling/k12-plan-review.md` L9: a branch name containing a vendor name (historical record; likely leave).

## Resume

`git fetch origin && git checkout chore/model-neutral-agents && git merge --no-edit origin/main`,
then re-run the MN-01..MN-07 checks from the patterns above.
