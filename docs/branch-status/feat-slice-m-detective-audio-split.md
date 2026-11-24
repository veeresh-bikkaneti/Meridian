# feat/slice-m-detective-audio-split

## Capsule

Issue #377. The detective speech player no longer fetches the 1,938,757
byte `public/audio/detective/manifest.json` on the first line. A
generator writes per-case shards plus a 2,121 byte index. The monolith
stays the hash record and the fallback. ADR-0002 records the decision.

## Base

Branched from `origin/main` `37a9b5c4699b387b831b49becec65beaad930f00`.

## Done

- ADR: `docs/adr/0002-detective-audio-manifest-split.md`.
- Generator: `scripts/detective/split-audio-manifest.mjs` (also
  `npm run split:detective-audio`). Shards under
  `public/audio/detective/split/`.
- Loader: `loadDetectiveManifestFor` in
  `src/game/loop/detective/detective-audio.ts`. Fixed lines, including
  the summary celebration, use the index. A 404 shard is silence. Any
  other shard failure loads the monolith once.
- Gate: `check-audio-manifest.mjs` fails if shards drift. Render runs
  rewrite the shards after the monolith.

## Sizes (raw / gzip level 9)

| Fetch | Before | After |
|---|---:|---:|
| First clue (whole manifest, or index + largest case) | 1,938,757 / 408,181 | 2,525 / index 426 + case ~132 |
| Names, first spoken place only | included above | 96,028 / 9,493 |

## Next

None on this slice. Names stay one file until that fetch itself hurts.

## Open questions

- Whether a later pack should also shard names. ADR follow-up 1. Not
  this slice: names are not deck-scoped.

## Ruled out

- One file per deck. Core is already most of the case bytes, so the
  first clue of "All cases" would stay large. Per-case is the smaller
  first fetch and still stops a new deck from growing the others.
- Deleting the monolith. The hash gate and old clients need it.

## Graph

- Add node `adr-0002-detective-audio-manifest-split` at
  `docs/adr/0002-detective-audio-manifest-split.md`.
- Edge: that node `documents` the detective audio manifest
  (`public/audio/detective/manifest.json`).
- Do not edit `docs/knowledge/graph.json` on this branch.
