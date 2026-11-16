/**
 * General knowledge clue scenes — one scene description per
 * item, in data, next to the answers in answers.ts (the math
 * scenes.ts pattern). The renderer
 * (src/subjects/shared/ClueScene.tsx) reads these; a later item
 * needs only a new description here, never new code.
 *
 * Answer-blindness is structural, as in math: a description
 * carries only the givens from the item's own question. The
 * renderer receives a description and a phase ("setup" |
 * "solved") — never the answer, a choice, or a pick — so the
 * setup film can only set the scene.
 *
 * Each description also carries its SUMMARY: the narrated
 * walk-through of the solving (act 3), played only after a
 * correct pick. The script lines are word-for-word the captions;
 * the clip timings were measured when the clips were rendered
 * (public/audio/subjects/manifest.json carries the same
 * numbers). The summary sits in the solved-phase data path only.
 *
 * Coverage (expansion waves 3 and 10): every general-knowledge
 * item in every band — ages 7-10 (wave 3: timeline-line, shared
 * by two items, tower-measure, scale-line and bus-boarding
 * reused from math) and, completing the subject at 10/10 in
 * wave 10, the ages 10-18 and 18+ items: stack-drops,
 * angle-sight and flow-counter (new), journey-line reused from
 * math, and great-circle reused from social studies — the
 * shared kind wave 9 parameterised for exactly this reuse.
 *
 * The opera item is the one runtime-built description: its
 * answer is a year gap resolved at play time (answers.ts builds
 * it from the shared years mechanism), so its scene is built the
 * same way — operaSceneForYear(year) is pure, so tests can pin
 * the clock, and clueSceneFor resolves it with the device's
 * current year. Its stored script holds the METHOD ONLY: no
 * line, caption or clip ever carries a baked-in year count; the
 * film's decade hops and their counting ticks are computed from
 * the year at play time.
 */
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";
import { currentYear, yearsSince } from "../shared/years.ts";
import { OPERA_OPENED_YEAR } from "./answers.ts";

