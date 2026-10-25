import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
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
  calls: { set: number; remove: number };
  failRemove: boolean;
}
function sharedStorage(failRemove = false): SharedStorage {
  return { store: new Map(), calls: { set: 0, remove: 0 }, failRemove };
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
  assert.equal(f.calls.set, 1);
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
  assert.equal(f.calls.set, 1);
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
  assert.equal(f.calls.set, 0);
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

test("5A-U: storage that throws cannot break the guard (in-memory fallback)", () => {
  const f = fakeHost();
  f.host.storage = throwingStorage();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
});

test("5A-U clock leg: throwing storage — clock advance alone (+10 windows) never re-arms the writing page", () => {
  const f = fakeHost();
  f.host.storage = throwingStorage();
  installChunkLoadRecovery(f.host);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1);
  f.advanceTimersBy(300_000);
  fireVite(f);
  f.advanceTimersBy(1_500);
  assert.equal(f.state.reloads, 1); // RED pre-fix (new leg): 2
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
  const ss = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      sets += 1;
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
  assert.equal(sets, 1);
});

test("2-U-blocked: blocked storage via the default host — one dispatch reloads exactly once, second dispatch still once", () => {
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
  assert.equal(reloads1, 1); // RED pre-fix: 2 (duplicate listener sets x per-closure memory stamps)
  assert.equal(regs, 3); // RED pre-fix: 6
  assert.equal(reloads2, 1);
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

test("5B: two throwing-storage hosts each reload once per simulated page load", () => {
  for (let i = 0; i < 2; i += 1) {
    const f = fakeHost();
    f.host.storage = throwingStorage();
    installChunkLoadRecovery(f.host);
    fireVite(f);
    f.advanceTimersBy(1_500);
    assert.equal(f.state.reloads, 1);
  }
});

test("5B-SRC-U: the module source pins the storage-blocked claim verbatim and bans the never-loop strings", () => {
  const src = readFileSync(new URL("./chunk-recovery.ts", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.equal(src.includes(BLOCKED_SENTENCE), true);
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
  assert.equal(f.calls.set, 1);
  f.state.offerVisible = true; // too late — the decision already fired
  f.advanceTimersBy(10_000);
  assert.equal(f.state.reloads, 1);
  assert.equal(f.calls.set, 1);
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
