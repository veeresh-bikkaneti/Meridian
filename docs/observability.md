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
   — including a first-run kill during the globe data load, which
   leaves no saved run behind (the crash-loop breaker clearing the
   absent run and landing on the menu is harmless there). (Pre-tier-split
   this was the single ~13.7 MB globe chunk; today production ships
   per-tier files — see the follow-up note below.)
3. On the next boot, **before** the trail is overwritten and before the
   crash-loop breaker consumes the flag, `initObservability()`
   (`src/lib/observability.ts`) checks: unclean flag **and** a previous
   breadcrumb → emit **one** `suspected_crash` event carrying the
   previous trail, then immediately rotate/clear the previous trail.
   Rotation happens even if transport fails, so the event can never
   fire twice. Delivery itself is **at-most-once** — see Transport &
   configuration below.

The previous trail's `lastMilestone` is the funnel answer: if trails stop
at `data_chunk_load_start` for Globe, sessions die loading the globe
data. (Pre-tier-split this was the single ~13.7 MB chunk; with
`globeTierSplit` ON, production loads per-tier files — the Easy path is
≈456 KB on the wire.) If they stop at `map_init_start`, they die
constructing the map.

## Event schema

Every event is one JSON object, hard-capped at **4096 bytes** on the
client. When an event is too big, the client trims it in a fixed
order that keeps the fields crash triage needs most: breadcrumb
history shrinks to its last 4 entries, then drops entirely; the
nested breadcrumb then shrinks to a small stub (session id, build id,
start time, last milestone, map mode); the error message is cut to
140, then 60 chars; the stub drops; long strings are cut at 120/60/24;
the lowest-value device fields (`locale`, then `connection`, then
`browserVersion`) drop last; and the final fallback is a core-only
event of type/ts/buildId. The receiver rejects bodies above 8 KB.

| Field | Type | Notes |
|---|---|---|
| `type` | enum | See event types below. Required. |
| `ts` | number | Epoch ms when the emitting boot/code ran. Required. |
| `buildId` | string ≤64 | Bundle build (`CURRENT_BUILD_ID`). Required. |
| `sessionId` | string ≤64 | Anonymous random id per tab session. For `suspected_crash`: the **previous** session's id. Never counted, rendered, or stored by the worker. |
| `edition` / `regionId` / `chunkId` | string ≤128 | Where known. For `suspected_crash`: the previous session's. |
| `breadcrumb` | object | `suspected_crash` only: the previous trail (sessionId, buildId, startedAt, lastMilestone, history ≤12, edition/regionId/chunkId, and the parsed runtime snapshot — never a raw UA string). |
| `error` | object | Live error events only: `name` (≤80) + `message` (≤300, truncated). **No stack traces.** |

### The device field set — the manifest

The `device` object and the extra top-level fields on crash-class
events are a **fixed set**, named in one place:
`src/lib/telemetry-manifest.ts`. The worker carries the mirror list
(`DEVICE_FIELD_ALLOWLIST` in `workers/crash-report/src/index.ts`) and
strips any device key that is not on it. A test
(`scripts/observability-field-parity.test.mjs`) fails if the two lists
drift apart. Adding a field means adding one manifest row, one
allowlist row, one test-fixture row, and — for a device field — one
entry in the literal `DEVICE_FIELD_KEYS` array in
`src/lib/telemetry-manifest.ts` — nothing else may sneak in.

**"Unknown is a value."** Every field below is present on every
crash-class event. If the browser does not expose a value, or the
user-agent string cannot be parsed, the field carries the literal
`"unknown"` — the key is never simply missing. That matters because
`"unknown"` is itself information: for example, memory reads as
`"unknown"` on every WebKit browser, so an `"unknown"` memory value
identifies exactly the population of devices that can die from the
browser's own memory limits.

**Provenance** says where a value came from: `parsed` = read out of
the user-agent string by a fixed set of rules · `read` = read
directly from a browser API · `inferred` = worked out by a rule, with
`"unknown"` as the escape when the rule cannot fire · `heuristic` = a
best guess from several signals, never presented as fact · `state` =
recorded by the session itself while it was alive · `derived` =
worked out from other stamped fields.

