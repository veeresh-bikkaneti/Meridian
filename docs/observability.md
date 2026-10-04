# Observability — crash breadcrumbs & next-boot detection

Meridian's worst field failure (iPhone Safari, 2026-10-03/04) is the page
being killed outright — no JS error, no console line, nothing to report.
This system makes the next field report self-identifying.

## How detection works (read this first)

A jetsam / WebKit process kill **cannot beacon during the kill**: the
process is gone before any code can run, `pagehide` never fires, and no
fetch survives. Detection is therefore by **asymmetry at next boot**:

1. While alive, the page maintains a **breadcrumb trail** in
   `sessionStorage` (`meridian.breadcrumb`): an anonymous per-tab session
   id, the build id, coarse device facts, and a capped history (last 12)
   of **milestones** — `boot_start → boot_ready → run_start →
   data_chunk_load_start → data_loaded → map_init_start → map_ready →
   game_loaded` — plus the current edition/region/chunk where known.
2. The pre-existing clean-exit flag (`meridian.cleanExit`, see
   `src/game/clean-exit.ts`) is `"0"` whenever a run was started but
   the page never unloaded. The flag is stamped dirty **at run start,
   before the data-chunk load** (`openRun` calls
   `stampCleanExitDirty()` right at `run_start`, ahead of
   `await placesFor(...)`; `writeRun` re-stamps it at commit), so the
   covered kill windows are the **chunk load, map init, and gameplay**
   — including a first-run kill during the 13.7 MB Globe chunk load,
   which leaves no saved run behind (the crash-loop breaker clearing
   the absent run and landing on the menu is harmless there).
3. On the next boot, **before** the trail is overwritten and before the
   crash-loop breaker consumes the flag, `initObservability()`
   (`src/lib/observability.ts`) checks: unclean flag **and** a previous
   breadcrumb → emit **one** `suspected_crash` event carrying the
   previous trail, then immediately rotate/clear the previous trail.
   Rotation happens even if transport fails, so the event can never
   fire twice. Delivery itself is **at-most-once** — see Transport &
   configuration below.

The previous trail's `lastMilestone` is the funnel answer: if trails stop
at `data_chunk_load_start` for Globe, sessions die loading the 13.7 MB
chunk; if they stop at `map_init_start`, they die constructing the map.

## Event schema

Every event is one JSON object, hard-capped at **4096 bytes** on the
client (cap sequence: serialize → trim the breadcrumb history to its
last 4 entries → drop the history entirely → drop breadcrumb + device
→ progressively truncate string fields, limits 120/60/24 with the
error name/message also cut → core-only fallback of type/ts/buildId)
and rejected by the receiver above 8 KB.

| Field | Type | Notes |
|---|---|---|
| `type` | enum | See event types below. Required. |
| `ts` | number | Epoch ms when the emitting boot/code ran. Required. |
| `buildId` | string ≤64 | Bundle build (`CURRENT_BUILD_ID`). Required. |
| `sessionId` | string ≤64 | Anonymous random id per tab session. For `suspected_crash`: the **previous** session's id. |
| `edition` / `regionId` / `chunkId` | string ≤128 | Where known. For `suspected_crash`: the previous session's. |
| `lastMilestone` | string ≤128 | Last milestone of the relevant trail. |
| `device` | object | `ua` (≤300 chars), `dpr`, `screenW`, `screenH`, `deviceMemory?`, `hardwareConcurrency?` — coarse facts only. |
| `breadcrumb` | object | `suspected_crash` only: the full previous trail (sessionId, buildId, startedAt, lastMilestone, history ≤12, edition/regionId/chunkId, device). |
| `error` | object | Live error events only: `name` (≤80) + `message` (≤300, truncated). **No stack traces.** |

### Event types

| Type | When |
|---|---|
| `suspected_crash` | Next boot after an unclean shutdown with a previous breadcrumb (above). |
| `js_error` | `window` error event (installed once, guarded). |
| `unhandled_rejection` | `unhandledrejection` event. |
| `map_error` | `MapErrorBoundary.componentDidCatch`. |
| `webgl_context_lost` | `webglcontextlost` on the MapLibre canvas. |

## Privacy statement

Events contain **no PII, no precise location, no guess/place content, no
coordinates, no stack traces, no user identifiers** — the session id is a
random per-tab value that dies with the tab. Error payloads are name +
message truncated to 300 chars. Device facts are the coarse class of the
device (UA string, pixel ratio, screen size, core/memory counts where
the browser exposes them). Nothing is sent at all until an endpoint is
explicitly configured (below).

## Transport & configuration

- `emit()` is a **complete network no-op** (returns `false`, no
  fetch/beacon) when no endpoint is configured — the shipped default.
- When set: `navigator.sendBeacon` first; on `false`/absent, fallback to
  `fetch(POST, keepalive: true, content-type: application/json)`,
  failures swallowed.
- Boot ordering: flags load asynchronously, so boot events (including
  `suspected_crash`) **queue in memory** and flush when `loadFlags()`
  resolves and the endpoint is applied. Delivery is **at-most-once**:
  a queued event lives only in memory until that flush (bounded by
  the flags load/timeout); if the tab is closed or killed again in
  that window, the report is lost and will not re-fire — the previous
  trail was already rotated at boot. With no endpoint configured the
  queue is never sent. The bounded queue (20) evicts the oldest
  non-`suspected_crash` event first, so a burst of live error events
  cannot silently evict a queued crash report.
- Endpoint config lives in `public/flags.json` as a **top-level**
  `observabilityEndpoint` field (validated in `src/lib/flags.ts`:
  https URL or root-relative path only; anything else fails closed to
  null). The shipped `flags.json` sets **no** endpoint, so production
  behavior is unchanged until it is set.

## How to enable

1. Deploy the receiver: see `worker/observability/README.md`
   (`wrangler deploy` — a separate, explicit step; nothing in this
   system deploys itself).
2. Add `"observabilityEndpoint": "https://<worker-host>/ingest"` at the
   top level of `public/flags.json`.
3. Redeploy the site (flags only — no client code release needed).

## How to read counts / the funnel

The receiver (v1) logs one structured JSON line per event (`wrangler
tail` / dashboard logs), enriched with a UA-derived `iosVersion`. Count
by buildId × edition × iOS version, and read the `suspected_crash`
funnel by `lastMilestone` — full commands in
`worker/observability/README.md`. The upgrade path (D1 / KV /
Analytics Engine) is documented there too.

## Secondary mitigation in the same branch

On coarse-pointer (touch) devices the MapLibre canvas pixel ratio is
capped at **1.5** and `maxTileCacheSize` is set explicitly to **64**
(`src/map/map-options.ts`, wired in `src/map/satellite-map.tsx`) —
full-DPR WebGL buffers are part of the same jetsam budget.

## Documented follow-up — NOT in this branch

**Split the Globe dataset.** The Globe chunk is a single ~13.7 MB JS
module holding 59,423 places; paging it by country/continent box and
fetching it as JSON remains the highest-impact payload fix and is
deliberately a separate change — this branch only makes its cost
measurable in the field.
