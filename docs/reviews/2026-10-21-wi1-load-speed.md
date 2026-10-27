# WI-1 — Load speed on low-end devices (2026-10-21)

Branch `feat/wi1-load-speed`, base `origin/main 4ef6875`.

## What the brief assumed vs. what `main` already has

The work item was written against the pre-#203 numbers. Measured on a fresh
`npm run build:pages` of `main` (`node scripts/bundle-report.mjs`):

| Brief says | `main` today | Why |
| --- | --- | --- |
| `routes-*.js` 2.36 MB raw / ~690 KB brotli, MapLibre inside | `routes-*.js` **410,884 B raw / 128,870 B gzip**; MapLibre is the lazy `assets/maplibre-gl-shared.mjs` (515,924 B) and `imagery-*.js` | PR #203 ("split initial bundle, −64% initial preload transfer") and the earlier boot split (#107) |
| Map screen in the initial chunk | Not in the shell's closure; `src/components/game-app-lazy-boundary.test.ts` fails the build if `LoopMap` or `maplibre-gl` is statically imported by the boot path | same |
| First load is large | Shell requests **888,367 B raw / 279,725 B gzip** of JS (entry + closure) and 115,801 B raw / 22,975 B gzip of CSS | same |
| `names.json` fetched eagerly | Fetched only by the GeoDetective screen (`LoopMap` mount, `GuessInput` focus, loss reveal). Never by Home or the Globe/Country/State game. Still 11.5 MB raw / 3.10 MB gzip | unchanged — **this is the real remaining cost, and what this PR fixes** |
| Globe tier files 4–4.3 MB | Already tier-split (#148); Easy fetches tiers 1–2 only (the 4 MB files are Medium/Hard) | out of scope here |

So acceptance bullet 1 (MapLibre + map lazy) was already true; it is guarded by
the existing lazy-boundary test and I changed nothing there. The remaining work
is the guess index.

## Change

`public/loop/names.json` (array of 119,038 `{n,id,lon,lat,r,p}` objects) is
replaced by `public/loop/names.v2.json`, the same data as parallel columns:
region strings interned (285 distinct), ids as bare numbers, coordinates as
1e-4-degree integers. The runtime decodes it back to the exact `LoopNameEntry`
rows, so ranking (`rankLoopSuggestions`), tap resolution (`place-resolve.ts`),
`GuessInput`, and the engine are untouched.

### ADR — compact columns, not prefix shards

*Context.* The brief offered "prefix-sharded files (or a compact format)".
*Decision.* Compact columns. *Why not shards:* `rankLoopSuggestions` matches
every query word against name + region at word boundaries and as substrings
("york" must find "New York"), and `nearestPlace` needs every entry's
coordinates to resolve a map tap. A shard keyed on the first letters of `n`
would change which suggestions appear and would still need all coordinates on
the map screen. (Same conclusion as `docs/ops/specs/ws-6-names-json.md`.)
*Why "only when search opens" is not done literally:* on the GeoDetective
screen the map tap path and the search box both need the full index, and
`LoopMap` preloads it so the first tap resolves instantly. Home and every other
game mode never request it. Deferring it to first search focus would make early
taps say "loading". Kept as is.
*Consequences.* New module `src/game/loop/names-codec.ts` (pure
`packNameIndex` / `unpackNameIndex`, one responsibility, no I/O); the build
(`scripts/build-loop.mjs`) and `scripts/build-coldtrail.mjs` use it; the
format is versioned (`v: 2`) and the file name carries the version, so a stale
tab can never parse the wrong shape (it gets a 404/HTML, and the existing
"Couldn't load the place list" error path handles it).
*Rollback.* Revert the PR; `names.json` returns from git history. No data
migration, no stored state references the file.

## Numbers (real build, this VM)

`names` file only, bytes:

| | raw | gzip 9 | brotli 5 | brotli 11 | `JSON.parse` (avg of 5, unthrottled) |
| --- | ---: | ---: | ---: | ---: | ---: |
| before `names.json` | 11,487,772 | 3,103,259 | 2,824,537 | 2,194,251 | 104 ms |
| after `names.v2.json` | 5,169,400 | 2,080,688 | 2,038,020 | 1,841,097 | 33 ms |
| change | −55% | −33% | −28% | −16% | −68% |

What this means: the saving on the wire depends on what the host serves
(which compression level the host picks is unknown from here; see the range above). It is 0.35–1.02 MB per
first GeoDetective session; at the harness's Slow 4G (209,715 B/s,
`docs/perf-baseline.md`) that is ≈ 1.7–4.9 s of transfer saved, computed not
measured. The host-independent win is the parse: −68% and a ~55% smaller
string held in memory, which is what a mid-range Android feels. Real-device and
deployed-host numbers were not measured (this VM's proxy blocks the deployed
hosts).

Initial JS/CSS on Home is unchanged by this PR (888,367 B raw / 279,725 B gzip
JS): it never loads this file.

## Evidence of identical results

* One-off, against the old file from `main`: all 119,038 rows decode
  `deepStrictEqual` to the originals (key order included), and 6,456 queries
  (every 7th distinct word of the index, plus names and "name + region" for
  every 97th row) return identical `rankLoopSuggestions(…, 8)` results.
* Permanent: `src/game/loop/names-codec.test.ts` — round-trip, edge cases
  (0/−180/−90 coordinates, 11-digit ids, empty index), refusal to pack
  anything lossy, fail-closed decoding of 14 malformed inputs (including the
  old array form), the shipped file re-packs byte-for-byte, and typeahead is
  identical before/after a pack round trip on the shipped index.

## Offline / PWA

`public/sw.js` never precached `names.json` (11.5 MB is runtime-cached on
first GeoDetective use under the existing `/Meridian/loop/` cache-first rule),
so no precache list changes; only the comments were updated. `loopNamesUrl()`
stays relative to `BASE_URL`, so `/Meridian/` and `/` both work. The
`offline-content` spec's two failures also fail on unmodified `main` (below).

## Tests

See the PR description for the run log.

## Deferred

* Deleting-and-recreating the index from the GeoNames dump was not possible
  here (dump absent); the file was converted losslessly from the committed
  one. `build-loop.mjs` now emits the packed form directly.
* Sharding Globe tiers 3/4 by country (Medium/Hard) — `docs/perf-baseline.md`
  item 3, still not worth it.
