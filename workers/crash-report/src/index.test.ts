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
  classifyCrashVerdict,
  type CrashVerdictFacts,
  bucketKey,
  DEVICE_FIELD_ALLOWLIST,
  deriveVerdict,
  emptyBucket,
  groupKeyOf,
  MAX_GROUP_KEYS,
  missingStampNames,
  normaliseEvent,
  verdictFactsOf,
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
  EVENT_TYPES,
  FUNNEL_CLASS_TYPES,
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

// --- #194 wave 2: the funnel types (storyteller / narration) -------------
//
// The client has emitted these six types since #108 through the same
// transport as every crash event, but the worker's allowlist never
// included them — every one was answered 400 and silently dropped.
// The payloads below are copied from the real emission sites in
// src/components/storyteller.tsx (COPPA-clean: screen/trigger/booleans
// only, never place content).

const FUNNEL_PAYLOADS: Record<string, Record<string, unknown>> = {
  storyteller_shown: { screen: "story", sound_on: true, reduced_motion: false },
  narration_started: { screen: "story", trigger: "first_gesture", sound_on: true, line_count: 1 },
  narration_completed: { screen: "summary", duration_ms: 4200, trigger: "speaker" },
  narration_replayed: { screen: "story", line_index: 0, trigger: "replay" },
  narration_failed: { screen: "geodetective", error_name: "NotSupportedError", trigger: "summary" },
  narration_dismissed: { screen: "story", at_line: 1, reason: "tap_caption" },
};

test("EVENT_TYPES: the accepted set is exactly the client's 14 types (#194)", () => {
  // Pinned literally on purpose: this list is the contract with
  // ObservabilityEventType in src/lib/observability.ts, and the drift
  // test (scripts/observability-event-types.test.mjs) fails if the two
  // ever disagree again. Changing one side MUST change both.
  assert.deepEqual(
    [...EVENT_TYPES].sort(),
    [
      "boot_failure",
      "js_error",
      "map_error",
      "narration_completed",
      "narration_dismissed",
      "narration_failed",
      "narration_replayed",
      "narration_started",
      "recovery_outcome",
      "storyteller_shown",
      "suspected_crash",
      "tile_failed",
      "unhandled_rejection",
      "webgl_context_lost",
    ],
  );
  assert.deepEqual([...FUNNEL_CLASS_TYPES].sort(), Object.keys(FUNNEL_PAYLOADS).sort());
});

test("validateEvent: accepts every funnel type with its real payload shape (#194)", () => {
  for (const [type, params] of Object.entries(FUNNEL_PAYLOADS)) {
    assert.deepEqual(validateEvent(validEvent({ type, ...params })), [], type);
  }
});

