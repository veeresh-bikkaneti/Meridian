# Phase 1: platform ports (storage, JSON transport, audio)

**Goal:** one place owns each kind of browser I/O. Screens call a typed port; the port owns retries, errors, SSR safety and cleanup. Each PR moves one vertical slice and removes its entries from `eslint/layer-baseline.json`.

**Tier:** 2 per PR (storage and network are "API/storage" in AGENTS.md §3). Cap 400k per PR. **Estimate:** 120k to 180k per PR. Plan on about 9 PRs: one per port to create it with its first slice, then about 2 more slices each. Total about 1.1M to 1.6M across the phase (inferred from Phase 0's per-PR estimate plus a council per PR).
**Depends on:** Phase 0 PR 0.2 merged (`lint:arch` and the baseline exist). **Parallel:** the three ports can run at the same time in separate worktrees, since they own separate files, as long as no two PRs edit the same screen. Check with `git diff --stat` before you start a slice.

## Facts (checked on main cbc119c, Nov 18; re-run before you start)

- 7 non-test files call `new Audio(`: `src/components/grandpa-ask.ts`, `storyteller-home.tsx`, `storyteller.tsx`, `comet-greeting.tsx`, `summary-celebration-line.ts`, `src/game/loop/detective/detective-audio.ts`, `src/subjects/shared/ClueScene.tsx` [tested, `grep -rl "new Audio(" src | grep -v .test.`].
- One-voice rule already exists: `claimVoice()` in `src/game/audio/voice-channel.ts`, enforced by `eslint/voice-channel-rule.mjs`, including "a tapped line calls `play()` before any `await`" for iOS [tested, AGENTS.md "Enforced rules"]. The audio port wraps this; it does not replace it.
- 42 non-test files touch `localStorage`/`sessionStorage`; the most are in `src/game` (13 files at top level) [tested].
- 18 non-test files call `fetch(` [tested]. The audit names `src/game/loop/LoopScreen.tsx:275-280`, `src/components/storyteller-home.tsx:118-128`, `src/components/pack-shelf-data.ts:407-416` [audit on 5ae217c9; re-check the lines].

## Design (lead decides details with an `arena` round, then records them)

`src/platform/` with one folder per port, each exporting an interface and one browser implementation, plus an in-memory fake for tests:

- `storage/`: `getItem<T>(key, schema)`, `setItem`, `removeItem`, `subscribe(key, cb)` (covers the cross-tab `storage` event). Keys are a typed registry in one file, so no screen invents a key string. Values are parsed with the zod version already in `dependencies` (`zod ^4.6.7`, `package.json`) [tested]. Server-side render and private-mode failures return the default and never throw.
- `transport/`: `getJson<T>(url, schema, { signal, retries, timeoutMs })` and `postJson`. One error type with `kind: "network" | "timeout" | "http" | "parse"`. Abort on unmount through the caller's signal.
- `audio/`: `createVoice(src)` that claims the voice channel, handles `ended` / `error`, honours mute and reduced motion, and releases on unmount. One hook, `useVoice`, for screens.

Draw the statechart for each port first (idle, loading, ready, error, aborted; for audio also playing, interrupted, ended).

## Slice order

1. **Audio port + `ClueScene`** (it is a shared subject component, so one change helps every subject).
2. **Storage port + the age-band and progress keys** (`src/game/age-profile/**`). PR 533 adds `src/subjects/shared/subject-progress.ts` with change events and a cross-tab `storage` listener [tested, PR 533 diff]: absorb that into the port instead of keeping two event systems.
3. **Transport port + `pack-shelf-data.ts`**.
4. Then one feature per PR until the baseline lists for `platform/no-raw-io` are empty. Each PR body lists the baseline entries it removed.

## Per-PR done condition
- Failing tests first: the port's contract tests run against the fake and the browser implementation (with jsdom-style stubs if the repo's test runner has them; check `scripts/run-tests.mjs` first).
- The migrated screen behaves the same: name the Playwright spec that covers it and run only that one. If none covers it, add one small spec.
- Entries removed from `eslint/layer-baseline.json`; `npm run lint:arch` PASS; the stale-entry test PASS.
- `check:entry-size` within the limit. A port must not grow the entry bundle; if it does, lazy-load it and show the before and after numbers.
- No player-visible change, so no mockup is needed. If a slice changes anything a player sees (an error message, a retry button), that part needs a mockup first.

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
