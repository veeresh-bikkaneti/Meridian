# Phase 0: guardrails as code

**Goal:** turn the architecture rules into checks that fail a PR, so no agent can drift without a red build. No feature code moves in this phase.

**Tier:** 2 (cap 400k, shared by you and every helper). **Estimate:** 150k to 200k across 4 PRs (how: about 70k per helper start-up seen on recent Meridian runs, Nov 15 to 18, plus 30k to 50k of work per PR; inferred).
**Depends on:** Phase 0a merged. PR 533 (`feat/why-learn-hero-d1`) merged or closed first, because it edits `eslint/shell-ban-baseline.json` and `src/components/ui/shared-shell.test.ts`, and its own fix prompt adds a rule banning `src/game` → `src/subjects` imports [tested, `git diff --stat origin/main...pr/533`]. Fold that rule into the layer map below instead of keeping two copies.
**Blocks:** Phases 1 to 5.

## Facts this phase rests on (checked on main cbc119c, Nov 18)

- No general `lint` script; CI runs only `lint:nav` with `eslint.nav.config.mjs` (home label, voice channel, shell bans) [tested, `package.json`, `.github/workflows/node.js.yml:64`].
- The shrink-only pattern already works: `eslint/shell-ban-baseline.json` lists known violations, and `src/components/ui/shared-shell.test.ts` fails when a listed file stops violating, so the list can only shrink [tested].
- Flat-config blocks that set the same rule name shadow each other, so the shell bans are one local plugin with several rules, not repeated `no-restricted-syntax` blocks [tested, comment in `eslint/shell-ban-rule.mjs`]. Use the same design.
- Direct browser I/O outside any shared layer: 18 non-test files in `src` call `fetch(`, 42 touch `localStorage`/`sessionStorage`, 7 call `new Audio(` [tested, `grep -rlE "fetch\s*\(" src --include=*.ts --include=*.tsx | grep -v .test. | wc -l` and the same for the others]. No `src/platform` folder exists [tested].
- CI's e2e job runs a fixed list of 7 specs plus `check:entry-size` (323,865 B gzip limit); `detective-e2e.yml` line 28 sets `continue-on-error` for the main side [tested].
- No PR template exists in `.github/` [tested].
- 42 remote heads, 41 besides `main` [tested, `git ls-remote --heads origin | wc -l`]. The audit counted 40 unmerged on 5ae217c9.
- No `.github` workflow change in this phase may weaken an existing gate (AGENTS.md §2).

## Tool choices (decided; dated 2026-11-18)

