# feat/phase-5-1-runtime-secrets

**Task:** Phase 5.1 only. One source for the contact webhook secret: runtime, through a server config module. Base `7bc4d8f2` (PR 548).

## Capsule

- TASK: Remove the build-time bake of `CONTACT_DISCORD_WEBHOOK_URL`. Read it only at runtime through `src/lib/contact/runtime-config.server.ts`. Write `docs/ops/deploy-contract.md`.
- Reading chosen: the named defect is the webhook's two sources. The origin allowlist stays baked. It is not a secret, and `wrangler.jsonc` has no vars, so the build variable is still its fallback.
- Tier: 2 (security and deploy).
- Done when: the new test passes, the contact-form spec passes, the contract lists every secret and binding, gates pass, a panel seat signs the tip.
- Files: `vite.config.ts`, `src/lib/contact/runtime-config.server.ts`, `src/lib/contact/runtime-config.server.test.ts`, `src/lib/contact/contact-handler.server.ts`, `wrangler.jsonc` (comment only), `docs/ops/deploy-contract.md`, `README.md` (one pointer), `tests/e2e/grownups-privacy-contact.desktop.spec.ts` (empty-body guard only), this file.
- Out of scope: Phases 5.2–5.5, feature-request and crash readers (already one runtime source each), `package.json`, `eslint/layer-baseline.json`.
- Rejected: a module under `src/server/`. The handler is layer 2 (domain) and cannot import a feature-layer file. Rejected: deleting the whole SSR plugin. That would also drop the allowlist bake.

## Graph

Add, do not edit `docs/knowledge/graph.json` here:

- node `doc:deploy-contract` path `docs/ops/deploy-contract.md`
- node `mod:contact-runtime-config` path `src/lib/contact/runtime-config.server.ts`
- edge `doc:deploy-contract` documents `mod:contact-runtime-config`
- edge `src/lib/contact/contact-handler.server.ts` depends-on `mod:contact-runtime-config`

## Status

- Done: the bake is gone. The new test failed first (vite still named the secret; the module was missing), then passed.
- Spec: the contact receiver ignored an empty non-JSON hit so a port probe cannot fail the run. The real posts are still asserted. 5 passed, `--workers=1`.
- Gates: see the PR body. All listed gates passed on this branch before review.
- Next: panel, then draft PR. Do not merge.
- Ruled out: moving `FEATURE_*` or `DISCORD_WEBHOOK_URL` into the contact module. Different channels. Crash is a separate worker.