| Field | Where it rides | Values | Provenance |
|---|---|---|---|
| `browser` | `device` | `safari` \| `chrome` \| `edge` \| `firefox` \| `samsung` \| `unknown` | parsed |
| `browserVersion` | `device` | `"<major>.<minor>"` or `"unknown"` | parsed |
| `engine` | `device` | `webkit` \| `blink` \| `gecko` \| `unknown` | inferred |
| `os` | `device` | `ios` \| `android` \| `windows` \| `mac` \| `linux` \| `other` | parsed |
| `osVersion` | `device` | dotted version, `"10.0"` for Windows, or `"unknown"` | parsed |
| `deviceClass` | `device` | `phone` \| `tablet` \| `desktop` \| `unknown` — the class only, never a model name | heuristic |
| `hardwareConcurrency` | `device` | integer 1–64 or `"unknown"`, as the browser reports it | read |
| `deviceMemory` | `device` | memory in GB as the browser reports it, or `"unknown"` | read |
| `screen` | `device` | `sm` \| `md` \| `lg` \| `xl` \| `unknown` — a size bucket, never exact pixels | read |
| `dpr` | `device` | integer 1–4 — a rounded density bucket | read |
| `touchPoints` | `device` | `"0"` \| `"1"` \| `"2-5"` \| `"6+"` \| `"unknown"` | read |
| `displayMode` | `device` | `standalone` \| `browser` \| `unknown` | read |
| `connection` | `device` | `slow-2g` \| `2g` \| `3g` \| `4g` \| `unknown` | read |
| `locale` | `device` | the primary language tag (e.g. `"en-US"`, at most 12 chars) or `"unknown"` | read |
| `form` | `device` | `mobile` \| `desktop` — kept because older counts and alerts use it; now derived from `deviceClass` | derived |
| `webgl1` / `webgl2` | `device` | true/false — sent by the boot watchdog only, never by the app | read |
| `mapMode` | top-level | `full` \| `scout` \| `unknown` — the mode the crashed session was actually running | state |
| `lastMilestone` | top-level | the last step the session reached (see the funnel below) | state |
| `msSinceBootStart` | top-level | milliseconds from boot start to the last recorded step, or `"unknown"` | derived |
| `unfinishedBoots` | top-level | integer 0–99: how many boots in a row ended without a clean exit | state |
| `deviceSource` | top-level | `crashed_session` \| `detecting_boot` \| `live` — whose device facts these are | state |

Two honesty notes that go with the table:

- **Frozen version tokens are never stamped as if they were real.**
  Browsers deliberately freeze some version numbers in the
  user-agent string (every modern Mac reports the same old macOS
  version; reduced Android strings report a frozen Android "10").
  When the parser sees a frozen token it stamps `"unknown"` instead
  of printing a number that looks precise and means nothing. On
  Chromium browsers the minor part of `browserVersion` is always the
  frozen `0`; only the major number is real, and grouping never uses
  the minor.
- **Core counts are stamped as reported.** WebKit limits the
  `hardwareConcurrency` value it reports, so core counts are only
  ever compared within one engine — never ranked across engines.
  The alert prints them with the words "(as reported)".

Crash-class events (`suspected_crash`, `boot_failure`,
`recovery_outcome`, `js_error`, `unhandled_rejection`, `map_error`)
carry the full device object. Hiccup events (`tile_failed`,
`webgl_context_lost`) carry it too. The engagement types
(`storyteller_shown`, `narration_*`) stamp only the older coarse
fields (`os`/`form`/`dpr`/`screen`) — they are not crash triage, so
their device surface does not grow.

### Event types

| Type | When |
|---|---|
| `suspected_crash` | Next boot after an unclean shutdown with a previous breadcrumb (above). |
| `boot_failure` | The crash watchdog's fallback fired: the app never signalled ready, so the boot is treated as failed. (One exception: a stalled chunk-recovery reload never files this — see "When the boot watchdog stands down" below.) |
| `recovery_outcome` | A chunk-recovery attempt from a previous session resolved, one way or the other. |
| `js_error` | `window` error event (installed once, guarded). |
| `unhandled_rejection` | `unhandledrejection` event. |
| `map_error` | `MapErrorBoundary.componentDidCatch`. |
| `tile_failed` | A map tile failed to load (hiccup-class: counted, not forwarded on its own). |
| `webgl_context_lost` | `webglcontextlost` on the MapLibre canvas. |
| `recovery_outcome` | A chunk-recovery attempt resolved (Slice 2): the app reports whether the self-reload worked (`confirmed`), failed again (`repeat_failure` — the only outcome forwarded on its own), stood down, or was never confirmed. |
| `storyteller_shown` | The storyteller caption appeared (funnel-class: counted, not forwarded on its own). |
| `narration_started` | Narration audio started playing. |
| `narration_completed` | Narration audio played to the end. |
| `narration_replayed` | The player tapped the replay button. |
| `narration_failed` | Narration audio failed to play (the card falls back to silent text). A spike here is the field signal that storyteller audio is broken. |
| `narration_dismissed` | The caption was dismissed — tapped away, or the screen exited mid-play. |