test("validateEvent: still rejects unknown types, including funnel near-misses (#194)", () => {
  for (const type of ["narration_ended", "storyteller_hidden", "narration", "crash"]) {
    assert.ok(validateEvent(validEvent({ type })).length > 0, type);
  }
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

test("tierOf: funnel-class types are counted-only (hiccup tier) (#194)", () => {
  for (const t of FUNNEL_CLASS_TYPES) {
    assert.equal(tierOf(t), "hiccup", t);
  }
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

test("crash-class event: counted AND forwarded immediately, verdict-first format (Slice 1)", async () => {
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
  // Slice 1: the verdict line is FIRST. This event carries no stamps and
  // no error, so it fails closed to "can't tell" (design §2.2/F8) — and
  // Slice 1 changes no forwarding policy, so it still forwards.
  assert.ok(sent.startsWith("❔ WAIT — Can't tell from this report"), "verdict line first, fail closed without stamps");
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

test("funnel-class event: accepted, counted, NOT forwarded individually (#194)", async () => {
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  // The exact shape storyteller.tsx posts for a finished narration.
  const res = await handleRequest(
    postEvent(validEvent({ type: "narration_completed", ...FUNNEL_PAYLOADS.narration_completed })),
    env,
  );
  assert.equal(res.status, 200, "previously a 400 — the event was dropped");
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, false);
  assert.equal(json.counted, true);
  assert.equal(fetchCalls.length, 0, "no individual forward for funnel-class");
  const hour = hourLabelOf(Date.now());
  const bucket = (await store.readBucket(bucketKey(hour, "narration_completed")))!;
  assert.equal(bucket.total, 1, "counted into its own (hour × type) bucket");
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

test("threshold alert: routine funnel types never alert, even past both thresholds (#311)", async () => {
  const cfg = thresholdConfig({});
  const now = 1_729_000_000_000;
  // Per-build leg (the spec's exact case): 10 storyteller_shown from one build.
  const { store } = memoryStore();
  for (let i = 0; i < 10; i++) {
    const r = await recordTelemetry(
      store,
      tileEvent({ type: "storyteller_shown" }) as CrashReportEvent,
      now,
      cfg,
    );
    assert.equal(r.alerted, false, `storyteller_shown #${i + 1} must not alert`);
  }
  // Per-hour leg: 20 storyteller_shown across 20 builds (total >= perHour).
  const { store: store2 } = memoryStore();
  for (let i = 0; i < 20; i++) {
    const r = await recordTelemetry(
      store2,
      tileEvent({ type: "storyteller_shown", buildId: `build-${i}` }) as CrashReportEvent,
      now,
      cfg,
    );
    assert.equal(r.alerted, false, `cross-build storyteller_shown #${i + 1} must not alert`);
  }
  // A second routine type: the exemption is set-wide, not storyteller-only.
  const { store: store3 } = memoryStore();
  for (let i = 0; i < 10; i++) {
    const r = await recordTelemetry(
      store3,
      tileEvent({ type: "narration_started" }) as CrashReportEvent,
      now,
      cfg,
    );
    assert.equal(r.alerted, false, `narration_started #${i + 1} must not alert`);
  }
});

test("threshold alert: 10 storyteller_shown via ingest post no Discord alert (#311)", async () => {
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const now = Date.now();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 9; i++) {
    await recordTelemetry(
      store,
      tileEvent({ type: "storyteller_shown" }) as CrashReportEvent,
      now,
      cfg,
    );
  }
  const res = await handleRequest(
    postEvent(validEvent({ type: "storyteller_shown", buildId: "f331846", ...FUNNEL_PAYLOADS.storyteller_shown })),
    env,
  );
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "no Discord post for 10 routine funnel events");
});

test("threshold alert: narration_failed still alerts at the per-build threshold (#311)", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const now = 1_729_000_000_000;
  for (let i = 0; i < 9; i++) {
    const r = await recordTelemetry(
      store,
      tileEvent({ type: "narration_failed" }) as CrashReportEvent,
      now,
      cfg,
    );
    assert.equal(r.alerted, false, `narration_failed #${i + 1} below threshold`);
  }
  const r10 = await recordTelemetry(
    store,
    tileEvent({ type: "narration_failed" }) as CrashReportEvent,
    now,
    cfg,
  );
  assert.equal(r10.alerted, true, "narration_failed trips at 10 from one build");
  assert.ok(r10.alertText?.includes("narration_failed"), "alert names the type");
});

test("threshold alert: suspected_crash still alerts at the per-build threshold (#311)", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const now = 1_729_000_000_000;
  for (let i = 0; i < 9; i++) {
    const r = await recordTelemetry(
      store,
      tileEvent({ type: "suspected_crash" }) as CrashReportEvent,
      now,
      cfg,
    );
    assert.equal(r.alerted, false, `suspected_crash #${i + 1} below threshold`);
  }
  const r10 = await recordTelemetry(
    store,
    tileEvent({ type: "suspected_crash" }) as CrashReportEvent,
    now,
    cfg,
  );
  assert.equal(r10.alerted, true, "suspected_crash trips at 10 from one build");
  assert.ok(r10.alertText?.includes("suspected_crash"), "alert names the type");
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
  // Exact hour line (the old assertion accepted any string containing
  // "02:00" — Slice 3 found it vacuous; the digest now labels the hour
  // as the receipt hour, §5.2/§5.3).
  assert.ok(
    sent.split("\n")[1] === "hour: 2026-10-18 02:00–03:00 UTC (receipt hour) (36 events)",
    `hour line: ${sent.split("\n")[1]}`,
  );
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

// --- Slice 1: crash-report verdicts (Consensus Manifest 2026-10-25) ------
//
// The classifier fixture table below mirrors src/lib/observability.test.ts
// verbatim (deliberate duplication across the client/worker boundary).
// The worker re-derives the verdict from the stamped facts and renders
// its own derivation — a client-stamped verdict is never rendered (§2.5).

const CLASSIFIER_TABLE: Array<{
  name: string;
  facts: CrashVerdictFacts;
  verdict: string;
  whyKey: string;
}> = [
  {
    name: "shape A — terminal backgrounded, no error → not_a_real_issue/bg_close",
    facts: { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, trailStuck: false, lcV: "1" },
    verdict: "not_a_real_issue",
    whyKey: "bg_close",
  },
  {
    name: "shape A non-visibility tail — a milestone recorded while still backgrounded does not break shape A",
    facts: { type: "suspected_crash", lastMilestone: "data_loaded", bgTerminal: true, buildReplaced: false, trailStuck: false, lcV: "1" },
    verdict: "not_a_real_issue",
    whyKey: "bg_close",
  },
  {
    name: "shape A-stuck — start-without-ready before backgrounding → insufficient_evidence/bg_stuck, never benign",
    facts: { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, trailStuck: true, lcV: "1" },
    verdict: "insufficient_evidence",
    whyKey: "bg_stuck",
  },
  {
    name: "shape B/E — backgrounded mid-session is never evidence; foregrounded then gameplay on current build → developer_needed",
    facts: { type: "suspected_crash", lastMilestone: "game_loaded", bgTerminal: false, buildReplaced: false, trailStuck: false, lcV: "1" },
    verdict: "developer_needed",
    whyKey: "fg_kill_current",
  },
  {
    name: "shape B/D — foregrounded then gameplay on replaced build → insufficient_evidence/fg_kill_replaced",
    facts: { type: "suspected_crash", lastMilestone: "game_loaded", bgTerminal: false, buildReplaced: true, trailStuck: false, lcV: "1" },
    verdict: "insufficient_evidence",
    whyKey: "fg_kill_replaced",
  },
  {
    name: "shape C — ends at foregrounded, no later progress, no error → insufficient_evidence/fg_vanished",
    facts: { type: "suspected_crash", lastMilestone: "foregrounded", bgTerminal: false, buildReplaced: false, trailStuck: false, lcV: "1" },
    verdict: "insufficient_evidence",
    whyKey: "fg_vanished",
  },
  {
    name: "shape D — gameplay ending on replaced build → insufficient_evidence, softened why",
    facts: { type: "suspected_crash", lastMilestone: "map_ready", bgTerminal: false, buildReplaced: true, trailStuck: false, lcV: "1" },
    verdict: "insufficient_evidence",
    whyKey: "fg_kill_replaced",
  },
  {
    name: "shape E — gameplay ending on current build → developer_needed/fg_kill_current",
    facts: { type: "suspected_crash", lastMilestone: "data_loaded", bgTerminal: false, buildReplaced: false, trailStuck: false, lcV: "1" },
    verdict: "developer_needed",
    whyKey: "fg_kill_current",
  },
  {
    name: "shape F — a captured error defeats the backgrounded pattern → developer_needed/captured_error",
    facts: { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, trailStuck: false, lcV: "1", error: { name: "TypeError", message: "boom" } },
    verdict: "developer_needed",
    whyKey: "captured_error",
  },
  {
    name: "precedence — a captured error defeats replaced-build softening (shape D + error)",
    facts: { type: "suspected_crash", lastMilestone: "map_ready", bgTerminal: false, buildReplaced: true, trailStuck: false, lcV: "1", error: { name: "Error", message: "boom" } },
    verdict: "developer_needed",
    whyKey: "captured_error",
  },
  {
    name: "precedence — captured-error evidence defeats missing stamps (js_error, no stamps)",
    facts: { type: "js_error", error: { name: "TypeError", message: "boom" } },
    verdict: "developer_needed",
    whyKey: "captured_error",
  },
  {
    name: "boot_failure — classified developer_needed by type alone (watchdog-emitted, never carries stamps)",
    facts: { type: "boot_failure" },
    verdict: "developer_needed",
    whyKey: "captured_error",
  },
];

for (const row of CLASSIFIER_TABLE) {
  test(`classifier: ${row.name}`, () => {
    assert.deepEqual(classifyCrashVerdict(row.facts), { verdict: row.verdict, whyKey: row.whyKey });
  });
}

test("classifier: captured-error types → developer_needed/captured_error", () => {
  for (const type of ["js_error", "unhandled_rejection", "map_error"] as const) {
    assert.deepEqual(
      classifyCrashVerdict({ type, error: { name: "Error", message: "boom" }, lastMilestone: "game_loaded" }),
      { verdict: "developer_needed", whyKey: "captured_error" },
      type,
    );
  }
});

test("classifier: shape C variant — ends at boot_start or boot_ready, no error → insufficient_evidence", () => {
  for (const lastMilestone of ["boot_start", "boot_ready"]) {
    assert.deepEqual(
      classifyCrashVerdict({ type: "suspected_crash", lastMilestone, bgTerminal: false, buildReplaced: false, trailStuck: false, lcV: "1" }),
      { verdict: "insufficient_evidence", whyKey: "fg_vanished" },
      lastMilestone,
    );
  }
});

test("classifier: missing fields — absent stamps always → insufficient_evidence/missing_fields, never benign", () => {
  const cases: CrashVerdictFacts[] = [
    { type: "suspected_crash", lastMilestone: "backgrounded" },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, trailStuck: false },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, lcV: "1" },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, trailStuck: false, lcV: "1" },
  ];
  for (const facts of cases) {
    assert.deepEqual(
      classifyCrashVerdict(facts),
      { verdict: "insufficient_evidence", whyKey: "missing_fields" },
      JSON.stringify(facts),
    );
  }
});

test("classifier: the Slice 1 table never yields auto_fixed", () => {
  for (const row of CLASSIFIER_TABLE) {
    assert.notEqual(classifyCrashVerdict(row.facts).verdict, "auto_fixed", row.name);
  }
});

// --- Slice 1: validation guards for the new stamps ------------------------

test("validateEvent: verdict stamps ride the extra-primitive rule, and the full client key set stays within the top-level cap", () => {
  // Exactly the key set the Slice 1 client emits for suspected_crash
  // (11 pre-existing + mapMode counted in the 11, plus 7 new stamps = 18).
  const full = validEvent({
    type: "suspected_crash",
    sessionId: "s-1",
    edition: "state",
    regionId: "nebraska",
    chunkId: "chunk-1",
    lastMilestone: "backgrounded",
    device: { os: "android", form: "mobile" },
    breadcrumb: { history: [{ name: "backgrounded", at: 1 }] },
    mapMode: "full",
    bgTerminal: true,
    buildReplaced: false,
    trailStuck: false,
    storageOk: true,
    lcV: "1",
    verdict: "not_a_real_issue",
    whyKey: "bg_close",
  });
  assert.equal(Object.keys(full).length, 18, "fixture carries the full Slice 1 key set");
  assert.deepEqual(validateEvent(full), []);
  assert.ok(validateEvent(validEvent({ lcV: "x".repeat(257) })).length > 0, "oversized stamp string rejected");
});

test("validateEvent: recovery_outcome is accepted in Slice 2 (the Slice 1 rejection pin, inverted — expected evolution)", () => {
  assert.deepEqual(validateEvent(validEvent({ type: "recovery_outcome" })), []);
});

// --- Slice 1: buildAlert rendering ----------------------------------------

function shapeAEvent(overrides: Record<string, unknown> = {}): CrashReportEvent {
  return {
    type: "suspected_crash",
    ts: 1_729_000_000_000,
    buildId: "28c5fea",
    edition: "state",
    regionId: "nebraska",
    lastMilestone: "backgrounded",
    device: { os: "android", form: "mobile" },
    bgTerminal: true,
    buildReplaced: false,
    trailStuck: false,
    storageOk: true,
    lcV: "1",
    ...overrides,
  } as CrashReportEvent;
}

test("buildAlert: verdict line is the first line of discord for shape A — ✅ IGNORE, with the why-line stating the limit", () => {
  const alert = buildAlert(shapeAEvent());
  const lines = alert.discord.split("\n");
  assert.equal(lines[0], "✅ IGNORE — No action needed");
  assert.equal(lines[1], "🚨 Meridian crash report");
  assert.ok(alert.discord.includes("verdict: no action needed"), "verdict line present");
  const why = lines.find((l) => l.startsWith("why: ")) ?? "";
  assert.ok(why.includes("background"), "why names the background-close pattern");
  assert.ok(why.includes("would look the same"), "why states the F1 limit — a background crash looks identical");
  assert.ok(alert.discord.includes("last step: in the background (app switched away)"), "plain-language last step");
  assert.ok(!alert.discord.includes("action: "), "no action line on the ignore class");
});

test("buildAlert: email subject and body carry the verdict for shape A (subject per §5.4, body verdict+why under the title)", () => {
  const alert = buildAlert(shapeAEvent());
  assert.equal(alert.emailSubject, "[Meridian] ✅ IGNORE — No action needed · suspected_crash · build 28c5fea · state");
  const bodyLines = alert.emailBody.split("\n");
  assert.equal(bodyLines[0], "Meridian crash report");
  assert.ok(alert.emailBody.includes("verdict: no action needed"));
  assert.ok(alert.emailBody.includes("why: "));
  assert.ok(alert.emailBody.includes("last step:       in the background (app switched away)") || alert.emailBody.includes("last step:"), "email uses last-step wording");
});

test("buildAlert: developer_needed rendering — 🚨 FIX first line, why names the captured error, action line present", () => {
  const alert = buildAlert({
    type: "js_error",
    ts: 1_729_000_000_000,
    buildId: "28c5fea",
    edition: "state",
    regionId: "nebraska",
    lastMilestone: "game_loaded",
    error: { name: "TypeError", message: "Cannot read properties of undefined (reading 'style')" },
    device: { os: "android", form: "mobile" },
  } as CrashReportEvent);
  const lines = alert.discord.split("\n");
  assert.equal(lines[0], "🚨 FIX — Developer action needed");
  const why = lines.find((l) => l.startsWith("why: ")) ?? "";
  assert.ok(why.includes("TypeError"), "why names the captured error");
  assert.ok(alert.discord.includes("action: Read the error below."), "action line on this class only");
  assert.ok(alert.discord.includes("last step: playing — map on screen"), "last-step value translated");
  assert.equal(alert.emailSubject, "[Meridian] 🚨 FIX — Developer action needed · js_error · build 28c5fea · state");
});

test("buildAlert: insufficient_evidence rendering — ❔ WAIT first line, no action line", () => {
  const alert = buildAlert(shapeAEvent({ lastMilestone: "foregrounded", bgTerminal: false }));
  const lines = alert.discord.split("\n");
  assert.equal(lines[0], "❔ WAIT — Can't tell from this report");
  assert.ok(alert.discord.includes("verdict: can't tell from this report"));
  assert.ok(!alert.discord.includes("action: "), "no action line on the can't-tell class");
  assert.equal(alert.emailSubject, "[Meridian] ❔ WAIT — Can't tell from this report · suspected_crash · build 28c5fea · state");
});

test("buildAlert: an event with missing stamps renders ❔ WAIT, never ✅ IGNORE", () => {
  const alert = buildAlert({
    type: "suspected_crash",
    ts: 1_729_000_000_000,
    buildId: "oldbuild",
    lastMilestone: "backgrounded",
  } as CrashReportEvent);
  assert.equal(alert.discord.split("\n")[0], "❔ WAIT — Can't tell from this report");
});

test("buildAlert: worker re-derives the verdict and never renders a client-stamped verdict", () => {
  const lyingBenign = buildAlert({
    type: "js_error",
    ts: 1_729_000_000_000,
    buildId: "28c5fea",
    error: { name: "Error", message: "boom" },
    verdict: "not_a_real_issue",
    whyKey: "bg_close",
  } as unknown as CrashReportEvent);
  assert.equal(lyingBenign.discord.split("\n")[0], "🚨 FIX — Developer action needed");
  const lyingFix = buildAlert(shapeAEvent({ verdict: "developer_needed", whyKey: "captured_error" }));
  assert.equal(lyingFix.discord.split("\n")[0], "✅ IGNORE — No action needed");
});

test("buildAlert: reader text uses 'last step' and no banned word in worker-authored text", () => {
  const alerts = [
    buildAlert(shapeAEvent()),
    buildAlert(shapeAEvent({ lastMilestone: "foregrounded", bgTerminal: false })),
    buildAlert({
      type: "js_error",
      ts: 1_729_000_000_000,
      buildId: "28c5fea",
      lastMilestone: "game_loaded",
      error: { name: "TypeError", message: "boom" },
    } as CrashReportEvent),
  ];
  for (const alert of alerts) {
    const combined = `${alert.discord}\n${alert.emailSubject}\n${alert.emailBody}`;
    assert.ok(combined.includes("last step"), "last-step wording present");
    // The literal type token `suspected_crash` prints as a code (design
    // §5.1 keeps it), not as a label — strip it before the banned scan.
    const stripped = combined.replaceAll("suspected_crash", "");
    for (const banned of ["milestone", "jetsam", "unclean", "signature", "episode", "suspected"]) {
      assert.ok(!stripped.toLowerCase().includes(banned), `banned word in reader text: ${banned}`);
    }
  }
});

test("buildAlert: existing fields are kept below the verdict and no identifying material reaches the new lines", () => {
  const alert = buildAlert(shapeAEvent({ sessionId: "SECRET-SESSION", device: { os: "android", form: "mobile", ua: "SECRET-UA" } }));
  const combined = `${alert.discord}\n${alert.emailSubject}\n${alert.emailBody}`;
  assert.ok(alert.discord.includes("type: suspected_crash · build: 28c5fea"));
  assert.ok(alert.discord.includes("device: android/mobile"));
  assert.ok(alert.discord.includes("edition: state · region: nebraska"));
  assert.ok(alert.discord.includes("error: none captured"), "no-error line in plain words");
  for (const secret of ["SECRET-SESSION", "SECRET-UA"]) {
    assert.ok(!combined.includes(secret), `leaked: ${secret}`);
  }
});

test("handleRequest: a shape A suspected_crash is still forwarded individually in Slice 1 and the Discord payload starts with the verdict line", async () => {
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(
    postEvent({
      type: "suspected_crash",
      ts: Date.now(),
      buildId: "28c5fea",
      edition: "state",
      regionId: "nebraska",
      lastMilestone: "backgrounded",
      device: { os: "android", form: "mobile" },
      bgTerminal: true,
      buildReplaced: false,
      trailStuck: false,
      storageOk: true,
      lcV: "1",
    }),
    env,
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, true, "Slice 1 changes no forwarding policy");
  assert.equal(json.counted, true);
  assert.equal(fetchCalls.length, 1);
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  assert.ok(sent.startsWith("✅ IGNORE — No action needed"), "Discord payload starts with the verdict line");
});

// --- Slice 2: recovery outcome loop (Consensus Manifest 2026-10-25) -----
//
// recovery_outcome whitelist (the ONLY schema change), tierOf's outcome
// branch, the classifier mirror's recovery branch (fixture table
// identical to src/lib/observability.test.ts), and the verbatim
// why-lines. No digest change (Slice 3 owns it).

const RECOVERY_CLASSIFIER_TABLE: Array<{
  name: string;
  facts: CrashVerdictFacts;
  verdict: string;
  whyKey: string;
}> = [
  { name: "confirmed → auto_fixed/recovery_confirmed", facts: { type: "recovery_outcome", recoveryOutcome: "confirmed" }, verdict: "auto_fixed", whyKey: "recovery_confirmed" },
  { name: "repeat_failure → developer_needed/recovery_failed", facts: { type: "recovery_outcome", recoveryOutcome: "repeat_failure" }, verdict: "developer_needed", whyKey: "recovery_failed" },
  { name: "stood_down → insufficient_evidence/recovery_stood_down (never auto_fixed)", facts: { type: "recovery_outcome", recoveryOutcome: "stood_down" }, verdict: "insufficient_evidence", whyKey: "recovery_stood_down" },
  { name: "unconfirmed_closed → insufficient_evidence/recovery_unconfirmed", facts: { type: "recovery_outcome", recoveryOutcome: "unconfirmed_closed" }, verdict: "insufficient_evidence", whyKey: "recovery_unconfirmed" },
  { name: "unconfirmed_died → insufficient_evidence/recovery_unconfirmed", facts: { type: "recovery_outcome", recoveryOutcome: "unconfirmed_died" }, verdict: "insufficient_evidence", whyKey: "recovery_unconfirmed" },
  { name: "unconfirmed_expired → insufficient_evidence/recovery_unconfirmed", facts: { type: "recovery_outcome", recoveryOutcome: "unconfirmed_expired" }, verdict: "insufficient_evidence", whyKey: "recovery_unconfirmed" },
  { name: "marker_unreadable → insufficient_evidence/marker_unreadable", facts: { type: "recovery_outcome", recoveryOutcome: "marker_unreadable" }, verdict: "insufficient_evidence", whyKey: "marker_unreadable" },
  { name: "missing recoveryOutcome → insufficient_evidence/missing_fields (fail closed)", facts: { type: "recovery_outcome" }, verdict: "insufficient_evidence", whyKey: "missing_fields" },
  { name: "invalid recoveryOutcome → insufficient_evidence/missing_fields (fail closed)", facts: { type: "recovery_outcome", recoveryOutcome: "bogus" }, verdict: "insufficient_evidence", whyKey: "missing_fields" },
  { name: "branch is FIRST: a confirmed outcome carrying an error field still classifies auto_fixed", facts: { type: "recovery_outcome", recoveryOutcome: "confirmed", error: { name: "Error", message: "boom" } }, verdict: "auto_fixed", whyKey: "recovery_confirmed" },
];

for (const row of RECOVERY_CLASSIFIER_TABLE) {
  test(`classifier (Slice 2): ${row.name}`, () => {
    assert.deepEqual(classifyCrashVerdict(row.facts), { verdict: row.verdict, whyKey: row.whyKey });
  });
}

test("tierOf (Slice 2): recovery_outcome is crash-class ONLY for repeat_failure; every other/missing/invalid value is counted-only", () => {
  assert.equal(tierOf("recovery_outcome" as never, "repeat_failure"), "crash");
  for (const v of ["confirmed", "stood_down", "unconfirmed_closed", "unconfirmed_died", "unconfirmed_expired", "marker_unreadable", "bogus"]) {
    assert.equal(tierOf("recovery_outcome" as never, v), "hiccup", v);
  }
  assert.equal(tierOf("recovery_outcome" as never), "hiccup", "missing value fails closed to counted-only");
  assert.equal(tierOf("recovery_outcome" as never, undefined), "hiccup");
  // Non-outcome types unchanged.
  assert.equal(tierOf("suspected_crash" as never, "repeat_failure"), "crash");
  assert.equal(tierOf("tile_failed" as never, "repeat_failure"), "hiccup");
});

test("validateEvent (Slice 2): a fully-stamped outcome event validates within MAX_TOP_LEVEL_KEYS — no enum hard-validation of recoveryOutcome", () => {
  // Exactly the key set the Slice 2 client emits for recovery_outcome.
  const full = validEvent({
    type: "recovery_outcome",
    sessionId: "s-1",
    edition: "state",
    regionId: "nebraska",
    chunkId: "chunk-1",
    lastMilestone: "game_loaded",
    device: { os: "android", form: "mobile" },
    mapMode: "full",
    storageOk: true,
    lcV: "2",
    recoveryOutcome: "confirmed",
    verdict: "auto_fixed",
    whyKey: "recovery_confirmed",
  });
  assert.equal(Object.keys(full).length, 15, "fixture carries the full Slice 2 key set");
  assert.deepEqual(validateEvent(full), []);
  // Fleet skew: an unknown outcome value is NOT hard-rejected — the
  // classifier and tierOf fail closed on it instead.
  assert.deepEqual(validateEvent(validEvent({ type: "recovery_outcome", recoveryOutcome: "from-the-future" })), []);
  assert.deepEqual(
    classifyCrashVerdict({ type: "recovery_outcome", recoveryOutcome: "from-the-future" }),
    { verdict: "insufficient_evidence", whyKey: "missing_fields" },
  );
});

function outcomeEvent(overrides: Record<string, unknown> = {}): CrashReportEvent {
  return {
    type: "recovery_outcome",
    ts: 1_729_000_000_000,
    buildId: "28c5fea",
    edition: "state",
    regionId: "nebraska",
    lastMilestone: "game_loaded",
    device: { os: "android", form: "mobile" },
    storageOk: true,
    lcV: "2",
    recoveryOutcome: "confirmed",
    ...overrides,
  } as CrashReportEvent;
}

test("buildAlert (Slice 2): confirmed renders 🔧 Fixed itself with the bounded verbatim why-line", () => {
  const alert = buildAlert(outcomeEvent());
  const lines = alert.discord.split("\n");
  assert.equal(lines[0], "🔧 IGNORE — Fixed itself (confirmed)");
  assert.ok(alert.discord.includes("verdict: automatically fixed (confirmed)"));
  assert.ok(
    alert.discord.includes(
      "why: A game file failed to load. The app reloaded itself once, then reached the game and no repeat failure was observed for at least 30 seconds. (Whether the failing file itself was tried again in that time is not observed.)",
    ),
    "bounded why-line verbatim (Manifest)",
  );
  assert.ok(!alert.discord.includes("action: "), "no action line on the fixed class");
  assert.equal(alert.emailSubject, "[Meridian] 🔧 IGNORE — Fixed itself (confirmed) · recovery_outcome · build 28c5fea · state");
});

test("buildAlert (Slice 2): repeat_failure renders 🚨 FIX with the verbatim why-line and the action line", () => {
  const alert = buildAlert(outcomeEvent({ recoveryOutcome: "repeat_failure" }));
  assert.equal(alert.discord.split("\n")[0], "🚨 FIX — Developer action needed");
  assert.ok(
    alert.discord.includes(
      "why: The app reloaded to fix a failed game file, and a game file failed to load again in the session that followed.",
    ),
  );
  assert.ok(alert.discord.includes("action: Read the error below."));
});

test("buildAlert (Slice 2): stood_down / unconfirmed / marker_unreadable render ❔ WAIT with their verbatim why-lines, never 🔧", () => {
  const stood = buildAlert(outcomeEvent({ recoveryOutcome: "stood_down" }));
  assert.equal(stood.discord.split("\n")[0], "❔ WAIT — Can't tell from this report");
  assert.ok(
    stood.discord.includes(
      "why: A game file failed to load and the app showed its update offer instead of reloading. Whether the player accepted it — and whether accepting fixed the file — is not observed here.",
    ),
  );
  for (const v of ["unconfirmed_closed", "unconfirmed_died", "unconfirmed_expired"]) {
    const alert = buildAlert(outcomeEvent({ recoveryOutcome: v }));
    assert.equal(alert.discord.split("\n")[0], "❔ WAIT — Can't tell from this report", v);
    assert.ok(
      alert.discord.includes(
        "why: The app reloaded to fix a failed game file; whether it worked was never confirmed — the player may simply not have come back, and the session's ending may be unrelated.",
      ),
      v,
    );
  }
  const unreadable = buildAlert(outcomeEvent({ recoveryOutcome: "marker_unreadable" }));
  assert.equal(unreadable.discord.split("\n")[0], "❔ WAIT — Can't tell from this report");
  assert.ok(
    unreadable.discord.includes(
      "why: A recovery attempt was recorded, but its record could not be read, so the outcome can't be told.",
    ),
  );
  const missing = buildAlert(outcomeEvent({ recoveryOutcome: undefined }));
  assert.equal(missing.discord.split("\n")[0], "❔ WAIT — Can't tell from this report", "missing outcome fails closed");
});

test("handleRequest (Slice 2): repeat_failure forwards immediately (crash tier); a confirmed outcome is counted only", async () => {
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });

  const failed = await handleRequest(
    postEvent({ type: "recovery_outcome", ts: Date.now(), buildId: "28c5fea", recoveryOutcome: "repeat_failure", lcV: "2" }),
    env,
  );
  assert.equal(failed.status, 200);
  const failedJson = (await failed.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(failedJson.forwarded, true, "repeat_failure is the one crash-class outcome");
  assert.equal(failedJson.counted, true);
  assert.equal(fetchCalls.length, 1);
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  assert.ok(sent.startsWith("🚨 FIX — Developer action needed"));

  const confirmed = await handleRequest(
    postEvent({ type: "recovery_outcome", ts: Date.now(), buildId: "28c5fea", recoveryOutcome: "confirmed", lcV: "2" }),
    env,
  );
  assert.equal(confirmed.status, 200);
  const confirmedJson = (await confirmed.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(confirmedJson.forwarded, false, "confirmed outcomes are counted only in Slice 2 (policy is Slice 3)");
  assert.equal(confirmedJson.counted, true);
  assert.equal(fetchCalls.length, 1, "no second forward");

  const hour = hourLabelOf(Date.now());
  const { store } = memoryStore();
  void store;
  const bucket = JSON.parse(map.get(bucketKey(hour, "recovery_outcome")) as string) as { total: number };
  assert.equal(bucket.total, 2, "both outcomes counted under the new type");
});

// --- Crash-telemetry §5.1: intake normalisation (strip-and-continue) -----

test("normaliseEvent: strips device.ua and breadcrumb.device.ua and every non-allowlist device key", () => {
  const out = normaliseEvent(
    validEvent({
      device: { os: "ios", form: "mobile", ua: "SECRET-UA", gpu: "SECRET-GPU", screenW: 390 },
      breadcrumb: { device: { os: "ios", ua: "SECRET-BC-UA", gpu: "SECRET-GPU" }, history: [] },
    }),
  ) as Record<string, unknown>;
  // boot_failure (the helper's type): the stripped device also gains
  // the E-rule engine fill (os ios → webkit, §7.5 ladder step 2 cure).
  assert.deepEqual(out.device, { os: "ios", form: "mobile", engine: "webkit" });
  assert.deepEqual((out.breadcrumb as Record<string, unknown>).device, { os: "ios" });
  assert.ok(!JSON.stringify(out).includes("SECRET"));
});

test("normaliseEvent: coerces wrong-typed and out-of-enum manifest fields to unknown, clamps unfinishedBoots", () => {
  const out = normaliseEvent(
    validEvent({
      device: {
        browser: "netscape",
        browserVersion: "SECRET-VER",
        engine: 42,
        osVersion: "sixteen",
        deviceClass: "phablet",
        deviceMemory: 999,
        hardwareConcurrency: 3.5,
        touchPoints: "many",
        displayMode: "floating",
        connection: "5g",
        locale: "SECRET!!LOCALE",
        dpr: 99,
        screen: "huge",
      },
      unfinishedBoots: 12345,
      msSinceBootStart: -5,
      mapMode: "sideways",
    }),
  ) as Record<string, unknown>;
  const dev = out.device as Record<string, unknown>;
  for (const key of [
    "browser", "browserVersion", "engine", "osVersion", "deviceClass",
    "deviceMemory", "hardwareConcurrency", "touchPoints", "displayMode",
    "connection", "locale", "dpr", "screen",
  ]) {
    assert.equal(dev[key], "unknown", key);
  }
  assert.equal(out.unfinishedBoots, 999, "clamped to 0..999");
  assert.equal(out.msSinceBootStart, "unknown");
  assert.equal(out.mapMode, "unknown");
  // Valid as-read values pass through untouched (range rule, Slice 4 I-8).
  const ok = normaliseEvent(
    validEvent({ device: { deviceMemory: 0.5, hardwareConcurrency: 6, osVersion: "16.4.1", browserVersion: "16.4", locale: "en-US" } }),
  ) as Record<string, unknown>;
  assert.deepEqual(ok.device, {
    deviceMemory: 0.5,
    hardwareConcurrency: 6,
    osVersion: "16.4.1",
    browserVersion: "16.4",
    locale: "en-US",
    // boot_failure with no os/browser to derive from: the engine
    // fill lands on its honest "unknown" (§7.5 ladder step 2 cure).
    engine: "unknown",
  });
});

test("normaliseEvent: deletes non-primitive top-level extras and truncates over-cap strings instead of rejecting", () => {
  const out = normaliseEvent(
    validEvent({ extra: { nested: true }, list: [1, 2], edition: "e".repeat(200) }),
  ) as Record<string, unknown>;
  assert.equal("extra" in out, false);
  assert.equal("list" in out, false);
  assert.equal((out.edition as string).length, 128);
  assert.deepEqual(validateEvent(out), []);
});

test("normaliseEvent: legacy superset — every event valid today stays valid, read-fields byte-identical", () => {
  const fixtures: Record<string, unknown>[] = [
    validEvent(),
    validEvent({ type: "tile_failed", device: { os: "linux", form: "desktop" } }),
    tileEvent(),
    shapeAEvent() as unknown as Record<string, unknown>,
    outcomeEvent() as unknown as Record<string, unknown>,
    validEvent({
      type: "suspected_crash",
      sessionId: "s-1",
      edition: "state",
      regionId: "nebraska",
      lastMilestone: "backgrounded",
      device: { os: "android", form: "mobile", dpr: 2, screen: "sm", webgl1: true, webgl2: false },
      breadcrumb: { history: [{ name: "backgrounded", at: 1 }] },
      mapMode: "full",
      bgTerminal: true,
      buildReplaced: false,
      trailStuck: false,
      storageOk: true,
      lcV: "1",
    }),
  ];
  for (const fixture of fixtures) {
    assert.deepEqual(validateEvent(fixture), [], "fixture is valid under the old rules");
    const out = normaliseEvent(structuredClone(fixture));
    assert.deepEqual(out, fixture, "normalisation leaves a valid legacy event untouched");
    assert.deepEqual(validateEvent(out), [], "and it stays valid");
  }
});

test("normaliseEvent: caps unchanged — a device carrying all 17 allowlist keys still trips the 16-key cap", () => {
  const device = Object.fromEntries(
    DEVICE_FIELD_ALLOWLIST.map((k) => [
      k,
      k === "dpr" || k === "deviceMemory" || k === "hardwareConcurrency"
        ? 2
        : k === "webgl1" || k === "webgl2"
          ? true
          : "unknown",
    ]),
  );
  device.os = "ios";
  const out = normaliseEvent(validEvent({ device }));
  assert.ok(validateEvent(out).some((p) => p.includes("too many fields")), "device cap stays 16");
});

test("normaliseEvent: watchdog-shaped boot_failure (no engine) gains the E-rule engine in counting + alert", async () => {
  // The watchdog drops engine (§7.5 ladder step 2); deviceClass is
  // dropped too and is NOT recovered — it stays "unknown".
  const watchdog = validEvent({
    type: "boot_failure",
    device: {
      browser: "safari",
      browserVersion: "16",
      os: "ios",
      osVersion: "16.4.1",
      form: "mobile",
      webgl1: true,
      webgl2: true,
    },
    error: { name: "Error", message: "boot timeout" },
  });
  const out = normaliseEvent(structuredClone(watchdog)) as Record<string, unknown>;
  const dev = out.device as Record<string, unknown>;
  assert.equal(dev.engine, "webkit", "os ios → webkit (E1)");
  assert.equal(dev.deviceClass, undefined, "deviceClass is not filled — stays unknown downstream");
  // Counting + alert both consume the normalised event.
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 5, 0);
  const normalised = { ...out, ts: t0 } as unknown as CrashReportEvent;
  const counted = await recordTelemetry(store, normalised, t0, cfg);
  assert.equal(counted.counted, true);
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(t0), "boot_failure")))!;
  assert.equal(bucket.total, 1);
  const alert = buildAlert(normalised);
  assert.ok(alert.discord.includes("WebKit"), "alert renders the filled engine");
  assert.ok(alert.emailBody.includes("WebKit"), "email renders the filled engine");
  // The E-rule table over the parsed fields (boot_failure only).
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ browser: "chrome", os: "android" }, "blink"],
    [{ browser: "edge", os: "windows" }, "blink"],
    [{ browser: "samsung", os: "android" }, "blink"],
    [{ browser: "firefox", os: "linux" }, "gecko"],
    [{ browser: "safari", os: "mac" }, "webkit"],
    [{ browser: "chrome", os: "ios" }, "webkit"],
    [{ browser: "unknown", os: "other" }, "unknown"],
  ];
  for (const [device, want] of cases) {
    const filled = normaliseEvent(validEvent({ type: "boot_failure", device })) as Record<string, unknown>;
    assert.equal((filled.device as Record<string, unknown>).engine, want, JSON.stringify(device));
  }
});

