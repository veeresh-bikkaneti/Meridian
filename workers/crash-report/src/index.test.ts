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
  buildCantTellAlert,
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
  provenanceOf,
  severityKeyOf,
  severityOf,
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
import { BREADCRUMB_KEY, createObservability, sanitizeError } from "../../../src/lib/observability.ts";

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

// --- Provenance gate fixtures (post-normalise shapes) --------------------

/** A full client device (P3′-client named fields, 15 keys). */
function fullClientDevice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    browser: "chrome",
    browserVersion: "120.0",
    engine: "blink",
    os: "android",
    osVersion: "13.0",
    deviceClass: "phone",
    form: "mobile",
    screen: "md",
    dpr: 2,
    touchPoints: "2-5",
    displayMode: "browser",
    connection: "4g",
    locale: "en-US",
    hardwareConcurrency: 8,
    deviceMemory: 4,
    ...overrides,
  };
}

/** A fully corroborated suspected_crash: full breadcrumb trail (P4a′). */
function corroboratedSuspected(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "suspected_crash",
    ts: Date.now(),
    buildId: "a1b2c3d4e5f6",
    sessionId: "sess-1",
    lastMilestone: "game_loaded",
    lcV: "2",
    storageOk: true,
    deviceSource: "crashed_session",
    device: fullClientDevice(),
    breadcrumb: {
      sessionId: "sess-1",
      buildId: "a1b2c3d4e5f6",
      startedAt: 1000,
      lastMilestone: "game_loaded",
      history: [
        { name: "boot_start", at: 1000 },
        { name: "game_loaded", at: 2000 },
      ],
    },
    ...overrides,
  };
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
    const r = await recordTelemetry(store, hostile as never, t0, cfg, "corroborated");
    assert.equal(r.counted, true);
    if (r.alertTexts[0]) alertText = r.alertTexts[0];
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
  const res = await handleRequest(postEvent(corroboratedSuspected()), env);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, true);
  assert.equal(json.counted, true);
  assert.equal(fetchCalls.length, 1);
  const sent = JSON.parse((fetchCalls[0].init as { body: string }).body).content as string;
  // Slice 1: the verdict line is FIRST. This event carries no classifier
  // stamps and no error, so it fails closed to "can't tell" (design
  // §2.2/F8) — but its provenance corroborates (full trail), so the
  // provenance gate passes it and it still forwards.
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
      cfg, "corroborated"
    );
  }
  const res20 = await handleRequest(
    postEvent(tileEvent({ buildId: "a1b2c3d4", lcV: "2", storageOk: true, device: fullClientDevice() })),
    env,
  );
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
    await recordTelemetry(store, tileEvent() as CrashReportEvent, now, cfg, "corroborated");
  }
  const res = await handleRequest(
    postEvent(tileEvent({ lcV: "2", storageOk: true, device: fullClientDevice() })),
    env,
  );
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
      cfg, "corroborated"
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
      cfg, "corroborated"
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
      cfg, "corroborated"
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
      cfg, "corroborated"
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
      cfg, "corroborated"
    );
    assert.equal(r.alerted, false, `narration_failed #${i + 1} below threshold`);
  }
  const r10 = await recordTelemetry(
    store,
    tileEvent({ type: "narration_failed" }) as CrashReportEvent,
    now,
    cfg, "corroborated"
  );
  assert.equal(r10.alerted, true, "narration_failed trips at 10 from one build");
  assert.ok(r10.alertTexts.join("\n").includes("narration_failed"), "alert names the type");
});

test("threshold alert: suspected_crash still alerts at the per-build threshold (#311)", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const now = 1_729_000_000_000;
  // A captured error keeps this fixture developer_needed, so it is not
  // a can't-tell candidate — this test pins the threshold alert only.
  const crashTile = () =>
    tileEvent({ type: "suspected_crash", error: { name: "Error", message: "boom" } }) as CrashReportEvent;
  for (let i = 0; i < 9; i++) {
    const r = await recordTelemetry(
      store,
      crashTile(),
      now,
      cfg, "corroborated"
    );
    assert.equal(r.alerted, false, `suspected_crash #${i + 1} below threshold`);
  }
  const r10 = await recordTelemetry(
    store,
    crashTile(),
    now,
    cfg, "corroborated"
  );
  assert.equal(r10.alerted, true, "suspected_crash trips at 10 from one build");
  assert.ok(r10.alertTexts.join("\n").includes("suspected_crash"), "alert names the type");
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
  const corrTile = () =>
    tileEvent({ lcV: "2", storageOk: true, device: fullClientDevice({ os: "linux", form: "desktop" }) });
  await handleRequest(postEvent(corrTile()), env);
  assert.equal(fetchCalls.length, 0, "first event under the override");
  await handleRequest(postEvent(corrTile()), env);
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
      cfg, "corroborated"
    );
  }
  // tile_failed ×22 (builds f331846 ×20 + other ×2), baseline avg 20 → not anomalous.
  for (let i = 0; i < 20; i++) {
    await recordTelemetry(store, tileEvent({ buildId: "f331846" }) as CrashReportEvent, at(i), cfg, "corroborated");
  }
  for (let i = 0; i < 2; i++) {
    await recordTelemetry(
      store,
      tileEvent({ buildId: "other-build" }) as CrashReportEvent,
      at(i),
      cfg, "corroborated"
    );
  }
  // suspected_crash ×3, zero baseline → not flagged (below the 3-event floor).
  for (let i = 0; i < 3; i++) {
    await recordTelemetry(
      store,
      validEvent({ type: "suspected_crash", buildId: "f331846" }) as CrashReportEvent,
      at(i),
      cfg, "corroborated"
    );
  }
  // Trailing 24h baselines (hours before the previous one).
  for (let h = 1; h <= 24; h++) {
    const t = prev - h * HOUR_MS + 600_000;
    await recordTelemetry(
      store,
      validEvent({ type: "js_error", buildId: "f331846" }) as CrashReportEvent,
      t,
      cfg, "corroborated"
    );
    for (let i = 0; i < 20; i++) {
      await recordTelemetry(store, tileEvent({ buildId: "f331846" }) as CrashReportEvent, t, cfg, "corroborated");
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
    postEvent(
      corroboratedSuspected({
        buildId: "28c5fea",
        edition: "state",
        regionId: "nebraska",
        lastMilestone: "backgrounded",
        bgTerminal: true,
        buildReplaced: false,
        trailStuck: false,
        lcV: "1",
        breadcrumb: {
          sessionId: "sess-1",
          buildId: "28c5fea",
          startedAt: 1000,
          lastMilestone: "backgrounded",
          history: [
            { name: "boot_start", at: 1000 },
            { name: "backgrounded", at: 2000 },
          ],
        },
      }),
    ),
    env,
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.forwarded, true, "a corroborated crash forwards exactly as in Slice 1");
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
    postEvent({
      type: "recovery_outcome",
      ts: Date.now(),
      buildId: "28c5fea",
      recoveryOutcome: "repeat_failure",
      lcV: "2",
      storageOk: true,
      device: fullClientDevice(),
    }),
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
  const counted = await recordTelemetry(store, normalised, t0, cfg, "corroborated");
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
  await recordTelemetry(store, ev(), t0, cfg, "corroborated");
  await recordTelemetry(store, ev(), t0 + 37 * 60_000, cfg, "corroborated");
  // A late arrival: receipt in the 17:00 hour, client ts in the 15:00 hour.
  await recordTelemetry(store, ev({ ts: t0 - 2 * HOUR_MS }), t0 + 40 * 60_000, cfg, "corroborated");
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
      cfg, "corroborated"
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
      deviceClass: "SECRET-CLASS",
    },
    breadcrumb: {
      sessionId: "SECRET-SESSION",
      buildId: "f331846",
      startedAt: 1000,
      lastMilestone: "map_init_start",
      history: [{ name: "boot_start", at: 1000 }],
      device: { ua: "SECRET-BC-UA" },
    },
    unfinishedBoots: "SECRET-BOOTS",
    msSinceBootStart: "SECRET-MS",
    bgTerminal: false,
    buildReplaced: false,
    trailStuck: false,
    storageOk: true,
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