- **Layer boundaries and banned globals: a local ESLint plugin in `eslint/`, no new package.** It reuses the shrink-only baseline pattern the repo already trusts, runs in the same ESLint 9 the repo has (`eslint ^9.20.0`, `package.json`), and adds nothing to the bundle.
  - Rejected: dependency-cruiser 18.8.0 (published 2026-11-16, needs Node ^22, has `--baseline` / `--ignore-known`) [Moderate, 1 primary: https://registry.npmjs.org/dependency-cruiser/latest , https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md]. A second tool and a second baseline format for the same job.
  - Rejected for now: ESLint bulk suppressions (`eslint-suppressions.json`, `--suppress-all`), added in ESLint 9.24.0 [Moderate, 2 primary: https://github.com/eslint/eslint/blob/main/docs/src/use/suppressions.md , https://github.com/eslint/eslint/blob/main/CHANGELOG.md]. The repo is on `^9.20.0`, so it needs an upgrade through the install gate. Revisit in Phase 5 for the general `lint` backlog.
- **Mockups: Storybook 10.6.7 with `@storybook/react-vite` 10.6.7** (both published 2026-11-10; peers `vite ^5 || ^6 || ^7 || ^8`, React up to 19) [Moderate, 1 primary: https://registry.npmjs.org/@storybook/react-vite/latest ]. Dev-only, never in the app bundle. The repo has `vite ^8.3.4` and `react ^19.2.0` [tested, `package.json`].
  - Rejected: `@ladle/react` 5.1.1, last release 2025-11-04 [Moderate, 1 primary: https://registry.npmjs.org/@ladle/react/latest ]. Lighter, but a year without a release.
  - Storybook is an install, so AGENTS.md §12's install gate applies: write purpose, source, known vulnerabilities (`npm audit` output for the new tree) and stop for Veeresh's approve or deny before PR 0.4 lands it.

Re-check every version on the registry the day you run this; if it moved, use the new one and note the date.


## The four PRs (one slice each, run in this order)

### PR 0.1 `docs/architecture-guardrails-docs` (Tier 0 inside this run)
1. `ARCHITECTURE.md` at the repo root, under 150 lines, written for a new developer:
   - Layers, lowest first, with the folders each owns today (verify each glob with `ls` before you write it):
     1. **Content**: data only (`src/game/data/**`, `src/subjects/**/items.ts`, `answers.ts`). Imports nothing from higher layers.
     2. **Domain and stores**: pure game logic and state (`src/game/**/*.ts` that is not a screen, pure helpers in `src/lib/**`). No React, no browser globals.
     3. **Platform ports**: the only place allowed to touch `fetch`, `localStorage`, `sessionStorage`, `Audio` (`src/platform/**`, created in Phase 1).
     4. **Shared UI components**: `src/components/ui/**`, `src/hooks/**`. Presentational, no I/O.
     5. **Feature screens**: everything else under `src/components/**`, `src/game/**/*.tsx`, `src/subjects/**/*.tsx`, `src/board/**`, `src/map/**`, `src/scenes/**`.
     6. **Shell and routes**: `src/routes/**`, `src/router.tsx`, and the shell parts in `src/components/ui/` (`site-header`, `site-footer`, `page-column`, `page-shell`, `shell-registry`).
   - Imports point down only. A feature screen never imports another feature screen; shared code moves down a layer.
   - Server code (`src/server.ts`, `src/start.ts`, `workers/`, `server/`) is out of scope until Phase 5; say so.
   - Mixed folders today (for example `src/game/loop/LoopScreen.tsx` is a screen inside the logic folder) are listed as known exceptions, not hidden.
   - One short section: "How to add a screen" (adopt the shell, use shared components, I/O through a port, story first).
2. `.github/pull_request_template.md`: Before / After, layer(s) touched, mockup link (required when a player can see the change, with Veeresh's approval noted), gates table PASS/FAIL/NOT RUN, baseline entries removed, tokens used vs cap.
3. `docs/ops/branch-disposition-2026-11.md`: one row per remote head except `main`. Columns: branch, commits ahead / behind main (from `git rev-list --left-right --count`), last commit date, top-level paths touched, likely superseded by (merged PR number, if any), recommendation (port, keep, close), owner decision (blank). Facts only from git; mark guesses `[inferred]`. Delete nothing.
4. Do not edit AGENTS.md here. Phase 0a already adds the cold-start pointer to `ARCHITECTURE.md`; check it resolves once this file lands.

### PR 0.2 `chore/lint-arch` (the core)
1. `eslint/layer-rule.mjs`: one local plugin, two rules, mirroring `eslint/shell-ban-rule.mjs`:
   - `layer/no-upward-import`: reads the layer map (a small exported object, one source of truth; `ARCHITECTURE.md` links to it) and fails an import that points up a layer or across feature screens. Include PR 533's `game` → `subjects` ban here.
   - `platform/no-raw-io`: fails `fetch(`, `window.fetch(`, any `localStorage` / `sessionStorage` member access and `new Audio(` outside `src/platform/**` and test files.
2. `eslint/layer-baseline.json`: today's violations per rule, recorded with the date and main SHA in a `comment` field.
3. A stale-entry test next to `shared-shell.test.ts` (or extend it if that is simpler): fails when a baselined file no longer violates, so the baseline can only shrink.
4. `eslint.arch.config.mjs` and the script `"lint:arch": "eslint --no-inline-config --max-warnings 0 -c eslint.arch.config.mjs src"`.
5. CI: add `npm run lint:arch` to the `build` job right after `lint:nav`. It blocks new violations only; old ones are in the baseline. This is stronger than report-only and still green on day one.
6. TDD: fixture files under a test folder that prove each rule fires (an upward import, a raw `fetch`, a `new Audio(`) and stays quiet on an allowed import.

### PR 0.3 `chore/lint-and-ci-required`
1. `"lint": "eslint ."` using the existing `eslint.config.mjs`. Measure the backlog count and put it in the PR body `[tested]`. Do not fix the backlog here.
2. `scripts/ci-required.mjs` and `"ci:required": "node scripts/ci-required.mjs"`: runs the §9 gates plus `lint:nav`, `lint:arch`, `lint:subjects`, `check:provenance`, `check:entry-size` in order, continues after a failure, prints one table of PASS / FAIL / NOT RUN with the reason for NOT RUN (for example Playwright skipped because no browser), and exits non-zero on any FAIL. `lint` runs as report-only here (it prints FAIL but does not change the exit code) until Phase 5 flips it; say so in the table.
3. A unit test for the table logic only (pass, fail, not run). Do not run the full suite to test it.
4. README: a short "Before you open a PR, run `npm run ci:required`" section.

### PR 0.4 `chore/storybook-mockups` (after Veeresh approves the install)
1. Install `storybook` and `@storybook/react-vite` as devDependencies at the versions checked that day.
2. Stories for the shared parts that exist today: `SiteHeader`, `SiteFooter`, `PageColumn`, `Button`, `Pill` (`src/components/ui/`). One story per component, real props, no copies of the components.
3. `"storybook"` and `"build-storybook"` scripts. Prove the app bundle is unchanged: `npm run build:pages` then `npm run check:entry-size`, and compare to main's number in the PR body.
4. ARCHITECTURE.md: "A mockup is a story built from real components; link it in the PR template."

## Done when
- 4 draft PRs open, each with green gates or a NOT RUN with a reason.
- `npm run lint:arch` passes on main's code with the baseline, and fails on each fixture.
- Every count in the docs carries `[tested]` with its command.
- A clean-context panel seat signed each PR's final tip. Veeresh merges each PR on his word.

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
