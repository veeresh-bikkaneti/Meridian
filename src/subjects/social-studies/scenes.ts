/**
 * Social studies clue scenes — one scene description per item,
 * in data, next to the answers in answers.ts (the math,
 * physics, chemistry and general-knowledge scenes.ts pattern).
 * The renderer (src/subjects/shared/ClueScene.tsx) reads
 * these; a later item needs only a new description here, never
 * new code.
 *
 * Answer-blindness is structural, as in the other subjects: a
 * description carries only the givens from the item's own
 * question. The renderer receives a description and a phase
 * ("setup" | "solved") — never the answer, a choice, or a
 * pick — so the setup film can only set the scene. Where a
 * kind's solved beat needs the outcome, the description's kind
 * data carries it as layout the renderer spends only in the
 * solved phase.
 *
 * Each description also carries its SUMMARY: the narrated
 * walk-through of the solving (act 3), played only after a
 * correct pick. The script lines are word-for-word the
 * captions; the clip timings were measured when the clips were
 * rendered (public/audio/subjects/manifest.json carries the
 * same numbers). The summary sits in the solved-phase data
 * path only.
 *
 * Coverage (expansion wave 9): all twelve items — the four
 * ages 7-10 items, all five ages 10-18 items and all three
 * ages 18+ items — completing Social studies at 12/12. Five
 * items reuse Math kinds outright (array-grid with its
 * two-fields variant, scale-line, journey-line twice, and
 * map-scale with its narrow-segment variant); seven new kinds
 * join (compass-walk, density-towns, two-roads, zone-clocks,
 * globe-vs-map, great-circle, cost-compare), bringing the
 * programme total to 60 kinds. The density scene follows the
 * ruled place-compare pattern: both towns' dot layouts are
 * the question's givens, drawn spatially, with the winner
 * unmarked before the pick.
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

export const SOCIAL_STUDIES_CLUE_SCENES: Record<string, ClueSceneDescription> = {
  "social-studies:region:area-by-squares": {
    kind: "array-grid", rows: 3, perRow: 4, splitHigh: 4, splitLow: 0, secondRows: 2,
    labelSetup: "Two fields of grid squares wait side by side.",
    labelSolved: "The fields are counted square by square, and the bigger field is ringed.",
    summary: {
      clip: "area-squares.mp3",
      duration: 17.14,
      lines: [
        { text: "Here is the clever way to compare the fields.", at: 0 },
        { text: "Count the first field in rows: three rows of four make twelve squares.", at: 3.17 },
        { text: "Count the second field: two rows of four make eight squares.", at: 8.17 },
        { text: "The first field, by 4 squares — twelve squares take away eight leaves four!", at: 12.46 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:route:count-the-steps": {
    kind: "scale-line", kilometres: 4, metresPerKm: 10,
    labelSetup: "A route waits beside a measuring bar.",
    labelSolved: "The route is measured off in bar lengths.",
    summary: {
      clip: "route-steps.mp3",
      duration: 16.04,
      lines: [
        { text: "Here is the clever way to measure the route.", at: 0 },
        { text: "Each bar length stands for ten kilometres, and the route measures four bar lengths.", at: 2.88 },
        { text: "Count in tens along the route: ten, twenty, thirty, forty.", at: 8.33 },
        { text: "Four bar lengths of ten kilometres make 40 km!", at: 12.74 }
      ],
      beats: [0, 1, 0, 1],
    },
  },
  "social-studies:route:trip-clock": {
    kind: "journey-line", totalKm: 40, hours: 1, targetKm: 120,
    labelSetup: "A bus waits at the start of a long road.",
    labelSolved: "The road is marked out hour by hour.",
    summary: {
      clip: "trip-clock.mp3",
      duration: 20.57,
      lines: [
        { text: "Here is the clever way to time the bus trip.", at: 0 },
        { text: "The bus covers forty kilometres in every hour, so mark the road hour by hour.", at: 2.97 },
        { text: "Forty kilometres, then eighty, then one hundred twenty: the third hour mark reaches the museum.", at: 8.54 },
        { text: "One hundred twenty divided by forty is three, so the trip takes 3 hours!", at: 15.57 }
      ],
      beats: [0, 1, 2, 0],
    },
  },
  "social-studies:place:compass-clue": {
    kind: "compass-walk", eastSteps: 2, northSteps: 1,
    labelSetup: "A fountain rests on a map grid, under a north arrow.",
    labelSolved: "A dotted path steps across the grid from the fountain.",
    summary: {
      clip: "compass-clue.mp3",
      duration: 15.99,
      lines: [
        { text: "Here is the clever way to follow the treasure steps.", at: 0 },
        { text: "Start at the fountain, and take two steps east, to the right on the map.", at: 3.44 },
        { text: "Then take one step north, up the map, and the treasure spot is reached.", at: 7.76 },
        { text: "East and then north land you North-east of the fountain!", at: 12.52 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:region:density": {
    kind: "density-towns", firstArea: 2, secondArea: 8,
    labelSetup: "Two towns hold the same crowd of dots on different land.",
    labelSolved: "Each town's land divides into its square kilometres.",
    summary: {
      clip: "town-density.mp3",
      duration: 21.05,
      lines: [
        { text: "Here is the clever way to tell which town is more crowded.", at: 0 },
        { text: "Both towns hold the same thousand people, so look at the land each crowd is spread over.", at: 3.76 },
        { text: "Town A's crowd is packed into two square kilometres, while the other crowd spreads over eight.", at: 10 },
        { text: "The same people in less land are packed tighter, so Town A is more crowded — Town A!", at: 16.03 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:route:scale-ratio": {
    kind: "map-scale", mapCm: 7, kmPerCm: 0.5, segmentPx: 34,
    labelSetup: "A trail is drawn on a map, beside a scale note.",
    labelSolved: "The map line grows into the ground line, centimetre by centimetre.",
    summary: {
      clip: "trail-scale.mp3",
      duration: 21.06,
      lines: [
        { text: "Here is the clever way to read the trail scale.", at: 0 },
        { text: "Each centimetre on the map stands for fifty thousand centimetres on the ground.", at: 3.16 },
        { text: "Count the trail's seven centimetres along the ground, half a kilometre at a time.", at: 8.44 },
        { text: "Seven centimetres make three hundred fifty thousand centimetres, so the real walk is 3.5 km!", at: 13.89 }
      ],
      beats: [0, 3, 4, 0],
    },
  },
  "social-studies:route:travel-time": {
    kind: "journey-line", totalKm: 15, hours: 1, targetKm: 90,
    labelSetup: "A rider waits at the start of a long road.",
    labelSolved: "The road is marked out hour by hour.",
    summary: {
      clip: "travel-time.mp3",
      duration: 19.92,
      lines: [
        { text: "Here is the clever way to time the ride.", at: 0 },
        { text: "You ride fifteen kilometres in every hour, so mark the road hour by hour.", at: 2.73 },
        { text: "Fifteen, thirty, forty-five, sixty, seventy-five, ninety: the sixth hour mark reaches the station.", at: 8.06 },
        { text: "Ninety divided by fifteen is six, so the ride takes 6 hours!", at: 15.48 }
      ],
      beats: [0, 3, 3, 0],
    },
  },
  "social-studies:route:fastest-or-shortest": {
    kind: "two-roads", passKm: 60, passSpeed: 20, valleyKm: 90, valleySpeed: 60,
    labelSetup: "Two roads lead toward a house, with a rider at the start of each.",
    labelSolved: "Both riders set off, and one rider reaches home while the other rides on.",
    summary: {
      clip: "two-roads.mp3",
      duration: 21.31,
      lines: [
        { text: "Here is the clever way to pick the road home.", at: 0 },
        { text: "The mountain pass is sixty kilometres at twenty kilometres an hour, so it takes three hours.", at: 3.14 },
        { text: "The valley road is ninety kilometres at sixty kilometres an hour, so it takes one and a half hours.", at: 9.51 },
        { text: "The longer road ridden faster wins, so The valley road gets you home first!", at: 16.38 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:compare:time-zones": {
    kind: "zone-clocks", hereHour: 8, zonesAhead: 6,
    labelSetup: "Two clocks rest side by side, one showing the evening hour.",
    labelSolved: "The far clock's hands spin on, past midnight.",
    summary: {
      clip: "zone-clocks.mp3",
      duration: 15.71,
      lines: [
        { text: "Here is the clever way to find your cousin's time.", at: 0 },
        { text: "Places east of you are ahead in time, and your cousin lives six time zones east.", at: 3.36 },
        { text: "Count six hours on from eight in the evening, past midnight.", at: 9.05 },
        { text: "Eight plus six lands at 2 am the next day!", at: 13.01 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:region:flat-map-area": {
    kind: "globe-vs-map",
    labelSetup: "A flat map shows two lands side by side.",
    labelSolved: "The flat map's stretch is marked, and a true land stands over it.",
    summary: {
      clip: "flat-map.mp3",
      duration: 19.81,
      lines: [
        { text: "Here is the clever way to read a flat map.", at: 0 },
        { text: "A flat map has to stretch the round Earth flat, and the stretch grows near the poles.", at: 2.89 },
        { text: "Greenland sits near the pole, so the flat map stretches it until it only looks as large as Africa.", at: 8.39 },
        { text: "Africa is far bigger — the flat map stretches places near the poles!", at: 15.28 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:route:great-circle": {
    kind: "great-circle",
    labelSetup: "A globe and a flat map each carry two pins.",
    labelSolved: "A path arcs over the globe, and the same path curves on the map.",
    summary: {
      clip: "great-circle.mp3",
      duration: 19.95,
      lines: [
        { text: "Here is the clever way to find the shortest flight path.", at: 0 },
        { text: "On the round Earth, the shortest route between two places follows a great circle over the surface.", at: 3.55 },
        { text: "Drawn on a flat map, that same great circle bends toward the pole instead of looking straight.", at: 10.11 },
        { text: "That curved-looking path is the shortest route on the round Earth!", at: 16.14 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "social-studies:compare:trip-cost": {
    kind: "cost-compare", tollFuel: 10, tollFee: 6, freeFuel: 13,
    labelSetup: "Two roads cross the page, with coin stacks beside each.",
    labelSolved: "The toll road's stacks join, and the free road's stack stands beside them.",
    summary: {
      clip: "trip-cost.mp3",
      duration: 20.6,
      lines: [
        { text: "Here is the clever way to compare the roads' costs.", at: 0 },
        { text: "The toll road costs $10 of fuel plus a $6 toll, which makes $16 in all.", at: 3.36 },
        { text: "The free road costs $13 of fuel, and no toll at all.", at: 10.23 },
        { text: "Sixteen take away thirteen leaves three, so The free road, by $3, costs less!", at: 14.96 }
      ],
      beats: [0, 1, 1, 1],
    },
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return SOCIAL_STUDIES_CLUE_SCENES[itemId] ?? null;
}
