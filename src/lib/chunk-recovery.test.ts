import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CHUNK_RECOVERY_KEY,
  CHUNK_RELOAD_KEY,
  installChunkLoadRecovery,
  isChunkLoadError,
  type ChunkRecoveryHost,
} from "./chunk-recovery.ts";

const T0 = 1_000_000;
const CHROME_MSG =
  "Failed to fetch dynamically imported module: https://example.test/assets/LoopScreen-BVyzVhXE.js";
const SAFARI_MSG = "Importing a module script failed.";
const FIREFOX_MSG = "error loading dynamically imported module";
const BLOCKED_SENTENCE =
  "auto-recovery promises at most one auto-reload per page load when session storage is blocked, and it makes no promise that a later page load will be prevented from auto-reloading once again if the same chunk is still missing";
const STAND_DOWN_SENTENCE =
  "When the reload stamp cannot be persisted and read back verified, auto-recovery stands down and does not auto-reload on this or any later failure in that page load.";

test("isChunkLoadError: matches the three browser chunk-failure signatures", () => {
  assert.equal(isChunkLoadError(new TypeError(CHROME_MSG)), true);
  assert.equal(isChunkLoadError(new TypeError(SAFARI_MSG)), true);
  assert.equal(isChunkLoadError(new TypeError(FIREFOX_MSG)), true);
  // Bare-string surface (some browsers report the failure as a string).
  assert.equal(isChunkLoadError(CHROME_MSG), true);
});

test("isChunkLoadError: rejects unrelated errors and non-errors", () => {
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of null")), false);
  assert.equal(isChunkLoadError(new Error("Failed to fetch")), false);
  assert.equal(isChunkLoadError(new RangeError("Maximum call stack size exceeded")), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError(42), false);
  assert.equal(isChunkLoadError({}), false);
  assert.equal(isChunkLoadError({ message: 42 }), false);
});

/**
 * Fake host: records listeners, reloads and storage writes; fake clock
 * AND fake timer — the recovery decision is deferred (it must give the
 * app's own stale-build offer time to land), so tests flush the timer
 * queue explicitly to reach the decision point.
 * H1: timers are duration-aware ({fn, ms, due}); advanceTimersBy(ms)
 * sets the clock first, then fires due timers in due order (the
 * event-time rule: tests set state.now before firing an event).
 * flushTimers is abolished; pendingTimers() is a driver only.
 */
interface SharedStorage {
  store: Map<string, string>;
  calls: { set: number; setByKey: Record<string, number>; remove: number };
  failRemove: boolean;
}
function sharedStorage(failRemove = false): SharedStorage {
  return { store: new Map(), calls: { set: 0, setByKey: {}, remove: 0 }, failRemove };
}
function fakeHost(startNow = 1_000_000, shared: SharedStorage = sharedStorage()) {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const store = shared.store;
  const calls = shared.calls;
  const timers: Array<{ fn: () => void; ms: number; due: number }> = [];
  const state = { now: startNow, reloads: 0, offerVisible: false };
  const host: ChunkRecoveryHost = {
    addEventListener: (type, listener) => {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        calls.set += 1;
        calls.setByKey[k] = (calls.setByKey[k] ?? 0) + 1;
        store.set(k, v);
      },
      removeItem: (k) => {
        calls.remove += 1;
        if (shared.failRemove) throw new Error("remove blocked");
        store.delete(k);
      },
    },
    reload: () => {
      state.reloads += 1;
    },
    now: () => state.now,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms, due: state.now + ms });
    },
    staleOfferVisible: () => state.offerVisible,
  };
  const fire = (type: string, event: unknown) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  const advanceTimersBy = (ms: number) => {
    state.now += ms;
    for (;;) {
      let idx = -1;
      for (let i = 0; i < timers.length; i += 1) {
        if (timers[i].due <= state.now && (idx < 0 || timers[i].due < timers[idx].due)) idx = i;
      }
      if (idx < 0) break;
      const [t] = timers.splice(idx, 1);
      t.fn();
    }
  };
  const pendingTimers = () => timers.map((t) => t.ms);
  const registrations = () => [...listeners.values()].reduce((n, a) => n + a.length, 0);
  const seed = (age: number) => {
    const v = String(state.now - age);
    store.set(CHUNK_RELOAD_KEY, v);
    return v;
  };
  return { host, fire, state, store, calls, advanceTimersBy, pendingTimers, registrations, seed };
}
type Fake = ReturnType<typeof fakeHost>;
const fireVite = (f: Fake) =>
  f.fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
function throwingStorage(): NonNullable<ChunkRecoveryHost["storage"]> {
  const boom = () => {
    throw new Error("storage blocked");
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

test("1-U: fresh episode reloads once at T0+1500, writes the stamp once, never arms on write, late failure still blocked", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.calls.setByKey[CHUNK_RELOAD_KEY] ?? 0, 1);
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
  f.advanceTimersBy(60_000); // failure-free: the write alone never arms the clear countdown
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
  assert.equal(f.calls.remove, 0);
  fireVite(f); // observed at T0+61_500
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1); // RED pre-fix: late leg reloads (2)
});

