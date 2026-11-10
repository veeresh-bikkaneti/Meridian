# Plan — `feat/science-definitions`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Stream 5 · Spec + shared engine; build gated · Start now.** Paste into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/science-definitions.
git fetch origin && git checkout feat/science-definitions && git merge --no-edit origin/main
Read docs/scaling/plans/feat-science-definitions.md and follow it. You may edit ONLY:
  docs/scaling/science-definitions-spec.md
  docs/scaling/p4-algebra-physics-brief.md
  docs/scaling/p6-chemistry-brief.md
  docs/scaling/p7-science-map-brief.md
  src/scenes/predict-see/**
  docs/branch-status/feat-science-definitions.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/science-definitions. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

Shared rules (read once, from this branch after syncing): `docs/scaling/agent-instructions.md`,
`docs/scaling/k12-learning-design-standard.md` (cite by section, never copy),
`docs/scaling/subject-progression-map.md`, `docs/scaling/educator-gate-rubric.md`,
`docs/scaling/contracts.md`.

## Your task

Update `science-definitions-spec.md` and the P4 / P6 / P7 briefs: §9 block,
NGSS physical-science codes only (no biology), the disclosed Spatial Data
Scientist seat. You own the shared predict-then-see engine: contract I4's
types in `src/scenes/predict-see/types.ts` exactly as written in
`contracts.md`, so physics and chemistry can build against them in parallel.

Stage B, build v1 (about 4 hours), only once the owner has lifted the build
gate for this branch (the integrator tells you): the I4 engine (three.js scene shell, tiers, dispose on exit, pause when hidden) with one ramps-and-friction demo scene. Ship the types file first, as its own small PR. Build it as a
subject module (contract I1) with `released: false`, against contracts I2 to
I4. Full / Lite / Flat tiers with the same learning; tests first; all
`AGENTS.md` gates; a screen recording. Until Phase 0 merges, prove it with
tests and a local harness you do not commit.

## Files you own (exclusive; no other branch edits these)

- `docs/scaling/science-definitions-spec.md`
- `docs/scaling/p4-algebra-physics-brief.md`
- `docs/scaling/p6-chemistry-brief.md`
- `docs/scaling/p7-science-map-brief.md`
- `src/scenes/predict-see/**`
- `docs/branch-status/feat-science-definitions.md` (your status: task, scope, done, open)

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
