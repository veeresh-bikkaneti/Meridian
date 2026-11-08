/**
 * Meridian crash-report receiver — Cloudflare Worker (forwarding variant).
 *
 * Relationship to `worker/observability/` (v1): the v1 worker is a
 * logging-only receiver — it validates events and writes one structured
 * JSON log line per event (read via `wrangler tail`). THIS worker is a
 * separate, forwarding sibling in a NEW directory on purpose (the old
 * directory is untouched): it accepts the full client event schema
 * (see EVENT_TYPES below) and forwards a compact, PII-free alert to Discord
 * and/or email instead of logging the full event. Deploy ONE of them as
 * the `observabilityEndpoint` target; this one is the recommended
 * production choice because it pages a human instead of relying on
 * someone reading worker logs.
 *
 * Behavior:
 * - GET  /health        → 200 { ok: true }
 * - POST /  or /ingest  → validate one observability event; crash-class
 *                         events forward a compact alert immediately and
 *                         are counted; hiccup-class and funnel-class
 *                         events are counted but NOT forwarded individually
 *                         (hiccup-class surfaces via the threshold alert +
 *                         hourly digest; routine funnel-class types via the
 *                         hourly digest only — `narration_failed` keeps the
 *                         threshold alert; see the funnel-class comment).
 * - Non-POST on an ingest path → 405. Unknown paths → 404.
 * - POST without an allow-listed Origin → 403 (review S4; see CORS).
 * - Bodies over 8 KB → 413, enforced while streaming (a chunked body is
 *   cancelled at the cap, never buffered whole). Invalid JSON / schema
 *   violations → 400.
 * - Rate limit (10 requests / 60 s per client on ingest POSTs) → 429 with
 *   a Retry-After header. An in-memory per-isolate limiter always runs;
 *   the free Workers Rate Limiting binding CRASH_RATE_LIMITER adds a
 *   limit shared across isolates when it is bound (fail-open if it errors).
 * - No forwarding secrets configured → 200 { ok: true, forwarded: false }
 *   (no-op mode, safe to deploy before secrets exist).
 * - Cron (scheduled)   → posts the hourly digest to Discord.
 *
 * Privacy: the forwarded alert carries only type, buildId,
 * edition/region, lastMilestone, the coarse os/form device bucket, and a
 * truncated error name/message — NEVER full payloads, NEVER sessionId,
 * raw UA, precise device facts, coordinates, or stack traces. Log lines
 * carry only type/buildId/edition. The Phase 1 counters (Workers KV)
 * store COUNTS ONLY in buckets keyed by (UTC hour × type), broken down
 * inside the value by buildId × edition × region × os/form device
 * bucket — no event payloads, no identifiers.
 *
 * CORS and Origin allowlist (review S4, 2026-10-21): the game is served
 * from https://meridian.knowledgetest.workers.dev and from
 * https://veeresh-bikkaneti.github.io (GitHub Pages), and this worker is a
 * different origin, so every report is cross-origin. Before S4 the worker
 * answered `access-control-allow-origin: *` and took POSTs from anywhere.
 * Now ALLOWED_ORIGINS is the whole list:
 *
 * - `fetch` POSTs with `content-type: application/json` (the app's
 *   fallback transport and the inline boot watchdog's XHR) are preflighted.
 *   OPTIONS from an allowed origin → 204 echoing that origin (+ `Vary:
 *   Origin`). Any other origin, or none, → 403 with no CORS headers, so
 *   the browser blocks the POST.
 * - `navigator.sendBeacon(url, string)` sends `text/plain`, a CORS-
 *   safelisted type, so there is NO preflight. But browsers attach
 *   `Origin` to every cross-origin POST, beacons included, so the POST
 *   itself is checked: an allowed origin → normal handling, anything else
 *   → 403. The body is read as text whatever its content-type, so beacons
 *   keep working unchanged.
 * - A POST without any Origin (curl, scripts) → 403. A non-browser client
 *   can forge Origin, so this is not authentication. It stops other sites
 *   from making visitors' browsers post junk here, and the rate limit and
 *   schema handle the rest.
 *
 * Zero runtime dependencies. The pure handler is exported for unit tests
 * (src/index.test.ts; also exercisable with `npx wrangler dev` + curl,
 * see README.md).
 */

/**
 * Event types this worker accepts — the full client set, no more and no
 * less. This list MUST stay equal to `ObservabilityEventType` in
 * src/lib/observability.ts: the client posts every type it can emit to
 * this worker, so any type missing here is telemetry silently dropped
 * with a 400 (that is exactly how the six storyteller/narration types
 * were lost until #194 wave 2). A drift test in `npm test`
 * (scripts/observability-event-types.test.mjs) pins the two lists equal.
 *
 * History: the v1 set plus `boot_failure` and `tile_failed`, then
 * (Slice 2) `recovery_outcome`, then (#194 wave 2, 2026-11-02) the six
 * funnel types `storyteller_shown` + `narration_*` — real telemetry the
 * app had emitted since #108 through the same transport.
 */
export const EVENT_TYPES = [
  "suspected_crash",
  "boot_failure",
  "js_error",
  "unhandled_rejection",
  "map_error",
  "tile_failed",
  "webgl_context_lost",
  "recovery_outcome",
  "storyteller_shown",
  "narration_started",
  "narration_completed",
  "narration_replayed",
  "narration_failed",
  "narration_dismissed",
] as const;

export type CrashReportEventType = (typeof EVENT_TYPES)[number];

export const MAX_BODY_BYTES = 8192;

/**
 * Origins allowed to report (review S4). Exact `scheme://host` matches,
 * with no wildcards: a Workers preview URL or a fork's Pages site is
 * refused on purpose. A preview that needs reporting should use its own
 * staging worker (README, "Staging vs production").
 */
export const ALLOWED_ORIGINS: readonly string[] = Object.freeze([
  "https://meridian.knowledgetest.workers.dev",
  "https://veeresh-bikkaneti.github.io",
]);

/** Name of the optional Workers Rate Limiting binding (wrangler.toml). */
export const RATE_LIMIT_BINDING = "CRASH_RATE_LIMITER";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const FORWARD_TIMEOUT_MS = 5_000;

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_REPORT_FROM = "Meridian Crash Reporter <onboarding@resend.dev>";

export interface CrashReportEnv {
  /** Discord channel webhook URL (secret). Unset = no Discord forwarding. */
  DISCORD_WEBHOOK_URL?: string;
  /** Resend API key (secret). Unset (or REPORT_EMAIL unset) = no email. */
  RESEND_API_KEY?: string;
  /** Recipient of the alert email. Unset = no email forwarding. */
  REPORT_EMAIL?: string;
  /** Verified sender for the alert email; defaults to Resend's test domain. */
  REPORT_FROM?: string;
  /** Phase 1: KV binding for per-hour event counters (optional — counting
   *  is skipped when absent; the ingest path never depends on it). */
  TELEMETRY_COUNTS?: KvLike;
  /** Phase 1: hiccup threshold overrides (strings parsed as positive ints). */
  TELEMETRY_THRESHOLD_PER_HOUR?: string;
  TELEMETRY_THRESHOLD_PER_BUILD?: string;
  /** Review S4: optional Workers Rate Limiting binding (free; see
   *  wrangler.toml). Absent = the in-memory limiter alone applies. */
  CRASH_RATE_LIMITER?: RateLimitBinding;
}

export interface CrashReportEvent {
  type: CrashReportEventType;
  ts: number;
  buildId: string;
  edition?: string;
  regionId?: string;
  lastMilestone?: string;
  error?: { name: string; message: string };
  [key: string]: unknown;
}

const STRING_CAPS: Record<string, number> = {
  buildId: 64,
  sessionId: 64,
  edition: 128,
  regionId: 128,
  chunkId: 128,
  lastMilestone: 128,
};

function isCappedString(value: unknown, cap: number): value is string {
  return typeof value === "string" && value.length <= cap;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate one event against the observability schema
 * (src/lib/observability.ts, docs/observability.md). Returns a list of
 * problems; empty = valid. Optional fields pass through untouched.
 */
export function validateEvent(event: unknown): string[] {
  const problems: string[] = [];
  if (!isPlainObject(event)) return ["event must be a JSON object"];
  if (!(EVENT_TYPES as readonly string[]).includes(String(event.type))) {
    problems.push(`type must be one of ${EVENT_TYPES.join(", ")}`);
  }
  if (typeof event.ts !== "number" || !Number.isFinite(event.ts)) {
    problems.push("ts must be a finite number (epoch ms)");
  }
  if (!isCappedString(event.buildId, STRING_CAPS.buildId) || event.buildId.length === 0) {
    problems.push(`buildId must be a non-empty string ≤${STRING_CAPS.buildId} chars`);
  }
  for (const key of ["sessionId", "edition", "regionId", "chunkId", "lastMilestone"]) {
    if (event[key] !== undefined && !isCappedString(event[key], STRING_CAPS[key])) {
      problems.push(`${key} must be a string ≤${STRING_CAPS[key]} chars`);
    }
  }
  if (event.error !== undefined) {
    if (!isPlainObject(event.error)) {
      problems.push("error must be an object");
    } else {
      if (!isCappedString(event.error.name, 80))
        problems.push("error.name must be a string ≤80 chars");
      if (!isCappedString(event.error.message, 300))
        problems.push("error.message must be a string ≤300 chars");
    }
  }
  problems.push(...validateDevice(event.device, "device"));
  if (event.breadcrumb !== undefined) {
    if (!isPlainObject(event.breadcrumb)) {
      problems.push("breadcrumb must be an object");
    } else {
      problems.push(...validateDevice(event.breadcrumb.device, "breadcrumb.device"));
      const history = event.breadcrumb.history;
      if (history !== undefined && (!Array.isArray(history) || history.length > MAX_BREADCRUMB_HISTORY)) {
        problems.push(`breadcrumb.history must be an array of ≤${MAX_BREADCRUMB_HISTORY} entries`);
      }
    }
  }
  // Review S4: anything else at the top level must be a small primitive.
  // Real events carry only the fields above (src/lib/observability.ts).
  // This keeps junk posts from smuggling large or nested payloads.
  const extra = Object.keys(event).filter((k) => !KNOWN_TOP_LEVEL.has(k));
  if (Object.keys(event).length > MAX_TOP_LEVEL_KEYS) {
    problems.push(`event must have ≤${MAX_TOP_LEVEL_KEYS} fields`);
  }
  if (extra.some((k) => k.length > 64 || !isSmallPrimitive(event[k]))) {
    problems.push("extra fields must be short strings, numbers, booleans or null");
  }
  if (typeof event.ts === "number" && Number.isFinite(event.ts)) {
    if (event.ts < EARLIEST_TS || event.ts > Date.now() + MAX_CLOCK_SKEW_MS) {
      problems.push("ts is outside the accepted window");
    }
  }
  return problems;
}

/** Top-level fields the client schema defines (docs/observability.md). */
const KNOWN_TOP_LEVEL = new Set([
  "type", "ts", "buildId", "sessionId", "edition", "regionId", "chunkId",
  "lastMilestone", "error", "device", "breadcrumb",
]);
const MAX_TOP_LEVEL_KEYS = 24;
const MAX_BREADCRUMB_HISTORY = 32; // the client keeps 12 (MAX_HISTORY)
/** 2020-01-01T00:00:00Z: nothing older is a real report from this game. */
const EARLIEST_TS = 1_577_836_800_000;
/** Allow a day of device clock skew into the future. */
const MAX_CLOCK_SKEW_MS = 86_400_000;

function isSmallPrimitive(value: unknown): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.length <= 256;
}

/**
 * The coarse device bucket (COPPA): os/form/screen labels, a DPR number,
 * and WebGL booleans. `ua` is tolerated (≤300 chars) because older app
 * builds still put it in the breadcrumb, but it is never forwarded or
 * counted (buildAlert / deviceBucketOf read os/form only).
 */
function validateDevice(device: unknown, label: string): string[] {
  if (device === undefined) return [];
  if (!isPlainObject(device)) return [`${label} must be an object`];
  const problems: string[] = [];
  for (const [k, v] of Object.entries(device)) {
    const ok =
      k === "ua" ? isCappedString(v, 300)
      : k === "os" || k === "form" || k === "screen" ? isCappedString(v, 24)
      : k === "dpr" ? (typeof v === "number" && Number.isFinite(v)) || v === "unknown"
      : k === "screenW" || k === "screenH" ? typeof v === "number" && Number.isFinite(v)
      : k === "webgl1" || k === "webgl2" ? typeof v === "boolean"
      : isSmallPrimitive(v) && k.length <= 32;
    if (!ok) problems.push(`${label}.${k.slice(0, 32)} has an invalid value`);
  }
  if (Object.keys(device).length > 16) problems.push(`${label} has too many fields`);
  return problems;
}

// --- Intake normalisation (crash-telemetry design §5.1) ------------------
//
// normaliseEvent runs BEFORE validateEvent in handleRequest. It strips
// and coerces; it never adds a 400. After normalisation the only 400s
// left are validateEvent's required-field checks (type, ts window,
// buildId) — exactly the checks a legacy event already passes today.
//
// The device allowlist below is the worker mirror of the client field
// manifest (src/lib/telemetry-manifest.ts). The parity guard
// (scripts/observability-field-parity.test.mjs) extracts it by this exact
// name, so the name DEVICE_FIELD_ALLOWLIST must not change.

export const DEVICE_FIELD_ALLOWLIST: readonly string[] = Object.freeze([
  "browser",
  "browserVersion",
  "connection",
  "deviceClass",
  "deviceMemory",
  "displayMode",
  "dpr",
  "engine",
  "form",
  "hardwareConcurrency",
  "locale",
  "os",
  "osVersion",
  "screen",
  "touchPoints",
  "webgl1",
  "webgl2",
]);

const DEVICE_OS_VALUES = ["ios", "android", "windows", "mac", "linux", "other"];
const DEVICE_FORM_VALUES = ["mobile", "desktop"];
const DEVICE_BROWSER_VALUES = ["safari", "chrome", "edge", "firefox", "samsung", "unknown"];
const DEVICE_ENGINE_VALUES = ["webkit", "blink", "gecko", "unknown"];
const DEVICE_CLASS_VALUES = ["phone", "tablet", "desktop", "unknown"];
const DEVICE_SCREEN_VALUES = ["sm", "md", "lg", "xl"];
const DEVICE_TOUCH_VALUES = ["0", "1", "2-5", "6+"];
const DEVICE_DISPLAY_VALUES = ["standalone", "browser", "unknown"];
const DEVICE_CONNECTION_VALUES = ["slow-2g", "2g", "3g", "4g", "unknown"];
const DEVICE_SOURCE_VALUES = ["crashed_session", "detecting_boot", "live"];
const MAP_MODE_VALUES = ["full", "scout", "unknown"];

/** An out-of-enum manifest value becomes the field's unknown form. */
function enumOrUnknown(value: unknown, values: readonly string[]): string {
  return typeof value === "string" && values.includes(value) ? value : "unknown";
}

/** Versions stamp as "<major>[.<minor>[.<patch>]]" or "unknown" — nothing else. */
function versionOrUnknown(value: unknown): string {
  return typeof value === "string" && /^\d+(\.\d+){0,2}$/.test(value) ? value : "unknown";
}

/** Primary BCP-47 tag only (≤12 chars); anything else is not a locale. */
function localeOrUnknown(value: unknown): string {
  return typeof value === "string" &&
    value.length <= 12 &&
    /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(value)
    ? value
    : "unknown";
}

/**
 * Rebuild one device object from the allowlist only, coercing each
 * manifest field to its honest form. The raw UA and any non-manifest
 * key are deleted here, so "no UA past intake" is structural.
 */
