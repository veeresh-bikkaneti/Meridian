/**
 * Scout Map copy — verbatim strings from the Phase A UX package
 * (Game Designer copy + UI/UX Expert placements, reconciled 2026-10-08),
 * extended by the 2026-10-20 switching rulings and the pipeline
 * round-1 cures for Blocks B and C. This module stays the single home
 * for Scout copy: the popover, the announcements, and the home notices
 * all read from here so the words can never drift apart.
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
  /**
   * Home note for a boot that silently auto-switched to Scout
   * (Block C cure): the switch stays silent — no dialog, nothing
   * blocks — but it is not invisible. Shown once on Home for that
   * boot, dismissible, in the same notice slot as the idle note.
   */
  autoSwitchNote:
    "You're on Scout Map — the lighter map, picked for this device so the game runs well. You can change it with the map button on this page.",
  /** Settings toggle (PBI-7). */
  toggle: {
    label: "Scout Map",
    /**
     * In-game explainer. It used to promise "Same game, same rounds" —
     * continuity wording over an action that ends the game (Block B
     * cure). The consequence gets its own line now (warning, below);
     * this line just says what Scout Map is.
     */
    explainer: "A lighter outline map — easier on your phone.",
    /**
     * The game-ending warning, shown ABOVE the switch in the in-game
     * popover at the explainer's size (Block B cure): the player reads
     * the consequence before their finger reaches the control that
     * ends the game — not in fine print after it.
     */
    warning:
      "Switching sends you back home — this game ends here. Your next game uses the new map.",
    /**
     * Home explainer: the same control also lives on Home (Block C
     * cure), where there is no game to end — so the copy talks about
     * the next game instead, and there is no warning line.
     */
    homeExplainer:
      "A lighter outline map — easier on your phone. Your next game uses the map you pick here.",
  },
  /**
   * Live-region announcements for the settings toggle. Flipping the
   * switch sends the player home (owner ruling, 2026-10-20 — the map is
   * built once per game, so a new mode can only take effect in a new
   * game); the announcement says so. Hosted by GameApp's hoisted live
   * region, NOT by the toggle: the flip unmounts the toggle with Play
   * in the same commit, so a region inside it could never speak
   * (Block A cure).
   */
  toggleAnnounceOn: "Scout Map on — back home; your next game uses Scout Map",
  toggleAnnounceOff: "Scout Map off — back home; your next game uses the full map",
  /**
   * Announcements for a flip made from the Home control (Block C cure):
   * the player is already home, so these drop the "back home" clause.
   * Same hoisted GameApp live region as the announcements above.
   */
  homeAnnounceOn: "Scout Map on — your next game uses Scout Map",
  homeAnnounceOff: "Scout Map off — your next game uses the full map",
  /**
   * The visible notice on Home after a manual switch lands the player
   * there (Block B cure): the deliberate switch gets at least the
   * acknowledgement the accidental idle exit already had — and it says
   * the score was kept, because "this game ends here" could otherwise
   * read as "score lost" (it isn't: the session survives the switch).
   * Sibling of the toggleAnnounce* strings above — same facts, one
   * spoken (transient), one written (stays until dismissed).
   */
  switchedNoticeOn:
    "You switched to Scout Map — your next game uses Scout Map. Your score is kept.",
  switchedNoticeOff:
    "You switched to the full map — your next game uses the full map. Your score is kept.",
} as const;
