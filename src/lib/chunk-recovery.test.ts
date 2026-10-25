import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_WINDOW_MS,
  installChunkLoadRecovery,
  isChunkLoadError,
  shouldAutoReloadChunk,
  type ChunkRecoveryHost,
} from "./chunk-recovery.ts";

const CHROME_MSG =
  "Failed to fetch dynamically imported module: https://example.test/assets/LoopScreen-BVyzVhXE.js";
const SAFARI_MSG = "Importing a module script failed.";
const FIREFOX_MSG = "error loading dynamically imported module";

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

test("shouldAutoReloadChunk: signature + window gate", () => {
  // No signature -> never.
  assert.equal(
    shouldAutoReloadChunk({ signature: false, now: 100_000, lastReloadAt: null }),
    false,
  );
  // Signature, never reloaded -> yes.
  assert.equal(
    shouldAutoReloadChunk({ signature: true, now: 100_000, lastReloadAt: null }),
    true,
  );
  // Signature, reloaded inside the window -> no.
  assert.equal(
    shouldAutoReloadChunk({
      signature: true,
      now: 100_000,
      lastReloadAt: 100_000 - CHUNK_RELOAD_WINDOW_MS + 1,
    }),
    false,
  );
  // Signature, window fully elapsed -> yes again.
  assert.equal(
    shouldAutoReloadChunk({
      signature: true,
      now: 100_000,
      lastReloadAt: 100_000 - CHUNK_RELOAD_WINDOW_MS,
    }),
    true,
  );
});

/**
 * Fake host: records listeners, reloads and storage writes; fake clock
 * AND fake timer — the recovery decision is deferred (it must give the
 * app's own stale-build offer time to land), so tests flush the timer
 * queue explicitly to reach the decision point.
 */
function fakeHost(startNow = 1_000_000) {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const store = new Map<string, string>();
  const timers: Array<() => void> = [];
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
        store.set(k, v);
      },
    },
    reload: () => {
      state.reloads += 1;
    },
    now: () => state.now,
    setTimeout: (fn) => {
      timers.push(fn);
    },
    staleOfferVisible: () => state.offerVisible,
  };
  const fire = (type: string, event: unknown) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  const flushTimers = () => {
    for (const fn of timers.splice(0)) fn();
  };
  return { host, fire, state, store, flushTimers };
}

test("install: a vite:preloadError reloads once — deferred, then decided", () => {
  const { host, fire, state, store, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  fire("vite:preloadError", {
    type: "vite:preloadError",
    payload: new TypeError(CHROME_MSG),
  });
  // Deferred: nothing happens until the decision point.
  assert.equal(state.reloads, 0);
  flushTimers();
  assert.equal(state.reloads, 1);
  assert.equal(store.get(CHUNK_RELOAD_KEY), String(state.now));
  // A second failure inside the window must NOT reload again.
  fire("vite:preloadError", {
    type: "vite:preloadError",
    payload: new TypeError(CHROME_MSG),
  });
  flushTimers();
  assert.equal(state.reloads, 1);
});

test("install: a burst of failures collapses into one decision", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  fire("error", { type: "error", error: new TypeError(CHROME_MSG) });
  fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
});

test("install: the app's stale-build offer on screen stands recovery down", () => {
  const { host, fire, state, store, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  state.offerVisible = true;
  fire("vite:preloadError", {
    type: "vite:preloadError",
    payload: new TypeError(CHROME_MSG),
  });
  flushTimers();
  assert.equal(state.reloads, 0);
  // Standing down must not consume the guard: once the offer is gone,
  // a later failure still recovers.
  assert.equal(store.get(CHUNK_RELOAD_KEY), undefined);
  state.offerVisible = false;
  fire("vite:preloadError", {
    type: "vite:preloadError",
    payload: new TypeError(CHROME_MSG),
  });
  flushTimers();
  assert.equal(state.reloads, 1);
});

test("install: backstop — an unhandled rejection with the chunk signature reloads once", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(SAFARI_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
  fire("unhandledrejection", { type: "unhandledrejection", reason: new TypeError(SAFARI_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
});

test("install: backstop — a window error with the chunk signature reloads", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  fire("error", { type: "error", error: new TypeError(FIREFOX_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
});

test("install: unrelated errors never reload", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  fire("error", { type: "error", error: new Error("some render bug") });
  fire("unhandledrejection", { type: "unhandledrejection", reason: new Error("network down") });
  fire("error", { type: "error", message: "Script error." });
  flushTimers();
  assert.equal(state.reloads, 0);
});

test("install: recovery is allowed again after the window passes", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
  state.now += CHUNK_RELOAD_WINDOW_MS + 1;
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 2);
});

test("install: a pre-existing guard stamp inside the window blocks the reload", () => {
  const { host, fire, state, store, flushTimers } = fakeHost();
  store.set(CHUNK_RELOAD_KEY, String(state.now - 1_000));
  installChunkLoadRecovery(host);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 0);
});

test("install: storage that throws cannot break the guard (in-memory fallback)", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  host.storage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
  };
  installChunkLoadRecovery(host);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
});

test("install: installing twice on the same host registers once", () => {
  const { host, fire, state, flushTimers } = fakeHost();
  installChunkLoadRecovery(host);
  installChunkLoadRecovery(host);
  fire("vite:preloadError", { type: "vite:preloadError", payload: new TypeError(CHROME_MSG) });
  flushTimers();
  assert.equal(state.reloads, 1);
});
