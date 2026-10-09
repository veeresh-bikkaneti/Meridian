# Facts Ladder — Pilot Test Strategy

**Branch:** `feat/facts-ladder` · **Scope: PILOT ONLY**
**Pilot:** 263 facts merged into 2 chunks — `australia.json` (3,299 places → 242 facts:
172 hook + 70 wikitext) and `arkansas.json` (177 places → 21 facts:
12 hook + 7 wikitext + 2 wikidata). 3,476 places total.
**Full 124k merge: UNDECIDED — explicitly out of scope.** Nothing in this
strategy blesses, unblocks, or assumes the remaining 62 chunks.

## 1. What the ladder does (the contract under test)

`scripts/facts-ladder.mjs` is the **composer**. It reads the Phase 1
fact-producer outputs and merges one optional `fact` field per chunk place:

| Rung | Producer branch | Input | Winner when |
|------|----------------|-------|-------------|
| 1. wikidata | `feat/facts-wikidata-extract` (+ `feat/facts-qid-join`) | referenced-only P138/P571 statements, composed to one sentence | valid compose passes `facts-validate.mjs` |
| 2. wikitext | `feat/facts-wiki-text` | verbatim Wikipedia source sentence | valid + attributable |
| 3. eb1911 | `feat/facts-eb1911` | verbatim Wikisource sentence (`needsReview` excluded) | valid |
| 4. hook | chunk's own `history` sentence | verbatim | present |
| 5. none | — | no `fact` field written; card renders the plain blurb | |

**First hit wins. Every composed fact (rungs 1–3) must pass the
no-fabrication gate** (`scripts/facts-validate.mjs`) before merge.
Rejections are **loud**: reported per place with violation codes, and the
place falls through to the next rung — never silently downgraded.

The `fact` field contract (mirrored by `assertValidFact` in
`src/game/generated-places.ts`):

```ts
{ text, kind: 'wikidata'|'wikitext'|'eb1911'|'hook',
  source: 'Wikidata'|'Wikipedia'|'EB1911', qid?, href? }
```

Writing a `fact` also clears the card-pipeline `hookMissing` marker (see
§2.1); fact-less records keep it.

Rendering rule (`toStarter`): story = `fact.text + " " + blurb` when a fact
is present; else `history + " " + blurb`; else the bare blurb. Attribution
follows the kind: wikidata → Wikidata entity link (requires `qid`);
eb1911 → Wikisource page (`href`); wikitext/hook → GeoNames · Wikipedia.

## 2. In scope (pilot)

### 2.1 Composer unit tests (`scripts/facts-ladder.test.mjs`)

- **Precedence ordering** — wikidata > wikitext > eb1911 > hook > blurb,
  verified rung-by-rung with fixtures that remove each higher rung.
- **Correct place-ID joins** — a fact produced for geonamesId X lands on
  place X and never on neighbor place Y; join rows keyed by the wrong ID
  (or with null qids) produce no fact.
- **Rejection passthrough (loud)** — a validator rejection at a higher
  rung is recorded in the trace with its violation codes AND the place
  still falls through to the lower rung. A rejected fact is never a
  silent downgrade.
- **No-fact fallback = blurb unchanged** — `factForPlace` returns
  `{ fact: null, rung: "none" }` and the chunk record is byte-identical
  (no `fact` key added).
- **Idempotent re-runs** — re-running the composer over an already-merged
  place yields the identical `fact` (single `fact` key, no duplication,
  no key-order churn). Merge is sticky: it never removes a previously
  merged fact, it only recomputes it from current inputs.
- **hookMissing contract** (card-pipeline crew) — the generator marks
  hook-less records with `hookMissing: true`. The ladder clears the marker
  whenever it writes a `fact` (in `withFact`, mirroring
  `enrich-wikipedia.mjs` clearing it when merging a `history` hook);
  fact-less records keep the marker untouched for the linter / later
  pipeline passes. Tested: cleared on fact write (all rungs), present on
  fact-less records, stays cleared on re-runs.