These 14 are the full set: the client event type
(`ObservabilityEventType` in `src/lib/observability.ts`) and the
crash-report worker's accepted list (`EVENT_TYPES` in
`workers/crash-report/src/index.ts`) are the same 14, and a drift test
(`scripts/observability-event-types.test.mjs`, in `npm test`) fails if
they ever disagree again. Every type is sent to the worker when an
endpoint is configured — there are no client-side-only types.

> **History — read this before trusting an older copy of this page:**
> the six storyteller/narration types were emitted from #108 (Oct
> 2026) on, but the worker did not accept them until #194 wave 2
> (this PR, #311), so every one was answered 400 and silently dropped.
> An earlier version of this page called them "client-side only and
> not sent to the worker" — that was wrong; they were always sent.
> They are funnel telemetry, so the worker counts them like
> hiccup-class events instead of forwarding each one as an alert.

## Privacy statement

Events contain **no PII, no precise location, no guess/place content, no
coordinates, no stack traces, no user identifiers** — the session id is a
random per-tab value that dies with the tab, and the worker never
counts, prints, or stores it. Error payloads are name +
message truncated to 300 chars. Device facts are the fixed, coarse
field set in the manifest table above — nothing outside that list is
collected, and the worker deletes any device key that is not on the
list when an event arrives. Two values in that set are reported as the
browser gives them: memory (`deviceMemory`) and core count
(`hardwareConcurrency`), each as a whole-session value on the event
that carries it, never combined with any stored or per-device record —
the worker stores counts only, so there is no per-device record to
combine them with. Where a browser does not expose them, they read
`"unknown"`. The raw browser (UA) string never leaves the device, is
no longer stored on the device by the telemetry code at all, and is
deleted on arrival by the receiving worker if an older client still
sends one. No exact screen size, no GPU strings, and no location
finer than edition/region are ever carried. Nothing is sent at all
until an endpoint is explicitly configured (below).

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
  a root-relative path, or an https URL whose host is in
  `OBSERVABILITY_INGEST_HOSTS`, which lists only the crash-report worker
  (review S3, 2026-10-21). Anything else fails closed to null. The inline
  boot watchdog (`scripts/crash-watchdog.mjs`) and `scripts/crash-smoke.mjs`
  apply the same pin, and a drift test keeps the lists equal). The shipped `flags.json` on main sets this to the live
  crash-report worker
  (`https://meridian-crash-report.knowledgetest.workers.dev/ingest`), so
  production sends events today.

## When the boot watchdog stands down

The inline boot watchdog (`scripts/crash-watchdog.mjs`) exists for one
job: a page whose app bundle never runs. It arms a single 28-second
timer, and if the app has not signalled readiness
(`window.__meridian_ready`) when the timer fires, it shows its fallback
card and files one `boot_failure`. Four situations can look alike from
the timer's seat; they are handled differently, on purpose:

| What happened | What the player sees | What is filed |
|---|---|---|
| A deploy replaced the assets mid-session (version skew) | The app's own "A new version of Meridian is available." offer with a Refresh button | No `boot_failure` — the watchdog treats that offer's text as a stand-down signal, and readiness is set anyway |
| A chunk fails mid-session, nothing else wrong | The error boundary's recoverable card ("Couldn’t load GeoDetective." and friends), then chunk-recovery's one bounded auto-reload | No `boot_failure` — the session already booted |
| That auto-reload itself stalls (assets still failing, network still down) | The watchdog's recovery card — "The reload didn't finish loading." with the same Try again button — never a blank screen, and never the "couldn't start" claim (the game *did* start; this session reached home before the reload) | No `boot_failure` — the report stands down, the player does not; see the proof below |
| A fresh boot stalls (the bundle never loads on a first visit) | The watchdog's fallback card ("The game couldn't start on this phone.") | One `boot_failure` — this is the case the watchdog exists for |

