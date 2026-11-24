/**
 * register.test.ts — the age-profile stores on their real
 * storage path, composed end to end: the shell's registration
 * (registerBrowserStorage) fills the domain slot, and the real
 * stores read and write through it against whatever
 * globalThis.localStorage is in place.
 *
 * The slot backend lets storage errors propagate on purpose:
 * the stores own the failure policy (their in-memory fallback),
 * so a throwing storage must engage the fallback — and a
 * working storage must persist. Registration is once per
 * process by design (register.ts) and the registered backend
 * resolves the global lazily on every call, so the one
 * registration below serves both cases, each with its own
 * stubbed global in place.
 */
import { __resetReadAloudPrefMemory, __resetMemoryFallback } from "../../../tests/harness/module-seams.ts";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { setAgeProfileStorageBackend } from "../../game/age-profile/storage-backend.ts";
import {
  getReadAloudPref,
  setReadAloudPref,
} from "../../game/age-profile/read-aloud-pref.ts";
import {
  PROFILE_STORAGE_KEY,
  loadProfile,
  setBand,
} from "../../game/age-profile/store.ts";
import {
  resolveVoiceFactory,
  setVoiceFactory,
} from "../../game/audio/voice-channel.ts";
import { registerBrowserStorage } from "./register.ts";

const globals = globalThis as Record<string, unknown>;
const hadLocalStorage = "localStorage" in globals;
const originalLocalStorage = globals.localStorage;

function resetStores(): void {
  __resetMemoryFallback();
  __resetReadAloudPrefMemory();
}

registerBrowserStorage();

after(() => {
  setAgeProfileStorageBackend(undefined);
  setVoiceFactory(undefined);
  resetStores();
  if (hadLocalStorage) globals.localStorage = originalLocalStorage;
  else delete globals.localStorage;
});

describe("the registered voice factory", () => {
  it("registerBrowserStorage fills the domain voice factory with the audio port", () => {
    assert.equal(
      typeof resolveVoiceFactory(),
      "function",
      "the detective player resolves its voice through the registered factory",
    );
  });
});

describe("the registered age-profile storage path", () => {
  it("a throwing storage engages the stores' memory fallback", () => {
    globals.localStorage = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error("private mode");
      },
      removeItem: (): void => {
        throw new Error("private mode");
      },
    };
    resetStores();
    try {
      setBand("7-10");
      const profile = loadProfile();
      assert.equal(profile.status, "active");
      assert.equal(profile.band, "7-10", "the band survives the failed write in memory");
      setReadAloudPref("never");
      assert.equal(getReadAloudPref(), "never", "the read-aloud answer survives in memory too");
    } finally {
      resetStores();
    }
  });

  it("a working storage persists the profile blob under its key", () => {
    const backing = new Map<string, string>();
    globals.localStorage = {
      getItem: (k: string): string | null => (backing.has(k) ? backing.get(k)! : null),
      setItem: (k: string, v: string): void => {
        backing.set(k, String(v));
      },
      removeItem: (k: string): void => {
        backing.delete(k);
      },
    };
    resetStores();
    try {
      setBand("10-18");
      const raw = backing.get(PROFILE_STORAGE_KEY);
      assert.ok(raw, "the raw blob for meridian.ageProfile.v1 is present in the Map");
      assert.equal((JSON.parse(raw) as { band?: unknown }).band, "10-18");
      assert.equal(loadProfile().band, "10-18", "and the store reads it back");
    } finally {
      resetStores();
    }
  });
});
