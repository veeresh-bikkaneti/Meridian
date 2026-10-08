/**
 * Cloudflare Worker unit tests.
 *
 * Run: node --experimental-strip-types --test workers/crash-report/src/index.test.ts
 * (wired as `npm run test:worker`).
 *
 * The alert builder and the rate limiter get the heaviest coverage on
 * purpose: a bug in either one means crash reports are silently lost —
 * the exact failure this worker exists to prevent.
 */
import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import {
  buildAlert,
  handleRequest,
  resetRateLimitsForTests,
  validateEvent,
  MAX_BODY_BYTES,
  type CrashReportEnv,
} from "./index.ts";

function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "boot_failure",
    ts: 1_729_000_000_000,
    buildId: "abc123",
    ...overrides,
  };
}

function postEvent(
  body: unknown,
  path = "/ingest",
  headers: Record<string, string> = {},
): Request {
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// --- validateEvent -------------------------------------------------------

test("validateEvent: accepts a well-formed event", () => {
  assert.deepEqual(validateEvent(validEvent()), []);
});

test("validateEvent: accepts tile_failed", () => {
  assert.deepEqual(validateEvent(validEvent({ type: "tile_failed" })), []);
});

test("validateEvent: rejects missing/unknown type", () => {
  const { type: _dropped, ...noType } = validEvent();
  assert.ok(validateEvent(noType).length > 0);
  assert.ok(validateEvent(validEvent({ type: "nope" })).length > 0);
});

test("validateEvent: rejects non-finite ts and empty buildId", () => {
  assert.ok(validateEvent(validEvent({ ts: Number.NaN })).length > 0);
  assert.ok(validateEvent(validEvent({ buildId: "" })).length > 0);
});

test("validateEvent: enforces error and device caps", () => {
  assert.ok(
    validateEvent(validEvent({ error: { name: "x".repeat(81), message: "m" } }))
      .length > 0,
  );
  assert.ok(validateEvent(validEvent({ device: "not-an-object" })).length > 0);
  // …but a device object with any fields passes (schema is field-agnostic).
  assert.deepEqual(validateEvent(validEvent({ device: { os: "android" } })), []);
});

// --- buildAlert: PII stripping is the whole point -------------------------

test("buildAlert: never forwards identifying material", () => {
  const alert = buildAlert({
    type: "suspected_crash",
    ts: 1_729_000_000_000,
    buildId: "build-1",
    edition: "globe",
    regionId: "us-ne",
    lastMilestone: "map_ready",
    sessionId: "SECRET-SESSION",
    error: { name: "Error", message: "boom" },
    device: { ua: "SECRET-UA", gpu: "SECRET-GPU", deviceMemory: 2 },
    breadcrumb: { history: [{ name: "x", at: 1 }] },
  } as never);
  const combined = `${alert.discord}\n${alert.emailSubject}\n${alert.emailBody}`;
  for (const secret of ["SECRET-SESSION", "SECRET-UA", "SECRET-GPU"]) {
    assert.ok(!combined.includes(secret), `leaked: ${secret}`);
  }
  assert.ok(combined.includes("suspected_crash"));
  assert.ok(combined.includes("build-1"));
  assert.ok(combined.includes("globe"));
});

test("buildAlert: includes the coarse os/form device bucket, never raw UA", () => {
  const alert = buildAlert({
    type: "tile_failed",
    ts: 1_729_000_000_000,
    buildId: "build-1",
    device: { os: "ios", form: "mobile", ua: "SECRET-UA" },
  } as never);
  assert.ok(alert.discord.includes("device: ios/mobile"), "coarse bucket shown");
  assert.ok(!alert.discord.includes("SECRET-UA"), "raw UA stripped");
});

// --- handleRequest: routing, CORS, limits ---------------------------------

const realFetch = globalThis.fetch;
let fetchCalls: Array<{ url: string; init: unknown }>;

beforeEach(() => {
  fetchCalls = [];
  resetRateLimitsForTests();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("GET /health returns 200 with CORS headers", async () => {
  const res = await handleRequest(new Request("https://worker.test/health"), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await res.json(), { ok: true });
});

test("unknown path returns 404", async () => {
  const res = await handleRequest(postEvent(validEvent(), "/nope"), {});
  assert.equal(res.status, 404);
});

test("non-POST on ingest path returns 405", async () => {
  const res = await handleRequest(new Request("https://worker.test/ingest"), {});
  assert.equal(res.status, 405);
});

test("OPTIONS preflight returns 204 with CORS headers", async () => {
  const res = await handleRequest(
    new Request("https://worker.test/ingest", { method: "OPTIONS" }),
    {},
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.ok((res.headers.get("access-control-allow-methods") ?? "").includes("POST"));
  assert.ok(
    (res.headers.get("access-control-allow-headers") ?? "").includes("content-type"),
  );
});

test("POST responses carry the CORS allow-origin header", async () => {
  const res = await handleRequest(postEvent(validEvent()), {});
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("invalid JSON returns 400", async () => {
  const res = await handleRequest(postEvent("{not json"), {});
  assert.equal(res.status, 400);
});

test("schema-invalid event returns 400", async () => {
  const res = await handleRequest(postEvent(validEvent({ type: "bogus" })), {});
  assert.equal(res.status, 400);
});

test("oversized body returns 413", async () => {
  const big = "x".repeat(MAX_BODY_BYTES + 1);
  const res = await handleRequest(postEvent(big), {});
  assert.equal(res.status, 413);
});

test("rate limiter: 10 allowed, 11th rejected with retry-after", async () => {
  const env: CrashReportEnv = {};
  for (let i = 0; i < 10; i++) {
    const res = await handleRequest(postEvent(validEvent()), env);
    assert.equal(res.status, 200, `request ${i + 1} should pass`);
  }
  const limited = await handleRequest(postEvent(validEvent()), env);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"), "retry-after header present");
});

test("no-op mode: no secrets → 200 forwarded:false, fetch never called", async () => {
  globalThis.fetch = (() => {
    throw new Error("fetch must not be called in no-op mode");
  }) as typeof fetch;
  const res = await handleRequest(postEvent(validEvent()), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, forwarded: false });
});

test("forwarding: Discord webhook called, 200 forwarded:true", async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env: CrashReportEnv = { DISCORD_WEBHOOK_URL: "https://discord.test/hook" };
  const res = await handleRequest(postEvent(validEvent({ edition: "globe" })), env);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; forwarded: boolean };
  assert.equal(body.ok, true);
  assert.equal(body.forwarded, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://discord.test/hook");
});
