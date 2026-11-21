/**
 * The in-memory fake storage port, for tests.
 *
 * It follows the same contract as the browser port — same
 * fail-soft reads (each fallback handed out as a fresh copy),
 * same announce-after-write, same one event system — over a Map
 * instead of the browser's storage. The test
 * drives the outside world by hand: setRaw plants raw text
 * behind a key (corrupt or off-schema, say), getRaw reads what a
 * write actually stored, and emitCrossTab fires the cross-tab
 * event the way another tab would.
 */

import type {
  StorageBackend,
  StorageEventSource,
  StorageKeyDef,
  StoragePort,
  StoragePortDeps,
} from "./storage.ts";

/** A fake port plus the test's controls over its outside world. */
export interface FakeStoragePort {
  /** The port under test. */
  port: StoragePort;
  /** The backend the port is reading and writing. */
  backend: StorageBackend;
  /** Plant raw text behind a key, bypassing the port's encoding. */
  setRaw(key: string, raw: string): void;
  /** Read the raw text behind a key, or null when absent. */
  getRaw(key: string): string | null;
  /** Fire a cross-tab change event for a key (null: cleared all). */
  emitCrossTab(key: string | null): void;
  /** How many listeners the fake's own event source now holds. */
  sourceListenerCount(): number;
}

/**
 * A fresh copy of a key's fallback, so a caller that mutates
 * what it read cannot poison the fallback for the next read.
 * Cloning itself can fail; then the fallback goes out as-is —
 * never a throw. (Local copy: the fake is standalone by design.)
 */
function freshFallback<T>(fallback: T): T {
  try {
    return structuredClone(fallback);
  } catch {
    return fallback;
  }
}

/** Make a fake port plus its controls. Seams in deps are for tests. */
export function createFakeStoragePort(
  deps: StoragePortDeps = {},
): FakeStoragePort {
  const map = new Map<string, string>();
  const mapBackend: StorageBackend = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  const backend = deps.backend ?? mapBackend;

  const sourceListeners = new Set<(key: string | null) => void>();
  const ownEventSource: StorageEventSource = {
    addListener(cb: (key: string | null) => void): () => void {
      sourceListeners.add(cb);
      return () => {
        sourceListeners.delete(cb);
      };
    },
  };
  const eventSource = deps.eventSource ?? ownEventSource;

  const subscribers = new Map<string, Set<() => void>>();
  let subscriberTotal = 0;
  let detachSource: (() => void) | null = null;

  const emit = (key: string): void => {
    const set = subscribers.get(key);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb();
      } catch {
        // One listener must never break the others or the write.
      }
    }
  };

  const onCrossTab = (key: string | null): void => {
    if (key !== null) {
      emit(key);
      return;
    }
    // No key means the other tab cleared everything: every
    // subscribed key may have changed.
    for (const subscribedKey of [...subscribers.keys()]) emit(subscribedKey);
  };

  const port: StoragePort = {
    getItem<T>(def: StorageKeyDef<T>): T {
      let raw: string | null = null;
      try {
        raw = backend.getItem(def.key);
      } catch {
        return freshFallback(def.fallback);
      }
      if (raw === null) return freshFallback(def.fallback);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return freshFallback(def.fallback);
      }
      const result = def.schema.safeParse(parsed);
      return result.success ? result.data : freshFallback(def.fallback);
    },

    setItem<T>(def: StorageKeyDef<T>, value: T): void {
      try {
        backend.setItem(def.key, JSON.stringify(value));
      } catch {
        // The write failed silently; the announce still fires.
      }
      emit(def.key);
    },

    removeItem<T>(def: StorageKeyDef<T>): void {
      try {
        backend.removeItem(def.key);
      } catch {
        // Removal failed silently; the announce still fires.
      }
      emit(def.key);
    },

    subscribe(key: string, cb: () => void): () => void {
      let set = subscribers.get(key);
      if (!set) {
        set = new Set();
        subscribers.set(key, set);
      }
      set.add(cb);
      subscriberTotal++;
      if (subscriberTotal === 1) {
        try {
          detachSource = eventSource.addListener(onCrossTab);
        } catch {
          detachSource = null;
        }
      }
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const current = subscribers.get(key);
        if (current) {
          current.delete(cb);
          if (current.size === 0) subscribers.delete(key);
        }
        subscriberTotal--;
        if (subscriberTotal === 0 && detachSource) {
          try {
            detachSource();
          } catch {
            // Detaching must never throw into a test.
          }
          detachSource = null;
        }
      };
    },

    notifyChanged(key: string): void {
      emit(key);
    },
  };

  return {
    port,
    backend,
    setRaw: (key, raw) => backend.setItem(key, raw),
    getRaw: (key) => backend.getItem(key),
    emitCrossTab: (key) => {
      for (const cb of [...sourceListeners]) cb(key);
    },
    sourceListenerCount: () => sourceListeners.size,
  };
}
