import type { CharacterName } from "./characters";

/**
 * Celebration copy — "The Chart Room Crew" (spec §5).
 *
 * Pure data module (no React, no CSS) so unit tests can import it under the
 * repo's node:test harness, which cannot load .tsx/.css. The overlay
 * re-exports CELEBRATION_COPY for app consumers.
 *
 * Constraints (spec §5): headline ≤ 8 words, line ≤ 20 words, reading age ~10,
 * celebratory but calm. The wiring crew composes title/body/character from
 * these entries when it owns the celebration state.
 */

export type CelebrationVariant =
  | "difficulty-clear"
  | "mystery-solved"
  | "session-milestone"
  | "game-complete";

export type CelebrationMomentKey =
  | "difficulty-clear"
  | "streak-10"
  | "streak-25"
  | "streak-50"
  | "deck-complete"
  | "first-win"
  | "region-explored"
  | "bullseye";

export type CelebrationMoment = {
  /** ≤ 8 words. */
  headline: string;
  /** ≤ 20 words. */
  line: string;
  /** Which crew member delivers this moment. */
  character: CharacterName;
  /** The full delivered line, embedding the character's catchphrase. */
  greeting: string;
};

/** Canonical catchphrase per crew member (spec §5). */
export const CHARACTER_CATCHPHRASES: Record<CharacterName, string> = {
  nova: "Steady course, explorer!",
  blip: "Blip says bingo!",
  rusty: "Logged in the great atlas!",
  comet: "Zoom-zoom, way to go!",
};

export const CELEBRATION_COPY: Record<CelebrationMomentKey, CelebrationMoment> = {
  "difficulty-clear": {
    headline: "Easy mode: charted!",
    line: "Every explorer starts somewhere — you just finished your first voyage through Nebraska.",
    character: "nova",
    greeting: "Steady course, explorer! Try Medium next, or sail Easy once more.",
  },
  "streak-10": {
    headline: "Ten in a row — amazing!",
    line: "Ten wins back to back. Your map memory is getting super strong.",
    character: "blip",
    greeting: "Blip says bingo! Keep that compass spinning!",
  },
  "streak-25": {
    headline: "Twenty-five! Unstoppable explorer!",
    line: "A quarter hundred straight wins — real explorers are noticing you now.",
    character: "rusty",
    greeting: "Logged in the great atlas! Twenty-five voyages and counting.",
  },
  "streak-50": {
    headline: "Fifty streak! Legend status!",
    line: "Fifty correct guesses in a row. You've earned a place among the great navigators.",
    character: "nova",
    greeting: "Steady course, explorer — fifty victories strong. I salute you!",
  },
  "deck-complete": {
    headline: "Every mystery solved! Master detective!",
    line: "All 387 case files closed. The whole world had secrets — and you found every single one.",
    character: "rusty",
    greeting:
      "Logged in the great atlas, all 387! Blip says bingo! Steady course, explorer — zoom-zoom, way to go!",
  },
  "first-win": {
    headline: "Your first discovery!",
    line: "You found it! That's your very first pin on the great map — and it won't be the last.",
    character: "comet",
    greeting: "Zoom-zoom, way to go! First of many, little explorer!",
  },
  "region-explored": {
    headline: "Region fully explored!",
    line: "You've seen every corner of this region. The chart is complete because of you.",
    character: "blip",
    greeting: "Blip says bingo! The whole map is colored in!",
  },
  bullseye: {
    headline: "Bullseye!",
    line: "Right on the spot! That guess landed exactly where it should.",
    character: "nova",
    greeting: "Steady course, explorer — that was a perfect landing!",
  },
};

/**
 * Overlay variant → sfx.ts recipe name. `mystery-solved` is intentionally
 * null: playWin() already fired for the solve, and strong-sound beats stay
 * solo (spec §3 anti-annoyance rule 3).
 *
 * Stored as names (not references) so this module — and the overlay — type-
 * checks before the audio worker's recipes land in sfx.ts on this branch.
 */
export const CELEBRATION_SFX: Record<CelebrationVariant, string | null> = {
  "difficulty-clear": "playMediumApplause",
  "mystery-solved": null,
  "session-milestone": "playSmallCheer",
  "game-complete": "playGrandFanfare",
};

/** Small eyebrow label per overlay variant. */
export const CELEBRATION_VARIANT_LABEL: Record<CelebrationVariant, string> = {
  "difficulty-clear": "Difficulty cleared",
  "mystery-solved": "Case closed",
  "session-milestone": "Milestone",
  "game-complete": "Grand achievement",
};

/** Non-moment chrome strings for the overlay. */
export const CELEBRATION_CHROME = {
  dismissLabel: "Close celebration",
  headingId: "celebration-overlay-heading",
} as const;