test("golden: buildAlert Discord for the #330 event (§5.5 shape, #345 severity lead)", () => {
  const alert = buildAlert(incident330Event());
  assert.equal(
    alert.discord,
    [
      "🚨 FIX — Developer action needed",
      "Meridian crash report",
      "priority: S1 · P1 — current build, foreground kill at map loading, phone-class iOS 16",
      "verdict: developer action needed",
      "why: App stopped mid-game on the current build; no error was captured, so the cause is unknown. Severity: S1 — 3 unfinished boots in a row with no clean boot since; the player most likely left and never got back in (player-left is INFERRED from the missing clean boot, not observed).",
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
      "priority: S1 · P1 — current build, foreground kill at map loading, phone-class iOS 16",
      "why: App stopped mid-game on the current build; no error was captured, so the cause is unknown. Severity: S1 — 3 unfinished boots in a row with no clean boot since; the player most likely left and never got back in (player-left is INFERRED from the missing clean boot, not observed).",
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
    "S1 · P1 — current build, foreground kill at map loading, phone-class iOS 16",
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
  assert.equal(lines[2], "priority: ungraded · P3 — current build, evidence incomplete, phone-class iOS 16");
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
  await recordTelemetry(store, incident330Event(), hourStart + 42 * 60_000, cfg, "corroborated");
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
    cfg, "corroborated"
  );
  const digest = await renderDigest(store, hourStart + HOUR_MS + 30 * 60_000);
  assert.equal(
    digest,
    [
      "📊 Meridian telemetry — hourly digest",
      "hour: 2026-11-03 17:00–18:00 UTC (receipt hour) (2 events)",
      "priority: S1 · P1 — 1× developer_needed/fg_kill_current on c6853be · ios 16 · phone",
      "S1 = player-left INFERRED from ≥3 unfinished boots with no clean boot — not observed.",
      "",
      "suspected_crash 1 · first 17:42 · last 17:42",
      "  builds: c6853be ×1 · editions: state ×1 · regions: nebraska ×1",
      "  groups: c6853be|ios|16|phone ×1",
      "  verdicts: developer_needed/fg_kill_current ×1 · severities: S1 ×1 · modes: scout ×1 · steps: map_init_start ×1",
      "js_error 1 · first 17:05 · last 17:05",
      "  builds: 2a0527f ×1 · editions: state ×1 · regions: nebraska ×1",
      "  groups: 2a0527f|android|unknown|phone ×1",
      "  verdicts: developer_needed/captured_error ×1 · severities: S2b ×1 · modes: full ×1 · steps: game_loaded ×1 · errors: TypeError ×1",
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
      cfg, "corroborated"
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
    cfg, "corroborated"
  );
  const digest = await renderDigest(store, t0 + HOUR_MS);
  assert.ok(digest?.includes("tile_failed 1 · first 17:10 · last 17:10 (some reports arrived late)"));
});

// --- Issue #345: severity grades -----------------------------------------
//
// The grade derives ONLY from the re-derived verdict + the stamped
// unfinished-boot streak. Boundaries pinned: threshold exactly 3,
// absent-streak fallback wording, and the ungraded absoluteness of
// insufficient_evidence / not_a_real_issue at any streak.

function bootFailureEvent(overrides: Record<string, unknown> = {}): CrashReportEvent {
  return {
    type: "boot_failure",
    ts: Date.UTC(2026, 10, 3, 17, 42, 0),
    buildId: "c6853be",
    error: { name: "Error", message: "boot timeout" },
    ...overrides,
  } as CrashReportEvent;
}

function recoveryEvent(overrides: Record<string, unknown> = {}): CrashReportEvent {
  return {
    type: "recovery_outcome",
    ts: Date.UTC(2026, 10, 3, 17, 42, 0),
    buildId: "c6853be",
    recoveryOutcome: "confirmed",
    ...overrides,
  } as unknown as CrashReportEvent;
}

test("severity: developer_needed at exactly the threshold streak (3) grades S1", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: 3 }));
  assert.equal(read?.grade, "S1");
  assert.equal(read?.streak, 3);
  assert.ok(read?.clause.includes("INFERRED"), "player-left is labelled inferred, never observed");
});

test("severity: developer_needed just below the threshold (2) grades S2b", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: 2 }));
  assert.equal(read?.grade, "S2b");
  assert.ok(read?.clause.includes("boot streak is 2"), "clause carries the stamped streak");
});

test("severity: developer_needed at streak 99 still grades S1 (no upper edge)", () => {
  assert.equal(severityOf(bootFailureEvent({ unfinishedBoots: 99 }))?.grade, "S1");
});

test("severity: developer_needed with NO stamped streak grades S2b and says it was not stamped", () => {
  const read = severityOf(bootFailureEvent());
  assert.equal(read?.grade, "S2b");
  assert.equal(read?.streak, null);
  assert.ok(read?.clause.includes("was not stamped"), "the fallback grade names its missing evidence");
  assert.ok(!read?.clause.includes("boot streak is"), "no invented streak number");
});

test("severity: developer_needed at streak 0 grades S2b without the not-stamped wording", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: 0 }));
  assert.equal(read?.grade, "S2b");
  assert.ok(read?.clause.includes("boot streak is 0"));
  assert.ok(!read?.clause.includes("was not stamped"), "a stamped zero is evidence, not absence");
});

test("severity: auto_fixed at the threshold streak (3) grades S2a", () => {
  const read = severityOf(recoveryEvent({ unfinishedBoots: 3 }));
  assert.equal(read?.grade, "S2a");
  assert.ok(read?.clause.includes("only after 3 unfinished boots"));
});

test("severity: auto_fixed above the threshold (7) grades S2a", () => {
  assert.equal(severityOf(recoveryEvent({ unfinishedBoots: 7 }))?.grade, "S2a");
});

test("severity: auto_fixed below the threshold (2) grades S3", () => {
  const read = severityOf(recoveryEvent({ unfinishedBoots: 2 }));
  assert.equal(read?.grade, "S3");
  assert.ok(read?.clause.includes("fixed itself"));
});

test("severity: auto_fixed with NO stamped streak grades S3 and says so", () => {
  const read = severityOf(recoveryEvent());
  assert.equal(read?.grade, "S3");
  assert.equal(read?.streak, null);
  assert.ok(read?.clause.includes("no boot streak was stamped"));
});

