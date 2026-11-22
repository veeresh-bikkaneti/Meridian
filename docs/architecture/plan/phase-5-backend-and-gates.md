# Phase 5: backend and deploy contracts, then make the gates blocking

**Goal:** one written contract for secrets, bindings, migrations and response headers, each with a check; then turn the report-only gates from Phase 0 into blocking ones.

**Tier:** 2 (security and deploy; AGENTS.md §3). Cap 400k per PR. **Estimate:** 120k to 180k per PR, 5 PRs, so 0.6M to 0.9M (inferred).
**Depends on:** Phase 0 merged. PRs 5.1 to 5.4 can run any time after Phase 0, in parallel with Phases 1 to 4, since they own server and config files. PR 5.5 runs last, after Phases 1 to 4 have shrunk the baselines.

## Facts (checked on main cbc119c, Nov 18)
- `vite.config.ts:192-209` bakes `CONTACT_DISCORD_WEBHOOK_URL` into the SSR build from `process.env` at build time, while `wrangler.jsonc:40` lists it under `"required"` as a runtime secret [tested, `grep -n`]. Two sources for one secret.
- `"build"` runs `vite build && npm run db:migrate` (`package.json:12`), so migrations run at build time [tested]. The audit says Worker and PGLite migrations behave differently (`scripts/migrate.mjs`, `src/lib/db.ts:132-162`) [audit on 5ae217c9; re-check].
- Response policy lives in three places: `src/server.ts`, `src/start.ts`, `public/_headers` [tested, files exist; the audit names `server.ts:18-29` and `start.ts:23-35`; re-check the lines].
- The audit says `workers/crash-report/README.md:412-476,495-522` documents that a direct API upload can drop bindings while `/health` still returns 200 [audit; re-check].
- CI runs 7 named Playwright specs (`node.js.yml:114-122`), and `detective-e2e.yml:28` sets `continue-on-error` on the main side [tested].

## The five PRs
1. **5.1 Secrets (security, council).** One source per secret: runtime only, read through a server-side config module. Remove the build-time bake if the runtime path works; prove the contact form still posts (its spec only). Write `docs/ops/deploy-contract.md`, a table of each secret and binding: where it is set, who reads it, the check that proves it. Never print a secret value in logs, tests or PR text.
2. **5.2 Migrations.** One migration runner used by build, Worker and PGLite, or a test that runs both against the same migration files and compares the schemas. Failing test first.
3. **5.3 Response policy.** One headers module used by `server.ts` and `start.ts`, and a test that compares its output to `public/_headers` for the same paths, so they can't drift.
4. **5.4 Crash-report deploy check.** A post-deploy smoke that fails when a binding or trigger is missing, not only when `/health` is down. Reuse `npm run smoke:crash` if it can be extended. Running it against production is a production action: write it, but run it only on Veeresh's word.
5. **5.5 Flip the gates (owner decisions inside).**
   - `lint`: upgrade ESLint to at least 9.24 through the install gate (AGENTS.md §12), record today's backlog with bulk suppressions (`eslint --suppress-all`), and make `lint` blocking in `ci:required` and CI [Moderate, 2 primary: https://github.com/eslint/eslint/blob/main/docs/src/use/suppressions.md , https://github.com/eslint/eslint/blob/main/CHANGELOG.md]. Unused suppressions make ESLint exit non-zero until pruned, so the list shrinks the same way the other baselines do [Moderate].
   - `lint:arch`: if its baseline is empty for a rule, delete that rule's baseline list so any violation fails.
   - e2e: propose a required e2e set (current 7 plus the specs that guard each phase's work) and its CI time. The owner set "targeted tests only" (Nov 11); do not make the full suite required. Write the proposal and stop for Veeresh.
   - `detective-e2e` `continue-on-error`: write the case for or against removing it, and stop for Veeresh.
   - Making a check "required" in branch protection is a remote-setting change (AGENTS.md §2): write the exact setting and ask; never change it yourself.

## Done when
- Each PR: failing test first, its own specs only, gates PASS, panel seat signed the final tip.
- `docs/ops/deploy-contract.md` lists every secret and binding with its check.
- 5.5 lists each gate as blocking, report-only, or waiting on Veeresh, with the reason.

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
