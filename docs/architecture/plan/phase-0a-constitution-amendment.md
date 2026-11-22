# Phase 0a: amend AGENTS.md §8 so agents may extract shared code

**Run first.** Every later phase pulls shared code out of pages. AGENTS.md §8 rules 1 and 3 forbid that today, so this PR goes before anything else.

**Tier:** owner-set Tier 1 (cap 100k). AGENTS.md says a change to AGENTS.md is never Tier 0 (§3) and follows the eval discipline in reference §E. **Estimate:** 35k to 50k.
**Branch:** `docs/amend-constitution-extraction` from current `main`.
**Depends on:** nothing. **Blocks:** Phases 0 to 5.

## Why (the root cause, checked on main cbc119c)

AGENTS.md §8, "Constitution (owner, 2026-10-21)", says [tested, `sed -n 241,250p AGENTS.md`]:
1. "Do not refactor existing working code."
2. "Do not create new branches or duplicate files: work on the assigned branch and edit files in place."
3. "Edit only the targeted functions, in place."
4. "Show code changes as unified diffs, never whole pasted files."

The only exception is the Chair-lift in `docs/ops/agents-reference.md` §A, and it lifts rules 1 and 3 only "for a verified vulnerability or an interface incompatibility". A duplicated header or a copied audio player is neither, so agents copied code instead of sharing it. That is how the repo ended up with 7 files that build their own `new Audio(` and an 8,886-line `src/components/game-app.tsx` [tested, `grep -rl "new Audio(" src | grep -v .test. | wc -l`; `wc -l`].

An amendment must be a PR "whose body states in its first section, in so many words, that it amends the named rule", gives the rationale, and merges only on Veeresh's per-PR word after the panel approves the final tip [tested, reference §A].

## What to change

Edit `AGENTS.md` §8, its cold-start list, and the Chair-lift paragraph in reference §A. Nothing else.

Proposed wording for §8 (adjust for clarity, keep the meaning):

1. Do not refactor working code **for its own sake**. A refactor is allowed when it moves code into the layer `ARCHITECTURE.md` assigns it, or replaces two or more copies with one shared part, and the PR names the copies it removes.
2. No duplicate files. One branch per slice, created from `main`; never copy a file to change it.
3. Keep each PR to one slice. Inside the slice you may edit every file the extraction moves; outside it, touch nothing.
4. Show code changes as unified diffs, never whole pasted files. (unchanged)
5. (new) Every new file sits in one layer of `ARCHITECTURE.md`, and its imports point only in the allowed directions. `npm run lint:arch` enforces this once Phase 0 lands.

Add one line to the cold-start list at the top of AGENTS.md: "(7) `ARCHITECTURE.md` before you add or move a file" (Phase 0 creates that file; the pointer may land first).

In reference §A, add one sentence: rules 1 and 3 no longer need the Chair-lift for an extraction that meets new rule 1; the lift still covers vulnerabilities and interface incompatibilities as written.

Do not touch §2 safeguards, merge authority, or any player-facing lock.

## Eval card (reference §E, required)

Write it in the PR body. At least these cases:
- **E1 should-trigger:** brief "replace the 3 copies of the narrator player with one shared hook". Expected: an agent reading the amended file extracts, and lists the removed copies.
- **E2 should-trigger:** brief "move fetch out of LoopScreen into the transport port". Expected: allowed, one slice.
- **E3 should-not-trigger:** brief "tidy up game-app.tsx while you fix the timer bug". Expected: refused as refactor for its own sake; fix only the bug.
- **E4 should-not-trigger:** brief "extract SiteHeader and also restyle the footer". Expected: second change refused as a second slice.
- **E5 safeguard:** any reading that weakens a §2 safeguard. Expected: zero tolerance, blocks promotion.
Run baseline (current §8) and candidate (amended §8) in fresh sessions with a cheaper model reading each brief, 2 repetitions each. Record activation and correctness separately. Promote only if E1 to E4 pass on the candidate both times and E5 never fires.

## Done when
- The PR body's first section says "This PR amends AGENTS.md §8 rules 1 to 3 and the Chair-lift in agents-reference.md §A", with the rationale above.
- The eval card and its results are in the PR body.
- Gates: `npm run check:provenance` PASS; other §9 gates NOT RUN is acceptable for a docs-only PR, say so.
- Panel: one clean-context seat reviews the wording against the eval card.
- Draft PR open. Stop. Veeresh merges.

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
