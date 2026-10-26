import assert from "node:assert/strict";
import test from "node:test";
import {
  CLEAN_EXIT_KEY,
  clearRunAfterUncleanShutdown,
  handlePageHide,
  isUncleanShutdown,
  stampCleanExitDirty,
} from "../game/clean-exit.ts";
import {
  BREADCRUMB_KEY,
  CHUNK_RECOVERY_KEY,
  CHUNK_RELOAD_KEY,
  MAX_HISTORY,
  MAX_PAYLOAD_BYTES,
  classifyCrashVerdict,
  coarseDeviceFacts,
  createObservability,
  dprBucket,
  isValidRecoveryMarker,
  parseRecoveryMarker,
  screenBucket,
  truncateEventToCap,
  type CrashVerdictFacts,
  type ObsStorage,
  type ObsTransport,
  type ObservabilityEvent,
} from "./observability.ts";

function makeStorage(initial: Record<string, string> = {}): ObsStorage & { raw: Map<string, string> } {
  const raw = new Map(Object.entries(initial));
  return {
    raw,
    getItem: (k: string) => (raw.has(k) ? (raw.get(k) as string) : null),
    setItem: (k: string, v: string) => void raw.set(k, v),
    removeItem: (k: string) => void raw.delete(k),
  };
}

function makeTransport(beaconResult: boolean | "absent" = true) {
  const beacons: Array<{ url: string; body: string }> = [];
  const fetches: Array<{ url: string; body: string }> = [];
  const transport: ObsTransport = {
    fetchFn: async (url, init) => {
      fetches.push({ url, body: init.body });
      return {};
    },
  };
  if (beaconResult !== "absent") {
    transport.sendBeacon = (url, body) => {
      beacons.push({ url, body });
      return beaconResult;
    };
  }
  return { transport, beacons, fetches };
}

const DEVICE = { ua: "test-agent", dpr: 2, screenW: 414, screenH: 896 };

function prevBreadcrumbJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    sessionId: "prev-session",
    buildId: "prev-build",
    startedAt: 1000,
    lastMilestone: "data_chunk_load_start",
    history: [{ name: "boot_start", at: 1000 }],
    edition: "globe",
    regionId: "globe",
    device: DEVICE,
    ...over,
  });
}

test("breadcrumb write/read/update + history cap", () => {
  const store = makeStorage();
  const { transport } = makeTransport();
  let t = 5000;
  const obs = createObservability({ storage: store, transport, now: () => t, randomId: () => "sess-1", device: DEVICE, buildId: "b1", isUnclean: () => false });
  obs.init();
  const crumb = obs.getBreadcrumb();
  assert.equal(crumb?.sessionId, "sess-1");
  assert.equal(crumb?.buildId, "b1");
  assert.equal(crumb?.lastMilestone, "boot_start");
  const stored = JSON.parse(store.getItem(BREADCRUMB_KEY) as string);
  assert.equal(stored.sessionId, "sess-1");
  for (let i = 0; i < MAX_HISTORY + 5; i++) {
    t += 1;
    obs.recordMilestone("run_start", { edition: "state", regionId: "texas" });
  }
  const after = obs.getBreadcrumb();
  assert.equal(after?.history.length, MAX_HISTORY, "history capped");
  assert.equal(after?.lastMilestone, "run_start");
  assert.equal(after?.edition, "state");
  assert.equal(after?.regionId, "texas");
  const storedAfter = JSON.parse(store.getItem(BREADCRUMB_KEY) as string);
  assert.equal(storedAfter.history.length, MAX_HISTORY);
});

test("unclean exit + existing breadcrumb → exactly one suspected_crash; second init emits none", async () => {
  const store = makeStorage({ [BREADCRUMB_KEY]: prevBreadcrumbJson() });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 9000, randomId: () => "new-session", device: DEVICE, buildId: "b2", isUnclean: () => true,
  });
  obs.init();
  assert.equal(beacons.length, 1, "one suspected_crash sent");
  const payload = JSON.parse(beacons[0].body) as ObservabilityEvent;
  assert.equal(payload.type, "suspected_crash");
  assert.equal(payload.sessionId, "prev-session");
  assert.equal(payload.edition, "globe");
  assert.equal(payload.lastMilestone, "data_chunk_load_start");
  assert.equal((payload.breadcrumb as { sessionId: string }).sessionId, "prev-session");
  // Trail rotated: stored breadcrumb is the NEW session, not the previous one.
  const stored = JSON.parse(store.getItem(BREADCRUMB_KEY) as string);
  assert.equal(stored.sessionId, "new-session");

  // Second init (fresh instance, same storage, flag still unclean in this
  // fake) must NOT re-emit for the new trail — its lastMilestone is
  // boot_start and session differs; simulate real second boot where the
  // app re-armed clean-exit: isUnclean now false via new instance below.
  const second = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 9500, randomId: () => "third-session", device: DEVICE, buildId: "b2", isUnclean: () => false,
  });
  second.init();
  assert.equal(beacons.length, 1, "no second suspected_crash");
  await Promise.resolve();
});

test("COPPA: suspected_crash never carries the raw UA — canary in stored device.ua absent from POST body, coarse facts present", () => {
  const CANARY = "CANARY-UA-9f3k7zq2-do-not-send";
  const store = makeStorage({
    [BREADCRUMB_KEY]: prevBreadcrumbJson({
      device: { ua: CANARY, dpr: 3, screenW: 390, screenH: 844 },
    }),
  });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 9000, randomId: () => "new-session", device: DEVICE, buildId: "b2", isUnclean: () => true,
  });
  obs.init();
  assert.equal(beacons.length, 1, "one suspected_crash sent");
  // Assert on the RAW body string: the canary must not appear anywhere,
  // serialized or otherwise — truncateEventToCap only strips under cap
  // pressure, so normal payloads would have kept it before the fix.
  const rawBody = beacons[0].body;
  assert.ok(!rawBody.includes(CANARY), "raw UA canary must not appear in the POST body");
  assert.ok(!rawBody.includes('"ua"'), "no ua key may be serialized anywhere in the payload");
  const payload = JSON.parse(rawBody) as ObservabilityEvent;
  // Coarse facts still flow (node has no navigator: os/form buckets only).
  assert.ok(payload.device && typeof payload.device === "object", "coarse device facts present");
  assert.equal((payload.device as { os?: string }).os, "other");
  assert.equal((payload.device as { form?: string }).form, "desktop");
  assert.ok(!("ua" in (payload.device as object)), "device carries no ua key");
  // Breadcrumb copy stripped of device.
  assert.ok(!("device" in ((payload.breadcrumb as object) ?? {})), "breadcrumb carries no device");
  // Core crash context intact.
  assert.equal(payload.type, "suspected_crash");
  assert.equal(payload.sessionId, "prev-session");
  assert.equal(payload.lastMilestone, "data_chunk_load_start");
  assert.equal((payload.breadcrumb as { sessionId: string }).sessionId, "prev-session");
});

