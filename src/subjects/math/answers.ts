/**
 * Math answers (wave 1) — the I2 rows carry no answer field, so each
 * answer lives here, keyed by item id, derived from that row's why and
 * objective (plan §4 option (a): derive + document + educator sign-off).
 * Every derivation is listed in the PR body for the educator.
 *
 * Each entry is one multiple-choice question in the shared AnswerEntry
 * shape (src/subjects/shared/answer.ts). A year-based answer is resolved
 * from the device's current year at play time through the shared
 * yearsSince mechanism — no wave-1 math row is year-based, so no
 * shipped entry uses it yet; general knowledge does.
 */
import type { AnswerEntry } from "../shared/answer.ts";

export type MathAnswerEntry = AnswerEntry;

export { yearsSince, currentYear } from "../shared/years.ts";

export const MATH_ANSWERS: Record<string, MathAnswerEntry> = {
  "math-number:groups:skip-count": {
    prompt: "Forty coins are counted in 5s. How many groups of 5 is that?",
    choices: ["6", "8", "10"],
    correct: "8",
    value: 8,
    derivation: "40 coins in 5s = 8 groups (8 × 5 = 40).",
  },
  "math-number:groups:equal-groups": {
    prompt: "Four boxes hold 6 pencils each. How many pencils in all?",
    choices: ["18", "24", "30"],
    correct: "24",
    value: 24,
    derivation: "4 boxes × 6 pencils = 24 pencils.",
  },
  "math-number:tables:buses": {
    prompt: "The class trip has 24 children and each bus seats 6. How many buses do we book?",
    choices: ["3", "4", "6"],
    correct: "4",
    value: 4,
    derivation: "24 children ÷ 6 seats = 4 buses.",
  },
  "math-number:tables:multi-digit": {
    prompt: "A floor is tiled in 23 rows of 47 tiles. How many tiles in all?",
    choices: ["961", "1,071", "1,081"],
    correct: "1,081",
    value: 1081,
    derivation: "23 rows × 47 tiles = 1,081 tiles.",
  },
  "math-applied:measure:convert-metric": {
    prompt: "A map labels a river stretch 2.4 kilometres. The tape is marked in metres. How many metres is that walk?",
    choices: ["240", "2,400", "24,000"],
    correct: "2,400",
    value: 2400,
    derivation: "2.4 km × 1,000 = 2,400 metres.",
  },
  "math-number:fractions:percent": {
    prompt: "A shop takes 30% off a price of 80 coins. How many coins do you pay?",
    choices: ["24", "56", "70"],
    correct: "56",
    value: 56,
    derivation: "30% of 80 = 24 saved; 80 − 24 = 56 paid.",
  },
  "math-number:tables:mental-strategies": {
    prompt: "Split it in your head: what is 24 × 15?",
    choices: ["340", "360", "420"],
    correct: "360",
    value: 360,
    derivation:
      "24 × 15 = 24 × 10 + 24 × 5 = 240 + 120 = 360. (The row names no numbers; this example follows its objective — splitting a two-digit product — and is flagged for the educator.)",
  },
  "math-number:fractions:combine-shares": {
    prompt:
      "Four friends split a 120-coin bill: one pays 1/2, one pays 1/4, and the last two split the rest equally. One of those two gets 10% off their share. How many coins does that friend pay?",
    choices: ["15", "13.5", "12"],
    correct: "13.5",
    value: 13.5,
    derivation: "120 − 60 (1/2) − 30 (1/4) = 30 left; 30 ÷ 2 = 15; 10% off 15 = 13.5.",
  },
  "math-applied:measure:survey-check": {
    prompt:
      "Two crews measure one beam and disagree by more than the tape's smallest mark. What should the buyer do?",
    choices: ["Use the longer report", "Measure the beam again", "Use the shorter report"],
    correct: "Measure the beam again",
    derivation:
      "The row's objective: choose a remeasure when two reports disagree by more than the tape's smallest mark.",
  },
};

export function answerFor(itemId: string): MathAnswerEntry | null {
  return MATH_ANSWERS[itemId] ?? null;
}
