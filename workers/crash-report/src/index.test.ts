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
  buildThresholdAlert,
  bucketKey,
  emptyBucket,
  handleRequest,
  hourLabelOf,
  HOUR_MS,
  kvTelemetryStore,
  recordTelemetry,
  renderDigest,
  runHourlyDigest,
  resetRateLimitsForTests,
  thresholdConfig,
  tierOf,
  validateEvent,
  MAX_BODY_BYTES,
  ALLOWED_ORIGINS,
  RATE_LIMIT_BINDING,
  bindingClientKey,
  readBodyCapped,
  type CrashReportEnv,
  type CrashReportEvent,
  type KvLike,
  type TelemetryStore,
} from "./index.ts";

/** An allow-listed origin (review S4). Every browser POST carries one. */
const GAME_ORIGIN = "https://meridian.knowledgetest.workers.dev";

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
    headers: { "content-type": "application/json", origin: GAME_ORIGIN, ...headers },
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

// --- Phase 1: counting, severity tiers, digest --------------------------

function memoryStore(): { store: TelemetryStore; kv: KvLike; map: Map<string, string> } {
  const map = new Map<string, string>();
  const kv: KvLike = {
    get: async (k: string) => map.get(k) ?? null,
    put: async (k: string, v: string) => {
      map.set(k, v);
    },
  };
  return { map, kv, store: kvTelemetryStore(kv) };
}

function storeEnv(map: Map<string, string>, overrides: Partial<CrashReportEnv> = {}): CrashReportEnv {
  const kv: KvLike = {
    get: async (k: string) => map.get(k) ?? null,
    put: async (k: string, v: string) => {
      map.set(k, v);
    },
  };
  return { TELEMETRY_COUNTS: kv, ...overrides };
}

function tileEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return validEvent({
    type: "tile_failed",
    buildId: "f331846",
    edition: "country",
    regionId: "united-states",
    lastMilestone: "map_ready",
    device: { os: "linux", form: "desktop" },
    ...overrides,
  });
}

test("tierOf: crash-class vs hiccup-class classification", () => {
  for (const t of ["suspected_crash", "boot_failure", "js_error", "unhandled_rejection", "map_error"]) {
    assert.equal(tierOf(t as never), "crash", t);
  }
  assert.equal(tierOf("tile_failed"), "hiccup");
  assert.equal(tierOf("webgl_context_lost"), "hiccup");
});

test("thresholdConfig: env overrides and fallbacks", () => {
  assert.deepEqual(thresholdConfig({}), { perHour: 20, perBuild: 10 });
  assert.deepEqual(thresholdConfig({ TELEMETRY_THRESHOLD_PER_HOUR: "5" }), {
    perHour: 5,
    perBuild: 10,
  });
  assert.deepEqual(thresholdConfig({ TELEMETRY_THRESHOLD_PER_BUILD: "abc" }), {
    perHour: 20,
    perBuild: 10,
  });
  assert.deepEqual(thresholdConfig({ TELEMETRY_THRESHOLD_PER_HOUR: "0" }), {
    perHour: 20,
    perBuild: 10,
  });
});

test("counting: increments per dimension", async () => {
  const { map, store } = memoryStore();
  const env = storeEnv(map);
  for (const body of [
    tileEvent(),
    tileEvent(),
    validEvent({ type: "js_error", buildId: "abc123", edition: "state", regionId: "us-ne" }),
  ]) {
    const res = await handleRequest(postEvent(body), env);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { counted: boolean; forwarded: boolean };
    assert.equal(json.counted, true);
    assert.equal(json.forwarded, false, "no webhook configured");
  }
  const hour = hourLabelOf(Date.now());
  const tile = (await store.readBucket(bucketKey(hour, "tile_failed")))!;
  assert.equal(tile.total, 2);
  assert.equal(tile.builds["f331846"], 2);
  assert.equal(tile.editions["country"], 2);
  assert.equal(tile.regions["united-states"], 2);
  assert.equal(tile.devices["linux/desktop"], 2);
  const js = (await store.readBucket(bucketKey(hour, "js_error")))!
  assert.equal(js.total, 1);
  assert.equal(js.builds["abc123"], 1);
});