function normaliseDevice(device: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of DEVICE_FIELD_ALLOWLIST) {
    const v = device[key];
    if (v === undefined) continue;
    switch (key) {
      case "os":
        out.os = enumOrUnknown(v, DEVICE_OS_VALUES);
        break;
      case "form":
        out.form = enumOrUnknown(v, DEVICE_FORM_VALUES);
        break;
      case "browser":
        out.browser = enumOrUnknown(v, DEVICE_BROWSER_VALUES);
        break;
      case "engine":
        out.engine = enumOrUnknown(v, DEVICE_ENGINE_VALUES);
        break;
      case "deviceClass":
        out.deviceClass = enumOrUnknown(v, DEVICE_CLASS_VALUES);
        break;
      case "screen":
        out.screen = enumOrUnknown(v, DEVICE_SCREEN_VALUES);
        break;
      case "touchPoints":
        out.touchPoints = enumOrUnknown(v, DEVICE_TOUCH_VALUES);
        break;
      case "displayMode":
        out.displayMode = enumOrUnknown(v, DEVICE_DISPLAY_VALUES);
        break;
      case "connection":
        out.connection = enumOrUnknown(v, DEVICE_CONNECTION_VALUES);
        break;
      case "browserVersion":
      case "osVersion":
        out[key] = versionOrUnknown(v);
        break;
      case "locale":
        out.locale = localeOrUnknown(v);
        break;
      case "dpr":
        out.dpr =
          typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 4 ? v : "unknown";
        break;
      case "deviceMemory":
        // Range rule, not a whitelist (Slice 4 I-8): any plausible
        // as-read value in 0.25–64 GB passes; the rest is "unknown".
        out.deviceMemory =
          typeof v === "number" && Number.isFinite(v) && v >= 0.25 && v <= 64
            ? v
            : "unknown";
        break;
      case "hardwareConcurrency":
        out.hardwareConcurrency =
          typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 64
            ? v
            : "unknown";
        break;
      case "webgl1":
      case "webgl2":
        // Booleans have no unknown form; a non-boolean is dropped.
        if (typeof v === "boolean") out[key] = v;
        break;
    }
  }
  return out;
}

/**
 * The §3.4 E-rule engine fill for watchdog-shaped boot_failure events
 * (cure round, §7.5 ladder step 2): the watchdog drops `engine` to fit
 * its byte budget, and the worker recovers it here from the event's
 * own parsed fields — never from a UA string. E1 first (iOS is a
 * WebKit shell), then E2/E3/E4 by browser. Anything else stays
 * "unknown". deviceClass has NO equivalent fill: it is not honestly
 * recoverable from the parsed fields, so watchdog events keep
 * "unknown" for it.
 */
function derivedEngineForBootFailure(device: Record<string, unknown>): string {
  if (device.os === "ios") return "webkit";
  switch (device.browser) {
    case "chrome":
    case "edge":
    case "samsung":
      return "blink";
    case "firefox":
      return "gecko";
    case "safari":
      return "webkit";
    default:
      return "unknown";
  }
}

/**
 * Strip-and-continue intake (design §5.1). Returns a normalised copy;
 * the caller's object is never mutated. Caps are unchanged: body 8192,
 * top-level keys 24, device keys 16 — over-cap strings are truncated to
 * the existing caps instead of rejected, and non-primitive top-level
 * extras are deleted instead of failing the event.
 */
export function normaliseEvent(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;
  const event: Record<string, unknown> = { ...raw };

  for (const [key, cap] of Object.entries(STRING_CAPS)) {
    const v = event[key];
    if (typeof v === "string" && v.length > cap) event[key] = v.slice(0, cap);
  }
  if (isPlainObject(event.error)) {
    // Council fix T1: keep ONLY name/message (stack, cause and nested
    // objects never travel further) and scrub both before anything —
    // alert, email, log line or counter — can read them.
    const raw = event.error;
    const error: Record<string, unknown> = {};
    if (typeof raw.name === "string") error.name = scrubErrorText(raw.name, 80);
    else if (raw.name !== undefined) error.name = raw.name;
    if (typeof raw.message === "string") error.message = scrubErrorText(raw.message, 300);
    else if (raw.message !== undefined) error.message = raw.message;
    event.error = error;
  }
  if (isPlainObject(event.device)) event.device = normaliseDevice(event.device);
  // §7.5 ladder step 2, boot_failure ONLY: a watchdog event arrives
  // with engine dropped (absent, or coerced to "unknown" above). Fill
  // it from the parsed fields via the E-rules. A present engine is
  // never overwritten, and no other event type is filled — the app
  // path stamps its own engine and its absence stays "unknown".
  if (event.type === "boot_failure" && isPlainObject(event.device)) {
    const dev = event.device as Record<string, unknown>;
    if (dev.engine === undefined || dev.engine === "unknown") {
      dev.engine = derivedEngineForBootFailure(dev);
    }
  }
  if (isPlainObject(event.breadcrumb)) {
    const breadcrumb = { ...event.breadcrumb };
    if (isPlainObject(breadcrumb.device)) {
      // The nested trail device is never read by the worker; strip its
      // UA and every non-manifest key so nothing planted there survives.
      const nested = { ...breadcrumb.device };
      delete nested.ua;
      for (const key of Object.keys(nested)) {
        if (!DEVICE_FIELD_ALLOWLIST.includes(key)) delete nested[key];
      }
      breadcrumb.device = nested;
    }
    event.breadcrumb = breadcrumb;
  }

  if (event.mapMode !== undefined) {
    event.mapMode = enumOrUnknown(event.mapMode, MAP_MODE_VALUES);
  }
  if (
    event.deviceSource !== undefined &&
    !(
      typeof event.deviceSource === "string" &&
      DEVICE_SOURCE_VALUES.includes(event.deviceSource)
    )
  ) {
    delete event.deviceSource;
  }
  if (event.msSinceBootStart !== undefined) {
    const v = event.msSinceBootStart;
    event.msSinceBootStart =
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : "unknown";
  }
  if (event.unfinishedBoots !== undefined) {
    const v = event.unfinishedBoots;
    if (typeof v === "number" && Number.isFinite(v)) {
      event.unfinishedBoots = Math.min(999, Math.max(0, Math.floor(v)));
    } else {
      delete event.unfinishedBoots;
    }
  }

  const objectValued = new Set(["error", "device", "breadcrumb"]);
  for (const key of Object.keys(event)) {
    if (key.length > 64) {
      delete event[key];
      continue;
    }
    if (objectValued.has(key)) continue;
    const v = event[key];
    if (v !== null && typeof v === "object") delete event[key];
    else if (typeof v === "string" && v.length > 256) event[key] = v.slice(0, 256);
  }
  return event;
}

// --- Rate limiting (review S4) -------------------------------------------
//
// Same small-interface shape as the contact form's limiter
// (src/lib/contact/rate-limiter.server.ts), but self-contained because this
// worker ships as one file with no imports:
//
//   InMemoryRateLimiter   → always on. Fixed 60 s window per client,
//                           per isolate. Keys are a SALTED SHA-256 of the
//                           IP (random per-isolate salt), so the raw IP is
//                           never held in memory.
//   BindingRateLimiter    → added only when CRASH_RATE_LIMITER is bound.
//                           The Workers Rate Limiting API counts across
//                           isolates in a Cloudflare location. It is free:
//                           no plan gate and no billing line in Cloudflare's
//                           docs (checked 2026-10-21; GA 2025-09-19).
//   LayeredRateLimiter    → asks each layer in order; the first "no" wins.
//
// Fail-open by design: a missing, malformed, or throwing binding never
// blocks a crash report by itself (losing crash reports is the failure this
// worker exists to prevent), and the in-memory layer still applies.

export interface RateDecision {
  allowed: boolean;
  retryAfterSec: number;
}

export interface IngestRateLimiter {
  check(ip: string, now: number): Promise<RateDecision>;
}

/** Structural type of a Workers Rate Limiting binding. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const ALLOW: RateDecision = { allowed: true, retryAfterSec: 0 };

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface RateEntry {
  windowStart: number;
  count: number;
}

export class InMemoryRateLimiter implements IngestRateLimiter {
  private readonly entries = new Map<string, RateEntry>();
  // Created on first use: Workers forbid generating random values at
  // global scope, and the shared instance below is built at module load.
  private salt: string | null = null;
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
    this.max = max;
    this.windowMs = windowMs;
  }

  reset(): void {
    this.entries.clear();
  }

  async check(ip: string, now: number): Promise<RateDecision> {
    // Opportunistic prune so the map cannot grow unboundedly across windows.
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart >= this.windowMs) this.entries.delete(key);
    }
    this.salt ??= crypto.randomUUID();
    const key = (await sha256Hex(`${this.salt}:${ip}`)).slice(0, 32);
    const entry = this.entries.get(key);
    if (!entry) {
      this.entries.set(key, { windowStart: now, count: 1 });
      return ALLOW;
    }
    if (entry.count >= this.max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.windowStart + this.windowMs - now) / 1000));
      return { allowed: false, retryAfterSec };
    }
    entry.count += 1;
    return ALLOW;
  }
}

/**
 * Key for the shared binding. It must be the same in every isolate, so it
 * cannot use the per-isolate salt. Instead the UTC day is part of the
 * hashed input: the pseudonym changes daily and cannot link one day's
 * client to the next, and the counter lives only in Cloudflare's
 * rate-limit cache for its 60 s period.
 */
export async function bindingClientKey(ip: string, now: number): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10);
  return `c:${(await sha256Hex(`meridian-crash-rl:v1:${day}:${ip}`)).slice(0, 16)}`;
}

export class BindingRateLimiter implements IngestRateLimiter {
  private readonly binding: RateLimitBinding;

  constructor(binding: RateLimitBinding) {
    this.binding = binding;
  }

  async check(ip: string, now: number): Promise<RateDecision> {
    try {
      const { success } = await this.binding.limit({ key: await bindingClientKey(ip, now) });
      return success ? ALLOW : { allowed: false, retryAfterSec: RATE_LIMIT_WINDOW_MS / 1000 };
    } catch (err) {
      logLine("rate-limit binding failed (fail-open)", err instanceof Error ? err.name : "unknown");
      return ALLOW;
    }
  }
}

export class LayeredRateLimiter implements IngestRateLimiter {
  private readonly layers: readonly IngestRateLimiter[];

  constructor(layers: readonly IngestRateLimiter[]) {
    this.layers = layers;
  }

  async check(ip: string, now: number): Promise<RateDecision> {
    for (const layer of this.layers) {
      const decision = await layer.check(ip, now);
      if (!decision.allowed) return decision;
    }
    return ALLOW;
  }
}

function isRateLimitBinding(value: unknown): value is RateLimitBinding {
  return typeof (value as { limit?: unknown } | null | undefined)?.limit === "function";
}

/** One in-memory limiter per isolate, shared by every request. */
const inMemoryLimiter = new InMemoryRateLimiter();

/** The limiter for this request: in-memory, plus the binding when bound. */
export function selectRateLimiter(env: CrashReportEnv): IngestRateLimiter {
  const binding = env.CRASH_RATE_LIMITER;
  return isRateLimitBinding(binding)
    ? new LayeredRateLimiter([inMemoryLimiter, new BindingRateLimiter(binding)])
    : inMemoryLimiter;
}

/** Test-only: clear in-memory rate-limit state between test cases. */
export function resetRateLimitsForTests(): void {
  inMemoryLimiter.reset();
}

// --- Origin policy (review S4) -----------------------------------------------

export class OriginPolicy {
  private readonly allowed: readonly string[];

  constructor(allowed: readonly string[] = ALLOWED_ORIGINS) {
    this.allowed = allowed;
  }

  /** The request's Origin when it is allow-listed, else null. */
  allowedOrigin(request: Request): string | null {
    const origin = request.headers.get("origin");
    return origin !== null && this.allowed.includes(origin) ? origin : null;
  }

  /** CORS headers for an allowed origin. Always varies on Origin. */
  corsHeaders(origin: string | null): Record<string, string> {
    return origin ? { "access-control-allow-origin": origin, vary: "Origin" } : { vary: "Origin" };
  }
}

const originPolicy = new OriginPolicy();

// --- Streamed body read with a hard cap ----------------------------------------

/**
 * Read the body as UTF-8 text, cancelling the stream as soon as it passes
 * `max` bytes. Returns null when over the cap. A chunked upload without a
 * Content-Length is never buffered beyond the cap.
 */
export async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

// --- Crash-report verdicts (Slice 1, 2026-10-25) -------------------------
//
// The classifier below MIRRORS src/lib/observability.ts (deliberate
// duplication across the client/worker boundary, design §4): the client
// stamps the evidence facts and a provisional verdict; this worker
// re-derives the verdict from the stamped facts at ingest and renders
// its own derivation — a client-stamped verdict field is never read
// here. That re-derivation is a consistency check over client-stamped
// facts, not independent verification (design F9). Absent stamps (older
// builds in the fleet) fail closed to insufficient_evidence, never to
// benign (F8). `auto_fixed` is returned only by the Slice 2
// recovery_outcome branch (a confirmed recovery); an attempt alone
// never earns it.

export type CrashVerdict =
  | "not_a_real_issue"
  | "auto_fixed"
  | "developer_needed"
  | "insufficient_evidence";

export type CrashWhyKey =
  | "bg_close"
  | "bg_stuck"
  | "fg_vanished"
  | "fg_kill_replaced"
  | "fg_kill_current"
  | "captured_error"
  | "recovery_confirmed"
  | "recovery_failed"
  | "recovery_stood_down"
  | "recovery_unconfirmed"
  | "marker_unreadable"
  | "missing_fields";

export interface CrashVerdictFacts {
  type: string;
  error?: { name: string; message: string };
  lastMilestone?: string;
  bgTerminal?: boolean;
  buildReplaced?: boolean;
  trailStuck?: boolean;
  lcV?: string;
  recoveryOutcome?: string;
}

/** Types whose presence alone is a captured failure (design §2.2). */
const CAPTURED_ERROR_TYPES = new Set([
  "js_error",
  "unhandled_rejection",
  "map_error",
  "boot_failure",
]);

/** Last-step values that mean the session was in active play (shapes D/E). */
const GAMEPLAY_MILESTONES = new Set([
  "run_start",
  "data_chunk_load_start",
  "data_loaded",
  "map_init_start",
  "map_ready",
  "game_loaded",
  "storyteller_ready",
]);

/**
 * Classify one report from its stamped facts. Precedence (design §2.3):
 * a captured error defeats every benign pattern and every missing-stamp
 * gap; developer-needed evidence defeats insufficient-evidence; benign
 * is the last resort, reachable only with its full evidence pattern.
 */
export function classifyCrashVerdict(
  facts: CrashVerdictFacts,
): { verdict: CrashVerdict; whyKey: CrashWhyKey } {
  // Slice 2: the recovery_outcome branch is evaluated FIRST, before the
  // captured-error rule (Consensus Manifest 2026-10-25). A missing or
  // invalid recoveryOutcome fails closed to insufficient_evidence.
  if (facts.type === "recovery_outcome") {
    switch (facts.recoveryOutcome) {
      case "confirmed":
        return { verdict: "auto_fixed", whyKey: "recovery_confirmed" };
      case "repeat_failure":
        return { verdict: "developer_needed", whyKey: "recovery_failed" };
      case "stood_down":
        return { verdict: "insufficient_evidence", whyKey: "recovery_stood_down" };
      case "unconfirmed_closed":
      case "unconfirmed_died":
      case "unconfirmed_expired":
        return { verdict: "insufficient_evidence", whyKey: "recovery_unconfirmed" };
      case "marker_unreadable":
        return { verdict: "insufficient_evidence", whyKey: "marker_unreadable" };
      default:
        return { verdict: "insufficient_evidence", whyKey: "missing_fields" };
    }
  }
  if (facts.error || CAPTURED_ERROR_TYPES.has(facts.type)) {
    return { verdict: "developer_needed", whyKey: "captured_error" };
  }
  if (facts.type !== "suspected_crash") {
    return { verdict: "insufficient_evidence", whyKey: "missing_fields" };
  }
  // Fail closed (design F8): any absent stamp → can't tell, never benign.
  if (
    typeof facts.bgTerminal !== "boolean" ||
    typeof facts.buildReplaced !== "boolean" ||
    typeof facts.trailStuck !== "boolean" ||
    typeof facts.lcV !== "string" ||
    facts.lcV.length === 0
  ) {
    return { verdict: "insufficient_evidence", whyKey: "missing_fields" };
  }
  if (facts.bgTerminal) {
    return facts.trailStuck
      ? { verdict: "insufficient_evidence", whyKey: "bg_stuck" }
      : { verdict: "not_a_real_issue", whyKey: "bg_close" };
  }
  if (facts.lastMilestone && GAMEPLAY_MILESTONES.has(facts.lastMilestone)) {
    return facts.buildReplaced
      ? { verdict: "insufficient_evidence", whyKey: "fg_kill_replaced" }
      : { verdict: "developer_needed", whyKey: "fg_kill_current" };
  }
  return { verdict: "insufficient_evidence", whyKey: "fg_vanished" };
}

