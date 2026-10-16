# BRANCH_STATUS — chore/tanstack-react-start-1.169.2

**Ready for review. Owner merges.** One job: bump `@tanstack/react-start` to `^1.169.2`, with a lockfile that passes `npm ci`. Supersedes dependabot #159 and #160.

## Why not merge #159 / #160
Both branches have an identical tree, and their `build (22.x)` check fails in about 9 seconds at `npm ci`: `Missing: lru-cache@11.5.3 from lock file`. Their lockfile lacks the `node_modules/nitro/node_modules/lru-cache` entry. Nothing in the code is at fault; the lock is out of sync with `package.json`.

## Done
- `package.json`: `@tanstack/react-start` `^1.168.0` -> `^1.169.2`.
- `package-lock.json`: regenerated from `main` with `npm install @tanstack/react-start@^1.169.2 --package-lock-only` (a plain `npm install` crashed in npm 10.9.4's rollback path). Resolved: react-start 1.169.2, start-server-core 1.169.43 (was 1.168.58 / 1.169.37). The only difference from the dependabot lock is the missing `nitro/node_modules/lru-cache 11.5.3` entry.

## Gates (this branch, local)
`npm ci` from a clean `node_modules` OK; `npx tsc --noEmit` clean; `npm test` scripts 778 (769 pass, 9 skipped, 0 fail) and src 1,315 pass; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build` OK with `SHARE_CARD_BUILT=workers` passing (all 12 share tags, workers.dev origin); `npm run build:pages` OK with `SHARE_CARD_BUILT=pages` passing; `npm run test:worker` 18/18; `npm run typecheck:worker` clean. E2E smoke (ws4-tile-fallback and ws4-geodetective-map-hidden, `--workers=1`, fresh Pages build): 6/6. The full Playwright suite was not run.

## Not verified
- Full E2E suite (617 tests) and real-device behaviour on the new framework version.
- The live Workers deploy (SSR on workers.dev with start-server-core 1.169.43). Local server output was exercised by the built-output check only.
- `Workers Builds: meridian` fails on PR branches by owner decision (ignored); main's deploy is the real check.

## After merge
Dependabot should close #159 and #160 on its own once `main` carries the version; if it does not, close them as superseded.
