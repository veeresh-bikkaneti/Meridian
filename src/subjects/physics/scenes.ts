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
 * Coverage (expansion waves 4-6): all 24 physics items —
 * wave 4's seven ages 7-10 forces-and-motion items (five kinds:
 * push-duel, tile-steps, slide-stop, cup-shove, seesaw-lift,
 * with tile-steps shared by the two counting/racing items and
 * push-duel shared by the two opposed-push items), wave 5's
 * five ages 7-10 energy, light and magnet items (four new
 * kinds: magnet-pair, drop-fall, wind-up, light-path, with
 * light-path shared by the blocking-card item and the mirror
 * item — the card is the kind's own data, not a second kind),
 * and wave 6's twelve upper-band items: nine for ages 10-18
 * and three for ages 18+ (six new kinds: rate-race, slope-pair,
 * same-push, hill-carts, sound-path, energy-ledger; magnet-pair
 * reused as a two-pair variant, cup-shove as a ball-stops-dead
 * variant, light-path with three-materials data, and math's
 * journey-line shared for the adult time item — its known
 * stretch is the speed itself, 4 kilometres in 1 hour, marked
 * along the 12-kilometre road). Physics is complete: 24 of 24.
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
  "physics:magnet:flip": {
    kind: "magnet-pair",
    labelSetup: "Two magnets hold a cabinet shut, pulled together.",
    labelSolved: "One magnet turns, and the pair springs apart.",
    summary: {
      clip: "magnet-flip.mp3",
      duration: 16.65,
      lines: [
        { text: "Here is the clever way magnets turn on each other.", at: 0 },
        { text: "Turn one magnet around, so the faces that meet have changed.", at: 3.27 },
        { text: "Faces that pulled before now push, and the pair springs apart.", at: 7.62 },
        { text: "Turning one magnet around swaps pull for push — the pair now pushes apart.", at: 11.97 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:drop:down": {
    kind: "drop-fall",
    labelSetup: "A ball rests on a shelf above a bucket.",
    labelSolved: "The ball falls into the bucket below.",
    summary: {
      clip: "drop-down.mp3",
      duration: 14.69,
      lines: [
        { text: "Here is the clever way to see where the ball goes.", at: 0 },
        { text: "You let go of the ball, and it drops from the shelf.", at: 3.36 },
        { text: "It falls straight down, right into the bucket below.", at: 6.8 },
        { text: "Once nothing holds the ball up, it falls straight down into the bucket.", at: 10.5 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:energy:wound-moves": {
    kind: "wind-up",
    labelSetup: "Two toy cars rest on a mat, one with a key.",
    labelSolved: "The key turns, and one car rolls across the mat.",
    summary: {
      clip: "wound-moves.mp3",
      duration: 16.6,
      lines: [
        { text: "Here is the clever way to tell which car moves.", at: 0 },
        { text: "The key on the wound car turns, spending its winding.", at: 3.27 },
        { text: "The wound car rolls across the mat, and the other car stays still.", at: 7.05 },
        { text: "The wound-up car has stored energy to spend, so it is the one that moves.", at: 11.54 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:shadow:blocks": {
    kind: "light-path",
    withCard: true,
    labelSetup: "A lamp, a book and an eye, with a card waiting at the side.",
    labelSolved: "The card slides in, and the light stops at it.",
    summary: {
      clip: "shadow-blocks.mp3",
      duration: 16.74,
      lines: [
        { text: "Here is the clever way to see why the book vanishes.", at: 0 },
        { text: "Light runs from the lamp to the book, and on toward your eye.", at: 3.54 },
        { text: "The cardboard slides in, and the rays stop at the card.", at: 7.62 },
        { text: "You see the book only when its light reaches your eye — the cardboard blocks that light.", at: 11.7 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:mirror:sends-back": {
    kind: "light-path",
    withCard: false,
    labelSetup: "A lamp lights a book on a shelf, near an eye.",
    labelSolved: "Light bounces off the book into the eye.",
    summary: {
      clip: "sends-back.mp3",
      duration: 13.91,
      lines: [
        { text: "Here is the clever way you see the book.", at: 0 },
        { text: "Light from the lamp shines onto the book on the shelf.", at: 2.73 },
        { text: "The book bounces the light back, into your eye.", at: 5.89 },
        { text: "Light from the lamp bounces off the book and into your eye — that is how you see it.", at: 9.09 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:arrive:unit-rate": {
    kind: "rate-race",
    firstMetres: 8,
    firstSeconds: 2,
    secondMetres: 9,
    secondSeconds: 3,
    labelSetup: "Two carts wait at the start of a track to a bridge.",
    labelSolved: "Per-second ticks mark each cart's run to the bridge.",
    summary: {
      clip: "cart-race.mp3",
      duration: 23.32,
      lines: [
        { text: "Here is the clever way to see which cart arrives first.", at: 0 },
        { text: "Count what each cart covers in one second: the first cart covers 8 metres in 2 seconds, so 4 metres each second.", at: 3.62 },
        { text: "The second cart covers 9 metres in 3 seconds, so 3 metres each second.", at: 12.07 },
        { text: "Four metres each second beats three, so the 8 metres in 2 seconds cart arrives first!", at: 17.57 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:ramp:slope-ratio": {
    kind: "slope-pair",
    firstRise: 2,
    firstRun: 4,
    secondRise: 2,
    secondRun: 2,
    labelSetup: "Two ramps stand on a rise and run grid.",
    labelSolved: "Both slope lines are drawn, and the steeper one stands out.",
    summary: {
      clip: "slope-ratio.mp3",
      duration: 20.61,
      lines: [
        { text: "Here is the clever way to tell which ramp is steeper.", at: 0 },
        { text: "Steepness is the rise divided by the run, so draw each ramp's slope line on its grid.", at: 3.36 },
        { text: "Ramp A climbs 2 over a run of 4, which is one half; ramp B climbs 2 over a run of 2, which is one whole.", at: 9.66 },
        { text: "One whole beats one half, so Ramp B is steeper!", at: 17.52 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:magnet:closer": {
    kind: "magnet-pair",
    twoPairs: true,
    labelSetup: "Two pairs of magnets rest at different gaps.",
    labelSolved: "The closer pair snaps together, and the farther pair barely stirs.",
    summary: {
      clip: "magnet-closer.mp3",
      duration: 20.46,
      lines: [
        { text: "Here is the clever way to tell which magnet pair pulls harder.", at: 0 },
        { text: "Look at the two pairs: one pair sits close together, and the other pair sits farther apart.", at: 4.19 },
        { text: "The closer pair snaps together hard, while the farther pair only tugs weakly.", at: 10.28 },
        { text: "Magnets pull harder when they sit closer together, so the closer pair pulls harder!", at: 15.53 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:push:mass": {
    kind: "same-push",
    leftBoxes: 0,
    rightBoxes: 3,
    leftForce: 2,
    rightForce: 2,
    labelSetup: "Two carts wait, one stacked with boxes.",
    labelSolved: "Both carts roll, and the lighter one rolls farther.",
    summary: {
      clip: "push-mass.mp3",
      duration: 20.88,
      lines: [
        { text: "Here is the clever way to tell which cart's motion changes more.", at: 0 },
        { text: "Both carts get exactly the same push, but one cart is loaded with boxes and the other is light.", at: 4.34 },
        { text: "The light cart rolls far, while the loaded cart barely moves.", at: 11.25 },
        { text: "The same push changes a lighter cart's motion more, so the lighter cart changes more!", at: 15.63 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:push:table": {
    kind: "same-push",
    leftBoxes: 1,
    rightBoxes: 1,
    leftForce: 1,
    rightForce: 3,
    labelSetup: "Two trial carts wait with their push arrows.",
    labelSolved: "Both trial carts roll, and one rolls much farther.",
    summary: {
      clip: "push-table.mp3",
      duration: 22.07,
      lines: [
        { text: "Here is the clever way to read the two trials.", at: 0 },
        { text: "The two trial carts carry the same mass, so mass cannot explain any difference.", at: 3.36 },
        { text: "One trial's push arrow is larger, and that cart's motion changes far more.", at: 8.99 },
        { text: "With the same mass, the larger net force changes the motion more, so the trial with the larger net force changes more!", at: 14.45 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:ramp:higher-stored": {
    kind: "hill-carts",
    lowStep: 1,
    highStep: 3,
    labelSetup: "Two carts rest at different heights on one hill.",
    labelSolved: "Height marks rise beside the carts, and the higher store glows.",
    summary: {
      clip: "higher-stored.mp3",
      duration: 19.52,
      lines: [
        { text: "Here is the clever way to tell which cart holds more stored energy.", at: 0 },
        { text: "Both carts sit on the same hill, but one cart rests much higher up than the other.", at: 4.48 },
        { text: "Climbing higher stores more energy, and the higher cart's store glows stronger.", at: 9.93 },
        { text: "Higher on the hill means more stored energy, so the higher cart has more!", at: 15.07 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:energy:transfer": {
    kind: "cup-shove",
    slowSlide: 44,
    fastSlide: 0,
    stopsDead: true,
    labelSetup: "A ball waits beside a cup on the floor.",
    labelSolved: "The ball stops at the cup, and the cup slides away.",
    summary: {
      clip: "energy-transfer.mp3",
      duration: 16.18,
      lines: [
        { text: "Here is the clever way to follow the ball's motion.", at: 0 },
        { text: "The ball rolls toward the cup, carrying all of its motion with it.", at: 3.43 },
        { text: "The ball stops dead against the cup, and the cup slides away instead.", at: 7.89 },
        { text: "The ball's motion did not vanish — it moved into the cup!", at: 12.54 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:sound:medium": {
    kind: "sound-path",
    labelSetup: "A bell faces two paths across a gap to an ear.",
    labelSolved: "Waves cross the air path and fade at the empty gap.",
    summary: {
      clip: "sound-medium.mp3",
      duration: 18.57,
      lines: [
        { text: "Here is the clever way to tell which path carries the sound.", at: 0 },
        { text: "Sound travels as shaking waves, and waves need a material to shake.", at: 3.63 },
        { text: "The waves cross the air path to the ear, but they fade out where the path is empty.", at: 8.57 },
        { text: "Sound needs a material to travel through, so the air path carries the sound!", at: 13.92 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:mirror:three-ways": {
    kind: "light-path",
    withCard: false,
    threeMaterials: true,
    labelSetup: "A lamp faces a dark cloth, a clear sheet and a mirror.",
    labelSolved: "The light is soaked up, let through, and bounced back.",
    summary: {
      clip: "three-ways.mp3",
      duration: 18.73,
      lines: [
        { text: "Here is the clever way to tell which material reflects the light.", at: 0 },
        { text: "The lamp shines on all three: the dark cloth, the clear sheet and the mirror.", at: 4.07 },
        { text: "The cloth soaks the light up and the sheet lets it pass through, but the mirror bounces it back.", at: 9.19 },
        { text: "Of the three materials, the mirror is the one that reflects the light!", at: 14.88 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:ramp:adult-ratio": {
    kind: "slope-pair",
    firstRise: 3,
    firstRun: 6,
    secondRise: 4,
    secondRun: 6,
    labelSetup: "Two booms stand on a rise and run grid.",
    labelSolved: "Both slope lines are drawn, and the steeper one stands out.",
    summary: {
      clip: "adult-ratio.mp3",
      duration: 20.14,
      lines: [
        { text: "Here is the clever way to tell which boom is steeper.", at: 0 },
        { text: "Steepness is the rise divided by the run, and both booms run the same distance.", at: 3.43 },
        { text: "Boom A climbs 3 over 6, which is one half; boom B climbs 4 over 6, which is more.", at: 9.48 },
        { text: "Four over six beats three over six, so Boom B is steeper!", at: 16.23 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:arrive:adult-time": {
    kind: "journey-line",
    totalKm: 4,
    hours: 1,
    targetKm: 12,
    labelSetup: "A cart waits at the start of a long road.",
    labelSolved: "The road is marked out hour by hour.",
    summary: {
      clip: "adult-time.mp3",
      duration: 18.85,
      lines: [
        { text: "Here is the clever way to time the trip.", at: 0 },
        { text: "The cart covers 4 kilometres in every hour, so mark the road hour by hour.", at: 2.76 },
        { text: "Four kilometres, then eight, then twelve: the third hour mark reaches the end of the road.", at: 8.24 },
        { text: "Twelve divided by four is three, so the trip takes 3 hours!", at: 14.69 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "physics:energy:missing": {
    kind: "energy-ledger",
    change: 3,
    out: 2,
    labelSetup: "A battery store waits with its energy log.",
    labelSolved: "The out bar and the rise stack up to the in bar.",
    summary: {
      clip: "energy-missing.mp3",
      duration: 20.39,
      lines: [
        { text: "Here is the clever way to balance the energy log.", at: 0 },
        { text: "The log says the change in stored energy is the energy in take away the energy out.", at: 3.42 },
        { text: "Two units went out while the store rose by three, so the in bar must stack the out bar and the rise together.", at: 9.42 },
        { text: "Three and two make five, so the panels put in 5 units!", at: 16.66 },
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
