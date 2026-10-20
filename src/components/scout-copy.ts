/**
 * Scout Map copy — verbatim strings from the Phase A UX package
 * (Game Designer copy + UI/UX Expert placements, reconciled 2026-10-08).
 *
 * Pure data module (no React, no CSS) so unit tests can import it under
 * the repo's node:test harness, mirroring celebration-copy.ts.
 *
 * Settled naming rule: "Scout Map" in user copy — never "lite".
 */

export const SCOUT_COPY = {
  // The boot-offer and capability-offer copy blocks are gone with the
  // dialog itself (owner ruling, 2026-10-20: weak devices auto-switch
  // silently — there is no boot dialog to carry copy anymore).
  /** Mid-game switch note (PBI-5): deferred to the next game-natural break. */
  switchNote:
    "Switched to Scout Map to keep the game running — your round is right where you left it.",
  /** Settings toggle (PBI-7). */
  toggle: {
    label: "Scout Map",
    explainer: "A lighter outline map. Same game, same rounds — easier on your phone.",
  },
  /**
   * Live-region announcements for the settings toggle. Flipping the
   * switch sends the player home (owner ruling, 2026-10-20 — the map is
   * built once per game, so a new mode can only take effect in a new
   * game); the announcement says so.
   */
  toggleAnnounceOn: "Scout Map on — back home; your next game uses Scout Map",
  toggleAnnounceOff: "Scout Map off — back home; your next game uses the full map",
} as const;