test("normaliseEvent: a boot_failure WITH an engine keeps it (never overwritten)", () => {
  const out = normaliseEvent(
    validEvent({
      type: "boot_failure",
      device: { browser: "chrome", os: "android", engine: "gecko" },
    }),
  ) as Record<string, unknown>;
  assert.equal((out.device as Record<string, unknown>).engine, "gecko");
});

test("normaliseEvent: a js_error without engine is NOT filled", () => {
  const out = normaliseEvent(
    validEvent({
      type: "js_error",
      device: { browser: "chrome", os: "android" },
    }),
  ) as Record<string, unknown>;
  assert.equal((out.device as Record<string, unknown>).engine, undefined, "fill is boot_failure only");
  const unknown = normaliseEvent(
    validEvent({
      type: "js_error",
      device: { browser: "safari", os: "ios", engine: "unknown" },
    }),
  ) as Record<string, unknown>;
  assert.equal((unknown.device as Record<string, unknown>).engine, "unknown", "unknown stays unknown on other types");
});

// (The #339 funnel-gap pin lived here: it asserted a funnel type still
// returns 400 on the pre-#311 base. This PR closes that gap, so the pin
// is removed — funnel acceptance is pinned by the #194 tests below.)

// --- Crash-telemetry §5.2: counting v2 ------------------------------------