test("install: a vite:preloadError reloads once — deferred, then decided", () => {
  const { host, fire, state, store, advanceTimersBy } = fakeHost();
  installChunkLoadRecovery(host);
  fire("vite:preloadError", {
    type: "vite:preloadError",
    payload: new TypeError(CHROME_MSG),
  });
  // Deferred: nothing happens until the decision point.
  assert.equal(state.reloads, 0);
  advanceTimersBy(1_500);
  assert.equal(state.reloads, 1);
  assert.equal(store.get(CHUNK_RELOAD_KEY), String(state.now));
  // A second failure inside the window must NOT reload again.
  fire("vite:preloadError", {
    type: "vite:preloadError",
    payload: new TypeError(CHROME_MSG),
  });
  advanceTimersBy(1_500);
  assert.equal(state.reloads, 1);
});

test("10-U: a burst of failures collapses into one decision — one pending timer, one reload, one stamp", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.fire("error", { type: "error", error: new TypeError(CHROME_MSG) });
  f.fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(CHROME_MSG) });
  assert.deepEqual(f.pendingTimers(), [1_500]);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.calls.setByKey[CHUNK_RELOAD_KEY] ?? 0, 1);
});

test("6-U: the app's stale-build offer on screen stands recovery down — and does not consume the guard", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  f.state.offerVisible = true;
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  // Standing down must not consume the guard: once the offer is gone,
  // a later failure still recovers.
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), undefined);
  assert.equal(f.calls.setByKey[CHUNK_RELOAD_KEY] ?? 0, 0);
  f.state.offerVisible = false;
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

test("install: backstop — an unhandled rejection with the chunk signature reloads once", () => {
  const { host, fire, state, advanceTimersBy } = fakeHost();
  installChunkLoadRecovery(host);
  fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(SAFARI_MSG) });
  advanceTimersBy(1_500);
  assert.equal(state.reloads, 1);
  fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(SAFARI_MSG) });
  advanceTimersBy(1_500);
  assert.equal(state.reloads, 1);
});

test("install: backstop — a window error with the chunk signature reloads", () => {
  const { host, fire, state, advanceTimersBy } = fakeHost();
  installChunkLoadRecovery(host);
  fire("error", { type: "error", error: new TypeError(FIREFOX_MSG) });
  advanceTimersBy(1_500);
  assert.equal(state.reloads, 1);
});

test("8-U: unrelated errors never reload — no decision timer is ever scheduled, no stamp", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  f.fire("error", { type: "error", error: new Error("some render bug") });
  f.fire("unhandledrejection", { type: "unhandledrejection", reason: new Error("network down") });
  f.fire("error", { type: "error", message: "Script error." });
  f.fire("error", { type: "error", error: new Error("another bug"), message: "another bug" });
  assert.deepEqual(f.pendingTimers(), []); // RED by mutation only (see mutation log)
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  assert.equal(f.calls.set, 0);
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
});

test("install: a pre-existing guard stamp inside the window blocks the reload", () => {
  const { host, fire, state, store, advanceTimersBy } = fakeHost();
  store.set(CHUNK_RELOAD_KEY, String(state.now - 1_000));
  installChunkLoadRecovery(host);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  advanceTimersBy(1_500);
  assert.equal(state.reloads, 0);
});

test("5A-U: storage that throws stands recovery down — zero reloads, latched for the page load", () => {
  const f = fakeHost();
  f.host.storage = throwingStorage();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(10_000); // past any delayed-reload variant
  assert.equal(f.state.reloads, 0);
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0); // the stand-down latches for this page load
});

test("5A-U clock leg: throwing storage — zero reloads, and clock advance alone (+300_000) never re-arms the page", () => {
  const f = fakeHost();
  f.host.storage = throwingStorage();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(300_000);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
});

test("install: installing twice on the same host registers once", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  installChunkLoadRecovery(f.host);
  assert.equal(f.registrations(), 3);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

function stubWindow(sessionStorageStub: unknown) {
  const registrations: Array<{ type: string; listener: (e: unknown) => void }> = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const state = { reloads: 0 };
  const win = {
    addEventListener: (type: string, listener: (e: unknown) => void) => {
      registrations.push({ type, listener });
    },
    sessionStorage: sessionStorageStub,
    location: {
      reload: () => {
        state.reloads += 1;
      },
    },
    setTimeout: (fn: () => void, ms: number) => {
      timers.push({ fn, ms });
    },
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = win;
  g.document = { body: { innerText: "", textContent: "" } };
  return {
    registrations,
    timers,
    state,
    dispatch: (type: string) => { for (const r of registrations.filter((r) => r.type === type)) r.listener({ type }); },
    flush: () => { for (const t of timers.splice(0)) t.fn(); },
    cleanup: () => {
      delete g.window;
      delete g.document;
    },
  };
}
test("2-U: two no-arg installs register exactly 3 listeners; one dispatch reloads once with one stamp", () => {
  const m = new Map<string, string>();
  let sets = 0;
  const setsByKey: Record<string, number> = {};
  const ss = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      sets += 1;
      setsByKey[k] = (setsByKey[k] ?? 0) + 1;
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
  const w = stubWindow(ss);
  installChunkLoadRecovery();
  installChunkLoadRecovery();
  const after2 = w.registrations.length;
  installChunkLoadRecovery();
  const after3 = w.registrations.length;
  w.dispatch("vite:preloadError");
  const timerMs = w.timers.map((t) => t.ms);
  w.flush();
  const reloads = w.state.reloads;
  w.cleanup();
  assert.equal(after2, 3); // RED pre-fix: 6
  assert.equal(after3, 3); // RED pre-fix: 9
  assert.deepEqual(timerMs, [1_500]);
  assert.equal(reloads, 1);
  assert.equal(setsByKey[CHUNK_RELOAD_KEY] ?? 0, 1);
});

test("2-U-blocked: blocked storage via the default host — no dispatch reloads, second dispatch still zero", () => {
  const boom = () => {
    throw new Error("storage blocked");
  };
  const w = stubWindow({ getItem: boom, setItem: boom, removeItem: boom });
  installChunkLoadRecovery();
  installChunkLoadRecovery();
  const regs = w.registrations.length;
  w.dispatch("vite:preloadError");
  w.flush();
  const reloads1 = w.state.reloads;
  w.dispatch("vite:preloadError");
  w.flush();
  const reloads2 = w.state.reloads;
  w.cleanup();
  assert.equal(reloads1, 0); // blocked storage stands the default host down too
  assert.equal(regs, 3); // RED pre-fix: 6
  assert.equal(reloads2, 0);
});

test("3A-U: seeded episode blocks, clears after 30000 failure-free, then the next failure reloads", () => {
  const f = fakeHost();
  const seedVal = f.seed(1_000);
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  assert.equal(f.calls.set, 0);
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), seedVal);
  f.advanceTimersBy(28_500); // T0+30_000: countdown completes
  assert.equal(f.calls.remove, 1); // RED pre-fix: stamp never removed
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

test("3A-U2: seed age 300000 latches; boundary age exactly 900000 latches", () => {
  const f = fakeHost();
  const seedVal = f.seed(300_000);
  installChunkLoadRecovery(f.host);
  assert.equal(f.calls.remove, 0);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0); // RED pre-fix: reloads 1
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), seedVal);
  assert.equal(f.calls.set, 0);
  const b = fakeHost();
  b.seed(900_000);
  installChunkLoadRecovery(b.host);
  fireVite(b);
  b.advanceTimersBy(1_500);
  assert.equal(b.state.reloads, 0);
});

