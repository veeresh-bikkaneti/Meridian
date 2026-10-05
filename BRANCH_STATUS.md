# BRANCH_STATUS.md — feat/admin1-narrow-7

**Branch:** `feat/admin1-narrow-7` off `origin/main` @ `ea3117b`
**Worktree:** `~/workspace/meridian-worktrees/admin1-narrow`
**Mission:** Admin-1 NARROW scope — 7 countries ONLY (EG/FR/DE/IT/JP/MX/GB). Global scope explicitly REJECTED (Veeresh, 2026-10-05). Spec: `docs/admin1-gap-ticket.md` §7. Veeresh merges.

## Scope decisions (crew-lead calls, flagged for Veeresh in the PR)
- **Step 0:** NE 50m full file (2,325,694 B, SHA256 pinned in build script) covers exactly 9 countries (AU BR CA CN ID IN RU US ZA) — all 7 gap countries MISSING (the in-code "only 9 countries" comment was correct).
- **Source for the 7:** NE 10m → simplify (public domain, zero license bookkeeping), NOT GeoBoundaries (deviation from the ticket's §5 recommendation, which assumed partial coverage; all-7-missing makes the mixed licenses + ODbL share-alike a worse trade). Documented in `scripts/build-admin1.mjs`.
- New chunks are TopoJSON (task-literal, repo convention); the legacy 5-country file stays GeoJSON, property-stripped in place.
- One merged `boundary-admin1` layer (US folded in); `preloadAdmin1ForCountry` targeted top-up; PR #58 "near <city>" fallback stays as the fail-closed path.

## Done
- [x] **Step 0** (2026-10-05): downloaded NE 50m once from `nvkelso/natural-earth-vector` (genuine repo, byte size matches GitHub metadata); counted 294 features / 9 iso_a2; EG/FR/DE/IT/JP/MX/GB all missing. SHA256 `69a0e06e…c426b9` pinned in the build script. Raw files live in /tmp only — never committed.
- [x] **Build script** `scripts/build-admin1.mjs` (checked in, deterministic): verifies NE 10m SHA256 (`22d0e3ad…958185da62fb5`, 40,726,851 B) fail-closed → per-feature adaptive Douglas-Peucker to ≈300 verts/feature (genuine 50m measures 108–1084, typically 130–260) → slim `{name, iso_a2, bbox}` → TopoJSON (topojson-server@3.0.1, OSV clean, quantization 1e4) → `src/map/data/admin1/<iso2>.json`. Includes a **build-time verification gate** (decodes every chunk: feature counts, finite bboxes, valid closed rings, every vertex inside its padded bbox) — caught 2 real bugs during development (doubly-nested Polygons; per-feature vs global quantization pad).
- [x] **Data outputs:** 7 chunks ≈ 531 KB total TopoJSON (eg 36 KB, fr 118 KB, de 55 KB, it 134 KB, jp 80 KB, mx 107 KB, gb 142 KB); legacy `ne-50m-admin-1.json` 1.2 MB → 808 KB (119 dead properties killed, geometry byte-identical). 17 capital/border pin probes resolve correctly (Paris→"Paris", Berlin→"Berlin", Roma, Tokyo, Al Qahirah, Distrito Federal, Westminster…).
- [x] **Code:** `reverse-geocode.ts` — `preloadAdmin1ForCountry` (fail-closed cache + retry eviction, unknown iso2 → null), `admin1ChunkIso2ForRegion`, bbox pre-filter in `admin1At` (us-atlas bboxes computed at load via d3 geoBounds; NE lists carry bbox); `boundary-bands.ts` — one merged `boundary-admin1` layer (partial-failure tolerant, cache evicted for retry); `game-app.tsx` — 10s tick also warms the played country's chunk. PR #58 fallback untouched.
- [x] **Unit tests:** 42/42 green (reverse-geocode: chunk loader idempotency/fail-closed/schema/pin resolution/pin-compare; boundary-bands: merged layer, 738-feature multi-country source, idempotency, no-labels).
- [x] **tsc --noEmit** clean.
- [x] **Attribution:** all-NE public domain — no attribution change needed (confirmed, nothing non-PD vendored).

## Follow-up crew (2026-10-05) — main integration + finish job
- [x] **Veeresh RATIFIED the NE 10m source deviation** (2026-10-05) — no rework, proceed as built.
- [x] Merged `origin/main` (PR #61 first-run tutorial, `0aeac14`) into `feat/admin1-narrow-7` — one conflict (BRANCH_STATUS.md, kept admin1 version), game-app.tsx + tutorial files auto-merged (10 s admin-1 warm tick intact). Post-merge: `tsc --noEmit` clean, `npm test` **613/613 green**, `node scripts/lint-cards.mjs` GATE PASSED, `npm run build:pages` green (buildId 3f6b600).
- [x] **E2E finding → spec fix (not an app bug):** first locked run of `admin1-narrow.desktop.spec.ts` failed 2/2. Root-caused via traces/screenshots: the specs asserted the bare classic pin-compare format ("Your pin: Ōsaka · True spot: Tokyo") which NEVER renders in country editions — the shipped, unit-tested behavior is PR #58's detail line ("Your pin: near Tsuruhashi, Osaka · True spot: Tokyo, Tokyo"; the "near" qualifier is unconditional per the honesty rule, locked in reverse-geocode.test.ts + result-card.test.ts). The Japan screenshot also proved the JP chunk works (gold prefecture boundaries rendering). Specs fixed to assert regions + the "near" qualifier (same style as the Italy aborted-chunk test); same fix applied to the Italy classic test in `reveal-your-pin-country-globe.desktop.spec.ts`. PR #58 untouched per the standing directive.
- [~] France test also hit a tile-network stall (map never framed France, tiles stuck "Loading satellite imagery..." — Japan passed the identical flow right after): treated as a flake, one retry queued.
- [x] **REAL BUG FOUND + FIXED (E2E doing its job):** France re-run failed again — not a flake. Root cause: the world-atlas France geometry includes overseas departments (bounds -61.8 to 55.8 lon), so its naive DTO center is [-2.98, 14.86] — the Atlantic. `satellite-map.tsx` overrode DTO bounds with the game box but kept the atlas center, so every France country game framed the Atlantic (pre-existing on main since 5e8cc8d, 2026-09-30). Fixed: center recomputed from the game box whenever provided (`2c698ac`). **Verified: France E2E passes post-fix** (map frames France, pin drops, card names regions). Italy 4/4 green proves the fix is France-specific and correct.
- [~] Full `admin1-narrow.desktop.spec.ts` + `tutorial.spec.ts` (tutorial touches the same map code — regression check) re-run queued on the E2E lock.

## Pending
- [x] Open PR (target main) — **https://github.com/veeresh-bikkaneti/Meridian/pull/66** — NEVER merge; Veeresh merges
- [x] `reveal-your-pin-country-globe.desktop.spec.ts -g "Italy"` — **4/4 green** (Sardinia/Calabria regions, aborted-chunk fallback, ocean pin, hit — no line)
- [x] Full `npm test` — 613/613 green post-main-merge
- [ ] `node scripts/lint-cards.mjs` gate
- [ ] `npm run build:pages` + verify dist chunk layout → SW runtime-caching coverage for `/Meridian/assets/*` chunks (offline = country-lines fallback, never a hang)
- [ ] Real-browser Playwright E2E on the built artifact: France + Japan country editions (classic pin-compare line), Italy classic-path update + aborted-chunk fallback test (PR #58 fail-closed proof), existing reveal specs regression
- [ ] Self-review (code-reviewer + software-architect + SRE): zero blockers
- [ ] Ticket `docs/admin1-gap-ticket.md` §7 checklist update
- [ ] Open PR (target main) — NEVER merge; Veeresh merges

## Rules
- Stage named files only. Push early and often. Never break State/Country/Globe editions — PR #58 Your-pin lines are regression-tested.
- Learning outcomes first. No labels on the map — ever.
- Genuine NE source only; pinned hashes; no build-time network in CI; nothing fetched at runtime.