test("counting v2: groups, verdicts, milestones, modes, errorNames, first/last receipt times, late flag", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 5, 0);
  const ev = (over: Record<string, unknown> = {}) =>
    ({
      type: "suspected_crash",
      ts: t0,
      buildId: "c6853be",
      edition: "state",
      regionId: "nebraska",
      lastMilestone: "map_init_start",
      device: { os: "ios", form: "mobile", osVersion: "16.4.1", deviceClass: "phone" },
      mapMode: "scout",
      bgTerminal: false,
      buildReplaced: false,
      trailStuck: false,
      lcV: "2",
      ...over,
    }) as unknown as CrashReportEvent;
  await recordTelemetry(store, ev(), t0, cfg);
  await recordTelemetry(store, ev(), t0 + 37 * 60_000, cfg);
  // A late arrival: receipt in the 17:00 hour, client ts in the 15:00 hour.
  await recordTelemetry(store, ev({ ts: t0 - 2 * HOUR_MS }), t0 + 40 * 60_000, cfg);
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(t0), "suspected_crash")))!;
  assert.equal(bucket.total, 3);
  assert.equal(bucket.groups["c6853be|ios|16|phone"], 3);
  assert.equal(bucket.verdicts["developer_needed/fg_kill_current"], 3);
  assert.equal(bucket.milestones["map_init_start"], 3);
  assert.equal(bucket.modes["scout"], 3);
  assert.equal(bucket.errorNames["none"], 3);
  assert.equal(bucket.firstAt, t0);
  assert.equal(bucket.lastAt, t0 + 40 * 60_000);
  assert.equal(bucket.late, 1);
  assert.equal(groupKeyOf(ev()), "c6853be|ios|16|phone");
});

