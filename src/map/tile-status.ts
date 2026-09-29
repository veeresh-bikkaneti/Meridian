/**
 * Tile-load status state machine for the satellite map.
 *
 * UI-review must-fix #2: the map had zero tile loading/failure UX — no
 * spinner, no error, no retry, no `map.on("error")`. 41/41 failed tiles
 * rendered a beige void with full game chrome, indistinguishable from a
 * working game. A dead connection must never look like a working game.
 *
 * This module is intentionally pure and DOM-free so the transition logic is
 * unit-testable in node. The React wiring (in `satellite-map.tsx`) maps
 * MapLibre events onto `TileEvent`s:
 *
 *   map.on("error")  -> { type: "tile-error" }   (tile/source fetch failures)
 *   map.on("load")   -> { type: "map-load" }     (style parsed; tiles in flight)
 *   map.on("idle")   -> { type: "map-idle" }     (first settled frame: verdict)
 *   watchdog timer   -> { type: "load-timeout" } (style never loaded: dead DNS, blocked host)
 *   Retry button     -> { type: "retry" }        (remount the map, try again)
 *
 * Key semantic: MapLibre "load" fires when the style is parsed but tiles may
 * still be in flight — "load" is NOT success. The verdict is the first
 * "idle": any tile error before it means the tile set failed and the state
 * becomes `failed`, never `ready`.
 *
 * Documented limitation (out of scope for this fix): tile errors that arrive
 * AFTER the first clean idle (mid-session degradation, e.g. panning onto new
 * tiles with a flaky connection) do not move the state — already-rendered
 * tiles stay on screen, so the game does not look dead. Only a failed initial
 * tile set triggers the error overlay.
 */

export type TileStatus =
  | { kind: "loading"; tileErrors: number }
  | { kind: "ready" }
  | { kind: "failed"; tileErrors: number };

export type TileEvent =
  | { type: "tile-error" }
  | { type: "map-load" }
  | { type: "map-idle" }
  | { type: "load-timeout" }
  | { type: "retry" };

export const INITIAL_TILE_STATUS: TileStatus = Object.freeze({
  kind: "loading",
  tileErrors: 0,
}) as TileStatus;

export function tileStatusReducer(
  state: TileStatus,
  event: TileEvent,
): TileStatus {
  switch (event.type) {
    case "tile-error":
      // Count failures while the initial tile set is still loading. After
      // `ready`, mid-session degradation is out of scope (see module doc) —
      // stay put.
      if (state.kind === "loading") {
        return { kind: "loading", tileErrors: state.tileErrors + 1 };
      }
      return state;

    case "map-load":
      // Style parsed, tiles in flight: not a verdict either way.
      return state;

    case "map-idle":
      // First settled frame is the verdict on the initial tile set.
      // ("idle" also fires after every later camera move; only the first one
      // matters because the state has left "loading" by then.)
      if (state.kind !== "loading") return state;
      return state.tileErrors > 0
        ? { kind: "failed", tileErrors: state.tileErrors }
        : { kind: "ready" };

    case "load-timeout":
      // The style itself never loaded (dead DNS / blocked host): no tiles
      // will ever arrive, so this is a failure, not a slow load.
      if (state.kind === "loading") {
        return { kind: "failed", tileErrors: state.tileErrors };
      }
      return state;

    case "retry":
      return INITIAL_TILE_STATUS;

    default:
      return state;
  }
}
