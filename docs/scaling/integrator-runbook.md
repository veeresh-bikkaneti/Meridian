# Integrator runbook — reviewing and merging parallel streams

The integrator sits above the streams. It is the only session that edits
shared files and the only one that merges, and it merges on the owner's word.
Streams own exclusive paths (`branch-prompts.md`), so they never collide.

## Branches stay open (owner rule, 2026-11-10)

All scaling branches stay open until dev work is complete. Never delete or
close one, including after its PR merges: merge with the branch kept (no
"delete branch after merge"), and keep GitHub's automatic head-branch
deletion off for these branches. This overrides the `AGENTS.md` line that
deletes merged branches, for the scaling streams only. A stream opens its next
PR from the same branch.

## Merge order

Every stream starts now. Merge in this order as PRs arrive, so contracts land
before the code that uses them:

1. **Contracts first:** the Phase 0 registry PR (I1), the predict-see types PR
   (I4), the age-groups PR (I3) once the owner says go.
2. **Specs (Stage A):** any order, as each passes review. A spec merges as
   PROPOSED; the educator gate blocks its build, not its spec.
3. **Builds (Stage B):** after a stream's spec is signed by a real educator
   and the owner lifts the build gate. A subject merges with `released:
   false`; turning it on is a separate one-line owner decision.
4. **Integrator follow-ups:** wire review-deck entries, merge journal
   manifests, update root `BRANCH_STATUS.md` and shared docs.

## Review checklist for every PR

- [ ] **Ownership:** `git diff --name-only origin/main...` touches only the
      branch's owned paths and its `docs/branch-status/<branch>.md`. Anything
      else goes back to the stream or becomes an integrator change.
- [ ] **Checks green** on the PR head, run by CI, not claimed.
- [ ] **Docs only or code:** docs-only PRs need no code gates; code PRs need
      the `AGENTS.md` tier gates and a screen recording.
- [ ] **Council review:** a lean council of experts on cheaper models
      (learning designer, accessibility, adversarial skeptic; architect for
      code) reads the diff and summary once; findings fixed or listed.
- [ ] **Mission:** every unit opens with a real problem that needs the skill
      and has a "use it elsewhere" round (standard §0).
- [ ] **Content rule §7a and no biology:** nothing on religion, sexuality or
      gender identity, or contested politics; no life science.
- [ ] **Groups:** only 7-10 / 10-18 / 18+; no algebra or trigonometry in 7-10.
- [ ] **Teacher gate:** builds only after a real educator signs the rubric.
- [ ] **No invented numbers;** counts stay PROPOSED or TO CONFIRM.
- [ ] **Owner's merge word** for this PR.
- [ ] **Branch kept:** merged without deleting the head branch.

## How streams sync

Streams merge `origin/main` into their own branch at session start, after
each merge to main and before a PR. No rebase or force-push (`AGENTS.md`
needs the owner's authorization for each force-push). After each merge to
main, the integrator tells open streams to sync. A conflict means a stream
touched a path it doesn't own: the integrator fixes the ownership, not the
stream.

## Status

Each stream keeps its status in `docs/branch-status/<branch>.md`, as
`AGENTS.md` requires (stream 18, 2026-11-10). Root `BRANCH_STATUS.md` is
integrator-only.
