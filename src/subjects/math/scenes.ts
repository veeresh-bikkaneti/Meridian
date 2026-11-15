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
 * walk-through of the solving (act 3), played only after a
 * correct pick. The script lines are word-for-word the captions;
 * the clip timings were measured when the clips were rendered
 * (public/audio/subjects/manifest.json carries the same numbers).
 * The summary sits in the solved-phase data path only — the
 * renderer never reads it before the solve.
 *
 * Coverage: every Math item for ages 7-10 — the pilot's three
 * kinds plus the wave-1 kinds (expansion wave 1). Other bands
 * carry no descriptions yet; their clue cards are unchanged.
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
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return MATH_CLUE_SCENES[itemId] ?? null;
}