/**
 * Reader-facing verdict text. The headlines are Liz's approved sample
 * wordings (2026-10-25); a headline is a disposition, never a fact claim
 * about an event nobody saw (design §3.1).
 */
const VERDICT_PRESENTATION: Record<CrashVerdict, { headline: string; label: string }> = {
  not_a_real_issue: { headline: "✅ IGNORE — No action needed", label: "no action needed" },
  auto_fixed: { headline: "🔧 IGNORE — Fixed itself (confirmed)", label: "automatically fixed (confirmed)" },
  developer_needed: { headline: "🚨 FIX — Developer action needed", label: "developer action needed" },
  insufficient_evidence: { headline: "❔ WAIT — Can't tell from this report", label: "can't tell from this report" },
};

/** One plain-language why-line per why-key: evidence + its limit (§5). */
function whyLineFor(whyKey: CrashWhyKey, event: CrashReportEvent): string {
  switch (whyKey) {
    case "bg_close":
      return "The app was in the background when the phone closed it. No error was captured. (A crash while in the background would look the same from here — this pattern is the usual harmless one.)";
    case "bg_stuck":
      return "The player backgrounded an app that appeared stuck, and the phone later closed it; no error was captured.";
    case "fg_vanished":
      return "The session ended with no error captured, and it does not match the background-close pattern.";
    case "fg_kill_replaced":
      return "Session ended mid-game with no error captured, on a build that has since been replaced.";
    case "fg_kill_current":
      return "App stopped mid-game on the current build; no error was captured, so the cause is unknown.";
    case "captured_error":
      return event.error
        ? `The app hit a real error and did not recover from it. Error captured: ${scrubErrorText(event.error.name, 60) || "—"} — ${scrubErrorText(event.error.message, 140) || "—"}.`
        : // Council fix T5: a captured-error TYPE with no details is not
          // evidence of a failed startup; say what was observed.
          `A ${event.type} report arrived with no error details attached. That alone is not evidence of a failed startup; the failure phase is ${event.lastMilestone ? `last reported step ${lastStepWords(event.lastMilestone)}` : "unavailable (no last step stamped)"}.`;
    case "missing_fields":
      return "This report is missing the evidence needed to classify it, so it can't be called harmless.";
    case "recovery_confirmed":
      return "A game file failed to load. The app reloaded itself once, then reached the game and no repeat failure was observed for at least 30 seconds. (Whether the failing file itself was tried again in that time is not observed.)";
    case "recovery_failed":
      return "The app reloaded to fix a failed game file, and a game file failed to load again in the session that followed.";
    case "recovery_stood_down":
      return "A game file failed to load and the app showed its update offer instead of reloading. Whether the player accepted it — and whether accepting fixed the file — is not observed here.";
    case "recovery_unconfirmed":
      return "The app reloaded to fix a failed game file; whether it worked was never confirmed — the player may simply not have come back, and the session's ending may be unrelated.";
    case "marker_unreadable":
      return "A recovery attempt was recorded, but its record could not be read, so the outcome can't be told.";
  }
}

/** Plain-language last-step values (reader text never says "milestone"). */
const LAST_STEP_WORDS: Record<string, string> = {
  boot_start: "starting up",
  boot_ready: "ready",
  run_start: "starting a game",
  data_chunk_load_start: "loading game data",
  data_loaded: "game data loaded",
  map_init_start: "map loading",
  map_ready: "map on screen",
  game_loaded: "playing — map on screen",
  storyteller_ready: "story ready",
  backgrounded: "in the background (app switched away)",
  foregrounded: "back in the foreground",
};

function lastStepWords(rawMilestone: string | undefined): string {
  if (!rawMilestone) return "—";
  return LAST_STEP_WORDS[rawMilestone] ?? truncate(rawMilestone, 80);
}

// --- Compact, PII-free alert -------------------------------------------

/**
 * Council fix round 2 (F1): token-based query/fragment removal. A token is
 * a run without whitespace, quotes, angle brackets or backticks — so
 * parentheses, brackets and markdown link syntax stay INSIDE the token and
 * can no longer end a URL early. In a token holding scheme://, everything
 * from the first ?, #, %3F or %23 after the scheme to the token's end is
 * dropped (nested URLs included). A schemeless token is cut at its first
 * ? / %3F only when a key=value query follows (relative "/api?token=x").
 * Only trailing closing punctuation of the cut part is kept. Path segments
 * are kept by design; a bare "k=v" without "?" is not a query and survives.
 * A trailing stack position ":line:col" after a removed query is kept
 * (so a numeric "a:1:2" query tail would survive — documented limit).
 */
function stripUrlQueries(s: string): string {
  return s.replace(/[^\s'"<>`]+/g, (tok) => {
    const scheme = /(?:https?|wss?|blob|file):\/\//i.exec(tok);
    let start: number;
    let cutRe: RegExp;
    if (scheme) {
      start = scheme.index + scheme[0].length;
      cutRe = /[?#]|%3f|%23/i;
    } else if (/(?:\?|%3f)[^\s=?&#]+(?:=|%3d)/i.test(tok)) {
      start = 0;
      cutRe = /\?|%3f/i;
    } else {
      return tok;
    }
    const rest = tok.slice(start);
    const cut = rest.search(cutRe);
    if (cut < 0) return tok;
    const tail = /(?::\d{1,7}:\d{1,7})?[)\]}.,;!]*$/.exec(rest.slice(cut))?.[0] ?? "";
    return tok.slice(0, start) + rest.slice(0, cut) + tail;
  });
}

/**
 * Privacy scrub for error text (council fix T1, 2026-11-08). Mirrored in
 * src/lib/observability.ts (sanitizeError) and pinned identical by the
 * worker test "client sanitizeError scrubs the same way". Rules, in order:
 * URLs keep scheme/host/path and drop ?query and #fragment (stripUrlQueries); emails become
 * <email>; UUIDs and hex runs >= 20 become <id>; mixed letter+digit token
 * runs >= 32 become <redacted>; @everyone/@here lose their mention form.
 * file:line:col and code identifiers survive. Output is capped at `max`.
 */
export function scrubErrorText(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length === 0) return "";
  // Bound the work before regexes run (inputs are already capped upstream).
  let s = value.slice(0, 2048);
  s = stripUrlQueries(s);
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>");
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>");
  s = s.replace(/\b[0-9a-f]{20,}\b/gi, "<id>");
  s = s.replace(/[A-Za-z0-9_\-+/=]{32,}/g, (run) =>
    /[0-9]/.test(run) && /[A-Za-z]/.test(run) ? "<redacted>" : run,
  );
  s = s.replace(/@(everyone|here)\b/gi, "@\u200b$1");
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;
}


function truncate(value: string | undefined, max: number): string {
  if (!value) return "—";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * The stamped facts the classifier reads, pulled off one event. Shared
 * by the alert builder and the counters (§5.2): one derivation per
 * request, and the client-stamped verdict is never among the facts.
 */
export function verdictFactsOf(event: CrashReportEvent): CrashVerdictFacts {
  return {
    type: event.type,
    error: event.error,
    lastMilestone: event.lastMilestone,
    bgTerminal: typeof event.bgTerminal === "boolean" ? event.bgTerminal : undefined,
    buildReplaced: typeof event.buildReplaced === "boolean" ? event.buildReplaced : undefined,
    trailStuck: typeof event.trailStuck === "boolean" ? event.trailStuck : undefined,
    lcV: typeof event.lcV === "string" ? event.lcV : undefined,
    recoveryOutcome: typeof event.recoveryOutcome === "string" ? event.recoveryOutcome : undefined,
  };
}

/** The worker's own re-derived verdict for one event (§5.2/§5.4). */
export function deriveVerdict(event: CrashReportEvent): { verdict: CrashVerdict; whyKey: CrashWhyKey } {
  return classifyCrashVerdict(verdictFactsOf(event));
}

// --- Provenance corroboration gate (2026-11-05) ---------------------------
//
// Provenance is an orthogonal axis to the verdict: it asks whether the
// payload corroborates itself as a real client session's report — right
// build shape, right stamps, a session trail (or a recognised boot /
// watchdog shape) consistent inside the single event. It never feeds
// the classifier. The gate is stateless: a pure function of the single
// normalised event, no KV reads, so a KV outage cannot reopen paging.

export type Provenance = "corroborated" | "uncorroborated";

/** Every named device field is a present, non-empty string. */
function hasFields(dev: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((f) => typeof dev[f] === "string" && (dev[f] as string).length > 0);
}

/**
 * Corroboration checks, in order (the first failure decides):
 * P1′ build shape — the real generator's output union; P2 stamps —
 * lcV present (never version-pinned), storageOk boolean either value;
 * P3′ device floor — per class (client / watchdog / funnel); P4a′/P4b′
 * session linkage for suspected_crash and the live error types.
 * Total by construction: every read is narrowed before use, so a
 * malformed shape returns "uncorroborated" instead of throwing.
 */
export function provenanceOf(event: CrashReportEvent): Provenance {
  if (!isPlainObject(event)) return "uncorroborated";
  if (!(EVENT_TYPES as readonly string[]).includes(event.type)) return "uncorroborated";

  // P1′ build shape.
  if (typeof event.buildId !== "string") return "uncorroborated";
  if (
    !(
      /^[0-9a-f]{7,40}$/.test(event.buildId) ||
      /^local-[0-9a-z]{6,12}$/.test(event.buildId) ||
      event.buildId === "dev"
    )
  ) {
    return "uncorroborated";
  }

  // P2 stamps.
  if (typeof event.lcV !== "string" || event.lcV.length === 0) return "uncorroborated";
  if (typeof event.storageOk !== "boolean") return "uncorroborated";

  // P3′ device floor (the watchdog floor binds ALL boot_failure).
  const dev = event.device;
  if (!isPlainObject(dev)) return "uncorroborated";
  if ((FUNNEL_CLASS_TYPES as readonly string[]).includes(event.type)) {
    if (!hasFields(dev, ["os", "form"])) return "uncorroborated";
  } else if (event.type === "boot_failure") {
    if (!hasFields(dev, ["browser", "os", "form"])) return "uncorroborated";
    if (Object.keys(dev).length < 10) return "uncorroborated";
  } else {
    if (!hasFields(dev, ["browser", "os", "osVersion", "deviceClass", "form"])) {
      return "uncorroborated";
    }
    if (Object.keys(dev).length < 8) return "uncorroborated";
  }

  // P4a′ — suspected_crash: full trail or the payload-cap truncation stub.
  if (event.type === "suspected_crash") {
    if (typeof event.sessionId !== "string" || event.sessionId.length === 0) {
      return "uncorroborated";
    }
    const bc = event.breadcrumb;
    if (!isPlainObject(bc)) return "uncorroborated";
    const fullTrail =
      bc.sessionId === event.sessionId &&
      bc.buildId === event.buildId &&
      Array.isArray(bc.history) &&
      bc.history.length >= 1;
    const truncationStub =
      bc.sessionId === event.sessionId &&
      bc.buildId === event.buildId &&
      bc.lastMilestone === event.lastMilestone &&
      typeof bc.startedAt === "number" &&
      (bc.history === undefined || (Array.isArray(bc.history) && bc.history.length === 0));
    if (!fullTrail && !truncationStub) return "uncorroborated";
  } else if (
    // P4b′ — live errors: session linkage, or the exact pre-init shape.
    event.type === "js_error" ||
    event.type === "unhandled_rejection" ||
    event.type === "map_error"
  ) {
    // Linked: a sessionId plus either a lastMilestone or the numeric
    // msSinceBootStart that emit() derives from the SAME live breadcrumb
    // that supplies the sessionId. lastMilestone alone is not enough to
    // require: the route error boundary and the region-chunk load
    // failure emit js_error post-init with no lastMilestone (#353 fix).
    const linked =
      typeof event.sessionId === "string" &&
      event.sessionId.length > 0 &&
      ((typeof event.lastMilestone === "string" && event.lastMilestone.length > 0) ||
        typeof event.msSinceBootStart === "number");
    // Exact pre-init wire signature: emit() couples a sessionId and a
    // numeric msSinceBootStart through the same breadcrumb, so a hybrid
    // (sessionId present ∧ msSinceBootStart "unknown") is unproducible
    // by the real client and does not pass.
    const preInit =
      (typeof event.sessionId !== "string" || event.sessionId.length === 0) &&
      event.lastMilestone === undefined &&
      event.deviceSource === "live" &&
      event.msSinceBootStart === "unknown" &&
      isPlainObject(event.error);
    if (!linked && !preInit) return "uncorroborated";
  }

  // No P4 leg for the remaining types: recovery_outcome's P4d is
  // P1′∧P2∧P3′-client (tierOf still decides that only repeat_failure
  // pages); boot_failure, hiccup and funnel types are P1′∧P2∧P3′ only.
  return "corroborated";
}

const VALID_RECOVERY_OUTCOMES = new Set([
  "confirmed",
  "repeat_failure",
  "stood_down",
  "unconfirmed_closed",
  "unconfirmed_died",
  "unconfirmed_expired",
  "marker_unreadable",
]);

/**
 * Presentation-only helper (§5.4): the names of the classifier stamps
 * whose rule-4 predicate fails for this event, in stamp order. It never
 * feeds the classifier. For the two shapes the classifier can return
 * missing_fields on stamp grounds (suspected_crash, recovery_outcome),
 * the returned set is non-empty exactly when the classifier returns
 * missing_fields — a property the tests pin over the fixture tables.
 */
export function missingStampNames(facts: CrashVerdictFacts): string[] {
  if (facts.type === "recovery_outcome") {
    return typeof facts.recoveryOutcome === "string" &&
      VALID_RECOVERY_OUTCOMES.has(facts.recoveryOutcome)
      ? []
      : ["recoveryOutcome"];
  }
  if (facts.type !== "suspected_crash") return [];
  const missing: string[] = [];
  if (typeof facts.bgTerminal !== "boolean") missing.push("bgTerminal");
  if (typeof facts.buildReplaced !== "boolean") missing.push("buildReplaced");
  if (typeof facts.trailStuck !== "boolean") missing.push("trailStuck");
  if (typeof facts.lcV !== "string" || facts.lcV.length === 0) missing.push("lcV");
  return missing;
}

// --- Alert surfaces (§5.3) ----------------------------------------------
//
// The headline/verdict/why/action wording above is owner-approved and
// stays verbatim. This section adds the lines that make an alert
// triageable in one read: priority, why-code, event time, the enriched
// (UA-parsed, collective label) device line, the runtime line, and the
// mode/boots lines.

const BROWSER_LABELS: Record<string, string> = {
  safari: "Safari",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  samsung: "Samsung",
  unknown: "unknown",
};

const ENGINE_LABELS: Record<string, string> = {
  webkit: "WebKit",
  blink: "Blink",
  gecko: "Gecko",
  unknown: "unknown",
};

const OS_LABELS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  other: "other",
  unknown: "unknown",
};