- **Composition formats** — the wikidata template
  (`Founded in YEAR and named after PERSON.` / `Named after PERSON.`),
  the P571 drift guards (attestation/hedge qualifiers drop the year),
  self-name rejection, year-only → no fact.

### 2.2 Render unit tests (`src/game/generated-places.test.ts`, existing)

- Fact-first story assembly, per-kind attribution, fail-closed rejection
  of malformed `fact` fields, no-fact behavior preservation. (Already
  present; the pilot strategy keeps them green.)

### 2.3 Prebuild gate (existing, must stay green)

- `scripts/check-generated-places.mjs` re-validates 100% of shipped chunk
  places on every build: id uniqueness, edition/regionId/manifest
  consistency, and the Hyderabad coordinate check through the real F7
  gate. The pilot's 263 merged facts must not break it.

### 2.4 Browser test (`tests/e2e/facts-ladder-pilot.spec.ts`)

Boots the built app against the real pilot chunks (single-place seeded
runs via `sessionStorage`, no menu navigation) and asserts:

1. **Fact place renders fact-first** — Little Rock (`gn-4119403`,
   wikidata: "Founded in 1821 and named after The Little Rock.") shows
   the fact text leading the result-card story, with a Wikidata
   attribution link to `https://www.wikidata.org/wiki/Q33405`.
2. **No-fact place renders the plain blurb** — Alexander (`gn-4099194`,
   no fact, no history) shows exactly the chunk blurb, no fact prefix.
3. **No console errors / page errors** during either flow.

## 3. Explicitly OUT of scope

- **The full 124k merge** (62 remaining chunks). Undecided; this strategy
  does not cover it and no test here implies readiness for it.
- `--fetch-missing` network paths (qid-join + extractor live runs).
- EB1911 UK/IE coverage beyond what the pilot inputs contain (the pilot
  merged zero eb1911 facts — that rung is unit-tested, not pilot-proven).
- GeoDetective clue tiers (separate hard gate: ≥365 validated clue sets).
- The 5 Phase 1 producer branches' own internals (they have their own
  test files; the ladder tests them at the contract boundary only).
- The 70 loud validator rejections from the pilot run: they are
  **expected** loud rejections (reported, fell through to lower rungs),
  not failures. Any *silent* downgrade would be a bug.

## 4. Running the pilot suite

```bash
# composer + producer unit tests (node stdlib only, no network)
node --test 'scripts/facts-*.test.mjs'

# render unit tests
node --experimental-strip-types --test src/game/generated-places.test.ts

# typecheck
npx tsc --noEmit

# prebuild gate (Hyderabad coordinate check over all chunks)
node --experimental-strip-types scripts/check-generated-places.mjs

# browser test (needs a fresh `npm run build:pages` first)
npx playwright test tests/e2e/facts-ladder-pilot.spec.ts
```

## 5. Pilot verification record

- Pilot merge commit: `3d47834` — 263 facts (2 wikidata + 77 wikitext +
  184 hook) into australia + arkansas; 70 loud validator rejections,
  all reported with violation codes, all fell through to a lower rung.
- Rejection-reporting fix: `c044acc` — rejections are reported even when
  a lower rung wins (previously only terminal misses were loud).

## 6. Pending items this strategy does NOT cover

These feed the full-merge decision; none block the pilot:

1. **Full-merge scale behavior** — merge time, memory, and rejection
   volume across all 64 chunks are unmeasured.
2. **EB1911 rung at scale** — zero eb1911 facts in the pilot; the rung's
   real-world yield and `needsReview` exclusion rate are unknown.
3. **`--fetch-missing` reliability** — live qid-join + extractor runs
   (rate limits, partial failures, resume) are untested.
4. **Wikidata rung yield** — 2 facts in the pilot; referenced-statement
   coverage across 124k places is unknown.
5. **Fact quality sampling** — no human review pass over the 263 pilot
   facts; the validator gates fabrication, not taste.
6. **Chunk diff reviewability** — merged chunks are single-line JSON;
   per-place fact diffs are only visible via the ladder's report output.
7. **Merge stickiness** — re-running never removes facts whose inputs
   disappeared; a deliberate un-merge path does not exist.