test("counting v2: the 33rd distinct group tallies under other (hard cap 32)", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 5, 0);
  for (let i = 0; i < MAX_GROUP_KEYS + 1; i++) {
    await recordTelemetry(
      store,
      validEvent({ type: "tile_failed", buildId: `build-${i}` }) as unknown as CrashReportEvent,
      t0,
      cfg,
    );
  }
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(t0), "tile_failed")))!;
  assert.equal(Object.keys(bucket.groups).length, MAX_GROUP_KEYS + 1, "32 real keys + other");
  assert.equal(bucket.groups["other"], 1);
});

test("counting v2: an old-shape bucket in KV reads back with v2 defaults", async () => {
  const { kv, store } = memoryStore();
  const key = bucketKey("2026-11-03T17", "js_error");
  await kv.put(key, JSON.stringify({ total: 2, builds: { a: 2 }, alerts: [] }));
  const bucket = (await store.readBucket(key))!;
  assert.equal(bucket.total, 2);
  assert.deepEqual(bucket.groups, {});
  assert.deepEqual(bucket.verdicts, {});
  assert.equal(bucket.firstAt, 0);
  assert.equal(bucket.lastAt, 0);
  assert.equal(bucket.late, 0);
});

test("telemetry: hostile event with secrets planted in the new fields leaks nothing anywhere", async () => {
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const hostile = {
    type: "suspected_crash",
    ts: Date.now(),
    buildId: "f331846",
    edition: "state",
    regionId: "nebraska",
    lastMilestone: "map_init_start",
    sessionId: "SECRET-SESSION",
    device: {
      os: "ios",
      form: "mobile",
      ua: "SECRET-UA",
      browser: "SECRET!!BROWSER",
      browserVersion: "SECRET-VER",
      osVersion: "SECRET-OSVER",
      locale: "SECRET!!LOCALE",
      deviceMemory: "SECRET-MEM",
      hardwareConcurrency: "SECRET-CORES",
    },
    breadcrumb: { device: { ua: "SECRET-BC-UA" }, history: [] },
    unfinishedBoots: "SECRET-BOOTS",
    msSinceBootStart: "SECRET-MS",
    bgTerminal: false,
    buildReplaced: false,
    trailStuck: false,
    lcV: "2",
  };
  const res = await handleRequest(postEvent(hostile), env);
  assert.equal(res.status, 200, "hostile event is stripped and continued, not rejected");
  assert.equal(fetchCalls.length, 1, "crash-class alert forwarded");
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  const rawBucket = [...map.values()].join("\n");
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(Date.now()), "suspected_crash")))!;
  const threshold = buildThresholdAlert("suspected_crash", hourLabelOf(Date.now()), bucket, thresholdConfig({}), 1);
  const digest = await renderDigest(store, Date.now() + HOUR_MS);
  const secrets = [
    "SECRET-SESSION", "SECRET-UA", "SECRET-BC-UA", "SECRET!!BROWSER", "SECRET-VER",
    "SECRET-OSVER", "SECRET!!LOCALE", "SECRET-MEM", "SECRET-CORES", "SECRET-BOOTS", "SECRET-MS",
  ];
  for (const secret of secrets) {
    assert.ok(!sent.includes(secret), `alert leaked: ${secret}`);
    assert.ok(!rawBucket.includes(secret), `bucket leaked: ${secret}`);
    assert.ok(!threshold.includes(secret), `threshold leaked: ${secret}`);
    assert.ok(!(digest ?? "").includes(secret), `digest leaked: ${secret}`);
  }
  // The planted dimensions were counted under their unknown forms.
  assert.equal(bucket.groups["f331846|ios|unknown|unknown"], 1);
  assert.equal(bucket.verdicts["developer_needed/fg_kill_current"], 1, "the settled verdict is counted");
  assert.ok(sent.includes("verdict: developer action needed"), "and rendered");
});

