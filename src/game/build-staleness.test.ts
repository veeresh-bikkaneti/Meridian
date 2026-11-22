import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CURRENT_BUILD_ID, isNewBuildDeployed } from "./build-staleness.ts";

function fakeFetch(buildId: unknown, ok = true) {
  return (async () => ({
    ok,
    json: async () => ({ buildId }),
  })) as unknown as typeof fetch;
}

test("CURRENT_BUILD_ID falls back to dev outside a Vite build", () => {
  assert.equal(CURRENT_BUILD_ID, "dev");
});

test("isNewBuildDeployed: true when the server names a different build", async () => {
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch("abc123") }), true);
});

test("isNewBuildDeployed: false when the server names this build", async () => {
  assert.equal(
    await isNewBuildDeployed({ fetchFn: fakeFetch(CURRENT_BUILD_ID) }),
    false,
  );
});

test("isNewBuildDeployed: false when the meta fetch fails", async () => {
  const failing = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  assert.equal(await isNewBuildDeployed({ fetchFn: failing }), false);
});

test("isNewBuildDeployed: false on non-OK response or missing buildId", async () => {
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch("abc123", false) }), false);
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch(undefined) }), false);
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch(42) }), false);
});

// F6: the stale-refresh mark is a timestamp, honoured only inside
// its freshness window; the legacy "1" parses as epoch (probe runs).
import { STALE_REFRESH_KEY, staleRefreshRecentlyUsed, STALE_REFRESH_MAX_AGE_MS } from "./build-staleness.ts";
import { setSessionBackend } from "./storage-slot.ts";

const NOW = 1_800_000_000_000;
const storeOf = (v: string | null, throwing = false) => ({
  getItem: (_k: string): string | null => {
    if (throwing) throw new Error("blocked");
    return v;
  },
});

test("staleRefreshRecentlyUsed: a fresh timestamp skips the probe; the window edge is inclusive", () => {
  assert.equal(staleRefreshRecentlyUsed(storeOf(String(NOW - 1_000)), NOW), true);
  assert.equal(staleRefreshRecentlyUsed(storeOf(String(NOW - STALE_REFRESH_MAX_AGE_MS)), NOW), true);
  assert.equal(staleRefreshRecentlyUsed(storeOf(String(NOW - STALE_REFRESH_MAX_AGE_MS - 1)), NOW), false);
});

test("staleRefreshRecentlyUsed: no-arg reads the session slot; unregistered runs the probe", () => {
  const raw = new Map<string, string>();
  setSessionBackend({
    getItem: (k: string) => (raw.has(k) ? raw.get(k)! : null),
    setItem: (k: string, v: string) => {
      raw.set(k, v);
    },
    removeItem: (k: string) => {
      raw.delete(k);
    },
  });
  try {
    raw.set(STALE_REFRESH_KEY, String(NOW - 1_000));
    assert.equal(staleRefreshRecentlyUsed(undefined, NOW), true);
    raw.delete(STALE_REFRESH_KEY);
    assert.equal(staleRefreshRecentlyUsed(undefined, NOW), false);
  } finally {
    setSessionBackend(undefined);
  }
  assert.equal(staleRefreshRecentlyUsed(undefined, NOW), false);
});

test("staleRefreshRecentlyUsed: legacy '1', future, malformed, absent and blocked all run the probe", () => {
  assert.equal(staleRefreshRecentlyUsed(storeOf("1"), NOW), false, "legacy '1' is epoch — fail-open");
  assert.equal(staleRefreshRecentlyUsed(storeOf(String(NOW + 1_000)), NOW), false, "future-dated is not evidence");
  assert.equal(staleRefreshRecentlyUsed(storeOf("yes"), NOW), false);
  assert.equal(staleRefreshRecentlyUsed(storeOf(null), NOW), false);
  assert.equal(staleRefreshRecentlyUsed(storeOf(null, true), NOW), false);
  assert.equal(staleRefreshRecentlyUsed(null, NOW), false);
});
