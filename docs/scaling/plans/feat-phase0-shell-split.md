# Plan — `feat/phase0-shell-split`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Stream 1 · Code, approved to build · Start now.** Paste into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/phase0-shell-split.
git fetch origin && git checkout feat/phase0-shell-split && git merge --no-edit origin/main
Read docs/scaling/plans/feat-phase0-shell-split.md and follow it. You may edit ONLY:
  src/components/game-app.tsx
  src/components/game-app-lazy-boundary.test.ts
  src/game/shell-helpers.ts
  src/game/shell/**
  src/subjects/registry.ts (+ test)
  docs/scaling/phase0-shell-split-spec.md
  docs/branch-status/feat-phase0-shell-split.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/phase0-shell-split. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

Shared rules (read once, from this branch after syncing): `docs/scaling/agent-instructions.md`,
`docs/scaling/k12-learning-design-standard.md` (cite by section, never copy),
`docs/scaling/subject-progression-map.md`, `docs/scaling/educator-gate-rubric.md`,
`docs/scaling/contracts.md`.

## Your task

Finish the Phase 0 shell split per `docs/scaling/phase0-shell-split-spec.md`
(slice 1 is partial). Each subject loads as its own lazy chunk; three.js loads
only inside a chosen subject. Deliver contract I1 first, as its own small PR:
`src/subjects/registry.ts` discovers `src/subjects/*/index.ts` with
`import.meta.glob` (the pattern `src/lib/flag-registry.ts` already uses) and
lists only modules with `released: true`, so adding a subject never edits a
shared file. Then measure and record the baseline (initial JS gzip, per-chunk
gzip, tap-to-first-paint on the weak-device CI profile) as the starting
budgets. No behaviour change to the geography game. Tier 2: council manifest,
failing tests, minimal change, all gates, screen recording.

## Files you own (exclusive; no other branch edits these)

- `src/components/game-app.tsx`
- `src/components/game-app-lazy-boundary.test.ts`
- `src/game/shell-helpers.ts`
- `src/game/shell/**`
- `src/subjects/registry.ts (+ test)`
- `docs/scaling/phase0-shell-split-spec.md`
- `docs/branch-status/feat-phase0-shell-split.md` (your status: task, scope, done, open)

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