test("severity: auto_fixed at streak 0 grades S3", () => {
  assert.equal(severityOf(recoveryEvent({ unfinishedBoots: 0 }))?.grade, "S3");
});

// Direct-caller edge pins (#347 cure riders): severityOf is exported, so
// a caller can bypass normaliseEvent's clamping. The function re-checks
// the stamp itself — these tests pin that defensive behaviour without
// changing the adopted grading rules.
test("severity: a negative streak clamps to 0 (developer_needed grades S2b, streak 0)", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: -5 }));
  assert.equal(read?.grade, "S2b");
  assert.equal(read?.streak, 0);
  assert.ok(read?.clause.includes("boot streak is 0"));
});

test("severity: a negative streak clamps to 0 (auto_fixed grades S3, streak 0)", () => {
  const read = severityOf(recoveryEvent({ unfinishedBoots: -1 }));
  assert.equal(read?.grade, "S3");
  assert.equal(read?.streak, 0);
});

test("severity: a non-integer streak floors before grading (3.9 grades S1 as streak 3)", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: 3.9 }));
  assert.equal(read?.grade, "S1");
  assert.equal(read?.streak, 3);
});

test("severity: a non-integer streak below the threshold floors down (2.9 grades S3 as streak 2)", () => {
  const read = severityOf(recoveryEvent({ unfinishedBoots: 2.9 }));
  assert.equal(read?.grade, "S3");
  assert.equal(read?.streak, 2);
});

test("severity: a string streak reads as not stamped (developer_needed grades S2b, streak null)", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: "5" }));
  assert.equal(read?.grade, "S2b");
  assert.equal(read?.streak, null);
  assert.ok(read?.clause.includes("was not stamped"));
});

test("severity: a string streak reads as not stamped (auto_fixed grades S3, streak null)", () => {
  const read = severityOf(recoveryEvent({ unfinishedBoots: "5" }));
  assert.equal(read?.grade, "S3");
  assert.equal(read?.streak, null);
  assert.ok(read?.clause.includes("no boot streak was stamped"));
});

test("severity: a non-finite streak reads as not stamped", () => {
  const read = severityOf(bootFailureEvent({ unfinishedBoots: Number.NaN }));
  assert.equal(read?.grade, "S2b");
  assert.equal(read?.streak, null);
});

test("severity: insufficient_evidence is NEVER graded, even at streak 99", () => {
  const event = incident330Event({ unfinishedBoots: 99 });
  delete (event as Record<string, unknown>).bgTerminal;
  assert.equal(deriveVerdict(event).verdict, "insufficient_evidence");
  assert.equal(severityOf(event), null);
  assert.equal(severityKeyOf(event), "ungraded");
});

test("severity: not_a_real_issue is NEVER graded, even at streak 99", () => {
  const event = incident330Event({ unfinishedBoots: 99, bgTerminal: true, trailStuck: false });
  assert.equal(deriveVerdict(event).verdict, "not_a_real_issue");
  assert.equal(severityOf(event), null);
  assert.equal(severityKeyOf(event), "ungraded");
});

test("severity: hiccup-class events (tile_failed) stay ungraded", () => {
  const event = bootFailureEvent({ type: "tile_failed", unfinishedBoots: 50 });
  delete (event as Record<string, unknown>).error;
  assert.equal(severityOf(event), null);
});

test("severity: the alert leads priority with the grade and appends the clause to why", () => {
  const alert = buildAlert(incident330Event());
  assert.ok(alert.discord.includes("priority: S1 · P1 — "), "discord priority is severity-led");
  assert.ok(alert.emailBody.includes("priority: S1 · P1 — "), "email parity");
  assert.ok(alert.discord.includes("Severity: S1 — 3 unfinished boots in a row"), "why gains the clause");
  assert.ok(alert.emailBody.includes("Severity: S1 — 3 unfinished boots in a row"), "email parity");
});

test("severity: an ungraded alert renders 'ungraded' and gains NO Severity clause", () => {
  const event = incident330Event();
  delete (event as Record<string, unknown>).bgTerminal;
  const alert = buildAlert(event);
  assert.ok(alert.discord.includes("priority: ungraded · P3 — "));
  assert.ok(!alert.discord.includes("Severity:"), "no clause is invented for an ungraded verdict");
  assert.ok(!alert.emailBody.includes("Severity:"));
});

test("severity: an ungraded not_a_real_issue alert renders 'ungraded · P4' and gains NO Severity clause", () => {
  const event = incident330Event({ unfinishedBoots: 99, bgTerminal: true, trailStuck: false });
  assert.equal(deriveVerdict(event).verdict, "not_a_real_issue");
  const alert = buildAlert(event);
  assert.ok(alert.discord.includes("priority: ungraded · P4 — "));
  assert.ok(!alert.discord.includes("Severity:"), "a benign verdict gains no grade, even at streak 99");
  assert.ok(!alert.emailBody.includes("Severity:"));
});

test("severity counting: recordTelemetry tallies grades per bucket, ungraded included", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 10, 0);
  await recordTelemetry(store, bootFailureEvent({ unfinishedBoots: 3 }), t0, cfg, "corroborated");
  await recordTelemetry(store, bootFailureEvent({ unfinishedBoots: 4 }), t0, cfg, "corroborated");
  await recordTelemetry(store, bootFailureEvent({ unfinishedBoots: 1 }), t0, cfg, "corroborated");
  await recordTelemetry(store, bootFailureEvent(), t0, cfg, "corroborated");
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(t0), "boot_failure")))!;
  assert.deepEqual(bucket.severities, { S1: 2, S2b: 2 });
});

test("severity counting: a pre-#345 bucket JSON without severities reads back as an empty map", async () => {
  const legacy = JSON.stringify({ total: 3, builds: { abc123: 3 } });
  const store = kvTelemetryStore({
    get: async () => legacy,
    put: async () => {},
  });
  const bucket = await store.readBucket(bucketKey("2026-11-03T17", "boot_failure"));
  assert.deepEqual(bucket?.severities, {});
});

test("severity digest: an S1 hour carries the INFERRED gloss exactly once", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 10, 0);
  await recordTelemetry(store, bootFailureEvent({ unfinishedBoots: 3 }), t0, cfg, "corroborated");
  await recordTelemetry(store, bootFailureEvent({ unfinishedBoots: 4 }), t0, cfg, "corroborated");
  const digest = await renderDigest(store, t0 + HOUR_MS);
  assert.ok(digest, "digest produced");
  const gloss =
    "S1 = player-left INFERRED from ≥3 unfinished boots with no clean boot — not observed.";
  assert.ok(digest.includes(gloss), "the S1 gloss line is present");
  assert.equal(
    digest.split("\n").filter((l) => l === gloss).length,
    1,
    "the gloss appears exactly once, however many S1 events the hour counted",
  );
});

