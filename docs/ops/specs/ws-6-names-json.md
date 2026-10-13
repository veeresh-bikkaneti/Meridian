# names.json (GeoDetective typeahead index) — measurements and proposal

Report only. Nothing was implemented (see "why not implemented").

## Measured
Source: `public/loop/names.json` as built (same file in `dist/client/loop/`):
119,038 entries `{n,id,lon,lat,r,p}`, 11,487,772 bytes raw.

Command: `node` one-off (zlib gzip at level 6 and 9; brotli quality 5 and 11, 16 MiB window),
size of the output in bytes:

| encoding | level | bytes |
| --- | --- | ---: |
| gzip | 6 | 3,174,341 |
| gzip | 9 | 3,103,259 |
| brotli | 5 | 2,824,537 |
| brotli | 11 | 2,194,251 |

**Not measured: what GitHub Pages and the Cloudflare Worker actually serve.** The
sandbox's egress proxy answers `403` to both `veeresh-bikkaneti.github.io` and
`meridian.knowledgetest.workers.dev`, so I could not read their real
`content-encoding` / transfer sizes. The table is the range a host could land in
(gzip 6 ≈ 3.17 MB up to brotli 11 ≈ 2.19 MB; which one each host picks is unknown). To get the real numbers, allow those two hosts and run:
`curl -sS -o /dev/null -H 'Accept-Encoding: br' -w '%{size_download} %{http_code}\n' <url>/loop/names.json`
(and again with `gzip`), plus `-D -` for the `content-encoding` header.

Arithmetic at the harness's Slow 4G (209,715 B/s, from `docs/perf-baseline.md`): 3,174,341 B ≈ 15.1 s
of transfer for the first typed guess, before JSON.parse + the per-entry shape check + grid build
(`fetchLoopIndex`, `buildPlaceGrid`). These are computed, not browser-measured.

## What is in the bytes
`id` (`"geonames:" + digits`), `lon`/`lat` (4 decimals), and population are high-entropy digits;
`r` ("New York, United States") repeats 285 distinct strings 119k times; `n` is the name.

## Option considered and rejected: prefix-split index
Sharding by the first letters of `n` would load a small shard for the first keystrokes.
But `GuessInput` ranks "every query word against name + region", including word-boundary and
substring matches ("york" must find "New York"), and `nearestPlace` needs every entry's
coordinates for tap resolution. A prefix shard changes which suggestions appear — a behaviour change
that fails the "place-resolve behaviour unchanged" condition. Rejected.

## Proposal: lossless columnar encoding with a region table
Same data, structure-of-arrays, region strings interned, numeric GeoNames id:
`{n:[…], id:[…], lon:[…], lat:[…], r:[idx…], p:[…], regions:[…285]}`.
Decoded back into the existing `LoopNameEntry[]` inside `fetchLoopIndex`, so
`place-resolve.ts`, `guess-input.tsx` and the engine are untouched.

| | raw | gzip 6 | gzip 9 | brotli 5 | brotli 11 |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 11,487,772 | 3,174,341 | 3,103,259 | 2,824,537 | 2,194,251 |
| columnar | 5,446,843 | 2,131,176 | 2,126,703 | 2,068,010 | 1,908,536 |
| change | −53% | −33% | −31% | −27% | −13% |

`JSON.parse` of the raw text on this VM (not throttled, another test suite was running):
154 ms → 34 ms (average of 5). At Slow 4G that is ≈15.1 s → ≈10.2 s of transfer (arithmetic).
Honest limit: if the host already serves brotli 11 the gain shrinks to 13% on the wire; the
bigger, host-independent win is parse + memory.

## Why not implemented
It needs the emitter (`scripts/build-loop.mjs`) and the decoder (`evaluate.ts`) to change, and
`scripts/build-loop.test.mjs` reads `names.json` as an array of objects — those tests would have to
change, which the brief rules out for this task (and the change is >100 lines with tests).
If the owner approves, the change is: emit columnar JSON from `build-loop.mjs`, add `decodeNameIndex()`
in `evaluate.ts` (+ keep `isLoopNameEntry` validation on the decoded rows), update the
build-loop tests to assert the decoded entries equal today's.
