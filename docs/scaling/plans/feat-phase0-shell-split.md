# Plan — `feat/phase0-shell-split`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Prompt 1 · Approved to build (Tier 2 code).** Paste this into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/phase0-shell-split.
git fetch origin && git checkout feat/phase0-shell-split && git merge --no-edit origin/main
Read docs/scaling/plans/feat-phase0-shell-split.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/phase0-shell-split. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

## Read first (once, from this branch after syncing with main)

`docs/scaling/agent-instructions.md` (shared rules, owner decisions, house
stack, token economy), `docs/scaling/k12-learning-design-standard.md` (the
learning bar; cite it by section, never copy it),
`docs/scaling/subject-progression-map.md` (chain and cross-application web),
`docs/scaling/educator-gate-rubric.md` (what the teacher checks).

## Your task

Continue the Phase 0 shell split per `docs/scaling/phase0-shell-split-spec.md`
(slice 1 is partial). Split so each subject loads as its own lazy chunk and
three.js loads only inside a chosen subject. Measure and record the baseline:
initial JS gzip, per-chunk gzip, and tap-to-first-paint on the weak-device CI
profile. Write the measured numbers into the spec as the starting budgets.
No behaviour change to the geography game. Tier 2 per `AGENTS.md`: council
manifest first, then failing tests, then the minimal change.

## Order and neighbours

- **Start after:** Nothing. Start now.
- **Feeds:** Every subject build (each subject loads as its own lazy chunk).
- **May collide with:** `feat/age-groups` (game shell and age-profile wiring); the non-scaling branch `feat/wave2-kid-ux-shell` also edits `src/components/game-app.tsx`. Keep each slice small and sync with main before each slice.

## Files you own

`docs/scaling/phase0-shell-split-spec.md`, `src/components/game-app.tsx`, `src/game/shell-helpers.ts` and the tests beside them, plus your own section of `BRANCH_STATUS.md` (repo root, per
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

- All `AGENTS.md` quality gates green, run by you, with output quoted.
- A screen recording of the unchanged geography game.
- Your section of `BRANCH_STATUS.md` updated; branch synced with main and
  pushed; a draft PR opened or updated. Never merge.
