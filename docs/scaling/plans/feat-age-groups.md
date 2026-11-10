# Plan — `feat/age-groups`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Prompt 1b · Code, NOT yet approved: manifest only, then stop for the owner's go.** Paste this into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/age-groups.
git fetch origin && git checkout -b feat/age-groups origin/main
Read docs/scaling/plans/feat-age-groups.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/age-groups. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

## Read first (once, from this branch after syncing with main)

`docs/scaling/agent-instructions.md` (shared rules, owner decisions, house
stack, token economy), `docs/scaling/k12-learning-design-standard.md` (the
learning bar; cite it by section, never copy it),
`docs/scaling/subject-progression-map.md` (chain and cross-application web),
`docs/scaling/educator-gate-rubric.md` (what the teacher checks).

## Your task

Move `src/game/age-profile/bands.ts` from 5-7 / 8-10 / 11-13 to the owner's
three groups 7-10 / 10-18 / 18+ (standard §1). Merge 5-7 and 8-10 into 7-10,
widen 11-13 to 10-18, add 18+ (hardest tiers, skippable narration, no timers in
7-10). Migrate stored profiles so no player loses progress. Group labels and
parent-facing strings are owner copy: leave TODO placeholders and ask; never
invent them. Never ask for an exact age. Tier 2 per `AGENTS.md`: council
manifest, failing tests first, minimal change, all gates, screen recording.
Write the manifest and stop for the owner's go before any code.

## Order and neighbours

- **Start after:** Phase 0 slice in progress is fine; write the manifest now, code only on the owner's go.
- **Feeds:** Math definition's 7-10 and 18+ tiers, and every spec that names the three groups.
- **May collide with:** `feat/phase0-shell-split` (game shell). Sync with main before each change.

## Files you own

`src/game/age-profile/bands.ts`, its tests, and the profile migration, plus your own section of `BRANCH_STATUS.md` (repo root, per
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

- Now: the council manifest pushed and the owner's go requested. Stop.
- After the go: all `AGENTS.md` gates green, screen recording, your section of
  `BRANCH_STATUS.md` updated, draft PR only. Never merge.
