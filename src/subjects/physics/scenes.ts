/**
 * Physics clue scenes — one scene description per item, in
 * data, next to the answers in answers.ts (the math and
 * general-knowledge scenes.ts pattern). The renderer
 * (src/subjects/shared/ClueScene.tsx) reads these; a later item
 * needs only a new description here, never new code.
 *
 * Answer-blindness is structural, as in math: a description
 * carries only the givens from the item's own question. The
 * renderer receives a description and a phase ("setup" |
 * "solved") — never the answer, a choice, or a pick — so the
 * setup film can only set the scene. Where a kind's solved beat
 * needs the outcome's size (how far a shoved cup slides), the
 * description carries it as spatial layout that the renderer
 * spends only in the solved phase: the setup film shows no
 * slide, no movement and no winner at all.
 *
 * Each description also carries its SUMMARY: the narrated
 * walk-through of the solving (act 3), played only after a
 * correct pick. The script lines are word-for-word the captions;
 * the clip timings were measured when the clips were rendered
 * (public/audio/subjects/manifest.json carries the same
 * numbers). The summary sits in the solved-phase data path only.
 *
 * Coverage (expansion wave 4): the seven forces-and-motion
 * items for ages 7-10 — five new kinds (push-duel, tile-steps,
 * slide-stop, cup-shove, seesaw-lift), with tile-steps shared
 * by the two counting/racing items and push-duel shared by the
 * two opposed-push items. The other five ages 7-10 items
 * (magnet, drop, energy, shadow, mirror) belong to wave 5 and
 * carry no descriptions yet; other bands carry none either.
 */
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

export type { ClueSceneDescription };
export {
  countingTicks,
  dealOrder,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "../shared/clue-scene-types.ts";

export const PHYSICS_CLUE_SCENES: Record<string, ClueSceneDescription> = {
  "physics:push:which-way": {
    kind: "push-duel",
    leftPower: 2,
    rightPower: 1,
    labelSetup: "Two friends push a box from opposite sides.",
    labelSolved: "The box slides toward the stronger push.",
    summary: {
      clip: "which-way.mp3",
      duration: 16.96,
      lines: [
        { text: "Here is the clever way to see which push wins.", at: 0 },
        { text: "Ana pushes the box toward the right, and Ben pushes it toward the left.", at: 3.16 },
        { text: "Ana's push is stronger, so her push wins the fight.", at: 8.1 },
        { text: "When pushes fight, the stronger push wins: the box moves Ana's way, to the right!", at: 11.66 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:push:equal-pushes": {
    kind: "tile-steps",
    tilesPerStep: 2,
    hops: 4,
    labelSetup: "A box waits at the start of a tiled track.",
    labelSolved: "The box hops along the tiles, push by push.",
    summary: {
      clip: "equal-pushes.mp3",
      duration: 12.83,
      lines: [
        { text: "Here is the clever way to count the pushes.", at: 0 },
        { text: "Each push moves the box two tiles, so count in twos.", at: 2.93 },
        { text: "2, 4.", at: 6.99 },
        { text: "6, 8.", at: 8.35 },
        { text: "Four pushes of two tiles cover 8 tiles in all!", at: 9.75 },
      ],
      beats: [0, 0, 2, 2, 0],
    },
  },
  "physics:friction:measure-slide": {
    kind: "slide-stop",
    slideTiles: 5,
    labelSetup: "A crate waits on a floor, with a mark ahead of it.",
    labelSolved: "The crate slides and settles by the mark.",
    summary: {
      clip: "measure-slide.mp3",
      duration: 16.78,
      lines: [
        { text: "Here is the clever way to tell where the crate stops.", at: 0 },
        { text: "Give the crate the same push on the same floor.", at: 3.53 },
        { text: "The floor grips the crate the same way, so it slides the same distance.", at: 6.61 },
        { text: "The same push on the same floor meets the same grip, so the crate stops at the same mark!", at: 11.43 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:ramp:faster-hits-harder": {
    kind: "cup-shove",
    slowSlide: 26,
    fastSlide: 54,
    labelSetup: "Two balls wait beside a cup on the floor.",
    labelSolved: "Each ball rolls in and shoves the cup.",
    summary: {
      clip: "faster-hits-harder.mp3",
      duration: 18.47,
      lines: [
        { text: "Here is the clever way to tell which hit shoves harder.", at: 0 },
        { text: "The slower ball rolls in and shoves the cup a little way.", at: 3.4 },
        { text: "The faster ball rolls in and shoves the cup much farther.", at: 7.45 },
        { text: "The faster ball carries more motion, so it shoves the cup farther: the cup slides farther after the faster ball!", at: 11.48 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:arrive:equal-steps": {
    kind: "tile-steps",
    tilesPerStep: 3,
    hops: 3,
    rivalTilesPerStep: 1,
    labelSetup: "Two carts wait at the start of a tiled track.",
    labelSolved: "The carts hop along the tiles, step by step.",
    summary: {
      clip: "equal-steps.mp3",
      duration: 18.7,
      lines: [
        { text: "Here is the clever way to see which cart wins the race.", at: 0 },
        { text: "One cart moves three tiles each step, and the other moves one tile each step.", at: 3.77 },
        { text: "Step by step, the three-tile cart pulls ahead.", at: 9.12 },
        { text: "Three tiles each step beats one tile each step: the bigger-step cart reaches the line first!", at: 12.61 },
      ],
      beats: [0, 0, 2, 1],
    },
  },
  "physics:lever:seesaw": {
    kind: "seesaw-lift",
    labelSetup: "A board rests level over a log, with a box at one end.",
    labelSolved: "One end dips and the far end rises with the box.",
    summary: {
      clip: "seesaw.mp3",
      duration: 15.64,
      lines: [
        { text: "Here is the clever way a board over a log lifts.", at: 0 },
        { text: "Push one end of the board down toward the ground.", at: 3.69 },
        { text: "The board tips over the log, and the far end rises.", at: 7.08 },
        { text: "Pushing one end of the board down lifts the other end up, and lifts the box with it!", at: 10.92 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:balance:tug": {
    kind: "push-duel",
    leftPower: 1,
    rightPower: 1,
    labelSetup: "Two friends push a stuck gate from opposite sides.",
    labelSolved: "The gate strains but does not move.",
    summary: {
      clip: "tug.mp3",
      duration: 14.69,
      lines: [
        { text: "Here is the clever way to tell if the gate moves.", at: 0 },
        { text: "Ana and Ben push the gate from opposite sides.", at: 3.43 },
        { text: "Their pushes match exactly, so neither side can win.", at: 6.76 },
        { text: "Pushes that match exactly cancel out, so the gate stays still!", at: 10.72 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return PHYSICS_CLUE_SCENES[itemId] ?? null;
}
