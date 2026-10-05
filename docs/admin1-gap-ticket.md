# Ticket-3 — Admin-1 data gap (scoping ticket, no implementation)

**Status:** scoped 2026-10-05 · **decision needed from Veeresh** (see §6)
**Crew:** data-engineer + software-architect (read-only analysis; no downloads, no code changes)
**Branch:** `fix/gis-review-gaps`

## 1. Problem statement

The progressive boundary reveal (continent → country → admin-1 as you zoom, `src/map/boundary-bands.ts`)
silently stalls at country lines for most of the world: at zoom ≥ 6 only the US
(`us-atlas/states-10m.json`) plus AU/BR/CA/CN/IN (`src/map/data/ne-50m-admin-1.json`)
draw state/province boundaries. Everywhere else the player sees country borders —
the "state/province boundaries close in" promise from Veeresh's 2026-09-30 map-quiz
design is unkept for most countries.

The same gap is behind the Your-pin bug fixed in PR #58: `admin1At()` in
`src/game/reverse-geocode.ts` only resolves admin-1 names for US + the 5 vendored
countries. In country editions without vendored admin-1 (France, Italy, Japan, …)
both pins resolve `admin1: null` and the reveal line degraded to the bare
"Right country, wrong town!" — PR #58 papered this over with the honest
`nearestPoolPlace` fallback ("Your pin: near …"), but the underlying data gap is
still open.

Two consumers, one gap:

| Consumer | File | Today | Fallback when admin-1 missing |
|---|---|---|---|
| Zoom-band boundary lines (z ≥ 6) | `src/map/boundary-bands.ts` | US states + 5-country NE admin-1 layers | Country-boundary layer stays on as context |
| Reveal pin naming | `src/game/reverse-geocode.ts` (`admin1At` → `pinCompareLine`) | `admin1` resolves for US + 5 countries | PR #58 `nearestPoolPlace`: "near \<city\>" from the region pool (99.7% subdivision coverage), same-territory + 100 km honesty gate |

## 2. Measured current state (2026-10-05, worktree @ fab222e)

`src/map/data/ne-50m-admin-1.json`:
- **1,229,656 bytes (1.2 MB)** on disk; GeoJSON FeatureCollection, CRS84,
  vendored from `nvkelso/natural-earth-vector` (`geojson/ne_50m_admin_1_states_provinces.geojson`), public domain.
- **116 features**: AU 9 · BR 27 · CA 13 · CN 31 · IN 36. All carry `iso_a2`; display name at `properties.name`.
- Geometry: 86 Polygon + 30 MultiPolygon.
- **121 properties per feature** (full NE attribute table — `name_*` localizations, `fips`, `woe_id`, map colors, …). Only `name` + `iso_a2` are read. The other 119 are dead weight (~most of the 1.2 MB).
- Every feature carries a per-feature `bbox` (useful: cheap pre-filter for point-in-polygon).
- Loaded **lazily** via dynamic `import()` in two places: `boundary-bands.ts#getNeAdmin1` (map lines) and `reverse-geocode.ts#getNeAdmin1` (pin naming). Never in the boot bundle. (Safari-jetsam lesson applies: keep it that way.)

Reference sizes already in the repo (for scale):
- `world-atlas/countries-50m.json` (TopoJSON): **740 KB**
- `us-atlas/states-10m.json` (TopoJSON, 56 geometries): **112 KB**
- Per-region GeoNames question chunks: 64 chunks / 32 MB total (~500 KB avg) — the existing "lazy per-region chunk" architecture (`generated-places.ts#loadRegionChunk`, fail-closed cache).

Playable-region scope (bounds the problem — `src/game/data/geonames/manifest.json`):
- **64 regions: 50 US states + 13 countries + 1 globe.** The 13 country editions are
  australia, brazil, canada, china, **egypt, france, germany, india, italy, japan, mexico, united-kingdom**, united-states.
