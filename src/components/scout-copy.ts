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
  /** Boot offer (PBI-6): shown when the previous session crashed with the map mounted. */
  bootOffer: {
    body: "The full map crashed on your last visit — want to try Scout Map, the lighter trail?",
    accept: "Use Scout Map",
    decline: "Not now",
  },
  /** Mid-game switch note (PBI-5): deferred to the next game-natural break. */
  switchNote:
    "Switched to Scout Map to keep the game running — your round is right where you left it.",
  /** Settings toggle (PBI-7). */
  toggle: {
    label: "Scout Map",
    explainer: "A lighter outline map. Same game, same rounds — easier on your phone.",
  },
  /** Live-region announcements for the settings toggle (PBI-7). */
  toggleAnnounceOn: "Scout Map on — applies from the next place",
  toggleAnnounceOff: "Scout Map off — applies from the next place",
} as const;