test("severity digest: an hour with NO S1 carries no INFERRED gloss", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 10, 0);
  // S2b (developer_needed, no streak) + S3 (auto_fixed, low streak):
  // graded, but neither is S1, so no gloss may appear.
  await recordTelemetry(store, bootFailureEvent(), t0, cfg, "corroborated");
  await recordTelemetry(store, recoveryEvent({ unfinishedBoots: 1 }), t0, cfg, "corroborated");
  const digest = await renderDigest(store, t0 + HOUR_MS);
  assert.ok(digest, "digest produced");
  assert.ok(!digest.includes("INFERRED"), "no S1 in the hour → no player-left gloss");
  assert.ok(!digest.includes("player-left"), "no S1 in the hour → no player-left wording at all");
});

test("severity digest: an hour of only ungraded events keeps the plain priority line", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  const t0 = Date.UTC(2026, 10, 3, 17, 10, 0);
  await recordTelemetry(
    store,
    validEvent({ type: "tile_failed" }) as unknown as CrashReportEvent,
    t0,
    cfg, "corroborated"
  );
  const digest = await renderDigest(store, t0 + HOUR_MS);
  assert.ok(digest, "digest produced");
  const priorityLine = digest.split("\n").find((l) => l.startsWith("priority:"))!;
  assert.ok(priorityLine.startsWith("priority: P3 — "), `no severity lead without a graded event: ${priorityLine}`);
  assert.ok(digest.includes("severities: ungraded ×1"), "the counted dimension still renders");
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

// --- Provenance gate (Slices 1+2, manifest 2026-11-05) --------------------
//
// W9′/T1 test titles name the spec check they pin (P1′, P2, P3′-client,
// P3′-watchdog, P3′-funnel, P4a′, P4b′) so a golden-table failure names
// its check. All should-not-surface assertions use stubbed fetch counts
// + the bucket provenance dim, never the response body.

const PROV_T0 = Date.UTC(2026, 10, 5, 17, 0, 0); // 2026-11-05T17:00Z

function provJsError(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "js_error",
    ts: 1_729_000_000_000,
    buildId: "a1b2c3d4e5f6",
    sessionId: "sess-1",
    lastMilestone: "game_loaded",
    lcV: "2",
    storageOk: true,
    deviceSource: "live",
    msSinceBootStart: 1234,
    device: fullClientDevice(),
    error: { name: "TypeError", message: "boom" },
    ...overrides,
  };
}

function provSuspected(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "suspected_crash",
    ts: 1_729_000_000_000,
    buildId: "a1b2c3d4e5f6",
    sessionId: "sess-1",
    lastMilestone: "game_loaded",
    lcV: "2",
    storageOk: true,
    deviceSource: "crashed_session",
    device: fullClientDevice(),
    breadcrumb: {
      sessionId: "sess-1",
      buildId: "a1b2c3d4e5f6",
      startedAt: 1000,
      lastMilestone: "game_loaded",
      history: [
        { name: "boot_start", at: 1000 },
        { name: "game_loaded", at: 2000 },
      ],
    },
    ...overrides,
  };
}

test("W9′(i) P4a′ full-trail suspected_crash (history ≥1) → corroborated, and forwards via handleRequest", async () => {
  assert.equal(provenanceOf(provSuspected() as never), "corroborated", "P4a′ full trail");
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(corroboratedSuspected()), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 1, "corroborated crash forwards once (Discord)");
});

test("W9′(ii) P4a′ truncation-stub suspected_crash → corroborated (history [] or absent; graft: stub arm requires it)", async () => {
  const stub = {
    sessionId: "sess-1",
    buildId: "a1b2c3d4e5f6",
    startedAt: 1000,
    lastMilestone: "game_loaded",
    history: [] as Array<{ name: string; at: number }>,
  };
  assert.equal(
    provenanceOf(provSuspected({ breadcrumb: stub }) as never),
    "corroborated",
    "P4a′ truncation stub, history []",
  );
  const { history: _dropped, ...stubNoHistory } = stub;
  assert.equal(
    provenanceOf(provSuspected({ breadcrumb: stubNoHistory }) as never),
    "corroborated",
    "P4a′ truncation stub, history absent",
  );
  assert.equal(
    provenanceOf(provSuspected({ breadcrumb: { ...stub, history: "junk" } }) as never),
    "uncorroborated",
    "P4a′ graft: stub arm rejects a non-array, non-empty history",
  );
  // Gate outcome: the same stub payloads forward via handleRequest.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const resStub = await handleRequest(postEvent(provSuspected({ breadcrumb: stub })), env);
  assert.equal(resStub.status, 200);
  assert.ok(fetchCalls.length >= 1, "corroborated truncation stub (history []) forwards");
  const resNoHistory = await handleRequest(postEvent(provSuspected({ breadcrumb: stubNoHistory })), env);
  assert.equal(resNoHistory.status, 200);
  assert.equal(fetchCalls.length, 2, "corroborated truncation stub (history absent) forwards");
});

test("W9′(iii) P4a′ core-only suspected_crash (no breadcrumb) → uncorroborated", async () => {
  const ev = provSuspected();
  delete ev.breadcrumb;
  assert.equal(provenanceOf(ev as never), "uncorroborated", "P4a′ breadcrumb required");
  // Gate outcome: the same payload is gated via handleRequest.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(ev), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "uncorroborated crash is gated — no forward");
});

test("W9′(iv) P3′-watchdog boot_failure (webgl pair, no deviceClass, 10 keys) → corroborated; 9 keys → uncorroborated", async () => {
  const watchdogDevice = {
    browser: "safari",
    browserVersion: "16.4",
    engine: "webkit",
    os: "ios",
    osVersion: "16.4.1",
    form: "mobile",
    screen: "md",
    dpr: 2,
    webgl1: true,
    webgl2: true,
  };
  const ev = {
    type: "boot_failure",
    ts: 1_729_000_000_000,
    buildId: "a1b2c3d4e5f6",
    lcV: "1",
    storageOk: true,
    device: watchdogDevice,
    error: { name: "Error", message: "boot timeout" },
  };
  assert.equal(provenanceOf(ev as never), "corroborated", "P3′-watchdog floor");
  const { dpr: _dpr, ...nineKeys } = watchdogDevice;
  assert.equal(
    provenanceOf({ ...ev, device: nineKeys } as never),
    "uncorroborated",
    "P3′-watchdog key-count floor (≥10)",
  );
  // Gate outcome: boot_failure is crash-class — corroborated forwards,
  // the 9-key variant is gated.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(ev), env);
  assert.equal(res.status, 200);
  assert.ok(fetchCalls.length >= 1, "corroborated watchdog boot_failure forwards");
  const res9 = await handleRequest(postEvent({ ...ev, device: nineKeys }), env);
  assert.equal(res9.status, 200);
  assert.equal(fetchCalls.length, 1, "9-key watchdog variant is gated — no further forward");
});

test("W9′(v) P3′-funnel narration_failed with device exactly {os, form} → corroborated; missing form → uncorroborated", async () => {
  const ev = {
    type: "narration_failed",
    ts: 1_729_000_000_000,
    buildId: "a1b2c3d4e5f6",
    lcV: "2",
    storageOk: false,
    device: { os: "android", form: "mobile" },
  };
  assert.equal(provenanceOf(ev as never), "corroborated", "P3′-funnel named-only floor (storageOk false still passes P2)");
  assert.equal(
    provenanceOf({ ...ev, device: { os: "android" } } as never),
    "uncorroborated",
    "P3′-funnel requires form",
  );
  // Gate outcome: funnel never forwards — the same payload is counted
  // with its provenance dim.
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(ev), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "funnel-class is counted only — no individual forward");
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(Date.now()), "narration_failed")))!;
  assert.equal(bucket.total, 1, "funnel event counted");
  assert.equal(bucket.provenance.corroborated, 1, "counted with the corroborated provenance dim");
});