// --- Crash-telemetry §5.3/§8.3: surfaces, goldens, parity, iff ------------

/** The #330-shaped event as the enriched build stamps it (DESIGN-FINAL §5.5). */
function incident330Event(overrides: Record<string, unknown> = {}): CrashReportEvent {
  return {
    type: "suspected_crash",
    ts: Date.UTC(2026, 10, 3, 17, 42, 0),
    buildId: "c6853be",
    edition: "state",
    regionId: "nebraska",
    lastMilestone: "map_init_start",
    device: {
      os: "ios",
      form: "mobile",
      browser: "safari",
      browserVersion: "16.4",
      engine: "webkit",
      osVersion: "16.4.1",
      deviceClass: "phone",
      hardwareConcurrency: 6,
      deviceMemory: "unknown",
      screen: "md",
      dpr: 2,
      touchPoints: "2-5",
      displayMode: "unknown",
      connection: "unknown",
      locale: "en-US",
    },
    mapMode: "scout",
    msSinceBootStart: 4210,
    unfinishedBoots: 3,
    bgTerminal: false,
    buildReplaced: false,
    trailStuck: false,
    lcV: "2",
    deviceSource: "crashed_session",
    ...overrides,
  } as CrashReportEvent;
}

test("#330 fixture: the enriched shape settles to developer_needed/fg_kill_current", () => {
  assert.deepEqual(deriveVerdict(incident330Event()), {
    verdict: "developer_needed",
    whyKey: "fg_kill_current",
  });
  assert.deepEqual(missingStampNames(verdictFactsOf(incident330Event())), []);
});

