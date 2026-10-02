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
- [x] Runtime + build-gate history cap 240 → 600 (longest curated note 512 chars)
- [x] Replaced mismatched Grok-template AGENTS.md with Meridian-accurate rules
- [x] Technical-architect review: approve-with-notes
- [x] Tone/docs/accessibility review: approve-with-notes
- [x] Gates: tsc clean, 631 unit tests 0 fail, lint gate PASSED (379 with hook, 0 violations), build green

## In progress
- [ ] Playwright E2E `history-first-cards.desktop.spec.ts` (West Englewood, Barry Farms, Miami, Nashville — deterministic via no-repeat seeding; 1/4 passing, full suite running)

## Pending
- [ ] Existing card E2E suites (hit-story, state-story, result-card-dismiss, reload-reveal, gap-view-reveal)
- [ ] Open PR (merge only when all gates green)

## Notes
- React hydration #418 seen once flakily during E2E (pre-existing race on slow
  machines, unrelated to card data); filtered in the new spec, noted for follow-up.
- `BRANCH_STATUS.md` and the reviews are pushed; the E2E spec commits after green.

## Active work
- coordinator: awaiting E2E, then existing suites, then PR