test("W9′(vi) P4b′ pre-init js_error (exact signature, graft: no sessionId, lastMilestone undefined) → corroborated; hybrid shapes → uncorroborated", async () => {
  const preInit = {
    type: "js_error",
    ts: 1_729_000_000_000,
    buildId: "a1b2c3d4e5f6",
    lcV: "2",
    storageOk: true,
    deviceSource: "live",
    msSinceBootStart: "unknown",
    device: fullClientDevice(),
    error: { name: "Error", message: "early boom" },
  };
  assert.equal(provenanceOf(preInit as never), "corroborated", "P4b′ pre-init signature");
  assert.equal(
    provenanceOf({ ...preInit, sessionId: "sess-9" } as never),
    "uncorroborated",
    "P4b′ graft: pre-init arm forbids a sessionId (hybrid is unproducible)",
  );
  assert.equal(
    provenanceOf({ ...preInit, lastMilestone: "boot_start" } as never),
    "uncorroborated",
    "P4b′ graft: pre-init arm requires lastMilestone undefined",
  );
  assert.equal(
    provenanceOf(provJsError({ lastMilestone: undefined }) as never),
    "corroborated",
    "P4b′ linked arm: sessionId + numeric msSinceBootStart links without lastMilestone (route error / chunk-load emit none)",
  );
  assert.equal(
    provenanceOf(provJsError({ lastMilestone: undefined, msSinceBootStart: "unknown" }) as never),
    "uncorroborated",
    "P4b′ hybrid: sessionId with neither lastMilestone nor numeric msSinceBootStart is unproducible",
  );
  // Gate outcome: js_error is crash-class — the same pre-init payload forwards.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(preInit), env);
  assert.equal(res.status, 200);
  assert.ok(fetchCalls.length >= 1, "corroborated pre-init js_error forwards");
});

test("W9′(vii) P4a′ full trail with session mismatch → uncorroborated", async () => {
  const ev = provSuspected({
    breadcrumb: {
      sessionId: "other-session",
      buildId: "a1b2c3d4e5f6",
      startedAt: 1000,
      lastMilestone: "game_loaded",
      history: [{ name: "boot_start", at: 1000 }],
    },
  });
  assert.equal(provenanceOf(ev as never), "uncorroborated", "P4a′ session linkage");
  // Gate outcome: the same payload is gated via handleRequest.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(ev), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "session-mismatched crash is gated — no forward");
});

test("W9′ P4a′ truncation stub with session mismatch → uncorroborated", async () => {
  const stubMismatch = {
    sessionId: "other-session",
    buildId: "a1b2c3d4e5f6",
    startedAt: 1000,
    lastMilestone: "game_loaded",
    history: [] as Array<{ name: string; at: number }>,
  };
  assert.equal(
    provenanceOf(provSuspected({ breadcrumb: stubMismatch }) as never),
    "uncorroborated",
    "P4a′ stub arm session linkage (history [])",
  );
  const { history: _dropped, ...stubMismatchNoHistory } = stubMismatch;
  assert.equal(
    provenanceOf(provSuspected({ breadcrumb: stubMismatchNoHistory }) as never),
    "uncorroborated",
    "P4a′ stub arm session linkage (history absent)",
  );
  // Gate outcome: the same stub payload is gated via handleRequest.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(provSuspected({ breadcrumb: stubMismatch })), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "stub session-mismatched crash is gated — no forward");
});

test("W9′(viii) P1′ local-<base36> and \"dev\" builds, rest valid → corroborated", async () => {
  assert.equal(provenanceOf(provJsError({ buildId: "local-abc123" }) as never), "corroborated", "P1′ local- shape");
  assert.equal(provenanceOf(provJsError({ buildId: "dev" }) as never), "corroborated", "P1′ dev shape");
  // Gate outcome: js_error is crash-class — both shapes forward.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const resLocal = await handleRequest(postEvent(provJsError({ buildId: "local-abc123" })), env);
  assert.equal(resLocal.status, 200);
  assert.ok(fetchCalls.length >= 1, "corroborated local- build forwards");
  const resDev = await handleRequest(postEvent(provJsError({ buildId: "dev" })), env);
  assert.equal(resDev.status, 200);
  assert.equal(fetchCalls.length, 2, "corroborated dev build forwards");
});

test("W9′(ix) P1′ buildId \"!!!\" → uncorroborated; probe-style buildId → uncorroborated", async () => {
  assert.equal(provenanceOf(provJsError({ buildId: "!!!" }) as never), "uncorroborated", "P1′ build shape");
  assert.equal(provenanceOf(provJsError({ buildId: "chitti-verify" }) as never), "uncorroborated", "P1′ probe build");
  // Gate outcome: both shapes are gated via handleRequest.
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(postEvent(provJsError({ buildId: "!!!" })), env);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "invalid build shape is gated — no forward");
  const resProbe = await handleRequest(postEvent(provJsError({ buildId: "chitti-verify" })), env);
  assert.equal(resProbe.status, 200);
  assert.equal(fetchCalls.length, 0, "probe-style build is gated — no forward");
});

test("W9′ P2 stamps: missing storageOk or empty lcV → uncorroborated", () => {
  const noStorage = provJsError();
  delete noStorage.storageOk;
  assert.equal(provenanceOf(noStorage as never), "uncorroborated", "P2 storageOk boolean required");
  assert.equal(provenanceOf(provJsError({ lcV: "" }) as never), "uncorroborated", "P2 lcV non-empty required");
});

test("W9′ P3′-client: device missing deviceClass → uncorroborated", () => {
  const dev = fullClientDevice();
  delete dev.deviceClass;
  assert.equal(provenanceOf(provJsError({ device: dev }) as never), "uncorroborated", "P3′-client named fields");
});

test("W15a KV-up: uncorroborated crash is gated — zero Discord/email stub calls, provenance.uncorroborated +1", async () => {
  const { map, store } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, {
    DISCORD_WEBHOOK_URL: "https://discord.test/hook",
    RESEND_API_KEY: "rk-test",
    REPORT_EMAIL: "alerts@example.com",
  });
  const res = await handleRequest(
    postEvent({ type: "js_error", ts: Date.now(), buildId: "probe-verify", error: { name: "Error", message: "boom" } }),
    env,
  );
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 0, "gated event reaches neither Discord nor email");
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(Date.now()), "js_error")))!;
  assert.equal(bucket.provenance.uncorroborated, 1, "counted as uncorroborated");
  assert.equal(bucket.provenance.corroborated ?? 0, 0);
});