The third row is the subtle one. How does the watchdog know a stalled
page is a *recovery reload* and not a fresh boot? Before any
chunk-recovery reload — the automatic one, and the error card's manual
"Try again" — the app writes a timestamp to session storage under the
key `meridian.chunkReloadNotice`. In practice, only code inside an app
that already booted and reached home writes that key. A healthy reload
consumes (removes) the notice as it boots; so if a *fresh* notice (at
most 15 minutes old — `CHUNK_RELOAD_NOTICE_MAX_AGE_MS` in
`src/lib/chunk-recovery.ts`, mirrored by the watchdog) is still there
when the 28-second timer fires and readiness was never signalled, this
page load is, in practice, the recovery reload, stalled. "In practice"
is the honest phrase: the notice's removal at consume time is
best-effort, so a flag can survive a healthy boot in rare cases — a
surviving fresh flag is strong evidence, not proof. That residual is
accepted: the worst it costs is one recovery card shown (with no
report) on a page that might have been a fresh stall. The report
stands down; the player never does — the watchdog shows its recovery
card instead of the generic boot-failure card, because leaving a
child on a blank shell (possibly in the standalone PWA, which has no
browser reload button) is worse than showing a card that says, truly,
that the reload didn't finish. A notice that is missing, unreadable,
or older than 15 minutes proves nothing, and the watchdog behaves
exactly as it always did — when in doubt, it shows the generic
fallback and files the report.

Pinned by `scripts/crash-watchdog.test.mjs` (a fresh notice gets the
recovery card and no report; stale and malformed notices keep the
generic card and the report) and by the "stalled chunk-recovery
reload" case in `tests/e2e/crash-watchdog.spec.ts`, which drives the
real two-page sequence end to end.

## How to enable — already live in production (2026-10)

The receiver is deployed and `public/flags.json` on main points
`observabilityEndpoint` at the crash-report worker's `/ingest`; the
worker's Discord webhook forwarding is live. The steps below are the
procedure that was run:

1. Deploy the receiver: see `workers/crash-report/README.md` (a
   separate, explicit step; nothing in this system deploys itself).
2. Add `"observabilityEndpoint": "https://<worker-host>/ingest"` at the
   top level of `public/flags.json`. A new worker host must ALSO be added
   to `OBSERVABILITY_INGEST_HOSTS` (src/lib/flags.ts and
   scripts/crash-watchdog.mjs) and to the CSP `connect-src`. Otherwise
   the client refuses it.
3. Redeploy the site (flags only — no client code release needed).

> **Deploy method — resolved (API-verified 2026-10-21):** the crash
> receiver has only ever been deployed via manual API upload
> (`version_upload` — every deployment in the Cloudflare API history
> is `source: api`, `triggered_by: upload`). `wrangler deploy` was
> never the mechanism; the older doc descriptions prescribing it were
> wrong. Bindings ride WITH the version upload: a version that must
> carry the `DISCORD_WEBHOOK_URL` secret or the `TELEMETRY_COUNTS` KV
> binding gets them in its upload metadata. Naming a secret without a
> value is rejected (error 10021) and a script-level secret PUT is
> blocked (error 10215), so there is no "upload first, set the secret
> afterwards" step. Versions and deployments are managed with the ops
> helper `cf-version.py` (verbs: `list`, `get`, `deployments`,
> `deploy`), which lives outside this repo, in the crash-report
> watchdog goal's files. Telemetry Phase 1 went live this way on
> 2026-10-21: the live version carries the webhook as a secret binding
> in the upload, plus the KV binding.

## How to read a crash alert

Crash-class events are forwarded to Discord (and email, when set up)
as soon as they arrive. Here is one real alert shape, for a phone
that died while its map was loading — the issue #330 shape, with
`cores 6` in the worked example taken from a worker test fixture,
not a handset measurement — with each line explained in plain
words:

```text
🚨 FIX — Developer action needed
Meridian crash report
priority: S1 · P1 — current build, foreground kill at map loading, phone-class iOS 16
verdict: developer action needed
why: App stopped mid-game on the current build; no error was captured, so the cause is unknown. Severity: S1 — 3 unfinished boots in a row with no clean boot since; the player most likely left and never got back in (player-left is INFERRED from the missing clean boot, not observed).
why-code: fg_kill_current
action: Read the error below.
type: suspected_crash · build: c6853be
time: 2026-11-03T17:42:00.000Z
device: ios/mobile · phone · Safari 16.4 · WebKit · iOS 16.4.1 (UA-parsed)
runtime: mem unknown · cores 6 (as reported) · screen md · dpr 2 · touch 2-5 · standalone unknown · net unknown · locale en-US
edition: state · region: nebraska
mode: scout · last step: map loading · 4,210 ms after boot start
boots: 3 unfinished in a row
error: none captured
```

