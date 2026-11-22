# Phase 4: split game-app.tsx into feature modules behind the shell

**Goal:** `src/components/game-app.tsx` becomes a thin screen router inside the shell. Each screen it now holds moves to its own feature module, with its state in a store (domain layer) and its I/O through Phase 1's ports. One module per PR.

**Tier:** 2 per PR (new module, 3+ files). Cap 400k per PR. **Estimate:** 150k to 220k per PR; plan on 6 to 8 PRs, so 1.0M to 1.7M for the phase (inferred: the file is the largest in `src` and most e2e specs pass through it, so each move needs more checking than a Phase 2 screen).
**Depends on:** Phase 1 (ports) and Phase 2 (shell) merged for the parts this module uses. Not parallel with itself: every PR edits `game-app.tsx`, so run them one after another.

## Facts (checked on main cbc119c, Nov 18)
- `game-app.tsx` is 8,886 lines, with 97 import lines, 47 top-level `function` declarations and 39 `useState(` calls [tested, `wc -l`, `grep -c`].
- It is in the shell-ban baseline for `pageLocalMain` and `homeButtonImport` [tested, `eslint/shell-ban-baseline.json`].
- At least 10 non-test files mention `game-app` (imports or comments), including `shell-registry.ts`, `site-footer.tsx` and `storyteller.tsx` [tested, `grep -rl game-app src`]. Read each before you move code they point at.
- The audit says `game-app.tsx:5023-5057` renders `SiteHeader` and that `GrandpaCoffeeRun` (`src/components/grandpa-coffee-run.tsx:753-790`) uses document-wide selectors outside `main.home-v5` [audit on 5ae217c9; re-check].

## First PR: the map (Tier 2, no code moves)
1. Inventory the file: each screen or phase it renders, the state each uses, the I/O each does, and which e2e specs cover it. Write it to `docs/architecture/game-app-map.md` (facts `[tested]` with the grep that found them).
2. `arena`: two workers each propose a module split and an order. The lead picks; the panel seat reviews. Order by fewest shared state variables first.
3. Add a size budget test: `game-app.tsx` may not grow, and each later PR lowers the number. Shrink-only, like the baselines.

## Each later PR: one module
- `statechart` for that screen's phases before moving anything.
- Move its state into a store in the domain layer with unit tests written first; move its view into `src/features/<name>/` (or the folder `ARCHITECTURE.md` names); `game-app.tsx` only routes to it.
- Fix document-wide selectors you meet by scoping them to the module's root element.
- Player-visible behaviour does not change. A mockup is needed only if the layout changes; if it does, Storybook story first and wait for Veeresh's approval.
- Lower the size budget and remove any baseline entries the move cures.

## Per-PR done condition
- Unit tests for the store PASS; the e2e specs the map lists for this module PASS with `--workers=1`, plus `home-layout.spec.ts`. Nothing else.
- `lint:arch` and `lint:nav` PASS; size budget lower than before.
- `check:entry-size` within limit; a lazy-loaded module should lower it. Show before and after.

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