test("W15b KV-down: the same uncorroborated crash payload is forwarded (gate fails open on !counted)", async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const brokenKv: KvLike = {
    get: async () => {
      throw new Error("kv down");
    },
    put: async () => {
      throw new Error("kv down");
    },
  };
  const env: CrashReportEnv = {
    DISCORD_WEBHOOK_URL: "https://discord.test/hook",
    TELEMETRY_COUNTS: brokenKv,
  };
  const res = await handleRequest(
    postEvent({ type: "js_error", ts: Date.now(), buildId: "probe-verify", error: { name: "Error", message: "boom" } }),
    env,
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { forwarded: boolean; counted: boolean };
  assert.equal(json.counted, false);
  assert.equal(json.forwarded, true, "KV failure must not gate everything");
  assert.equal(fetchCalls.length, 1);
});

test("T1 totality: provenanceOf never throws on malformed shapes (P1′/P2/P3′/P4a′/P4b′ guards) and returns uncorroborated", () => {
  const malformed: unknown[] = [
    null,
    undefined,
    42,
    "x",
    [],
    {},
    { type: "bogus" },
    { type: "js_error" },
    provJsError({ device: 42 }),
    provJsError({ device: null }),
    provSuspected({ breadcrumb: "nope" }),
    provSuspected({ breadcrumb: { history: "nope" } }),
    provSuspected({ breadcrumb: { sessionId: 7, history: [null] } }),
    provJsError({ sessionId: undefined, msSinceBootStart: 5 }),
  ];
  for (const m of malformed) {
    assert.equal(provenanceOf(m as never), "uncorroborated", JSON.stringify(m)?.slice(0, 60));
  }
});

test("T1 totality: a validation-passing malformed event through handleRequest returns HTTP 200 (and is gated)", async () => {
  const { map } = memoryStore();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
  const res = await handleRequest(
    postEvent({ type: "suspected_crash", ts: Date.now(), buildId: "a1b2c3d4e5f6", breadcrumb: { sessionId: 123 } }),
    env,
  );
  assert.equal(res.status, 200, "gate never throws the request path");
  assert.equal(fetchCalls.length, 0, "malformed crash is gated, not forwarded");
});

// --- C1′/C2′: live init() drive (ruling a) ---------------------------------

function makeObsStorage(initial: Record<string, string> = {}) {
  const raw = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (raw.has(k) ? (raw.get(k) as string) : null),
    setItem: (k: string, v: string) => void raw.set(k, v),
    removeItem: (k: string) => void raw.delete(k),
  };
}

const CRASHED_RUNTIME = {
  browser: "safari",
  browserVersion: "16.4",
  engine: "webkit",
  os: "ios",
  osVersion: "16.4.1",
  deviceClass: "phone",
  hardwareConcurrency: 6,
  deviceMemory: "unknown",
  form: "mobile",
  dpr: 2,
  screen: "md",
  touchPoints: "2-5",
  displayMode: "unknown",
  connection: "unknown",
  locale: "en-US",
};

function driveInitEmittedSuspectedCrash(
  history: Array<{ name: string; at: number }>,
  lastMilestone: string,
): Record<string, unknown> {
  const prev = {
    sessionId: "prev-session",
    buildId: "a1b2c3d4e5f6",
    startedAt: 1000,
    lastMilestone,
    history,
    edition: "globe",
    regionId: "globe",
    runtime: CRASHED_RUNTIME,
    bgTerminal: false,
    trailStuck: false,
    vis: true,
  };
  const beacons: string[] = [];
  const obs = createObservability({
    storage: makeObsStorage({ [BREADCRUMB_KEY]: JSON.stringify(prev) }),
    durableStorage: makeObsStorage(),
    transport: {
      sendBeacon: (_url: string, body: string) => {
        beacons.push(body);
        return true;
      },
    },
    endpoint: "https://example.com/ingest",
    now: () => 9000,
    randomId: () => "new-session",
    buildId: "a1b2c3d4e5f6",
    isUnclean: () => true,
    document: null,
  });
  obs.init();
  assert.equal(beacons.length, 1, "init() emitted exactly one suspected_crash");
  return JSON.parse(beacons[0]) as Record<string, unknown>;
}

test("C1′ real init() drive (P4a′): the actually-emitted suspected_crash corroborates", () => {
  const payload = driveInitEmittedSuspectedCrash(
    [
      { name: "boot_start", at: 1000 },
      { name: "game_loaded", at: 3000 },
    ],
    "game_loaded",
  );
  assert.equal(payload.type, "suspected_crash");
  assert.equal(
    (payload.breadcrumb as { history: unknown[] }).history.length,
    2,
    "C1′ emitted trail carries the seeded 2 entries",
  );
  assert.equal(provenanceOf(payload as never), "corroborated", "P4a′ full trail on the emitted event");
});

test("C2′ real init() drive (P4a′): trail history length exactly 1 (boot_start only) corroborates", () => {
  const payload = driveInitEmittedSuspectedCrash([{ name: "boot_start", at: 1000 }], "boot_start");
  assert.equal(payload.type, "suspected_crash");
  assert.equal(
    (payload.breadcrumb as { history: unknown[] }).history.length,
    1,
    "C2′ emitted trail carries exactly the seeded 1 entry (boot_start)",
  );
  assert.equal(provenanceOf(payload as never), "corroborated", "P4a′ history ≥1, never game_loaded");
});

// --- R1/R2: fail-closed param + corroborated-only threshold ---------------

test("R1: recordTelemetry with invalid/missing provenance counts the event as uncorroborated in all dims (fail-closed)", async () => {
  const cfg = thresholdConfig({});
  for (const bad of ["bogus", undefined] as unknown[]) {
    const { store } = memoryStore();
    const r = await recordTelemetry(store, tileEvent() as CrashReportEvent, PROV_T0, cfg, bad as never);
    assert.equal(r.counted, true);
    const bucket = (await store.readBucket(bucketKey(hourLabelOf(PROV_T0), "tile_failed")))!;
    assert.equal(bucket.provenance.uncorroborated, 1, `provenance=${String(bad)} counts uncorroborated`);
    assert.equal(bucket.provenance.corroborated ?? 0, 0);
    assert.deepEqual(bucket.corrBuilds, {}, "no corroborated build counted");
  }
});

test("R2: threshold reads corroborated counts only — 25 uncorroborated same-build fire nothing and don't burn the slot; the 10th corroborated fires", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 25; i++) {
    const r = await recordTelemetry(store, tileEvent() as CrashReportEvent, PROV_T0, cfg, "uncorroborated");
    assert.deepEqual(r.alertTexts, [], `uncorroborated #${i + 1} fires nothing`);
  }
  let bucket = (await store.readBucket(bucketKey(hourLabelOf(PROV_T0), "tile_failed")))!;
  assert.deepEqual(bucket.alerts, [], "threshold slot unburned by uncorroborated traffic");
  assert.equal(bucket.provenance.uncorroborated, 25);
  for (let i = 0; i < 9; i++) {
    const r = await recordTelemetry(store, tileEvent() as CrashReportEvent, PROV_T0, cfg, "corroborated");
    assert.deepEqual(r.alertTexts, [], `corroborated #${i + 1} below the per-build threshold`);
  }
  const r10 = await recordTelemetry(store, tileEvent() as CrashReportEvent, PROV_T0, cfg, "corroborated");
  assert.equal(r10.alertTexts.length, 1, "10th corroborated fires the per-build threshold");
  assert.ok(r10.alertTexts[0].includes("crossed the hiccup threshold"));
  bucket = (await store.readBucket(bucketKey(hourLabelOf(PROV_T0), "tile_failed")))!;
  assert.equal(bucket.alerts.length, 1);
  assert.ok(bucket.alerts[0].startsWith("threshold:"));
});

