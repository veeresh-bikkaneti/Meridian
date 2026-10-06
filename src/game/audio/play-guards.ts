import {
  playGrandFanfare,
  playMediumApplause,
  playNextPlace,
  playPinDropFail,
  playPinDropPass,
  playSmallCheer,
  playToastChime,
} from "./sfx.ts";

/**
 * Anti-annoyance guards for celebration/UI sounds (celebration spec §3).
 *
 * Centralizes the rules every wiring call site must honor so no single
 * screen can forget one:
 * - Rule 6: no sound while the tab is hidden (sound is enhancement-only;
 *   with the visual unseen it would become the sole signal).
 * - Rule 2: never two small cheers within 5 s.
 * - Rule 1: max one grand-tier celebration per 60 s; cooling down drops to
 *   medium applause instead of going silent.
 * - Rule 4: a reject tick may not repeat within 500 ms.
 *
 * All entry points are try/catch-guarded: sound must never throw into game
 * flow. The sfx.ts recipes are guarded too; this module guards the wiring
 * side (spec: "your wiring code must not throw either").
 *
 * Timing state is module-level (one tab = one set of ears). The `now`
 * parameters default to Date.now() and exist so unit tests can drive the
 * windows deterministically.
 */

export type CelebrationSoundKind =
  | "smallCheer"
  | "mediumApplause"
  | "grandFanfare"
  | "toastChime"
  | "nextPlace"
  | "pinDropPass"
  | "pinDropFail";

/** Spec §3 rule 2: small-cheer spacing (ms). */
export const SMALL_CHEER_SPACING_MS = 5000;
/** Spec §3 rule 1: grand-tier cooldown (ms). */
export const GRAND_COOLDOWN_MS = 60000;
/** Spec §3 rule 4: reject-tick suppression (ms). */
export const REJECT_TICK_SUPPRESS_MS = 500;

let lastSmallCheerAt = -Infinity;
let lastGrandAt = -Infinity;
let lastRejectTickAt = -Infinity;

/** Test seam: reset the module's timing state. */
export function resetPlayGuards(): void {
  lastSmallCheerAt = -Infinity;
  lastGrandAt = -Infinity;
  lastRejectTickAt = -Infinity;
}

/**
 * Spec §3 rule 6: sounds are enhancement-only, so they never fire while the
 * tab is hidden. SSR-safe (no window → audible).
 */
export function soundAudible(): boolean {
  try {
    return typeof document === "undefined" || !document.hidden;
  } catch {
    return true;
  }
}

/** Run a sound function without ever throwing into the caller. */
export function safePlay(fn: () => void): void {
  try {
    fn();
  } catch {
    // Sound is enhancement-only; the game plays on.
  }
}

/**
 * Claim the small-cheer slot (spec §3 rule 2). Returns true when the cheer
 * may fire — never two within 5 s.
 */
export function claimSmallCheer(now: number = Date.now()): boolean {
  if (now - lastSmallCheerAt < SMALL_CHEER_SPACING_MS) return false;
  lastSmallCheerAt = now;
  return true;
}

/**
 * Claim the grand-tier slot (spec §3 rule 1). Returns true when the
 * fanfare may fire — max one per 60 s.
 */
export function claimGrand(now: number = Date.now()): boolean {
  if (now - lastGrandAt < GRAND_COOLDOWN_MS) return false;
  lastGrandAt = now;
  return true;
}

/**
 * Claim the reject-tick slot (spec §3 rule 4). Returns true when the tick
 * may fire — suppressed when the same rejection sounded < 500 ms ago.
 */
export function claimRejectTick(now: number = Date.now()): boolean {
  if (now - lastRejectTickAt < REJECT_TICK_SUPPRESS_MS) return false;
  lastRejectTickAt = now;
  return true;
}

/**
 * Fire-and-forget celebration/UI sound with every spec §3 anti-annoyance
 * rule applied: hidden-tab suppression, throw-safety, cheer spacing,
 * grand cooldown (drops to medium applause while cooling down), and
 * reject-tick suppression.
 */
export function playCelebrationSound(kind: CelebrationSoundKind): void {
  if (!soundAudible()) return;
  switch (kind) {
    case "smallCheer":
      if (!claimSmallCheer()) return;
      safePlay(playSmallCheer);
      return;
    case "grandFanfare":
      // Rule 1: cooling down drops to medium, never to silence.
      if (!claimGrand()) {
        safePlay(playMediumApplause);
        return;
      }
      safePlay(playGrandFanfare);
      return;
    case "pinDropFail":
      if (!claimRejectTick()) return;
      safePlay(playPinDropFail);
      return;
    case "mediumApplause":
      safePlay(playMediumApplause);
      return;
    case "toastChime":
      safePlay(playToastChime);
      return;
    case "nextPlace":
      safePlay(playNextPlace);
      return;
    case "pinDropPass":
      safePlay(playPinDropPass);
      return;
  }
}