test("golden: buildAlert Discord for the #330 event equals DESIGN-FINAL §5.5 verbatim", () => {
  const alert = buildAlert(incident330Event());
  assert.equal(
    alert.discord,
    [
      "🚨 FIX — Developer action needed",
      "Meridian crash report",
      "priority: P1 — current build, foreground kill at map loading, phone-class iOS 16",
      "verdict: developer action needed",
      "why: App stopped mid-game on the current build; no error was captured, so the cause is unknown.",
      "why-code: fg_kill_current",
      "action: Read the error below.",
      "type: suspected_crash · build: c6853be",
      "time: 2026-11-03T17:42:00.000Z",
      "device: ios/mobile · phone · Safari 16.4 · WebKit · iOS 16.4.1 (UA-parsed)",
      "runtime: mem unknown · cores 6 (as reported) · screen md · dpr 2 · touch 2-5 · standalone unknown · net unknown · locale en-US",
      "edition: state · region: nebraska",
      "mode: scout · last step: map loading · 4,210 ms after boot start",
      "boots: 3 unfinished in a row",
      "error: none captured",
    ].join("\n"),
  );
});

test("golden: buildAlert email body for the #330 event (full string)", () => {
  const alert = buildAlert(incident330Event());
  assert.equal(alert.emailSubject, "[Meridian] 🚨 FIX — Developer action needed · suspected_crash · build c6853be · state");
  assert.equal(
    alert.emailBody,
    [
      "Meridian crash report",
      "",
      "verdict: developer action needed",
      "priority: P1 — current build, foreground kill at map loading, phone-class iOS 16",
      "why: App stopped mid-game on the current build; no error was captured, so the cause is unknown.",
      "why-code: fg_kill_current",
      "action: Read the error below.",
      "type:            suspected_crash",
      "build:           c6853be",
      "event time:      2026-11-03T17:42:00.000Z",
      "device:          ios/mobile · phone · Safari 16.4 · WebKit · iOS 16.4.1 (UA-parsed)",
      "runtime:         mem unknown · cores 6 (as reported) · screen md · dpr 2 · touch 2-5 · standalone unknown · net unknown · locale en-US",
      "edition:         state",
      "region:          nebraska",
      "mode:            scout",
      "last step:       map loading · 4,210 ms after boot start",
      "boots:           3 unfinished in a row",
      "error:           none captured",
      "",
      "(Compact alert — full event payloads are never forwarded.)",
    ].join("\n"),
  );
});