function deviceRecord(event: CrashReportEvent): Record<string, unknown> {
  return isPlainObject(event.device) ? event.device : {};
}

function deviceString(dev: Record<string, unknown>, key: string): string {
  const v = dev[key];
  return typeof v === "string" && v ? v : "unknown";
}

/**
 * The enriched device line: the legacy os/form bucket first (existing
 * surfaces key on it), then class, browser, engine, and OS version —
 * all parsed values under one collective (UA-parsed) label (§1.3).
 */
export function enrichedDeviceLine(event: CrashReportEvent): string {
  const dev = deviceRecord(event);
  const browser = BROWSER_LABELS[deviceString(dev, "browser")] ?? "unknown";
  const engine = ENGINE_LABELS[deviceString(dev, "engine")] ?? "unknown";
  const os = OS_LABELS[deviceString(dev, "os")] ?? "unknown";
  return (
    `${deviceBucketOf(event)} · ${deviceString(dev, "deviceClass")} · ` +
    `${browser} ${deviceString(dev, "browserVersion")} · ${engine} · ` +
    `${os} ${deviceString(dev, "osVersion")} (UA-parsed)`
  );
}

/** The runtime line: as-read session values, never grouped or ranked. */
export function runtimeLine(event: CrashReportEvent): string {
  const dev = deviceRecord(event);
  const mem = typeof dev.deviceMemory === "number" ? String(dev.deviceMemory) : "unknown";
  const cores =
    typeof dev.hardwareConcurrency === "number"
      ? `${dev.hardwareConcurrency} (as reported)`
      : "unknown";
  const dpr = typeof dev.dpr === "number" ? String(dev.dpr) : deviceString(dev, "dpr");
  return (
    `mem ${mem} · cores ${cores} · screen ${deviceString(dev, "screen")} · ` +
    `dpr ${dpr} · touch ${deviceString(dev, "touchPoints")} · ` +
    `standalone ${deviceString(dev, "displayMode")} · net ${deviceString(dev, "connection")} · ` +
    `locale ${deviceString(dev, "locale")}`
  );
}

export type PriorityCode = "P1" | "P2" | "P3" | "P4";

export interface PriorityRead {
  code: PriorityCode;
  text: string;
}

/**
 * The priority read (§5.3 table, first match wins). P1 requires the
 * current build (buildReplaced === false) AND a gameplay last step.
 * The text is assembled from stamped facts only.
 */
export function priorityRead(event: CrashReportEvent): PriorityRead {
  const { verdict, whyKey } = deriveVerdict(event);
  const facts = verdictFactsOf(event);
  const code: PriorityCode =
    verdict === "developer_needed" &&
    facts.buildReplaced === false &&
    typeof event.lastMilestone === "string" &&
    GAMEPLAY_MILESTONES.has(event.lastMilestone)
      ? "P1"
      : verdict === "developer_needed" || whyKey === "recovery_failed"
        ? "P2"
        : verdict === "insufficient_evidence"
          ? "P3"
          : "P4";
  const parts: string[] = [];
  if (facts.buildReplaced === false) parts.push("current build");
  else if (facts.buildReplaced === true) parts.push("replaced build");
  switch (whyKey) {
    case "fg_kill_current":
    case "fg_kill_replaced":
      parts.push(`foreground kill at ${lastStepWords(event.lastMilestone)}`);
      break;
    case "captured_error":
      parts.push(
        event.error
          ? `captured error at ${lastStepWords(event.lastMilestone)}`
          : "captured-error type with no error details",
      );
      break;
    case "recovery_failed":
      parts.push("recovery failed after a reload");
      break;
    case "recovery_confirmed":
      parts.push("recovery confirmed");
      break;
    case "bg_close":
      parts.push("closed from the background");
      break;
    case "bg_stuck":
      parts.push("backgrounded while stuck");
      break;
    case "missing_fields":
      parts.push("evidence incomplete");
      break;
    default:
      parts.push(`ended at ${lastStepWords(event.lastMilestone)}`);
  }
  const dev = deviceRecord(event);
  const deviceClass = deviceString(dev, "deviceClass");
  const os = deviceString(dev, "os");
  if (deviceClass !== "unknown" && os !== "unknown") {
    const osVersion = deviceString(dev, "osVersion");
    const major = osVersion === "unknown" ? "" : ` ${osVersion.split(".")[0]}`;
    parts.push(`${deviceClass}-class ${OS_LABELS[os] ?? os}${major}`);
  }
  return { code, text: parts.join(", ") };
}

// --- Severity grades (issue #345) ---------------------------------------
//
// The verdict says WHETHER a human is needed; the severity grade says
// HOW BAD it is, in player-impact terms. severityOf consumes the
// worker's own re-derived verdict plus one stamped fact — the durable
// unfinished-boot streak (unfinishedBoots, §4.3) — and nothing else:
// first match wins, and it fails closed. insufficient_evidence and
// not_a_real_issue are NEVER graded, whatever the streak: a missing-
// evidence report must not be inflated into an impact claim, and a
// positively benign one needs no grade. Severity never feeds back
// into the verdict or the P1–P4 triage mapping; it only leads them.
//
// The streak is the honest proxy for "the player left": under the
// counts-only privacy model a literal no-return is unobservable, so
// S1's wording labels the inference as inferred, never observed
// (owner sourcing rule, 2026-11-04).

export type SeverityGrade = "S1" | "S2a" | "S2b" | "S3";

/** The S1/S2a streak threshold (owner pick, 2026-11-04: ≥3, not ≥2). */
export const SEVERITY_STREAK_THRESHOLD = 3;

export interface SeverityRead {
  grade: SeverityGrade;
  /** The one `Severity: …` clause the alert's why line gains. */
  clause: string;
  /** The stamped streak the grade derived from (null = not stamped). */
  streak: number | null;
}

/**
 * Grade one event's severity from its re-derived verdict + streak.
 * Returns null for the two ungraded verdicts — absolutely, at any
 * streak.
 */
export function severityOf(event: CrashReportEvent): SeverityRead | null {
  const { verdict } = deriveVerdict(event);
  if (verdict !== "developer_needed" && verdict !== "auto_fixed") return null;
  // normaliseEvent already clamps the stamp to an integer 0..999 and
  // deletes non-numbers; re-checking here keeps direct callers honest.
  const streak =
    typeof event.unfinishedBoots === "number" && Number.isFinite(event.unfinishedBoots)
      ? Math.max(0, Math.floor(event.unfinishedBoots))
      : null;
  const repeated = streak !== null && streak >= SEVERITY_STREAK_THRESHOLD;
  if (verdict === "developer_needed") {
    if (repeated) {
      return {
        grade: "S1",
        streak,
        clause:
          `Severity: S1 — ${streak} unfinished boots in a row with no clean boot since; ` +
          `the player most likely left and never got back in (player-left is INFERRED ` +
          `from the missing clean boot, not observed).`,
      };
    }
    return {
      grade: "S2b",
      streak,
      clause:
        streak === null
          ? `Severity: S2b — a developer is needed, but the boot streak was not stamped ` +
            `on this report, so it cannot be graded S1.`
          : `Severity: S2b — a developer is needed; the boot streak is ${streak}, ` +
            `below the S1 threshold of ${SEVERITY_STREAK_THRESHOLD} unfinished boots in a row.`,
    };
  }
  // verdict === "auto_fixed": a confirmed recovery. The grade splits
  // on whether the recovery came only after a repeated-failure streak.
  if (repeated) {
    return {
      grade: "S2a",
      streak,
      clause:
        `Severity: S2a — it recovered, but only after ${streak} unfinished boots in a row.`,
    };
  }
  return {
    grade: "S3",
    streak,
    clause:
      streak === null
        ? `Severity: S3 — it fixed itself; no boot streak was stamped on this report.`
        : `Severity: S3 — it fixed itself; the boot streak was ${streak}, ` +
          `below the repeat threshold of ${SEVERITY_STREAK_THRESHOLD}.`,
  };
}

/** Bucket key for the digest's counted severities dimension (#345). */
export function severityKeyOf(event: CrashReportEvent): string {
  return severityOf(event)?.grade ?? "ungraded";
}

/**
 * The evidence line (§5.3 graft): one ✓/✗ per classifier stamp, as
 * received, using the same predicates rule 4 checks. Rendered only
 * for missing_fields, so different missing sets read differently.
 */
export function evidenceText(event: CrashReportEvent): string {
  const facts = verdictFactsOf(event);
  if (event.type === "recovery_outcome") {
    const ok =
      typeof facts.recoveryOutcome === "string" &&
      VALID_RECOVERY_OUTCOMES.has(facts.recoveryOutcome);
    return `recoveryOutcome ${ok ? "✓" : "✗"}`;
  }
  const stamps: Array<[string, boolean]> = [
    ["bgTerminal", typeof facts.bgTerminal === "boolean"],
    ["buildReplaced", typeof facts.buildReplaced === "boolean"],
    ["trailStuck", typeof facts.trailStuck === "boolean"],
    ["lcV", typeof facts.lcV === "string" && facts.lcV.length > 0],
  ];
  return stamps.map(([name, ok]) => `${name} ${ok ? "✓" : "✗"}`).join(" · ");
}

export interface CrashAlert {
  discord: string;
  emailSubject: string;
  emailBody: string;
}

/**
 * Build the forwarded alert from a validated event. Only coarse,
 * non-identifying fields are included: type, buildId, edition/region,
 * lastMilestone, and a truncated error name/message. sessionId, UA,
 * device facts, breadcrumb history, and coordinates are NEVER included.
 */
/**
 * Council fix T5: versioned, structured failure line built ONLY from
 * fields the client already sends (manifest). It separates what was
 * observed from what is unknown and never names a root cause. Fields
 * that would need new collection are listed as not collected.
 */
export function failureLine(event: CrashReportEvent): string {
  const phase = event.lastMilestone
    ? `last reported step ${lastStepWords(event.lastMilestone)}`
    : "phase unavailable (no last step stamped)";
  const age =
    typeof event.msSinceBootStart === "number"
      ? `boot age ${event.msSinceBootStart.toLocaleString("en-US")} ms`
      : "boot age unavailable";
  const dev = deviceRecord(event);
  const deviceKnown = deviceString(dev, "os") !== "unknown" || deviceString(dev, "browser") !== "unknown";
  return (
    `failure(v1): domain client (reported) · origin client-shaped, not authenticated · ${phase} · ` +
    `error ${event.error ? "present" : "absent"} · ${age} · device facts ${deviceKnown ? "present" : "absent"} · ` +
    `cause unconfirmed · not collected: request status, server timing, phase timeline`
  );
}

export function buildAlert(event: CrashReportEvent): CrashAlert {
  const type = event.type;
  const buildId = truncate(event.buildId, 64);
  const edition = truncate(event.edition, 64);
  const region = truncate(event.regionId, 64);
  const lastStep = lastStepWords(event.lastMilestone);
  const errorLine = event.error
    ? `${scrubErrorText(event.error.name, 60) || "—"} — ${scrubErrorText(event.error.message, 140) || "—"}`
    : "none captured";
  // The device line starts from the coarse os/form bucket (COPPA) and
  // adds the parsed manifest facts — never raw UA or precise facts.
  // The bucket derivation is shared with the Phase 1 counters.

  // Slice 1: the authoritative verdict, re-derived here from the
  // event's stamped facts. A verdict/whyKey stamped by the client is an
  // untrusted cross-check and is never rendered (design §2.5/F9).
  const { verdict, whyKey } = deriveVerdict(event);
  const presentation = VERDICT_PRESENTATION[verdict];
  // Issue #345: the why line gains one Severity clause when the
  // verdict is graded; ungraded verdicts gain none (their why already
  // says why no grade exists).
  const severity = severityOf(event);
  const why = whyLineFor(whyKey, event);
  const whyText = severity ? `${why} ${severity.clause}` : why;
  const actionLine =
    verdict !== "developer_needed"
      ? ""
      : whyKey === "captured_error" && !event.error
        ? "action: No error details were captured; read the facts below.\n"
        : "action: Read the error below.\n";
  // The 🚨 stays in the no-action title for findability (design §5.1) —
  // the verdict line above it carries the real signal.
  const title = verdict === "not_a_real_issue" ? "🚨 Meridian crash report" : "Meridian crash report";

  // §5.3 lines. priority: is always line 3 of the Discord alert; the
  // evidence: line appears only for missing_fields, right after why:.
  const priority = priorityRead(event);
  // Issue #345: severity leads the priority line; an ungraded verdict
  // renders the literal "ungraded" (that is the absence of a grade,
  // not a fifth grade). The P1–P4 code and its text are unchanged.
  const priorityText = `${severity ? severity.grade : "ungraded"} · ${priority.code} — ${priority.text}`;
  const evidenceLine = whyKey === "missing_fields" ? `evidence: ${evidenceText(event)}\n` : "";
  const eventTime = new Date(event.ts).toISOString();
  const modeText =
    typeof event.mapMode === "string" && event.mapMode ? event.mapMode : "unknown";
  const msText =
    typeof event.msSinceBootStart === "number"
      ? ` · ${event.msSinceBootStart.toLocaleString("en-US")} ms after boot start`
      : "";
  const bootsText =
    typeof event.unfinishedBoots === "number"
      ? `${event.unfinishedBoots} unfinished in a row`
      : "—";
  const deviceText = enrichedDeviceLine(event);
  const runtimeText = runtimeLine(event);

  const discord =
    `${presentation.headline}\n` +
    `${title}\n` +
    `priority: ${priorityText}\n` +
    `verdict: ${presentation.label}\n` +
    `why: ${whyText}\n` +
    evidenceLine +
    `why-code: ${whyKey}\n` +
    actionLine +
    `${failureLine(event)}\n` +
    `type: ${type} · build: ${buildId}\n` +
    `time: ${eventTime}\n` +
    `device: ${deviceText}\n` +
    `runtime: ${runtimeText}\n` +
    `edition: ${edition} · region: ${region}\n` +
    `mode: ${modeText} · last step: ${lastStep}${msText}\n` +
    `boots: ${bootsText}\n` +
    `error: ${errorLine}`;
  const discordContent = discord.length > 1500 ? `${discord.slice(0, 1499)}…` : discord;

  const emailSubject = `[Meridian] ${presentation.headline} · ${type} · build ${buildId} · ${edition}`;
  const emailBody =
    `Meridian crash report\n\n` +
    `verdict: ${presentation.label}\n` +
    `priority: ${priorityText}\n` +
    `why: ${whyText}\n` +
    evidenceLine +
    `why-code: ${whyKey}\n` +
    actionLine +
    `${failureLine(event)}\n` +
    `type:            ${type}\n` +
    `build:           ${buildId}\n` +
    `event time:      ${eventTime}\n` +
    `device:          ${deviceText}\n` +
    `runtime:         ${runtimeText}\n` +
    `edition:         ${edition}\n` +
    `region:          ${region}\n` +
    `mode:            ${modeText}\n` +
    `last step:       ${lastStep}${msText}\n` +
    `boots:           ${bootsText}\n` +
    `error:           ${errorLine}\n\n` +
    `(Compact alert — full event payloads are never forwarded.)`;

  return { discord: discordContent, emailSubject, emailBody };
}

// --- Forwarders --------------------------------------------------------

function logLine(...parts: unknown[]): void {
  try {
    console.log(
      JSON.stringify({
        kind: "meridian-crash-report",
        receivedAt: new Date().toISOString(),
        parts,
      }),
    );
  } catch {
    // Logging must never break the request path.
  }
}

