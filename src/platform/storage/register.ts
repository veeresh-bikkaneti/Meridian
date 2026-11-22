/**
 * register.ts — the shell's one wiring step for storage.
 *
 * The age-profile stores live in the domain, which may not
 * import this platform layer, so they read their storage
 * through a slot (src/game/age-profile/storage-backend.ts).
 * The rest of the domain stores read theirs through the game
 * slot (src/game/storage-slot.ts). This module fills both
 * slots with the browser backends; the root route calls it
 * once at startup.
 *
 * Registering is harmless anywhere: the backends resolve the
 * browser's storage lazily on every call, so on the server the
 * slots simply never find any. Calling it twice changes
 * nothing — the first registration stands.
 */

import { setAgeProfileStorageBackend } from "../../game/age-profile/storage-backend.ts";
import { setVoiceFactory } from "../../game/audio/voice-channel.ts";
import {
  setLocalBackend,
  setSessionBackend,
  type GameEnumerableStorageBackend,
  type GameStorageBackend,
} from "../../game/storage-slot.ts";
import { createVoice } from "../audio/browser-voice.ts";
import { createSlotLocalStorageBackend } from "./browser-storage.ts";

let registered = false;

/**
 * The browser's local storage as the game slot's backend. The
 * throwing shape mirrors createSlotLocalStorageBackend (the
 * stores own the failure policy), plus the enumerable shape the
 * no-repeat history needs to sweep its keys on reset — every
 * member resolves the global lazily on each call.
 */
function createSlotEnumerableLocalStorageBackend(): GameEnumerableStorageBackend {
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
    get length(): number {
      return localStorage.length;
    },
    key(index: number): string | null {
      return localStorage.key(index);
    },
  };
}

/**
 * The browser's session storage as the game slot's backend. The
 * throwing shape mirrors the local slot backend: the stores own
 * the failure policy, so a private-mode or quota failure must
 * surface to them instead of being swallowed.
 */
function createSlotSessionStorageBackend(): GameStorageBackend {
  return {
    getItem(key: string): string | null {
      return sessionStorage.getItem(key);
    },
    setItem(key: string, value: string): void {
      sessionStorage.setItem(key, value);
    },
    removeItem(key: string): void {
      sessionStorage.removeItem(key);
    },
  };
}

/**
 * Register the browser storage backends with the domain stores, and
 * the voice factory with the domain players that may not import the
 * audio port (the detective player sounds through the factory the
 * shell registers here, exactly like the storage slots above).
 */
export function registerBrowserStorage(): void {
  if (registered) return;
  registered = true;
  setAgeProfileStorageBackend(createSlotLocalStorageBackend());
  setLocalBackend(createSlotEnumerableLocalStorageBackend());
  setSessionBackend(createSlotSessionStorageBackend());
  setVoiceFactory(createVoice);
}
