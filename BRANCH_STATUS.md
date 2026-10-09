# BRANCH_STATUS — facts-ladder-train

Rebased onto origin/main@8cd0fda (2026-10-08). Base now includes PR #107
(sprint entry gates, merged) and PR #103 (comet banner emblem, merged):
Comet hosts from the header banner, SoundToggle in eyebrow cluster,
tutorial/greeting collision fix. None of that is this branch's work — it is
inherited from main.

## Rebase (2026-10-08, onto f07dad3) — new head 4ab5b79
- 19 commits replayed. Conflicts (all mechanical):
  - `playwright.config.ts` (3x): kept BOTH project entries —
    `facts-ladder-pilot` (this branch) + `offline-content` (main); repaired
    the branch's own malformed project-list hunks; dead `zz-dbg` stays removed.
  - `BRANCH_STATUS.md`: kept both sides — rebase-base note + branch status.
- Pushed with --force-with-lease (819c788 → 4ab5b79).
- Post-rebase verification:
  - `npx tsc --noEmit` clean
  - `node scripts/lint-cards.mjs` GATE PASSED (124,690 records)
  - `npm run build:pages` green (sw.js stamped buildId=4ab5b79)
  - `npm test`: 744 scripts + 863 src pass, 0 fail
  - facts e2e (`--project facts-ladder-pilot`): 2/2 at 390×844, zero console errors

---

# BRANCH_STATUS — feat/facts-ladder

Fact-ladder content pipeline: generator scripts compose Wikidata / wiki-text /
EB1911 / hook facts into DERIVED per-region indexes
(src/game/data/geonames/facts/<regionId>.json). The runtime overlays a
region's index onto its chunk places at load time. 247 pilot facts
(arkansas 20, australia 227 after content-safety removals) render on story
cards as fact-first narratives with per-kind source attribution.
Production chunk files are never written by build scripts (repo rule).

## Done

- ARCHITECTURE REWORK (2026-10-08, merge-gauntlet BLOCKER fix): the pilot
  had merged facts into production chunk files in place — reworked to
  derived indexes:
  - scripts/facts-ladder.mjs: `mergeChunk()` → `buildFactIndex()` writes
    { regionId, facts: { placeId: fact } } to src/game/data/geonames/facts/;
    chunk files are read-only. `readFactIndex()` shape-checks on load.
  - src/game/generated-places.ts: `loadRegionChunk()` loads the chunk +
    its fact index in parallel and overlays via `applyFactIndex()` before
    the existing strict validation — player-visible behavior identical
    (round-trip verified: 247/247 facts byte-identical, lint withHook
    count 8802 unchanged).
  - Chunks arkansas.json/australia.json reverted to pristine ae524e3
    content; manifest bytes already matched (no manifest change needed).
  - scripts/lint-cards.mjs overlays derived indexes in the chunk audit
    (fact-first cards still audited as rendered).
  - scripts/check-generated-places.mjs (prebuild gate) validates every
    derived index: regionId/filename match, fact shape per kind,
    place-id existence in the chunk — fails loudly.
  - Removed dead `slugToTitle` import; `factAttribution()` now guards
    undefined placeWiki (href: null, never /wiki/undefined).
  - Kid-safety gate: `checkKidSafe()` in facts-validate.mjs screens every
    composed fact (rungs 1–3); calibrated to zero hits on the 247
    human-approved pilot facts (locked by test).
  - Removed dead `zz-dbg` Playwright project; fixed contradictory
    "history first" test title (asserts fact-first); fixed 3 line-collapse
    spots in generated-places.ts.
  - Tests added: indexWikiText, indexEb1911, loadInputs, reportCoverage,
    fetchMissing (no-network path), buildFactIndex/readFactIndex,
    factAttribution guard, kid-safety screen + pilot zero-hit lock,
    applyFactIndex (5), loadRegionChunk overlay (arkansas 20 facts;
    alabama no-index path).

- Rebased onto origin/main (ae524e3). Resolved render conflicts in favor of
  main's tolerant runtime architecture:
  - Kept `factText()` (never throws), `hookMissing` contract, `Starter.fact`
    text for the Nano AI fallback — no regressions to card-compose.mjs.
  - Dropped branch's strict runtime `assertValidFact`/`ChunkFact`; strict
    validation lives in the build-time gate (scripts/check-generated-places.mjs).
  - Ported per-kind attribution as additive `factAttribution()`: wikidata →
    wikidata.org link, eb1911 → Wikisource link, wikitext/hook with own href
    → article link, else default Wikipedia/GeoNames behavior.
- Generator scripts (6 files, ~2900 lines + tests): facts-ladder.mjs,
  facts-wikidata-extract.mjs, facts-wiki-text.mjs, facts-eb1911.mjs,
  facts-qid-join.mjs, facts-validate.mjs. All green.