test("telemetry: hostile event leaks nothing into bucket, threshold alert, or digest", async () => {
  const { map, store } = memoryStore();
  const t0 = Date.UTC(2026, 9, 18, 2, 30, 0); // 2026-10-18T02:30Z
  const hostile = validEvent({
    type: "tile_failed",
    buildId: "f331846",
    edition: "country",
    regionId: "united-states",
    sessionId: "SECRET-SESSION",
    device: { os: "linux", form: "desktop", ua: "SECRET-UA", gpu: "SECRET-GPU" },
    breadcrumb: { history: [{ name: "SECRET-TRAIL", at: 1 }] },
    lat: "SECRET-COORDS",
  });
  const cfg = thresholdConfig({});
  let alertText = "";
  for (let i = 0; i < 10; i++) {
    const r = await recordTelemetry(store, hostile as never, t0, cfg);
    assert.equal(r.counted, true);
    if (r.alertText) alertText = r.alertText;
  }
  // Non-vacuous: the per-build threshold fired and all three surfaces
  // really do carry this event type's data.
  assert.ok(alertText.includes("tile_failed"), "threshold alert fired");
  const rawBucket = [...map.values()].join("\n");
  assert.ok(rawBucket.includes('"total":10'), "bucket counted all 10");
  const digest = await renderDigest(store, t0 + HOUR_MS + 15 * 60_000);
  assert.ok(digest && digest.includes("tile_failed 10"), "digest rendered the counts");
  for (const secret of ["SECRET-SESSION", "SECRET-UA", "SECRET-GPU", "SECRET-TRAIL", "SECRET-COORDS"]) {
    assert.ok(!rawBucket.includes(secret), `bucket leaked: ${secret}`);
    assert.ok(!alertText.includes(secret), `threshold alert leaked: ${secret}`);
    assert.ok(!(digest ?? "").includes(secret), `digest leaked: ${secret}`);
  }
});

test("crash-class event: counted AND forwarded immediately, unchanged format", async () => {
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(validEvent({ type: "suspected_crash" })), env);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, true);
  assert.equal(json.counted, true);
  assert.equal(fetchCalls.length, 1);
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  assert.ok(sent.startsWith("🚨 Meridian crash report"), "same individual alert format");
});

test("hiccup-class event: counted but NOT forwarded individually", async () => {
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(tileEvent()), env);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, false);
  assert.equal(json.counted, true);
  assert.equal(fetchCalls.length, 0, "no individual forward for hiccup-class");
});

test("threshold alert: fires exactly once per type+hour", async () => {
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const now = Date.now();
  const cfg = thresholdConfig({});
  // Seed 19 events across 10 builds so no threshold trips during seeding.
  for (let i = 0; i < 19; i++) {
    await recordTelemetry(
      store,
      tileEvent({ buildId: `build-${i % 10}` }) as CrashReportEvent,
      now,
      cfg,
    );
  }
  const res20 = await handleRequest(postEvent(tileEvent({ buildId: "build-0" })), env);
  assert.equal(res20.status, 200);
  assert.equal(fetchCalls.length, 1, "alert fires on the 20th event");
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  assert.ok(sent.startsWith("🚨 Meridian telemetry alert"), "alert style, not crash style");
  assert.ok(sent.includes("tile_failed"), "names the type");
  // Two more events: no further alerts.
  await handleRequest(postEvent(tileEvent()), env);
  await handleRequest(postEvent(tileEvent()), env);
  assert.equal(fetchCalls.length, 1, "exactly one alert per type+hour");
  const hour = hourLabelOf(now);
  const bucket = (await store.readBucket(bucketKey(hour, "tile_failed")))!
  assert.equal(bucket.total, 22);
  assert.equal(bucket.alerts.length, 1);
});

test("threshold alert: per-build threshold (10/hour from one build)", async () => {
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const now = Date.now();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 9; i++) {
    await recordTelemetry(store, tileEvent() as CrashReportEvent, now, cfg);
  }
  const res = await handleRequest(postEvent(tileEvent()), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 1, "alert fires on the 10th event from one build");
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  assert.ok(sent.includes("single build crossed"), "per-build reason in the alert");
});

test("threshold: env override lowers the trip point", async () => {
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, {
    DISCORD_WEBHOOK_URL: "https://discord.test/hook",
    TELEMETRY_THRESHOLD_PER_HOUR: "2",
  });
  await handleRequest(postEvent(tileEvent()), env);
  assert.equal(fetchCalls.length, 0, "first event under the override");
  await handleRequest(postEvent(tileEvent()), env);
  assert.equal(fetchCalls.length, 1, "second event trips the overridden threshold");
});

