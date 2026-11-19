/**
 * Math clue scenes — one scene description per item, in data,
 * next to the answers in answers.ts. A later item needs only a
 * new description here, never new code: the renderer
 * (src/subjects/shared/ClueScene.tsx) reads these.
 *
 * Answer-blindness is structural, the subject-host-props.ts
 * pattern: a description carries only the givens from the item's
 * own question (the coins on the table, the packs on the shelf,
 * the snacks and the friends). The renderer receives a description
 * and a phase ("setup" | "solved") — never the answer, a choice,
 * or a pick — so the setup film can only set the scene.
 *
 * Each description also carries its SUMMARY: the narrated
 * walk-through of the solving (act 3), played after a correct
 * pick — and, on the L1 lose path (the gate at the foot of this
 * file), after a wrong pick too. The script lines are
 * word-for-word the captions;
 * the clip timings were measured when the clips were rendered
 * (public/audio/subjects/manifest.json carries the same numbers).
 * The summary sits in the solved-phase data path only — the
 * renderer never reads it before the solve.
 *
 * Coverage: every Math item for ages 7-10 — the pilot's three
 * kinds plus the wave-1 kinds (expansion wave 1) — every Math
 * item for ages 10-18 (expansion wave 2: ten new kinds,
 * chunk-share and rounding-line reused), and the two covered
 * Math items for ages 18+ (expansion wave 3: split-product
 * reused, share-bar new). The one held 18+ item
 * (math-applied:measure:survey-check) carries no description —
 * it is scene-resistant per the expansion inventory and stays
 * text-only on the owner's word only.
 */
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";
import type { AgeGroup } from "../registry.ts";
import { itemsForGroup } from "./items.ts";