test("3A-U3: seed age 900001 is stale — removed once at install, no latch; S1: throwing removeItem still reloads once with a fresh stamp", () => {
  const f = fakeHost();
  f.seed(900_001);
  installChunkLoadRecovery(f.host);
  assert.equal(f.calls.remove, 1); // RED pre-fix: 0, stamp still the stale seed
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
  const s = fakeHost(T0, sharedStorage(true));
  s.seed(900_001);
  installChunkLoadRecovery(s.host);
  assert.equal(s.calls.remove, 1); // attempted exactly once despite the throw
  fireVite(s);
  s.advanceTimersBy(1_500);
  assert.equal(s.state.reloads, 1);
  assert.equal(s.store.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
});

test("3A-U-div: removal failure diverges per page — completing page re-arms, a fresh install still latches on the surviving stamp", () => {
  const shared = sharedStorage(true);
  const h1 = fakeHost(T0, shared);
  const seedVal = h1.seed(1_000);
  installChunkLoadRecovery(h1.host);
  h1.advanceTimersBy(30_000); // leg a: countdown completes, removal attempted once, stamp survives
  assert.equal(shared.calls.remove, 1);
  assert.equal(shared.store.get(CHUNK_RELOAD_KEY), seedVal);
  fireVite(h1); // leg b (S2 chain): the completing page re-armed -> reloads once, fresh stamp
  h1.advanceTimersBy(1_500);
  assert.equal(h1.state.reloads, 1);
  assert.equal(shared.store.get(CHUNK_RELOAD_KEY), String(T0 + 31_500));
  fireVite(h1);
  h1.advanceTimersBy(1_500);
  assert.equal(h1.state.reloads, 1);
  const shared2 = sharedStorage(true); // leg c: fresh scenario from the leg-a state
  const a = fakeHost(T0, shared2);
  a.seed(1_000);
  installChunkLoadRecovery(a.host);
  a.advanceTimersBy(30_000);
  assert.equal(shared2.calls.remove, 1);
  const h2 = fakeHost(T0 + 31_000, shared2);
  installChunkLoadRecovery(h2.host);
  const setsBefore = shared2.calls.set;
  fireVite(h2); // stamp age 32000 > CLEAR and the retired window, still <= MAX_AGE
  h2.advanceTimersBy(1_500);
  assert.equal(h2.state.reloads, 0); // RED pre-fix: leg c reloads
  assert.equal(shared2.calls.set, setsBefore);
});

test("4-U: observations re-arm the countdown — failures at +20000 and +35000 both block; clear happens at the restarted deadline", () => {
  const f = fakeHost();
  f.seed(1_000);
  installChunkLoadRecovery(f.host);
  f.advanceTimersBy(20_000);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(13_500); // T0+35_000
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0); // RED pre-fix: the T0+35000 failure reloads
  f.advanceTimersBy(28_500); // T0+65_000: restarted deadline
  assert.equal(f.calls.remove, 1);
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), String(T0 + 66_500));
});

test("4-U-max: latch survives past MAX_AGE via restarts — observations at total age 919000 and 939000 both block", () => {
  const f = fakeHost();
  f.seed(899_000);
  installChunkLoadRecovery(f.host);
  assert.equal(f.calls.remove, 0);
  f.advanceTimersBy(20_000);
  fireVite(f); // observation #1, total stamp age 919000
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0); // RED pre-fix / age-cap-at-decision: observation #1 reloads
  assert.equal(f.calls.set, 0);
  f.advanceTimersBy(18_500); // T0+40_000
  fireVite(f); // observation #2, total stamp age 939000 > MAX_AGE
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(28_500); // T0+70_000: restarted deadline
  assert.equal(f.calls.remove, 1);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), String(T0 + 71_500));
});