// --- E1–E7: can't-tell escalation ------------------------------------------

/** A crash-tier can't-tell candidate: suspected_crash, insufficient_evidence. */
function cantTellCandidate(overrides: Record<string, unknown> = {}): CrashReportEvent {
  return {
    type: "suspected_crash",
    ts: PROV_T0,
    buildId: "build-a",
    lastMilestone: "boot_start",
    device: { os: "ios", osVersion: "16.4.1", deviceClass: "phone" },
    ...overrides,
  } as unknown as CrashReportEvent;
}

const PATTERN_A = "build-a|ios|16|phone";
const PATTERN_B = "build-b|android|13|tablet";

function cantTellCandidateB(): CrashReportEvent {
  return cantTellCandidate({
    buildId: "build-b",
    device: { os: "android", osVersion: "13.0", deviceClass: "tablet" },
  });
}

test("E1: conjunctive legs block independently — pattern ×3 with total <5 no; second pattern reaching total 5 at count 2 no; first pattern's next candidate fires", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 3; i++) {
    const r = await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
    assert.deepEqual(r.alertTexts, [], `pattern A #${i + 1}: candidate total <5 blocks`);
  }
  for (let i = 0; i < 2; i++) {
    const r = await recordTelemetry(store, cantTellCandidateB(), PROV_T0, cfg, "uncorroborated");
    assert.deepEqual(r.alertTexts, [], `pattern B #${i + 1}: pattern count <3 blocks (total reaches 5)`);
  }
  const fired = await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
  assert.equal(fired.alertTexts.length, 1, "pattern A at count 4 with total ≥5 fires");
  assert.ok(fired.alertTexts[0].includes("❔"), "can't-tell dress, never 🚨");
  assert.ok(fired.alertTexts[0].includes(PATTERN_A), "alert names the pattern");
  assert.ok(buildCantTellAlert("suspected_crash", "2026-11-05T17", PATTERN_A, 4, 6, 0).startsWith("❔"));
});

test("E2: trailing leg blocks — seeded pattern average 2 (needs >6): pattern at 5 no, at 7 yes", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (let h = 1; h <= 24; h++) {
    const seed = emptyBucket();
    seed.total = 2;
    seed.cantTellGroups[PATTERN_A] = 2;
    await store.writeBucket(bucketKey(hourLabelOf(PROV_T0 - h * HOUR_MS), "suspected_crash"), seed);
  }
  let last;
  for (let i = 1; i <= 7; i++) {
    last = await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
    if (i <= 6) assert.deepEqual(last.alertTexts, [], `pattern at ${i}: trailing leg blocks (needs >6)`);
  }
  assert.equal(last!.alertTexts.length, 1, "pattern at 7 exceeds 3× the trailing average of 2");
});

test("E3: read economy — exactly 1 readBucket below the cheap legs; ≤25 on the evaluating event", async () => {
  const { store: inner } = memoryStore();
  let reads = 0;
  const store: TelemetryStore = {
    readBucket: async (k: string) => {
      reads += 1;
      return inner.readBucket(k);
    },
    writeBucket: (k: string, b) => inner.writeBucket(k, b),
  };
  const cfg = thresholdConfig({});
  await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
  assert.equal(reads, 1, "cheap legs fail → zero trailing reads");
  for (let i = 0; i < 3; i++) {
    await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
  }
  const before = reads;
  const fired = await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
  assert.equal(fired.alertTexts.length, 1, "5th candidate evaluates and fires (trailing average 0)");
  assert.ok(reads - before <= 25, `evaluating event spent ${reads - before} reads (≤25)`);
  assert.equal(reads - before, 25, "1 current-bucket read + 24 trailing reads");
});

test("E4: once per pattern+hour — same pattern adds no second text; a different pattern fires independently", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  let firedA = 0;
  for (let i = 0; i < 7; i++) {
    const r = await recordTelemetry(store, cantTellCandidate(), PROV_T0, cfg, "uncorroborated");
    firedA += r.alertTexts.length;
  }
  assert.equal(firedA, 1, "pattern A fires exactly once despite 7 candidates");
  let firedB = 0;
  for (let i = 0; i < 3; i++) {
    const r = await recordTelemetry(store, cantTellCandidateB(), PROV_T0, cfg, "uncorroborated");
    firedB += r.alertTexts.length;
  }
  assert.equal(firedB, 1, "pattern B (count 3, total already ≥5) fires independently");
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(PROV_T0), "suspected_crash")))!;
  assert.equal(bucket.alerts.filter((a) => a.startsWith("canttell:")).length, 2);
});

test("E5 scope: corroborated developer_needed ×6 same pattern → no can't-tell alert", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 6; i++) {
    const r = await recordTelemetry(
      store,
      provJsError() as unknown as CrashReportEvent,
      PROV_T0,
      cfg,
      "corroborated",
    );
    assert.deepEqual(r.alertTexts, [], `corroborated developer_needed #${i + 1} is not a candidate`);
  }
});

test("E5 scope: uncorroborated hiccup/funnel ×6 → no can't-tell alert", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (const type of ["tile_failed", "narration_failed"] as const) {
    for (let i = 0; i < 6; i++) {
      const r = await recordTelemetry(
        store,
        tileEvent({ type }) as CrashReportEvent,
        PROV_T0,
        cfg,
        "uncorroborated",
      );
      assert.deepEqual(r.alertTexts, [], `${type} #${i + 1}: non-crash tier never escalates`);
    }
  }
});

test("E5 scope: corroborated insufficient_evidence recovery_outcome (non-repeat_failure) ×6 → no can't-tell alert", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 6; i++) {
    const r = await recordTelemetry(
      store,
      outcomeEvent({ recoveryOutcome: "stood_down" }),
      PROV_T0,
      cfg,
      "corroborated",
    );
    assert.deepEqual(r.alertTexts, [], `stood_down #${i + 1}: hiccup tier, not a candidate`);
  }
});