- So the **gameplay gap is exactly 7 countries**: EG, FR, DE, IT, JP, MX, GB.
  Your-pin admin-1 naming can only bite when player and truth share a country, and
  truth always comes from the pool (13 countries + US states) — the 7 missing
  countries close the gameplay gap completely.
- The **map-context gap is global**: at z ≥ 6 over any non-playable country (e.g.
  Argentina) the player sees country lines only. Closing that needs worldwide admin-1.

## 3. Candidate sources (data-engineer)

All sizes below are **measured from published specs on 2026-10-05, no dataset downloaded**:
GitHub API file metadata, `Content-Length` response headers (HEAD only), and official docs pages.

### 3a. Natural Earth 50m admin-1 (status quo source, extended)

- **What:** `ne_50m_admin_1_states_provinces.geojson` in `nvkelso/natural-earth-vector`.
- **Coverage:** NOT global. NE's own download page says *"For more detailed breakdowns for most countries in the world, see 10m admin-1"* (page text is stale — still says "just the United States and Canada" from 2009 — but the guidance stands). The in-code comment claims "only 9 countries total"; **unverifiable without downloading** — the full file is 2.22 MB and our 5-country subset is 1.2 MB, so it clearly contains more than our 116 features, but the exact country list is unknown from published specs.
- **Size:** full file **2,325,694 bytes (2.22 MB)** GeoJSON (GitHub repo metadata, 2026-10-05).
- **License:** public domain (Natural Earth terms). Zero attribution burden — fits the existing pipeline exactly.
- **Cadence:** versioned releases (5.1.1 current); slow (years between majors). Vendored snapshot is fine.
- **Fit:** perfect if it covers the 7 gap countries — same provenance, same 50m simplification, same filter-and-vendor pipeline as the existing file. **Step 0 for the implementing crew:** download the 2.22 MB file once and count `iso_a2` values (one-liner); if EG/FR/DE/IT/JP/MX/GB are present, the narrow scope needs no new source at all.

### 3b. Natural Earth 10m admin-1 → simplified to 50m-equivalent (global, public domain)

- **What:** `ne_10m_admin_1_states_provinces.geojson` — NE's sanctioned global admin-1.
- **Coverage:** global (~4,779 features per NE docs).
- **Size:** **40,726,851 bytes (38.84 MB)** raw GeoJSON (GitHub repo metadata). **Not vendored raw** — a build step must simplify to 50m-equivalent (≈ the density of the current file: ~10 KB/feature → order of **3–6 MB GeoJSON**, less as TopoJSON; estimate, basis stated).
- **License:** public domain. Zero attribution burden.
- **Cadence:** same slow NE releases as 3a.
- **Fit:** the only zero-cost, public-domain, global-coverage option. Cost is a new build-time simplification step (mapshaper/topojson CLI, pinned version, checked-in script) — i.e. a small pipeline, not just a file drop. Boundary vintage follows NE releases.

### 3c. GeoBoundaries gbOpen per-country ADM1 (global, per-country chunks)

