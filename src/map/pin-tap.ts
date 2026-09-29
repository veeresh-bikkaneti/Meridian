/**
 * Tap-window constants and the double-tap classifier for the P0-02 gesture model.
 *
 * Locked model: a single tap places/moves the pin and NEVER confirms; the Drop
 * pin button is the only commit path; double-tap/double-click is zoom ONLY.
 * The old `classifyTap` "confirm" return was the accidental-commit hazard and is
 * deleted. This module only answers "is this tap the second half of a zoom
 * gesture?" so the caller can revert the first tap's placement (M1).
 */

/** Two taps this close in time may be one double-tap zoom gesture. */
export const TAP_WINDOW_MS = 500;

/** Two taps this close in space may be one double-tap zoom gesture. */
export const TAP_WINDOW_PX = 48;

/**
 * Touch taps land above the fingertip so the pin stays visible under it.
 * Faithful port of gesture.ts:3 (TOUCH_LIFT) via its aimPoint behavior:
 * the lift applies to the PLACEMENT coordinate (M3), not just the marker.
 */
export const TOUCH_LIFT_PX = 42;

export type ScreenTap = { x: number; y: number; t: number };

/** True when `next` continues `previous` as one double-tap zoom gesture. */
export function isDoubleTap(previous: ScreenTap | null, next: ScreenTap): boolean {
  if (!previous) return false;
  const dt = next.t - previous.t;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  return (
    dt >= 0 &&
    dt <= TAP_WINDOW_MS &&
    dx * dx + dy * dy <= TAP_WINDOW_PX * TAP_WINDOW_PX
  );
}