test("suspected_crash queued when endpoint unset, flushed once on setEndpoint, trail already rotated", () => {
  const store = makeStorage({ [BREADCRUMB_KEY]: prevBreadcrumbJson() });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: null,
    now: () => 9000, randomId: () => "new-session", device: DEVICE, buildId: "b2", isUnclean: () => true,
  });
  obs.init();
  assert.equal(beacons.length, 0, "nothing sent without endpoint");
  assert.equal(obs.getQueueLength(), 1, "suspected_crash queued, not lost");
  const stored = JSON.parse(store.getItem(BREADCRUMB_KEY) as string);
  assert.equal(stored.sessionId, "new-session", "previous trail rotated even though transport had no endpoint");
  obs.setEndpoint("https://example.com/ingest");
  assert.equal(beacons.length, 1, "queued event flushed when endpoint arrives");
  assert.equal(JSON.parse(beacons[0].body).type, "suspected_crash");
  assert.equal(obs.getQueueLength(), 0);
});

test("clean exit → no suspected_crash", () => {
  const store = makeStorage({ [BREADCRUMB_KEY]: prevBreadcrumbJson() });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 9000, randomId: () => "s", device: DEVICE, buildId: "b2", isUnclean: () => false,
  });
  obs.init();
  assert.equal(beacons.length, 0);
});

test("unclean exit but NO previous breadcrumb → no suspected_crash", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 9000, randomId: () => "s", device: DEVICE, buildId: "b2", isUnclean: () => true,
  });
  obs.init();
  assert.equal(beacons.length, 0);
});

test("emitTileFailed: sends one tile_failed event with the current milestone", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({ storage: store, transport, endpoint: "https://e.example/x", now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false });
  obs.init();
  obs.recordMilestone("map_ready");
  assert.equal(obs.emitTileFailed(), true);
  assert.equal(beacons.length, 1);
  const body = JSON.parse(beacons[0].body);
  assert.equal(body.type, "tile_failed");
  assert.equal(body.lastMilestone, "map_ready");
  assert.equal(body.buildId, "b");
});

test("transport no-op when endpoint null (no fetch/beacon calls)", () => {
  const store = makeStorage();
  const { transport, beacons, fetches } = makeTransport(true);
  const obs = createObservability({ storage: store, transport, endpoint: null, now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false });
  obs.init();
  const sent = obs.emit({ type: "js_error", ts: 1, buildId: "b", error: { name: "Error", message: "x" } });
  assert.equal(sent, false);
  assert.equal(beacons.length, 0);
  assert.equal(fetches.length, 0);
});

test("sendBeacon preferred; fetch fallback when sendBeacon returns false or is absent", async () => {
  // Preferred
  {
    const { transport, beacons, fetches } = makeTransport(true);
    const obs = createObservability({ storage: makeStorage(), transport, endpoint: "https://e.example/x", now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false });
    obs.init();
    assert.equal(obs.emit({ type: "map_error", ts: 1, buildId: "b" }), true);
    assert.equal(beacons.length, 1);
    assert.equal(fetches.length, 0);
  }
  // Fallback on false
  {
    const { transport, beacons, fetches } = makeTransport(false);
    const obs = createObservability({ storage: makeStorage(), transport, endpoint: "https://e.example/x", now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false });
    obs.init();
    assert.equal(obs.emit({ type: "map_error", ts: 1, buildId: "b" }), true);
    assert.equal(beacons.length, 1, "beacon attempted first");
    assert.equal(fetches.length, 1, "fetch fallback used");
  }
  // Fallback when absent
  {
    const { transport, fetches } = makeTransport("absent");
    const obs = createObservability({ storage: makeStorage(), transport, endpoint: "https://e.example/x", now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false });
    obs.init();
    assert.equal(obs.emit({ type: "map_error", ts: 1, buildId: "b" }), true);
    assert.equal(fetches.length, 1);
  }
  await Promise.resolve();
});

test("payload cap enforced: oversized event truncated to ≤4096 bytes and stays valid JSON", () => {
  const big: ObservabilityEvent = {
    type: "suspected_crash",
    ts: 1,
    buildId: "b",
    sessionId: "s",
    error: { name: "Error", message: "x".repeat(5000) },
    breadcrumb: {
      sessionId: "s", buildId: "b", startedAt: 1, lastMilestone: "run_start",
      history: Array.from({ length: 12 }, (_, i) => ({ name: `m-${i}-${"y".repeat(200)}`, at: i })),
      device: { ua: "u".repeat(2000) },
    },
    device: { ua: "u".repeat(2000) },
  };
  const out = truncateEventToCap(big);
  assert.ok(new TextEncoder().encode(out).length <= MAX_PAYLOAD_BYTES, `cap: got ${new TextEncoder().encode(out).length}`);
  const parsed = JSON.parse(out) as ObservabilityEvent;
  assert.equal(parsed.type, "suspected_crash");
  // Also via emit path
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({ storage: makeStorage(), transport, endpoint: "https://e.example/x", now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false });
  obs.init();
  obs.emit(big);
  assert.ok(new TextEncoder().encode(beacons[0].body).length <= MAX_PAYLOAD_BYTES);
});

test("storage throwing → nothing throws, milestones silently no-op", () => {
  const boom: ObsStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  const { transport } = makeTransport(true);
  const obs = createObservability({ storage: boom, transport, endpoint: "https://e.example/x", now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => { throw new Error("blocked"); } });
  assert.doesNotThrow(() => obs.init());
  assert.doesNotThrow(() => obs.recordMilestone("run_start"));
  assert.doesNotThrow(() => obs.emit({ type: "js_error", ts: 1, buildId: "b" }));
  assert.doesNotThrow(() => createObservability({ storage: null, transport, now: () => 1, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false }).init());
});

// ---------------------------------------------------------------------------
// D1 REAL-SEQUENCE tests (regression for the reviewer's D1 defect).
//
// Unlike the seeded tests above, these NEVER pass a fake `isUnclean` and
// NEVER seed meridian.cleanExit / meridian.breadcrumb directly. Every
// session is a createObservability instance wired to the REAL default
// unclean check — isUncleanShutdown() from src/game/clean-exit.ts reading
// the SAME fake storage — and the dirty flag is armed only by calling the
// REAL stampCleanExitDirty(store), exactly what openRun now does at run
// start BEFORE the data-chunk load. A "kill" = the instance is discarded
// with NO handlePageHide() call, mirroring a jetsam kill (pagehide never
// fires).
// ---------------------------------------------------------------------------

