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
