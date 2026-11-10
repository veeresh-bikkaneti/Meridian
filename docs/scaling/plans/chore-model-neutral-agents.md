# Plan — `chore/model-neutral-agents`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Prompt M · Process change (never Tier 0: eval discipline).** Paste this into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch chore/model-neutral-agents.
git fetch origin && git checkout -b chore/model-neutral-agents origin/main
Read docs/scaling/plans/chore-model-neutral-agents.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only chore/model-neutral-agents. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

## Read first (once, from this branch after syncing with main)

`docs/scaling/agent-instructions.md` (shared rules, owner decisions, house
stack, token economy), `docs/scaling/k12-learning-design-standard.md` (the
learning bar; cite it by section, never copy it),
`docs/scaling/subject-progression-map.md` (chain and cross-application web),
`docs/scaling/educator-gate-rubric.md` (what the teacher checks).

## Your task

Edit `AGENTS.md` ("Worker roles run on the cheapest capable model") and
`docs/ops/agent-council-protocol.md` (seat table) to remove every vendor and
model name. Replace with: "The orchestrator uses the strongest model the
builder can afford; worker roles use the cheapest capable model, orchestrated
as subagents; design calls go to a council of experts that reviews summaries
and diffs, not bulk output." Follow `AGENTS.md` "Prompt, skill, and persona
changes — eval discipline" in full.

## Order and neighbours

- **Start after:** Nothing; independent.
- **Feeds:** Every branch's process text.
- **May collide with:** Any branch that edits `AGENTS.md` (none of the above should).

## Files you own

`AGENTS.md` (model names only) and `docs/ops/agent-council-protocol.md` (seat table), plus your own section of `BRANCH_STATUS.md` (repo root, per
`AGENTS.md`). Do not edit the shared docs (`agent-instructions.md`, the
standard, the map, the rubric, `branch-prompts.md`, `plans/`, `AGENTS.md`)
or another branch's files. Put any change you'd make to them in your report.

## Keep up with main (standing rule)

Sibling branches run in parallel and merge to main one at a time, so stay
close to main:

1. Sync at session start, after every merge to main, and before you open or
   update a PR: `git fetch origin && git merge --no-edit origin/main`.
2. Resolve conflicts. In `BRANCH_STATUS.md`, keep every section from both
   sides, with yours on top. In shared docs, take main's version; you never
   edit them here.
3. After a merge, if `docs/scaling/` changed, re-read the changed shared docs.
   Rerun your checks, then push.
4. Do not rebase or force-push. A rebase rewrites history and needs a
   force-push, which `AGENTS.md` allows only with the owner's authorization
   naming this branch and that push. If the owner's assignment for this branch
   grants it, you may rebase onto `origin/main` and push with
   `--force-with-lease`; otherwise merge as above.
5. Keep commits small and inside the files you own, so siblings rarely collide.

## Done when

- The eval discipline steps done and recorded; draft PR opened. Never merge.
