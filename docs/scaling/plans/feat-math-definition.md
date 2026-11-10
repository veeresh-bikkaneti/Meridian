# Plan — `feat/math-definition`

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

**Prompt 2 · Approved definition work (docs only).** Paste this into any capable coding agent:

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/math-definition.
git fetch origin && git checkout feat/math-definition && git merge --no-edit origin/main
Read docs/scaling/plans/feat-math-definition.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/math-definition. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

## Read first (once, from this branch after syncing with main)

`docs/scaling/agent-instructions.md` (shared rules, owner decisions, house
stack, token economy), `docs/scaling/k12-learning-design-standard.md` (the
learning bar; cite it by section, never copy it),
`docs/scaling/subject-progression-map.md` (chain and cross-application web),
`docs/scaling/educator-gate-rubric.md` (what the teacher checks).

## Your task

Finish `docs/scaling/math-definition-spec.md`. Add the standard's §9 block.
For every mode in the topic map: one observable objective, its CCSS code with
a live source, the in-game evidence, and the real problem that opens it (why
first). Define math's "confident" bar for the existing Explored / Growing /
Mastered states. Replace the separate error-type deck with a filter on the
existing review deck (`src/game/review-deck.ts`). Describe the play surface in
Full / Lite / Flat motion tiers with learning parity. Add a 7-10 entry tier
(concrete, picture first, no algebra or trigonometry) and an 18+ top tier
(big-number tricks, Olympiad-style depth). Then assemble the educator evidence
pack (rubric, "Evidence pack") for Times Table Races so a real teacher can sign
it.

## Order and neighbours

- **Start after:** Nothing. Start now.
- **Feeds:** `feat/math-spec` (objectives and codes); the 7-10 and 18+ tiers also wait on `feat/age-groups` for the code side.
- **May collide with:** `feat/math-spec` reads your objectives: never edit `math-spec.md` here.

## Files you own

`docs/scaling/math-definition-spec.md`, plus your own section of `BRANCH_STATUS.md` (repo root, per
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

- Every §9 checkbox in the standard is ticked, or listed as open with a reason.
- Every item has an observable objective and a standard code with a live
  source, or is marked UNVERIFIED with a source note.
- Every unit opens with a real problem that needs the skill (standard §0, §3)
  and has a "use it elsewhere" round from the map's cross-application web.
- Counts stay PROPOSED or TO CONFIRM; nothing is invented.
- Your section of `BRANCH_STATUS.md` is updated; the branch is synced with main
  and pushed; your final report is under 150 words and names the owner
  decision needed next. No code gates apply (docs only); say so.
- Report what the educator must sign.