const RUN_KEY_FOR_BREAKER = "meridian.run";

function realSequenceObs(
  store: ReturnType<typeof makeStorage>,
  transport: ObsTransport,
  sessionId: string,
) {
  // NOTE: no `isUnclean` dep — the default check reads the real
  // clean-exit flag from this same storage.
  return createObservability({
    storage: store,
    transport,
    endpoint: "https://example.com/ingest",
    now: () => 9000,
    randomId: () => sessionId,
    device: DEVICE,
    buildId: "b-d1",
  });
}

/** Session-1 run start, exactly as openRun performs it after the D1 fix. */
function armRunStartAtChunkLoad(
  obs: ReturnType<typeof realSequenceObs>,
  store: ReturnType<typeof makeStorage>,
): void {
  obs.recordMilestone("run_start", { edition: "globe", regionId: "globe", chunkId: "globe" });
  obs.recordMilestone("data_chunk_load_start", { edition: "globe", regionId: "globe", chunkId: "globe" });
  stampCleanExitDirty(store); // openRun arms BEFORE awaiting placesFor
}

function crashEvents(beacons: Array<{ url: string; body: string }>): ObservabilityEvent[] {
  return beacons
    .map((b) => JSON.parse(b.body) as ObservabilityEvent)
    .filter((e) => e.type === "suspected_crash");
}

test("D1 real-sequence: kill during data-chunk load (armed at run start, no pagehide) → next boot emits exactly one suspected_crash (globe / data_chunk_load_start)", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);

  // Session 1: fresh boot (no event), run start armed, then KILLED
  // mid-load — instance discarded, handlePageHide never called.
  const s1 = realSequenceObs(store, transport, "d1-session-1");
  s1.init();
  assert.equal(beacons.length, 0, "fresh boot emits nothing");
  armRunStartAtChunkLoad(s1, store);
  // (kill: no handlePageHide, s1 dropped)

  // Session 2: new instance, same storage, REAL unclean check.
  const s2 = realSequenceObs(store, transport, "d1-session-2");
  s2.init();
  const crashes = crashEvents(beacons);
  assert.equal(crashes.length, 1, "exactly one suspected_crash for the load-window kill");
  assert.equal(crashes[0].sessionId, "d1-session-1", "carries the killed session's id");
  assert.equal(crashes[0].edition, "globe");
  assert.equal(crashes[0].lastMilestone, "data_chunk_load_start");
});

test("D1 real-sequence: arming at run start is synchronous — cleanExit is \"0\" immediately after stampCleanExitDirty, before any load resolves", () => {
  const store = makeStorage();
  const { transport } = makeTransport(true);
  const s1 = realSequenceObs(store, transport, "d1-sync-session");
  s1.init();
  assert.equal(store.getItem(CLEAN_EXIT_KEY), null, "flag untouched before run start");
  armRunStartAtChunkLoad(s1, store);
  // No await of any chunk load has happened (or resolved) at this point.
  assert.equal(store.getItem(CLEAN_EXIT_KEY), "0", "dirty marker written synchronously at run start");
  assert.equal(isUncleanShutdown(store), true, "real check reads the armed flag as unclean");
});

test("D1 real-sequence: clean exit after an armed run start reports nothing — real handlePageHide → next boot emits no suspected_crash", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);

  const s1 = realSequenceObs(store, transport, "d1-clean-session-1");
  s1.init();
  armRunStartAtChunkLoad(s1, store);
  handlePageHide(store); // normal unload/reload after the armed run start

  const s2 = realSequenceObs(store, transport, "d1-clean-session-2");
  s2.init();
  assert.equal(crashEvents(beacons).length, 0, "no spurious suspected_crash after a clean exit");
  assert.equal(beacons.length, 0, "nothing emitted at all");
});

test("D1 real-sequence: repeat kill after breaker re-arm is reportable — second armed kill emits a second suspected_crash (one per kill)", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);

  // Session 1: armed at run start, killed during the load.
  const s1 = realSequenceObs(store, transport, "d1-repeat-1");
  s1.init();
  armRunStartAtChunkLoad(s1, store);
  // (kill #1: no pagehide)

  // Session 2: emits suspected_crash #1; the crash-loop breaker then runs
  // for real and re-arms the flag to "1" (clearRunAfterUncleanShutdown).
  const s2 = realSequenceObs(store, transport, "d1-repeat-2");
  s2.init();
  assert.equal(crashEvents(beacons).length, 1, "first kill reported");
  clearRunAfterUncleanShutdown(RUN_KEY_FOR_BREAKER, store);
  assert.equal(store.getItem(CLEAN_EXIT_KEY), "1", "breaker re-armed the flag to clean");

  // Player retries on session 2: openRun re-arms at run start, killed
  // during the load again.
  armRunStartAtChunkLoad(s2, store);
  assert.equal(store.getItem(CLEAN_EXIT_KEY), "0", "retry re-armed the flag before the load");
  // (kill #2: no pagehide)

  // Session 3: must emit suspected_crash #2 — exactly 2 total.
  const s3 = realSequenceObs(store, transport, "d1-repeat-3");
  s3.init();
  const crashes = crashEvents(beacons);
  assert.equal(crashes.length, 2, "exactly one suspected_crash per kill, repeat kill included");
  assert.equal(crashes[1].sessionId, "d1-repeat-2", "second report carries the second killed session");
  assert.equal(crashes[1].edition, "globe");
  assert.equal(crashes[1].lastMilestone, "data_chunk_load_start");
});

// ---------------------------------------------------------------------------
// D3: queue eviction protects a queued suspected_crash.
// ---------------------------------------------------------------------------

test("D3 queue eviction: queued suspected_crash survives ≥20 later events and flushes first on setEndpoint", () => {
  const store = makeStorage({ [BREADCRUMB_KEY]: prevBreadcrumbJson() });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: null,
    now: () => 9000, randomId: () => "d3-session", device: DEVICE, buildId: "b2", isUnclean: () => true,
  });
  obs.init();
  assert.equal(obs.getQueueLength(), 1, "suspected_crash queued with no endpoint");
  for (let i = 0; i < 25; i++) {
    obs.emit({ type: "js_error", ts: 9000 + i, buildId: "b2", error: { name: "Error", message: `burst-${i}` } });
  }
  assert.equal(obs.getQueueLength(), 20, "queue still capped at MAX_QUEUE");
  obs.setEndpoint("https://example.com/ingest");
  const flushed = beacons.map((b) => JSON.parse(b.body) as ObservabilityEvent);
  assert.equal(flushed.length, 20, "whole queue flushed");
  assert.equal(flushed[0].type, "suspected_crash", "suspected_crash was NOT evicted by the error burst");
  assert.equal(flushed.filter((e) => e.type === "suspected_crash").length, 1);
});

