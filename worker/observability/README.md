# Observability receiver — Cloudflare Worker (v1)

Receives the events emitted by `src/lib/observability.ts` (schema:
`docs/observability.md`) and logs each one as a single structured JSON
line. **This worker is NOT deployed by the client branch** — deploying it
is a separate, explicit step for Liz/Veeresh.

## Files

- `worker.js` — zero-dependency Worker. `handleRequest(request, log?)` is
  exported pure for tests; the default export wires it as `fetch`.
- `worker.test.mjs` — unit tests: `npm run test:worker` (from repo root).
- `wrangler.toml.example` — copy to `wrangler.toml`, fill in your own
  account values (none are committed here).

## Deploy (manual, when approved)

```sh
cd worker/observability
cp wrangler.toml.example wrangler.toml   # edit: name / route or workers.dev subdomain
npx wrangler deploy
curl https://<your-worker-host>/health   # → {"ok":true}
```

Then set the endpoint in the site's `public/flags.json` (top-level field,
NOT inside `flags`) and redeploy the site (flags only — no code release):

```json
{ "flags": { "learningOutcomes": true, "pwaUpdateToast": true }, "version": 1,
  "observabilityEndpoint": "https://<your-worker-host>/ingest" }
```

Until that field is set, the client transport is a complete no-op.

## Reading the logs

```sh
npx wrangler tail --format json
```

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
