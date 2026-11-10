# Plan — `chore/model-neutral-agents`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Stream 18 · Process change (never Tier 0) · Start now.** Paste into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch chore/model-neutral-agents.
git fetch origin && git checkout -b chore/model-neutral-agents origin/main
Read docs/scaling/plans/chore-model-neutral-agents.md and follow it. You may edit ONLY:
  AGENTS.md
  docs/ops/agent-council-protocol.md
  docs/branch-status/chore-model-neutral-agents.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only chore/model-neutral-agents. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

Shared rules (read once, from this branch after syncing): `docs/scaling/agent-instructions.md`,
`docs/scaling/k12-learning-design-standard.md` (cite by section, never copy),
`docs/scaling/subject-progression-map.md`, `docs/scaling/educator-gate-rubric.md`,
`docs/scaling/contracts.md`.

## Your task

Remove every vendor and model name from `AGENTS.md` and
`docs/ops/agent-council-protocol.md`: "The orchestrator uses the strongest
model the builder can afford; worker roles use the cheapest capable model,
orchestrated as subagents; design calls go to a council of experts that
reviews summaries and diffs, not bulk output." In the same PR, replace the
root `BRANCH_STATUS.md` rule with the per-branch record
`docs/branch-status/<branch>.md` (owner's no-collision ask, 2026-11-10).
Follow "Prompt, skill, and persona changes — eval discipline" in full.

## Files you own (exclusive; no other branch edits these)

- `AGENTS.md`
- `docs/ops/agent-council-protocol.md`
- `docs/branch-status/chore-model-neutral-agents.md` (your status: task, scope, done, open)

Everything else is read-only for you. To change anything else, including root
`BRANCH_STATUS.md`, the shared docs, `contracts.md`, the review deck,
`learning.ts`, routes, `public/flags.json`, `public/videos/journal-manifest.json`,
`package.json` or config, ask the integrator in your report, naming the file
and why. The integrator makes the change on main, and you pick it up by merging.

## Keep up with main

Merge `origin/main` into your branch at session start, after each merge to
main and before you open or update a PR: `git fetch origin && git merge
--no-edit origin/main`. Because your paths are exclusive, conflicts should not
happen. If one does, stop and report it instead of resolving it in a shared
file. Don't rebase or force-push.

**This branch stays open until dev work is complete** (owner rule,
2026-11-10). A merged PR does not end it: keep working here, sync with main,
and open the next PR from the same branch. Never delete or close it.

## Done when

- Every item in your task is done, or listed as open with a reason.
- Your status file is updated, the branch is synced with main and pushed, and
  a draft PR is open. You never merge it; the integrator does.
- For code: all `AGENTS.md` gates are green and run by you, with a screen
  recording. For docs only: say that no code gates ran.
- Your report is under 150 words and names any file you need the integrator to
  change.