test("D3 queue cap: a queue of only non-crash errors still caps at 20 (oldest evicted)", () => {
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: makeStorage(), transport, endpoint: null,
    now: () => 1, randomId: () => "d3-errors", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  for (let i = 0; i < 25; i++) {
    obs.emit({ type: "js_error", ts: i, buildId: "b", error: { name: "Error", message: `e-${i}` } });
  }
  assert.equal(obs.getQueueLength(), 20, "memory bound holds for ordinary events");
  obs.setEndpoint("https://example.com/ingest");
  const flushed = beacons.map((b) => JSON.parse(b.body) as ObservabilityEvent);
  assert.equal(flushed.length, 20);
  assert.equal(flushed[0].error?.message, "e-5", "oldest five errors were evicted FIFO");
  assert.equal(flushed[19].error?.message, "e-24");
});

test("isBenignBrowserNoise: ResizeObserver loop message is benign (exact + case-insensitive)", async () => {
  const { isBenignBrowserNoise } = await import("./observability.ts");
  assert.equal(isBenignBrowserNoise("ResizeObserver loop completed with undelivered notifications."), true);
  assert.equal(isBenignBrowserNoise("resizeobserver loop completed with undelivered notifications"), true);
  assert.equal(isBenignBrowserNoise("TypeError: Cannot read properties of null"), false);
  assert.equal(isBenignBrowserNoise(""), false);
});

