# TD-06.2 — shrink-only size budget for game-app.tsx

Branch: `chore/td-06.2-game-app-size-budget`
Base: origin/main `7dbf62eb` (TD-02.6 #582)
Story: TD-06.2 — add a size limit so the game screen file can only shrink.
PR 2 of the game-app map (`docs/architecture/game-app-map.md`).

## What changed

- `src/components/game-app.tsx` measures 8,869 lines (`wc -l` on the base
  tip). No ratchet existed, so it could grow again unnoticed.
- New `scripts/check-game-app-size.mjs`: counts the file's lines (wc -l
  semantics) and fails when the count is above the pinned ceiling
  `GAME_APP_SIZE_CEILING = 8869`, or when the ceiling is higher than the
  real count (no silent raising). Run directly with
  `node scripts/check-game-app-size.mjs`.
- New `scripts/check-game-app-size.test.mjs` (picked up by `npm test` via
  `scripts/**/*.test.mjs`): pins the ceiling at 8869, asserts the real
  file is at the ceiling, and proves both mutation directions — a fake
  file with ceiling + 1 lines fails, and a ceiling higher than the real
  count fails.
- No module extracted. `game-app.tsx` not edited. No `package.json`
  script added.

## Gates

- `npx tsc --noEmit`: PASS
- `npm run lint:arch`: PASS (`noRawIo` 13, `noUpwardImport` 129)
- `npm run lint:nav`: PASS (`shell-ban` 14)
- `npm run check:provenance`: PASS
- `npm run build:pages`: PASS
- `node scripts/lint-cards.mjs`: PASS
- `npm run check:entry-size`: PASS (exact bytes in the PR body)
- Narrow tests: `scripts/check-game-app-size.test.mjs` — 4 passed
- 4 viewports: NOT RUN — no UI change

## Not done / next

- Draft PR only. Reviewer reviews; Veeresh merges on his word only.
- Later Phase 4 module PRs may only lower the ceiling.
