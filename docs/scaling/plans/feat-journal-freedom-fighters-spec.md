# Plan — `feat/journal-freedom-fighters-spec`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Stream 16 · Spec; clips gated · Start now.** Paste into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-freedom-fighters-spec.
git fetch origin && git checkout feat/journal-freedom-fighters-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-freedom-fighters-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-freedom-fighters-spec.md
  docs/scaling/journals/freedom-fighters/**
  public/videos/journals/freedom-fighters/**
  docs/branch-status/feat-journal-freedom-fighters-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-freedom-fighters-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

Shared rules (read once, from this branch after syncing): `docs/scaling/agent-instructions.md`,
`docs/scaling/k12-learning-design-standard.md` (cite by section, never copy),
`docs/scaling/subject-progression-map.md`, `docs/scaling/educator-gate-rubric.md`,
`docs/scaling/contracts.md`.

## Your task

Your journal: `docs/scaling/journal-freedom-fighters-spec.md` (proposed clips: 2, PROPOSED). Screen every clip
against standard §7a (no religion, no sexuality or gender identity topics, no
current or contested politics; achievements and places, never politics; when
in doubt, cut and log why). For each kept clip, data matching contract I5:
group, objective, C3 code (live source or UNVERIFIED), the real question it
opens with (how far, how many years ago, where), one read-aloud retrieval
check, captions and transcript, a globe fly-to with a Flat 2D pin. Tone: remembrance, no graphic detail.

Stage B, only once the owner lifts the build gate: produce the clips with the
existing journal movie recipe (`docs/journal-movies.md`) into
`public/videos/journals/freedom-fighters/`, with your manifest at
`public/videos/journals/freedom-fighters/manifest.json`. Never edit
`public/videos/journal-manifest.json`; the integrator merges your entries.

## Files you own (exclusive; no other branch edits these)

- `docs/scaling/journal-freedom-fighters-spec.md`
- `docs/scaling/journals/freedom-fighters/**`
- `public/videos/journals/freedom-fighters/**`
- `docs/branch-status/feat-journal-freedom-fighters-spec.md` (your status: task, scope, done, open)

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