/** fetch with a hard timeout so a slow downstream cannot hang the worker. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Council fix T3 (2026-11-08): every send reports what actually
// happened. "provider_accepted" = the provider returned 2xx (not proof a
// human read it); "failed" = a definite non-2xx or a rejected request;
// "unknown" = timed out / aborted, so the provider may or may not have it.
// One bounded retry, only on 429/5xx (a definite "not taken"), never on
// "unknown" (that could duplicate a page). Failures are logged and
// recorded; they never trigger another alert (no recursion).
export type DeliveryState = "provider_accepted" | "failed" | "unknown" | "not_configured";

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 2_000;
const DEFAULT_RETRY_WAIT_MS = 500;

let sleepFn: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms));

/** Test hook: replace the retry back-off sleep (tests pass a no-op). */
export function setSleepForTests(fn: (ms: number) => Promise<void>): void {
  sleepFn = fn;
}

function retryWaitMs(res: Response): number {
  const h = Number(res.headers.get("retry-after"));
  return Number.isFinite(h) && h >= 0 ? Math.min(h * 1000, MAX_RETRY_WAIT_MS) : DEFAULT_RETRY_WAIT_MS;
}

async function postWithRetry(label: string, url: string, init: RequestInit): Promise<DeliveryState> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (res.ok) return "provider_accepted";
      logLine(`${label} forward failed`, res.status);
      if (attempt === 0 && RETRY_STATUSES.has(res.status)) {
        await sleepFn(retryWaitMs(res));
        continue;
      }
      return "failed";
    } catch (err) {
      const name = err instanceof Error ? err.name : "unknown";
      logLine(`${label} forward error`, name);
      return name === "AbortError" || name === "TimeoutError" ? "unknown" : "failed";
    }
  }
  return "failed";
}

async function forwardToDiscord(webhookUrl: string, content: string): Promise<DeliveryState> {
  return postWithRetry("discord", webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Council fix T1: never let report text ping @everyone/@here/users.
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
}

async function forwardToEmail(
  env: CrashReportEnv,
  subject: string,
  text: string,
): Promise<DeliveryState> {
  return postWithRetry("email", RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.REPORT_FROM?.trim() || DEFAULT_REPORT_FROM,
      to: [env.REPORT_EMAIL],
      subject,
      text,
    }),
  });
}

/** KV key + TTL for the last real-crash delivery outcome (ops evidence). */
export const DELIVERY_RECORD_KEY = "ops:delivery:last";
export const OPS_RECORD_TTL_SECONDS = 7 * 24 * 3600;

/**
 * Best-effort record of the last real-crash delivery outcome. Holds only
 * channel states and a time — no webhook URL, no event content. A write
 * failure is logged and swallowed (never an alert).
 */
async function recordDelivery(
  kv: KvLike | undefined,
  results: Partial<Record<"discord" | "email", DeliveryState>>,
  now: number,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(
      DELIVERY_RECORD_KEY,
      JSON.stringify({ v: 1, at: new Date(now).toISOString(), ...results }),
      { expirationTtl: OPS_RECORD_TTL_SECONDS },
    );
  } catch (err) {
    logLine("delivery record failed", err instanceof Error ? err.name : "unknown");
  }
}

// --- Council fix T2 (2026-11-08): bounded unverified summary ------------
//
// When the counter store is missing or failing, an uncorroborated
// crash-tier report can neither be counted nor escalated through the
// can't-tell leg. Paging it individually (the old !counted fail-open)
// let any probe page; dropping it silently would lose legacy clients.
// Instead each worker isolate keeps an in-memory tally and sends at most
// one summary per 15-minute window. Honest bound: <= 4/hour PER ISOLATE
// (isolates are not countable from inside), counts are lower bounds
// (an evicted isolate loses its tally), and the optional
// CRASH_RATE_LIMITER binding adds a best-effort cross-isolate ceiling.

export const SUMMARY_WINDOW_MS = 15 * 60_000;
const MAX_SUMMARY_PATTERNS = 16;

export class UncorroboratedSummary {
  private windowStart = -1;
  private sent = false;
  private counts = new Map<string, number>();
  private total = 0;
  private previousTotal = 0;

  /** Tally one report; returns summary text when this window has not sent yet. */
  record(event: CrashReportEvent, now: number): string | null {
    const ws = Math.floor(now / SUMMARY_WINDOW_MS) * SUMMARY_WINDOW_MS;
    if (ws !== this.windowStart) {
      this.previousTotal = this.windowStart < 0 ? 0 : this.total;
      this.windowStart = ws;
      this.sent = false;
      this.counts = new Map();
      this.total = 0;
    }
    const key = `${event.type} · ${scrubErrorText(String(event.buildId), 24) || "—"}`;
    const k = this.counts.has(key) || this.counts.size < MAX_SUMMARY_PATTERNS ? key : "other";
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
    this.total += 1;
    if (this.sent) return null;
    this.sent = true;
    const from = new Date(ws).toISOString().slice(11, 16);
    const to = new Date(ws + SUMMARY_WINDOW_MS).toISOString().slice(11, 16);
    const patterns = [...this.counts.entries()].map(([p, n]) => `${p} ×${n}`).join(", ");
    const text =
      `❔ Unverified crash-type reports while telemetry storage is unavailable\n` +
      `window: ${from}–${to} UTC (this worker instance only, best-effort)\n` +
      `this window so far: ≥${this.total} (${patterns})\n` +
      (this.previousTotal > 0 ? `previous window: ≥${this.previousTotal}\n` : "") +
      `Not paged one by one: they did not match a real client's report shape. ` +
      `Real-client-shaped crashes still page. Sender not identified. ` +
      `Counts are lower bounds and could not be stored.`;
    return text.length > 1800 ? `${text.slice(0, 1799)}…` : text;
  }
}

let uncorroboratedSummary = new UncorroboratedSummary();

export type IngestRoute =
  | "paged"
  | "counted_only"
  | "summarized_kv_unavailable"
  | "summary_suppressed";

export interface IngestOutcome {
  provenance: Provenance;
  counted: boolean;
  route: IngestRoute;
  deliveries: Partial<Record<"discord" | "email", DeliveryState>>;
}

let lastIngestOutcome: IngestOutcome | null = null;

/** Test hook: the last /ingest routing outcome (never in the HTTP body). */
export function lastIngestOutcomeForTests(): IngestOutcome | null {
  return lastIngestOutcome;
}

/** Test hook: reset per-isolate ingest state between tests. */
export function resetIngestStateForTests(): void {
  uncorroboratedSummary = new UncorroboratedSummary();
  lastIngestOutcome = null;
}

/** Minimal ExecutionContext surface (Cloudflare passes the real one). */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Run background work: with a real context it continues after the
 * response via waitUntil; without one (tests, direct callers) it is
 * awaited so nothing is silently dropped.
 */
async function runInBackground(ctx: ExecutionContextLike | undefined, work: Promise<unknown>): Promise<void> {
  const guarded = work.catch((err) => logLine("background task failed", err instanceof Error ? err.name : "unknown"));
  if (ctx) ctx.waitUntil(guarded);
  else await guarded;
}

/** Severity tiers (Phase 1 telemetry, 2026-10-17).
 *
 * - crash-class: signals that the app itself is failing for a user.
 *   Forwarded to Discord IMMEDIATELY, exactly like before Phase 1.
 * - hiccup-class: resource/telemetry signals (`tile_failed` fired in
 *   production on plain tile CDN hiccups; `webgl_context_lost` fires when
 *   a mobile OS reclaims the GPU context on backgrounding — both are
 *   usually benign/transient). Counted, NOT forwarded individually;
 *   they surface through the threshold alert and the hourly digest.
 * - funnel-class (#194 wave 2): the storyteller/narration funnel
 *   (`storyteller_shown`, `narration_*`) — engagement telemetry, not a
 *   failure signal. Same counted-only handling as hiccup-class: never
 *   forwarded individually (a 🚨 per narration would train readers to
 *   ignore the channel). Routine funnel types surface via the hourly
 *   digest only — they never trip the threshold alert (#311); the one
 *   exception is `narration_failed`, whose spikes keep the threshold
 *   alert. The tier name stays "hiccup" — it means counted-only.
 */
export const CRASH_CLASS_TYPES = [
  "suspected_crash",
  "boot_failure",
  "js_error",
  "unhandled_rejection",
  "map_error",
] as const;

export const HICCUP_CLASS_TYPES = ["tile_failed", "webgl_context_lost"] as const;

/** Funnel-class types (#194 wave 2): counted only, via the hiccup tier. */
export const FUNNEL_CLASS_TYPES = [
  "storyteller_shown",
  "narration_started",
  "narration_completed",
  "narration_replayed",
  "narration_failed",
  "narration_dismissed",
] as const;

/**
 * Routine funnel types exempt from the threshold alert (#311). They are
 * engagement volume, not failures: paging Discord for them trained
 * readers to ignore the channel. `narration_failed` is DELIBERATELY
 * excluded — a spike in it is real signal, and the threshold alert is
 * how it surfaces (see the funnel-class comment above and the README
 * rationale). Exempt types are still counted and still appear in the
 * hourly digest; only the threshold alert is suppressed.
 */
const THRESHOLD_EXEMPT_FUNNEL_TYPES = FUNNEL_CLASS_TYPES.filter(
  (type) => type !== "narration_failed",
);

export type TelemetryTier = "crash" | "hiccup";

/**
 * Classify an event type into its severity tier. Slice 2:
 * `recovery_outcome` is crash-class ONLY for `repeat_failure`; every
 * other outcome value — and a missing/invalid one — is counted-only
 * (fail closed, Manifest A6/F8). Funnel-class types (#194 wave 2) are
 * counted-only like hiccup-class. All other types are crash-class.
 */
export function tierOf(type: CrashReportEventType, recoveryOutcome?: string): TelemetryTier {
  if (type === "recovery_outcome") {
    return recoveryOutcome === "repeat_failure" ? "crash" : "hiccup";
  }
  if ((FUNNEL_CLASS_TYPES as readonly string[]).includes(type)) return "hiccup";
  return (HICCUP_CLASS_TYPES as readonly string[]).includes(type) ? "hiccup" : "crash";
}

// --- Phase 1: counting, threshold alerts, hourly digest -----------------
//
// Store: Cloudflare Workers KV, one key per (UTC hour × event type).
// Why KV and not Analytics Engine: the threshold check and the digest
// need read-your-writes on the CURRENT hour's count during the ingest
// request; Analytics Engine reads are eventual (minutes) and queryable
// only via its SQL API. KV is free-tier safe at this volume (each event
// is 1 GET + 1 PUT), needs no new paid services, and keeps everything
// in worker code behind a single binding.
// Approximation accepted: read-modify-write races between isolates can
// lose increments under concurrency — this is signal, not billing.
// Privacy: buckets contain COUNTS ONLY, keyed by the same coarse
// dimensions the alert already carries (type, build, edition, region,
// os/form device bucket). No sessionId, no UA, no IPs, no payloads.

export const HOUR_MS = 3_600_000;
/** Council fix T4: counter retention (proposal default, documented in README). */
export const COUNT_BUCKET_TTL_SECONDS = 90 * 24 * 3600;
export const TRAILING_BASELINE_HOURS = 24;
export const ANOMALY_RATIO = 3;
export const ANOMALY_MIN_COUNT = 3;

export const DEFAULT_THRESHOLD_PER_HOUR = 20;
export const DEFAULT_THRESHOLD_PER_BUILD = 10;

export interface CountBucket {
  total: number;
  builds: Record<string, number>;
  editions: Record<string, number>;
  regions: Record<string, number>;
  devices: Record<string, number>;
  /** "<buildId>|<os>|<osMajor>|<deviceClass>" — hard-capped (§5.2). */
  groups: Record<string, number>;
  /** "<verdict>/<whyKey>" from the worker's re-derived verdict. */
  verdicts: Record<string, number>;
  /** Severity grades (#345): "S1" | "S2a" | "S2b" | "S3" | "ungraded". */
  severities: Record<string, number>;
  milestones: Record<string, number>;
  modes: Record<string, number>;
  /** Error names only — never messages. */
  errorNames: Record<string, number>;
  /** Min/max RECEIPT time in the bucket (0 = none recorded). */
  firstAt: number;
  lastAt: number;
  /** Events whose client ts fell outside the receipt hour. */
  late: number;
  /** Alert ids already fired for this bucket (exact-once per type+hour). */
  alerts: string[];
  /** Provenance dim: keys are exactly "corroborated" | "uncorroborated". */
  provenance: Record<string, number>;
  /** Builds map, corroborated events only — the threshold predicate's input. */
  corrBuilds: Record<string, number>;
  /** Candidate-only group counts (pattern counts for the can't-tell legs). */
  cantTellGroups: Record<string, number>;
}

/** Hard cap on distinct group keys per bucket; the next tallies "other". */
export const MAX_GROUP_KEYS = 32;

export function emptyBucket(): CountBucket {
  return {
    total: 0,
    builds: {},
    editions: {},
    regions: {},
    devices: {},
    groups: {},
    verdicts: {},
    severities: {},
    milestones: {},
    modes: {},
    errorNames: {},
    firstAt: 0,
    lastAt: 0,
    late: 0,
    alerts: [],
    provenance: {},
    corrBuilds: {},
    cantTellGroups: {},
  };
}

/** Minimal KV surface — structurally satisfied by the real KVNamespace. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Council fix round 2 (F2/F3): every KV operation this worker awaits is
 * bounded. Each op races a per-op deadline; with a budget, the wrapper
 * also refuses any op once the budget is spent, and close() refuses all
 * later ops — so a request that has given up on the store can never START
 * a late write (an op already in flight cannot be cancelled: KV has no
 * abort, so a late in-flight write may still land). A timed-out op throws
 * TimeoutError, which every caller already treats as "store failing".
 */
export const KV_OP_TIMEOUT_MS = 1_500;
export const INGEST_COUNT_BUDGET_MS = 2_000;

export interface BoundedKv extends KvLike {
  close(): void;
}

export function boundedKv(kv: KvLike, opMs: number = KV_OP_TIMEOUT_MS, budgetMs?: number): BoundedKv {
  const startedAt = Date.now();
  let closed = false;
  const guard = <T>(op: () => Promise<T>): Promise<T> => {
    const left = budgetMs === undefined ? opMs : Math.min(opMs, budgetMs - (Date.now() - startedAt));
    if (closed || left <= 0) {
      return Promise.reject(Object.assign(new Error("store deadline passed"), { name: "TimeoutError" }));
    }
    let p: Promise<T>;
    try {
      p = Promise.resolve(op());
    } catch (err) {
      p = Promise.reject(err);
    }
    return withTimeout(p, left);
  };
  return {
    get: (key) => guard(() => kv.get(key)),
    put: (key, value, options) => guard(() => kv.put(key, value, options)),
    close: () => {
      closed = true;
    },
  };
}

/** Telemetry store abstraction (KV-backed in prod, in-memory in tests). */
export interface TelemetryStore {
  readBucket(key: string): Promise<CountBucket | null>;
  writeBucket(key: string, bucket: CountBucket): Promise<void>;
}

