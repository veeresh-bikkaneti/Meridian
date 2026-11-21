/**
 * register.ts — the shell's one wiring step for storage.
 *
 * The age-profile stores live in the domain, which may not
 * import this platform layer, so they read their storage
 * through a slot (src/game/age-profile/storage-backend.ts).
 * This module fills that slot with the browser backend; the
 * root route calls it once at startup.
 *
 * Registering is harmless anywhere: the backend resolves the
 * browser's storage lazily on every call, so on the server the
 * slot simply never finds any. Calling it twice changes
 * nothing — the first registration stands.
 */

import { setAgeProfileStorageBackend } from "../../game/age-profile/storage-backend.ts";
import { createLocalStorageBackend } from "./browser-storage.ts";

let registered = false;

/** Register the browser storage backend with the age-profile stores. */
export function registerBrowserStorage(): void {
  if (registered) return;
  registered = true;
  setAgeProfileStorageBackend(createLocalStorageBackend());
}
