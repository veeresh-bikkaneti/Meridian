# Observability receiver — Cloudflare Worker (v1)

Receives the events emitted by `src/lib/observability.ts` (schema:
`docs/observability.md`) and logs each one as a single structured JSON
line. **This worker is NOT deployed by the client branch** — deploying it
is a separate, explicit step for the owner (Veeresh).

> **Production reality (2026-10-17):** the live receiver is the crash-report
> worker in `workers/crash-report/` — `public/flags.json` on main sets
> `observabilityEndpoint` to
> `https://meridian-crash-report.knowledgetest.workers.dev/ingest`. This v1
> logging-only receiver is the older sibling, kept for reference.

The client event types the pipeline carries today include `tile_failed`
(see `EVENT_TYPES` in `workers/crash-report/src/index.ts` for the full
list of 7).

## Files

- `worker.js` — zero-dependency Worker. `handleRequest(request, log?)` is
  exported pure for tests; the default export wires it as `fetch`.
- `worker.test.mjs` — unit tests: `npm run test:worker` (from repo root).
- `wrangler.toml.example` — copy to `wrangler.toml`, fill in your own
  account values (none are committed here).

## Deploy (manual, when approved)

This v1 worker is **not deployed** — the live receiver is
`workers/crash-report/` (see "Production reality" above), and this
directory is kept for reference. An earlier version of this block
prescribed `npx wrangler deploy`; that was wrong — this project's
workers have only ever been released by **direct API script upload**
(the `cf.py` helper flow; see the Deploy section of
`workers/crash-report/README.md`), never by `wrangler deploy`. If
this worker were ever revived, it would ship the same way:
`worker.js` is plain zero-dependency JavaScript (no bundle step), so
it uploads as-is through the Workers scripts API, then:

```sh
curl https://<your-worker-host>/health   # → {"ok":true}
```

Then set the endpoint in the site's `public/flags.json` (top-level field,
NOT inside `flags`) and redeploy the site (flags only — no code release):

```json
{ "flags": { "learningOutcomes": true, "pwaUpdateToast": true }, "version": 1,
  "observabilityEndpoint": "https://<your-worker-host>/ingest" }
```

Until that field is set, the client transport is a complete no-op. (In
production the field IS set — see the note at the top — so the transport
is live there.)

## Reading the logs

Run from this directory, naming this worker's own config
explicitly (after the one-time copy in Files, above):

```sh
npx wrangler tail -c wrangler.toml --format json
```

Never run a bare `npx wrangler tail` here: since PR #232 the
repo root carries a `wrangler.jsonc`, and wrangler's config
search walks up the tree with filename priority over directory
proximity — a bare command would attach to the main `meridian`
worker instead of this receiver. (Mitigants, for the record:
this receiver is undeployed/reference-only today, and `tail` is
read-only — the explicit `-c` is about reading the right
worker's logs, not about preventing damage.)

Each accepted event logs one line like:

```json
{"kind":"meridian-observability","receivedAt":"…","type":"suspected_crash",
 "buildId":"650065e95f01","edition":"globe","regionId":"globe",
 "lastMilestone":"data_chunk_load_start","iosVersion":"16.4.1","event":{…}}
```

### Count events by buildId × edition × iOS version

With `wrangler tail` output (or dashboard log exports) saved to
`events.ndjson` (one log line per event, as above):

```sh
jq -r 'select(.kind=="meridian-observability")
       | [.type, .buildId, (.edition // "-"), (.iosVersion // "-")] | @tsv' events.ndjson \
  | sort | uniq -c | sort -rn
```

The crash funnel is `type == "suspected_crash"` grouped by
`lastMilestone`: the milestone is where the previous session's trail
stopped — e.g. a spike at `data_chunk_load_start` for `edition=globe`
confirms deaths during chunk load, while `map_init_start` points at the
map/WebGL stage.

## Upgrade path (when log volume outgrows tail)

The handler's `log(...)` call is the only storage seam:

1. **D1**: add a binding, `INSERT` the validated event columns
   (type, ts, buildId, edition, regionId, lastMilestone, iosVersion,
   raw JSON) in place of / alongside the log line; counts become SQL
   `GROUP BY build_id, edition, ios_version`.
2. **KV**: counters keyed `count:<type>:<buildId>:<edition>:<iosVersion>`
   with `INCR`-style read-modify-write per event (fine at game scale).
3. **Analytics Engine**: `writeDataPoint({ blobs: [type, buildId,
   edition, iosVersion, lastMilestone], doubles: [1] })` — purpose-built
   for exactly this counting shape and queryable via its SQL API.

Keep validation (`validateEvent`) in front of any store: it is the
schema contract shared with the client.