/** UTC hour bucket start (epoch ms) for a timestamp. */
export function hourBucketStart(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

/** UTC hour label, e.g. "2026-10-17T21". */
export function hourLabelOf(ts: number): string {
  return new Date(hourBucketStart(ts)).toISOString().slice(0, 13);
}

/** KV key for one (hour × type) bucket. */
export function bucketKey(hourLabel: string, type: string): string {
  return `tel:counts:${hourLabel}:${type}`;
}

/** Coarse os/form device bucket — the same derivation buildAlert uses. */
export function deviceBucketOf(event: CrashReportEvent): string {
  const dev = event.device as { os?: string; form?: string } | undefined;
  return dev ? `${truncate(dev.os ?? "?", 24)}/${truncate(dev.form ?? "?", 24)}` : "—";
}

/** Per-key numeric guard for a stored count map (provenance dim). */
function numericRecord(value: unknown): Record<string, number> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function kvTelemetryStore(kv: KvLike): TelemetryStore {
  return {
    async readBucket(key: string): Promise<CountBucket | null> {
      const raw = await kv.get(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<CountBucket>;
        if (parsed && typeof parsed.total === "number") {
          // Read-tolerant (§5.2): buckets written by older code lack
          // the v2 fields and default to empty maps / zero times.
          // Council fix T4: every count map is numerically normalised
          // (a corrupt or hand-edited value can never feed the threshold
          // or can't-tell predicates as a string/object).
          return {
            total: parsed.total,
            builds: numericRecord(parsed.builds),
            editions: numericRecord(parsed.editions),
            regions: numericRecord(parsed.regions),
            devices: numericRecord(parsed.devices),
            groups: numericRecord(parsed.groups),
            verdicts: numericRecord(parsed.verdicts),
            severities: numericRecord(parsed.severities),
            milestones: numericRecord(parsed.milestones),
            modes: numericRecord(parsed.modes),
            errorNames: numericRecord(parsed.errorNames),
            firstAt: typeof parsed.firstAt === "number" ? parsed.firstAt : 0,
            lastAt: typeof parsed.lastAt === "number" ? parsed.lastAt : 0,
            late: typeof parsed.late === "number" ? parsed.late : 0,
            alerts: Array.isArray(parsed.alerts)
              ? parsed.alerts.filter((a): a is string => typeof a === "string").slice(0, 256)
              : [],
            provenance: numericRecord(parsed.provenance),
            corrBuilds: numericRecord(parsed.corrBuilds),
            cantTellGroups: numericRecord(parsed.cantTellGroups),
          };
        }
      } catch {
        // Corrupt bucket: treat as absent; the next write replaces it.
      }
      return null;
    },
    async writeBucket(key: string, bucket: CountBucket): Promise<void> {
      // Council fix T4: hour buckets expire (they are inert after the
      // digest + 24 h trailing window). Existing keys written before this
      // change keep no TTL; nothing here deletes historical data.
      await kv.put(key, JSON.stringify(bucket), { expirationTtl: COUNT_BUCKET_TTL_SECONDS });
    },
  };
}

export interface ThresholdConfig {
  perHour: number;
  perBuild: number;
}

function readIntEnv(value: string | undefined, fallback: number): number {
  const n = value === undefined ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Thresholds: code defaults, env-overridable (see README). */
export function thresholdConfig(env: CrashReportEnv): ThresholdConfig {
  return {
    perHour: readIntEnv(env.TELEMETRY_THRESHOLD_PER_HOUR, DEFAULT_THRESHOLD_PER_HOUR),
    perBuild: readIntEnv(env.TELEMETRY_THRESHOLD_PER_BUILD, DEFAULT_THRESHOLD_PER_BUILD),
  };
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/** Group key (§5.2): build × OS × OS major × device class. */
export function groupKeyOf(event: CrashReportEvent): string {
  const dev = (event.device ?? {}) as { os?: unknown; osVersion?: unknown; deviceClass?: unknown };
  const os = typeof dev.os === "string" && dev.os ? dev.os : "unknown";
  const osMajor =
    typeof dev.osVersion === "string" && dev.osVersion && dev.osVersion !== "unknown"
      ? dev.osVersion.split(".")[0]
      : "unknown";
  const deviceClass =
    typeof dev.deviceClass === "string" && dev.deviceClass ? dev.deviceClass : "unknown";
  return `${event.buildId}|${os}|${osMajor}|${deviceClass}`;
}

/**
 * Bump a group key under the hard cap: a 33rd distinct key is "other".
 * Returns the key actually tallied ("other" included) so the caller
 * reads the cap decision from its one owner.
 */
function bumpGroup(groups: Record<string, number>, key: string): string {
  if (key in groups || Object.keys(groups).length < MAX_GROUP_KEYS) {
    bump(groups, key);
    return key;
  }
  bump(groups, "other");
  return "other";
}

export interface TelemetryRecordResult {
  counted: boolean;
  alerted: boolean;
  alertTexts: string[];
}

/**
 * Record one accepted event into its (hour × type) bucket and check the
 * hiccup threshold. Fail-open: never throws; on any store error the
 * event is simply not counted and the request path continues.
 */
export async function recordTelemetry(
  store: TelemetryStore | null,
  event: CrashReportEvent,
  now: number,
  cfg: ThresholdConfig,
  provenance: Provenance,
): Promise<TelemetryRecordResult> {
  // Fail-closed (R1): an invalid/missing provenance counts uncorroborated.
  const prov: Provenance = provenance === "corroborated" ? "corroborated" : "uncorroborated";
  if (!store) return { counted: false, alerted: false, alertTexts: [] };
  try {
    const hour = hourLabelOf(now);
    const key = bucketKey(hour, event.type);
    const bucket = (await store.readBucket(key)) ?? emptyBucket();
    bucket.total += 1;
    bump(bucket.builds, event.buildId);
    bump(bucket.editions, event.edition ?? "—");
    bump(bucket.regions, event.regionId ?? "—");
    bump(bucket.devices, deviceBucketOf(event));
    // Counting v2 (§5.2): groups, the shared re-derived verdict,
    // milestones, modes, error names, and receipt-time first/last.
    const groupKey = groupKeyOf(event);
    bumpGroup(bucket.groups, groupKey);
    // Provenance dims: every event counts under its provenance; only
    // corroborated events count toward the threshold predicate's builds.
    bump(bucket.provenance, prov);
    if (prov === "corroborated") bump(bucket.corrBuilds, event.buildId);
    const { verdict, whyKey } = deriveVerdict(event);
    // Can't-tell candidates: crash-tier events that are uncorroborated,
    // or corroborated with an insufficient_evidence verdict. Their group
    // counts feed the escalation legs — and nothing else reads them.
    const isCandidate =
      tierOf(event.type, typeof event.recoveryOutcome === "string" ? event.recoveryOutcome : undefined) === "crash" &&
      (prov === "uncorroborated" || verdict === "insufficient_evidence");
    let pattern: string | undefined;
    let candidateTotal = 0;
    if (isCandidate) {
      pattern = bumpGroup(bucket.cantTellGroups, groupKey);
      candidateTotal = Object.values(bucket.cantTellGroups).reduce((a, b) => a + b, 0);
    }
    bump(bucket.verdicts, `${verdict}/${whyKey}`);
    // Counting (#345): the severity grade rides the same one
    // derivation per request — severityOf re-derives the verdict
    // internally, so the counted grade and the alert's grade are the
    // same function of the same event.
    bump(bucket.severities, severityKeyOf(event));
    bump(bucket.milestones, event.lastMilestone ?? "—");
    bump(bucket.modes, typeof event.mapMode === "string" && event.mapMode ? event.mapMode : "unknown");
    bump(bucket.errorNames, event.error ? scrubErrorText(event.error.name, 80) || "—" : "none");
    bucket.firstAt = bucket.firstAt === 0 ? now : Math.min(bucket.firstAt, now);
    bucket.lastAt = Math.max(bucket.lastAt, now);
    const hourStart = hourBucketStart(now);
    if (
      typeof event.ts === "number" &&
      (event.ts < hourStart || event.ts >= hourStart + HOUR_MS)
    ) {
      bucket.late += 1;
    }

    const alertTexts: string[] = [];
    const alertId = `threshold:${event.type}:${hour}`;
    // Threshold predicate reads corroborated counts only (R2):
    // uncorroborated events can neither trip it nor burn its slot.
    const corrPerBuild = bucket.corrBuilds[event.buildId] ?? 0;
    if (
      !(THRESHOLD_EXEMPT_FUNNEL_TYPES as readonly string[]).includes(event.type) &&
      !bucket.alerts.includes(alertId) &&
      ((bucket.provenance.corroborated ?? 0) >= cfg.perHour || corrPerBuild >= cfg.perBuild)
    ) {
      bucket.alerts.push(alertId);
      alertTexts.push(buildThresholdAlert(event.type, hour, bucket, cfg, corrPerBuild));
    }

    // Can't-tell escalation leg — cheapest legs first, in this order:
    // "other" never escalates · pattern count ≥3 · candidate total ≥5 ·
    // once per pattern+hour · trailing leg (>3× the pattern's trailing
    // 24h average). The 24 trailing reads are spent ONLY after the
    // cheap legs pass (read economy: ≤25 reads on an evaluating event).
    if (isCandidate && pattern !== undefined && pattern !== "other") {
      const patternCount = bucket.cantTellGroups[pattern] ?? 0;
      const cantTellId = `canttell:${event.type}:${hour}:${pattern}`;
      if (patternCount >= 3 && candidateTotal >= 5 && !bucket.alerts.includes(cantTellId)) {
        try {
          let trailing = 0;
          for (let h = 1; h <= TRAILING_BASELINE_HOURS; h++) {
            const older = await store.readBucket(
              bucketKey(hourLabelOf(now - h * HOUR_MS), event.type),
            );
            trailing += older?.cantTellGroups?.[pattern] ?? 0;
          }
          const trailingAvg = trailing / TRAILING_BASELINE_HOURS;
          if (patternCount > ANOMALY_RATIO * trailingAvg) {
            bucket.alerts.push(cantTellId);
            alertTexts.push(
              buildCantTellAlert(event.type, hour, pattern, patternCount, candidateTotal, trailingAvg),
            );
          }
        } catch {
          // A trailing-read failure skips the escalation for this event
          // only — it must not discard the count via the outer fail-open
          // catch (which would also flip counted and ungate the event).
        }
      }
    }
    await store.writeBucket(key, bucket);
    return { counted: true, alerted: alertTexts.length > 0, alertTexts };
  } catch (err) {
    logLine("telemetry count failed (fail-open)", event.type, err instanceof Error ? err.name : "unknown");
    return { counted: false, alerted: false, alertTexts: [] };
  }
}

/** Discord text for the once-per-type+hour threshold alert. */
export function buildThresholdAlert(
  type: string,
  hourLabel: string,
  bucket: CountBucket,
  cfg: ThresholdConfig,
  perBuild: number,
): string {
  const topBuilds = Object.entries(bucket.builds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([b, n]) => `${b} ×${n}`)
    .join(", ");
  const reason =
    perBuild >= cfg.perBuild && perBuild >= bucket.total / Object.keys(bucket.builds).length
      ? `single build crossed ${cfg.perBuild}/hour`
      : `${cfg.perHour}/hour across builds`;
  return (
    `🚨 Meridian telemetry alert\n` +
    `type: ${type} crossed the hiccup threshold (${reason})\n` +
    `hour: ${hourLabel} UTC · counts: ${bucket.total} total (${topBuilds})\n` +
    `one alert per type+hour — further events this hour only raise the counts\n` +
    `counts are at fire time; the hourly digest carries the final total`
  );
}

/**
 * Discord text for the can't-tell escalation. ❔ dress, Discord only,
 * never email. Carries no sessionId by construction — no such input.
 */
export function buildCantTellAlert(
  type: string,
  hourLabel: string,
  pattern: string,
  patternCount: number,
  candidateTotal: number,
  trailingAvg: number,
): string {
  return (
    `❔ Meridian can't-tell escalation\n` +
    `type: ${type} · pattern: ${pattern}\n` +
    `hour: ${hourLabel} UTC · pattern count: ${patternCount} · can't-tell candidates this hour: ${candidateTotal}\n` +
    `trailing 24h average for this pattern: ${trailingAvg.toFixed(1)} — this pattern is now more than ${ANOMALY_RATIO}× that\n` +
    `these reports could not be corroborated as real client sessions, so they were counted, not paged individually`
  );
}

// --- Hourly digest -------------------------------------------------------

/** Count-desc, then key-asc: the same order in every hour (§5.3). */
function sortedEntries(map: Record<string, number>): Array<[string, number]> {
  return Object.entries(map).sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
}

/**
 * Top-N of one counted dimension with its label applied by the caller.
 * A truncated dimension appends "(+N more)" with the true remainder —
 * N counts the hidden distinct keys. No silent caps anywhere (§5.3).
 */
function labelledTop(map: Record<string, number>, limit: number): string {
  const entries = sortedEntries(map);
  if (entries.length === 0) return "—";
  const shown = entries
    .slice(0, limit)
    .map(([k, n]) => `${k} ×${n}`)
    .join(" · ");
  const rest = entries.length - Math.min(limit, entries.length);
  return rest > 0 ? `${shown} (+${rest} more)` : shown;
}

function hhmmOf(ts: number): string {
  return ts > 0 ? new Date(ts).toISOString().slice(11, 16) : "—";
}

function renderTypeBlock(
  type: string,
  bucket: CountBucket,
  trailingAvg: number,
  anomalous: boolean,
): string {
  const flag = anomalous
    ? ` ⚠️ >${ANOMALY_RATIO}× 24h avg (${trailingAvg.toFixed(1)})`
    : "";
  // §5.3 graft: the receipt-vs-event hour displacement is labelled,
  // not silent.
  const late = bucket.late > 0 ? " (some reports arrived late)" : "";
  const errorMap = Object.fromEntries(
    Object.entries(bucket.errorNames).filter(([k]) => k !== "none"),
  );
  const errorsPart =
    Object.keys(errorMap).length > 0 ? ` · errors: ${labelledTop(errorMap, 2)}` : "";
  return (
    `${type} ${bucket.total} · first ${hhmmOf(bucket.firstAt)} · last ${hhmmOf(bucket.lastAt)}${late}${flag}\n` +
    `  builds: ${labelledTop(bucket.builds, 3)} · editions: ${labelledTop(bucket.editions, 2)} · regions: ${labelledTop(bucket.regions, 2)}\n` +
    `  groups: ${labelledTop(bucket.groups, 3)}\n` +
    `  verdicts: ${labelledTop(bucket.verdicts, 3)} · severities: ${labelledTop(bucket.severities ?? {}, 5)} · modes: ${labelledTop(bucket.modes, 2)} · steps: ${labelledTop(bucket.milestones, 2)}${errorsPart}`
  );
}

/**
 * The digest's one-line S1 gloss (#347 cure): the alert and email label
 * player-left INFERRED in the same sentence as the grade, but a digest
 * hour can carry bare `S1 ×N` counts with no such sentence — so when
 * the hour counted any S1, the digest gains this line, exactly once.
 */
export const S1_DIGEST_GLOSS =
  "S1 = player-left INFERRED from ≥3 unfinished boots with no clean boot — not observed.";

/** Whether any type in the hour counted at least one S1 event. */
function hourCountsS1(rows: Array<{ type: string; bucket: CountBucket }>): boolean {
  return rows.some(({ bucket }) => (bucket.severities?.S1 ?? 0) > 0);
}

/** Severity rank for the digest lead (#345): worst grade first. */
const SEVERITY_RANK: Record<string, number> = { S1: 0, S2a: 1, S2b: 2, S3: 3 };

/** The worst graded severity counted anywhere in the hour, if any. */
function worstSeverityOf(
  rows: Array<{ type: string; bucket: CountBucket }>,
): SeverityGrade | null {
  let worst: SeverityGrade | null = null;
  for (const { bucket } of rows) {
    for (const key of Object.keys(bucket.severities ?? {})) {
      const grade = key as SeverityGrade;
      if (
        (bucket.severities[key] ?? 0) > 0 &&
        key in SEVERITY_RANK &&
        (worst === null || SEVERITY_RANK[key] < SEVERITY_RANK[worst])
      ) {
        worst = grade;
      }
    }
  }
  return worst;
}

/**
 * The digest's priority line (§5.3): the highest-priority verdict in
 * the hour, with its top group. P1 needs a developer_needed verdict in
 * a bucket that also counted a gameplay last step. Issue #345: the
 * line leads with the hour's worst severity grade when the hour
 * counted any graded event (`S1 · P1 — …`), mirroring the alert.
 */
function digestPriorityLine(
  rows: Array<{ type: string; bucket: CountBucket }>,
): string | null {
  const topVerdict = (
    bucket: CountBucket,
    pred: (key: string) => boolean,
  ): [string, number] | undefined => sortedEntries(bucket.verdicts).find(([k]) => pred(k));
  let chosen: { code: PriorityCode; key: string; count: number; bucket: CountBucket } | null =
    null;
  // First pass: P1 — a developer_needed verdict in a bucket that also
  // counted a gameplay last step.
  for (const { bucket } of rows) {
    const dev = topVerdict(bucket, (k) => k.startsWith("developer_needed/"));
    if (dev && Object.keys(bucket.milestones).some((m) => GAMEPLAY_MILESTONES.has(m))) {
      chosen = { code: "P1", key: dev[0], count: dev[1], bucket };
      break;
    }
  }
  // Second pass: P2 — any other developer_needed verdict.
  if (!chosen) {
    for (const { bucket } of rows) {
      const dev = topVerdict(bucket, (k) => k.startsWith("developer_needed/"));
      if (dev) {
        chosen = { code: "P2", key: dev[0], count: dev[1], bucket };
        break;
      }
    }
  }
  if (!chosen) {
    for (const { bucket } of rows) {
      const ins = topVerdict(bucket, (k) => k.startsWith("insufficient_evidence/"));
      if (ins) {
        chosen = { code: "P3", key: ins[0], count: ins[1], bucket };
        break;
      }
    }
  }
  if (!chosen) {
    for (const { bucket } of rows) {
      const any = sortedEntries(bucket.verdicts)[0];
      if (any) {
        chosen = { code: "P4", key: any[0], count: any[1], bucket };
        break;
      }
    }
  }
  if (!chosen) return null;
  const group = sortedEntries(chosen.bucket.groups).find(([k]) => k !== "other");
  let suffix = "";
  if (group) {
    const [build, os, osMajor, deviceClass] = group[0].split("|");
    suffix = ` on ${build} · ${os} ${osMajor} · ${deviceClass}`;
  }
  const worst = worstSeverityOf(rows);
  const lead = worst ? `${worst} · ` : "";
  return `priority: ${lead}${chosen.code} — ${chosen.count}× ${chosen.key}${suffix}`;
}

/**
 * Render the digest for the PREVIOUS completed UTC hour. Returns null
 * when that hour had zero events (silence is the healthy signal — post
 * nothing). Fail-open: any store error returns null.
 */
export async function renderDigest(
  store: TelemetryStore | null,
  now: number,
): Promise<string | null> {
  if (!store) return null;
  try {
    const prevStart = hourBucketStart(now) - HOUR_MS;
    const prevLabel = hourLabelOf(prevStart);
    const rows: Array<{ type: string; bucket: CountBucket }> = [];
    let grandTotal = 0;
    for (const type of EVENT_TYPES) {
      const bucket = await store.readBucket(bucketKey(prevLabel, type));
      if (bucket && bucket.total > 0) {
        rows.push({ type, bucket });
        grandTotal += bucket.total;
      }
    }
    if (grandTotal === 0) return null;

    const lines: string[] = [];
    const firedAlerts: string[] = [];
    for (const { type, bucket } of rows) {
      let trailing = 0;
      for (let h = 1; h <= TRAILING_BASELINE_HOURS; h++) {
        const older = await store.readBucket(
          bucketKey(hourLabelOf(prevStart - h * HOUR_MS), type),
        );
        trailing += older?.total ?? 0;
      }
      const avg = trailing / TRAILING_BASELINE_HOURS;
      const anomalous =
        bucket.total > Math.max(ANOMALY_RATIO * avg, ANOMALY_MIN_COUNT);
      lines.push(renderTypeBlock(type, bucket, avg, anomalous));
      for (const alertId of bucket.alerts) {
        const m = /^threshold:(.+):/.exec(alertId);
        if (m && !firedAlerts.includes(m[1])) firedAlerts.push(m[1]);
      }
    }

    const from = new Date(prevStart).toISOString().slice(0, 16).replace("T", " ");
    const to = new Date(prevStart + HOUR_MS).toISOString().slice(11, 16);
    const priority = digestPriorityLine(rows);
    return (
      `📊 Meridian telemetry — hourly digest\n` +
      `hour: ${from}–${to} UTC (receipt hour) (${grandTotal} events)\n` +
      (priority ? `${priority}\n` : "") +
      // The S1 gloss rides directly under the priority lead — the
      // first place S1 appears — and only in an hour that counted S1.
      (hourCountsS1(rows) ? `${S1_DIGEST_GLOSS}\n` : "") +
      `\n` +
      lines.join("\n") +
      `\n\nalerts this hour: ${firedAlerts.length > 0 ? firedAlerts.map((t) => `${t} threshold`).join(", ") : "none"}`
    );
  } catch (err) {
    logLine("telemetry digest failed (fail-open)", err instanceof Error ? err.name : "unknown");
    return null;
  }
}

/**
 * Cron entrypoint logic: render the previous hour's digest and post it
 * to Discord when non-empty. Returns the posted message (or null).
 */
export async function runHourlyDigest(
  now: number,
  env: CrashReportEnv,
  store: TelemetryStore | null,
): Promise<string | null> {
  const message = await renderDigest(store, now);
  if (!message) return null;
  const discordUrl = env.DISCORD_WEBHOOK_URL?.trim();
  if (!discordUrl) {
    logLine("digest ready but no Discord webhook configured");
    return null;
  }
  const state = await forwardToDiscord(discordUrl, message);
  if (state !== "provider_accepted") logLine("digest delivery", state);
  return message;
}

// --- Council fix T6 (2026-11-08): trusted scheduled ops health ----------
//
// Only the platform-invoked scheduled() handler produces a health run;
// /ingest can never write one (it never touches ops:health:* keys).
// Scope is the crash-report worker ONLY: bindings, its KV, and its own
// provenance gate. It says nothing about the game, browsers or WebGL.
// Healthy runs write one status record + one log line and send nothing.
// Failed checks send one detailed Discord message per incident (best
// effort: incident state lives in KV, which is not atomic; when it is
// unreadable the cap degrades to <= 1 message per scheduled hour).
// PROPOSED cron, not live until a separately approved deploy uploads it.

export const HEALTH_CRON = "*/15 * * * *";
export const HEALTH_RECORD_KEY = "ops:health:last";
const HEALTH_INCIDENT_KEY = "ops:health:incident";
const HEALTH_PROBE_KEY = "ops:health:probe";
export const HEALTH_FRESH_MS = 35 * 60_000;
const HEALTH_FUTURE_SKEW_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 2_000;
const HEALTH_INCIDENT_TTL_SECONDS = 30 * 24 * 3600;
const KV_MIN_TTL_SECONDS = 60;
const HEALTH_PAGE_AFTER_FAILURES = 2;
const HEALTH_RECOVER_AFTER_PASSES = 2;
const HEALTH_REMINDER_MS = 24 * HOUR_MS;

export const REQUIRED_CHECKS = ["bindings_present", "kv_write", "kv_read", "provenance_selftest"] as const;
export type HealthCheckName = (typeof REQUIRED_CHECKS)[number];
export type HealthState = "healthy" | "unhealthy" | "unknown";

export interface HealthCheckResult {
  name: HealthCheckName;
  result: "passed" | "failed" | "unknown";
  expected: string;
  observed: string;
  reason: string;
  durationMs: number;
}

export interface HealthRunV1 {
  v: 1;
  kind: "health_run";
  trigger: "platform_schedule";
  cron: string;
  scheduledAt: string;
  sampledAt: string;
  durationMs: number;
  health: HealthState;
  requiredChecks: number;
  ranChecks: number;
  checks: HealthCheckResult[];
  worker: { versionId: "unavailable" };
}

export interface HealthEvaluation {
  health: HealthState;
  reason: string;
  sampledAt: string | null;
  ageSec: number | null;
  failing: string[];
  ranChecks: number;
}

/**
 * Total evaluator: healthy ONLY when every required check is present
 * once, passed, and the sample is fresh (<= 35 min old, <= 60 s ahead).
 * Anything missing, duplicated, unknown, stale, future or malformed is
 * "unknown"; a failed required check is "unhealthy". Never throws.
 */
export function evaluateHealth(record: unknown, now: number): HealthEvaluation {
  const unknown = (reason: string, sampledAt: string | null = null, ageSec: number | null = null): HealthEvaluation => ({
    health: "unknown", reason, sampledAt, ageSec, failing: [], ranChecks: 0,
  });
  try {
    if (!isPlainObject(record) || record.v !== 1 || record.kind !== "health_run") return unknown("invalid");
    const sampledAt = typeof record.sampledAt === "string" ? record.sampledAt : null;
    const t = sampledAt ? Date.parse(sampledAt) : Number.NaN;
    if (!Number.isFinite(t)) return unknown("invalid");
    const ageSec = Math.round((now - t) / 1000);
    if (t - now > HEALTH_FUTURE_SKEW_MS) return unknown("future", sampledAt, ageSec);
    if (now - t > HEALTH_FRESH_MS) return unknown("stale", sampledAt, ageSec);
    const checks = record.checks;
    if (!Array.isArray(checks) || checks.length === 0 || checks.length > 8) return unknown("invalid", sampledAt, ageSec);
    const seen = new Map<string, string>();
    for (const c of checks) {
      if (!isPlainObject(c) || typeof c.name !== "string" || typeof c.result !== "string") {
        return unknown("invalid", sampledAt, ageSec);
      }
      if (!(REQUIRED_CHECKS as readonly string[]).includes(c.name) || seen.has(c.name)) {
        return unknown("invalid", sampledAt, ageSec);
      }
      if (c.result !== "passed" && c.result !== "failed" && c.result !== "unknown") {
        return unknown("invalid", sampledAt, ageSec);
      }
      seen.set(c.name, c.result);
    }
    if (REQUIRED_CHECKS.some((n) => !seen.has(n))) return unknown("incomplete", sampledAt, ageSec);
    const failing = REQUIRED_CHECKS.filter((n) => seen.get(n) === "failed");
    const ranChecks = [...seen.values()].filter((r) => r !== "unknown").length;
    if (failing.length > 0) return { health: "unhealthy", reason: "check_failed", sampledAt, ageSec, failing: [...failing], ranChecks };
    if ([...seen.values()].some((r) => r === "unknown")) {
      return { health: "unknown", reason: "check_unknown", sampledAt, ageSec, failing: [], ranChecks };
    }
    return { health: "healthy", reason: "ok", sampledAt, ageSec, failing: [], ranChecks };
  } catch {
    return unknown("invalid");
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function timedCheck(
  name: HealthCheckName,
  expected: string,
  fn: () => Promise<{ result: HealthCheckResult["result"]; observed: string; reason: string }>,
): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const r = await withTimeout(fn(), HEALTH_CHECK_TIMEOUT_MS);
    return { name, expected, ...r, durationMs: Date.now() - t0 };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      name,
      expected,
      result: "failed",
      observed: timedOut ? `no answer within ${HEALTH_CHECK_TIMEOUT_MS} ms` : "operation threw",
      reason: timedOut ? "timeout" : "threw",
      durationMs: Date.now() - t0,
    };
  }
}

/** Built-in fixtures: a real live-client error shape and a known probe shape. */
function provenanceSelfTestPasses(): boolean {
  const device = {
    browser: "safari", browserVersion: "17.4", engine: "webkit", os: "ios", osVersion: "17.4",
    deviceClass: "phone", form: "mobile", screen: "md", dpr: 2, touchPoints: "2-5",
  };
  const real = {
    type: "js_error", ts: 0, buildId: "a1b2c3d", sessionId: "selftest", lcV: "2", storageOk: true,
    deviceSource: "live", msSinceBootStart: 1200, device, error: { name: "Error", message: "selftest" },
  } as unknown as CrashReportEvent;
  const probe = { type: "js_error", ts: 0, buildId: "wake-check" } as unknown as CrashReportEvent;
  return provenanceOf(real) === "corroborated" && provenanceOf(probe) === "uncorroborated";
}

/** Run the required checks once (no side effects beyond its own KV keys). */
export async function runHealthChecks(env: CrashReportEnv, now: number, cron: string, scheduledTime: number): Promise<HealthRunV1> {
  const t0 = Date.now();
  const kv = env.TELEMETRY_COUNTS;
  const hasKv = !!kv;
  const hasDiscord = !!env.DISCORD_WEBHOOK_URL?.trim();
  const hasEmail = !!(env.RESEND_API_KEY?.trim() && env.REPORT_EMAIL?.trim());
  const sampledIso = new Date(now).toISOString();
  const checks: HealthCheckResult[] = [];
  checks.push({
    name: "bindings_present",
    expected: "counter store bound and an ops channel (Discord; email only as fallback when Discord is absent)",
    observed: `store ${hasKv ? "yes" : "no"} · discord ${hasDiscord ? "yes" : "no"} · email ${hasEmail ? "yes" : "no"} · limiter ${env.CRASH_RATE_LIMITER ? "yes" : "no"}`,
    result: hasKv && (hasDiscord || hasEmail) ? "passed" : "failed",
    reason: hasKv && (hasDiscord || hasEmail) ? "ok" : "binding_missing",
    durationMs: 0,
  });
  if (!kv) {
    for (const name of ["kv_write", "kv_read"] as const) {
      checks.push({ name, expected: "counter store reachable", observed: "not run: store not bound", result: "unknown", reason: "not_run", durationMs: 0 });
    }
  } else {
    checks.push(
      await timedCheck("kv_write", "write acknowledged", async () => {
        await kv.put(HEALTH_PROBE_KEY, sampledIso, { expirationTtl: KV_MIN_TTL_SECONDS });
        return { result: "passed", observed: "write acknowledged", reason: "ok" };
      }),
    );
    // A read that returns nothing is NOT a failure: KV is eventually
    // consistent, so visibility of a fresh write is unconfirmed by design.
    checks.push(
      await timedCheck("kv_read", "read completes", async () => {
        const v = await kv.get(HEALTH_RECORD_KEY);
        return {
          result: "passed",
          observed: v ? "read ok · previous record visible" : "read ok · no previous record visible (visibility unconfirmed)",
          reason: "ok",
        };
      }),
    );
  }
  const selftest = provenanceSelfTestPasses();
  checks.push({
    name: "provenance_selftest",
    expected: "real-client fixture corroborated, probe fixture uncorroborated",
    observed: selftest ? "as expected" : "fixture mismatch",
    result: selftest ? "passed" : "failed",
    reason: selftest ? "ok" : "selftest_failed",
    durationMs: 0,
  });
  const run: HealthRunV1 = {
    v: 1,
    kind: "health_run",
    trigger: "platform_schedule",
    cron,
    scheduledAt: new Date(scheduledTime).toISOString(),
    sampledAt: sampledIso,
    durationMs: Date.now() - t0,
    health: "unknown",
    requiredChecks: REQUIRED_CHECKS.length,
    ranChecks: 0,
    checks,
    worker: { versionId: "unavailable" },
  };
  const ev = evaluateHealth(run, now);
  run.health = ev.health;
  run.ranChecks = ev.ranChecks;
  return run;
}

interface HealthIncidentState {
  v: 1;
  open: boolean;
  failing: string[];
  consecutiveFailures: number;
  consecutivePasses: number;
  openedAt: string | null;
  lastNotifiedAt: number;
  lastHealthyAt: string | null;
}

function emptyIncident(): HealthIncidentState {
  return { v: 1, open: false, failing: [], consecutiveFailures: 0, consecutivePasses: 0, openedAt: null, lastNotifiedAt: 0, lastHealthyAt: null };
}

function parseIncident(raw: string | null): HealthIncidentState {
  if (!raw) return emptyIncident();
  try {
    const p = JSON.parse(raw) as Partial<HealthIncidentState>;
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    return {
      v: 1,
      open: p.open === true,
      failing: Array.isArray(p.failing) ? p.failing.filter((f): f is string => typeof f === "string").slice(0, 8) : [],
      consecutiveFailures: n(p.consecutiveFailures),
      consecutivePasses: n(p.consecutivePasses),
      openedAt: typeof p.openedAt === "string" ? p.openedAt : null,
      lastNotifiedAt: n(p.lastNotifiedAt),
      lastHealthyAt: typeof p.lastHealthyAt === "string" ? p.lastHealthyAt : null,
    };
  } catch {
    return emptyIncident();
  }
}

export function buildHealthFailureText(run: HealthRunV1, incident: HealthIncidentState | null, reminder: boolean): string {
  const failed = run.checks.filter((c) => c.result !== "passed");
  const lines = failed.map(
    (c) => `• ${c.name}: ${c.result} — expected ${c.expected}; observed ${c.observed} (${c.reason}, ${c.durationMs} ms)`,
  );
  const text =
    `🛠️ Crash-report worker check ${reminder ? "STILL FAILING (24 h reminder)" : "FAILED"}\n` +
    `scope: crash-report worker only — not the game, not browsers or WebGL\n` +
    lines.join("\n") +
    `\nsampled: ${run.sampledAt} · run ${run.durationMs} ms · checks ran ${run.ranChecks}/${run.requiredChecks}` +
    `\nlast healthy: ${incident?.lastHealthyAt ?? "unknown"} · incident state: ${incident ? "tracked" : "unreadable (best-effort cap: 1 message per hour)"}` +
    `\ncause: unconfirmed · real-client-shaped crashes still page while this is open`;
  return text.length > 1800 ? `${text.slice(0, 1799)}…` : text;
}

/**
 * Ops-channel delivery for health messages (round 2, F5). Discord is the
 * ops channel; email is used ONLY when no Discord webhook is configured
 * (the same Resend channel real-crash alerts already use), so a
 * Discord-configured deployment sends no new email. Neither configured:
 * "not_configured" (bindings_present already fails in that case).
 */
async function sendOpsMessage(env: CrashReportEnv, text: string): Promise<DeliveryState> {
  const discordUrl = env.DISCORD_WEBHOOK_URL?.trim();
  if (discordUrl) return forwardToDiscord(discordUrl, text);
  if (env.RESEND_API_KEY?.trim() && env.REPORT_EMAIL?.trim()) {
    return forwardToEmail(env, `[Meridian ops] ${text.split("\n")[0].slice(0, 120)}`, text);
  }
  return "not_configured";
}

const HEALTH_BROKEN_WRITE_TIMEOUT_MS = 500;

/**
 * Scheduled health entry point: run checks, decide, SEND, then store.
 * Round 2 (F3/F4): the message is sent before any publication write, so
 * storage can never suppress its own outage alert, and every KV op is
 * bounded. The incident ledger records a notification only when the
 * provider accepted it (lastNotifiedAt = 0 means "open, not yet
 * delivered"): a failed or unknown send is retried at the next run
 * (<= 1 send + 1 bounded retry per 15-min run; an "unknown" timeout may
 * duplicate). Policy: page after 2 consecutive failures (a missing
 * binding at once), 24 h reminder after a delivered page, and one
 * recovered message after 2 passes — the incident closes only once that
 * message is accepted. Unreadable incident state: <= 1 message per hour.
 */
export async function runScheduledHealth(env: CrashReportEnv, scheduledTime: number, cron: string): Promise<HealthRunV1> {
  const rawKv = env.TELEMETRY_COUNTS;
  const kv = rawKv ? boundedKv(rawKv, HEALTH_CHECK_TIMEOUT_MS) : undefined;
  const run = await runHealthChecks(kv ? { ...env, TELEMETRY_COUNTS: kv } : env, scheduledTime, cron, scheduledTime);
  let incident: HealthIncidentState | null = null;
  if (kv) {
    try {
      incident = parseIncident(await kv.get(HEALTH_INCIDENT_KEY));
    } catch {
      incident = null;
    }
  }
  let message: string | null = null;
  let onAccepted: (() => void) | null = null;
  if (run.health === "unhealthy") {
    const bindingMissing = run.checks.some((c) => c.name === "bindings_present" && c.result === "failed");
    if (incident) {
      const inc = incident;
      inc.consecutiveFailures += 1;
      inc.consecutivePasses = 0;
      inc.failing = run.checks.filter((c) => c.result === "failed").map((c) => c.name);
      if (!inc.open && (bindingMissing || inc.consecutiveFailures >= HEALTH_PAGE_AFTER_FAILURES)) {
        inc.open = true;
        inc.openedAt = run.sampledAt;
        inc.lastNotifiedAt = 0;
      }
      if (inc.open && inc.lastNotifiedAt === 0) {
        message = buildHealthFailureText(run, inc, false);
      } else if (inc.open && scheduledTime - inc.lastNotifiedAt >= HEALTH_REMINDER_MS) {
        message = buildHealthFailureText(run, inc, true);
      }
      if (message) onAccepted = () => { inc.lastNotifiedAt = scheduledTime; };
    } else if (new Date(scheduledTime).getUTCMinutes() < 15) {
      // No readable incident state: at most one message per scheduled hour.
      message = buildHealthFailureText(run, null, false);
    }
  } else if (run.health === "healthy") {
    logLine("health ok", `${run.ranChecks}/${run.requiredChecks}`, `${run.durationMs} ms`);
    if (incident) {
      const inc = incident;
      inc.consecutiveFailures = 0;
      inc.consecutivePasses += 1;
      inc.lastHealthyAt = run.sampledAt;
      if (inc.open && inc.consecutivePasses >= HEALTH_RECOVER_AFTER_PASSES) {
        message =
          `✅ Crash-report worker checks recovered (scope: crash-report worker only)\n` +
          `failing since: ${inc.openedAt ?? "unknown"} · ${inc.consecutivePasses} healthy runs in a row · sampled ${run.sampledAt}`;
        onAccepted = () => {
          inc.open = false;
          inc.failing = [];
          inc.openedAt = null;
          inc.lastNotifiedAt = 0;
        };
      }
    }
  } else {
    logLine("health unknown", `${run.ranChecks}/${run.requiredChecks}`);
  }
  if (message) {
    const state = await sendOpsMessage(env, message);
    if (state === "provider_accepted") onAccepted?.();
    else logLine("health message not delivered (retried next run)", state);
  }
  if (kv) {
    // Publication writes run in parallel and are bounded; when this run
    // already saw the store fail to write, they get a short deadline.
    const writeBroken = run.checks.some((c) => c.name === "kv_write" && c.result !== "passed");
    const ms = writeBroken ? HEALTH_BROKEN_WRITE_TIMEOUT_MS : HEALTH_CHECK_TIMEOUT_MS;
    const writes: Array<[string, Promise<void>]> = [
      ["health record", withTimeout(kv.put(HEALTH_RECORD_KEY, JSON.stringify(run), { expirationTtl: OPS_RECORD_TTL_SECONDS }), ms)],
    ];
    if (incident) {
      writes.push(["health incident", withTimeout(kv.put(HEALTH_INCIDENT_KEY, JSON.stringify(incident), { expirationTtl: HEALTH_INCIDENT_TTL_SECONDS }), ms)]);
    }
    const results = await Promise.allSettled(writes.map(([, w]) => w));
    results.forEach((r, i) => {
      if (r.status === "rejected") logLine(`${writes[i][0]} write failed`, r.reason instanceof Error ? r.reason.name : "unknown");
    });
    kv.close();
  }
  return run;
}

/** GET /health body: liveness plus the stored evidence summary (no secrets). */
async function healthStatusBody(env: CrashReportEnv): Promise<Record<string, unknown>> {
  const base = { ok: true, v: 1, live: true, scope: "crash-report-worker", requiredChecks: REQUIRED_CHECKS.length };
  const kv = env.TELEMETRY_COUNTS;
  if (!kv) return { ...base, health: "unknown", reason: "no_store", sampledAt: null, ageSec: null, failing: [], ranChecks: 0 };
  let raw: string | null;
  try {
    raw = await withTimeout(kv.get(HEALTH_RECORD_KEY), HEALTH_CHECK_TIMEOUT_MS);
  } catch {
    return { ...base, health: "unknown", reason: "store_unreadable", sampledAt: null, ageSec: null, failing: [], ranChecks: 0 };
  }
  if (!raw) return { ...base, health: "unknown", reason: "no_record", sampledAt: null, ageSec: null, failing: [], ranChecks: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const ev = evaluateHealth(parsed, Date.now());
  return { ...base, ...ev };
}

// --- Request handling --------------------------------------------------

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
  });
}