test("window error listener: ResizeObserver loop noise emits NOTHING (no js_error, no queue)", () => {
  const { transport, beacons, fetches } = makeTransport(true);
  const obs = createObservability({
    storage: makeStorage(), transport, endpoint: "https://example.com/ingest",
    now: () => 1, randomId: () => "ro-noise", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  const handlers: Record<string, (e: unknown) => void> = {};
  obs.installGlobalHandlers({
    addEventListener: (t: string, fn: (e: unknown) => void) => {
      handlers[t] = fn;
    },
  } as unknown as Window);
  handlers["error"]({ error: new Error("ResizeObserver loop completed with undelivered notifications.") });
  assert.equal(beacons.length + fetches.length, 0, "no transport call for benign RO noise");
  assert.equal(obs.getQueueLength(), 0, "nothing queued for benign RO noise");
});

test("window error listener (control): a real error still emits js_error", () => {
  const { transport, beacons, fetches } = makeTransport(true);
  const obs = createObservability({
    storage: makeStorage(), transport, endpoint: "https://example.com/ingest",
    now: () => 1, randomId: () => "ro-control", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  const handlers: Record<string, (e: unknown) => void> = {};
  obs.installGlobalHandlers({
    addEventListener: (t: string, fn: (e: unknown) => void) => {
      handlers[t] = fn;
    },
  } as unknown as Window);
  handlers["error"]({ error: new Error("Something actually broke") });
  const sent = [...beacons, ...fetches];
  assert.equal(sent.length, 1, "real errors still reported");
  const body = JSON.parse(sent[0].body) as ObservabilityEvent;
  assert.equal(body.type, "js_error");
  assert.match(body.error?.message ?? "", /Something actually broke/);
});

// ---------------------------------------------------------------------------
// Crash-classification (2026-10-12): visibility milestones distinguish an
// Android background-tab kill from a genuine foreground crash.
// ---------------------------------------------------------------------------

function makeDocument() {
  const listeners = new Map<string, Array<() => void>>();
  const doc = {
    visibilityState: "visible" as string,
    addEventListener: (type: string, fn: () => void) => {
      const arr = listeners.get(type) ?? [];
      arr.push(fn);
      listeners.set(type, arr);
    },
    fire: (type: string) => {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount: (type: string) => (listeners.get(type) ?? []).length,
  };
  return doc;
}

test("visibility: hidden records 'backgrounded', visible records 'foregrounded'", () => {
  const store = makeStorage();
  const { transport } = makeTransport();
  const doc = makeDocument();
  const obs = createObservability({
    storage: store, transport, document: doc,
    now: () => 1000, randomId: () => "vis-1", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  assert.equal(obs.getBreadcrumb()?.lastMilestone, "boot_start");

  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  assert.equal(obs.getBreadcrumb()?.lastMilestone, "backgrounded");
  const stored = JSON.parse(store.getItem(BREADCRUMB_KEY) as string);
  assert.equal(stored.lastMilestone, "backgrounded", "milestone persisted to sessionStorage");

  doc.visibilityState = "visible";
  doc.fire("visibilitychange");
  assert.equal(obs.getBreadcrumb()?.lastMilestone, "foregrounded");
});

test("visibility: listener installed once across double init", () => {
  const { transport } = makeTransport();
  const doc = makeDocument();
  const obs = createObservability({
    storage: makeStorage(), transport, document: doc,
    now: () => 1000, randomId: () => "vis-2", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  obs.init();
  assert.equal(doc.listenerCount("visibilitychange"), 1, "exactly one visibility listener");
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  assert.equal(obs.getBreadcrumb()?.lastMilestone, "backgrounded");
});

test("visibility: absent document degrades silently (node --test has no DOM)", () => {
  const { transport } = makeTransport();
  const obs = createObservability({
    storage: makeStorage(), transport, document: null,
    now: () => 1000, randomId: () => "vis-3", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init(); // must not throw
  assert.equal(obs.getBreadcrumb()?.lastMilestone, "boot_start");
});

test("visibility: a backgrounded trail classifies the next-boot suspected_crash", () => {
  // Full runtime path: game session -> backgrounded -> killed (no pagehide)
  // -> next boot emits suspected_crash with lastMilestone "backgrounded".
  const { transport, beacons } = makeTransport(true);
  const doc = makeDocument();
  const prevStore = makeStorage();
  const prev = createObservability({
    storage: prevStore, transport, document: doc, endpoint: "https://example.com/ingest",
    now: () => 2000, randomId: () => "vis-4", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  prev.init();
  prev.recordMilestone("run_start", { edition: "globe", regionId: "globe" });
  prev.recordMilestone("storyteller_ready");
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  // Simulate the kill: no pagehide, so the clean-exit flag stays dirty.
  prevStore.setItem(CLEAN_EXIT_KEY, "0");

  const nextStore = makeStorage(Object.fromEntries(prevStore.raw));
  const next = createObservability({
    storage: nextStore, transport, endpoint: "https://example.com/ingest",
    now: () => 3000, randomId: () => "vis-5", device: DEVICE, buildId: "b", isUnclean: () => true,
  });
  next.init();
  assert.equal(beacons.length, 1);
  const event = JSON.parse(beacons[0].body) as ObservabilityEvent;
  assert.equal(event.type, "suspected_crash");
  assert.equal(event.lastMilestone, "backgrounded", "background kill is classified, not mistaken for a foreground crash");
  assert.equal(event.edition, "globe");
});

test("COPPA coarsening: reports carry a screen bucket and rounded DPR, never exact pixels, memory, or cores", () => {
  assert.equal(screenBucket(390, 844), "sm");
  assert.equal(screenBucket(820, 1180), "lg");
  assert.equal(screenBucket(1920, 1080), "xl");
  assert.equal(screenBucket(600, 1024), "md");
  assert.equal(screenBucket(undefined, 5), undefined);
  assert.equal(dprBucket(2.625), 3);
  assert.equal(dprBucket(1.25), 1);
  assert.equal(dprBucket(9), 4);
  const facts = coarseDeviceFacts();
  for (const k of ["screenW", "screenH", "deviceMemory", "hardwareConcurrency", "ua"]) {
    assert.ok(!(k in facts) || (facts as Record<string, unknown>)[k] === undefined, `${k} must not be reported`);
  }
});

// --- Slice 1: crash-report verdicts (Consensus Manifest 2026-10-25) ------
//
// Classifier table + evidence stamps. The classifier fixtures below are
// mirrored verbatim in workers/crash-report/src/index.test.ts (deliberate
// duplication across the client/worker boundary — the worker re-derives
// the verdict from the same stamped facts, design §2.5/§4).

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
  // No recovery facts exist in Slice 1, so no facts shape can earn it —
  // not even a backgrounded trail carrying every stamp.
  assert.notEqual(
    classifyCrashVerdict({ type: "suspected_crash", lastMilestone: "backgrounded", bgTerminal: true, buildReplaced: true, trailStuck: false, lcV: "1" }).verdict,
    "auto_fixed",
  );
});

// --- Slice 1 stamps through the real init/emit production path -----------

function seededCrashPayload(prevOver: Record<string, unknown>, runningBuild = "b2"): ObservabilityEvent {
  const store = makeStorage({ [BREADCRUMB_KEY]: prevBreadcrumbJson(prevOver) });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 9000, randomId: () => "new-session", device: DEVICE, buildId: runningBuild, isUnclean: () => true,
  });
  obs.init();
  assert.equal(beacons.length, 1, "one suspected_crash sent");
  return JSON.parse(beacons[0].body) as ObservabilityEvent;
}

const HIST = (...names: string[]) => names.map((name, i) => ({ name, at: 1000 + i }));

test("stamps: suspected_crash via init carries bgTerminal=true when the last visibility milestone is backgrounded, even when a non-visibility milestone is lastMilestone", () => {
  const payload = seededCrashPayload({
    buildId: "prev-build",
    lastMilestone: "data_loaded",
    history: HIST("boot_start", "run_start", "game_loaded", "backgrounded", "data_loaded"),
  });
  assert.equal(payload.bgTerminal, true);
  assert.equal(payload.trailStuck, false);
  assert.equal(payload.buildReplaced, true, "prev build differs from the running build");
  assert.equal(payload.storageOk, true);
  assert.equal(payload.lcV, "2");
  assert.equal(payload.verdict, "not_a_real_issue");
  assert.equal(payload.whyKey, "bg_close");
});

test("stamps: suspected_crash via init carries bgTerminal=false when the trail backgrounded then foregrounded, and buildReplaced=false when the build is unchanged", () => {
  const payload = seededCrashPayload(
    {
      buildId: "b2",
      lastMilestone: "game_loaded",
      history: HIST("boot_start", "backgrounded", "foregrounded", "game_loaded"),
    },
    "b2",
  );
  assert.equal(payload.bgTerminal, false);
  assert.equal(payload.buildReplaced, false);
  assert.equal(payload.verdict, "developer_needed");
  assert.equal(payload.whyKey, "fg_kill_current");
});

test("stamps: a start-without-ready before backgrounding stamps trailStuck=true and classifies insufficient_evidence, never benign", () => {
  const payload = seededCrashPayload({
    buildId: "prev-build",
    lastMilestone: "backgrounded",
    history: HIST("boot_start", "run_start", "map_init_start", "backgrounded"),
  });
  assert.equal(payload.bgTerminal, true);
  assert.equal(payload.trailStuck, true);
  assert.equal(payload.verdict, "insufficient_evidence");
  assert.equal(payload.whyKey, "bg_stuck");
});

test("stamps: a trail with no visibility entry omits bgTerminal entirely — the verdict fails closed to insufficient_evidence/missing_fields, never benign", () => {
  // Reality Checker blocker (2026-10-25): bgTerminal must come from a
  // visibility entry in the stored history, never from lastMilestone.
  // A session that recorded no visibility transition has an UNKNOWN
  // terminal visibility state, so the stamp is absent and the
  // classifier's missing-fields rule applies — even when the trail ends
  // at a gameplay milestone, and even for a foreign trail whose
  // lastMilestone claims "backgrounded" with no such history entry.
  const gameplay = seededCrashPayload({
    buildId: "prev-build",
    lastMilestone: "game_loaded",
    history: HIST("boot_start", "run_start", "game_loaded"),
  });
  assert.ok(!("bgTerminal" in gameplay), "no bgTerminal stamp without a visibility entry");
  assert.equal(gameplay.verdict, "insufficient_evidence");
  assert.equal(gameplay.whyKey, "missing_fields");

  const foreign = seededCrashPayload({
    buildId: "prev-build",
    lastMilestone: "backgrounded",
    history: HIST("boot_start", "run_start"),
  });
  assert.ok(!("bgTerminal" in foreign), "lastMilestone alone never fabricates bgTerminal");
  assert.equal(foreign.verdict, "insufficient_evidence");
  assert.equal(foreign.whyKey, "missing_fields");
});

test("stamps: only suspected_crash carries bgTerminal/buildReplaced/trailStuck — a live js_error via emit carries storageOk, lcV and the provisional verdict, and none of the trail stamps", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 1000, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  obs.emit({ type: "js_error", ts: 1000, buildId: "b", error: { name: "TypeError", message: "boom" } });
  assert.equal(beacons.length, 1);
  const payload = JSON.parse(beacons[0].body) as ObservabilityEvent;
  assert.equal(payload.storageOk, true);
  assert.equal(payload.lcV, "2");
  assert.equal(payload.verdict, "developer_needed");
  assert.equal(payload.whyKey, "captured_error");
  assert.ok(!("bgTerminal" in payload), "no bgTerminal on a live error event");
  assert.ok(!("buildReplaced" in payload), "no buildReplaced on a live error event");
  assert.ok(!("trailStuck" in payload), "no trailStuck on a live error event");
});

test("stamps: a hiccup event carries storageOk and lcV but never a verdict", () => {
  const store = makeStorage();
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: "https://example.com/ingest",
    now: () => 1000, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  obs.emitTileFailed();
  assert.equal(beacons.length, 1);
  const payload = JSON.parse(beacons[0].body) as ObservabilityEvent;
  assert.equal(payload.storageOk, true);
  assert.equal(payload.lcV, "2");
  assert.ok(!("verdict" in payload), "hiccup-class events are counted only — no verdict in Slice 1");
  assert.ok(!("whyKey" in payload));
});

test("stamps: storageOk=false is stamped at the emit choke point when storage throws", () => {
  // getItem works, setItem throws (quota / partially blocked storage):
  // the trail cannot persist, so every event this session emits must say
  // storageOk=false. (A fully blocked session emits no suspected_crash at
  // all — F4; the false branch is proven here on the live-error path.)
  const raw = new Map<string, string>();
  const throwingSet: ObsStorage = {
    getItem: (k: string) => (raw.has(k) ? (raw.get(k) as string) : null),
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: (k: string) => void raw.delete(k),
  };
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: throwingSet, transport, endpoint: "https://example.com/ingest",
    now: () => 1000, randomId: () => "s", device: DEVICE, buildId: "b", isUnclean: () => false,
  });
  obs.init();
  obs.emitMapError(new Error("map boom"));
  assert.equal(beacons.length, 1);
  const payload = JSON.parse(beacons[0].body) as ObservabilityEvent;
  assert.equal(payload.type, "map_error");
  assert.equal(payload.storageOk, false);
  assert.equal(payload.lcV, "2");
});

test("stamps: stamps survive the queued path — init with no endpoint, then setEndpoint flushes exactly one suspected_crash carrying all stamps", () => {
  const store = makeStorage({
    [BREADCRUMB_KEY]: prevBreadcrumbJson({
      buildId: "prev-build",
      lastMilestone: "backgrounded",
      history: HIST("boot_start", "run_start", "game_loaded", "backgrounded"),
    }),
  });
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store, transport, endpoint: null,
    now: () => 9000, randomId: () => "new-session", device: DEVICE, buildId: "b2", isUnclean: () => true,
  });
  obs.init();
  assert.equal(obs.getQueueLength(), 1);
  obs.setEndpoint("https://example.com/ingest");
  assert.equal(beacons.length, 1, "queued event flushed once");
  const payload = JSON.parse(beacons[0].body) as ObservabilityEvent;
  assert.equal(payload.bgTerminal, true);
  assert.equal(payload.buildReplaced, true);
  assert.equal(payload.trailStuck, false);
  assert.equal(payload.storageOk, true);
  assert.equal(payload.lcV, "2");
  assert.equal(payload.verdict, "not_a_real_issue");
  assert.equal(payload.whyKey, "bg_close");
});

test("stamps: stamps still present after truncateEventToCap on a max-history (12-entry) trail at the 4096-byte cap", () => {
  const event: ObservabilityEvent = {
    type: "suspected_crash",
    ts: 9000,
    buildId: "prev-build",
    sessionId: "prev-session",
    edition: "globe",
    regionId: "globe",
    chunkId: "c".repeat(1200),
    lastMilestone: "backgrounded",
    bgTerminal: true,
    buildReplaced: true,
    trailStuck: false,
    storageOk: true,
    lcV: "1",
    verdict: "not_a_real_issue",
    whyKey: "bg_close",
    error: { name: "Error", message: "x".repeat(300) },
    breadcrumb: {
      sessionId: "prev-session",
      buildId: "prev-build",
      startedAt: 1000,
      lastMilestone: "backgrounded",
      history: HIST("boot_start", "run_start", "data_chunk_load_start", "data_loaded", "map_init_start", "map_ready", "game_loaded", "storyteller_ready", "backgrounded", "data_loaded", "backgrounded", "data_loaded"),
      edition: "globe",
      regionId: "globe",
    },
  };
  const body = truncateEventToCap(event, MAX_PAYLOAD_BYTES);
  assert.ok(new TextEncoder().encode(body).length <= MAX_PAYLOAD_BYTES, "cap holds");
  const parsed = JSON.parse(body) as ObservabilityEvent;
  assert.equal(parsed.bgTerminal, true);
  assert.equal(parsed.buildReplaced, true);
  assert.equal(parsed.trailStuck, false);
  assert.equal(parsed.storageOk, true);
  assert.equal(parsed.lcV, "1");
  assert.equal(parsed.verdict, "not_a_real_issue");
  assert.equal(parsed.whyKey, "bg_close");
});

// --- Slice 2: recovery outcome loop (Consensus Manifest 2026-10-25) -----
//
// Claim/hold at init, leftover resolution, the marker_unreadable split,
// noteRecoverySignal, the confirmation AND-gate, the afterRecovery
// choke point, queue-eviction protection, and the classifier's
// recovery_outcome branch (mirrored in the worker's test file).

const S2_NOW = 100_000_000;

function markerJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({ v: 1, at: S2_NOW - 1_000, build: "build-a", ...over });
}

function s2Obs(
  initial: Record<string, string>,
  over: { unclean?: boolean; endpoint?: string | null; buildId?: string } = {},
) {
  const store = makeStorage(initial);
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: store,
    transport,
    endpoint: over.endpoint === undefined ? "https://example.com/ingest" : over.endpoint,
    now: () => S2_NOW,
    randomId: () => "s2-session",
    device: DEVICE,
    buildId: over.buildId ?? "b2",
    isUnclean: () => over.unclean ?? false,
  });
  return { store, beacons, obs };
}

function outcomeEvents(beacons: Array<{ url: string; body: string }>): ObservabilityEvent[] {
  return beacons
    .map((b) => JSON.parse(b.body) as ObservabilityEvent)
    .filter((e) => e.type === "recovery_outcome");
}

// Classifier: recovery_outcome branch (evaluated FIRST).
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

test("marker predicate fixtures: the same shapes chunk-recovery's predicate decides (identical in both files)", () => {
  // Valid pending / claimed.
  assert.equal(parseRecoveryMarker(markerJson())?.kind, "valid");
  assert.equal(parseRecoveryMarker(markerJson({ claimed: true }))?.kind, "valid");
  assert.equal(isValidRecoveryMarker({ v: 1, at: 5, build: "b" }), true);
  assert.equal(isValidRecoveryMarker({ v: 1, at: 5, build: "b", claimed: false }), true);
  // Terminal record: an outcome string is never pending.
  assert.equal(parseRecoveryMarker(markerJson({ outcome: "stood_down" }))?.kind, "terminal");
  // Version split.
  assert.equal(parseRecoveryMarker(markerJson({ v: 2 }))?.kind, "invalid-version");
  // Predicate failures.
  assert.equal(parseRecoveryMarker("not json {")?.kind, "invalid");
  assert.equal(parseRecoveryMarker(markerJson({ at: "soon" }))?.kind, "invalid");
  assert.equal(parseRecoveryMarker(markerJson({ build: "" }))?.kind, "invalid");
  assert.equal(parseRecoveryMarker(markerJson({ claimed: "yes" }))?.kind, "invalid");
  assert.equal(parseRecoveryMarker(markerJson({ outcome: 42 }))?.kind, "invalid");
  assert.equal(parseRecoveryMarker(JSON.stringify([1, 2]))?.kind, "invalid");
  assert.equal(isValidRecoveryMarker({ v: 1, at: Number.NaN, build: "b" }), false);
  assert.equal(isValidRecoveryMarker(null), false);
  // Absent.
  assert.equal(parseRecoveryMarker(null), null);
  assert.equal(parseRecoveryMarker(""), null);
});

test("Slice 2 claim: init claims an unclaimed marker by spread (at/build/extra fields preserved), holds pending, emits nothing", () => {
  const { store, beacons, obs } = s2Obs({
    [CHUNK_RECOVERY_KEY]: markerJson({ att: "keep-me" }),
  });
  obs.init();
  assert.equal(beacons.length, 0, "claim alone emits nothing");
  const stored = JSON.parse(store.getItem(CHUNK_RECOVERY_KEY) as string);
  assert.equal(stored.claimed, true, "claimed by rewrite");
  assert.equal(stored.at, S2_NOW - 1_000, "at never refreshed");
  assert.equal(stored.build, "build-a");
  assert.equal(stored.att, "keep-me", "spread preserves unknown fields");
});

test("Slice 2 confirmed: game_loaded leg first, episode_cleared second → exactly one confirmed, marker gone, later signals drop", () => {
  const { store, beacons, obs } = s2Obs({ [CHUNK_RECOVERY_KEY]: markerJson() });
  obs.init();
  obs.recordMilestone("game_loaded");
  assert.equal(outcomeEvents(beacons).length, 0, "one leg alone never confirms");
  obs.noteRecoverySignal("episode_cleared");
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "confirmed");
  assert.equal(outcomes[0].buildId, "build-a", "attributed to the failing session's build");
  assert.equal(outcomes[0].verdict, "auto_fixed");
  assert.equal(outcomes[0].whyKey, "recovery_confirmed");
  assert.equal(outcomes[0].lcV, "2");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null, "resolve deletes the marker");
  obs.noteRecoverySignal("repeat_failure");
  obs.noteRecoverySignal("episode_cleared");
  assert.equal(outcomeEvents(beacons).length, 1, "at-most-once: later signals drop");
});

