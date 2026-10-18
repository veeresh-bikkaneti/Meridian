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
 * - Bodies over 8 KB → 413. Invalid JSON / schema violations → 400.
 * - Per-IP fixed-window rate limit (10 requests / 60 s on ingest POSTs)
 *   → 429 with a Retry-After header.
 * - No forwarding secrets configured → 200 { ok: true, forwarded: false }
 *   (no-op mode, safe to deploy before secrets exist).
 * - Cron (scheduled)   → posts the hourly digest to Discord.
 *
 * Privacy: the forwarded alert carries only type, buildId,
 * edition/region, lastMilestone, the coarse os/form device bucket, and a
 * truncated error name/message — NEVER full payloads, NEVER sessionId,
 * raw UA, precise device facts, coordinates, or stack traces. Log lines
 * carry only type/buildId/edition. The Phase 1 counters (Workers KV)
 * store COUNTS ONLY, keyed by (UTC hour × type × buildId × edition ×
 * region × os/form device bucket) — no event payloads, no identifiers.
 *
 * Privacy: the forwarded alert carries only type, buildId,
 * edition/region, lastMilestone, the coarse os/form device bucket, and a
 * truncated error name/message — NEVER full payloads, NEVER sessionId,
 * raw UA, precise device facts, coordinates, or stack traces. Log lines
 * carry only type/buildId/edition.
 *
 * CORS: the game is served from https://veeresh-bikkaneti.github.io while
 * this worker lives on workers.dev, so every report POST is cross-origin.
 * `content-type: application/json` is NOT a CORS-safelisted content type,
 * so the browser sends a preflight OPTIONS request first. The handler
 * answers OPTIONS with 204 + CORS headers, and every response carries
 * `access-control-allow-origin: *`. `*` is safe here: the endpoint takes
 * no cookies/auth, so there is nothing credentialed to protect; locking
 * the origin down would only break reports from preview deployments.
 * Without this, the browser silently blocks the report POST and the
 * "send report" button becomes a no-op.
 *
 * Zero runtime dependencies. The pure handler is exported for unit tests
 * (no test file is committed for this worker; exercise it with
 * `npx wrangler dev` + curl, see README.md).
 */

/** Event types this worker accepts: the v1 set plus `boot_failure` and `tile_failed`. */
export const EVENT_TYPES = [
  "suspected_crash",
  "boot_failure",
  "js_error",
  "unhandled_rejection",
  "map_error",
  "tile_failed",
  "webgl_context_lost",
] as const;

export type CrashReportEventType = (typeof EVENT_TYPES)[number];

export const MAX_BODY_BYTES = 8192;

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
  if (event.device !== undefined && !isPlainObject(event.device)) {
    problems.push("device must be an object");
  }
  if (event.breadcrumb !== undefined && !isPlainObject(event.breadcrumb)) {
    problems.push("breadcrumb must be an object");
  }
  return problems;
}

// --- Per-IP fixed-window rate limiting (in-memory) ---------------------

interface RateEntry {
  windowStart: number;
  count: number;
}

const rateLimits = new Map<string, RateEntry>();

/** Test-only: clear in-memory rate-limit state between test cases. */
export function resetRateLimitsForTests(): void {
  rateLimits.clear();
}