/**
 * CORS preflight: the browser asks before POSTing application/json. Only
 * an allow-listed origin gets the go-ahead. Anything else gets a 403 with
 * no CORS headers, so the browser never sends the POST.
 */
function optionsResponse(origin: string | null): Response {
  if (!origin) {
    return new Response(null, { status: 403, headers: { vary: "Origin" } });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...originPolicy.corsHeaders(origin),
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

/**
 * Pure request handler (testable without a Workers runtime).
 * Never throws for client errors — every failure path is a 4xx.
 */
export async function handleRequest(
  request: Request,
  env: CrashReportEnv,
  ctx?: ExecutionContextLike,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = originPolicy.allowedOrigin(request);
  const cors = originPolicy.corsHeaders(origin);

  // CORS preflight must be answered before any method/path checks.
  if (request.method === "OPTIONS") return optionsResponse(origin);

  if (path === "/health") {
    // Health is for humans and monitors (curl), not browsers: no CORS.
    if (request.method !== "GET") return jsonResponse(405, { error: "method not allowed" });
    // Council fix T6: liveness (this answered) is separate from
    // dependency health (the last trusted scheduled run, freshness-checked).
    // HTTP 200 means "alive"; monitors must read body.health.
    return jsonResponse(200, await healthStatusBody(env), { "cache-control": "no-store" });
  }

  if (path === "/" || path === "/ingest") {
    if (request.method !== "POST") return jsonResponse(405, { error: "method not allowed" }, cors);

    // Review S4: only the game's own origins may report. Beacons carry
    // Origin too (see the CORS note at the top of this file).
    if (!origin) return jsonResponse(403, { error: "origin not allowed" }, cors);

    const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
    const rl = await selectRateLimiter(env).check(ip, Date.now());
    if (!rl.allowed) {
      return jsonResponse(
        429,
        { error: "rate limit exceeded" },
        { ...cors, "retry-after": String(rl.retryAfterSec) },
      );
    }

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "body too large" }, cors);
    }
    const body = await readBodyCapped(request, MAX_BODY_BYTES);
    if (body === null) return jsonResponse(413, { error: "body too large" }, cors);

    let event: unknown;
    try {
      event = JSON.parse(body);
    } catch {
      return jsonResponse(400, { error: "invalid JSON" }, cors);
    }
    // Intake normalisation (§5.1) runs before validation: it strips
    // and coerces, never rejects, so the 400s below are only the
    // required-field checks a legacy event already passes.
    const normalised = normaliseEvent(event);
    const problems = validateEvent(normalised);
    if (problems.length > 0) {
      return jsonResponse(400, { error: "invalid event", problems }, cors);
    }
    const valid = normalised as CrashReportEvent;

    const discordUrl = env.DISCORD_WEBHOOK_URL?.trim();
    const resendKey = env.RESEND_API_KEY?.trim();
    const reportEmail = env.REPORT_EMAIL?.trim();

    // Council fix T2 + round 2 (F2): routing is provenance only, and a real
    // corroborated crash is paged BEFORE counting starts, so a missing,
    // throwing or hanging counter store can never delay or block it.
    // Every accepted event gets the same public body, so the response
    // reveals neither routing nor store health.
    const provenance = provenanceOf(valid);
    const tier = tierOf(
      valid.type,
      typeof valid.recoveryOutcome === "string" ? valid.recoveryOutcome : undefined,
    );
    const outcome: IngestOutcome = { provenance, counted: false, route: "counted_only", deliveries: {} };
    const paged = tier === "crash" && provenance === "corroborated";
    if (paged) {
      outcome.route = "paged";
      const alert = buildAlert(valid);
      const now = Date.now();
      const work = (async () => {
        const [discord, email] = await Promise.all([
          discordUrl ? forwardToDiscord(discordUrl, alert.discord) : Promise.resolve<DeliveryState>("not_configured"),
          resendKey && reportEmail
            ? forwardToEmail(env, alert.emailSubject, alert.emailBody)
            : Promise.resolve<DeliveryState>("not_configured"),
        ]);
        outcome.deliveries = { discord, email };
        logLine("forwarded", valid.type, valid.buildId, valid.edition ?? "—", outcome.deliveries);
        if (env.TELEMETRY_COUNTS && (discordUrl || (resendKey && reportEmail))) {
          await recordDelivery(boundedKv(env.TELEMETRY_COUNTS), outcome.deliveries, now);
        }
      })();
      await runInBackground(ctx, work);
    }

    // Phase 1: count every accepted event, best-effort, under a hard
    // budget (round 2, F2). On timeout the store is closed, so the
    // abandoned count cannot start new writes, and its alert texts are
    // dropped — no late or duplicate notification from it.
    const kvb = env.TELEMETRY_COUNTS ? boundedKv(env.TELEMETRY_COUNTS, KV_OP_TIMEOUT_MS, INGEST_COUNT_BUDGET_MS) : null;
    const store = kvb ? kvTelemetryStore(kvb) : null;
    const notCounted: TelemetryRecordResult = { counted: false, alerted: false, alertTexts: [] };
    const tele = await withTimeout(
      recordTelemetry(store, valid, Date.now(), thresholdConfig(env), provenance),
      INGEST_COUNT_BUDGET_MS + 250,
    ).catch(() => notCounted);
    kvb?.close();
    outcome.counted = tele.counted;
    if (discordUrl && tele.alertTexts.length > 0) {
      // Threshold + can't-tell alerts: Discord only, in the background —
      // a failed alert post must never fail the client request.
      const texts = tele.alertTexts;
      await runInBackground(ctx, Promise.all(texts.map((t) => forwardToDiscord(discordUrl, t))));
    }

    if (paged) {
      // Already handled above.
    } else if (tier === "crash" && !tele.counted) {
      // Uncorroborated + store unavailable: bounded summary, never a page.
      const text = uncorroboratedSummary.record(valid, Date.now());
      outcome.route = text ? "summarized_kv_unavailable" : "summary_suppressed";
      if (text && discordUrl) {
        const work = (async () => {
          if (env.CRASH_RATE_LIMITER) {
            try {
              const r = await withTimeout(env.CRASH_RATE_LIMITER.limit({ key: "kvdown-summary" }), KV_OP_TIMEOUT_MS);
              if (!r.success) return;
            } catch {
              // A throwing limiter falls back to the per-isolate window.
            }
          }
          outcome.deliveries = { discord: await forwardToDiscord(discordUrl, text) };
        })();
        await runInBackground(ctx, work);
      }
      logLine("uncorroborated crash, store unavailable", valid.type, outcome.route);
    } else {
      // Hiccup/funnel, or an uncorroborated crash that WAS counted
      // (it feeds the threshold / can't-tell legs and the digest).
      logLine("accepted (counted only)", valid.type, valid.buildId, valid.edition ?? "—");
    }
    lastIngestOutcome = outcome;
    return jsonResponse(200, { ok: true }, cors);
  }

  return jsonResponse(404, { error: "not found" });
}

export default {
  fetch: (request: Request, env: CrashReportEnv, ctx: ExecutionContextLike): Promise<Response> =>
    handleRequest(request, env, ctx),
  // Phase 1: hourly digest cron (see [triggers] in wrangler.toml).
  scheduled: async (
    event: { cron: string; scheduledTime: number },
    env: CrashReportEnv,
    _ctx?: ExecutionContextLike,
  ): Promise<void> => {
    // Council fix T6: dispatch on the cron expression. The health cron
    // runs ONLY health; every other cron (the "15 * * * *" digest)
    // keeps the unchanged digest path.
    if (event.cron === HEALTH_CRON) {
      await runScheduledHealth(env, event.scheduledTime, event.cron);
      return;
    }
    // Round 2: every digest store op is bounded (per op, no total budget).
    const store = env.TELEMETRY_COUNTS ? kvTelemetryStore(boundedKv(env.TELEMETRY_COUNTS)) : null;
    await runHourlyDigest(event.scheduledTime, env, store);
  },
};
