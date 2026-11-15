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
 * Coverage (expansion wave 3): every general-knowledge item for
 * ages 7-10 — timeline-line (new, shared by two items),
 * tower-measure (new), scale-line and bus-boarding reused from
 * math. Other bands carry no descriptions; their clue cards are
 * unchanged.
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