test("fail-open: store errors never break ingest or crash-class forwards", async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const broken: TelemetryStore = {
    readBucket: async () => {
      throw new Error("kv down");
    },
    writeBucket: async () => {
      throw new Error("kv down");
    },
  };
  const env: CrashReportEnv = {
    DISCORD_WEBHOOK_URL: "https://discord.test/hook",
    TELEMETRY_COUNTS: broken as never,
  };
  const res = await handleRequest(postEvent(validEvent({ type: "suspected_crash" })), env);
  assert.equal(res.status, 200, "client never sees a 500 for a counting failure");
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, true, "crash-class forward still fires");
  assert.equal(json.counted, false);
  assert.equal(fetchCalls.length, 1);
});

test("no KV binding: counting skipped, crash-class still forwards", async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const res = await handleRequest(postEvent(validEvent({ type: "suspected_crash" })), {
    DISCORD_WEBHOOK_URL: "https://discord.test/hook",
  });
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, true);
  assert.equal(json.counted, false);
});

// --- digest ----------------------------------------------------------------

const DIGEST_NOW = Date.UTC(2026, 9, 18, 3, 30, 0); // prev hour = 2026-10-18T02 UTC

async function seedDigest(store: TelemetryStore): Promise<void> {
  const cfg = thresholdConfig({});
  const prev = DIGEST_NOW - HOUR_MS;
  const at = (minutes: number) => prev + minutes * 60_000;
  // js_error ×11, low baseline (avg 1.0) → anomalous.
  for (let i = 0; i < 11; i++) {
    await recordTelemetry(
      store,
      validEvent({
        type: "js_error",
        buildId: "f331846",
        edition: "globe",
        device: { os: "android", form: "mobile" },
      }) as CrashReportEvent,
      at(i),
      cfg,
    );
  }
  // tile_failed ×22 (builds f331846 ×20 + other ×2), baseline avg 20 → not anomalous.
  for (let i = 0; i < 20; i++) {
    await recordTelemetry(store, tileEvent({ buildId: "f331846" }) as CrashReportEvent, at(i), cfg);
  }
  for (let i = 0; i < 2; i++) {
    await recordTelemetry(
      store,
      tileEvent({ buildId: "other-build" }) as CrashReportEvent,
      at(i),
      cfg,
    );
  }
  // suspected_crash ×3, zero baseline → not flagged (below the 3-event floor).
  for (let i = 0; i < 3; i++) {
    await recordTelemetry(
      store,
      validEvent({ type: "suspected_crash", buildId: "f331846" }) as CrashReportEvent,
      at(i),
      cfg,
    );
  }
  // Trailing 24h baselines (hours before the previous one).
  for (let h = 1; h <= 24; h++) {
    const t = prev - h * HOUR_MS + 600_000;
    await recordTelemetry(
      store,
      validEvent({ type: "js_error", buildId: "f331846" }) as CrashReportEvent,
      t,
      cfg,
    );
    for (let i = 0; i < 20; i++) {
      await recordTelemetry(store, tileEvent({ buildId: "f331846" }) as CrashReportEvent, t, cfg);
    }
  }
}

