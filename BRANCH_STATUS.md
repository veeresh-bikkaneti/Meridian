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

## Pending
- [ ] Audit all 94 curated notable notes against linter rules
- [ ] Fix generator: stop embedding notes in `blurbFor`, emit `history` field
- [ ] Migrate 94 chunk records: `history` = note, note stripped from blurb
- [ ] Harden `lint-cards.mjs`: hard-fail curated-without-history + embedded-note bypass
- [ ] Gates: `tsc`, unit suite, prebuild, both reviews, Playwright E2E (history-first cards)
- [ ] Open PR (merge only when all gates green)

## Active work
- data-migration worker: audit + generator fix + chunk migration
- linter worker: gate hardening + fixtures
