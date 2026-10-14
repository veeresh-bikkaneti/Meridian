/**
 * Satellite failure path, Phase 1 (WS-4). Pure: no React, no storage.
 *
 * One failed satellite load gets one "Try again". A failure after that
 * retry switches the map to Scout Map for this visit only. The switch is
 * never stored, so a reload starts over on the full map. Spec:
 * docs/ops/specs/ws-4-satellite-failure-phase1.md
 */

/** How many "Try again" taps a visit allows before the switch. */
export const TILE_RETRY_LIMIT = 1;

export type TileFallbackAction = "none" | "show-try-again" | "switch-to-scout";

export function nextTileFallbackAction(input: {
  verdict: "ready" | "failed";
  retriesUsed: number;
}): TileFallbackAction {
  if (input.verdict !== "failed") return "none";
  return input.retriesUsed < TILE_RETRY_LIMIT ? "show-try-again" : "switch-to-scout";
}
