/**
 * storage-backend.ts — the one slot the age-profile stores read
 * their storage through, kept in the domain on purpose.
 *
 * The stores (store.ts, read-aloud-pref.ts) may not import the
 * platform storage port: the layering runs one way, and domain
 * never imports platform (the boundary is lint-guarded). So the
 * browser's storage reaches them through this slot instead —
 * the same pattern as the cleared hook in
 * src/game/subject-progress-store-key.ts: a domain slot, wired
 * from above. The shell registers the browser backend at
 * startup (src/platform/storage/register.ts, called from the
 * root route); nothing in the domain knows where it came from.
 *
 * Unregistered resolves to nothing, on purpose: the stores then
 * take the same path they take today when storage is blocked —
 * reads find nothing, writes land in the in-memory fallback,
 * and the session still works. An explicit storage argument
 * (the reset composition's injected-storage discipline) always
 * wins over the slot.
 */

/** The storage shape the age-profile stores accept. */
export type AgeProfileStorageBackend = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let registeredBackend: AgeProfileStorageBackend | undefined;

/** Register the storage backend (called once, from above, at startup). */
export function setAgeProfileStorageBackend(
  backend: AgeProfileStorageBackend | undefined,
): void {
  registeredBackend = backend;
}

/**
 * Resolve the storage to use: the explicit one when given, else
 * the registered backend, else undefined — no storage at all,
 * and the caller's memory fallback carries the session.
 */
export function resolveAgeProfileStorage(
  explicit?: AgeProfileStorageBackend,
): AgeProfileStorageBackend | undefined {
  return explicit ?? registeredBackend;
}