test("4-U-neg: the page that wrote the stamp never re-arms on clock advance alone", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  f.advanceTimersBy(300_000); // +10 retired windows, no further failure
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), true);
  assert.equal(f.calls.remove, 0);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

test("5B: three throwing-storage page loads each reload zero times — no unrememberable reloads", () => {
  let total = 0;
  for (let i = 0; i < 3; i += 1) {
    const f = fakeHost();
    f.host.storage = throwingStorage();
    installChunkLoadRecovery(f.host);
    fireVite(f);
    f.advanceTimersBy(1_500);
    assert.equal(f.state.reloads, 0);
    f.advanceTimersBy(10_000); // past any delayed-reload variant
    assert.equal(f.state.reloads, 0);
    total += f.state.reloads;
  }
  assert.equal(total, 0); // the F4b loop measurement was 3 reloads over 3 loads
});

test("5B-SRC-U: the module source pins the no-unrememberable-reloads claim verbatim and bans the old blocked-storage promise", () => {
  const src = readFileSync(new URL("./chunk-recovery.ts", import.meta.url), "utf8").replace(/^\s*\* ?/gm, " ").replace(/\s+/g, " ");
  assert.equal(src.includes(STAND_DOWN_SENTENCE), true);
  assert.equal(src.includes(BLOCKED_SENTENCE), false);
  assert.equal(src.includes("never loop"), false);
  assert.equal(src.includes("can never loop"), false);
  assert.equal(src.includes("CHUNK_EPISODE_CLEAR_MS"), true);
  assert.equal(src.includes("CHUNK_EPISODE_MAX_AGE_MS"), true);
  assert.equal(src.includes("CHUNK_RELOAD_WINDOW_MS"), false);
  assert.equal(src.includes("shouldAutoReloadChunk"), false);
});

test("7-U: an offer arriving after the decision point does not stand recovery down (D1 pin)", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.calls.setByKey[CHUNK_RELOAD_KEY] ?? 0, 1);
  f.state.offerVisible = true; // too late — the decision already fired
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.calls.setByKey[CHUNK_RELOAD_KEY] ?? 0, 1);
});

test("9-Ua: a restarted countdown no-ops the stale generation at the original deadline and clears at the new one", () => {
  const f = fakeHost();
  const seedVal = f.seed(1_000);
  installChunkLoadRecovery(f.host); // arms the countdown, deadline T0+30000
  f.advanceTimersBy(20_000);
  fireVite(f); // observation at T0+20000 restarts it, deadline T0+50000
  f.advanceTimersBy(1_500); // the pending decision blocks
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(8_501); // T0+30001: past the ORIGINAL deadline
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), seedVal); // a naive second-timer implementation fails here
  assert.equal(f.calls.remove, 0);
  f.advanceTimersBy(19_998); // T0+49999
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), seedVal);
  assert.equal(f.calls.remove, 0);
  f.advanceTimersBy(1); // T0+50000
  assert.equal(f.calls.remove, 1); // RED pre-fix: stamp never removed
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

test("9-Ub: landing exactly on the deadline fires the countdown; later events observe the cleared episode", () => {
  const f = fakeHost();
  f.seed(1_000);
  installChunkLoadRecovery(f.host);
  f.advanceTimersBy(30_000); // exactly on the deadline (fake-host convention)
  assert.equal(f.calls.remove, 1);
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

test("9-Uc: an observation while a decision is pending schedules no second decision but restarts the countdown again", () => {
  const f = fakeHost();
  const seedVal = f.seed(1_000);
  installChunkLoadRecovery(f.host);
  f.advanceTimersBy(20_000);
  fireVite(f); // failure #1: decision pending, countdown restarted to T0+50000
  f.advanceTimersBy(500);
  fireVite(f); // failure #2 at +500, decision still pending: countdown restarted to T0+50500
  assert.equal(f.pendingTimers().filter((ms) => ms === 1_500).length, 1);
  f.advanceTimersBy(1_000); // T0+21500: the pending decision blocks
  assert.equal(f.state.reloads, 0);
  assert.equal(f.calls.set, 0);
  f.advanceTimersBy(28_500); // T0+50000: first-observation deadline — must NOT clear
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), seedVal); // RED: hook inside/after the pending check clears here
  assert.equal(f.calls.remove, 0);
  f.advanceTimersBy(500); // T0+50500: second-observation deadline
  assert.equal(f.calls.remove, 1);
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
});

test("9-Ud: unrelated errors inside an active episode do not restart the countdown", () => {
  const f = fakeHost();
  f.seed(1_000);
  installChunkLoadRecovery(f.host); // countdown deadline T0+30000
  f.advanceTimersBy(20_000);
  f.fire("error", { type: "error", error: new Error("some render bug") });
  f.fire("unhandledrejection", { type: "unhandledrejection", reason: new Error("network down") });
  f.advanceTimersBy(10_000); // T0+30000
  assert.equal(f.calls.remove, 1); // RED target: an any-error restart keeps the stamp here
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
  f.advanceTimersBy(1_500);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1); // the episode had ended
});

