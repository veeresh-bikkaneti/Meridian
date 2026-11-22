# Phase 3: one validated content source, math first

**Goal:** each subject item has one typed record that holds its question, answer, provenance and media rules, and is validated at build time. Screens read a projection of that record; they never join files by hand. Math goes first; the other subjects follow the same pattern, one subject per PR.

**Tier:** 2 (content schema, more than 3 files; AGENTS.md §3). Cap 400k. **Estimate:** 200k to 280k for math (the schema is designed here); 100k to 150k for each later subject. Six subjects in `src/subjects/` [tested, `ls`], so about 0.7M to 1.0M for the phase (inferred).
**Depends on:** Phase 0 merged. Independent of Phases 1 and 2, so it can run beside them; it owns `src/subjects/<subject>/` and `docs/scaling/contracts.md`, which they don't touch.

## Facts (checked on main cbc119c, Nov 18)

- Math keeps items and answers in two files: `src/subjects/math/items.ts` (150 lines) and `answers.ts` (436 lines) [tested, `wc -l`]. Journals has `items.ts`, `answers.ts`, `captions.ts`, `caption-files.ts` [tested, `ls`].
- The contract `UnitItem` (`docs/scaling/contracts.md` §I2, and `src/subjects/registry.ts:20`) has `id`, `group`, `objective`, `standard`, `why`, `buildsOn`, `useElsewhere`; it has no answer, provenance, validation or media-leak fields [tested, read both].
- `npm run lint:subjects` (`scripts/lint-subject-leads.mjs`) enforces MEASUREMENT, YEAR and GIVEAWAY rules; `scripts/lint-subject-leads-baseline.json` holds 12 known entries [tested, `node -e` count]. The audit counted 11 on 5ae217c9.
- Card rule 5: "No fabrication, ever: no LLM near place data." Story and fact fields come from curated notes or the verified pipeline only [tested, AGENTS.md §11].

## Design (lead decides details with an `arena` round)

- A zod schema (`zod ^4.6.7` is already a dependency) for `SubjectItem` = `UnitItem` plus `answer` (typed per answer kind), `provenance` (`{ source, verifiedOn }` or `"UNVERIFIED"`), `media` (clip or still ids, with a `revealsAnswer: boolean` flag), and `leadPolicy` (what the lint rules check).
- One file per subject holds the records. The old `items.ts` and `answers.ts` become a thin compatibility export from the new file for one release, so nothing else breaks; delete them in the next PR for that subject.
- A build-time validator in `prebuild` (next to the other checks in `package.json`) that parses every record and fails on: a missing answer, an answer that appears in the lead, a media id that does not exist, a stored current year.
- `docs/scaling/contracts.md` §I2 updated to the new type, marked as a contract change.

**Content does not change.** No wording, answer or fact changes in this phase. Move records by script, never by retyping and never with a model writing content. A diff check proves it: the old export and the new projection produce identical JSON for every math item; commit that test.

## Done when
- Failing test first: a record with an answer in its lead fails the validator.
- The projection-equality test passes for all math items.
- `npm run lint:subjects` PASS with no new baseline entries; if the validator finds a known baseline case, say so, don't fix content (content fixes need the educator seat).
- Math e2e only: `npx playwright test tests/e2e/*math* --workers=1` (list the specs you ran).
- `npm run lint:arch` PASS: content files import nothing from higher layers.
- No player-visible change, so no mockup.

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
