/**
 * Child-facing copy for the satellite failure path (WS-4 Phase 1).
 * Wording is the owner's, approved 2026-10-14. Pure data module so the
 * node test harness can check it. Never name the imagery provider, and
 * never use the banned word "lite".
 */
export const TILE_FALLBACK_COPY = {
  /** Failure card body, shown while one "Try again" is still allowed. */
  failureBody:
    "The map pictures won't load right now. Check your internet, then tap Try again.",
  tryAgain: "Try again",
  /** Shown after the switch to Scout Map, at the next natural break. */
  switchNote: "We switched to Scout Map so you can keep playing.",
  /** GeoDetective: takes the map's place when the map pictures are off. */
  loopMapOff: "Map pictures are off for now. Your clues and guesses still work!",
} as const;