export type { ClueSceneDescription };
export {
  countingTicks,
  dealOrder,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "../shared/clue-scene-types.ts";

/**
 * The opera-years-ago description for a given current year.
 * Pure, so tests can pin the clock. The gap is counted off in
 * decade hops (a short last hop when the gap is not a round
 * ten); the beat map splits the hops across the two counting
 * lines. The script is method-only — it names no year and no
 * count, in digits or words.
 */
export function operaSceneForYear(year: number): ClueSceneDescription {
  const gap = yearsSince(OPERA_OPENED_YEAR, year);
  const hops = Math.max(1, Math.ceil(gap / 10));
  const firstHalf = Math.ceil(hops / 2);
  return {
    kind: "timeline-line",
    startYear: OPERA_OPENED_YEAR,
    endYear: year,
    countGap: true,
    labelSetup: "A landmark waits at one end of a long line of years.",
    labelSolved: "The years are counted off along the line in tens.",
    summary: {
      clip: "opera-years.mp3",
      duration: 17.56,
      lines: [
        { text: "Here is the clever way to count the years.", at: 0 },
        { text: "Start at the opening year, and count forward in tens toward this year.", at: 2.85 },
        { text: "Then count the last few years one by one, until you reach this year.", at: 7.75 },
        { text: "Counting from the opening year to this year tells you how many years ago it opened!", at: 12.55 },
      ],
      beats: [0, firstHalf, hops - firstHalf, 0],
    },
  };
}

export const GENERAL_KNOWLEDGE_CLUE_SCENES: Record<string, ClueSceneDescription> = {
  "general-knowledge:mixed:eiffel-antennas": {
    kind: "tower-measure",
    oldHeight: 1024,
    newHeight: 1083,
    labelSetup: "A tower waits beside two height lines.",
    labelSolved: "The gap between the two heights is marked.",
    summary: {
      clip: "eiffel-antennas.mp3",
      duration: 20.34,
      lines: [
        { text: "Here is the clever way to find the new height.", at: 0 },
        { text: "The tower first stood at 1024 feet, and with its antennas it reaches 1083 feet.", at: 3.04 },
        { text: "The new height is the gap between those two heights.", at: 10.95 },
        { text: "1083 take away 1024 leaves 59 feet of new height!", at: 14.24 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "general-knowledge:mixed:older-landmark": {
    kind: "timeline-line",
    startYear: 1889,
    endYear: 1973,
    countGap: false,
    labelSetup: "Two landmarks wait at two ends of a long line of years.",
    labelSolved: "The two years are compared along the line.",
    summary: {
      clip: "older-landmark.mp3",
      duration: 21.52,
      lines: [
        { text: "Here is the clever way to tell which landmark is older.", at: 0 },
        { text: "Lay both years out on one long line.", at: 3.77 },
        { text: "1889 sits farther back on the line than 1973.", at: 6.55 },
        { text: "The year that comes first is the older landmark.", at: 11.8 },
        { text: "1889 comes before 1973, so the Eiffel Tower is the older landmark!", at: 15.1 },
      ],
      beats: [0, 1, 1, 1, 0],
    },
  },
  "general-knowledge:mixed:falls-in-km": {
    kind: "scale-line",
    kilometres: 2,
    metresPerKm: 1000,
    labelSetup: "A wide falls waits beside a measuring bar.",
    labelSolved: "The sign's length is laid out in metre marks.",
    summary: {
      clip: "falls-in-km.mp3",
      duration: 20.19,
      lines: [
        { text: "Here is the clever way to compare the widths.", at: 0 },
        { text: "Two kilometres is 2000 metres, so lay the long bar out in metre marks.", at: 3.06 },
        { text: "The falls stretch 1708 metres, which stops short of 2000 metres.", at: 8.8 },
        { text: "1708 is less than 2000, so the falls is narrower than 2 km!", at: 14.46 },
      ],
      beats: [0, 1, 0, 1],
    },
  },
  "general-knowledge:mixed:everest-vs-falls": {
    kind: "stack-drops",
    dropHeight: 108,
    peakHeight: 8848.86,
    labelSetup: "A tall peak waits beside a waterfall's drop.",
    labelSolved: "Drops stack up beside the peak, one on top of another.",
    summary: {
      clip: "everest-stack.mp3",
      duration: 24.6,
      lines: [
        { text: "Here is the clever way to stack the falls.", at: 0 },
        { text: "Each drop at the falls is 108 metres tall, and Everest stands 8849 metres high.", at: 2.88 },
        { text: "Stack the drops one on top of another beside the peak, and the stack climbs past forty, past sixty.", at: 10.18 },
        { text: "8849 divided by 108 is about 82, so the stack needs About 80 drops!", at: 17.07 },
      ],
      beats: [0, 4, 4, 0],
    },
  },
  "general-knowledge:mixed:paris-sydney-flight": {
    kind: "journey-line",
    totalKm: 850,
    hours: 1,
    targetKm: 17000,
    labelSetup: "A plane waits at the start of a very long journey.",
    labelSolved: "The journey is marked out hour by hour.",
    summary: {
      clip: "paris-sydney.mp3",
      duration: 31.36,
      lines: [
        { text: "Here is the clever way to time the flight.", at: 0 },
        { text: "The plane flies 850 kilometres every hour, so mark the long journey hour by hour.", at: 2.8 },
        { text: "Five hours carry the plane 4250 kilometres.", at: 9.57 },
        { text: "Ten hours carry the plane 8500 kilometres.", at: 13.55 },
        { text: "Fifteen hours, then twenty: the last hour mark reaches Sydney at 17000 kilometres.", at: 17.73 },
        { text: "17000 divided by 850 is 20, so the trip takes About 20 hours!", at: 24.9 },
      ],
      beats: [0, 5, 5, 5, 5, 0],
    },
  },
  "general-knowledge:mixed:tower-angle": {
    kind: "angle-sight",
    distanceFt: 1000,
    angleDeg: 47,
    labelSetup: "An observer waits on the ground, looking up at a tower.",
    labelSolved: "The sight line climbs to the top, and the height is bracketed.",
    summary: {
      clip: "tower-angle.mp3",
      duration: 28.28,
      lines: [
        { text: "Here is the clever way to find the tower's height.", at: 0 },
        { text: "You stand 1000 feet from the tower, and its top sits 47 degrees up from the ground.", at: 3.16 },
        { text: "The height is 1000 times tan of 47 degrees, and tan of 47 degrees is about 1.07.", at: 9.6 },
        { text: "1000 times 1.07 makes about 1072 feet, so the tower stands About 1,072 feet!", at: 18.61 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "general-knowledge:mixed:great-circle": {
    kind: "great-circle",
    route: "south-west",
    labelSetup: "A globe and a flat map each carry two pins, a peak and a falls.",
    labelSolved: "A path arcs over the globe between the two pins, and the same path curves on the map.",
    summary: {
      clip: "everest-falls.mp3",
      duration: 20.07,
      lines: [
        { text: "Here is the clever way to find the shortest way round the Earth.", at: 0 },
        { text: "The shortest route between two places follows a great circle, curving over the surface.", at: 4.03 },
        { text: "Follow that arc from Everest to Victoria Falls, over the round Earth.", at: 9.93 },
        { text: "That great-circle journey measures 8,000 to 8,500 km!", at: 15.01 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "general-knowledge:mixed:falls-flow": {
    kind: "flow-counter",
    perMinute: 500000000,
    minutesPerDay: 1440,
    labelSetup: "A waterfall pours into its pool.",
    labelSolved: "The falling water is counted minute by minute, then day by day.",
    summary: {
      clip: "falls-flow.mp3",
      duration: 20.73,
      lines: [
        { text: "Here is the clever way to count a whole day of falls.", at: 0 },
        { text: "Every minute, 500 million litres pour over the falls.", at: 3.6 },
        { text: "A day holds 1440 minutes, so multiply 500 million by 1440.", at: 7.84 },
        { text: "That makes 720,000,000,000 litres in one day: 7.2 × 10^11 litres!", at: 14.15 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "general-knowledge:mixed:trip-buses": {
    kind: "bus-boarding",
    total: 34,
    seats: 8,
    labelSetup: "People wait in a line at the bus stop.",
    labelSolved: "The people climb onto minibuses, a full bus at a time.",
    summary: {
      clip: "trip-buses.mp3",
      duration: 22.5,
      lines: [
        { text: "Here is the clever way to fill the minibuses.", at: 0 },
        { text: "Thirty children and four adults make 34 people in all.", at: 3.3 },
        { text: "Fill one minibus at a time, eight people on each bus.", at: 7.59 },
        { text: "8, 16.", at: 11.54 },
        { text: "24, 32.", at: 13.02 },
        { text: "Four buses carry 32, and 2 people are still waiting, so one more bus comes: 5 minibuses in all!", at: 15.02 },
      ],
      beats: [0, 0, 0, 2, 2, 1],
    },
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  if (itemId === "general-knowledge:mixed:opera-years-ago") {
    return operaSceneForYear(currentYear());
  }
  return GENERAL_KNOWLEDGE_CLUE_SCENES[itemId] ?? null;
}