test("digest: renders counts, flags the anomaly, posts once", async () => {
  const { store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  await seedDigest(store);
  const message = await runHourlyDigest(
    DIGEST_NOW,
    { DISCORD_WEBHOOK_URL: "https://discord.test/hook" },
    store,
  );
  assert.ok(message, "digest produced");
  assert.equal(fetchCalls.length, 1, "exactly one digest post");
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  assert.ok(sent.startsWith("📊 Meridian telemetry — hourly digest"), "digest header");
  assert.ok(sent.includes("hour: 2026-10-18 02:00–02:59 UTC") || sent.includes("02:00"), "hour line");
  assert.ok(sent.includes("js_error 11"), "js_error count line");
  assert.ok(sent.includes("⚠️"), "anomaly flagged");
  assert.ok(sent.includes("tile_failed 22"), "tile_failed count line");
  assert.ok(!sent.split("\n").find((l) => l.startsWith("tile_failed"))!.includes("⚠️"), "no false anomaly");
  assert.ok(sent.includes("suspected_crash 3"), "crash-class also counted in digest");
  assert.ok(sent.includes("alerts this hour:"), "alerts line present");
});

test("digest: silent when the previous hour had zero events", async () => {
  const { store } = memoryStore();
  globalThis.fetch = (() => {
    throw new Error("digest must not post on a zero hour");
  }) as typeof fetch;
  const message = await runHourlyDigest(
    DIGEST_NOW,
    { DISCORD_WEBHOOK_URL: "https://discord.test/hook" },
    store,
  );
  assert.equal(message, null);
});

test("digest: no Discord webhook configured → nothing posted", async () => {
  const { store } = memoryStore();
  globalThis.fetch = (() => {
    throw new Error("digest must not post without a webhook");
  }) as typeof fetch;
  await seedDigest(store);
  const message = await runHourlyDigest(DIGEST_NOW, {}, store);
  assert.equal(message, null);
});

test("renderDigest: fail-open on store errors", async () => {
  const broken: TelemetryStore = {
    readBucket: async () => {
      throw new Error("kv down");
    },
    writeBucket: async () => {
      throw new Error("kv down");
    },
  };
  assert.equal(await renderDigest(broken, DIGEST_NOW), null);
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

test("GET /health returns 200 (no CORS: it is for curl and monitors)", async () => {
  const res = await handleRequest(new Request("https://worker.test/health"), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
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

test("OPTIONS preflight from an allowed origin returns 204 echoing that origin", async () => {
  const res = await handleRequest(
    new Request("https://worker.test/ingest", { method: "OPTIONS", headers: { origin: GAME_ORIGIN } }),
    {},
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), GAME_ORIGIN);
  assert.equal(res.headers.get("vary"), "Origin");
  assert.ok((res.headers.get("access-control-allow-methods") ?? "").includes("POST"));
  assert.ok(
    (res.headers.get("access-control-allow-headers") ?? "").includes("content-type"),
  );
});

test("POST responses echo the allowed origin (never *)", async () => {
  for (const origin of ALLOWED_ORIGINS) {
    resetRateLimitsForTests();
    const res = await handleRequest(postEvent(validEvent(), "/ingest", { origin }), {});
    assert.equal(res.status, 200, origin);
    assert.equal(res.headers.get("access-control-allow-origin"), origin);
    assert.equal(res.headers.get("vary"), "Origin");
  }
  assert.deepEqual([...ALLOWED_ORIGINS], [
    "https://meridian.knowledgetest.workers.dev",
    "https://veeresh-bikkaneti.github.io",
  ]);
});

// --- Review S4: Origin allowlist, streamed cap, schema, binding -------------

test("S4: preflight from another origin, or with none, is 403 with no CORS headers", async () => {
  for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }, {}] as Record<string, string>[]) {
    const res = await handleRequest(
      new Request("https://worker.test/ingest", { method: "OPTIONS", headers }),
      {},
    );
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  }
});

test("S4: POST from a foreign origin or with no Origin is 403 and never forwarded", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("{}", { status: 204 });
  }) as typeof fetch;
  const env: CrashReportEnv = { DISCORD_WEBHOOK_URL: "https://discord.example/hook" };
  for (const origin of ["https://evil.example", "https://meridian.knowledgetest.workers.dev.evil.example", "http://meridian.knowledgetest.workers.dev", "null", ""]) {
    const req = origin
      ? postEvent(validEvent(), "/ingest", { origin })
      : new Request("https://worker.test/ingest", { method: "POST", body: JSON.stringify(validEvent()) });
    const res = await handleRequest(req, env);
    assert.equal(res.status, 403, origin || "(none)");
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(calls, 0);
});

test("S4: a sendBeacon-style text/plain POST from the game is accepted (no preflight needed)", async () => {
  const res = await handleRequest(
    new Request("https://worker.test/ingest", {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8", origin: "https://veeresh-bikkaneti.github.io" },
      body: JSON.stringify(validEvent()),
    }),
    {},
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, forwarded: false, counted: false });
});

