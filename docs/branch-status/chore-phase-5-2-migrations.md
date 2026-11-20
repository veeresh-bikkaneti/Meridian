# chore/phase-5-2-migrations

**Task:** Phase 5.2 only. One migration runner for build and PGLite. Base `c733fe68` (PR 550).

## Capsule

- TASK: One runner applies `migrations/*.sql` for the build script and the PGLite path. A test runs both adapters on the same files and compares the schema.
- Reading chosen: `src/server.ts` does not apply SQL, and `workers/` has no migrator. Unifying those two callers is the slice. Do not boot a database from the Worker entry (Phase 5.3 owns response headers; `src/server.ts` stays untouched).
- Tier: 2 (schema). Cap 400k. Estimate 120k–180k.
- Done when: the schema test failed first, then passed; gates pass; deploy contract has a migrations section; a clean-context seat signs the tip.
- Files: `scripts/migration-runner.mjs`, `scripts/migration-schema.test.mjs`, `scripts/migrate.mjs`, `scripts/migration-plan.mjs` (comment), `src/lib/db.ts`, `docs/ops/deploy-contract.md` (new section only), this file.
- Out of scope: response headers, `src/server.ts`, `workers/`, `eslint/layer-baseline.json`, `package.json`, other lanes.
- Rejected: a test-only split that keeps two apply loops. That keeps the drift the audit named. Rejected: opening a connection when `DATABASE_URL` is unset or when there is no top-level `.sql` file.

## Graph

Add, do not edit `docs/knowledge/graph.json` here:

- node `mod:migration-runner` path `scripts/migration-runner.mjs`
- edge `scripts/migrate.mjs` depends-on `mod:migration-runner`
- edge `src/lib/db.ts` depends-on `mod:migration-runner`
- edge `doc:deploy-contract` documents `mod:migration-runner`

## Status

- Done: failing test first (`scripts/migration-schema.test.mjs`, 4 failed: callers still owned the ledger SQL, runner module missing). Then one runner. Same test later passed 5/5, including rollback of `should_not_stick`.
- Build still skips with no connection when `DATABASE_URL` is empty, or when `migrations/` has no top-level `.sql`. PGLite still creates the ledger when the embedded database opens, even if the glob is empty. Those two empty cases are not the same, on purpose.
- Worker: no third runner. `src/server.ts` does not import `src/lib/db.ts`.
- Gates on this branch, after the catch-line type fix: `npx tsc --noEmit` PASS. `npm test` PASS (scripts 1250, 1239 pass, 11 skipped, 0 fail; src 3002 pass, 0 fail). `npm run test:worker` PASS (235). `node scripts/lint-cards.mjs` PASS. `npm run build:pages` PASS. `npm run lint:nav` PASS. `npm run lint:subjects` PASS. `npm run check:entry-size` PASS. `npm run lint:arch` PASS. `npm run check:provenance` runs after the commit. Playwright NOT RUN: no spec under `tests/` references `lib/db` or the runner.
- Next: panel on the tip, then draft PR. Do not merge.
- Ruled out: editing `src/server.ts` so the Worker process opens PGLite. No `DATABASE_URL` binding exists, and that file is the header path for Phase 5.3.
