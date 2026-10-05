# Design: "Your pin" line for country & globe editions (wrong-answer reveal)

**Branch:** `fix/reveal-your-pin-country-globe` (off `origin/main` @ `650065e`)
**Status:** Proposed — read-only recon, no code written
**Author:** DESIGN crew (software-architect persona)

## 0. Problem statement

On a wrong answer, the reveal card must name BOTH locations ("Your pin: … · True
spot: …"). PR #50 shipped this, and it works in the **state** edition. In the
**country** and **globe** editions the "Your pin" line is missing: Veeresh's
screenshot shows a pin in Sardinia with the true spot in Calabria (Italy run)
rendering only the generic "Right country, wrong town!" line — no named
Your-pin location.

Required behavior (from the task):

- Country edition: reveal shows "Your pin: \<city>, \<state>" alongside the true spot.
- Globe edition: reveal shows "Your pin: \<city>, \<state>, \<country>" alongside the true spot.
- State edition: existing "Your pin: \<state>" line keeps working (regression lock).
- Wrong answers definitely; right-answer behavior decided below (§6).

## 1. Root-cause verdict: the identified root cause is CORRECT

Verified by reading the code (`src/game/reverse-geocode.ts`,
`src/game/reverse-geocode.test.ts`):

1. `pinCompareLine(player, truth)` has four copy variants. The same-country
   branch requires **both** `admin1` values non-null to emit the named pair;
   when either side lacks admin-1 it falls through to the generic
   `"Right country, wrong town!"` — with no "Your pin" line at all.
2. `admin1At()` only consults two vendored sources: `us-atlas/states-10m.json`
   (US) and `ne-50m-admin-1.json` (AU/BR/CA/CN/IN). Italy is in neither, so
   `resolvePin()` on both the Sardinia pin and the Calabria truth returns
   `{ admin1: null, country: "Italy" }`.
3. Same country + both admin-1 null → `"Right country, wrong town!"`. The
   "Your pin" line never renders. This is exactly the reported screenshot.

The existing unit test locks this in as specified behavior
(`"same country, admin1 unknown -> 'Right country, wrong town!'"`), so the fix
is a behavior change layered on top, not a correction of a miscoded branch.

## 2. What's in memory at reveal time (per edition)

### 2.1 Pool loading path

- Run start: `openRun()` in `src/components/game-app.tsx` awaits
  `placesFor(edition, regionId)` (`src/game/generated-places.ts`) — the chunk(s)
  for the region load via dynamic `import()`, cached per session in
  `chunkCache`. Fail-closed: a missing/malformed chunk rejects and no run
  starts.
- `PlayLoaded` (same file, ~line 1284) re-runs `placesFor(run.edition,
  run.regionId)` on mount and holds the result in `places: Starter[]` state —
  **the full dealing pool is synchronously available at reveal time**.
- The *banded* session pool (`pool = resolveRunPool(places, run.poolIds)`,
  narrowed by the difficulty tier) is a subset; the full `places` array is the
  better nearest-match source (larger coverage, same honesty gates).
- `ResultCard` currently receives only `place` (the current question), `drop`
  (the player's pin), `run`, etc. — **not** `places`. The fix needs one new
  prop (`poolPlaces: Starter[]`) drilled from `PlayLoaded`, where `places` is
  already in scope at the `<ResultCard … />` call site (~line 2015). Same array
  reference — no copy, no extra memory.

### 2.2 Pool sizes (measured from `manifest.json`, 2026-10-04)

| Edition | Chunks | Generated places | + curated | At reveal (nearest-scan n) |
|---|---|---|---|---|
| state | 50 US-state chunks (`nebraska` … `texas`) | 14,201 total; per-chunk 81 (`nebraska`) – 841 (`texas`) | ~5 state starters | **< 1k** |
| country | 13 country chunks (`italy` 5,234 … `france` 6,293) | 51,066 total | curated country starters | **~55 – ~7k**; whole-US run aggregates 50 state chunks → **~14.3k** |
| globe | 1 `globe` chunk | 59,423 | 12 curated globe starters | **~59.4k** |

Total dataset: **124,690** places across 64 chunks. Every generated place
carries `name`, `lon`, `lat`, `iso2`, and — at 99.7% coverage — a build-time
`subdivision` display name (e.g. "Sardinia", "Calabria", "Madhya Pradesh")
stamped by `scripts/build-geonames-dataset.mjs` from GeoNames admin-1 codes.
**This subdivision is independent of the vendored boundary JSONs** — it is the
key fact that makes the pool-based approach work where boundary extension
cannot (§4).

### 2.3 The truth side needs no lookup

The true spot is the `place` itself: `place.name` + `place.subdivision` are
exact data (Hyderabad-gated), not approximations. Only the player's raw
lat/lon pin needs a nearest-match.

### 2.4 Coverage asymmetry (measured, design-relevant)

The 13 countries with their own country chunk (AU, BR, CA, CN, EG, FR, DE, IN,
IT, JP, MX, GB, US) are **excluded from the `globe` chunk** (verified:
`FR`/`IT`/`DE`/`BR`/… all absent from `globe.json`, which spans 222 other
iso2s). Consequence: in **globe** edition, a pin in any of those 13 countries
has no same-territory candidate in the pool — the honesty gate (§5.2) fails
and the card falls back to the classic country-level line. This is honest and
acceptable; loading the 13 country chunks into every globe run is rejected in
§4 (cost).

## 3. Resolution strategy (ADR)

### 3.1 Decision

**Nearest place in the already-loaded region pool, with honesty gates, layered
over the unchanged classic `pinCompareLine` as a fail-closed fallback.**

New code lives in `src/game/reverse-geocode.ts` (it already owns pin naming);
`pinCompareLine` keeps its four variants byte-identical (regression lock for
state edition and for every existing unit/E2E expectation); `result-card.tsx`
calls one new composer instead of `pinCompareLine` directly.

### 3.2 Options considered

| Option | Correctness / honesty | Perf | Memory / boot | Verdict |
|---|---|---|---|---|
| **A. Nearest-place-in-pool + classic fallback (chosen)** | "near \<city>, \<state>" — qualified approximation; territory gate + 100 km cap prevent false precision; truth side exact | O(n) haversine per reveal, measured 11.4 ms @ 59.4k (node); budget §7 | Zero new data — reuses the `places` array already in state; no new imports; Safari-jetsam-safe | **Chosen** |
| B. Vendor admin-1 boundaries for all countries | Still only names *states* — can never produce "\<city>, \<state>"; multi-MB JSONs threaten the Safari jetsam budget; months of vendoring | Boundary point-in-polygon per reveal is *slower* than a haversine scan | New lazy JSONs, new preload wiring, new failure modes | Rejected — cannot satisfy the requirement |
| C. Hybrid: boundaries where available, nearest elsewhere | Two code paths for one UI slot; the detail line strictly dominates the classic line in information (city+state ⊃ state) | Worst of both | Worst of both | Rejected — complexity without benefit |
| D. (Future) Load the 13 country chunks in globe runs too | Closes the §2.4 coverage gap | ~2× scan time, still within budget | ~+51k places in memory, 13 extra chunk fetches at run start (slower start on mobile) | Deferred — classic country-level fallback is already honest |

### 3.3 Why not a spatial index

Measured on this VM (node 24): a full 124,690-point haversine scan takes
**9.3 ms** (synthetic Float64Array); a scan over the real 59,423-place globe
chunk with object property access takes **11.4 ms**. Browser JIT (Safari)
estimate 2–3× → **≤ 35 ms**, once per reveal, inside a `useMemo` keyed on
`drop`/`place`. No index, no new dependency (`d3-geo`/`topojson-client`
already present but unneeded here). Revisit trigger: pool growth >10× —
then precompute `Float64Array` lon/lat plus a simple grid index.

### 3.4 Honesty contract (non-negotiable)

- The player's pin is a raw lat/lon, **never** presented as an exact pick:
  always qualified as **"near \<city>"** — even at distance ≈ 0.
- Two gates before any "near" claim renders (§5.2): the nearest pool place
  must sit in the **same world-atlas territory** as the pin, and within
  **100 km** (`NEAREST_PLACE_MAX_KM`, one tunable constant).
- Either gate fails → the classic `pinCompareLine` output renders (today's
  copy, including ocean → no line). No fabrication, ever (card rule 5).

## 4. API design

### 4.1 New exports in `src/game/reverse-geocode.ts`

```ts
/** Honesty budget: farthest a pin may be from its named nearest place. */
export const NEAREST_PLACE_MAX_KM = 100;

/** Structural subset of Starter — the only fields the matcher reads. */
export type PoolPlace = {
  lon: number; lat: number; name: string; subdivision?: string;
};

export type NearestPoolPlace = {
  name: string;
  subdivision: string | null;
  distanceKm: number;
};

export type PlayerPinDetail = {
  /** world-atlas numeric key, e.g. "380" — exact-match, never name-compared. */
  territoryKey: string;
  /** world-atlas display name, e.g. "Italy". */
  territoryName: string;
  nearest: NearestPoolPlace;
};

/**
 * Names the player's raw pin from the already-loaded region pool.
 * Returns null when: the pin is ocean/unresolvable (territoryAt null);
 * no pool place shares the pin's territory (country not covered by the
 * pool — e.g. the 13 country-chunk nations in globe edition, §2.4); or the
 * nearest same-territory place is farther than NEAREST_PLACE_MAX_KM.
 * Synchronous, never throws. Needs NO admin-1 preload — the subdivision
 * comes from the chunk pipeline, so this works even in the first 10 s of
 * a run before preloadAdmin1Boundaries() resolves (an improvement over
 * the classic path, which degrades to country-only meanwhile).
 */
export function nearestPoolPlace(
  lat: number,
  lon: number,
  pool: ReadonlyArray<PoolPlace>,
): PlayerPinDetail | null;
```

Implementation notes for the BUILD crew:

- Nearest search is a single haversine pass (antimeridian-safe: `sin²(Δlon/2)`
  is periodic, so raw Δlon needs no wrapping).
- Territory gate: `territoryAt([best.lon, best.lat])?.key === territoryAt(pin)?.key`.
  Numeric keys — no CLDR/world-atlas *name* comparison (`"United States of
  America"` vs `"United States"` must never be string-matched). One extra
  `territoryAt` per reveal, same cost class as the two the card already pays.
- `subdivision`: pass through only when a non-empty string (the
  `toStarter`/`question-label.ts` convention); else `null` and the segment is
  omitted — never render `"null"`.

```ts
export type RevealPinLineInput = {
  edition: "state" | "country" | "globe";
  playerLat: number;
  playerLon: number;
  truth: {
    name: string; lat: number; lon: number;
    subdivision?: string; iso2?: string;
    regionId: string; originRegionId?: string;
  };
  pool: ReadonlyArray<PoolPlace>;
};

/**
 * The pin-compare line for a MISS reveal. Layered, fail-closed:
 *  1. state edition → classic pinCompareLine (byte-identical; regression lock).
 *  2. country/globe → the detail line when nearestPoolPlace is honest.
 *  3. otherwise → classic pinCompareLine (today's copy; ocean → null).
 * Miss-only: the hit card never calls this (§6).
 */
export function revealPinLine(input: RevealPinLineInput): string | null;
```

Composition inside `revealPinLine` (exact):

1. `classic = pinCompareLine(resolvePin(playerLat, playerLon), resolvePin(truth.lat, truth.lon))` — unchanged.
2. If `edition === "state"` → return `classic`. (State edition is US-only;
   us-atlas names all 56 US admin-1s, so the classic path already names both
   sides exactly. Zero behavior change, zero regression risk.)
3. `detail = nearestPoolPlace(playerLat, playerLon, pool)`; if null → return `classic`.
4. Truth country (globe suffix only): reuse the question-label funnel —
   `countryNameForIso2(truth.iso2) ?? countryNameForRegionId(truth.regionId)
   ?? countryNameForRegionId(truth.originRegionId)` — the same funnel the
   question bubble uses, so reveal matches what was asked. Import from
   `question-label.ts` (BUILD: verify no import cycle — `tsc` will catch it;
   fall back to a local 3-line funnel if cyclic).
5. Same-country check: `territoryAt([truth.lon, truth.lat])?.key ===
   detail.territoryKey` (truth null → treat as different-country; the suffix
   direction is the more informative one).

### 4.2 Copy matrix (kid-friendly, no-shaming — same voice as the four classic variants)

Segments in `{braces}` are omitted when the source field is absent.

| Edition | Case | Rendered line |
|---|---|---|
| state | any | `classic` unchanged: "Right state, wrong town!" / "Your pin: X · True spot: Y" / "Right country, wrong town!" / (null → no line) |
| country | detail ok, pin in truth's country | `Your pin: near {city}, {state} · True spot: {tCity}, {tState}` |
| country | detail ok, pin in another country | `Your pin: near {city}, {state}, {pCountry} · True spot: {tCity}, {tState}` |
| country | detail null | `classic` (today's copy) |
| globe | detail ok | `Your pin: near {city}, {state}, {pCountry} · True spot: {tCity}, {tState}, {tCountry}` |
| globe | detail null | `classic` (today's copy) |
| any | right answer | **no line** (unchanged, §6) |
| any | ocean/unresolvable pin | **no line** (unchanged — fail closed) |

Worked examples:

- Italy run, pin Sardinia (the bug screenshot), truth Calabria:
  `Your pin: near Cagliari, Sardinia · True spot: Reggio di Calabria, Calabria`
  (nearest Italy-chunk place to a central-Sardinia pin measured at single-digit km).
- Italy run, pin in France: `Your pin: near Nice, Provence-Alpes-Côte d'Azur,
  France · True spot: Reggio di Calabria, Calabria`.
- Globe run, pin Brazil (chunk-less in globe pool, §2.4): territory gate fails →
  classic: `Your pin: Bahia · True spot: Hungary` — **the existing E2E
  expectation `EXPECTED_BAHIA_LINE` is preserved** (BUILD: re-run the spec to
  confirm; update the expected string only if the detail path legitimately
  fires, which would be the correct richer behavior).
- US country run ("whole United States"), pin Texas, truth Kansas:
  `Your pin: near Austin, Texas · True spot: Wichita, Kansas` — the detail
  line supersedes classic "Your pin: Texas · True spot: Kansas" (more
  informative, same honesty).

Deliberate deviation from the task text: the required `"Your pin: <city>,
<state>"` is rendered as `"Your pin: near <city>, <state>"`. The "near" is
the honesty qualifier the task itself demands ("never present as the exact
pick"); dropping it would violate the no-fabrication rule.

### 4.3 Wiring changes

- `src/components/game-app.tsx` (~line 2015): pass `poolPlaces={places}` to
  `<ResultCard>` (full pool, not the banded `pool`).
- `src/components/result-card.tsx`: add optional `poolPlaces?: Starter[]`
  prop; replace the `pinLine` memo body with `revealPinLine({ edition:
  run.edition, playerLat: drop.lat, playerLon: drop.lon, truth: place, pool:
  poolPlaces ?? [] })`. Keep the existing `if (!drop || !place) return null`
  guard and the "rendered only in the done (miss) block" rule. `poolPlaces`
  absent/empty → `nearestPoolPlace` returns null → classic — safe default.
- `src/game/reverse-geocode.ts`: add the exports above; touch nothing existing.
- `src/game/reverse-geocode.test.ts`: the file's contract-mirror of
  `resolvePin`/`pinCompareLine` (regex-extracted source, lines ~101–112) stays
  valid — those functions are untouched. Add tests for the new functions in the
  file's established style ("known coordinates encode what the vendored data
  REALLY says"): e.g. Sardinia pin → detail with an Italian city; Milan pin →
  null (nearest globe-chunk place is Chiasso, CH — territory gate, verified by
  measurement in §5.2); ocean pin → null.
- `tests/e2e/reveal-pin-compare.desktop.spec.ts`: expectations almost certainly
  unchanged (Bahia → classic fallback; ocean → no line; hit → no line). BUILD
  must run the suite (standing E2E gate) rather than assume.

## 5. Edge cases

1. **Ocean pin** — `territoryAt` null → detail null → classic null → no line.
   Identical to today (E2E "miss in the ocean" test unaffected).
2. **Pin in a country with no chunk** (globe §2.4; any uncovered territory) —
   territory gate fails → classic country-level line ("Your pin: France ·
   True spot: …"). Country named honestly; no city invented.
3. **Pin exactly on a place** (distance ≈ 0, possibly the truth's neighbor) —
   still "near \<city>". The qualifier is unconditional; exactness is never
   claimed.
4. **Right answer** — no line, unchanged (§6).
5. **admin-1 preload not yet done** (reveal within ~10 s of run start) —
   classic degrades to country-only as today, but the detail path does **not**
   need the preload, so country/globe reveals are *better* early, never worse.
6. **admin-1 still null after preload** (countries without vendored boundaries —
   the bug) — the pool's build-time `subdivision` fills the gap; this is the
   core fix. Sardinia/Calabria come from GeoNames admin-1 names, not from
   boundary polygons.
7. **Whole-country US run** — pool = US chunk + 50 state chunks, all US
   territory by fail-closed construction; nearest match yields e.g.
   "near Austin, Texas". (Classic would also work here via us-atlas; detail
   is preferred for the city.)
8. **Subdivision absent** (0.3% of generated places; some curated globe
   starters) — segment omitted: "near Kyoto · True spot: …" / globe
   "near Kyoto, Japan · True spot: …". Never "null".
9. **Empty pool** (deliberately empty band) — `nearestPoolPlace` over `[]`
   returns null → classic → no line. No crash path.
10. **Duplicate place names** in the pool — irrelevant; matching is by
    coordinates, and the name is only ever qualified with "near".
11. **Antimeridian** — `sin²(Δlon/2)` handles Δlon > 180° correctly; no wrap
    bug (verified by inspection of the haversine form used).
12. **GeoDetective** — not an `Edition` in `run.ts`; out of scope.

## 6. Right-answer reveals: no line (unchanged)

Decision: the pin-compare line stays **miss-only**, as today (locked by the
E2E "hit: the card shows no pin-compare line" test). Rationale:

- On a hit, the card already celebrates the true spot by name (the question
  label); the player knows where they pinned — there is no second location to
  teach.
- A "near X" approximation on a *correct* answer reads as hedging and adds UI
  noise where the learning payload is already delivered.
- The bug report and the required behavior both concern wrong answers.

Consistency rule going forward: the line answers "where did your pin actually
land?" — a question that only exists on a miss.

## 7. Performance budget

| Item | Measured / estimated | Budget |
|---|---|---|
| Nearest scan, globe pool (59,423 places, object access) | **11.4 ms/scan** (node 24, this VM; 20-run mean) | — |
| Nearest scan, 124,690 pts (synthetic Float64Array) | 9.3 ms/scan | — |
| Browser estimate (Safari JSC ≈ 2–3× node) | ≤ 35 ms | **≤ 50 ms** synchronous per reveal |
| Scan frequency | once per reveal, inside `useMemo` keyed on `drop`/`place` | no per-frame work |
| Extra `territoryAt` (candidate gate) | O(~240 country features), same class as the 2 existing calls | negligible |
| Memory delta | **zero** — reuses the `places` array already held in `PlayLoaded` state | no new module-level data (jetsam rule holds) |
| Boot / bundle delta | zero new imports; `reverse-geocode.ts` already in the result-card graph; no new JSON vendored | — |
| Run-start cost | zero — chunks already loaded for dealing | — |

No spatial index. Revisit trigger: pool growth >10× current size.

## 8. What this design does NOT change

- `pinCompareLine`'s four copy variants and `resolvePin`'s contract (all
  existing unit tests keep passing untouched).
- State-edition reveal behavior (byte-identical).
- Hit reveals (no line), ocean pins (no line), the 10 s deferred
  `preloadAdmin1Boundaries()` wiring, the `result-card.test.ts`
  contract-mirror, and the `pin-compare-line` testid.
- Dealing, pools, no-repeat, scoring, and the card gate are untouched.

## 9. Open questions for Veeresh (his call, not the crew's)

1. The task text says `"Your pin: <city>, <state>"`; this design renders
   `"Your pin: near <city>, <state>"` per the honesty requirement. Confirm
   the "near" qualifier is the desired trade-off (alternatives: "closest
   town:" phrasing, or dropping the qualifier — not recommended).
2. `NEAREST_PLACE_MAX_KM = 100`: confirm the honesty budget, or pick another
   (50 km is stricter; 200 km looser).
3. Globe-edition pins in the 13 chunk-countries (US, France, Italy, …) get
   country-level naming only (§2.4). Accept, or fund option D (load 13 more
   chunks per globe run — slower start, more memory)?
