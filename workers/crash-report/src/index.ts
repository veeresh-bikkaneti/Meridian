/**
 * Meridian crash-report receiver — Cloudflare Worker (forwarding variant).
 *
 * Relationship to `worker/observability/` (v1): the v1 worker is a
 * logging-only receiver — it validates events and writes one structured
 * JSON log line per event (read via `wrangler tail`). THIS worker is a
 * separate, forwarding sibling in a NEW directory on purpose (the old
 * directory is untouched): it accepts the same event schema (plus
 * `boot_failure`) and forwards a compact, PII-free alert to Discord
 * and/or email instead of logging the full event. Deploy ONE of them as
 * the `observabilityEndpoint` target; this one is the recommended
 * production choice because it pages a human instead of relying on
 * someone reading worker logs.
 *
 * Behavior:
 * - GET  /health        → 200 { ok: true }
 * - POST /  or /ingest  → validate one observability event; crash-class
 *                         events forward a compact alert immediately and
 *                         are counted; hiccup-class events are counted but
 *                         NOT forwarded individually (they surface via the
 *                         threshold alert + hourly digest). → 200
 *                         { ok, forwarded, counted }.
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

/** Event types this worker accepts: the v1 set plus `boot_failure`, `tile_failed`, and (Slice 2) `recovery_outcome`. */
export const EVENT_TYPES = [
  "suspected_crash",
  "boot_failure",
  "js_error",
  "unhandled_rejection",
  "map_error",
  "tile_failed",
  "webgl_context_lost",
  "recovery_outcome",
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
    const error = { ...event.error };
    if (typeof error.name === "string" && error.name.length > 80) {
      error.name = error.name.slice(0, 80);
    }
    if (typeof error.message === "string" && error.message.length > 300) {
      error.message = error.message.slice(0, 300);
    }
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
        ? `The app hit a real error and did not recover from it. Error captured: ${truncate(event.error.name, 60)} — ${truncate(event.error.message, 140)}.`
        : "The app failed to start; that failure was captured and it did not recover.";
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
          : "app failed to start",
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
export function buildAlert(event: CrashReportEvent): CrashAlert {
  const type = event.type;
  const buildId = truncate(event.buildId, 64);
  const edition = truncate(event.edition, 64);
  const region = truncate(event.regionId, 64);
  const lastStep = lastStepWords(event.lastMilestone);
  const errorLine = event.error
    ? `${truncate(event.error.name, 60)} — ${truncate(event.error.message, 140)}`
    : "none captured";
  // The device line starts from the coarse os/form bucket (COPPA) and
  // adds the parsed manifest facts — never raw UA or precise facts.
  // The bucket derivation is shared with the Phase 1 counters.

  // Slice 1: the authoritative verdict, re-derived here from the
  // event's stamped facts. A verdict/whyKey stamped by the client is an
  // untrusted cross-check and is never rendered (design §2.5/F9).
  const { verdict, whyKey } = deriveVerdict(event);
  const presentation = VERDICT_PRESENTATION[verdict];
  const why = whyLineFor(whyKey, event);
  const actionLine = verdict === "developer_needed" ? "action: Read the error below.\n" : "";
  // The 🚨 stays in the no-action title for findability (design §5.1) —
  // the verdict line above it carries the real signal.
  const title = verdict === "not_a_real_issue" ? "🚨 Meridian crash report" : "Meridian crash report";

  // §5.3 lines. priority: is always line 3 of the Discord alert; the
  // evidence: line appears only for missing_fields, right after why:.
  const priority = priorityRead(event);
  const priorityText = `${priority.code} — ${priority.text}`;
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
    `why: ${why}\n` +
    evidenceLine +
    `why-code: ${whyKey}\n` +
    actionLine +
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
    `why: ${why}\n` +
    evidenceLine +
    `why-code: ${whyKey}\n` +
    actionLine +
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

async function forwardToDiscord(webhookUrl: string, content: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      logLine("discord forward failed", res.status);
      return false;
    }
    return true;
  } catch (err) {
    logLine("discord forward error", err instanceof Error ? err.name : "unknown");
    return false;
  }
}

