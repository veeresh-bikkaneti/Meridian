# BRANCH_STATUS — feat/wi1-load-speed (WI-1: GeoDetective guess index, packed columns)

**State: READY FOR OWNER REVIEW — not merged.** Owner merges.

Base: `origin/main 1ca4c04` (merged in 2026-10-22, after #218/#207/#222). Full write-up, numbers and ADR:
`docs/reviews/2026-10-21-wi1-load-speed.md`.

## What this does (plain language)

The WI-1 brief's problem statement predates PR #203: MapLibre and the map
screen are already lazy and Home's initial JS is 280 KB gzip. What was still
heavy is the GeoDetective typeahead index, 11.5 MB raw / 3.1 MB gzip. It is now
`public/loop/names.v2.json` (same 119,038 places as parallel columns): 5.2 MB
raw (−55%), −33% gzip, −16% brotli-11, JSON parse 104 → 33 ms. The runtime
decodes it back to the identical rows, so search results and tap resolution
are unchanged.

## Done

- [x] `src/game/loop/names-codec.ts` + 8 unit tests (lossless, fail-closed)
- [x] `evaluate.ts`, `build-loop.mjs`, `build-coldtrail.mjs`, pipeline tests switched
- [x] `public/loop/names.json` removed; `names.v2.json` added (converted losslessly)
- [x] E2E specs read the packed file via `helpers.ts` (`loopNameIndex`, `openMysteryPlaceId`)
- [x] Docs: review entry, `docs/geodetective.md`, `docs/perf-baseline.md`, `sw.js` comments

## Pending / owner

- [ ] Owner merge. After deploy, optionally measure `curl -H 'Accept-Encoding: br' -w '%{size_download}'` on `/loop/names.v2.json` (host blocked from the build VM).
- [ ] A tab open during the deploy that first opens GeoDetective afterwards will request the removed `names.json`, get the "Couldn't load the place list" state, and recover on reload.
- Deferred: regenerate from the GeoNames dump when it is next available (`node scripts/build-loop.mjs`; output format is now packed).