/**
 * 5C series — no unrememberable reloads (D6 fix). A reload is authorised
 * only by a stamp whose write is read back verified from storage
 * itself (never via the in-memory mirror). Every zero-reload leg waits
 * the 1_500 ms decision delay AND a further 10_000 ms, so a delayed
 * reload cannot pass vacuously.
 */
function countingThrowingStorage() {
  const state = { sets: 0, setsByKey: {} as Record<string, number> };
  const boom = () => {
    throw new Error("storage blocked");
  };
  const storage: NonNullable<ChunkRecoveryHost["storage"]> = {
    getItem: boom,
    setItem: (k: string) => {
      state.sets += 1;
      state.setsByKey[k] = (state.setsByKey[k] ?? 0) + 1;
      throw new Error("storage blocked");
    },
    removeItem: boom,
  };
  return { storage, state };
}

test("5C-U-null: storage is null — zero reloads, repeated failures still zero", () => {
  const f = fakeHost();
  f.host.storage = null;
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
});

test("5C-U-set-throws: setItem throws at write time (storage healthy at install) — zero reloads, one attempt", () => {
  const f = fakeHost();
  const backing = new Map<string, string>();
  let broken = false;
  let sets = 0;
  f.host.storage = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => {
      sets += 1;
      if (broken) throw new Error("storage blocked");
      backing.set(k, v);
    },
    removeItem: (k) => {
      backing.delete(k);
    },
  };
  installChunkLoadRecovery(f.host); // install reads healthy storage
  broken = true; // storage breaks only after install
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(sets, 1); // persistence is judged at write time, not install time
});

test("5C-U-verify-throws: setItem succeeds but the read-back throws — zero reloads, the unverified stamp is cleaned up", () => {
  const f = fakeHost();
  const backing = new Map<string, string>();
  let sets = 0;
  f.host.storage = {
    getItem: () => {
      throw new Error("read blocked");
    },
    setItem: (k, v) => {
      sets += 1;
      backing.set(k, v);
    },
    removeItem: (k) => {
      backing.delete(k);
    },
  };
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(sets, 1);
  // The write landed but could not be verified: best-effort cleanup
  // removes it, so no dangling stamp survives this decision.
  assert.equal(backing.has(CHUNK_RELOAD_KEY), false);
});

test("5C-U-dangling: cleanup also fails — the surviving stamp latches the next page load as an ordinary episode", () => {
  const backing = new Map<string, string>();
  const f = fakeHost();
  f.host.storage = {
    getItem: () => {
      throw new Error("read blocked");
    },
    setItem: (k, v) => {
      backing.set(k, v);
    },
    removeItem: () => {
      throw new Error("remove blocked");
    },
  };
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  // The stamp WAS written; only its verification and cleanup failed.
  assert.equal(backing.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));

  // Next page load, storage healthy again: the surviving stamp is an
  // ordinary fresh stamp — install latches on it (episode semantics),
  // it is not a second hidden stand-down.
  const f2 = fakeHost(T0 + 5_000);
  f2.host.storage = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => {
      backing.set(k, v);
    },
    removeItem: (k) => {
      backing.delete(k);
    },
  };
  installChunkLoadRecovery(f2.host);
  fireVite(f2);
  f2.advanceTimersBy(1_500);
  f2.advanceTimersBy(10_000);
  assert.equal(f2.state.reloads, 0);
  assert.equal(backing.get(CHUNK_RELOAD_KEY), String(T0 + 1_500)); // never rewritten
});

test("5C-U-silent-drop: setItem silently stores nothing, read-back returns null — zero reloads", () => {
  const f = fakeHost();
  let sets = 0;
  f.host.storage = {
    getItem: () => null,
    setItem: () => {
      sets += 1; // no throw — the write is silently discarded
    },
    removeItem: () => {},
  };
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(sets, 1);
});

test("5C-U-mismatch: read-back returns a different value — zero reloads (exact-equality check)", () => {
  const f = fakeHost();
  const backing = new Map<string, string>();
  f.host.storage = {
    getItem: () => "999",
    setItem: (k, v) => {
      backing.set(k, v);
    },
    removeItem: (k) => {
      backing.delete(k);
    },
  };
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(backing.has(CHUNK_RELOAD_KEY), false); // cleanup ran
});

test("5C-U-latch: after an unrememberable decision, later failures make no new write attempt", () => {
  const f = fakeHost();
  const { storage, state } = countingThrowingStorage();
  f.host.storage = storage;
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  assert.equal(state.sets, 1);
  f.fire("error", { type: "error", error: new TypeError(CHROME_MSG) });
  f.fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(CHROME_MSG) });
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(state.sets, 1); // the latch, not a per-failure retry
});

test("5C-U-heal: storage healing mid-page-load does not re-arm that page; a fresh page load with healed storage reloads once", () => {
  const f = fakeHost();
  f.host.storage = throwingStorage();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  // Storage heals on the SAME page load: the stand-down still holds.
  const healed = new Map<string, string>();
  const healedStorage: NonNullable<ChunkRecoveryHost["storage"]> = {
    getItem: (k) => healed.get(k) ?? null,
    setItem: (k, v) => {
      healed.set(k, v);
    },
    removeItem: (k) => {
      healed.delete(k);
    },
  };
  f.host.storage = healedStorage;
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  // A FRESH page load on the healed storage recovers normally.
  const f2 = fakeHost();
  f2.host.storage = healedStorage;
  installChunkLoadRecovery(f2.host);
  fireVite(f2);
  f2.advanceTimersBy(1_500);
  assert.equal(f2.state.reloads, 1);
  assert.equal(healed.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
});

test("5C-U-burst: a burst on unrememberable storage collapses to one decision, one write attempt, zero reloads", () => {
  const f = fakeHost();
  const { storage, state } = countingThrowingStorage();
  f.host.storage = storage;
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.fire("error", { type: "error", error: new TypeError(CHROME_MSG) });
  f.fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(CHROME_MSG) });
  assert.deepEqual(f.pendingTimers(), [1_500]);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(state.sets, 1);
});

