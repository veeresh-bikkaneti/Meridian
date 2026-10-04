# BRANCH_STATUS.md — fix/wikipedia-attribution-credit

One-line CC BY-SA licensor credit for the Wikipedia history merge.
Required before the Wikipedia history-merge PR lands.

## Active
- [ ] PR opened → merged → live verified

## Done
- [x] Map-corner credit extended: `place history: Wikipedia [CC BY-SA ↗]`
      (`src/components/atlas-map.tsx`) — names the license; per-card
      article links already cover the source-link half
- [x] `npx tsc --noEmit` clean
- [x] `npm run build:pages` green
- [x] Pushed to origin