async function forwardToEmail(
  env: CrashReportEnv,
  subject: string,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(RESEND_ENDPOINT, {
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
    if (!res.ok) {
      logLine("email forward failed", res.status);
      return false;
    }
    return true;
  } catch (err) {
    logLine("email forward error", err instanceof Error ? err.name : "unknown");
    return false;
  }
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
 */
export const CRASH_CLASS_TYPES = [
  "suspected_crash",
  "boot_failure",
  "js_error",
  "unhandled_rejection",
  "map_error",
] as const;

export const HICCUP_CLASS_TYPES = ["tile_failed", "webgl_context_lost"] as const;

export type TelemetryTier = "crash" | "hiccup";

/**
 * Classify an event type into its severity tier. Slice 2:
 * `recovery_outcome` is crash-class ONLY for `repeat_failure`; every
 * other outcome value — and a missing/invalid one — is counted-only
 * (fail closed, Manifest A6/F8). Non-outcome types are unchanged.
 */
export function tierOf(type: CrashReportEventType, recoveryOutcome?: string): TelemetryTier {
  if (type === "recovery_outcome") {
    return recoveryOutcome === "repeat_failure" ? "crash" : "hiccup";
  }
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
    milestones: {},
    modes: {},
    errorNames: {},
    firstAt: 0,
    lastAt: 0,
    late: 0,
    alerts: [],
  };
}

/** Minimal KV surface — structurally satisfied by the real KVNamespace. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
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
          return {
            total: parsed.total,
            builds: parsed.builds ?? {},
            editions: parsed.editions ?? {},
            regions: parsed.regions ?? {},
            devices: parsed.devices ?? {},
            groups: parsed.groups ?? {},
            verdicts: parsed.verdicts ?? {},
            milestones: parsed.milestones ?? {},
            modes: parsed.modes ?? {},
            errorNames: parsed.errorNames ?? {},
            firstAt: typeof parsed.firstAt === "number" ? parsed.firstAt : 0,
            lastAt: typeof parsed.lastAt === "number" ? parsed.lastAt : 0,
            late: typeof parsed.late === "number" ? parsed.late : 0,
            alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
          };
        }
      } catch {
        // Corrupt bucket: treat as absent; the next write replaces it.
      }
      return null;
    },
    async writeBucket(key: string, bucket: CountBucket): Promise<void> {
      await kv.put(key, JSON.stringify(bucket));
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

/** Bump a group key under the hard cap: a 33rd distinct key is "other". */
function bumpGroup(groups: Record<string, number>, key: string): void {
  if (key in groups || Object.keys(groups).length < MAX_GROUP_KEYS) bump(groups, key);
  else bump(groups, "other");
}

export interface TelemetryRecordResult {
  counted: boolean;
  alerted: boolean;
  alertText?: string;
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
): Promise<TelemetryRecordResult> {
  if (!store) return { counted: false, alerted: false };
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
    bumpGroup(bucket.groups, groupKeyOf(event));
    const { verdict, whyKey } = deriveVerdict(event);
    bump(bucket.verdicts, `${verdict}/${whyKey}`);
    bump(bucket.milestones, event.lastMilestone ?? "—");
    bump(bucket.modes, typeof event.mapMode === "string" && event.mapMode ? event.mapMode : "unknown");
    bump(bucket.errorNames, event.error ? truncate(event.error.name, 80) : "none");
    bucket.firstAt = bucket.firstAt === 0 ? now : Math.min(bucket.firstAt, now);
    bucket.lastAt = Math.max(bucket.lastAt, now);
    const hourStart = hourBucketStart(now);
    if (
      typeof event.ts === "number" &&
      (event.ts < hourStart || event.ts >= hourStart + HOUR_MS)
    ) {
      bucket.late += 1;
    }

    let alerted = false;
    let alertText: string | undefined;
    const alertId = `threshold:${event.type}:${hour}`;
    const perBuild = bucket.builds[event.buildId] ?? 0;
    if (
      !bucket.alerts.includes(alertId) &&
      (bucket.total >= cfg.perHour || perBuild >= cfg.perBuild)
    ) {
      bucket.alerts.push(alertId);
      alerted = true;
      alertText = buildThresholdAlert(event.type, hour, bucket, cfg, perBuild);
    }
    await store.writeBucket(key, bucket);
    return { counted: true, alerted, alertText };
  } catch (err) {
    logLine("telemetry count failed (fail-open)", event.type, err instanceof Error ? err.name : "unknown");
    return { counted: false, alerted: false };
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
    `  verdicts: ${labelledTop(bucket.verdicts, 3)} · modes: ${labelledTop(bucket.modes, 2)} · steps: ${labelledTop(bucket.milestones, 2)}${errorsPart}`
  );
}

