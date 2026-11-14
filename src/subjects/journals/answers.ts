/**
 * Journals answers (contract I2) — Stream D, PR D1.
 *
 * One multiple-choice question per item, keyed by item id. Numbers come
 * from the clip row (why, stretch question, facts) and live only in the
 * question, the choices and the derivation. Year-gap answers are
 * computed from the device's year at play time (owner rule), never typed.
 *
 * Judgment calls (flagged in the PR body): the practice-rate and
 * practice-triangle items (Andean roads, Aconcagua), and the Pont du Gard
 * grouping, which the row itself labels a practice frame.
 */
import type { AnswerEntry, AnswerFor } from "../shared/answer.ts";
import { currentYear, yearsSince } from "../shared/years.ts";

export { currentYear, yearsSince };

/** Every D1 answer, for a given current year (pinned in tests). */
export function journalAnswers(year: number): Record<string, AnswerEntry> {
  const firstPhoneYears = yearsSince(1876, year);
  const liverpoolYears = yearsSince(1830, year);
  // Fixed-date gaps are computed from the row's dates, not typed.
  const lincolnYears = 1922 - 1914;
  const mobileYears = 1973 - 1876;
  return {
    // ---- 7-10 ----
    "great-leaders:lincoln-memorial": {
      prompt: "Work began in 1914 and the memorial was dedicated in 1922. How many years did it take to build?",
      choices: ["6", String(lincolnYears), "10"],
      correct: String(lincolnYears),
      derivation: `1922 − 1914 = ${lincolnYears} years.`,
      value: lincolnYears,
    },
    "technology:first-phone": {
      prompt: `In 1876, Bell's phone sent a spoken message. It is ${year} now. How many years ago was that?`,
      choices: [String(firstPhoneYears + 10), String(firstPhoneYears), String(firstPhoneYears - 10)],
      correct: String(firstPhoneYears),
      derivation: `${year} − 1876 = ${firstPhoneYears} years.`,
      value: firstPhoneYears,
    },
    "technology:eniac": {
      prompt: "The room is 50 feet long and 30 feet wide. How many square feet of floor does it cover?",
      choices: ["80", "1,500", "800"],
      correct: "1,500",
      derivation: "50 × 30 = 1,500 square feet.",
      value: 1500,
    },
    "modern-world:greenwich-zero": {
      prompt: "Where is the line that maps call zero?",
      choices: ["Paris, France", "Greenwich, at the Royal Observatory", "Rome, Italy"],
      correct: "Greenwich, at the Royal Observatory",
      derivation: "Zero is the line of longitude at the Royal Observatory in Greenwich, England.",
    },
    "modern-world:liverpool-manchester": {
      prompt: `A steam railway joined Liverpool and Manchester in 1830. It is ${year} now. How many years ago was that?`,
      choices: [String(liverpoolYears - 10), String(liverpoolYears), String(liverpoolYears + 10)],
      correct: String(liverpoolYears),
      derivation: `${year} − 1830 = ${liverpoolYears} years.`,
      value: liverpoolYears,
    },
    "modern-world:hearts-content-cable": {
      prompt: "Where did the 1866 cable come ashore in Newfoundland?",
      choices: ["St. John's", "Heart's Content", "Corner Brook"],
      correct: "Heart's Content",
      derivation: "The 1866 cable came ashore at Heart's Content, Newfoundland.",
    },
    "people-places:pont-du-gard": {
      prompt: "The top row has 5 groups of 7 arches (a practice grouping, not a claim about the builders). How many arches is that?",
      choices: ["12", "35", "30"],
      correct: "35",
      derivation: "5 × 7 = 35 arches (a practice grouping of the sourced count).",
      value: 35,
    },
    "people-places:akashi-span": {
      prompt: "Each side span is 960 meters. How long are the two side spans together?",
      choices: ["960", "1,920", "1,991"],
      correct: "1,920",
      derivation: "960 × 2 = 1,920 meters.",
      value: 1920,
    },
    // ---- 10-18 ----
    "technology:mobile-phone": {
      prompt: "Solve 1876 + x = 1973. What is x?",
      choices: ["107", String(mobileYears), "87"],
      correct: String(mobileYears),
      derivation: `1973 − 1876 = ${mobileYears} years.`,
      value: mobileYears,
    },
    "great-leaders:lincoln-memorial:stretch": {
      prompt: "Each outside column is 44 feet tall. The seated statue is 19 feet tall. Solve 19 + x = 44. How much taller is a column?",
      choices: ["25", "19", "63"],
      correct: "25",
      derivation: "44 − 19 = 25 feet taller than the statue.",
      value: 25,
    },
    "modern-world:greenwich-zero:stretch": {
      prompt: "A full turn is 360 degrees. The clock day has 24 hours. How many degrees is one hour?",
      choices: ["24", "15", "360"],
      correct: "15",
      derivation: "360 ÷ 24 = 15 degrees per hour.",
      value: 15,
    },
    "modern-world:liverpool-manchester:stretch": {
      prompt: "In an 1829 trial the Rocket went 36 miles in one hour. That was a trial speed. If it kept that speed for 2 hours, how many miles would it go?",
      choices: ["36", "72", "38"],
      correct: "72",
      derivation: "36 × 2 = 72 miles.",
      value: 72,
    },
    "modern-world:hearts-content-cable:stretch": {
      prompt: "1,852 miles of cable were laid in 14 days. Which is closest to the miles per day: 100, 130, or 200?",
      choices: ["100", "200", "130"],
      correct: "130",
      derivation: "1,852 ÷ 14 is about 132 miles a day, closest to 130.",
      value: 130,
    },
    "people-places:eratosthenes-earth": {
      prompt: "Cleomedes' account says 5,000 stadia is one fiftieth of a full circle. How many stadia is the whole circle, by that account?",
      choices: ["5,000", "100,000", "250,000"],
      correct: "250,000",
      derivation: "50 × 5,000 = 250,000 stadia. No kilometer conversion is given.",
      value: 250000,
    },
    "people-places:andean-roads": {
      prompt: "The road network is about 30,000 kilometers. At a practice rate of 100 kilometers a day, how many days is that?",
      choices: ["30", "3,000", "300"],
      correct: "300",
      derivation: "30,000 ÷ 100 = 300 days, at a practice rate.",
      value: 300,
    },
    // ---- 18+ ----
    "people-places:aconcagua-height": {
      prompt: "Practice triangle: the ground distance is 100 meters and the angle is 45 degrees. Tangent of 45 degrees is 1. How tall is the practice triangle?",
      choices: ["45 meters", "141 meters", "100 meters"],
      correct: "100 meters",
      derivation: "Height = ground distance × tangent = 100 × 1 = 100 meters, for the practice triangle only.",
      value: 100,
    },
  };
}

/** The answer lookup used by the case flow, at the device's year. */
export const answerFor: AnswerFor = (itemId) => journalAnswers(currentYear())[itemId] ?? null;
