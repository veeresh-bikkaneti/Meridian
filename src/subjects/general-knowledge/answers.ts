/**
 * General knowledge answers — the I2 rows carry no answer field, so
 * each answer lives here, keyed by item id, derived from that row's
 * why and objective. Every derivation is listed in the PR body for
 * educator review (review runs alongside release, owner rule Nov 13).
 *
 * The opera-years-ago entry is a year-gap answer: it is built at play
 * time from the shared yearsSince mechanism and the device's current
 * year — the answer is never typed into content (owner rule). All
 * other entries are static.
 */
import type { AnswerEntry } from "../shared/answer.ts";
import { currentYear, yearsSince } from "../shared/years.ts";

/** The year the Sydney Opera House opened (from the item's why). */
export const OPERA_OPENED_YEAR = 1973;

/**
 * The opera-years-ago entry for a given current year. Pure, so tests
 * can pin the clock and fake two different years.
 */
export function operaYearsEntry(year: number): AnswerEntry {
  const value = yearsSince(OPERA_OPENED_YEAR, year);
  return {
    prompt: `A postcard says the Sydney Opera House opened in ${OPERA_OPENED_YEAR}. How many years ago was that?`,
    choices: [String(value - 3), String(value), String(value + 4)],
    correct: String(value),
    value,
    derivation: `${year} − ${OPERA_OPENED_YEAR} = ${value} years.`,
  };
}

export const GENERAL_KNOWLEDGE_ANSWERS: Record<string, AnswerEntry> = {
  "general-knowledge:mixed:eiffel-antennas": {
    prompt:
      "When it opened in 1889, the Eiffel Tower was 1,024 feet tall. With today's antennas it is 1,083 feet. How much taller is it now?",
    choices: ["49 feet", "59 feet", "69 feet"],
    correct: "59 feet",
    value: 59,
    derivation: "1,083 − 1,024 = 59 feet.",
  },
  "general-knowledge:mixed:trip-buses": {
    prompt:
      "A class of 30 children and 4 adults is going to see a waterfall. Each minibus seats 8. How many minibuses do they book?",
    choices: ["4", "5", "6"],
    correct: "5",
    value: 5,
    derivation: "30 + 4 = 34 people; 34 ÷ 8 = 4 remainder 4, so one more bus is needed: 5 minibuses.",
  },
  "general-knowledge:mixed:everest-vs-falls": {
    prompt:
      "Mount Everest is 8,848.86 m high. The main drop at Victoria Falls is 108 m high. About how many of those drops, stacked up, would reach the top of Everest?",
    choices: ["About 8", "About 80", "About 800"],
    correct: "About 80",
    derivation: "8,848.86 ÷ 108 ≈ 82, so about 80 drops.",
  },
  "general-knowledge:mixed:paris-sydney-flight": {
    prompt:
      "Paris to Sydney is about 17,000 km. A plane keeps a steady 850 km/h. About how long is the trip?",
    choices: ["About 2 hours", "About 20 hours", "About 200 hours"],
    correct: "About 20 hours",
    value: 20,
    derivation: "17,000 ÷ 850 = 20 hours.",
  },
  "general-knowledge:mixed:tower-angle": {
    prompt:
      "Standing 1,000 feet from the Eiffel Tower's centre, the top is about 47 degrees up. About how tall is the tower?",
    choices: ["About 470 feet", "About 1,072 feet", "About 2,140 feet"],
    correct: "About 1,072 feet",
    derivation: "Height ≈ 1,000 × tan(47°) ≈ 1,000 × 1.07 ≈ 1,072 feet.",
  },
  "general-knowledge:mixed:great-circle": {
    prompt:
      "On a globe, the shortest route between two places follows a great circle, not a straight line on a flat map. About how far is it from Mount Everest to Victoria Falls along the surface?",
    choices: ["800 to 850 km", "8,000 to 8,500 km", "80,000 to 85,000 km"],
    correct: "8,000 to 8,500 km",
    derivation:
      "The haversine formula on the two pins' latitude and longitude gives a surface distance in the 8,000 to 8,500 km band.",
  },
  "general-knowledge:mixed:falls-flow": {
    prompt:
      "At its highest flood, up to about 500 million litres a minute go over Victoria Falls. How much is that in one day, in scientific notation?",
    choices: ["7.2 × 10^9 litres", "7.2 × 10^11 litres", "7.2 × 10^13 litres"],
    correct: "7.2 × 10^11 litres",
    derivation: "500,000,000 × 1,440 minutes = 720,000,000,000 = 7.2 × 10^11 litres in a day.",
  },
};

export function answerFor(itemId: string): AnswerEntry | null {
  if (itemId === "general-knowledge:mixed:opera-years-ago") {
    return operaYearsEntry(currentYear());
  }
  return GENERAL_KNOWLEDGE_ANSWERS[itemId] ?? null;
}
