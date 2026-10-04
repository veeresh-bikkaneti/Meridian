import assert from "node:assert/strict";
import test from "node:test";
import {
  BREADCRUMB_KEY,
  MAX_HISTORY,
  MAX_PAYLOAD_BYTES,
  createObservability,
  truncateEventToCap,
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
