# BRANCH_STATUS — facts-ladder-train

Rebased onto origin/main@8cd0fda (2026-10-08). Base now includes PR #107
(sprint entry gates, merged) and PR #103 (comet banner emblem, merged):
Comet hosts from the header banner, SoundToggle in eyebrow cluster,
tutorial/greeting collision fix. None of that is this branch's work — it is
inherited from main.

---

# BRANCH_STATUS — feat/facts-ladder

Fact-ladder content pipeline: generator scripts merge Wikidata / wiki-text /
EB1911 / hook facts into place chunks; 261 pilot facts (arkansas 19,
australia 242 after P0 removals) render on story cards as fact-first
narratives with per-kind source attribution.

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
- 261 pilot facts merged into arkansas.json (19) + australia.json (242).
  hookMissing cleared where facts added (contract).
- Expert review P0 fixes:
  - Removed Forrest City, AR fact (Confederate general / KKK Grand Wizard
    reference — inappropriate for 8-12).
  - Removed McKail, AU fact (describes 1835 killing — too violent).
  - Repaired rebase damage: missing brace in factText, orphaned
    assertValidFact call, truncated facts-ladder.mjs, malformed
    playwright.config.ts.
- Expert review P1 fixes:
  - Attribution links (.result-source) now meet 44px touch target.
- Gates: tsc clean, lint-cards GATE PASSED, check-generated-places 0 violations.

## Pending

- Full `npm test` suite green (in progress).
- `npm run build:pages` green (in progress).
- Playwright e2e: tests/e2e/facts-ladder-pilot.spec.ts (to run).
- Frontend P1: check second finding from review (layout shift on fact present/absent).
- Narrative P1s: 5 remaining quality issues from review (need full report).

## Backlog (P2)

- Per-kind attribution labels ("Wikidata", "EB1911") may be unclear to kids —
  consider friendlier labels.
- Generator scripts are dev-time only; document regeneration workflow.