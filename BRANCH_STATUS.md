# BRANCH_STATUS — facts-ladder-train

Rebased onto origin/main@8cd0fda (2026-10-08). Base now includes PR #107
(sprint entry gates, merged) and PR #103 (comet banner emblem, merged):
Comet hosts from the header banner, SoundToggle in eyebrow cluster,
tutorial/greeting collision fix. None of that is this branch's work — it is
inherited from main.

---

# BRANCH_STATUS — feat/facts-ladder

Fact-ladder content pipeline: generator scripts merge Wikidata / wiki-text /
EB1911 / hook facts into place chunks; 247 pilot facts (arkansas 20,
australia 227 after content-safety removals) render on story cards as
fact-first narratives with per-kind source attribution.

## Done

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

## Pending

(none — all P0/P1 items complete)

## Backlog (P2)

- Per-kind attribution labels ("Wikidata", "EB1911") may be unclear to kids —
  consider friendlier labels.
<<<<<<< HEAD
- Generator scripts are dev-time only; document regeneration workflow.
=======
- Generator scripts are dev-time only; document regeneration workflow.
- Boring-but-harmless facts (shopping centres, council offices, boundary
  admin trivia — e.g. Goolwa Beach, Strathpine, Innaloo) could be replaced
  with more memorable hooks in a future content pass.
- Duplicate place entries in arkansas.json (e.g. two Pea Ridge rows, one
  with fact=None) — harmless but worth deduping.
- Alexander's history hook ("Arkansas Juvenile Assessment and Treatment
  Center") is factually fine but may prompt questions from 8-12s;
  consider a warmer hook.
>>>>>>> 24116bd (fix(facts-ladder): narrative P1s + e2e pilot case + layout-shift investigation)
