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
 * - POST /  or /ingest  → validate one observability event, forward a
 *                         compact alert, return 200 { ok, forwarded }.
 * - Non-POST on an ingest path → 405. Unknown paths → 404.
 * - Bodies over 8 KB → 413. Invalid JSON / schema violations → 400.
 * - Per-IP fixed-window rate limit (10 requests / 60 s on ingest POSTs)
 *   → 429 with a Retry-After header.
 * - No forwarding secrets configured → 200 { ok: true, forwarded: false }
 *   (no-op mode, safe to deploy before secrets exist).
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
  const dev = event.device as { os?: string; form?: string } | undefined;
  const deviceLine = dev ? `${truncate(dev.os ?? "?", 24)}/${truncate(dev.form ?? "?", 24)}` : "—";

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

    const alert = buildAlert(valid);
    const attempts: Array<{ channel: "discord" | "email"; promise: Promise<boolean> }> = [];
    if (discordUrl)
      attempts.push({ channel: "discord", promise: forwardToDiscord(discordUrl, alert.discord) });
    if (resendKey && reportEmail) {
      attempts.push({
        channel: "email",
        promise: forwardToEmail(env, alert.emailSubject, alert.emailBody),
      });
    }

    if (attempts.length === 0) {
      // No-op mode: safe to deploy before secrets exist.
      logLine(
        "accepted (no forwarders configured)",
        valid.type,
        valid.buildId,
        valid.edition ?? "—",
      );
      return jsonResponse(200, { ok: true, forwarded: false });
    }

    // One forwarder failing must not fail the request (or the other).
    const settled = await Promise.allSettled(attempts.map((a) => a.promise));
    const results: Record<string, boolean> = {};
    settled.forEach((s, i) => {
      results[attempts[i].channel] = s.status === "fulfilled" && s.value === true;
    });
    logLine("forwarded", valid.type, valid.buildId, valid.edition ?? "—", results);
    return jsonResponse(200, { ok: true, forwarded: true, results });
  }

  return jsonResponse(404, { error: "not found" });
}

export default {
  fetch: (request: Request, env: CrashReportEnv): Promise<Response> => handleRequest(request, env),
};
