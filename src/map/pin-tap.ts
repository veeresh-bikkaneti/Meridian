/**
 * Tap-window constants and the double-tap classifier for the gesture model.
 *
 * Locked model (user-directed, supersedes P0-02): a single tap places/moves
 * the pin — propose only, NEVER commit; double-tap/double-click COMMITS the
 * selection exactly like the Drop pin button (the second tap's point becomes
 * the pin location). This module answers "is this tap the second half of a
 * double-tap commit gesture?" so the caller can commit instead of proposing.
 */

/** Two taps this close in time may be one double-tap commit gesture. */
export const TAP_WINDOW_MS = 500;

/** Two taps this close in space may be one double-tap commit gesture. */
export const TAP_WINDOW_PX = 48;

/**
 * Touch taps land above the fingertip so the pin stays visible under it.
 * Faithful port of gesture.ts:3 (TOUCH_LIFT) via its aimPoint behavior:
 * the lift applies to the PLACEMENT coordinate (M3), not just the marker.
 */
export const TOUCH_LIFT_PX = 42;

export type ScreenTap = { x: number; y: number; t: number };

/** True when `next` continues `previous` as one double-tap commit gesture. */
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

/**
 * One endpoint of a pointer gesture (pointerdown or pointerup), in container
 * CSS pixels. Plain data — no DOM types — so the classifier stays
 * unit-testable in node.
 */
export type PointerTapEndpoint = {
  x: number;
  y: number;
  t: number;
  pointerId: number;
  button: number;
  isPrimary: boolean;
  pointerType: string;
};

/**
 * True when a pointerdown/pointerup pair is a tap: a primary button-0 press
 * by the same pointer, released within TAP_WINDOW_MS with at most
 * TAP_WINDOW_PX of movement.
 *
 * Multi-touch and pointercancel suppression are the caller's job (gesture
 * state, not a pure predicate): pointerup is NOT a compatibility event, so it
 * fires for both taps of a touch double-tap — which is why tap detection
 * lives on pointerup instead of click. Its pointerType is reliable per-event.
 */
export function isTap(down: PointerTapEndpoint, up: PointerTapEndpoint): boolean {
  if (down.pointerId !== up.pointerId) return false;
  if (!up.isPrimary || up.button !== 0) return false;
  const dt = up.t - down.t;
  if (dt < 0 || dt > TAP_WINDOW_MS) return false;
  const dx = up.x - down.x;
  const dy = up.y - down.y;
  return dx * dx + dy * dy <= TAP_WINDOW_PX * TAP_WINDOW_PX;
}