test("S4: a chunked body over the cap is cancelled mid-stream with 413", async () => {
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(1024).fill(0x20));
      if (pulled > 64) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("https://worker.test/ingest", {
    method: "POST",
    headers: { origin: GAME_ORIGIN },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const res = await handleRequest(req, {});
  assert.equal(res.status, 413);
  assert.ok(cancelled, "stream cancelled at the cap");
  assert.ok(pulled <= Math.ceil(MAX_BODY_BYTES / 1024) + 2, `read ${pulled} KB, more than the cap`);
});

test("S4: readBodyCapped returns the text under the cap and null over it", async () => {
  const small = new Request("https://worker.test/", { method: "POST", body: "héllo" });
  assert.equal(await readBodyCapped(small, 16), "héllo");
  const big = new Request("https://worker.test/", { method: "POST", body: "x".repeat(17) });
  assert.equal(await readBodyCapped(big, 16), null);
});

test("S4: schema rejects nested junk, oversized extras, bad device fields and absurd timestamps", () => {
  assert.deepEqual(validateEvent(validEvent({ device: { os: "ios", form: "mobile", dpr: 2, screen: "sm", webgl1: true, webgl2: false } })), []);
  assert.deepEqual(validateEvent(validEvent({ breadcrumb: { sessionId: "s", history: [{ name: "boot", at: 1 }], device: { os: "mac" } } })), []);
  assert.deepEqual(validateEvent(validEvent({ tileErrors: 3, trigger: "replay" })), []);
  const bad: Record<string, unknown>[] = [
    { extra: { nested: true } },
    { extra: "x".repeat(257) },
    { device: { os: "x".repeat(25) } },
    { device: { dpr: "2" } },
    { device: { webgl1: "yes" } },
    { breadcrumb: { history: new Array(33).fill({ name: "m", at: 1 }) } },
    { ts: 0 },
    { ts: Date.now() + 2 * 86_400_000 },
    Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, 1])),
  ];
  for (const b of bad) {
    assert.ok(validateEvent(validEvent(b)).length > 0, JSON.stringify(b).slice(0, 80));
  }
});

test("S4: the rate-limit binding is consulted with a daily pseudonymous key and can refuse", async () => {
  const keys: string[] = [];
  const env: CrashReportEnv = {
    CRASH_RATE_LIMITER: {
      async limit({ key }) {
        keys.push(key);
        return { success: keys.length < 2 };
      },
    },
  };
  const req = () => postEvent(validEvent(), "/ingest", { "cf-connecting-ip": "203.0.113.9" });
  assert.equal((await handleRequest(req(), env)).status, 200);
  const res = await handleRequest(req(), env);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "60");
  assert.equal(keys.length, 2);
  assert.match(keys[0], /^c:[0-9a-f]{16}$/);
  assert.ok(!keys[0].includes("203.0.113.9"), "raw IP never reaches the binding");
  // Same day → same key; a different day → a different key.
  const now = Date.UTC(2026, 9, 21, 12);
  assert.equal(await bindingClientKey("203.0.113.9", now), await bindingClientKey("203.0.113.9", now + 3_600_000));
  assert.notEqual(await bindingClientKey("203.0.113.9", now), await bindingClientKey("203.0.113.9", now + 86_400_000));
});

test("S4: a throwing or malformed binding fails open; the in-memory limit still applies", async () => {
  const throwing: CrashReportEnv = {
    CRASH_RATE_LIMITER: {
      async limit() {
        throw new Error("binding down");
      },
    },
  };
  const malformed = { CRASH_RATE_LIMITER: { limit: "nope" } } as unknown as CrashReportEnv;
  for (const env of [throwing, malformed]) {
    resetRateLimitsForTests();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await handleRequest(postEvent(validEvent(), "/ingest", { "cf-connecting-ip": "198.51.100.7" }), env);
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 10), new Array(10).fill(200));
    assert.equal(statuses[10], 429, "in-memory floor still caps at 10/min");
  }
});

test("S4: wrangler.toml records the CRASH_RATE_LIMITER binding (free, 10 per 60 s)", async () => {
  const { readFileSync } = await import("node:fs");
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const block = /\[\[ratelimits\]\]\s*\n([\s\S]*?)(?:\n\s*\n|\n\[|$)/.exec(toml)?.[1] ?? "";
  assert.match(block, /name\s*=\s*"CRASH_RATE_LIMITER"/);
  assert.match(block, /namespace_id\s*=\s*"\d+"/);
  assert.match(toml, /simple\s*=\s*\{\s*limit\s*=\s*10\s*,\s*period\s*=\s*60\s*\}/);
  assert.equal(RATE_LIMIT_BINDING, "CRASH_RATE_LIMITER");
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
  assert.deepEqual(await res.json(), { ok: true, forwarded: false, counted: false });
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