/**
 * The digest's priority line (§5.3): the highest-priority verdict in
 * the hour, with its top group. P1 needs a developer_needed verdict in
 * a bucket that also counted a gameplay last step.
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
  return `priority: ${chosen.code} — ${chosen.count}× ${chosen.key}${suffix}`;
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
  await forwardToDiscord(discordUrl, message);
  return message;
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
export async function handleRequest(request: Request, env: CrashReportEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = originPolicy.allowedOrigin(request);
  const cors = originPolicy.corsHeaders(origin);

  // CORS preflight must be answered before any method/path checks.
  if (request.method === "OPTIONS") return optionsResponse(origin);

  if (path === "/health") {
    // Health is for humans and monitors (curl), not browsers: no CORS.
    if (request.method !== "GET") return jsonResponse(405, { error: "method not allowed" });
    return jsonResponse(200, { ok: true });
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

    // Phase 1: count every accepted event, best-effort (fail-open).
    const store = env.TELEMETRY_COUNTS ? kvTelemetryStore(env.TELEMETRY_COUNTS) : null;
    const tele = await recordTelemetry(store, valid, Date.now(), thresholdConfig(env));
    if (tele.alerted && tele.alertText && discordUrl) {
      // Threshold alert: exactly one per type+hour. Fire-and-forget —
      // a failed alert post must never fail the client request.
      forwardToDiscord(discordUrl, tele.alertText).catch(() => {});
    }

    const tier = tierOf(
      valid.type,
      typeof valid.recoveryOutcome === "string" ? valid.recoveryOutcome : undefined,
    );
    const alert = buildAlert(valid);
    const attempts: Array<{ channel: "discord" | "email"; promise: Promise<boolean> }> = [];
    if (tier === "crash") {
      // Crash-class: immediate individual forward, unchanged from before.
      if (discordUrl)
        attempts.push({ channel: "discord", promise: forwardToDiscord(discordUrl, alert.discord) });
      if (resendKey && reportEmail) {
        attempts.push({
          channel: "email",
          promise: forwardToEmail(env, alert.emailSubject, alert.emailBody),
        });
      }
    }
    // Hiccup-class: counted above; individual forwards are replaced by
    // the threshold alert + hourly digest (no per-event pings).

    if (attempts.length === 0) {
      // No-op mode: safe to deploy before secrets exist.
      logLine(
        "accepted (no forwarders configured)",
        valid.type,
        valid.buildId,
        valid.edition ?? "—",
      );
      return jsonResponse(200, { ok: true, forwarded: false, counted: tele.counted }, cors);
    }

    // One forwarder failing must not fail the request (or the other).
    const settled = await Promise.allSettled(attempts.map((a) => a.promise));
    const results: Record<string, boolean> = {};
    settled.forEach((s, i) => {
      results[attempts[i].channel] = s.status === "fulfilled" && s.value === true;
    });
    logLine("forwarded", valid.type, valid.buildId, valid.edition ?? "—", results);
    return jsonResponse(200, { ok: true, forwarded: true, counted: tele.counted, results }, cors);
  }

  return jsonResponse(404, { error: "not found" });
}

export default {
  fetch: (request: Request, env: CrashReportEnv): Promise<Response> => handleRequest(request, env),
  // Phase 1: hourly digest cron (see [triggers] in wrangler.toml).
  scheduled: async (
    event: { cron: string; scheduledTime: number },
    env: CrashReportEnv,
  ): Promise<void> => {
    const store = env.TELEMETRY_COUNTS ? kvTelemetryStore(env.TELEMETRY_COUNTS) : null;
    await runHourlyDigest(event.scheduledTime, env, store);
  },
};
