/**
 * age-profile/store.ts — the SOLE owner of the age-profile storage.
 *
 * Owns localStorage key `meridian.ageProfile.v1` (schemaVersion 1) and the
 * lifecycle state machine (Phase 1 §4):
 *
 *   unset --set(band)--> active                        (first setup)
 *   active --requestChange(b)--> pending-change         (b !== band; parent gate)
 *   pending-change --confirm/boundary--> active         (band=pendingBand, changeCount+1)
 *   pending-change --cancel | --timeout(10 min)--> active (band unchanged)
 *   active --reset()--> unset                          (band=null; game progress untouched)
 *
 * Invariants: pendingBand===null unless pending-change; requestChange to
 * the same band is a no-op; corrupted JSON → unset (full-access default —
 * never strand a child in a locked-down state).
 *
 * Game screens must NOT import this module directly — use the facade in
 * index.ts (resolveBand / onAgeProfileChanged).
 */

import type { AgeBandId, AgeProfile, ProfileStatus } from "./types.ts";
import { FULL_ACCESS_BAND, AGE_BAND_IDS } from "./bands.ts";
import { emitAgeProfileChanged } from "./events.ts";

export const PROFILE_STORAGE_KEY = "meridian.ageProfile.v1";
export const PROFILE_SCHEMA_VERSION = 1;
/** A staged change the parent never confirms times out back to active. */
export const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

const unsetProfile = (): AgeProfile => ({
  status: "unset",
  band: null,
  updatedAt: new Date().toISOString(),
  changeCount: 0,
  pendingBand: null,
  schemaVersion: PROFILE_SCHEMA_VERSION,
});

function isAgeBandId(value: unknown): value is AgeBandId {
  return typeof value === "string" && (AGE_BAND_IDS as string[]).includes(value);
}

/**
 * Runtime validation of a stored blob. Returns a valid profile, or null
 * when the blob is corrupt/wrong-version/wrong-shape. Corrupt → treated as
 * unset by loadProfile (fail-closed to full access).
 */
export function validateProfile(blob: unknown): AgeProfile | null {
  if (typeof blob !== "object" || blob === null) return null;
  const b = blob as Record<string, unknown>;
  if (b.schemaVersion !== PROFILE_SCHEMA_VERSION) return null;
  const status = b.status;
  if (status !== "unset" && status !== "active" && status !== "pending-change") return null;
  const band = b.band;
  if (!(band === null || isAgeBandId(band))) return null;
  const pendingBand = b.pendingBand;
  if (!(pendingBand === null || isAgeBandId(pendingBand))) return null;
  if (typeof b.updatedAt !== "string" || Number.isNaN(Date.parse(b.updatedAt))) return null;
  if (typeof b.changeCount !== "number" || !Number.isInteger(b.changeCount) || b.changeCount < 0)
    return null;
  // Structural invariants (Phase 1 §4).
  if (status === "unset" && (band !== null || pendingBand !== null)) return null;
  if (status === "active" && (band === null || pendingBand !== null)) return null;
  if (status === "pending-change" && (band === null || pendingBand === null)) return null;
  if (status === "pending-change" && band === pendingBand) return null;
  return {
    status: status as ProfileStatus,
    band,
    updatedAt: b.updatedAt as string,
    changeCount: b.changeCount as number,
    pendingBand,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
}

// Storage-write failure fallback (Phase 1 §4): keep the profile in memory
// for the session so the parent's choice still works until reload.
let memoryFallback: AgeProfile | null = null;

function readStorage(): AgeProfile | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw === null) return null;
    return validateProfile(JSON.parse(raw));
  } catch {
    // getItem/parse throw (private mode, corrupt JSON) → corrupt.
    return null;
  }
}

function writeStorage(profile: AgeProfile): boolean {
  try {
    if (typeof localStorage === "undefined") throw new Error("no localStorage");
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    memoryFallback = null;
    return true;
  } catch {
    memoryFallback = profile;
    return false;
  }
}

/**
 * Load the profile, runtime-validated. Corrupt/wrong-version storage →
 * the unset default (full-access default; the child is never stranded in
 * a locked-down state). A timed-out pending-change reverts to active.
 */
export function loadProfile(): AgeProfile {
  const stored = readStorage() ?? memoryFallback;
  if (stored === null) return unsetProfile();
  if (stored.status === "pending-change") {
    const age = Date.now() - Date.parse(stored.updatedAt);
    if (Number.isNaN(age) || age >= PENDING_TIMEOUT_MS) {
      // Timeout: fail closed to the previous band, no event (nobody
      // confirmed anything).
      const reverted: AgeProfile = { ...stored, status: "active", pendingBand: null };
      writeStorage(reverted);
      return reverted;
    }
  }
  return stored;
}

