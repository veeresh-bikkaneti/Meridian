/**
 * Meridian observability receiver — Cloudflare Worker (v1, NOT deployed
 * by the client branch; see README.md in this directory).
 *
 * Behavior:
 * - GET  /health        → 200 { ok: true }
 * - POST /  or /ingest  → validate one observability event, log it as one
 *                         structured JSON line (the v1 "store" — read via
 *                         `wrangler tail` / dashboard logs), return 204.
 * - Non-POST on an ingest path → 405. Unknown paths → 404.
 * - Bodies over 8 KB → 413. Invalid JSON / schema violations → 400.
 *
 * Zero dependencies. The pure handler is exported for unit tests
 * (worker.test.mjs, run via `npm run test:worker`).
 */

export const EVENT_TYPES = [
  "suspected_crash",
  "js_error",
  "unhandled_rejection",
  "map_error",
  "webgl_context_lost",
];

export const MAX_BODY_BYTES = 8192;

const STRING_CAPS = {
  buildId: 64,
  sessionId: 64,
  edition: 128,
  regionId: 128,
  chunkId: 128,
  lastMilestone: 128,
};

function isCappedString(value, cap) {
  return typeof value === "string" && value.length <= cap;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate one event against the documented schema (docs/observability.md).
 * Returns a list of problems; empty = valid.
 */
export function validateEvent(event) {
  const problems = [];
  if (!isPlainObject(event)) return ["event must be a JSON object"];
  if (!EVENT_TYPES.includes(event.type)) problems.push(`type must be one of ${EVENT_TYPES.join(", ")}`);
  if (typeof event.ts !== "number" || !Number.isFinite(event.ts)) problems.push("ts must be a finite number (epoch ms)");
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
      if (!isCappedString(event.error.name, 80)) problems.push("error.name must be a string ≤80 chars");
      if (!isCappedString(event.error.message, 300)) problems.push("error.message must be a string ≤300 chars");
    }
  }
  if (event.device !== undefined) {
    if (!isPlainObject(event.device)) {
      problems.push("device must be an object");
    } else if (event.device.ua !== undefined && !isCappedString(event.device.ua, 300)) {
      problems.push("device.ua must be a string ≤300 chars");
    }
  }
  if (event.breadcrumb !== undefined && !isPlainObject(event.breadcrumb)) {
    problems.push("breadcrumb must be an object");
  }
  return problems;
}

/** Derive an iOS version ("16.4.1") from a UA string, or null. */
export function iosVersionFromUA(ua) {
  if (typeof ua !== "string") return null;
  const m = ua.match(/\bOS (\d+)_(\d+)(?:_(\d+))?/);
  if (!m) return null;
  return m[3] ? `${m[1]}.${m[2]}.${m[3]}` : `${m[1]}.${m[2]}`;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Pure request handler (testable without a Workers runtime).
 * `log` is injectable so tests can capture the structured log line.
 */
export async function handleRequest(request, log = (line) => console.log(line)) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/health") {
    if (request.method !== "GET") return jsonResponse(405, { error: "method not allowed" });
    return jsonResponse(200, { ok: true });
  }

  if (path === "/" || path === "/ingest") {
    if (request.method !== "POST") return jsonResponse(405, { error: "method not allowed" });

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "body too large" });
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "body too large" });
    }

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return jsonResponse(400, { error: "invalid JSON" });
    }
    const problems = validateEvent(event);
    if (problems.length > 0) {
      return jsonResponse(400, { error: "invalid event", problems });
    }

    // v1 store: one structured JSON log line per event. The enrichment
    // (iosVersion) makes the documented buildId × edition × iOS-version
    // counts a simple log query — see README.md.
    const ua = event.device?.ua ?? request.headers.get("user-agent") ?? undefined;
    log(
      JSON.stringify({
        kind: "meridian-observability",
        receivedAt: new Date().toISOString(),
        type: event.type,
        buildId: event.buildId,
        edition: event.edition ?? null,
        regionId: event.regionId ?? null,
        lastMilestone: event.lastMilestone ?? null,
        iosVersion: iosVersionFromUA(ua),
        event,
      }),
    );
    return new Response(null, { status: 204 });
  }

  return jsonResponse(404, { error: "not found" });
}

export default {
  fetch: (request) => handleRequest(request),
};
