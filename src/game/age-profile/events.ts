/**
 * age-profile/events.ts — the module's typed event bus.
 *
 * Decoupling rule: game screens NEVER import the store directly. The store
 * emits `ageprofile:changed` here; consumers subscribe. This is the ONLY
 * cross-module channel for profile changes (Observer pattern from the
 * mechanics profile: signals for loose coupling).
 *
 * The bus is a tiny in-memory Set of listeners — no DOM events, no
 * window.dispatchEvent, so it works in tests and SSR without a browser.
 */

import type { AgeProfileChangedEvent } from "./types.ts";

export const AGE_PROFILE_CHANGED = "ageprofile:changed" as const;

export type AgeProfileEventListener = (event: AgeProfileChangedEvent) => void;

const listeners = new Set<AgeProfileEventListener>();

/**
 * Subscribe to band changes. Returns an unsubscribe function —
 * callers (React effects) MUST unsubscribe on unmount.
 */
export function onAgeProfileChanged(listener: AgeProfileEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emit a typed profile-change event to all subscribers. Listener errors
 * are isolated: one bad subscriber never breaks the others or the store.
 */
export function emitAgeProfileChanged(event: AgeProfileChangedEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // Deliberately swallowed: event delivery must never throw into the
      // store transition that emitted it.
    }
  }
}

/** Test/SSR escape hatch: how many listeners are currently subscribed. */
export function listenerCount(): number {
  return listeners.size;
}
