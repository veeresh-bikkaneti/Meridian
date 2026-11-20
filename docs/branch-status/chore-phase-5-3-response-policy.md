# chore/phase-5-3-response-policy

**Task:** Phase 5.3 only. One headers module used by `src/server.ts` and `src/start.ts`, and a test that compares its output to `public/_headers` for the same paths. Base `c733fe68` (PR 550).

## Capsule

- TASK: Keep today's header values. Put the static path rules in `src/lib/security-headers.ts` next to `SECURITY_HEADERS`. Fail if that module and `public/_headers` disagree for the same paths.
- Reading chosen: on `c733fe68`, `src/server.ts` lines 18-29 and `src/start.ts` lines 23-35 already call the module. They do not inline header values. The remaining copy is the path table in `public/_headers`. Do not send the asset `/` cache (`s-maxage=60`) on worker HTML.
- Tier: 2. Cap 400k. Estimate for this lane: 120k to 180k.
- Done when: the new tests failed first, then passed; gates pass; one clean-context seat signs the tip; `docs/ops/deploy-contract.md` has a response-headers section.
- Files: `src/lib/security-headers.ts`, `src/lib/security-headers.test.ts`, `docs/ops/deploy-contract.md` (section appended only), this file.
- Out of scope: migrations (Phase 5.2), `public/_headers` bytes, `src/server.ts` and `src/start.ts` behavior, `eslint/layer-baseline.json`.
- Rejected: calling `headersForStaticPath` from the worker entries. That would put `s-maxage=60` on rendered HTML.

## Graph

Add, do not edit `docs/knowledge/graph.json` here:

- node `mod:security-headers` path `src/lib/security-headers.ts` (already exists; this branch adds `headersForStaticPath`)
- edge `doc:deploy-contract` documents `mod:security-headers`

## Status

- RED first: `node --experimental-strip-types --test src/lib/security-headers.test.ts` failed because `STATIC_HEADER_RULES` was not exported (`SyntaxError: does not provide an export named 'STATIC_HEADER_RULES'`).
- GREEN: same command after the table and `headersForStaticPath` landed. `public/_headers` was not edited.
- Review nit on `84f03c58`: the entry-file guard did not reject an inlined `Cache-Control` or `headers.set`. The follow-up commit asserts those are absent, plus `s-maxage`, in both entry files.
- Ruled out: generating `_headers` from the module. A rewrite of that file could change bytes players' static assets depend on. The test pins the current bytes instead.
