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
    // "Keep full map", not "Not now": declining records a permanent manual
    // full choice (never re-prompts), so the label must not imply "later".
    decline: "Keep full map",
  },
  /**
   * Capability offer: shown when the boot probe or the low-memory signal
   * qualifies the device for Scout Map. The user chooses — struggle with
   * the full map, or take the lighter trail. Declining records an explicit
   * manual "full" choice (never decays, never re-prompts).
   */
  capabilityOffer: {
    probeBody:
      "This device may struggle with the full map's graphics. Want to try Scout Map, the lighter trail? Same game, same rounds.",
    lowMemoryBody:
      "This device doesn't have much memory, so the full map might freeze or lag. Want to try Scout Map, the lighter trail? Same game, same rounds.",
    accept: "Use Scout Map",
    decline: "Keep full map",
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
