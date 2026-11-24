# chore/slice-b-fresh-checkout

**Base:** `origin/main` `37a9b5c4699b387b831b49becec65beaad930f00`.

## Done

- TD-12.2 was already done. `zod` `^4.6.7` is a direct dependency. A fresh
  `npm ci` runs the six subject validators with no extra install. The card
  records that. Nothing was rebuilt.
- TD-13.2 and TD-09.1 were already done. `.github/workflows/pages.yml` is
  gone (`0de11594`, PR #577). `build:pages` remains. The cards record that.
- #269: root `wrangler` 4.152.0 inlined undici 7.29.1. `wrangler` 4.154.0
  (published 2026-10-27, the version the vite plugin already pinned)
  inlines undici 7.30.1. The plugin at 1.66.0 already inlines 7.30.1, so
  it was not bumped. `scripts/undici-bundled-floor.test.mjs` fails if
  either bundle is below 7.30.1.
- #300: `public/.well-known/security.txt` Expires is
  `2027-11-20T00:00:00.000Z`. Contact lines were re-read and left as the
  `/contact` page and the GitHub private advisory form. A unit test fails
  when Expires is under 60 days away. The existing test still requires
  the date to be in the future and at most a year out.

## Gates

- `npm run lint:arch` PASS
- `npm run lint:nav` PASS
- `node scripts/check-e2e-registration.mjs` PASS
- `npm run check:provenance` — run on the committed range before push
- Narrow tests: `scripts/static-wellknown.test.mjs`,
  `scripts/undici-bundled-floor.test.mjs`,
  `scripts/undici-lockfile-floor.test.mjs`,
  `src/build-board/kanban-data.test.ts` PASS
- `npm test`, `npm run build:pages`, and Playwright were not run.
  There is no `npm run check` script.

## Ruled out

- No new package for the subject validators. `zod` was already declared.
- No Pages workflow edit. The file is already absent.
- `wrangler` was not taken to 4.167.0. 4.154.0 is the fixed release the
  plugin already builds with, and it has been published for more than
  seven days. 4.167.0 was one day old and externalizes undici instead.
- `workers/crash-report` still names wrangler 4.148.0 and has no lockfile.
  Issue #269 leaves that out of this fix.

## Graph

No nodes. Integrator-only file was not edited.
