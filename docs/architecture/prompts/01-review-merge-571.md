# 01. Review PR #571 (Phase 1 Part B), then hand over a merge command

Repo: github.com/veeresh-bikkaneti/Meridian. Handover base: main 5930e9304bccb9eb38db7ce57bd04698c416be61. Run `git rev-parse origin/main` first; if main moved, use the new tip and say so in your first message. Read `docs/architecture/HANDOVER.md` before anything else. Do nothing outside this task.

**Tier:** 1, cap 100k, estimate 50k. **Runs:** now. **Owns:** review only, plus `docs/branch-status/phase1-ports-part-b.md` on the PR branch.

TASK:
1. Fetch `pull/571/head`; expected head `acf8b24d32ce88d5a3f4ccb1ae2fc0b04c17733b` (report if different). Verify with HANDOVER.md §7: clean merge-tree onto main, 8 files, noRawIo 45 -> 13 (exactly the 32 game-app.tsx storage rows gone), no other baseline row added.
2. Council Panel review (2 clean-context seats on cheaper models: architecture, regression). Evidence pack: diff, gate output, Phase 1 plan file. Check each storage call now goes through `src/platform/storage` ports with keys in `keys.ts`, behaviour unchanged, no test stubs added to production code.
3. Run gates in a worktree (`npm i --no-save zod` first) plus the specs touching game-app storage only.
4. The status doc says "B1 next" and is stale: fix it on the PR branch, one commit, Conventional Commit, owner identity.
5. If main moved past the PR base: take latest main, re-apply own lines in `eslint/layer-baseline.json` and `keys.ts` (cherry-pick, never rebase/merge).
6. Report the new head SHA and this command for Veeresh, filled in. Do not run it:
```
Merge PR #571 only if every check is green (required or not); if ANY check fails or is pending, stop and report.
gh pr ready 571
gh pr merge 571 --squash --admin --match-head-commit <FULL HEAD SHA> --delete-branch
```

## Rules for this run (same in every phase prompt)

**Read first, in order:** `AGENTS.md` §1, §3, §4, §9, §12; `docs/ops/orchestration.md`; `docs/ops/agents-reference.md` §F (capsule) and §J (briefs); `ARCHITECTURE.md` once Phase 0 has landed it. AGENTS.md wins where this prompt differs, except where the owner's merged amendment (Phase 0a) changes it.

**pstack loop:**
1. `sharpen`: restate the outcome, the done condition and the files in one capsule (reference §F). If anything is unclear, take the narrow reversible reading and write it down.
2. `statechart`: draw the states the change touches (for example: idle, loading, ready, error, offline) before you write code.
3. `architect`: name the layer of every file you touch (see `ARCHITECTURE.md`) and the one direction its imports may point.
4. `swarm`: split the work into slices with separate files. One slice per PR.
5. `arena`: for each real design choice, have two cheaper-model workers propose one option each. The lead picks and records why in the capsule.
6. `how`: write the step list the workers follow, with `path:line` pointers and the exact verify commands.
7. `tdd`: write a failing test first for each behaviour you add, then the smallest code that passes. Narrow regression only: the tests your change can break, plus the gates. CI runs the rest.
8. `unslop`: run it on every prose file you add or change (docs, PR body, status file).

**Who does what:**
- The lead (you) plans, writes briefs, integrates and verifies. You do not write the bulk.
- Building, writing and testing go to cheaper models as helper agents. Never write a model or vendor name anywhere.
- Review goes to a clean-context Council Panel seat on a cheaper model: one evidence pack (diff, gate output, the section of this prompt), parallel seats, scoped re-votes, at most 2 rounds (`docs/ops/council-panel-loop.md`). The builder never reviews its own work.

**Token economy:** state the tier cap and your estimate in your first message, before any work. Keep a running total after each helper returns. At 80% of the cap, spawn nothing more and ask Veeresh. Never pass the cap without his word. Report tokens used and estimated cost with every result. No meter exists, so label numbers as estimates.

**Mockup before UI code:** any change a player can see starts with a working mockup built from the real shared components (Storybook story once Phase 0 lands it, otherwise a throwaway route or artifact using the real components). Post the mockup link and a screenshot, and wait for Veeresh's approval before writing the UI code.

**Extraction is allowed:** when the slice is pulling shared code out (a port, a shared component, a module), you may touch every file that the extraction moves. Do not touch files the slice does not need. Keep one slice per PR.

**Git:** pushing to your assigned branch is authorized. Merging is Veeresh's, per PR, on his word. No `git rebase`, no `git merge`, no force push: use `git cherry-pick` to bring commits across. Stage named files only. Conventional Commits. Author every commit as the repo identity `check:provenance` expects. No `Co-Authored-By`, no AI trailers, no "Generated with" lines, no AI tool names in commits or added lines: run `npm run check:provenance` before you push. Open PRs as drafts and fill in `.github/pull_request_template.md` (Phase 0 adds it).

**Gates before review (AGENTS.md §9 plus):** `npx tsc --noEmit`, `npm test`, `npm run test:worker`, `node scripts/lint-cards.mjs`, `npm run build:pages`, `npm run lint:nav`, `npm run lint:subjects`, `npm run check:provenance`, `npm run check:entry-size`, and from Phase 0 on `npm run lint:arch`. Playwright: only the specs your change can break, with `--workers=1`. Report each gate as PASS / FAIL / NOT RUN.

**Facts:** every fact you write into a doc or PR (a count, a version, a setting name) is either `[tested]` with the command, or sourced with a link and a tag: High = 3+ agreeing primary sources, Moderate = 2 or 1 primary, Low = 1 secondary or conflicting. If you can't verify it, drop it and say so in one line.

**Report back (pstack:teach + i-have-adhd):** one line with the outcome first. Then 3 to 5 bullets: what changed and why it matters (teach the one idea a new developer should learn from this PR), gates PASS/FAIL/NOT RUN, tokens used vs cap and cost, PR link and head SHA. One question at the end only if you need a decision.
