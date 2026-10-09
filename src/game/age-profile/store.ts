/**
 * age-profile/store.ts — the SOLE owner of the age-profile storage.
 *
 * Owns localStorage key `meridian.ageProfile.v1` (schemaVersion 1) and the
 * lifecycle state machine (Phase 1 §4; follow-up Item B simplified it to
 * two states):
 *
 *   unset --set(band)--> active                        (first setup)
 *   active --saveBand(b)--> active                      (save writes the new
 *                                              band IMMEDIATELY)
 *   active --reset()--> unset                          (band=null; game progress untouched)
 *
 * Follow-up Item B (owner decision 2026-10-09) DELETED the persisted
 * pending-change state machine entirely: no pendingBand, no timeout, no
 * staging. A mid-run save writes the new band immediately (status stays
 * "active"), but the change EVENT is deferred in memory (deferredBand) so
 * subscribers flip tiles/config at the next card/round boundary — never a
 * mid-run re-render. The snapshot in run state (see run-config.ts) makes
 * the deferral structural: a live run keeps its deal-time config either way.
 *
 * Invariants: a save to the same band is a no-op; corrupted JSON → unset
 * (full-access default — never strand a child in a locked-down state).
 *
 * Game screens must NOT import this module directly — use the facade in
 * index.ts (resolveBand / onAgeProfileChanged).
 */

import type { AgeBandId, AgeProfile, ProfileStatus } from "./types.ts";
import { FULL_ACCESS_BAND, AGE_BAND_IDS } from "./bands.ts";
import { emitAgeProfileChanged } from "./events.ts";

export const PROFILE_STORAGE_KEY = "meridian.ageProfile.v1";
export const PROFILE_SCHEMA_VERSION = 1;

const unsetProfile = (): AgeProfile => ({
  status: "unset",
  band: null,
  updatedAt: new Date().toISOString(),
  changeCount: 0,
  schemaVersion: PROFILE_SCHEMA_VERSION,
});

function isAgeBandId(value: unknown): value is AgeBandId {
  return typeof value === "string" && (AGE_BAND_IDS as string[]).includes(value);
}

/**
 * Runtime validation of a stored blob. Returns a valid profile, or null
 * when the blob is corrupt/wrong-version/wrong-shape. Corrupt → treated as
 * unset by loadProfile (fail-closed to full access).
 *
 * Migration: blobs written by the pre-Item-B store may carry status
 * "pending-change" (or a stray pendingBand). They normalize to active
 * with their current band — the staged change simply applies.
 */
export function validateProfile(blob: unknown): AgeProfile | null {
  if (typeof blob !== "object" || blob === null) return null;
  const b = blob as Record<string, unknown>;
  if (b.schemaVersion !== PROFILE_SCHEMA_VERSION) return null;
  let status = b.status;
  // Legacy staging state (Item B): a staged-but-unapplied change applies now.
  if (status === "pending-change") status = "active";
  if (status !== "unset" && status !== "active") return null;
  const band = b.band;
  if (!(band === null || isAgeBandId(band))) return null;
  if (typeof b.updatedAt !== "string" || Number.isNaN(Date.parse(b.updatedAt))) return null;
  if (typeof b.changeCount !== "number" || !Number.isInteger(b.changeCount) || b.changeCount < 0)
    return null;
  // Structural invariants (Phase 1 §4).
  if (status === "unset" && band !== null) return null;
  if (status === "active" && band === null) return null;
  return {
    status: status as ProfileStatus,
    band,
    updatedAt: b.updatedAt as string,
    changeCount: b.changeCount as number,
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

/** Load the profile, runtime-validated. Corrupt/wrong-version storage → the unset default. */
export function loadProfile(): AgeProfile {
  return readStorage() ?? memoryFallback ?? unsetProfile();
}

/**
 * A band change saved while a run/card is in progress defers only the
 * change EVENT — in memory, never persisted. The boundary hook
 * (applyPendingAtBoundary) fires it at the next card/round boundary.
 */
let deferred: { band: AgeBandId; previousBand: AgeBandId | null } | null = null;

/** First setup: unset → active. No confirm (nothing to lose; undo is one tap away). */
export function setBand(band: AgeBandId): AgeProfile {
  const profile: AgeProfile = {
    status: "active",
    band,
    updatedAt: new Date().toISOString(),
    changeCount: 0,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
  writeStorage(profile);
  deferred = null;
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
 * Save a band change (parent gate already passed). The save writes the
 * new band IMMEDIATELY (status → active) — there is no staging.
 *
 * - Same band → no-op (returns the current profile, no event).
 * - No run in progress → the change event fires immediately.
 * - Run in progress → the change event is deferred in memory and fires at
 *   the next card/round boundary via applyPendingAtBoundary(), so a live
 *   run never re-renders. (The run's own config snapshot makes the
 *   deferral structural — a mid-run save cannot warp the live run.)
 */
export function saveBand(band: AgeBandId, opts: { runInProgress: boolean }): AgeProfile {
  const current = loadProfile();
  const previousBand: AgeBandId | null = current.band;
  if (previousBand === band) return current;
  const now = new Date().toISOString();
  const profile: AgeProfile = {
    status: "active",
    band,
    updatedAt: now,
    changeCount: current.changeCount + (previousBand === null ? 0 : 1),
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
  writeStorage(profile);
  if (opts.runInProgress) {
    // Latest save wins; nothing effective is re-rendered until the boundary.
    deferred = { band, previousBand };
  } else {
    deferred = null;
    emitAgeProfileChanged({
      type: "ageprofile:changed",
      kind: previousBand === null ? "set" : "change",
      band,
      previousBand,
      midSession: false,
    });
  }
  return profile;
}

/**
 * Apply a deferred mid-run save at a card/round boundary. Safe to call on
 * every boundary: no-ops unless a save is deferred. Fires the change
 * event with midSession=true so subscribers flip tiles/config exactly
 * once per boundary.
 */
export function applyPendingAtBoundary(): AgeProfile {
  const current = loadProfile();
  if (deferred === null) return current;
  const { band, previousBand } = deferred;
  deferred = null;
  emitAgeProfileChanged({
    type: "ageprofile:changed",
    kind: previousBand === null ? "set" : "change",
    band,
    previousBand,
    midSession: true,
  });
  return current;
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
  deferred = null;
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
 * The effective band for rendering/config. `unset` resolves to the
 * full-access default "11-13" (the profile only ever *simplifies* on
 * explicit parent intent).
 */
export function resolveBand(profile?: AgeProfile): AgeBandId {
  const p = profile ?? loadProfile();
  return p.band ?? FULL_ACCESS_BAND;
}

/**
 * True while a mid-run save is deferred but its boundary event has not
 * fired yet.
 *
 * Compat shim for game-app.tsx's footer chip — the chip itself is slated
 * for deletion with the rest of the pending UI; until then it stays dark
 * correctly because deferred state is in-memory only.
 */
export function hasPendingChange(_profile?: AgeProfile): boolean {
  return deferred !== null;
}

/** Exported for tests: reset the in-memory write-failure fallback + deferred state. */
export function __resetMemoryFallback(): void {
  memoryFallback = null;
  deferred = null;
}