function checkRateLimit(ip: string, now: number): { allowed: boolean; retryAfterSec: number } {
  // Opportunistic prune so the map cannot grow unboundedly across windows.
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(key);
  }
  const entry = rateLimits.get(ip);
  if (!entry) {
    rateLimits.set(ip, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSec };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

// --- Compact, PII-free alert -------------------------------------------

function truncate(value: string | undefined, max: number): string {
  if (!value) return "—";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
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
  const milestone = truncate(event.lastMilestone, 80);
  const errorLine = event.error
    ? `${truncate(event.error.name, 60)} — ${truncate(event.error.message, 140)}`
    : "—";
  // Coarse device bucket only (COPPA): os/form, never raw UA or precise facts.
  // Derivation is shared with the Phase 1 counters (deviceBucketOf).
  const deviceLine = deviceBucketOf(event);

  const discord =
    `🚨 Meridian crash report\n` +
    `type: ${type} · build: ${buildId}\n` +
    `device: ${deviceLine}\n` +
    `edition: ${edition} · region: ${region}\n` +
    `last milestone: ${milestone}\n` +
    `error: ${errorLine}`;
  const discordContent = discord.length > 1500 ? `${discord.slice(0, 1499)}…` : discord;

  const emailSubject = `[Meridian] ${type} · build ${buildId} · ${edition}`;
  const emailBody =
    `Meridian crash report\n\n` +
    `type:            ${type}\n` +
    `build:           ${buildId}\n` +
    `edition:         ${edition}\n` +
    `region:          ${region}\n` +
    `last milestone:  ${milestone}\n` +
    `error:           ${errorLine}\n` +
    `event time:      ${new Date(event.ts).toISOString()}\n\n` +
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

/** Classify an event type into its severity tier. */
export function tierOf(type: CrashReportEventType): TelemetryTier {
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
  /** Alert ids already fired for this bucket (exact-once per type+hour). */
  alerts: string[];
}

export function emptyBucket(): CountBucket {
  return { total: 0, builds: {}, editions: {}, regions: {}, devices: {}, alerts: [] };
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
          return {
            total: parsed.total,
            builds: parsed.builds ?? {},
            editions: parsed.editions ?? {},
            regions: parsed.regions ?? {},
            devices: parsed.devices ?? {},
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
    `one alert per type+hour — further events this hour only raise the counts`
  );
}

// --- Hourly digest -------------------------------------------------------

function topEntries(map: Record<string, number>, limit: number): string {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, n]) => `${k} ×${n}`)
    .join(", ");
}

function renderTypeLine(
  type: string,
  bucket: CountBucket,
  trailingAvg: number,
  anomalous: boolean,
): string {
  const dims = [
    topEntries(bucket.builds, 3),
    topEntries(bucket.editions, 2),
    topEntries(bucket.devices, 2),
  ]
    .filter(Boolean)
    .join(" · ");
  const flag = anomalous
    ? ` ⚠️ >${ANOMALY_RATIO}× 24h avg (${trailingAvg.toFixed(1)})`
    : "";
  return `${type} ${bucket.total}${dims ? ` · ${dims}` : ""}${flag}`;
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
      lines.push(renderTypeLine(type, bucket, avg, anomalous));
      for (const alertId of bucket.alerts) {
        const m = /^threshold:(.+):/.exec(alertId);
        if (m && !firedAlerts.includes(m[1])) firedAlerts.push(m[1]);
      }
    }

    const from = new Date(prevStart).toISOString().slice(0, 16).replace("T", " ");
    const to = new Date(prevStart + HOUR_MS).toISOString().slice(11, 16);
    return (
      `📊 Meridian telemetry — hourly digest\n` +
      `hour: ${from}–${to} UTC (${grandTotal} events)\n\n` +
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
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });
}

/** CORS preflight: the browser asks before POSTing application/json. */
function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
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

  // CORS preflight must be answered before any method/path checks.
  if (request.method === "OPTIONS") return optionsResponse();

  if (path === "/health") {
    if (request.method !== "GET") return jsonResponse(405, { error: "method not allowed" });
    return jsonResponse(200, { ok: true });
  }

  if (path === "/" || path === "/ingest") {
    if (request.method !== "POST") return jsonResponse(405, { error: "method not allowed" });

    const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
    const rl = checkRateLimit(ip, Date.now());
    if (!rl.allowed) {
      return jsonResponse(
        429,
        { error: "rate limit exceeded" },
        { "retry-after": String(rl.retryAfterSec) },
      );
    }

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "body too large" });
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "body too large" });
    }

    let event: unknown;
    try {
      event = JSON.parse(body);
    } catch {
      return jsonResponse(400, { error: "invalid JSON" });
    }
    const problems = validateEvent(event);
    if (problems.length > 0) {
      return jsonResponse(400, { error: "invalid event", problems });
    }
    const valid = event as CrashReportEvent;

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

    const tier = tierOf(valid.type);
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
      return jsonResponse(200, { ok: true, forwarded: false, counted: tele.counted });
    }

    // One forwarder failing must not fail the request (or the other).
    const settled = await Promise.allSettled(attempts.map((a) => a.promise));
    const results: Record<string, boolean> = {};
    settled.forEach((s, i) => {
      results[attempts[i].channel] = s.status === "fulfilled" && s.value === true;
    });
    logLine("forwarded", valid.type, valid.buildId, valid.edition ?? "—", results);
    return jsonResponse(200, { ok: true, forwarded: true, counted: tele.counted, results });
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