test("alert/email parity: every manifest field's rendered value appears in BOTH bodies", () => {
  const alert = buildAlert(incident330Event());
  const renderedValues = [
    "P1 — current build, foreground kill at map loading, phone-class iOS 16",
    "fg_kill_current",
    "2026-11-03T17:42:00.000Z",
    "ios/mobile · phone · Safari 16.4 · WebKit · iOS 16.4.1 (UA-parsed)",
    "mem unknown · cores 6 (as reported) · screen md · dpr 2 · touch 2-5 · standalone unknown · net unknown · locale en-US",
    "scout",
    "map loading · 4,210 ms after boot start",
    "3 unfinished in a row",
    "state",
    "nebraska",
    "c6853be",
  ];
  for (const value of renderedValues) {
    assert.ok(alert.discord.includes(value), `discord missing: ${value}`);
    assert.ok(alert.emailBody.includes(value), `email missing: ${value}`);
  }
  // The two lines the email body dropped before §5.3, named explicitly.
  assert.ok(alert.emailBody.includes("device:"), "email carries the device line");
  assert.ok(alert.emailBody.includes("runtime:"), "email carries the runtime line");
});

test("legacy shape: missing bgTerminal still classifies missing_fields, and the evidence line names it", () => {
  const legacy = incident330Event();
  delete (legacy as Record<string, unknown>).bgTerminal;
  assert.deepEqual(deriveVerdict(legacy), {
    verdict: "insufficient_evidence",
    whyKey: "missing_fields",
  });
  const alert = buildAlert(legacy);
  const lines = alert.discord.split("\n");
  assert.equal(lines[0], "❔ WAIT — Can't tell from this report");
  assert.equal(lines[2], "priority: P3 — current build, evidence incomplete, phone-class iOS 16");
  assert.ok(
    alert.discord.includes("evidence: bgTerminal ✗ · buildReplaced ✓ · trailStuck ✓ · lcV ✓"),
    "evidence line names the missing stamp",
  );
  assert.ok(alert.emailBody.includes("evidence: bgTerminal ✗"), "email carries it too");
  // A different missing set renders a different line.
  const legacy2 = incident330Event();
  delete (legacy2 as Record<string, unknown>).lcV;
  assert.ok(
    buildAlert(legacy2).discord.includes("evidence: bgTerminal ✓ · buildReplaced ✓ · trailStuck ✓ · lcV ✗"),
  );
});

test("missingStampNames iff-property: failing set non-empty iff classifier returns missing_fields (suspected_crash / recovery_outcome shapes)", () => {
  const tables: CrashVerdictFacts[] = [
    ...CLASSIFIER_TABLE.map((r) => r.facts),
    ...RECOVERY_CLASSIFIER_TABLE.map((r) => r.facts),
    { type: "suspected_crash", lastMilestone: "backgrounded" },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, trailStuck: false },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: false, lcV: "1" },
    { type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, trailStuck: false, lcV: "1" },
  ];
  for (const facts of tables) {
    if (facts.type !== "suspected_crash" && facts.type !== "recovery_outcome") continue;
    const isMissing = classifyCrashVerdict(facts).whyKey === "missing_fields";
    assert.equal(
      missingStampNames(facts).length > 0,
      isMissing,
      `${JSON.stringify(facts)} → missing=${JSON.stringify(missingStampNames(facts))}`,
    );
  }
});

test("golden: buildThresholdAlert carries the fire-time caveat (full string)", () => {
  const bucket = emptyBucket();
  bucket.total = 20;
  bucket.builds = { f331846: 12, other: 8 };
  assert.equal(
    buildThresholdAlert("tile_failed", "2026-11-03T17", bucket, thresholdConfig({}), 12),
    [
      "🚨 Meridian telemetry alert",
      "type: tile_failed crossed the hiccup threshold (single build crossed 10/hour)",
      "hour: 2026-11-03T17 UTC · counts: 20 total (f331846 ×12, other ×8)",
      "one alert per type+hour — further events this hour only raise the counts",
      "counts are at fire time; the hourly digest carries the final total",
    ].join("\n"),
  );
});

test("golden: renderDigest for the §5.3 two-event hour (full string)", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const hourStart = Date.UTC(2026, 10, 3, 17, 0, 0);
  await recordTelemetry(store, incident330Event(), hourStart + 42 * 60_000, cfg);
  await recordTelemetry(
    store,
    {
      type: "js_error",
      ts: hourStart + 5 * 60_000,
      buildId: "2a0527f",
      edition: "state",
      regionId: "nebraska",
      lastMilestone: "game_loaded",
      error: { name: "TypeError", message: "boom" },
      device: { os: "android", form: "mobile", deviceClass: "phone" },
      mapMode: "full",
    } as unknown as CrashReportEvent,
    hourStart + 5 * 60_000,
    cfg,
  );
  const digest = await renderDigest(store, hourStart + HOUR_MS + 30 * 60_000);
  assert.equal(
    digest,
    [
      "📊 Meridian telemetry — hourly digest",
      "hour: 2026-11-03 17:00–18:00 UTC (receipt hour) (2 events)",
      "priority: P1 — 1× developer_needed/fg_kill_current on c6853be · ios 16 · phone",
      "",
      "suspected_crash 1 · first 17:42 · last 17:42",
      "  builds: c6853be ×1 · editions: state ×1 · regions: nebraska ×1",
      "  groups: c6853be|ios|16|phone ×1",
      "  verdicts: developer_needed/fg_kill_current ×1 · modes: scout ×1 · steps: map_init_start ×1",
      "js_error 1 · first 17:05 · last 17:05",
      "  builds: 2a0527f ×1 · editions: state ×1 · regions: nebraska ×1",
      "  groups: 2a0527f|android|unknown|phone ×1",
      "  verdicts: developer_needed/captured_error ×1 · modes: full ×1 · steps: game_loaded ×1 · errors: TypeError ×1",
      "",
      "alerts this hour: none",
    ].join("\n"),
  );
});

test("digest: caps are labelled with (+N more) remainders and ties break key-asc", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 1, 0);
  for (const buildId of ["b-build", "a-build", "d-build", "c-build", "e-build"]) {
    await recordTelemetry(
      store,
      validEvent({ type: "tile_failed", buildId }) as unknown as CrashReportEvent,
      t0,
      cfg,
    );
  }
  const digest = await renderDigest(store, t0 + HOUR_MS);
  assert.ok(digest, "digest produced");
  const buildsLine = digest.split("\n").find((l) => l.includes("builds:"))!;
  assert.ok(
    buildsLine.startsWith("  builds: a-build ×1 · b-build ×1 · c-build ×1 (+2 more)"),
    `labelled cap with remainder, key-asc ties: ${buildsLine}`,
  );
});

test("digest: a counted event outside the receipt hour labels its type line as late", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 10, 0);
  await recordTelemetry(
    store,
    validEvent({ type: "tile_failed", ts: t0 - 2 * HOUR_MS }) as unknown as CrashReportEvent,
    t0,
    cfg,
  );
  const digest = await renderDigest(store, t0 + HOUR_MS);
  assert.ok(digest?.includes("tile_failed 1 · first 17:10 · last 17:10 (some reports arrived late)"));
});

test("classifier freeze: the fixture tables still classify exactly as pinned (byte-identical behaviour)", () => {
  // classifyCrashVerdict / GAMEPLAY_MILESTONES / precedence are frozen
  // by §5.4; the two fixture tables above are the assertion surface.
  for (const row of [...CLASSIFIER_TABLE, ...RECOVERY_CLASSIFIER_TABLE]) {
    assert.deepEqual(
      classifyCrashVerdict(row.facts),
      { verdict: row.verdict, whyKey: row.whyKey },
      row.name,
    );
  }
});
