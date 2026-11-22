import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { registerBrowserStorage } from "../platform/storage/register.ts";
import {
  resolveLocal,
  resolveSession,
  setLocalBackend,
  setSessionBackend,
  type GameStorageBackend,
} from "./storage-slot.ts";

/**
 * The domain storage slot: domain stores resolve their storage
 * through here instead of touching the browser globals, and the
 * shell fills it once at startup. Unregistered resolves to
 * undefined so the stores' existing memory fallbacks carry the
 * session, exactly as when storage is blocked.
 */

function mapBackend(backing: Map<string, string>): GameStorageBackend {
  return {
    getItem: (key: string): string | null => (backing.has(key) ? backing.get(key)! : null),
    setItem: (key: string, value: string): void => {
      backing.set(key, value);
    },
    removeItem: (key: string): void => {
      backing.delete(key);
    },
  };
}

afterEach(() => {
  setLocalBackend(undefined);
  setSessionBackend(undefined);
});

describe("storage slot", () => {
  test("unregistered resolves to undefined for both stores", () => {
    assert.equal(resolveLocal(), undefined);
    assert.equal(resolveSession(), undefined);
  });

  test("a registered local backend resolves and round-trips", () => {
    const backing = new Map<string, string>();
    setLocalBackend({ ...mapBackend(backing), length: 0, key: () => null });
    const resolved = resolveLocal();
    assert.ok(resolved);
    resolved.setItem("k", "v");
    assert.equal(backing.get("k"), "v");
    assert.equal(resolved.getItem("k"), "v");
    resolved.removeItem("k");
    assert.equal(backing.has("k"), false);
  });

  test("a registered session backend resolves and round-trips", () => {
    const backing = new Map<string, string>();
    setSessionBackend(mapBackend(backing));
    const resolved = resolveSession();
    assert.ok(resolved);
    resolved.setItem("k", "v");
    assert.equal(resolved.getItem("k"), "v");
  });

  test("an explicit backend wins over the registered one", () => {
    const registered = new Map<string, string>();
    const explicit = new Map<string, string>();
    setLocalBackend({ ...mapBackend(registered), length: 0, key: () => null });
    const resolved = resolveLocal({ ...mapBackend(explicit), length: 0, key: () => null });
    resolved!.setItem("k", "v");
    assert.equal(explicit.get("k"), "v");
    assert.equal(registered.has("k"), false);
  });

  test("setting a slot to undefined clears it", () => {
    setLocalBackend({ ...mapBackend(new Map()), length: 0, key: () => null });
    setLocalBackend(undefined);
    assert.equal(resolveLocal(), undefined);
    setSessionBackend(mapBackend(new Map()));
    setSessionBackend(undefined);
    assert.equal(resolveSession(), undefined);
  });

  test("registerBrowserStorage fills both slots from the globals", () => {
    const globals = globalThis as Record<string, unknown>;
    const localBacking = new Map<string, string>();
    const sessionBacking = new Map<string, string>();
    const prevLocal = globals.localStorage;
    const prevSession = globals.sessionStorage;
    globals.localStorage = {
      ...mapBackend(localBacking),
      get length(): number {
        return localBacking.size;
      },
      key: (index: number): string | null => [...localBacking.keys()][index] ?? null,
    };
    globals.sessionStorage = mapBackend(sessionBacking);
    try {
      registerBrowserStorage();
      const local = resolveLocal();
      const session = resolveSession();
      assert.ok(local, "the local slot is filled");
      assert.ok(session, "the session slot is filled");
      local.setItem("lk", "lv");
      assert.equal(localBacking.get("lk"), "lv");
      assert.equal(local.length, 1);
      assert.equal(local.key(0), "lk");
      session.setItem("sk", "sv");
      assert.equal(sessionBacking.get("sk"), "sv");
    } finally {
      if (prevLocal === undefined) delete globals.localStorage;
      else globals.localStorage = prevLocal;
      if (prevSession === undefined) delete globals.sessionStorage;
      else globals.sessionStorage = prevSession;
    }
  });
});
