/**
 * The browser storage port — the one real implementation of the
 * storage port, backed by the browser's local storage, plus a
 * session port backed by the browser's session storage.
 *
 * Two rules shape this file:
 *
 * - Storage may be missing or may refuse: on the server there is
 *   none, and private mode can throw on any call. So the global
 *   is resolved lazily inside every call, every call sits in
 *   try/catch, reads fall back (each fallback handed out as a
 *   fresh copy) and writes quietly no-op. No path here throws
 *   into the caller.
 * - A write announces itself whether or not it landed. The
 *   stores this port replaces wrote inside try/catch and then
 *   told their listeners anyway; a listener must never be left
 *   stale just because the storage underneath failed.
 *
 * Cross-tab changes arrive through the window's "storage" event,
 * attached only while someone is subscribed: the first
 * subscriber attaches it, the last unsubscribe detaches it.
 */

import { decodeStoredText } from "./storage.ts";
import type {
  StorageBackend,
  StorageEventSource,
  StorageKeyDef,
  StoragePort,
  StoragePortDeps,
} from "./storage.ts";

/**
 * The browser's local storage as a backend. The global is
 * resolved lazily inside every call, so building one anywhere —
 * even on the server — is harmless: each call simply finds no
 * storage, or a refusing one, and fails soft.
 */
export function createLocalStorageBackend(): StorageBackend {
  return {
    getItem(key: string): string | null {
      try {
        if (typeof localStorage === "undefined") return null;
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(key, value);
      } catch {
        // Private mode or a full store: the write is dropped.
      }
    },
    removeItem(key: string): void {
      try {
        if (typeof localStorage === "undefined") return;
        localStorage.removeItem(key);
      } catch {
        // Same as a write: removal is dropped, never thrown.
      }
    },
  };
}

/**
 * The browser's local storage as a backend whose errors
 * PROPAGATE. This backend is for the age-profile slot
 * (register.ts): those stores own the failure policy — they
 * try/catch every call and engage their in-memory fallback when
 * a call throws — so a private-mode or quota failure must
 * surface to them instead of being swallowed. The port's own
 * backend above stays fail-soft. The global is still resolved
 * lazily inside every call; a missing global throws like any
 * other storage failure, and the stores' try/catch turns it
 * into the same memory-fallback path.
 */
export function createSlotLocalStorageBackend(): StorageBackend {
  return {
    getItem(key: string): string | null {
      return localStorage.getItem(key);
    },
    setItem(key: string, value: string): void {
      localStorage.setItem(key, value);
    },
    removeItem(key: string): void {
      localStorage.removeItem(key);
    },
  };
}

const localStorageBackend: StorageBackend = createLocalStorageBackend();

/**
 * The browser's session storage as a backend. The same fail-soft
 * mirror as the local backend: the global is resolved lazily
 * inside every call, so building one anywhere is harmless.
 */
export function createSessionStorageBackend(): StorageBackend {
  return {
    getItem(key: string): string | null {
      try {
        if (typeof sessionStorage === "undefined") return null;
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof sessionStorage === "undefined") return;
        sessionStorage.setItem(key, value);
      } catch {
        // Private mode or a full store: the write is dropped.
      }
    },
    removeItem(key: string): void {
      try {
        if (typeof sessionStorage === "undefined") return;
        sessionStorage.removeItem(key);
      } catch {
        // Same as a write: removal is dropped, never thrown.
      }
    },
  };
}

const sessionStorageBackend: StorageBackend = createSessionStorageBackend();

/**
 * A fresh copy of a key's fallback, so a caller that mutates
 * what it read cannot poison the fallback for the next read.
 * Cloning itself can fail (a fallback holding something
 * uncloneable); then the fallback goes out as-is — never a throw.
 */
function freshFallback<T>(fallback: T): T {
  try {
    return structuredClone(fallback);
  } catch {
    return fallback;
  }
}