test("Slice 2 confirmed: clear leg first, game_loaded second → emission happens at the second leg", () => {
  const { beacons, obs } = s2Obs({ [CHUNK_RECOVERY_KEY]: markerJson() });
  obs.init();
  obs.noteRecoverySignal("episode_cleared");
  assert.equal(outcomeEvents(beacons).length, 0);
  obs.recordMilestone("game_loaded");
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "confirmed");
});

test("Slice 2 repeat_failure: a recurrence resolves the attempt at once, replacing any held legs", () => {
  const { store, beacons, obs } = s2Obs({ [CHUNK_RECOVERY_KEY]: markerJson() });
  obs.init();
  obs.recordMilestone("game_loaded");
  obs.noteRecoverySignal("repeat_failure");
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "repeat_failure");
  assert.equal(outcomes[0].verdict, "developer_needed");
  assert.equal(outcomes[0].whyKey, "recovery_failed");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
  obs.noteRecoverySignal("episode_cleared");
  assert.equal(outcomeEvents(beacons).length, 1, "no confirmation can stand after a failure");
});

test("Slice 2: signals with no held attempt drop — repeat_failure and episode_cleared emit nothing", () => {
  const { beacons, obs } = s2Obs({});
  obs.init();
  obs.noteRecoverySignal("repeat_failure");
  obs.noteRecoverySignal("episode_cleared");
  obs.recordMilestone("game_loaded");
  assert.equal(outcomeEvents(beacons).length, 0);
});

