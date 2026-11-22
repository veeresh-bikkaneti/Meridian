# Meridian release train (architecture phases + feature branches)

Written 2026-11-19. Owner: Veeresh. Main is the only integration point; every phase PR lands on main on its own, and every feature branch syncs to main before it merges.

## Order of cars

| Step | What | Gate to start | Gate to merge |
|:--|:--|:--|:--|
| 1 | PR 542 landmark globe | open now | his Stage 1 / code review word |
| 2 | Phase 0a `docs/amend-constitution-extraction` | can be built now, held as draft | 542 on main, 0a synced to that main, panel PASS, his word |
| 3 | Phase 0 PRs 0.1 -> 0.2 -> 0.3 -> 0.4, one at a time | 0a on main | each: synced to main, gates green, his word (0.4 needs his Storybook install word) |
| 4 | Lanes in parallel: Phases 1, 2, 3, 5.1-5.4 | PR 0.2 on main (0.4 for Phase 2 mockups) | each PR: synced, gates green, no other open PR edits the same screen |
| 5 | Phase 4 game-app.tsx split, one PR at a time | the Phase 1 and 2 parts it uses are on main | before each split: feature PRs touching game-app.tsx land or park |
| 6 | Phase 5.5 CI gates + branch protection | Phases 1-4 on main | his word on ESLint upgrade, required e2e set, "branch must be up to date" |

## Sync rule (every branch, phase or feature)

1. Before asking for a merge, bring the branch up to latest main. The local CLI blocks `git merge` and `git rebase`, so use GitHub's "Update branch" button, or cut a fresh branch from main and `git cherry-pick` the branch's own commits onto it.
2. Fix conflicts on the branch, never on main.
3. Rerun the gates on the synced head: typecheck, `npm test`, `lint:nav`, the PR's targeted e2e specs, `check:provenance`, and (once Phase 0 lands) the architecture checks.
4. Report the synced head SHA. A merge word covers that SHA only; a new sync needs a fresh check.

## Why later branches conform cheaply

Phase 0 adds baselines: existing violations are listed and pass; new code must follow the rules, and each later slice shrinks the list. A feature that syncs after Phase 0 fixes only the lines it adds, not the backlog.

## Conflict hot spots

- `src/**/game-app.tsx` (8,886 lines): Phase 4 splits it. Highest sync cost; schedule features touching it before or between split PRs.
- `AGENTS.md`: Phase 0a only. Feature branches don't edit it while 0a is open.
- Screen files under Phase 2: one open PR per screen.

## Holds

- No phase PR merges out of order.
- No two phase PRs from the same phase open on the same file.
- Merges stay Veeresh's, per PR, pinned to head SHA.