export type { ClueSceneDescription };
export {
  countingTicks,
  dealOrder,
  elapsedMinutes,
  fittingUnit,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "../shared/clue-scene-types.ts";

export const MATH_CLUE_SCENES: Record<string, ClueSceneDescription> = {

  "math-number:groups:skip-count": {
    kind: "coin-groups",
    total: 40,
    groupSize: 5,
    labelSetup: "Coins wait in a loose pile on a table, ready to be counted.",
    labelSolved: "The coins slide into equal groups and are counted in jumps.",
    summary: {
      clip: "skip-count.mp3",
      duration: 18.77,
      lines: [
        { text: "Here is the clever way to count the coins.", at: 0 },
        { text: "Slide them into groups of five, and count in fives.", at: 2.87 },
        { text: "5, 10.", at: 6.74 },
        { text: "15, 20.", at: 8.16 },
        { text: "25, 30.", at: 9.83 },
        { text: "35, 40.", at: 11.58 },
        { text: "8 groups of five make 40 coins. Counting in fives finds the groups fast!", at: 13.33 },
      ],
      beats: [0, 0, 2, 2, 2, 2, 0],
    },
  },
  "math-number:tables:facts": {
    kind: "pencil-packs",
    packs: 7,
    perPack: 4,
    labelSetup: "Packs of pencils stand in a row on a shelf.",
    labelSolved: "The packs are emptied and the pencils are counted in jumps.",
    summary: {
      clip: "pencil-packs.mp3",
      duration: 17.22,
      lines: [
        { text: "Here is the clever way to count the pencils.", at: 0 },
        { text: "Tip out one pack at a time, and count in fours.", at: 3.06 },
        { text: "4, 8.", at: 6.64 },
        { text: "12, 16.", at: 7.99 },
        { text: "20, 24, 28.", at: 9.57 },
        { text: "7 packs of four make 28 pencils. That is the four times table at work!", at: 11.82 },
      ],
      beats: [0, 0, 2, 2, 3, 0],
    },
  },
  "math-number:division:fair-share": {
    kind: "fair-share",
    total: 12,
    friends: 4,
    labelSetup: "A plate of snacks sits on a table, with friends waiting around it.",
    labelSolved: "The snacks are dealt out one by one until every friend has the same.",
    summary: {
      clip: "fair-share.mp3",
      duration: 18.74,
      lines: [
        { text: "Here is the fair way to share the snacks.", at: 0 },
        { text: "Deal them out one by one. Round one: one for every friend.", at: 2.76 },
        { text: "Round two: one more for every friend.", at: 7.28 },
        { text: "Round three: one more for every friend.", at: 10.12 },
        { text: "Every friend has 3 snacks, and the plate is empty. Sharing one by one keeps it fair!", at: 13.09 },
      ],
      beats: [0, 4, 4, 4, 0],
    },
  },
  "math-number:groups:equal-groups": {
    kind: "pencil-packs",
    packs: 4,
    perPack: 6,
    labelSetup: "Boxes of pencils stand in a row on a shelf.",
    labelSolved: "The boxes are emptied and the pencils are counted in jumps.",
    summary: {
      clip: "equal-groups.mp3",
      duration: 13.67,
      lines: [
        { text: "Here is the clever way to count the pencils.", at: 0 },
        { text: "Tip out one box at a time, and count in sixes.", at: 3.1 },
        { text: "6, 12.", at: 6.93 },
        { text: "18, 24.", at: 8.42 },
        { text: "Four boxes of six make 24 pencils in all!", at: 10.24 },
      ],
      beats: [0, 0, 2, 2, 0],
    },
  },
  "math-number:tables:buses": {
    kind: "bus-boarding",
    total: 24,
    seats: 6,
    labelSetup: "Children wait in a line at the bus stop.",
    labelSolved: "The children climb onto buses, a full bus at a time.",
    summary: {
      clip: "buses.mp3",
      duration: 14.24,
      lines: [
        { text: "Here is the clever way to fill the buses.", at: 0 },
        { text: "Fill one bus at a time, six children on each bus.", at: 3 },
        { text: "6, 12.", at: 6.73 },
        { text: "18, 24.", at: 8.22 },
        { text: "Four buses are filled, so 24 children need 4 buses!", at: 10.03 },
      ],
      beats: [0, 0, 2, 2, 0],
    },
  },
  "math-number:place:hundreds-tens-ones": {
    kind: "place-value",
    hundreds: 3,
    tens: 4,
    ones: 5,
    labelSetup: "Notes and coins wait in piles on the counter.",
    labelSolved: "The piles line up in their places and build one number.",
    summary: {
      clip: "place-value.mp3",
      duration: 17.24,
      lines: [
        { text: "Here is the clever way to build the amount.", at: 0 },
        { text: "Line the piles up in their places: hundreds, tens, ones.", at: 2.97 },
        { text: "3 hundreds make 300.", at: 7.29 },
        { text: "4 tens make 40, and 5 ones make 5.", at: 9.61 },
        { text: "300 and 40 and 5 build 345!", at: 13.24 },
      ],
      beats: [0, 0, 1, 2, 0],
    },
  },
  "math-number:place:compare": {
    kind: "place-compare",
    left: 358,
    right: 385,
    labelSetup: "Two routes wait side by side, their steps laid out in places.",
    labelSolved: "The two routes are compared place by place, from the left.",
    summary: {
      clip: "place-compare.mp3",
      duration: 16.65,
      lines: [
        { text: "Here is the clever way to compare the routes.", at: 0 },
        { text: "Lay both routes out in places, and compare from the left.", at: 3.17 },
        { text: "The hundreds match: 3 and 3.", at: 7.23 },
        { text: "The tens decide it: 8 tens beat 5 tens.", at: 9.67 },
        { text: "So the longer route is 385 steps!", at: 13.59 },
      ],
      beats: [0, 0, 1, 1, 1],
    },
  },
  "math-number:place:round": {
    kind: "rounding-line",
    value: 287,
    low: 200,
    high: 300,
    labelSetup: "A marker waits on a line between two hundreds.",
    labelSolved: "The marker settles at the hundred it is closer to.",
    summary: {
      clip: "rounding.mp3",
      duration: 16.78,
      lines: [
        { text: "Here is the clever way to round the visitors.", at: 0 },
        { text: "287 sits between 200 and 300, and the middle of the line is 250.", at: 3.19 },
        { text: "287 sits past the middle, closer to 300.", at: 10.53 },
        { text: "So the banner says 300!", at: 15.06 },
      ],
      beats: [0, 1, 1, 0],
    },
  },
  "math-number:place:ten-times": {
    kind: "digit-shift",
    value: 70,
    factor: 10,
    labelSetup: "Stones mark a path, each stone standing for ten steps.",
    labelSolved: "Each stone grows ten times bigger and the digits shift.",
    summary: {
      clip: "ten-times.mp3",
      duration: 19.53,
      lines: [
        { text: "Here is the clever way to stretch the path.", at: 0 },
        { text: "Every stone stands for 10 steps, and every stone grows ten times.", at: 2.77 },
        { text: "100, 200.", at: 7.85 },
        { text: "300, 400.", at: 9.86 },
        { text: "500, 600, 700.", at: 12.04 },
        { text: "Every digit moved one place to the left: 70 becomes 700!", at: 15.14 },
      ],
      beats: [0, 0, 2, 2, 3, 0],
    },
  },
  "math-number:tables:big-products": {
    kind: "split-product",
    rows: 8,
    perRow: 126,
    splitHigh: 100,
    splitLow: 26,
    labelSetup: "Rows of chairs wait in a hall.",
    labelSolved: "Each row splits into a round part and a leftover part, counted apart.",
    summary: {
      clip: "big-products.mp3",
      duration: 21.4,
      lines: [
        { text: "Here is the clever way to count the seats.", at: 0 },
        { text: "Split every row of 126 into 100 and 26.", at: 2.8 },
        { text: "The round parts first: 100 in 8 rows makes 800.", at: 7.8 },
        { text: "The leftover parts: 26 in 8 rows makes 208.", at: 12.58 },
        { text: "800 and 208 make 1008 seats in all!", at: 17.25 },
      ],
      beats: [0, 1, 1, 1, 1],
    },
  },
  "math-number:division:unknown-factor": {
    kind: "pack-boxes",
    total: 40,
    perBox: 8,
    labelSetup: "Pencils wait in a loose pile, ready to be packed.",
    labelSolved: "The pencils fill one box at a time, eight to a box.",
    summary: {
      clip: "unknown-factor.mp3",
      duration: 13.6,
      lines: [
        { text: "Here is the clever way to pack the pencils.", at: 0 },
        { text: "Fill one box at a time, eight pencils to a box.", at: 3.01 },
        { text: "8, 16.", at: 6.97 },
        { text: "24, 32, 40.", at: 8.45 },
        { text: "That is 5 boxes for all 40 pencils!", at: 10.9 },
      ],
      beats: [0, 0, 2, 3, 0],
    },
  },
  "math-number:division:remainders": {
    kind: "bus-boarding",
    total: 26,
    seats: 6,
    labelSetup: "Children wait in a line at the bus stop.",
    labelSolved: "The children climb onto buses, a full bus at a time.",
    summary: {
      clip: "remainders.mp3",
      duration: 16.89,
      lines: [
        { text: "Here is the clever way to fill the buses.", at: 0 },
        { text: "Fill one bus at a time, six children on each bus.", at: 3 },
        { text: "6, 12.", at: 6.73 },
        { text: "18, 24.", at: 8.22 },
        { text: "Two children are still waiting, so one more bus comes.", at: 10.03 },
        { text: "That makes 5 buses for all 26 children!", at: 13.98 },
      ],
      beats: [0, 0, 2, 2, 1, 0],
    },
  },
  "math-number:division:big-quotients": {
    kind: "chunk-share",
    total: 1248,
    shares: 8,
    labelSetup: "A tall pile of books waits beside empty shelves.",
    labelSolved: "The books are shared onto the shelves in big chunks.",
    summary: {
      clip: "big-quotients.mp3",
      duration: 17.57,
      lines: [
        { text: "Here is the clever way to share the books.", at: 0 },
        { text: "Share them in big chunks: first, 100 books onto every shelf.", at: 2.71 },
        { text: "Then 50 more onto every shelf.", at: 7.55 },
        { text: "Then 6 more onto every shelf.", at: 10.16 },
        { text: "Every shelf holds 100 and 50 and 6: 156 books!", at: 12.56 },
      ],
      beats: [0, 1, 1, 1, 0],
    },
  },
  // ── Scenes wave (Phase 1 unblock): the nine wave-3 items ──
  "math-number:fractions:fair-parts": {
    kind: "fraction-slice",
    parts: 4,
    taken: 1,
    labelSetup: "One whole pizza waits on a plate, ready to be cut fairly.",
    labelSolved: "The pizza is cut into equal parts and the parts spread out.",
    summary: {
      clip: "fair-parts.mp3",
      duration: 16.25,
      lines: [
        { text: "Here is the fair way to cut the pizza.", at: 0 },
        { text: "Cut the pizza into four equal parts.", at: 3.53 },
        { text: "Four equal parts, and every part is the same size.", at: 7.15 },
        { text: "One part of four equal parts is 1/4 of the pizza!", at: 11.82 },
      ],
      beats: [0, 2, 2, 0],
    },
  },
  "math-number:fractions:equivalent": {
    kind: "fraction-slice",
    parts: 2,
    taken: 1,
    parts2: 4,
    taken2: 2,
    labelSetup: "Two pizzas of the same size wait side by side on the counter.",
    labelSolved: "Both pizzas are cut and the taken parts are compared edge to edge.",
    summary: {
      clip: "equivalent.mp3",
      duration: 19.7,
      lines: [
        { text: "Here is how to tell who has more pizza.", at: 0 },
        { text: "The first pizza is cut into two parts, and one part is taken.", at: 3.55 },
        { text: "The second pizza is cut into four smaller parts, and two parts are taken.", at: 8.67 },
        { text: "The taken parts line up to the very same edge. They have the same amount!", at: 14.52 },
      ],
      beats: [0, 2, 4, 0],
    },
  },
  "math-number:fractions:compare-unlike": {
    kind: "fraction-fill",
    numerator: 3,
    denominator: 4,
    otherNumerator: 2,
    otherDenominator: 3,
    labelSetup: "Two bottles of the same size stand side by side, each with its mark.",
    labelSolved: "The bottles fill to their marks and a shared grid compares them.",
    summary: {
      clip: "compare-unlike.mp3",
      duration: 19.32,
      lines: [
        { text: "Here is how to tell which bottle holds more.", at: 0 },
        { text: "Fill the first bottle to its mark: three of its four parts.", at: 3.78 },
        { text: "Fill the second bottle to its mark: two of its three parts.", at: 8.6 },
        { text: "In twelfths, that is nine against eight, so The 3/4-full bottle holds more!", at: 13.35 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "math-number:groups:arrays": {
    kind: "tile-grid",
    rows: 4,
    cols: 5,
    brick: true,
    labelSetup: "An empty wall frame waits, ready for its rows of bricks.",
    labelSolved: "The bricks lay row by row and the rows are counted in jumps.",
    summary: {
      clip: "arrays.mp3",
      duration: 16.9,
      lines: [
        { text: "Here is the steady way to count the bricks.", at: 0 },
        { text: "Lay the rows one by one, five bricks in every row.", at: 3.58 },
        { text: "Five, ten, fifteen, twenty: the rows count up in fives.", at: 8.43 },
        { text: "4 rows of five make 20 bricks in all!", at: 13.47 },
      ],
      beats: [0, 2, 2, 0],
    },
  },
  "math-applied:measure:longer-than": {
    kind: "measure-trace",
    mode: "bars",
    length: 86,
    width: 92,
    labelSetup: "A board and a shelf lie side by side, sharing the same start line.",
    labelSolved: "Both lengths are traced and the gap between their ends is bracketed.",
    summary: {
      clip: "longer-than.mp3",
      duration: 19.5,
      lines: [
        { text: "Here is how to find how much longer the shelf is.", at: 0 },
        { text: "Trace the board from the shared start: 86 centimetres.", at: 4.17 },
        { text: "Trace the shelf the same way: 92 centimetres.", at: 8.97 },
        { text: "The gap between the ends is 6 centimetres — the shelf is 6 centimetres longer!", at: 13.57 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "math-applied:measure:choose-unit": {
    kind: "unit-fit",
    pathLength: 60,
    labelSetup: "A long path runs right past the edge of the picture, and an ant waits beside it.",
    labelSolved: "Three kinds of steps try the path, and the one that fits is ringed.",
    summary: {
      clip: "choose-unit.mp3",
      duration: 18.4,
      lines: [
        { text: "Here is how to choose the step that fits the path.", at: 0 },
        { text: "An ant-step is far too small: the path would take thousands of them.", at: 3.98 },
        { text: "A finger-step is still too small for a long path.", at: 9.45 },
        { text: "A stride fits a long path, and strides are measured in Metres!", at: 13.5 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "math-applied:measure:elapsed-time": {
    kind: "clock-arc",
    startHour: 10,
    startMinute: 15,
    endHour: 10,
    endMinute: 50,
    labelSetup: "A clock waits at the start of the walk, its hand ready to sweep.",
    labelSolved: "The hand sweeps the arc in fives, counting the minutes between the times.",
    summary: {
      clip: "elapsed-time.mp3",
      duration: 18.07,
      lines: [
        { text: "Here is how to count the minutes on the clock.", at: 0 },
        { text: "Start at fifteen minutes past, and sweep in fives.", at: 3.62 },
        { text: "Twenty, twenty-five, thirty: keep sweeping in fives.", at: 7.92 },
        { text: "Thirty-five! From 10:15 to 10:50 is 35 minutes.", at: 12.55 },
      ],
      beats: [0, 3, 3, 1],
    },
  },
  "math-applied:measure:perimeter": {
    kind: "measure-trace",
    mode: "loop",
    length: 4,
    width: 3,
    labelSetup: "A sandbox waits, ready for its border to go around.",
    labelSolved: "The border walks around every side and the running total grows.",
    summary: {
      clip: "perimeter.mp3",
      duration: 23.25,
      lines: [
        { text: "Here is how to measure the border for the sandbox.", at: 0 },
        { text: "Walk the long side: 4 metres of border.", at: 4.2 },
        { text: "Walk the short side: 7 metres so far.", at: 8.35 },
        { text: "Around the last two sides: 11, then 14.", at: 12.55 },
        { text: "4 and 3 and 4 and 3 make 14 metres of border, all the way around!", at: 17.22 },
      ],
      beats: [0, 1, 1, 2, 0],
    },
  },
  "math-applied:measure:rect-area": {
    kind: "tile-grid",
    rows: 3,
    cols: 5,
    labelSetup: "An empty floor outline waits, ready to be covered with square tiles.",
    labelSolved: "The tiles cover the floor row by row and the rows are counted in jumps.",
    summary: {
      clip: "rect-area.mp3",
      duration: 17.48,
      lines: [
        { text: "Here is the clever way to count the tiles.", at: 0 },
        { text: "Lay the rows one by one, five tiles in every row.", at: 3.75 },
        { text: "Five, ten, fifteen: the rows count up in fives.", at: 8.72 },
        { text: "3 rows of five make 15 square metres of floor!", at: 13.32 },
      ],
      beats: [0, 2, 1, 0],
    },
  },
  "math-number:tables:multi-digit": {
    kind: "array-grid",
    rows: 23,
    perRow: 47,
    splitHigh: 40,
    splitLow: 7,
    labelSetup: "A tiled floor waits, its rows drawn one by one.",
    labelSolved: "The floor splits into a wide part and a narrow part, counted apart.",
    summary: {
      clip: "multi-digit.mp3",
      duration: 24.19,
      lines: [
        { text: "Here is the clever way to count the tiles.", at: 0 },
        { text: "Split each row of 47 tiles into 40 and 7.", at: 2.89 },
        { text: "The wide part: 23 rows of 40 make 920 tiles.", at: 7.19 },
        { text: "The narrow part: 23 rows of 7 make 161 tiles.", at: 12.57 },
        { text: "920 and 161 make 1081 tiles in all!", at: 18.19 }
      ],
      beats: [0, 1, 1, 1, 1],
    },
  },
  "math-applied:measure:convert-metric": {
    kind: "scale-line",
    kilometres: 2.4,
    metresPerKm: 1000,
    labelSetup: "A river stretch waits beside a measuring bar.",
    labelSolved: "The bar stretches out into metre marks.",
    summary: {
      clip: "convert-metric.mp3",
      duration: 17.28,
      lines: [
        { text: "Here is the clever way to change the walk into metres.", at: 0 },
        { text: "Every kilometre is 1000 metres, so count the stretch in thousands.", at: 3.78 },
        { text: "Two whole kilometres make 2000 metres, and the last part makes 400 more.", at: 9.07 },
        { text: "That makes 2400 metres in all!", at: 15.01 }
      ],
      beats: [0, 1, 0, 1],
    },
  },
  "math-number:fractions:percent": {
    kind: "percent-bar",
    total: 80,
    percentOff: 30,
    labelSetup: "A price bar waits in the shop window.",
    labelSolved: "A slice of the price is taken off, and the rest is what you pay.",
    summary: {
      clip: "percent.mp3",
      duration: 18.33,
      lines: [
        { text: "Here is the clever way to find the price you pay.", at: 0 },
        { text: "The price is 80 coins, and the shop takes 30 percent off.", at: 3.26 },
        { text: "30 percent of 80 is 24 coins saved.", at: 7.6 },
        { text: "Take the saved coins away from the whole price.", at: 11.35 },
        { text: "80 take away 24 leaves 56 coins to pay!", at: 14.7 }
      ],
      beats: [0, 1, 1, 0, 1],
    },
  },
  "math-applied:geometry:scale-drawing": {
    kind: "map-scale",
    mapCm: 4,
    kmPerCm: 2,
    labelSetup: "A river is drawn on a map, beside a scale note.",
    labelSolved: "The map line grows into the ground line, centimetre by centimetre.",
    summary: {
      clip: "scale-drawing.mp3",
      duration: 16.49,
      lines: [
        { text: "Here is the clever way to read the map.", at: 0 },
        { text: "Each centimetre on the map stands for 2 kilometres on the ground.", at: 2.68 },
        { text: "The river measures 4 centimetres, so count in twos: 2, 4, 6, 8.", at: 7.14 },
        { text: "Four centimetres on the map stand for 8 kilometres on the ground!", at: 12.33 }
      ],
      beats: [0, 2, 2, 0],
    },
  },
  "math-number:division:standard-algorithm": {
    kind: "chunk-share",
    total: 4368,
    shares: 28,
    labelSetup: "A tall pile waits beside empty share plates.",
    labelSolved: "The pile is shared out in big chunks.",
    summary: {
      clip: "standard-algorithm.mp3",
      duration: 18.03,
      lines: [
        { text: "Here is the clever way to share the coins.", at: 0 },
        { text: "Share them in big chunks: first, 100 coins for every person.", at: 2.92 },
        { text: "Then 50 more for every person.", at: 7.96 },
        { text: "Then 6 more for every person.", at: 10.44 },
        { text: "Every person gets 100 and 50 and 6: 156 coins!", at: 12.89 }
      ],
      beats: [0, 1, 1, 1, 0],
    },
  },
  "math-number:fractions:multiply": {
    kind: "fraction-bar",
    numerator: 2,
    denominator: 3,
    labelSetup: "A cup bar waits, split into equal parts.",
    labelSolved: "Half of the shaded part is marked.",
    summary: {
      clip: "fraction-multiply.mp3",
      duration: 14.69,
      lines: [
        { text: "Here is the clever way to halve the recipe.", at: 0 },
        { text: "The cup bar is split into thirds, and two of the thirds are shaded.", at: 2.98 },
        { text: "Take half of the two shaded thirds, and one third stays marked.", at: 7.36 },
        { text: "Half of two thirds is 1/3 of a cup!", at: 11.95 }
      ],
      beats: [0, 1, 1, 0],
    },
  },
  "math-number:fractions:divide": {
    kind: "fraction-measure",
    total: 6,
    pieceNumerator: 3,
    pieceDenominator: 4,
    labelSetup: "A roll of ribbon waits beside the scissors.",
    labelSolved: "The roll is measured off in equal ribbon lengths.",
    summary: {
      clip: "fraction-divide.mp3",
      duration: 15.85,
      lines: [
        { text: "Here is the clever way to cut the ribbons.", at: 0 },
        { text: "Measure the roll in pieces of three quarters of a metre, one cut at a time.", at: 3 },
        { text: "Keep measuring along the roll, piece after piece.", at: 7.96 },
        { text: "Eight pieces of three quarters make 6 metres, so 8 ribbons can be cut!", at: 11.37 }
      ],
      beats: [0, 4, 4, 0],
    },
  },
  "math-applied:rates:unit-rate": {
    kind: "rate-bars",
    firstMetres: 3,
    firstCoins: 6,
    secondMetres: 5,
    secondCoins: 8,
    labelSetup: "Two rope bars wait at two market stalls.",
    labelSolved: "Each bar is split into single metres, and every metre is priced.",
    summary: {
      clip: "unit-rate.mp3",
      duration: 27.57,
      lines: [
        { text: "Here is the clever way to compare the rope stalls.", at: 0 },
        { text: "At the first stall, 6 coins buy 3 metres, so one metre costs 6 divided by 3, which is 2 coins.", at: 3.43 },
        { text: "At the second stall, 8 coins buy 5 metres, so one metre costs 8 divided by 5, which is 1.6 coins.", at: 11.67 },
        { text: "The cheaper metre is at the second stall.", at: 21.02 },
        { text: "One metre at the cheaper stall costs 1.6 coins!", at: 23.93 }
      ],
      beats: [0, 1, 1, 1, 0],
    },
  },
  "math-applied:rates:one-step": {
    kind: "journey-line",
    totalKm: 12,
    aheadKm: 5,
    labelSetup: "A walker waits at the start of a trail.",
    labelSolved: "The walked part of the trail fills in from the start.",
    summary: {
      clip: "one-step.mp3",
      duration: 15.5,
      lines: [
        { text: "Here is the clever way to find the part already walked.", at: 0 },
        { text: "The whole trail is 12 kilometres, and 5 kilometres are still ahead.", at: 3.72 },
        { text: "Take the part still ahead away from the whole trail.", at: 8.73 },
        { text: "12 take away 5 leaves 7 kilometres already walked!", at: 11.9 }
      ],
      beats: [0, 0, 1, 1],
    },
  },
  "math-applied:rates:two-step": {
    kind: "spend-then-group",
    total: 19,
    fixedCost: 4,
    perGroup: 3,
    labelSetup: "Coins wait in a pile beside one empty cup.",
    labelSolved: "The one-off charge is paid, and the rest fall into cup-priced groups.",
    summary: {
      clip: "two-step.mp3",
      duration: 19.33,
      lines: [
        { text: "Here is the clever way to spend the budget.", at: 0 },
        { text: "Pay the one-off charge of 4 coins first.", at: 2.87 },
        { text: "That leaves 19 take away 4, which is 15 coins for cups.", at: 5.85 },
        { text: "Group the 15 coins in threes, one group for each cup.", at: 10.85 },
        { text: "Five groups of 3 make 15, so the budget buys 5 cups!", at: 15.08 }
      ],
      beats: [0, 1, 0, 5, 0],
    },
  },
  "math-applied:rates:constant-speed": {
    kind: "journey-line",
    totalKm: 12,
    hours: 3,
    targetKm: 20,
    labelSetup: "A walker waits at the start of a long path.",
    labelSolved: "The path is marked out hour by hour at a steady pace.",
    summary: {
      clip: "constant-speed.mp3",
      duration: 16.11,
      lines: [
        { text: "Here is the clever way to use a steady pace.", at: 0 },
        { text: "Twelve kilometres in 3 hours is 4 kilometres every hour.", at: 3.16 },
        { text: "Keep going 4 kilometres an hour along the longer path.", at: 7.82 },
        { text: "So a path of 20 kilometres takes 5 hours at that steady pace!", at: 11.99 }
      ],
      beats: [0, 3, 2, 0],
    },
  },
  "math-applied:measure:accuracy": {
    kind: "rounding-line",
    value: 2.4837,
    low: 2.48,
    high: 2.49,
    labelSetup: "A marker waits on a line zoomed in close.",
    labelSolved: "The marker settles at the hundredth it is closer to.",
    summary: {
      clip: "accuracy.mp3",
      duration: 21.95,
      lines: [
        { text: "Here is the clever way to write the measure honestly.", at: 0 },
        { text: "A centimetre tape can only promise hundredths of a metre, so zoom in between 2.48 and 2.49.", at: 3.62 },
        { text: "2.4837 sits closer to 2.48 than to 2.49.", at: 12.05 },
        { text: "So the report should say 2.48 metres!", at: 19.04 }
      ],
      beats: [0, 1, 1, 0],
    },
  },
  "math-applied:trig:bearings": {
    kind: "bearing-diagram",
    eastKm: 6,
    northKm: 8,
    labelSetup: "A boat waits at a harbour on a map, under a north arrow.",
    labelSolved: "The two legs of the journey draw, and the angle from north opens.",
    summary: {
      clip: "bearings.mp3",
      duration: 20.5,
      lines: [
        { text: "Here is the clever way to find the bearing.", at: 0 },
        { text: "Draw the boat's path: first, 6 kilometres east.", at: 2.92 },
        { text: "Then 8 kilometres north, up the map.", at: 6.73 },
        { text: "A bearing is measured from north, and this angle's tangent is 6 divided by 8.", at: 9.74 },
        { text: "That angle is about 37 degrees, so the bearing is 37 degrees!", at: 15.48 }
      ],
      beats: [0, 1, 1, 1, 0],
    },
  },
  "math-number:tables:mental-strategies": {
    kind: "split-product",
    rows: 24,
    perRow: 15,
    splitHigh: 10,
    splitLow: 5,
    labelSetup: "Rows wait, ready to be counted in your head.",
    labelSolved: "Each row splits into a round part and a leftover part, counted apart.",
    summary: {
      clip: "mental-strategies.mp3",
      duration: 19.79,
      lines: [
        { text: "Here is the clever way to multiply in your head.", at: 0 },
        { text: "Split 15 into 10 and 5.", at: 3.3 },
        { text: "The round part first: 24 times 10 makes 240.", at: 5.73 },
        { text: "The leftover part: 24 times 5 makes 120.", at: 10.61 },
        { text: "240 and 120 make 360!", at: 15.48 }
      ],
      beats: [0, 1, 1, 1, 1],
    },
  },
  "math-number:fractions:combine-shares": {
    kind: "share-bar",
    total: 120,
    firstNumerator: 1,
    firstDenominator: 2,
    secondNumerator: 1,
    secondDenominator: 4,
    discountPercent: 10,
    labelSetup: "A bill bar waits, ready to be shared.",
    labelSolved: "The bar is cut into shares, and one share shrinks.",
    summary: {
      clip: "combine-shares.mp3",
      duration: 20.08,
      lines: [
        { text: "Here is the clever way to split the bill.", at: 0 },
        { text: "Half of 120 is 60, and a quarter of 120 is 30.", at: 2.78 },
        { text: "That leaves 30, and the last two friends split it equally: 15 each.", at: 8.4 },
        { text: "One of those shares gets 10 percent off.", at: 13.31 },
        { text: "10 percent off 15 leaves 13.5 coins to pay!", at: 15.96 }
      ],
      beats: [0, 3, 1, 1, 0],
    },
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return MATH_CLUE_SCENES[itemId] ?? null;
}

/** The L1 lose path (feat/fair-share-lose-path, generalised by
 * feat/lose-path-all-items): on an item that HAS a solved
 * summary, the second distinct wrong answer reveals that
 * summary — the same act-3 performance a correct pick plays
 * (the pacing is SubjectCase's, per the owner's 2026-11-19
 * decision; this gate only names WHICH items are on the path).
 * The gate is a property of the item, not a
 * hand-maintained list: it is true exactly when the item is a
 * playable item for the band asked about AND its scene description
 * in this file carries a summary. On this branch (rebased onto the
 * merged wave train) that is every Math item in every band whose
 * description carries a summary; an item with no description, or
 * no summary on its description, returns false, so its wrong pick
 * behaves exactly as before — including the held 18+ survey-check
 * item, which carries no description by design. When a later wave
 * adds descriptions (with summaries) for another band, those items
 * satisfy this same property in their own band with no change
 * here. */
export function showsSummaryOnWrong(itemId: string, band: string): boolean {
  if (!clueSceneFor(itemId)?.summary) return false;
  return itemsForGroup(band as AgeGroup).some((item) => item.id === itemId);
}