/** The window's "storage" events; inert where there is no window. */
const windowEventSource: StorageEventSource = {
  addListener(cb: (key: string | null) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (event: StorageEvent): void => cb(event.key);
    try {
      window.addEventListener("storage", handler);
    } catch {
      return () => {};
    }
    return () => {
      try {
        window.removeEventListener("storage", handler);
      } catch {
        // The window is gone; detaching is already done.
      }
    };
  },
};

/**
 * An event source that never fires. Session storage has no
 * cross-tab events, so the session port must not share the
 * window "storage" listener: another tab clearing its local
 * storage would re-emit every subscribed session key as
 * changed, wrongly. Subscribing still attaches this source
 * through the port's usual first-subscriber path, and the
 * returned stop function is a no-op.
 */
export const inertStorageEventSource: StorageEventSource = {
  addListener(): () => void {
    return () => {};
  },
};

/** Make the browser storage port. Seams in deps are for tests. */
export function createBrowserStoragePort(
  deps: StoragePortDeps = {},
): StoragePort {
  const backend = deps.backend ?? localStorageBackend;
  const eventSource = deps.eventSource ?? windowEventSource;

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

  return {
    getItem<T>(def: StorageKeyDef<T>): T {
      let raw: string | null = null;
      try {
        raw = backend.getItem(def.key);
      } catch {
        return freshFallback(def.fallback);
      }
      return decodeStoredText(def, raw, () => freshFallback(def.fallback));
    },

    setItem<T>(def: StorageKeyDef<T>, value: T): void {
      try {
        backend.setItem(def.key, JSON.stringify(value));
      } catch {
        // The write failed silently; the announce below still
        // fires, as the stores before the port announced too.
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
            // Detaching must never throw into a screen.
          }
          detachSource = null;
        }
      };
    },

    notifyChanged(key: string): void {
      emit(key);
    },
  };
}

const defaultPort = createBrowserStoragePort();

/** Read one value on the shared browser port. */
export function getStorageItem<T>(def: StorageKeyDef<T>): T {
  return defaultPort.getItem(def);
}

/** Write one value on the shared browser port. */
export function setStorageItem<T>(def: StorageKeyDef<T>, value: T): void {
  defaultPort.setItem(def, value);
}

/** Remove one value on the shared browser port. */
export function removeStorageItem<T>(def: StorageKeyDef<T>): void {
  defaultPort.removeItem(def);
}

/** Hear about one key's changes on the shared browser port. */
export function subscribeStorage(key: string, cb: () => void): () => void {
  return defaultPort.subscribe(key, cb);
}

/** Announce one key's change on the shared browser port. */
export function notifyStorageChanged(key: string): void {
  defaultPort.notifyChanged(key);
}

/**
 * Make the browser session port: the same port over session
 * storage, with the inert event source — session values never
 * arrive from another tab. Seams in deps are for tests.
 */
export function createSessionStoragePort(
  deps: StoragePortDeps = {},
): StoragePort {
  return createBrowserStoragePort({
    backend: deps.backend ?? sessionStorageBackend,
    eventSource: deps.eventSource ?? inertStorageEventSource,
  });
}

const defaultSessionPort = createSessionStoragePort();

/** Read one value on the shared browser session port. */
export function getSessionStorageItem<T>(def: StorageKeyDef<T>): T {
  return defaultSessionPort.getItem(def);
}

/** Write one value on the shared browser session port. */
export function setSessionStorageItem<T>(def: StorageKeyDef<T>, value: T): void {
  defaultSessionPort.setItem(def, value);
}

/** Remove one value on the shared browser session port. */
export function removeSessionStorageItem<T>(def: StorageKeyDef<T>): void {
  defaultSessionPort.removeItem(def);
}

/** Hear about one key's changes on the shared browser session port. */
export function subscribeSessionStorage(
  key: string,
  cb: () => void,
): () => void {
  return defaultSessionPort.subscribe(key, cb);
}

/** Announce one key's change on the shared browser session port. */
export function notifySessionStorageChanged(key: string): void {
  defaultSessionPort.notifyChanged(key);
}
