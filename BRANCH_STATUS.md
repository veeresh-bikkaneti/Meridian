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

## Pending
- [ ] Harden `lint-cards.mjs`: hard-fail curated-without-history + embedded-note bypass (linter worker, in progress)
- [ ] Gates: `tsc`, unit suite, prebuild, both reviews, Playwright E2E (history-first cards)
- [ ] Open PR (merge only when all gates green)

## Active work
- data-migration worker: audit + generator fix + chunk migration — DONE, pushed
- linter worker: gate hardening + fixtures
