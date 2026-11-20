# Summary

<!-- One or two sentences: what changes, and why. -->

## Before / After

<!-- Before: how it worked (or looked) before this PR.
     After: how it works (or looks) now.
     For a player-visible change, attach screenshots or a clip. -->

- Before:
- After:

## Layer(s) touched

<!-- Name each layer from ARCHITECTURE.md this PR touches, and confirm
     imports still point down only. -->

-

## Mockup

<!-- Required when a player can see the change: link the mockup (a
     Storybook story built from the real components) and note Veeresh's
     approval. Write "not player-visible" if it is not. -->

- Mockup link:
- Veeresh's approval:

## Gates

<!-- One row per gate. NOT RUN needs a reason in the row. -->

| Gate | Result (PASS / FAIL / NOT RUN) |
| :--- | :--- |
| `npx tsc --noEmit` | |
| `npm test` | |
| `npm run test:worker` | |
| `node scripts/lint-cards.mjs` | |
| `npm run build:pages` | |
| `npm run lint:nav` | |
| `npm run lint:subjects` | |
| `npm run check:provenance` | |
| `npm run check:entry-size` | |
| `npm run lint:arch` | |
| Playwright (specs this change can break, `--workers=1`) | |

## Baseline entries removed

<!-- Guardrail baselines (for example eslint/layer-baseline.json) can only
     shrink. List each entry this PR removes, or write "none". -->

- none

## Tokens

<!-- Estimate is fine; say it is an estimate. -->

- Tokens used vs cap:
