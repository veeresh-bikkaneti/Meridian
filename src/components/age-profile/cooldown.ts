/**
 * age-profile/cooldown.ts — localStorage persistence for the grown-up gate cooldown.
 *
 * The GrownUpGate's 60s cooldown survives unmount/remount via ONE
 * timestamp (epoch ms) under `meridian.grownupCooldown.v1`. Zero PII —
 * the timestamp is not personal data (COPPA-safe).
 *
 * Lifecycle contract (verified by cooldown.test.ts):
 * - writeCooldown: called when the cooldown starts (3 failed attempts).
 * - readCooldown: returns the deadline when it is still in the future;
 *   an expired/absent/malformed value is DELETED and returns null, so a
 *   stale key can never resurrect after a pass.
 * - clearCooldown: called when the cooldown ends (first tick at <=0), so
 *   expiry leaves no key behind.
 *
 * The gate component's tick effect derives the live countdown from the
 * deadline, so hydrating via readCooldown() reuses that exact path: a
 * stale timestamp self-resolves on the first tick (no stuck state).
 */

export const GROWNUP_COOLDOWN_KEY = "meridian.grownupCooldown.v1";

/** Persist the cooldown deadline (epoch ms). Best-effort: localStorage may be unavailable. */
export function writeCooldown(until: number): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(GROWNUP_COOLDOWN_KEY, String(until));
  } catch {
    // Private mode / quota: the cooldown just won't survive remount.
  }
}

/**
 * Read the stored cooldown deadline. Returns the epoch ms when it is
 * still in the future; anything else is cleared and returns null —
 * never resurrects an expired cooldown.
 */
export function readCooldown(now: number = Date.now()): number | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(GROWNUP_COOLDOWN_KEY);
    if (raw === null) return null;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= now) {
      localStorage.removeItem(GROWNUP_COOLDOWN_KEY);
      return null;
    }
    return until;
  } catch {
    return null;
  }
}

/** Delete the stored deadline (cooldown over — expiry leaves no key behind). */
export function clearCooldown(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(GROWNUP_COOLDOWN_KEY);
  } catch {
    // Non-fatal: a stale key self-resolves via readCooldown on next mount.
  }
}
