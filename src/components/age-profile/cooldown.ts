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

// --- Failed-attempt strikes (review finding P2-10, 2026-10-21) ---------
//
// WHY: the 3-strike counter used to live only in component state, so a
// child could press × after two wrong answers, reopen the gate, and get a
// fresh three tries forever — the cooldown never triggered. Strikes now
// persist (one small {n, at} record, zero PII) and expire after
// STRIKE_WINDOW_MS of no further failures, so a grown-up who fumbled once
// last week is not penalised today.

export const GROWNUP_STRIKES_KEY = "meridian.grownupStrikes.v1";
export const STRIKE_WINDOW_MS = 15 * 60_000;

/** Failed attempts still counting toward the cooldown (0 when none/expired). */
export function readStrikes(now: number = Date.now()): number {
  try {
    if (typeof localStorage === "undefined") return 0;
    const raw = localStorage.getItem(GROWNUP_STRIKES_KEY);
    if (raw === null) return 0;
    const parsed = JSON.parse(raw) as { n?: unknown; at?: unknown };
    const n = typeof parsed.n === "number" && Number.isInteger(parsed.n) && parsed.n > 0 ? parsed.n : 0;
    const at = typeof parsed.at === "number" && Number.isFinite(parsed.at) ? parsed.at : 0;
    if (n === 0 || now - at > STRIKE_WINDOW_MS || at > now + 60_000) {
      localStorage.removeItem(GROWNUP_STRIKES_KEY);
      return 0;
    }
    return n;
  } catch {
    return 0;
  }
}

/** Persist the current strike count (best-effort). */
export function writeStrikes(n: number, now: number = Date.now()): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(GROWNUP_STRIKES_KEY, JSON.stringify({ n, at: now }));
  } catch {
    // Private mode / quota: strikes just won't survive a remount.
  }
}

/** Forget strikes (on a pass, or when the cooldown takes over). */
export function clearStrikes(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(GROWNUP_STRIKES_KEY);
  } catch {
    // best-effort
  }
}
