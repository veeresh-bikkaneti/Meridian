# Meridian architecture refactor: prompt set

Seven prompts, one per phase. Each one stands alone: give it to an agent as written. Run them in the order below. Written 2026-11-18 against `main` at cbc119c.

## Why this order

The code drifted because nothing enforced the design, and because AGENTS.md §8 (the Oct 21 constitution) told every agent "Do not refactor existing working code" and "Edit only the targeted functions, in place" [tested, AGENTS.md on cbc119c]. So agents copied code instead of sharing it. Phase 0a changes that rule first. Phase 0 turns the design into checks that fail a PR. Every later phase moves code into place one slice at a time, and each slice shrinks a baseline list until nothing is left.

## Run order

| # | File | Tier and cap | Estimate | Waits for | Runs beside |
|:--|:--|:--|:--|:--|:--|
| 0a | `phase-0a-constitution-amendment.md` | 1 (100k), owner-set | 35k–50k | nothing | nothing |
| 0 | `phase-0-guardrails.md` (4 PRs) | 2 (400k) | 150k–200k | 0a merged, PR 533 merged or closed | nothing |
| 1 | `phase-1-platform-ports.md` (~9 PRs) | 2 per PR | 120k–180k per PR | 0 (PR 0.2) | 2, 3, 5.1–5.4, if no two PRs edit the same screen |
| 2 | `phase-2-shell-layout.md` (~10 PRs) | 1 or 2 per PR | 60k–100k (Tier 1), 150k–200k (Tier 2) | 0 (PR 0.4 for mockups) | 1, 3, 5.1–5.4, one screen per worktree |
| 3 | `phase-3-content-projection.md` (6 PRs) | 2 per PR | 200k–280k first, 100k–150k each after | 0 | 1, 2, 5.1–5.4 |
| 4 | `phase-4-split-game-app.md` (6–8 PRs) | 2 per PR | 150k–220k per PR | 1 and 2 for the parts it uses | 3, 5.1–5.4; never with itself |
| 5 | `phase-5-backend-and-gates.md` (5 PRs) | 2 per PR | 120k–180k per PR | 0; PR 5.5 waits for 1–4 | 5.1–5.4 beside 1–4 |

**Phase totals (rough):** 0a about 0.05M, 0 about 0.2M, 1 about 1.1M–1.6M, 2 about 0.8M–1.2M, 3 about 0.7M–1.0M, 4 about 1.0M–1.7M, 5 about 0.6M–0.9M. **All phases: about 4.5M–6.8M tokens.** Phase 0a plus Phase 0 is about 0.25M and gives you the guardrails on their own.

## How the estimates were made (inferred, not measured)

- One helper agent costs about 70k tokens just to start on this project, seen on Meridian and sibling runs Nov 15–18 (the version check for this set used about 133k for one helper).
- A PR = the lead's planning and integration + 2 to 3 helpers + one clean-context panel seat, so 120k–180k for a Tier 2 slice, less for a one-screen Tier 1 move.
- PR counts come from the baselines: 9 `pageLocalMain` files for Phase 2, 7 audio files plus storage and fetch call sites for Phase 1, 6 subject folders for Phase 3.
- No token meter exists in the repo (AGENTS.md §4), so every agent reports estimates. Cost depends on which cheaper models your agents use; each agent reports its own.

## Rules every prompt carries

pstack loop (sharpen, statechart, architect, swarm, arena, how, tdd, unslop); cheaper models for building, writing and review, never named; a clean-context Council Panel seat; cap and estimate stated first, stop at 80% and ask; mockup from real components before any player-visible code; extraction allowed inside one slice per PR; pushing authorized, merging is Veeresh's; cherry-pick only, no rebase, merge or force push; Conventional Commits; no AI trailers (`npm run check:provenance`); facts tagged `[tested]` or sourced with High/Moderate/Low; reports in pstack:teach and i-have-adhd shape.

## Decisions waiting on Veeresh inside the prompts

- 0a: the amendment wording (his merge word).
- 0, PR 0.4: approve or deny the Storybook install (AGENTS.md §12 install gate).
- 5.5: the ESLint upgrade, the required e2e set, the `detective-e2e` `continue-on-error`, and any branch-protection change.
- The branch disposition table (Phase 0, PR 0.1) lists each stale branch with a recommendation and a blank owner column. Nothing is deleted.

## Sources for tool versions (checked 2026-11-18)

- Storybook 10.6.7 / `@storybook/react-vite` 10.6.7, peers Vite 5–8 and React up to 19: https://registry.npmjs.org/@storybook/react-vite/latest [Moderate, 1 primary]
- dependency-cruiser 18.8.0, Node ^22, `--baseline` / `--ignore-known`: https://registry.npmjs.org/dependency-cruiser/latest , https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md [Moderate, 1 primary each]
- ESLint bulk suppressions since 9.24.0: https://github.com/eslint/eslint/blob/main/docs/src/use/suppressions.md , https://github.com/eslint/eslint/blob/main/CHANGELOG.md [Moderate, 2 primary]
- `@ladle/react` 5.1.1, last release 2025-11-04: https://registry.npmjs.org/@ladle/react/latest [Moderate, 1 primary]
- Not verified: the full shrink-only behaviour of dependency-cruiser's baseline (only its flags were read). It was rejected anyway.