test("Slice 2 stood_down standalone: no held attempt → emitted with the failing session's build from the signal facts", () => {
  const { beacons, obs } = s2Obs({});
  obs.init();
  obs.noteRecoverySignal("stood_down", { build: "build-x", at: S2_NOW });
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "stood_down");
  assert.equal(outcomes[0].buildId, "build-x");
  assert.equal(outcomes[0].verdict, "insufficient_evidence");
  assert.equal(outcomes[0].whyKey, "recovery_stood_down");
});

test("Slice 2 stood_down with a held attempt: resolves the pending attempt with the MARKER's build, not the signal's", () => {
  const { store, beacons, obs } = s2Obs({ [CHUNK_RECOVERY_KEY]: markerJson() });
  obs.init();
  obs.noteRecoverySignal("stood_down", { build: "other-build" });
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "stood_down");
  assert.equal(outcomes[0].buildId, "build-a");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
  obs.noteRecoverySignal("stood_down", { build: "other-build" });
  assert.equal(outcomeEvents(beacons).length, 1, "resolved attempts drop later signals");
});

test("Slice 2 leftover: claimed marker + clean exit → unconfirmed_closed exactly once, marker deleted", () => {
  const { store, beacons, obs } = s2Obs(
    { [CHUNK_RECOVERY_KEY]: markerJson({ claimed: true }) },
    { unclean: false },
  );
  obs.init();
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "unconfirmed_closed");
  assert.equal(outcomes[0].buildId, "build-a");
  assert.equal(outcomes[0].verdict, "insufficient_evidence");
  assert.equal(outcomes[0].whyKey, "recovery_unconfirmed");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
});

test("Slice 2 leftover: claimed marker + unclean exit → unconfirmed_died exactly once, and that boot's suspected_crash carries afterRecovery", () => {
  const { store, beacons, obs } = s2Obs(
    {
      [CHUNK_RECOVERY_KEY]: markerJson({ claimed: true }),
      [BREADCRUMB_KEY]: prevBreadcrumbJson(),
    },
    { unclean: true },
  );
  obs.init();
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "unconfirmed_died");
  const crashes = beacons
    .map((b) => JSON.parse(b.body) as ObservabilityEvent)
    .filter((e) => e.type === "suspected_crash");
  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].afterRecovery, true, "the §3.3.4 same-init link");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
});

test("Slice 2 leftover: a claimed marker older than 24h resolves unconfirmed_expired — expired beats claimed, no afterRecovery link", () => {
  const { store, beacons, obs } = s2Obs(
    {
      [CHUNK_RECOVERY_KEY]: markerJson({ claimed: true, at: S2_NOW - 86_400_001 }),
      [BREADCRUMB_KEY]: prevBreadcrumbJson(),
    },
    { unclean: true },
  );
  obs.init();
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "unconfirmed_expired");
  const crashes = beacons
    .map((b) => JSON.parse(b.body) as ObservabilityEvent)
    .filter((e) => e.type === "suspected_crash");
  assert.equal(crashes.length, 1);
  assert.ok(!("afterRecovery" in crashes[0]), "no afterRecovery linkage for expiry");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
});

