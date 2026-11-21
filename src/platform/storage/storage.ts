/**
 * The storage port's types — one place owns each kind of saved
 * value.
 *
 * A store asks the port to read or write a value under a key from
 * the registry (keys.ts). The port owns the JSON encoding, the
 * schema check, and the change announcements, so stores do not
 * touch the browser's storage themselves.
 *
 * The rules, in plain words:
 *
 * - Values are stored as JSON text. A read parses the text and
 *   checks it against the key's schema; anything missing,
 *   unreadable, corrupt or off-schema reads back as the key's
 *   fallback. Storage is enhancement only: no path here throws
 *   into the caller, on the server, in private mode, or anywhere
 *   else storage is missing or refuses.
 * - A write announces itself after the write attempt, whether or
 *   not the write landed — a store that swallowed a storage
 *   failure today still told its listeners, and that does not
 *   change. Removal announces itself the same way.
 * - Announcements reach only the changed key's subscribers, and
 *   one listener's failure never breaks the others or the write.
 * - subscribe() also listens for other tabs: the port attaches
 *   the cross-tab event source when the first subscriber arrives
 *   (across all keys) and detaches it when the last one leaves.
 *   A cross-tab event announces the matching key; an event with
 *   no key (the other tab cleared everything) announces every
 *   subscribed key.
 * - notifyChanged() lets a writer outside the port announce a
 *   change it made itself, through the same one system.
 */

import type { ZodType } from "zod";

/** The slice of a key-value storage the port touches. */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** One registered key: its string, its value's schema, its fallback. */
export interface StorageKeyDef<T> {
  /** The storage key string, pinned in the registry (keys.ts). */
  key: string;
  /** The shape a stored value must have to be trusted. */
  schema: ZodType<T>;
  /** What a read returns when nothing trustworthy is stored. */
  fallback: T;
}

/** A source of cross-tab change events, such as window "storage". */
export interface StorageEventSource {
  /** Start listening; returns the stop function. The callback
   * receives the changed key, or null when everything changed. */
  addListener(cb: (key: string | null) => void): () => void;
}

/** The port itself: stores depend on this, not on the storage. */
export interface StoragePort {
  /** Read a value: the stored value when it parses and matches
   * the schema, the key's fallback otherwise. Never throws. */
  getItem<T>(def: StorageKeyDef<T>): T;
  /** Write a value as JSON, then announce the key's change —
   * even when the write itself failed silently. Never throws. */
  setItem<T>(def: StorageKeyDef<T>, value: T): void;
  /** Remove a value, then announce the key's change the same
   * way as a write. Never throws. */
  removeItem<T>(def: StorageKeyDef<T>): void;
  /** Hear about one key's changes, from this tab's writes and
   * from other tabs. Returns the unsubscribe function. */
  subscribe(key: string, cb: () => void): () => void;
  /** Announce one key's change to its subscribers, for writers
   * that changed the value outside the port. */
  notifyChanged(key: string): void;
}

/** Injectable seams for the port, so tests can drive it with no DOM. */
export interface StoragePortDeps {
  /** Where values live. Defaults to the browser's local storage,
   * resolved lazily on each call. */
  backend?: StorageBackend;
  /** Where cross-tab events come from. Defaults to the window's
   * "storage" events. */
  eventSource?: StorageEventSource;
}