test("E6 privacy: SECRET-SESSION is absent from can't-tell + threshold alert texts and every bucket", async () => {
  const { map, store } = memoryStore();
  const cfg = thresholdConfig({});
  // logLine emits via console.log — capture that channel for both flows.
  const capturedLogs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    capturedLogs.push(args.map((a) => String(a)).join(" "));
  };
  try {
    let cantTell = "";
    for (let i = 0; i < 5; i++) {
      const r = await recordTelemetry(
        store,
        cantTellCandidate({ sessionId: "SECRET-SESSION" }),
        PROV_T0,
        cfg,
        "uncorroborated",
      );
      if (r.alertTexts[0]) cantTell = r.alertTexts[0];
    }
    assert.ok(cantTell.includes("❔"), "can't-tell alert fired (non-vacuous)");
    assert.ok(!cantTell.includes("SECRET-SESSION"), "can't-tell text carries no sessionId");
    let threshold = "";
    for (let i = 0; i < 10; i++) {
      const r = await recordTelemetry(
        store,
        tileEvent({ sessionId: "SECRET-SESSION" }) as CrashReportEvent,
        PROV_T0,
        cfg,
        "corroborated",
      );
      if (r.alertTexts[0]) threshold = r.alertTexts[0];
    }
    assert.ok(threshold.includes("crossed the hiccup threshold"), "threshold alert fired (non-vacuous)");
    assert.ok(!threshold.includes("SECRET-SESSION"), "threshold text carries no sessionId");
    const rawBuckets = [...map.values()].join("\n");
    assert.ok(!rawBuckets.includes("SECRET-SESSION"), "no bucket carries a sessionId");
    assert.ok(
      !capturedLogs.join("\n").includes("SECRET-SESSION"),
      "worker logs during the can't-tell + threshold flows carry no sessionId",
    );
  } finally {
    console.log = originalLog;
  }
});

test("E7: the \"other\" overflow pattern (33rd distinct group) never escalates", async () => {
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  for (let i = 0; i < 35; i++) {
    const r = await recordTelemetry(
      store,
      cantTellCandidate({ buildId: `build-${i}` }),
      PROV_T0,
      cfg,
      "uncorroborated",
    );
    assert.deepEqual(r.alertTexts, [], `distinct pattern #${i + 1} must not escalate`);
  }
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(PROV_T0), "suspected_crash")))!;
  assert.equal(bucket.cantTellGroups["other"], 3, "patterns 33–35 tallied under other (count 3, total 35)");
  assert.deepEqual(bucket.alerts, [], "\"other\" never fires, even at count ≥3 with total ≥5");
});

test("W16 legacy pre-Slice-1 event: counted-only + escalation-eligible — Liz's 2026-11-05 Q1 ruling (fail-closed)", async () => {
  const legacy = {
    type: "suspected_crash",
    ts: PROV_T0,
    buildId: "legacybuild",
  } as unknown as CrashReportEvent;
  assert.equal(
    provenanceOf(legacy as never),
    "uncorroborated",
    "bare legacy shape fails the provenance checks (unverifiable, never 'not real')",
  );
  const { store } = memoryStore();
  const cfg = thresholdConfig({});
  let fired = "";
  for (let i = 0; i < 5; i++) {
    const r = await recordTelemetry(store, legacy, PROV_T0, cfg, provenanceOf(legacy as never));
    if (r.alertTexts[0]) fired = r.alertTexts[0];
  }
  const bucket = (await store.readBucket(bucketKey(hourLabelOf(PROV_T0), "suspected_crash")))!;
  assert.equal(bucket.total, 5, "legacy events are counted, never dropped");
  assert.equal(bucket.provenance.uncorroborated, 5);
  assert.ok(fired.includes("❔"), "a widespread legacy failure surfaces only via the can't-tell escalation");
});

// --- P4b′ real-client drive: live errors emitted WITHOUT lastMilestone ------
//
// Regression pin for the #353 blocker: the route error boundary
// (src/lib/error-component.tsx) and the region-chunk load failure
// (src/components/game-app.tsx) emit js_error after init() with a
// sessionId but no lastMilestone. Those are real kid crashes and must
// stay corroborated + forwarded.

function driveLiveEmittedJsError(err: unknown): Record<string, unknown> {
  const beacons: string[] = [];
  let t = 5000;
  const obs = createObservability({
    storage: makeObsStorage(),
    durableStorage: makeObsStorage(),
    transport: {
      sendBeacon: (_url: string, body: string) => {
        beacons.push(body);
        return true;
      },
    },
    endpoint: "https://example.com/ingest",
    now: () => (t += 250),
    randomId: () => "live-session",
    buildId: "a1b2c3d4e5f6",
    isUnclean: () => false,
    document: null,
  });
  obs.init();
  // Exact call shape of both client sites: buildId "" and no lastMilestone.
  obs.emit({ type: "js_error", ts: Date.now(), buildId: "", error: sanitizeError(err) });
  const sent = beacons.map((b) => JSON.parse(b) as Record<string, unknown>).filter((p) => p.type === "js_error");
  assert.equal(sent.length, 1, "exactly one js_error left the client");
  return sent[0];
}

for (const [label, err] of [
  ["route error boundary (error-component.tsx)", new TypeError("Cannot read properties of undefined (reading 'map')")],
  [
    "region-chunk load failure (game-app.tsx)",
    new Error("We couldn't open the Globe right now. Check that you're online, then tap Play again."),
  ],
] as const) {
  test(`P4b′ real client drive: ${label} js_error (sessionId, no lastMilestone) → corroborated and forwards once`, async () => {
    const payload = driveLiveEmittedJsError(err);
    assert.equal(payload.sessionId, "live-session", "emit() stamped the live sessionId");
    assert.equal(payload.lastMilestone, undefined, "the real client sends no lastMilestone on this path");
    assert.equal(typeof payload.msSinceBootStart, "number", "emit() couples a numeric msSinceBootStart");
    assert.equal(provenanceOf(payload as never), "corroborated", "P4b′ live linkage");
    const { map, store } = memoryStore();
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
    const res = await handleRequest(postEvent(payload), env);
    assert.equal(res.status, 200);
    assert.equal(fetchCalls.length, 1, "real crash pages Discord exactly once");
    assert.equal(fetchCalls[0].url, "https://discord.test/hook");
    const bucket = (await store.readBucket(bucketKey(hourLabelOf(Date.now()), "js_error")))!;
    assert.equal(bucket.provenance.corroborated, 1, "counted as corroborated");
  });
}

// The probes that paged on 2026-11-05/06 ("periodic-probe", "wake-check"):
// js_error with a non-generator buildId, no device, no error. Both the
// bare shape and a strengthened one (session + numeric ms + stamps) stay
// uncorroborated and do NOT forward while KV is up.
for (const buildId of ["wake-check", "periodic-probe"]) {
  const bare = { type: "js_error", ts: Date.now(), buildId };
  const strengthened = {
    type: "js_error",
    ts: Date.now(),
    buildId,
    sessionId: "probe-session",
    msSinceBootStart: 1234,
    lcV: "2",
    storageOk: true,
    deviceSource: "live",
  };
  for (const [shape, ev] of [
    ["bare", bare],
    ["session+ms+stamps, no device", strengthened],
  ] as const) {
    test(`P1′/P3′ probe js_error buildId=${buildId} (${shape}) → uncorroborated, counted, not forwarded`, async () => {
      assert.equal(provenanceOf(ev as never), "uncorroborated");
      const { map, store } = memoryStore();
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({ url: String(url), init });
        return new Response("{}", { status: 200 });
      }) as typeof fetch;
      const env = storeEnv(map, { DISCORD_WEBHOOK_URL: "https://discord.test/hook" });
      const res = await handleRequest(postEvent(ev), env);
      assert.equal(res.status, 200);
      assert.equal(fetchCalls.length, 0, "probe does not page");
      const bucket = (await store.readBucket(bucketKey(hourLabelOf(Date.now()), "js_error")))!;
      assert.equal(bucket.provenance.uncorroborated, 1, "probe counted as uncorroborated");
    });
  }
}