test("Slice 2: a terminal stand-down record at init is deleted silently — never claimed, never emitted", () => {
  const { store, beacons, obs } = s2Obs({
    [CHUNK_RECOVERY_KEY]: markerJson({ outcome: "stood_down" }),
  });
  obs.init();
  assert.equal(beacons.length, 0);
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
  obs.noteRecoverySignal("repeat_failure");
  assert.equal(outcomeEvents(beacons).length, 0, "no pending was held");
});

test("Slice 2 marker_unreadable: a parseable marker with numeric v !== 1 emits unreadable with the RUNNING build", () => {
  const { store, beacons, obs } = s2Obs({
    [CHUNK_RECOVERY_KEY]: markerJson({ v: 2 }),
  });
  obs.init();
  const outcomes = outcomeEvents(beacons);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].recoveryOutcome, "marker_unreadable");
  assert.equal(outcomes[0].buildId, "b2", "no trustworthy marker build exists — running build");
  assert.equal(outcomes[0].verdict, "insufficient_evidence");
  assert.equal(outcomes[0].whyKey, "marker_unreadable");
  assert.equal(store.getItem(CHUNK_RECOVERY_KEY), null);
});

test("Slice 2 marker_unreadable split: unparseable marker + fresh reload stamp → unreadable; without corroboration → silent delete", () => {
  const corroborated = s2Obs({
    [CHUNK_RECOVERY_KEY]: "not json {",
    [CHUNK_RELOAD_KEY]: String(S2_NOW - 1_000),
  });
  corroborated.obs.init();
  assert.equal(outcomeEvents(corroborated.beacons).length, 1);
  assert.equal(outcomeEvents(corroborated.beacons)[0].recoveryOutcome, "marker_unreadable");
  assert.equal(corroborated.store.getItem(CHUNK_RECOVERY_KEY), null);

  const silent = s2Obs({ [CHUNK_RECOVERY_KEY]: "not json {" });
  silent.obs.init();
  assert.equal(silent.beacons.length, 0, "uncorroborated garbage deletes silently");
  assert.equal(silent.store.getItem(CHUNK_RECOVERY_KEY), null);

  const stale = s2Obs({
    [CHUNK_RECOVERY_KEY]: markerJson({ build: "" }),
    [CHUNK_RELOAD_KEY]: String(S2_NOW - 900_001),
  });
  stale.obs.init();
  assert.equal(stale.beacons.length, 0, "a stale stamp does not corroborate");
  assert.equal(stale.store.getItem(CHUNK_RECOVERY_KEY), null);
});

test("Slice 2 claim: a failed claim read-back holds nothing — the attempt re-presents at the next boot", () => {
  const raw = new Map<string, string>([[CHUNK_RECOVERY_KEY, markerJson()]]);
  const dropping: ObsStorage = {
    getItem: (k: string) => (raw.has(k) ? (raw.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      if (k === CHUNK_RECOVERY_KEY) return; // claim write silently dropped
      raw.set(k, v);
    },
    removeItem: (k: string) => void raw.delete(k),
  };
  const { transport, beacons } = makeTransport(true);
  const obs = createObservability({
    storage: dropping, transport, endpoint: "https://example.com/ingest",
    now: () => S2_NOW, randomId: () => "s2-drop", device: DEVICE, buildId: "b2", isUnclean: () => false,
  });
  obs.init();
  obs.recordMilestone("game_loaded");
  obs.noteRecoverySignal("episode_cleared");
  obs.noteRecoverySignal("repeat_failure");
  assert.equal(outcomeEvents(beacons).length, 0, "nothing held, nothing emitted");
  assert.equal(raw.get(CHUNK_RECOVERY_KEY), markerJson(), "marker survives for the next boot's claim retry");
});

test("Slice 2 afterRecovery choke point: captured-error types gain afterRecovery only while a claimed outcome is pending + unresolved", () => {
  const { beacons, obs } = s2Obs({ [CHUNK_RECOVERY_KEY]: markerJson() });
  obs.init();
  obs.emit({ type: "js_error", ts: S2_NOW, buildId: "b2", error: { name: "Error", message: "boom" } });
  obs.emit({ type: "boot_failure", ts: S2_NOW, buildId: "b2" });
  obs.emitTileFailed();
  const sent = beacons.map((b) => JSON.parse(b.body) as ObservabilityEvent);
  const js = sent.find((e) => e.type === "js_error");
  const boot = sent.find((e) => e.type === "boot_failure");
  const tile = sent.find((e) => e.type === "tile_failed");
  assert.equal(js?.afterRecovery, true);
  assert.equal(boot?.afterRecovery, true);
  assert.ok(tile && !("afterRecovery" in tile), "hiccup types are never stamped");
  // afterRecovery is evidence-neutral: the js_error still classifies
  // developer_needed by its own facts.
  assert.equal(js?.verdict, "developer_needed");
  assert.equal(js?.whyKey, "captured_error");
  // After resolution the choke point closes.
  obs.noteRecoverySignal("repeat_failure");
  obs.emit({ type: "js_error", ts: S2_NOW, buildId: "b2", error: { name: "Error", message: "later" } });
  const after = beacons
    .map((b) => JSON.parse(b.body) as ObservabilityEvent)
    .filter((e) => e.type === "js_error");
  assert.equal(after.length, 2);
  assert.ok(!("afterRecovery" in after[1]), "never stamped once resolved — and never stamped false");
});

test("Slice 2 queue eviction: a queued recovery_outcome survives a burst of live errors and flushes first", () => {
  const { beacons, obs } = s2Obs(
    { [CHUNK_RECOVERY_KEY]: markerJson() },
    { endpoint: null },
  );
  obs.init();
  obs.noteRecoverySignal("repeat_failure");
  assert.equal(obs.getQueueLength(), 1, "outcome queued with no endpoint");
  for (let i = 0; i < 25; i++) {
    obs.emit({ type: "js_error", ts: S2_NOW + i, buildId: "b2", error: { name: "Error", message: `burst-${i}` } });
  }
  assert.equal(obs.getQueueLength(), 20, "queue still capped");
  obs.setEndpoint("https://example.com/ingest");
  const flushed = beacons.map((b) => JSON.parse(b.body) as ObservabilityEvent);
  assert.equal(flushed.length, 20);
  assert.equal(flushed[0].type, "recovery_outcome", "protected from eviction like suspected_crash");
  assert.equal(flushed.filter((e) => e.type === "recovery_outcome").length, 1);
});