test("5C-U-offer: stale-offer stand-down attempts no write; a later failure on blocked storage still reloads zero times", () => {
  const f = fakeHost();
  const { storage, state } = countingThrowingStorage();
  f.host.storage = storage;
  installChunkLoadRecovery(f.host);
  f.state.offerVisible = true;
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  assert.equal(state.setsByKey[CHUNK_RELOAD_KEY] ?? 0, 0); // the offer check precedes any write attempt
  f.state.offerVisible = false;
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
  assert.equal(state.setsByKey[CHUNK_RELOAD_KEY] ?? 0, 1); // the blocked failure attempted once, then latched
});

test("5C-U-after-clear: an episode that clears, then fails with storage now broken, stands down", () => {
  const f = fakeHost();
  f.seed(1_000);
  installChunkLoadRecovery(f.host);
  f.advanceTimersBy(30_000); // the episode clears (stamp removed)
  assert.equal(f.calls.remove, 1);
  assert.equal(f.store.has(CHUNK_RELOAD_KEY), false);
  const working = f.host.storage as NonNullable<ChunkRecoveryHost["storage"]>;
  f.host.storage = {
    ...working,
    setItem: () => {
      throw new Error("storage blocked");
    },
  };
  fireVite(f);
  f.advanceTimersBy(1_500);
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 0);
});

