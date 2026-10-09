/**
 * read-aloud-pref.ts — the kid-set read-aloud onboarding preference.
 *
 * Item C (B3): "Do you like stories read aloud? Always / Sometimes / Never."
 * The kid chooses ONCE during onboarding; the choice survives band changes.
 * Never gated behind a parent setting — read-aloud is the kid's tool.
 *
 * Owns localStorage key `meridian.readAloudPref.v1` (schemaVersion 1).
 * Works fully offline (device-local storage only).
 *
 * ## Migration story
 * - Key absent → preference is "unset" → onboarding asks exactly once.
 * - After the kid answers, the record exists → never re-asked ("asked once,
 *   never nags").
 * - Corrupt blob or wrong schemaVersion → fail-closed to "unset" (ask once).
 * - A legacy bare string value (pre-schema) is migrated into the v1 record.
 *
 * ## "Sometimes" semantics (documented per spec)
 * - "always"    → auto-narrate story cards when sound is on.
 * - "sometimes" → NEVER auto-read; the ghost speaker button is shown and the
 *                 kid taps it to play (tap-to-play).
 * - "never"     → NEVER auto-read; the button stays visible and tappable
 *                 anyway (never hide the kid's tool).
 * - "unset"     → today's band default: 5-7 auto, 8-10 / 11-13 tap-to-play.
 */

export const READ_ALOUD_PREF_KEY = "meridian.readAloudPref.v1";
const PREF_SCHEMA_VERSION = 1;

export type ReadAloudPref = "always" | "sometimes" | "never";
export type ReadAloudPrefOrUnset = ReadAloudPref | "unset";

interface StoredPref {
  schemaVersion: number;
  value: ReadAloudPref;
  updatedAt: string;
}

// --- Storage with memory fallback (mirrors store.ts; node/tests have no
// localStorage, and private-mode failures must never break the game). ---

let memoryFallback: StoredPref | null = null;

function readStorage(): StoredPref | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(READ_ALOUD_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Migrate a legacy bare-string value into the v1 record.
    if (typeof parsed === "string") {
      const migrated = validatePref({ schemaVersion: 1, value: parsed, updatedAt: "" });
      if (migrated) {
        writeStorage(migrated);
        return migrated;
      }
      return null;
    }
    return validatePref(parsed);
  } catch {
    return null; // corrupt → fail-closed to unset (ask once)
  }
}

function validatePref(input: unknown): StoredPref | null {
  if (!input || typeof input !== "object") return null;
  const v = input as Record<string, unknown>;
  if (v.schemaVersion !== PREF_SCHEMA_VERSION) return null;
  if (v.value !== "always" && v.value !== "sometimes" && v.value !== "never") return null;
  return {
    schemaVersion: PREF_SCHEMA_VERSION,
    value: v.value,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
  };
}

function writeStorage(pref: StoredPref): void {
  try {
    if (typeof localStorage === "undefined") throw new Error("no localStorage");
    localStorage.setItem(READ_ALOUD_PREF_KEY, JSON.stringify(pref));
    memoryFallback = null;
  } catch {
    memoryFallback = pref;
  }
}

/**
 * The kid's preference, or "unset" when they haven't answered (or the record
 * is corrupt/legacy). Absent → the onboarding asks exactly once.
 */
export function getReadAloudPref(): ReadAloudPrefOrUnset {
  const stored = readStorage() ?? memoryFallback;
  return stored ? stored.value : "unset";
}

/** True only when the kid has never answered — the "ask once" gate. */
export function shouldAskReadAloudPref(): boolean {
  return getReadAloudPref() === "unset";
}

/**
 * Persist the kid's answer. After this returns, shouldAskReadAloudPref()
 * is false forever (never re-ask, never nag).
 */
export function setReadAloudPref(value: ReadAloudPref): void {
  writeStorage({
    schemaVersion: PREF_SCHEMA_VERSION,
    value,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Auto-play decision for a story card.
 *
 * @param pref         the kid's preference ("unset" = band default)
 * @param bandAutoplay whether the band/card requests auto-play by default
 *                     (today: 5-7 cards only)
 * @param soundOn      isSoundEnabled() — "always" means "when sound is on"
 *
 * Owner 2026-10-09: "Always" is a promise — it plays on EVERY card in EVERY
 * band when sound is on. The mute toggle is the only off switch. The old
 * `bandAutoplay && soundOn` gating silently broke the promise for 8-10 and
 * 11-13 (their bandAutoplay is false).
 */
export function shouldAutoPlayReadAloud(
  pref: ReadAloudPrefOrUnset,
  bandAutoplay: boolean,
  soundOn: boolean,
): boolean {
  switch (pref) {
    case "never":
    case "sometimes":
      return false; // tap-to-play only; button stays visible
    case "always":
      return soundOn; // every card, every band — mute is the only silence
    case "unset":
      return bandAutoplay; // today's production behavior
  }
}

/** Test-only: drop the in-memory fallback so node tests start clean. */
export function __resetReadAloudPrefMemory(): void {
  memoryFallback = null;
}