- **What:** per-country ADM1 GeoJSON via keyless API (`https://www.geoboundaries.org/api/current/gbOpen/<ISO3>/ADM1/` → `simplifiedGeometryGeoJSON` / `gjDownloadURL`), plus a global CGAZ composite.
- **Coverage:** 199 entities, ADM1 global (CGAZ composite: 3,224 ADM1 features).
- **Size (measured via Content-Length HEAD, simplified variant):**

  | Country | Simplified ADM1 | Full ADM1 | Per-file license (from API metadata) |
  |---|---|---|---|
  | France | 1.6 MB | — | Etalab Open License 2.0 |
  | Japan | 2.1 MB | 62.7 MB | ODbL 1.0 |
  | Italy | 0.86 MB | 19.6 MB | CC BY 3.0 |
  | Germany | 1.2 MB | 6.3 MB | Datenlizenz Deutschland 2.0 |
  | Spain | 0.97 MB | 23.5 MB | CC BY 4.0 |
  | Netherlands | 0.15 MB | 5.8 MB | CC0 1.0 |
  | UK | 0.19 MB | 0.20 MB | CC BY 4.0 |
  | Mexico | 3.8 MB | 36.2 MB | CC BY 3.0 IGO |
  | Egypt | 0.19 MB | — | ODbL 1.0 |

  The 7 gap countries (EG/FR/DE/IT/JP/MX/GB) sum to **≈ 9.9 MB raw simplified GeoJSON** — the "simplified" variant is only mildly simplified (Mexico's 32 states = 3.8 MB). A real 50m-equivalent simplification is still required (≈ 172 features × ~10 KB ≈ **1.7 MB GeoJSON**, less as TopoJSON; estimate, basis = current file density).
  The global CGAZ ADM1 GeoJSON is reported at **360–550 MB** (third-party measurement) — never vendored raw; per-country or simplified-only.
- **License:** ⚠️ heterogeneous. `gbOpen` is described as CC-BY-4.0-compliant as a release type, but **each boundary file carries its own license** in the API metadata (table above: Etalab 2.0, ODbL 1.0, CC BY 3.0/4.0, CC0, dl-de/by-2.0…). The implementing crew must record per-file attribution; the app's attribution line ("Place data: GeoNames CC-BY 4.0 · …") would need extending, and ODbL files (JP, EG) carry share-alike obligations on the adapted database. Manageable, but it is real bookkeeping — unlike the zero-burden NE options.
- **Cadence:** irregular/infrequent — latest tagged release **v6.0.0 (2023-09-14)**; per-boundary vintage varies (API metadata: India ADM1 represents **2011**, Egypt **2017**). Boundary changes are slow; staleness risk is low but the source is not actively versioned.
- **Fit:** best fit for **per-country lazy chunks** (option b): keyless, per-country URLs, `simplifiedGeometryGeoJSON` provided. Also the only candidate with a same-day global composite if Veeresh wants worldwide z≥6 lines without building a simplification pipeline.

### 3d. GADM 4.1 — DISQUALIFIED for vendoring

- **License** (gadm.org/license.html, verbatim): *"The data are freely available for academic use and other non-commercial use. **Redistribution or commercial use is not allowed without prior permission.**"*
- Vendoring into a GitHub Pages app **is redistribution** — disqualified unless Veeresh seeks written permission. (Independent corroboration: third-party projects deliberately omit GADM for this reason.) No sizes measured; not needed.

### 3e. OSM-derived, API-keyed (osm-boundaries.com) — not recommended

- OSM data under ODbL; per-boundary GeoJSON via API, but **requires a free API key** and is rate-limited — wrong shape for a bundled/offline-first app. Runtime fetching is possible (see §4c) but key management + offline story make it strictly worse than 3c's keyless API for our purposes. Not recommended.

### Source comparison

| Source | Coverage | License | Payload (measured/estimated) | Cadence | Pipeline fit |
|---|---|---|---|---|---|
| NE 50m admin-1 (extend filter) | Partial (verify: 7 gap countries?) | Public domain | Full 2.22 MB; 7-country slice ≈ 1.7 MB GeoJSON est. | Slow NE releases | Trivial — same as today |
| NE 10m → simplify to 50m | Global (~4,779 feats) | Public domain | 38.84 MB raw → ~3–6 MB GeoJSON est. (less as TopoJSON) | Slow NE releases | New build-time simplify step |
| GeoBoundaries gbOpen per-country | Global (199 entities) | Mixed per-file (CC BY x, ODbL, Etalab, CC0…) | 7 countries ≈ 9.9 MB raw simplified → ~1.7 MB after 50m simplify est. | Irregular (v6.0.0 = 2023-09-14; per-file vintage varies) | Keyless per-country API; attribution bookkeeping |
| GADM 4.1 | Global | ❌ No redistribution without permission | n/a | Versioned | Disqualified |
| osm-boundaries.com | Global (OSM) | ODbL | n/a | Live OSM | ❌ API key + rate limits; wrong shape |

## 4. Integration options (software-architect)

### Common ground (all options)

- **Zoom-band logic** (`bandForZoom`: z<3 continents, 3–6 countries, ≥6 admin1) is untouched. Only the *contents* of the admin-1 band change. The country-boundary context layer stays in the ≥6 band regardless — it is the explicit fallback for regions without admin-1 data (today: most of the world; after narrow scope: non-playable countries; after global scope: nowhere, but keep it as the failure fallback).
- **PR #58 fallback stays.** `nearestPoolPlace` ("Your pin: near …") remains the honesty layer for ocean pins, pool-coverage gaps, and any gate failure. `pinCompareLine`'s classic path stays the regression lock for state edition. Closing the data gap *upgrades* the classic path (admin1 resolves → "Your pin: Bavaria · True spot: …"); it does not replace the fallback.
- **Layer consolidation:** today the ≥6 band paints 3 data layers (us-states + ne-admin1 + countries). Any option that adds countries should merge into **one** `boundary-admin1` source/layer (keep us-atlas separate or fold it in — implementer's call; folding removes a branch in `admin1At` too).
- **Perf:** `admin1At()` is a linear `geoContains` scan over the caches (116 features today). A global file (~3,224 features) makes it ~28× slower per `resolvePin` call. Mitigation is cheap — every NE feature already carries a per-feature `bbox`; add a bbox pre-filter before `geoContains` (and require `bbox` in the slim schema, §5). GeoBoundaries features would need bboxes computed at build time.
- **Keep it lazy.** Both consumers already load via dynamic `import()`; the Safari-jetsam comment in `reverse-geocode.ts` is load-bearing. New data must stay out of the boot bundle. Verify the new lazy chunks are covered by the service-worker's runtime caching, or they fail offline (open verification step — the PWA plugin's chunk handling was not audited in this pass).
- **Slim schema.** Whatever the source: strip to `{name, iso_a2, bbox, geometry}` at build time. The current 121-properties-per-feature is the single biggest avoidable cost.

### Option (a) — Vendor one full global file

- **What:** one `ne-50m-admin-1-global.json` (NE 10m→50m simplified, or CGAZ ADM1 simplified+TopoJSON), loaded once via the existing dynamic-import path.
- **Size:** est. low-single-digit MB GeoJSON, less as TopoJSON (in-repo analogy: `us-atlas/states-10m.json` TopoJSON = 112 KB for 56 geometries at 10m detail). Must be validated against the Safari-jetsam budget — parse cost of a multi-MB JSON on low-end iPhones is the risk; measure on-device before committing.
- **Zoom bands:** simplest — one admin-1 layer worldwide at z≥6. No per-country bookkeeping.
- **PR #58 interplay:** `admin1At` scans one cache; `nearestPoolPlace` unchanged as the honesty fallback.
- **Risk:** biggest single payload; all-or-nothing download (a chunk-load failure at z≥6 degrades to… the country layer, which is already the designed fallback — graceful).

### Option (b) — Lazy per-country chunks, aligned with the existing chunk architecture

- **What:** `src/map/data/admin1/<iso2>.json` (or TopoJSON), loaded on demand per played country — the same pattern as `loadRegionChunk` (`generated-places.ts`: per-region dynamic import + fail-closed cache + retry-on-failure eviction).
- **Narrow variant (recommended if NE 50m covers the 7):** add only EG/FR/DE/IT/JP/MX/GB chunks (~1.7 MB total GeoJSON est., less as TopoJSON). Closes the **gameplay** gap 100%: every country edition and every in-game Your-pin comparison resolves admin-1. The z≥6 map over non-playable countries keeps today's country-lines fallback.
- **Global variant:** ~199 per-country chunks from GeoBoundaries gbOpen, fetched when the viewport's z≥6 country changes. More moving parts (viewport→country lookup, chunk eviction policy, 199-file attribution manifest) for context lines over countries the quiz never asks about.
- **Zoom bands:** the ≥6 band paints the chunk(s) for the country (or countries) in view plus the country-context layer. Chunk load is async — `paintBoundaryBandAsync` already awaits data and no-ops on failure, so the pattern fits.
- **PR #58 interplay:** `preloadAdmin1Boundaries()` becomes `preloadAdmin1ForCountry(iso2)`; `admin1At` scans the loaded chunks. `nearestPoolPlace` still covers the pre-load window (it needs no admin-1 preload — noted in PR #58 as an improvement over the classic path).
- **Risk:** chunk-count complexity; viewport-driven loading needs a country-at-center lookup (world-atlas `territoryAt` already exists). Offline story needs one SW rule per chunk pattern — simpler than (a)'s single big file, actually.

### Option (c) — Server-free alternatives (no new vendored polygons)

1. **Runtime fetch from the geoBoundaries keyless API** (no vendoring): fetch `<ISO3>/ADM1` simplified GeoJSON on first z≥6 entry per country, cache in memory/IndexedDB. Zero bundle cost, zero build pipeline. **Costs:** violates the standing "all data bundled / zero-cost" posture (`boundary-bands.ts` header); needs network exactly when the player zooms deep; offline mode loses admin-1 lines; per-file licenses still require attribution bookkeeping. Verdict: viable only if Veeresh relaxes the bundled-data rule — flag, don't assume.
2. **Vector tiles from a free provider** (MapTiler/Mapbox boundary tiles): needs API key + network + $$$ beyond free tier. Fails the zero-cost rule outright. Not recommended.
3. **Do nothing — declare the fallback the design (explicit fallback UX):** keep the 5-country file; make the *fallback* explicit and honest instead of silent:
   - Map: at z≥6 over countries without admin-1 data, the country-context lines already render — the gap is invisible *on the map* (lines are context-only, no labels ever). The only honest change: stop implying global admin-1 in docs/comments; update the `boundary-bands.ts` header to name the 6 covered regions.
   - Reveal card: PR #58's "near …" line already names the pin honestly from pool data. The residual gap is the classic `pinCompareLine` branch ("Right country, wrong town!" with no state names) — which is *correct*, just less informative. Explicit fallback UX here = keep the copy as-is (it already degrades gracefully); optionally add the pool-subdivision to the truth side, which PR #58's `revealPinLine` already does (`True spot: <city>, <subdivision>`).
   - In other words: **the fallbacks Veeresh already approved ARE the explicit fallback UX.** Option (c3) = document them as the decided design and close the ticket as "gap accepted, fallbacks explicit."

## 5. Joint recommendation

**Narrow scope first (7 countries), via NE 50m if it covers them, else GeoBoundaries gbOpen — as lazy per-country chunks (option b-narrow). Defer the global map-context question to Veeresh.**

Rationale:
- The **gameplay** gap (the one players feel: Your-pin naming, country-edition boundary reveal) is exactly 7 countries. Closing it is small, reviewable, and fully E2E-testable per country edition.
- The **map-context** gap (z≥6 lines over non-playable countries) is cosmetic context on a label-free map — no quiz mechanic depends on it. Spending 3–6 MB of bundle and a license-audit spreadsheet on context lines over countries never quizzed is poor value against Veeresh's learning-outcomes-first bar.
- Source choice is a 5-minute measurement, not a debate: **Step 0** — download the 2.22 MB NE 50m full file once, count distinct `iso_a2`. If EG/FR/DE/IT/JP/MX/GB are present → stay 100% public-domain NE, extend the existing filter, done. If any are missing → pull just those from GeoBoundaries gbOpen (keyless), simplify to 50m-equivalent, record per-file license + attribution.
- Whichever source: slim schema (`name, iso_a2, bbox, geometry`), TopoJSON, lazy per-country chunks mirroring `loadRegionChunk`, bbox pre-filter in `admin1At`, SW coverage verified, E2E per affected country edition (the standing Meridian deploy gate).

Rough effort (for planning, not a commitment): Step-0 verification <1 hr; narrow-scope pipeline + integration + tests ≈ one crew-day; global option (a/b-global) ≈ 3–5× that plus the license-attribution audit.

## 6. Decision needed from Veeresh

1. **Scope: narrow (7 playable countries) or global (all ~199)?** Narrow closes every gameplay-visible gap; global additionally draws admin-1 context lines at z≥6 over countries the quiz never asks about, at ~3–5× the cost plus license bookkeeping.
2. **If global: source?** NE 10m→50m (public domain, needs a build-time simplification pipeline) vs GeoBoundaries (keyless, per-country, but per-file mixed licenses + attribution audit). GADM is out (no-redistribution license).
3. **Bundled-data rule check:** does the "all data bundled, zero-cost" posture still hold (it rules out runtime API fetching)? Presumed yes — flag if otherwise.

**If Veeresh answers "narrow":** the implementing crew needs no further research — §3a Step 0 + §5 is the complete spec.
**If Veeresh answers "accept the gap":** adopt option (c3) — update the `boundary-bands.ts` header to name covered regions explicitly, keep PR #58 fallbacks, close this ticket as decided.

## 7. Implementation checklist (for the future crew — do not start without Veeresh's §6 decision)

- [ ] Step 0: download NE 50m full file (2.22 MB) once; count distinct `iso_a2`; record whether EG/FR/DE/IT/JP/MX/GB are covered.
- [ ] Build script: source → filter/simplify → slim schema (`name, iso_a2, bbox, geometry`) → TopoJSON → `src/map/data/admin1/<iso2>.json`; property-strip the existing 5-country file the same way (kills the 119 dead properties).
- [ ] Per-country lazy loader mirroring `loadRegionChunk` (fail-closed cache, retry eviction); wire into `boundary-bands.ts` (one merged `boundary-admin1` layer) and `reverse-geocode.ts` (`preloadAdmin1ForCountry`, bbox pre-filter in `admin1At`).
- [ ] Attribution: extend the app's attribution line for any non-public-domain file (GeoBoundaries per-file licenses from API metadata); NE-only needs nothing new.
- [ ] Gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`, real-browser E2E on changed reveal paths (country editions FR/IT/JP at minimum), review crew sign-off with ZERO blockers (standing Meridian gates).
- [ ] Verify service-worker runtime caching covers the new lazy chunks (offline = country-lines fallback, never a hang).
- [ ] Update `BRANCH_STATUS.md`; PR flow (main is protected).

## 8. Provenance of measurements

- Current file: measured in-worktree (`du`, Python feature/property counts), 2026-10-05.
- NE 50m full (2,325,694 B) / NE 10m admin-1 (40,726,851 B): GitHub REST API repo-contents metadata for `nvkelso/natural-earth-vector`, 2026-10-05 (file headers only — no dataset downloaded).
- GeoBoundaries per-country sizes: `Content-Length` on HEAD requests to `simplifiedGeometryGeoJSON` URLs from `https://www.geoboundaries.org/api/current/gbOpen/<ISO3>/ADM1/` (no bodies fetched); licenses/vintage from the same API metadata.
- CGAZ 360–550 MB GeoJSON + 3,224 ADM1 features: third-party published measurements (cited in-ticket as such, not first-hand).
- GADM license: verbatim from https://gadm.org/license.html, 2026-10-05.
- GeoBoundaries release-type license guidance (gbOpen = CC-BY-4.0-compliant default; gbAuthoritative = no commercial use; gbHumanitarian = UN OCHA, more restrictive): geobounds R package docs (CRAN mirror), 2026-10-05.
- NE 50m "only 9 countries" claim: in-code comment in `boundary-bands.ts`, **unverified** — flagged for Step-0 verification, not relied upon.