test("5C-U-roundtrip: working storage reloads exactly once, only on an exact verified round-trip", () => {
  const f = fakeHost();
  const ops: string[] = [];
  const inner = f.host.storage as NonNullable<ChunkRecoveryHost["storage"]>;
  f.host.storage = {
    getItem: (k) => {
      ops.push("get");
      return inner.getItem(k);
    },
    setItem: (k, v) => {
      ops.push("set");
      inner.setItem(k, v);
    },
    removeItem: (k) => {
      ops.push("remove");
      inner.removeItem(k);
    },
  };
  installChunkLoadRecovery(f.host);
  fireVite(f);
  const mark = ops.length;
  f.advanceTimersBy(1_499);
  assert.equal(f.state.reloads, 0);
  f.advanceTimersBy(1); // the decision fires at T0+1_500
  assert.equal(f.state.reloads, 1);
  assert.equal(f.calls.setByKey[CHUNK_RELOAD_KEY] ?? 0, 1); // verification does not double-write
  assert.equal(f.store.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
  const decisionOps = ops.slice(mark);
  const setIdx = decisionOps.indexOf("set");
  assert.notEqual(setIdx, -1);
  // The read-back actually happened on the success path, after the set.
  assert.equal(decisionOps.indexOf("get", setIdx) > setIdx, true);
});

// --- Slice 2: recovery outcome marker + signals (Consensus Manifest 2026-10-25) ---
//
// The outcome marker (meridian.chunkRecovery) is written ONLY by this
// module; observability claims it at the next init and owns terminal
// emission. These contracts pin the chunk side: marker writes, the
// pending-at-install state machine, and the host signal seam. A page
// pair sharing one storage models the reload (the F4b probe idiom).

type OutcomeSignal = "episode_cleared" | "repeat_failure" | "stood_down";
interface SignalCall {
  signal: OutcomeSignal;
  build?: string;
  at?: number;
}

function outcomeFake(startNow = T0, shared: SharedStorage = sharedStorage()) {
  const f = fakeHost(startNow, shared);
  const signals: SignalCall[] = [];
  const host: ChunkRecoveryHost = {
    ...f.host,
    buildId: "build-a",
    onRecoverySignal: (signal, facts) => {
      signals.push({ signal, build: facts?.build, at: facts?.at });
    },
  };
  return { ...f, host, signals };
}
type OFake = ReturnType<typeof outcomeFake>;

/** Run a fresh page-1 failure through to its reload on shared storage. */
function pageOneReload(shared: SharedStorage): OFake {
  const p1 = outcomeFake(T0, shared);
  installChunkLoadRecovery(p1.host);
  fireVite(p1);
  p1.advanceTimersBy(1_500);
  assert.equal(p1.state.reloads, 1);
  return p1;
}

function readMarker(store: Map<string, string>): Record<string, unknown> | null {
  const raw = store.get(CHUNK_RECOVERY_KEY);
  if (raw === undefined) return null;
  return JSON.parse(raw) as Record<string, unknown>;
}

test("O1-U: a verified reload writes the outcome marker with the stamp's own `at` and the failing build", () => {
  const shared = sharedStorage();
  pageOneReload(shared);
  const marker = readMarker(shared.store);
  assert.ok(marker);
  assert.equal(marker.v, 1);
  assert.equal(marker.at, T0 + 1_500);
  assert.equal(marker.build, "build-a");
  assert.equal(marker.outcome, undefined);
  assert.equal(shared.store.get(CHUNK_RELOAD_KEY), String(T0 + 1_500));
});

test("O2-U: a marker write that throws never blocks the reload and fires no signal", () => {
  const shared = sharedStorage();
  const f = fakeHost(T0, shared);
  const signals: SignalCall[] = [];
  const inner = f.host.storage!;
  const host: ChunkRecoveryHost = {
    ...f.host,
    storage: {
      getItem: (k) => inner.getItem(k),
      setItem: (k, v) => {
        if (k === CHUNK_RECOVERY_KEY) throw new Error("marker blocked");
        inner.setItem(k, v);
      },
      removeItem: (k) => inner.removeItem(k),
    },
    buildId: "build-a",
    onRecoverySignal: (signal, facts) => signals.push({ signal, build: facts?.build, at: facts?.at }),
  };
  installChunkLoadRecovery(host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.equal(shared.store.has(CHUNK_RECOVERY_KEY), false);
  assert.deepEqual(signals, []);
});

test("O3-U: the offer stand-down writes a terminal marker, fires stood_down, then removes the marker", () => {
  const shared = sharedStorage();
  const f = fakeHost(T0, shared);
  const ops: string[] = [];
  const inner = f.host.storage!;
  let markerAtSignal: string | null = null;
  const host: ChunkRecoveryHost = {
    ...f.host,
    storage: {
      getItem: (k) => inner.getItem(k),
      setItem: (k, v) => {
        if (k === CHUNK_RECOVERY_KEY) ops.push("marker-set");
        inner.setItem(k, v);
      },
      removeItem: (k) => {
        if (k === CHUNK_RECOVERY_KEY) ops.push("marker-remove");
        inner.removeItem(k);
      },
    },
    buildId: "build-a",
    onRecoverySignal: (signal) => {
      ops.push(`signal:${signal}`);
      markerAtSignal = shared.store.get(CHUNK_RECOVERY_KEY) ?? null;
    },
  };
  installChunkLoadRecovery(host);
  f.state.offerVisible = true;
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  assert.deepEqual(ops, ["marker-set", "signal:stood_down", "marker-remove"]);
  const written = markerAtSignal ? (JSON.parse(markerAtSignal) as Record<string, unknown>) : null;
  assert.ok(written);
  assert.equal(written.v, 1);
  assert.equal(written.build, "build-a");
  assert.equal(written.outcome, "stood_down");
  assert.equal(shared.store.has(CHUNK_RECOVERY_KEY), false);
  assert.equal(shared.store.has(CHUNK_RELOAD_KEY), false);
  // A second failure while the offer stands does not re-signal.
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.deepEqual(ops, ["marker-set", "signal:stood_down", "marker-remove"]);
});

test("O4-U: an unverifiable stand-down marker write fires NO stood_down signal (no record, no report)", () => {
  const shared = sharedStorage();
  const f = fakeHost(T0, shared);
  const inner = f.host.storage!;
  const signals: SignalCall[] = [];
  const host: ChunkRecoveryHost = {
    ...f.host,
    storage: {
      getItem: (k) => inner.getItem(k),
      setItem: (k, v) => {
        if (k === CHUNK_RECOVERY_KEY) return; // silently dropped
        inner.setItem(k, v);
      },
      removeItem: (k) => inner.removeItem(k),
    },
    buildId: "build-a",
    onRecoverySignal: (signal, facts) => signals.push({ signal, build: facts?.build, at: facts?.at }),
  };
  installChunkLoadRecovery(host);
  f.state.offerVisible = true;
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 0);
  assert.deepEqual(signals, []);
});

test("O5-U: in the recovered session a recurrence fires repeat_failure at observation, exactly once, and consumes the decide cycle", () => {
  const shared = sharedStorage();
  pageOneReload(shared);
  const p2 = outcomeFake(T0 + 2_000, shared);
  installChunkLoadRecovery(p2.host);
  fireVite(p2);
  // Observation-time: the signal lands BEFORE any timer advance.
  assert.deepEqual(p2.signals.map((s) => s.signal), ["repeat_failure"]);
  assert.equal(p2.signals[0].build, "build-a");
  // The same failure through the other two listeners adds nothing.
  p2.fire("error", { type: "error", error: new TypeError(CHROME_MSG) });
  p2.fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(CHROME_MSG) });
  assert.equal(p2.signals.length, 1);
  // The pending decide cycle is consumed: no reload, no second signal,
  // and the held marker is NOT chunk-recovery's to delete.
  p2.state.offerVisible = true;
  p2.advanceTimersBy(10_000);
  assert.equal(p2.state.reloads, 0);
  assert.equal(p2.signals.length, 1);
  assert.ok(readMarker(shared.store));
});

test("O6-U: in the recovered session an offer already on screen at observation resolves the attempt as stood_down", () => {
  const shared = sharedStorage();
  pageOneReload(shared);
  const p2 = outcomeFake(T0 + 2_000, shared);
  installChunkLoadRecovery(p2.host);
  p2.state.offerVisible = true;
  fireVite(p2);
  assert.deepEqual(p2.signals.map((s) => s.signal), ["stood_down"]);
  p2.advanceTimersBy(10_000);
  assert.equal(p2.state.reloads, 0);
  assert.equal(p2.signals.length, 1);
  assert.ok(readMarker(shared.store)); // held marker: observability deletes on emission
});

