/**
 * Grandpa mascot — cursor-tracking sector math.
 *
 * Pure, DOM-free: maps a pointer offset (dx, dy in px, y down) to the
 * 3x3 directions-sheet cell. Extracted from page-mascot's mascot.tsx so
 * unit tests can walk the sector math without a browser.
 *
 * The sheet is row-major: up-left, up, up-right / left, center, right /
 * down-left, down, down-right.
 */

export type GrandpaDirection =
  | "up-left"
  | "up"
  | "up-right"
  | "left"
  | "center"
  | "right"
  | "down-left"
  | "down"
  | "down-right";

/** Row-major cell order on the 3x3 directions sheet. */
export const GRANDPA_DIRECTIONS: readonly GrandpaDirection[] = [
  "up-left",
  "up",
  "up-right",
  "left",
  "center",
  "right",
  "down-left",
  "down",
  "down-right",
];

/** Clockwise from the right, matching atan2 with y pointing down. */
const CLOCKWISE: readonly GrandpaDirection[] = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
];

export const DIRECTION_SECTOR = (Math.PI * 2) / CLOCKWISE.length;

/** Inside this radius (px) the pointer is "at" the figure — eyes forward. */
export const DIRECTION_DEAD_ZONE = 70;

/**
 * Which directions-sheet cell the pointer offset (dx, dy) falls into.
 * The dead zone maps to "center". No DOM, no side effects.
 */
export function directionForPointer(dx: number, dy: number): GrandpaDirection {
  if (Math.hypot(dx, dy) < DIRECTION_DEAD_ZONE) return "center";
  const angle = Math.atan2(dy, dx);
  const sector =
    (Math.round(angle / DIRECTION_SECTOR) + CLOCKWISE.length) %
    CLOCKWISE.length;
  return CLOCKWISE[sector]!;
}

/** Index of a direction in the row-major 3x3 sheet (for background-position). */
export function directionCellIndex(direction: GrandpaDirection): number {
  return GRANDPA_DIRECTIONS.indexOf(direction);
}
