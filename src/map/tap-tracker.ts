import { isDoubleTap, type ScreenTap } from "./pin-tap.ts";

/**
 * A tap proposes a pin location; a double-tap commits it (drops the pin).
 */
export type TapKind = "tap" | "double-tap";

/**
 * Stateful pair-consumption so a triple-tap classifies as tap, double-tap, tap —
 * the double-tap consumes its pair and can never double-commit.
 */
export function createTapTracker() {
  let previous: ScreenTap | null = null;
  return {
    register(next: ScreenTap): TapKind {
      const prev = previous;
      if (prev && isDoubleTap(prev, next)) {
        previous = null;
        return "double-tap";
      }
      previous = next;
      return "tap";
    },
    reset() {
      previous = null;
    },
  };
}