- 249 pilot facts merged into arkansas.json (19) + australia.json (230).
  hookMissing cleared where facts added (contract).
- Narrative P1s (5, fixed 2026-10-08): removed Baldivis (demographic
  ranking by language), Yokine (religious-group defining fact), Sunnybank
  (ethnic characterization) — all have history fallback, cards fail
  closed to history+blurb. Fixed East Ballina typo ("settles" →
  "settlers"). Fixed Fisher citation artifact ("(ACTLIC, 2004)" leaked
  into kid-facing text). 247 facts remain.
- E2E spec fix: the "no fact" pilot case used Alexander (gn-4099194),
  which has a history hook — the "blurb only" expectation never matched
  the data (pre-existing test bug). Switched to Alma (gn-4099296),
  truly fact-less and history-less.
- Frontend P1 (layout shift) — investigated, no reproducible shift:
  DOM structure byte-identical for fact vs no-fact cards; Layout
  Instability API measured CLS = 0.0000 on both variants at 390px;
  the card body is a scrolling flex region with pinned CTA so
  content-length differences scroll rather than shift chrome; the
  ScrollCue is a non-layout overlay; attribution links hold 44px
  single-line for both "Wikidata" and "GeoNames · Wikipedia" labels.
  No code change needed — layout is structurally stable regardless
  of fact presence.
- Expert review P0 fixes:
  - Removed Forrest City, AR fact (Confederate general / KKK Grand Wizard
    reference — inappropriate for 8-12).
  - Removed McKail, AU fact (describes 1835 killing — too violent).
  - Removed Fortitude Valley fact + rewrote history (mentioned "adult
    entertainment" — inappropriate for 8-12).
  - Removed 10 broken/politically-loaded facts: Attadale, Dickson,
    Tighes Hill, Millner, Palmyra, Unanderra, Cairns, Wollongong
    (truncated/dangling/subject-mismatch), Mullumbimby ("anti-vaxxer
    capital"), Villawood (immigration detention centre).
  - Repaired rebase damage: missing brace in factText, orphaned
    assertValidFact call, truncated facts-ladder.mjs, malformed
    playwright.config.ts.
- Expert review P1 fixes:
  - Attribution links (.result-source) now meet 44px touch target.
- Gates (2026-10-08): tsc clean, npm test green (729 + 854 pass,
  0 fail), lint-cards GATE PASSED, build:pages green, Playwright
  facts-ladder-pilot 2/2 green with zero console errors.
- Gates after architecture rework (2026-10-08): tsc clean, npm test
  green (751 + 860 pass, 0 fail), lint-cards GATE PASSED (8802 withHook,
  count unchanged by the rework), check-generated-places prebuild gate
  green (124690 places + 247 derived facts in 2 indexes, 0 violations),
  build:pages green, Playwright facts-ladder-pilot 2/2 green at 390x844
  with the no-horizontal-overflow assertion holding, zero console errors.

## Pending

- Re-run merge gauntlet (architect + UI + game designer + developer sign-offs,
  e2e regression) on the reworked branch, then merge on green.
- NOTE (found during rework): 13 places (e.g. Attadale, Villawood) had facts
  removed by content-safety commits, which deleted the fact but did not
  restore the `hookMissing: true` marker the pilot merge had cleared. They
  all have `history`, so cards/lint behavior is identical — cosmetic only.
  Reverting to pristine chunks restored the markers. No action needed.

## Backlog (P2)

- Per-kind attribution labels ("Wikidata", "EB1911") may be unclear to kids —
  consider friendlier labels.
- Generator scripts are dev-time only; document regeneration workflow.
- Boring-but-harmless facts (shopping centres, council offices, boundary
  admin trivia — e.g. Goolwa Beach, Strathpine, Innaloo) could be replaced
  with more memorable hooks in a future content pass.
- Duplicate place entries in arkansas.json (e.g. two Pea Ridge rows, one
  with fact=None) — harmless but worth deduping.
- Alexander's history hook ("Arkansas Juvenile Assessment and Treatment
  Center") is factually fine but may prompt questions from 8-12s;
  consider a warmer hook.

## Rebase 2026-10-08 (onto origin/main@8cd0fda — PR #103 merged)
- 19 commits replayed. 2 conflicts, both BRANCH_STATUS.md docs-only, resolved keeping both sides' entries (facts-ladder content + inherited-base notes). Zero code conflicts.
- Diff vs pre-rebase head (b022dc8): only #103's inherited files (comet/banner/grandpa components + specs) + BRANCH_STATUS.md. No facts-ladder files touched.
- Post-rebase gates: tsc clean · lint-cards GATE PASSED (124,690 records) · build:pages green · facts e2e 2/2 at 390x844.
