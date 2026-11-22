/**
 * storage-slot.ts — the one slot the domain stores read their
 * storage through, kept in the domain on purpose.
 *
 * The stores (everything under src/game/** and src/lib/** that
 * persists) may not import the platform storage port: the
 * layering runs one way, and domain never imports platform (the
 * boundary is lint-guarded). So the browser's storage reaches
 * them through this slot instead — the same pattern as the
 * age-profile slot in src/game/age-profile/storage-backend.ts:
 * a domain slot, wired from above. The shell registers the
 * browser backends at startup (src/platform/storage/register.ts,
 * called from the root route); nothing in the domain knows where
 * they came from.
 *
 * Unregistered resolves to nothing, on purpose: the stores then
 * take the same path they take today when storage is blocked —
 * reads find nothing, writes land in the in-memory fallback,
 * and the session still works. An explicit storage argument
 * (the reset composition's injected-storage discipline) always
 * wins over the slot.
 *
 * The local slot carries the enumerable shape (length + key)
 * because the no-repeat history enumerates its keys to sweep
 * them on reset (src/game/trail.ts); the session slot never
 * enumerates, so it stays the plain three-method shape.
 */

/** The storage shape the domain stores accept (session side). */
export type GameStorageBackend = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The storage shape the domain stores accept (local side, enumerable). */
export type GameEnumerableStorageBackend = GameStorageBackend &
  Pick<Storage, "length" | "key">;

let registeredLocal: GameEnumerableStorageBackend | undefined;
let registeredSession: GameStorageBackend | undefined;

/** Register the local storage backend (called once, from above, at startup). */
export function setLocalBackend(
  backend: GameEnumerableStorageBackend | undefined,
): void {
  registeredLocal = backend;
}

/** Register the session storage backend (called once, from above, at startup). */
export function setSessionBackend(backend: GameStorageBackend | undefined): void {
  registeredSession = backend;
}

/**
 * Resolve the local storage to use: the explicit one when given,
 * else the registered backend, else undefined — no storage at
 * all, and the caller's memory fallback carries the session.
 */
export function resolveLocal(
  explicit?: GameEnumerableStorageBackend,
): GameEnumerableStorageBackend | undefined {
  return explicit ?? registeredLocal;
}

/**
 * Resolve the session storage to use: the explicit one when
 * given, else the registered backend, else undefined — no
 * storage at all, and the caller's memory fallback carries the
 * session.
 */
export function resolveSession(
  explicit?: GameStorageBackend,
): GameStorageBackend | undefined {
  return explicit ?? registeredSession;
}