test("O7-U: episode_cleared is not terminal — a recurrence after the clear leg still fires repeat_failure", () => {
  const shared = sharedStorage();
  pageOneReload(shared);
  const p2 = outcomeFake(T0 + 2_000, shared);
  installChunkLoadRecovery(p2.host);
  p2.advanceTimersBy(30_000); // the install-armed clear countdown completes
  assert.deepEqual(p2.signals.map((s) => s.signal), ["episode_cleared"]);
  assert.equal(shared.store.has(CHUNK_RELOAD_KEY), false); // the latch clear still ran
  fireVite(p2);
  assert.deepEqual(p2.signals.map((s) => s.signal), ["episode_cleared", "repeat_failure"]);
  p2.advanceTimersBy(10_000);
  assert.equal(p2.state.reloads, 0);
  assert.equal(p2.signals.length, 2);
});

test("O8-U: a marker that vanished before the recurrence means the outcome already emitted — the failure is treated as fresh", () => {
  const shared = sharedStorage();
  pageOneReload(shared);
  const p2 = outcomeFake(T0 + 2_000, shared);
  installChunkLoadRecovery(p2.host);
  shared.store.delete(CHUNK_RECOVERY_KEY); // observability emitted + deleted
  fireVite(p2);
  assert.deepEqual(p2.signals, []);
  p2.advanceTimersBy(1_500);
  assert.equal(p2.state.reloads, 0); // the episode latch still blocks it
});

test("O9-U: pending with a stale stamp gets a pending-only clear leg — 30 failure-free seconds fire episode_cleared without touching the latch", () => {
  const shared = sharedStorage();
  const now = T0 + 901_000;
  shared.store.set(CHUNK_RELOAD_KEY, String(T0)); // stale at install (>900 s)
  shared.store.set(
    CHUNK_RECOVERY_KEY,
    JSON.stringify({ v: 1, at: T0, build: "build-a" }),
  );
  const p2 = outcomeFake(now, shared);
  installChunkLoadRecovery(p2.host);
  assert.equal(shared.store.has(CHUNK_RELOAD_KEY), false); // stale stamp cleared by shipped install logic
  p2.advanceTimersBy(29_999);
  assert.deepEqual(p2.signals, []);
  p2.advanceTimersBy(1);
  assert.deepEqual(p2.signals.map((s) => s.signal), ["episode_cleared"]);
});

test("O10-U: after a terminal signal in a stale-stamp pending session, a later failure is a fresh attempt — it reloads and writes a fresh marker", () => {
  const shared = sharedStorage();
  const now = T0 + 901_000;
  shared.store.set(CHUNK_RELOAD_KEY, String(T0));
  shared.store.set(
    CHUNK_RECOVERY_KEY,
    JSON.stringify({ v: 1, at: T0, build: "build-a" }),
  );
  const p2 = outcomeFake(now, shared);
  installChunkLoadRecovery(p2.host);
  fireVite(p2); // resolves the stale attempt as repeat_failure
  assert.deepEqual(p2.signals.map((s) => s.signal), ["repeat_failure"]);
  p2.advanceTimersBy(1_500); // consumed cycle
  assert.equal(p2.state.reloads, 0);
  shared.store.delete(CHUNK_RECOVERY_KEY); // observability consumed the outcome
  fireVite(p2); // a genuinely new failure
  p2.advanceTimersBy(1_500);
  assert.equal(p2.state.reloads, 1);
  const marker = readMarker(shared.store);
  assert.ok(marker);
  assert.equal(marker.at, now + 3_000);
});

test("O11-U: a terminal stand-down record in storage is not a pending attempt", () => {
  const shared = sharedStorage();
  shared.store.set(
    CHUNK_RECOVERY_KEY,
    JSON.stringify({ v: 1, at: T0, build: "build-a", outcome: "stood_down" }),
  );
  const f = outcomeFake(T0, shared);
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1); // treated as an ordinary fresh failure
  assert.deepEqual(f.signals, []);
  const marker = readMarker(shared.store);
  assert.ok(marker);
  assert.equal(marker.outcome, undefined); // replaced by the new attempt's marker
});

test("O12-U: a corrupt marker at install is not a pending attempt", () => {
  const shared = sharedStorage();
  shared.store.set(CHUNK_RECOVERY_KEY, "not json {");
  const f = outcomeFake(T0, shared);
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  assert.deepEqual(f.signals, []);
});

test("O13-U: with no outcome hooks anywhere, recovery behaves exactly as before (marker carries the 'unknown' build sentinel)", () => {
  const f = fakeHost();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  const marker = readMarker(f.store);
  assert.ok(marker);
  assert.equal(marker.build, "unknown");
});

test("O14-U: install-call hooks fill the seam when the host itself carries no outcome fields", () => {
  const shared = sharedStorage();
  const f = fakeHost(T0, shared);
  const signals: SignalCall[] = [];
  installChunkLoadRecovery(f.host, {
    buildId: "build-b",
    onRecoverySignal: (signal, facts) => signals.push({ signal, build: facts?.build, at: facts?.at }),
  });
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  const marker = readMarker(shared.store);
  assert.ok(marker);
  assert.equal(marker.build, "build-b");
  // And the signal seam is live on the recovered page.
  const p2 = fakeHost(T0 + 2_000, shared);
  installChunkLoadRecovery(p2.host, {
    buildId: "build-b",
    onRecoverySignal: (signal, facts) => signals.push({ signal, build: facts?.build, at: facts?.at }),
  });
  fireVite(p2);
  assert.deepEqual(signals.map((s) => s.signal), ["repeat_failure"]);
});
