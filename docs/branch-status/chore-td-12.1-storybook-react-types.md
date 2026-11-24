# chore/td-12.1-storybook-react-types - branch status

**Task:** TD-12.1. Declare `@storybook/react` **10.6.8** as a direct
devDependency. Stories already import it. The lockfile already
resolved that exact version through `@storybook/react-vite@10.6.8`.
A fresh checkout and `npx tsc --noEmit` should not depend on hoisting.

**Base:** `origin/main` `7dbf62eb3be0976856f174f0725874e03abbaede`
(`refactor(storyteller-home): route manifest and clips through the platform ports (TD-02.6) (#582)`).
The handoff tip `72b9fa0325569c91df0f8eb27ff885e30cd315dd` had moved.
This branch starts at the new tip.

**Approval (2026-11-23):** Veeresh: "Yes, add 10.6.8 only."

## Install audit

- Purpose: stories under `src/components/ui/*.stories.tsx` import
  `Meta` and `StoryObj` from `@storybook/react`. The package was only
  a transitive devDependency.
- Source: `https://registry.npmjs.org/@storybook/react/-/react-10.6.8.tgz`
  (already the lockfile `resolved` URL). No other registry.
- Version: 10.6.8, same as the lockfile entry. No bump. No other
  package added.
- Known vulnerabilities: `npm audit --omit=prod` names no advisory
  for `@storybook/react`. One existing moderate advisory stays on
  `@storybook/react-vite` (already direct at 10.6.8) via
  `@joshwooding/vite-plugin-react-docgen-typescript`. This change
  does not add or bump that package.
- Owner decision: approve. Deny was the other choice; it was not taken.

## Done

- `package.json` `devDependencies` lists `"@storybook/react": "10.6.8"`.
- `package-lock.json` root `devDependencies` lists the same spec.
  The `node_modules/@storybook/react` entry was already version
  10.6.8. No package version in the lockfile changed.
- npm also rewrote one script indent and marked 26 optional
  `@esbuild/*` platform entries `"dev": true`. Those edits were
  dropped so the lock diff is the declaration only.
- Stories and `.storybook/` were not edited.

## Ruled out

- Bumping Storybook, adding any other package, or rewriting stories.
- Keeping the extra `@esbuild` `dev` flags (not this story).
- Fixing the one-space indent on `test:regression:wave` (pre-existing
  on this tip; left as it was).

## Gates

- `npx tsc --noEmit` PASS
- `npm run lint:arch` PASS. `noUpwardImport` baseline length 129.
  `noRawIo` baseline length **10** on this tip (13 at the handoff
  SHA; #582 shrank it). This branch does not edit the baseline.
- `npm run lint:nav` PASS. shell-ban baseline lists sum to 14
  (`homeButtonImport` 3, `pageLocalNav` 2, `pageLocalMain` 9).
- `npm run build:pages` PASS
- `node scripts/lint-cards.mjs` PASS
- `npm run check:entry-size` PASS — gzip 323,278 B, limit 323,865 B
- Narrow tests: NOT RUN (dependency declaration only)
- 4 viewports: NOT RUN

## Graph

none

## Next

Draft PR only. Veeresh merges, on his own word only.
