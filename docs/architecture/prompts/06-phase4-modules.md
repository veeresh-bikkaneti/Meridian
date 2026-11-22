# 06. Phase 4: split game-app.tsx, one module per PR

Repo: github.com/veeresh-bikkaneti/Meridian. Handover base: main 5930e9304bccb9eb38db7ce57bd04698c416be61. Run `git rev-parse origin/main` first; if main moved, use the new tip and say so in your first message. Read `docs/architecture/HANDOVER.md` before anything else. Do nothing outside this task.

**Tier:** 1 or 2 per PR, caps 100k / 400k. **Runs:** after #571 AND the Phase 2 PRs that touch shared files have merged. Serial: one module PR at a time. **Plan:** `docs/architecture/plan/phase-4-split-game-app.md` and the map `docs/architecture/game-app-map.md` (merged in #570). Branch per PR `phase4/<module>`.

**Owns:** `src/components/game-app.tsx`, the new module files, their tests, and game-app's rows in both baselines.

ORDER:
1. PR 2: shrink-only size-budget test for game-app.tsx (current line count is the ceiling; can only go down).
2. Then the state owners, fewest shared rows first, then the screens, Home and Play last, as the map orders them.
3. The 21 game-app noUpwardImport rows plus atlas-map's 9 rows are the checklist: each module PR cures its own rows.
4. LAST PR: move the thin remaining router to `src/routes`, only when it routes and holds no screen state.
No behaviour change. Each PR keeps the entry-size gate (limit 323,865 B, never raised).

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
