# BRANCH_STATUS — feat/233-ssr-build-shape

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#233)

Adds `scripts/ssr-build-shape.test.mjs`, a post-build assertion that
fails loudly if a production build ever stops producing the
custom-entry SSR shape from PR #232:

- the emitted `node_modules/.nitro/vite/services/ssr/wrangler.json`
  must have `main: "index.js"`, `no_bundle: true`, and a `configPath`
  that resolves to the repo-root `wrangler.jsonc` (resolved path is
  compared, never a hardcoded absolute path — it embeds the checkout
  directory);
- the SSR bundle (`index.js` in the same directory) must still
  contain the server-fn guard literals that survive minification
  (`/_serverFn/`, `not found`, `method not allowed`, `no-store`).
  Identifiers are not asserted — minifiers rename them. No single
  literal proves the guard; the pin is the combination.

Design choice — artifact absence: on a fresh checkout with no build,
the tests skip with an explicit reason (precedent:
`scripts/share-card-built.test.mjs`). CI builds before it tests, so
the pin is live there; present-but-wrong fails loudly.

The issue's cheaper companion (vite.config.ts plugin-order assertion)
already exists in `scripts/grok-pwa-plugin.test.mjs` from the #232
cure round — not rebuilt here.

## Files

- `scripts/ssr-build-shape.test.mjs` (new)
- `BRANCH_STATUS.md` (this file)

## Gates

- No build present: 2 skipped with reason (by design).
- After `npm run build` (exit 0): 2/2 pass against the real artifact.
- Mutation check: flipping `no_bundle` to false in the emitted
  wrangler.json turns the suite red; restored, green.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.
