# feat/card-pipeline-rules — Branch Status

Structural fix for the card pipeline: curated notable notes must live in
first-class `history` fields (history first, geography second), not embedded
inside geography-first blurbs. Veeresh authorized.

## Done
- [x] Generator marks `hookMissing` truthfully
- [x] `lint-cards.mjs` prebuild gate with grandfathering
- [x] Runtime consumes `fact` > `history` > `blurb`
- [x] `card-compose.mjs` template as code
- [x] Barry Farm naming correction (James Barry)
- [x] West Englewood curated note
- [x] Rebased onto `origin/main` @ `7593a87`
- [x] Audit all 94 curated notes (7 fixed: 6 punctuation, 1 reword, zero fact changes)
- [x] Generator fix: `blurbFor` pure geography; emits `history` + `wiki`
- [x] Migration: 94/94 records → `history`, notes stripped from blurbs (60 chunks)
- [x] Linter hardening: `curated-history-missing` + `embedded-history-bypass` hard fails + fixtures
- [x] Runtime history cap 240 → 600 (longest curated note 512 chars)
- [x] Gates: tsc clean, 631 unit tests 0 fail, lint gate PASSED (379 with hook, 0 violations)

## Pending
- [ ] Technical-architect review (dispatched)
- [ ] Tone/docs/accessibility review (dispatched)
- [ ] Playwright E2E: history-first cards (West Englewood, Barry Farm, spot checks)
- [ ] Open PR (merge only when all gates green)

## Active work
- coordinator: awaiting both reviews + E2E, then PR
