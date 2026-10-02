# feat/card-pipeline-rules — Branch Status

Structural fix for the card pipeline: curated notable notes must live in
first-class `history` fields (history first, geography second), not embedded
inside geography-first blurbs. Veeresh authorized.

## Done
- [x] Generator marks `hookMissing` truthfully (`324077e`)
- [x] `lint-cards.mjs` prebuild gate with grandfathering (`2fc3b69`)
- [x] Runtime consumes `fact` > `history` > `blurb` (`4e5529b`)
- [x] `card-compose.mjs` template as code (`01f0dc7`)
- [x] Barry Farm naming correction (James Barry) (`367a5fb`)
- [x] West Englewood curated note (`a793165`)
- [x] Rebased onto `origin/main` @ `7593a87` (clean)
- [x] Audit all 94 curated notable notes vs linter rule book — 87 pass; 7 fixed
      (6 quote-terminal punctuation, 1 Mecca `population` reword, meaning preserved)
- [x] Generator fix: `blurbFor` no longer embeds notes; place records emit
      first-class `history` + `wiki`; `hookMissing` from `composeCardStory({ history, blurb })`
- [x] Chunk migration: 94/94 records migrated (`scripts/migrate-notable-to-history.mjs`,
      idempotent) — `history` set, note stripped verbatim from blurb, `wiki` kept,
      no `hookMissing`; semantic diff verified (only the 94 notable records changed)
- [x] Tier 2 gate green on migrated records (`node scripts/lint-cards.mjs` → GATE PASSED,
      124,690 records, 0 curated-note violations)
- [x] Pipeline unit tests green (build-geonames-blurb + card-compose: 45/45)
- [x] Linter hardening (`18d5f62`): Tier 2 chunk audit hard-fails
      `curated-history-missing` + `embedded-history-bypass` regardless of
      grandfathering (`loadCuratedNotes`/`checkCuratedRecord`, `_`-keys skipped);
      Tier 1 fixture gate gains 2 good + 3 bad curated fixtures over a synthetic
      notes map — a missed bite fails the build. Pre-migration data FAILS the
      gate (94 records × both codes, old gate passed = bypass proven);
      post-migration data PASSES (124,690 records, 0 curated-note violations,
      124,311 legacy still grandfathered)

## Pending
- [ ] Gates: `tsc`, unit suite, prebuild, both reviews, Playwright E2E (history-first cards)
      — unit suite RED: 10 generated-places failures; 30 migrated `history`
      values exceed the runtime 240-char cap (`assertValidRecord`,
      src/game/generated-places.ts:196). Data-side fix needed (shorten notes
      or raise the cap) — flagged for data-migration worker
- [ ] Open PR (merge only when all gates green)

## Active work
- data-migration worker: audit + generator fix + chunk migration — DONE, pushed
- linter worker: gate hardening + fixtures — DONE, pushed (`18d5f62`)
- OPEN: 30 migrated histories > 240 chars → 10 unit-test failures (data-migration worker to resolve)