How to read it, top to bottom:

1. **The first line is the headline.** 🚨 FIX means a person needs
   to act. ❔ WAIT means the report itself is missing evidence, so
   nobody can tell yet whether it matters.
2. **`priority:` is the sort order, led by the severity grade
   (issue #345).** The first code is the grade — **S1** is the
   worst: a developer problem after 3 or more unfinished boots in a
   row, which most likely means the player left and never got back
   in (player-left is INFERRED from the missing clean boot, not
   observed). **S2a** means it recovered, but only after such a streak;
   **S2b** is a developer problem without the repeat evidence;
   **S3** fixed itself. Reports whose verdict is "can't tell" or
   "not a real problem" carry no grade — the line starts
   `ungraded ·` instead. After the grade comes the P-code: P1 is
   the most urgent — the current build, a real crash, during
   gameplay. P2 is a developer problem of any other shape, or a
   failed recovery. P3 means the evidence was incomplete — a
   reporting problem, not proof that players are affected. P4
   means the report turned out to be harmless or already fixed.
   The words after the codes say which facts earned them.
3. **`verdict:` and `why:` say what the worker concluded, in plain
   words.** `why-code:` is the same conclusion as a short code
   (`fg_kill_current` = the app was killed in the foreground on the
   current build). Keep the code when filing a follow-up; it is how
   the next person finds this exact case again. When the report is
   graded, the `why:` line ends with one `Severity: …` sentence
   carrying the grade's evidence — the boot streak, or the fact
   that no streak was stamped. The S1 sentence labels the
   player-left reading **INFERRED**: nobody saw the player leave;
   the missing clean boot is the evidence, and the sentence says
   exactly that.
4. **If the verdict is "can't tell", one extra line appears:**
   `evidence: bgTerminal ✗ · buildReplaced ✓ · trailStuck ✓ · lcV ✓`.
   It names, one by one, the four facts the classifier needed and
   which ones were missing (✗) or present (✓). Different missing
   facts print a different line, so the gap is never a guess.
5. **`device:` is the phone, in one line:** the old `ios/mobile`
   bucket, then the device class (`phone`), the browser and its
   version, the engine, and the OS version. "(UA-parsed)" is a
   reminder that these were read out of the browser's self-reported
   string — honest values, not measurements. It never names a phone
   model; no alert does.
6. **`runtime:` is the rest of the device facts:** memory (`unknown`
   here — this browser does not expose it, and that fact alone says
   "WebKit device"), cores as reported, screen-size bucket, pixel
   density, touch bucket, whether the game was installed
   (`standalone`) or in a browser tab, connection type, and locale.
7. **`mode:` says which map the crashed session was running** —
   `scout` (the light map) or `full`. Before this work, a crash
   report always claimed `full`, even when the session had been
   running Scout; now it reports the mode the session actually used.
   Next to it: the last step reached, and how long after boot start
   the session got (`4,210 ms after boot start` = it died about four
   seconds in, while loading the map — a very different bug from
   dying after twenty minutes of play).
8. **`boots:` counts repeat trouble.** `3 unfinished in a row` means
   this is the third boot in a row that ended without a clean exit —
   a crash loop, not a one-off.
9. **`error: none captured`** means no JavaScript error was seen.
   Together with a settled verdict, that points at the browser or
   the operating system killing the page, not at a bug in a line of
   game code.

The email version carries the same lines in a padded block, including
the `device:` and `runtime:` lines; the subject line is unchanged.

## The hourly digest

Once an hour, the worker posts a summary of the previous hour to
Discord. Nothing is posted for an empty hour. The shape, as built:

```text
📊 Meridian telemetry — hourly digest
hour: 2026-11-03 17:00–18:00 UTC (receipt hour) (2 events)
priority: S1 · P1 — 1× developer_needed/fg_kill_current on c6853be · ios 16 · phone
S1 = player-left INFERRED from ≥3 unfinished boots with no clean boot — not observed.

suspected_crash 1 · first 17:42 · last 17:42
  builds: c6853be ×1 · editions: state ×1 · regions: nebraska ×1
  groups: c6853be|ios|16|phone ×1
  verdicts: developer_needed/fg_kill_current ×1 · severities: S1 ×1 · modes: scout ×1 · steps: map_init_start ×1
js_error 1 · first 17:05 · last 17:05
  builds: 2a0527f ×1 · editions: state ×1 · regions: nebraska ×1
  groups: 2a0527f|android|unknown|phone ×1
  verdicts: developer_needed/captured_error ×1 · severities: S2b ×1 · modes: full ×1 · steps: game_loaded ×1 · errors: TypeError ×1

alerts this hour: none
```

Reading notes:

- **"(receipt hour)"** means the hour is when reports *arrived at
  the worker*, not when the events happened on the phone. A report
  that arrived late is counted in its arrival hour, and the type's
  line then ends with `(some reports arrived late)` so the shift is
  visible instead of silent.
- **`first` / `last`** are the first and last arrival times inside
  the hour. A total of 20 with first ≈ last is a burst; the same 20
  spread across the hour is a steady rate. Different problems.
- **`groups:`** is the cross-tab that answers "is this one kind of
  device?": build | OS | OS major version | device class. Groups are
  capped at 32 distinct keys per hour-bucket; anything beyond that
  tallies under `other`.
- **`severities:`** counts the hour's severity grades per type
  (issue #345), including `ungraded` for reports whose verdict
  carries no grade. Grade precedence, worst first, is
  **S1 > S2a > S2b > S3**: the digest's `priority:` line leads with
  the hour's worst grade — counted across all types in the hour,
  so it can come from a different type than the verdict the line
  names — when any graded report arrived. Inside one type block
  the counts sort by count, not by grade, so a lower grade can
  list first there when it happened more often. When the hour
  counted any S1, exactly one gloss line follows the priority
  line: `S1 = player-left INFERRED from ≥3 unfinished boots with
  no clean boot — not observed.`
- **Caps are labelled, never silent.** Each list shows its top few
  entries; when entries are cut, the line ends with the true
  remainder, like `(+2 more)`. Ties sort by count, then by name, so
  the same hour always renders the same way.
- A type whose count is more than 3× its trailing 24-hour average
  (and more than 3 events) gets `⚠️ >3× 24h avg` on its first line.

## The threshold alert

Hiccup-class events are not forwarded one by one. When one type
crosses a threshold inside an hour (default: 20 in the hour across
all builds, or 10 from a single build), the worker posts one alert
for that type and hour. Routine funnel-class types never trip this
alert — they surface via the hourly digest only (`narration_failed`
keeps the threshold alert; see the crash-report README):

```text
🚨 Meridian telemetry alert
type: tile_failed crossed the hiccup threshold (single build crossed 10/hour)
hour: 2026-11-03T17 UTC · counts: 20 total (f331846 ×12, other ×8)
one alert per type+hour — further events this hour only raise the counts
counts are at fire time; the hourly digest carries the final total
```

The last line matters: the counts in a threshold alert are the
counts **at the moment the alert fired**, not the hour's final
total. The hourly digest carries the final total.

## How to read counts / the funnel — superseded

> **Superseded.** The v1 receiver logged one structured JSON line
> per event (`wrangler tail` / dashboard logs), enriched with a
> UA-derived `iosVersion`, and counts were read from those log lines
> by buildId × edition × iOS version, with the `suspected_crash`
> funnel read by `lastMilestone` — full commands in
> `worker/observability/README.md`. The v1 worker is undeployed and
> that reading method no longer applies: counts now live in the
> worker's KV buckets and are read through the hourly digest above.
> The funnel question itself has not changed — trails stopping at
> `data_chunk_load_start` die loading data; trails stopping at
> `map_init_start` die building the map — but the digest's `steps:`
> counts are where you read it now.

## Secondary mitigation in the same branch

On coarse-pointer (touch) devices the MapLibre canvas pixel ratio is
capped at **1.5** and `maxTileCacheSize` is set explicitly to **64**
(`src/map/map-options.ts`, wired in `src/map/satellite-map.tsx`) —
full-DPR WebGL buffers are part of the same jetsam budget.

## Follow-up shipped — the Globe dataset is split

**Done via PR #148 (2026-10-15):** `globeTierSplit` is ON in production
and the Globe edition ships per-difficulty-tier region files — the Easy
path loads ≈456 KB on the wire — instead of the single ~13.7 MB JS
module holding 59,423 places. The single-chunk description earlier in
this doc is pre-split history.
