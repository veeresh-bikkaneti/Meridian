# Phase 2: the shell owns layout, one route per PR

**Goal:** every screen sits inside the shared shell and the shared column. No screen builds its own `<main>`, `<nav>`, header, home control or width cap. Each PR moves one screen and deletes its entries from `eslint/shell-ban-baseline.json`.

**Tier:** 1 per PR when the change is one screen file plus its CSS, baseline and test; Tier 2 if it needs a new shared component or touches 3+ source files (AGENTS.md §3). Caps 100k / 400k. **Estimate:** 60k to 100k per Tier 1 PR, 150k to 200k for a Tier 2 PR. About 10 PRs, so 0.8M to 1.2M for the phase (inferred).
**Depends on:** Phase 0 merged (PR 0.4 gives Storybook for mockups). **Parallel:** yes, one screen per worktree, since each PR owns one screen file. Not in parallel with a Phase 1 slice that edits the same screen.

## Facts (checked on main cbc119c, Nov 18)

- Shell parts today: `src/components/ui/site-header.tsx`, `site-footer.tsx`, `page-column.tsx`, `page-shell.tsx`, `shell-registry.ts` [tested, `ls src/components/ui`]. `screen-shell.tsx` from the audit is gone: the baseline comment records it was deleted in "PR 3 Step 4" [tested].
- Baselined, shrink-only [tested, `eslint/shell-ban-baseline.json`]:
  - `pageLocalMain` (9): `boot-splash.tsx`, `game-app.tsx`, `grownups/info-page.tsx`, `coldtrail/TrailScreen.tsx`, `loop/LoopScreen.tsx`, `lib/error-component.tsx`, `routes/board.tsx`, `subjects/shared/SubjectCase.tsx`, `subjects/shared/SubjectPicker.tsx`
  - `pageLocalNav` (2): `grownups/info-page.tsx`, `routes/board.tsx`
  - `homeButtonImport` (3): `game-app.tsx`, `LoopScreen.tsx`, `SubjectCase.tsx` (end-of-flow and HUD uses are owner-allowed; keep them, AGENTS.md "Enforced rules")
  - `maxWNone` (1): `SubjectPicker.tsx`
- 5 e2e specs still query the old `.hv5-nav` class: `journal-player.fixes.mobile`, `chunk-recovery.desktop`, `shared-shell-adoption.desktop`, `journal-player.fixes.desktop`, `grownups-privacy-contact.desktop` [tested, `grep -rl hv5-nav tests`]. The audit says `src/components/home-v5.css` still has `.hv5-nav` rules while `game-app.tsx` renders `SiteHeader` [audit on 5ae217c9; re-check].
- The audit says `info-page.tsx` uses its own `.gp-wrap` geometry instead of `PageColumn`, and `home-v5.css` and `grownups/info-page.css` repeat the same colour and spacing literals [audit; re-check].

## Design

- First PR (Tier 2): decide in an `arena` round whether the existing `page-shell.tsx` plus `shell-registry.ts` already own the `<main>` root, or whether a `ShellFrame` component is needed. Prefer extending what exists. Record the choice in `ARCHITECTURE.md`. Move the repeated colour and spacing literals into one token file used by both CSS files, and add a test that fails on a new literal copy.
- Then one screen per PR, smallest first: `lib/error-component.tsx`, `boot-splash.tsx`, `grownups/info-page.tsx` (main + nav + `.gp-wrap`), `routes/board.tsx` (main + nav), `SubjectPicker.tsx` (main + `max-w-none`), `SubjectCase.tsx`, `TrailScreen.tsx`, `LoopScreen.tsx`. `game-app.tsx` moves in Phase 4, not here.
- One cleanup PR: delete the dead `.hv5-nav` CSS and move the 5 specs to `header.site-header` selectors. Prove dead first: remove the rules, run the 5 specs and `home-layout.spec.ts`, compare screenshots.

## Mockup gate (every screen PR)
Before code: a Storybook story of the screen's layout inside the shell, built from the real `SiteHeader`, `PageColumn` and the screen's real content component, at 390 px and desktop width. Post the link and screenshots; wait for Veeresh's approval.

## Per-PR done condition
- The screen's entries are gone from the baseline; `npm run lint:nav` and the stale-entry test PASS.
- Specs run: `home-layout.spec.ts` (6 viewports), `layout-overflow.desktop.spec.ts`, plus the screen's own spec. Nothing else.
- Touch targets stay at least 44×44 px and contrast at least 4.5:1 (AGENTS.md §2 floors).
- Before and after screenshots at 390 px and desktop in the PR body.

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
