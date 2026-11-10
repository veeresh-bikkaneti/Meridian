# Plan — `feat/age-groups`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Stream 2 · Code, manifest now; code on the owner's go · Start now (manifest).** Paste into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/age-groups.
git fetch origin && git checkout -b feat/age-groups origin/main
Read docs/scaling/plans/feat-age-groups.md and follow it. You may edit ONLY:
  src/game/age-profile/**
  docs/scaling/age-groups-manifest.md
  docs/branch-status/feat-age-groups.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/age-groups. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

Shared rules (read once, from this branch after syncing): `docs/scaling/agent-instructions.md`,
`docs/scaling/k12-learning-design-standard.md` (cite by section, never copy),
`docs/scaling/subject-progression-map.md`, `docs/scaling/educator-gate-rubric.md`,
`docs/scaling/contracts.md`.

## Your task

Write the council manifest for moving `src/game/age-profile/bands.ts` from
5-7 / 8-10 / 11-13 to the three groups 7-10 / 10-18 / 18+ (standard §1), with
profile migration so no player loses progress, and contract I3's
`getAgeGroup()` exported from `src/game/age-profile/`. Group labels and
parent-facing strings are owner copy: TODO placeholders, never invented.
Never ask for an exact age. Stop for the owner's go before code. If a file
outside your paths imports the bands, list it for the integrator; do not
edit it.

## Files you own (exclusive; no other branch edits these)

- `src/game/age-profile/**`
- `docs/scaling/age-groups-manifest.md`
- `docs/branch-status/feat-age-groups.md` (your status: task, scope, done, open)

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

## Done when

- Every item in your task is done, or listed as open with a reason.
- Your status file is updated, the branch is synced with main and pushed, and
  a draft PR is open. You never merge it; the integrator does.
- For code: all `AGENTS.md` gates are green and run by you, with a screen
  recording. For docs only: say that no code gates ran.
- Your report is under 150 words and names any file you need the integrator to
  change.