/** First setup: unset → active. No confirm (nothing to lose; undo is one tap away). */
export function setBand(band: AgeBandId): AgeProfile {
  const profile: AgeProfile = {
    status: "active",
    band,
    updatedAt: new Date().toISOString(),
    changeCount: 0,
    pendingBand: null,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
  writeStorage(profile);
  emitAgeProfileChanged({
    type: "ageprofile:changed",
    kind: "set",
    band,
    previousBand: null,
    midSession: false,
  });
  return profile;
}

/**
 * Request a band change (parent gate already passed).
 * - Same band → no-op (returns the current profile, no event).
 * - No run in progress → applies immediately (active).
 * - Run in progress → staged as pending-change; the consumer applies it
 *   at the next card/round boundary via applyPendingAtBoundary().
 */
export function requestChange(band: AgeBandId, opts: { runInProgress: boolean }): AgeProfile {
  const current = loadProfile();
  const previousBand: AgeBandId | null = current.band;
  if (current.status === "active" && current.band === band) return current;
  if (current.status === "pending-change" && current.pendingBand === band) return current;

  const now = new Date().toISOString();
  if (!opts.runInProgress) {
    const profile: AgeProfile = {
      status: "active",
      band,
      updatedAt: now,
      changeCount: current.changeCount + (previousBand === null ? 0 : 1),
      pendingBand: null,
      schemaVersion: PROFILE_SCHEMA_VERSION,
    };
    writeStorage(profile);
    emitAgeProfileChanged({
      type: "ageprofile:changed",
      kind: previousBand === null ? "set" : "change",
      band,
      previousBand,
      midSession: false,
    });
    return profile;
  }

  // Staged: applies at the next boundary, never re-renders the current card.
  const profile: AgeProfile = {
    status: "pending-change",
    band: previousBand ?? FULL_ACCESS_BAND,
    updatedAt: now,
    changeCount: current.changeCount,
    pendingBand: band,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
  writeStorage(profile);
  // No event yet: nothing effective changed. The event fires when the
  // boundary applies it (kind "change", midSession true).
  return profile;
}

/**
 * Apply a staged change at a card/round boundary. Safe to call on every
 * boundary: no-ops unless a live pending-change exists. Fires the change
 * event with midSession=true so subscribers flip tiles/config exactly
 * once per boundary.
 */
export function applyPendingAtBoundary(): AgeProfile {
  const current = loadProfile();
  if (current.status !== "pending-change" || current.pendingBand === null) return current;
  const profile: AgeProfile = {
    status: "active",
    band: current.pendingBand,
    updatedAt: new Date().toISOString(),
    changeCount: current.changeCount + 1,
    pendingBand: null,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
  writeStorage(profile);
  emitAgeProfileChanged({
    type: "ageprofile:changed",
    kind: "change",
    band: profile.band,
    previousBand: current.band,
    midSession: true,
  });
  return profile;
}

/** Parent changed their mind before the boundary: drop the staged change. */
export function cancelPending(): AgeProfile {
  const current = loadProfile();
  if (current.status !== "pending-change") return current;
  const profile: AgeProfile = { ...current, status: "active", pendingBand: null };
  writeStorage(profile);
  return profile;
}

/**
 * Reset: active → unset. Clears ONLY the profile — game progress is
 * untouched (COPPA: there is no account data to purge).
 */
export function resetProfile(): AgeProfile {
  const current = loadProfile();
  const previousBand = current.band;
  const profile = unsetProfile();
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Removal failure is non-fatal: the in-memory profile is unset and
    // the stale blob fails validation on the next load anyway... no —
    // a stale VALID blob would reload. Overwrite it with the unset
    // profile instead so a failed remove can't resurrect the band.
    writeStorage(profile);
  }
  memoryFallback = null;
  emitAgeProfileChanged({
    type: "ageprofile:changed",
    kind: "reset",
    band: null,
    previousBand,
    midSession: false,
  });
  return profile;
}

/**
 * The effective band for rendering/config. `pending-change` resolves to
 * the CURRENT band (the staged one applies only at the boundary);
 * `unset` resolves to the full-access default "11-13" (the profile only
 * ever *simplifies* on explicit parent intent).
 */
export function resolveBand(profile?: AgeProfile): AgeBandId {
  const p = profile ?? loadProfile();
  return p.band ?? FULL_ACCESS_BAND;
}

/** True while a change is staged but not yet applied at a boundary. */
export function hasPendingChange(profile?: AgeProfile): boolean {
  const p = profile ?? loadProfile();
  return p.status === "pending-change";
}

/** Exported for tests: reset the in-memory write-failure fallback. */
export function __resetMemoryFallback(): void {
  memoryFallback = null;
}
