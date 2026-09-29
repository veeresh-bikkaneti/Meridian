/** A second tap on the pin, inside this window, drops it. */
export const DOUBLE_TAP_MS = 350;

/** The second tap can miss the first by a fingertip and still count. */
export const DOUBLE_TAP_PX = 28;

export type ScreenTap = { x: number; y: number; t: number };

export function classifyTap(previous: ScreenTap | null, next: ScreenTap): "place" | "confirm" {
  if (!previous) return "place";
  const dt = next.t - previous.t;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  if (dt >= 0 && dt <= DOUBLE_TAP_MS && dx * dx + dy * dy <= DOUBLE_TAP_PX * DOUBLE_TAP_PX) {
    return "confirm";
  }
  return "place";
}
