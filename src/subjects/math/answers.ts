/**
 * Math answers (waves 1 and 2) — the I2 rows carry no answer field, so
 * each answer lives here, keyed by item id, derived from that row's why
 * and objective (plan §4 option (a): derive + document + educator
 * sign-off). Every derivation is listed in the PR body for the educator.
 * Wave-2 entries use only the numbers and givens stated in their row's
 * why / objective; the one exception is flagged in its derivation.
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
  // ---- Wave 2, band 7-10 ----
  "math-number:place:hundreds-tens-ones": {
    prompt: "A cashier is handed 3 hundred notes, 4 ten notes and 5 one coins. How much is that in all?",
    choices: ["345", "354", "435"],
    correct: "345",
    value: 345,
    derivation: "3 hundreds + 4 tens + 5 ones = 300 + 40 + 5 = 345.",
  },
  "math-number:place:compare": {
    prompt: "Two routes to the lake are 358 steps and 385 steps. How many steps is the longer route?",
    choices: ["358", "385", "They are the same"],
    correct: "385",
    value: 385,
    derivation: "Both have 3 hundreds; 8 tens beat 5 tens, so 385 is longer than 358.",
  },
  "math-number:place:round": {
    prompt: "A school fair has 287 visitors. Rounded to the nearest 100, how many visitors go on the banner?",
    choices: ["200", "290", "300"],
    correct: "300",
    value: 300,
    derivation: "287 sits between 200 and 300 and is closer to 300, so it rounds to 300.",
  },
  "math-number:place:ten-times": {
    prompt: "A path of 70 steps is stretched by a mapmaker to ten times as long. How many steps is it now?",
    choices: ["77", "700", "7,000"],
    correct: "700",
    value: 700,
    derivation: "70 × 10 = 700; every digit moves one place to the left.",
  },
  "math-number:tables:facts": {
    prompt: "A shop sells pencils in packs of 4. A customer wants 7 packs. How many pencils is that?",
    choices: ["11", "28", "32"],
    correct: "28",
    value: 28,
    derivation: "7 packs × 4 pencils = 28 pencils, from the 4 times table.",
  },
  "math-number:tables:big-products": {
    prompt: "A hall has 8 rows of 126 chairs for a concert. How many seats are there in all?",
    choices: ["968", "1,008", "1,088"],
    correct: "1,008",
    value: 1008,
    derivation: "126 × 8 = 1,008 seats (100 × 8 + 26 × 8 = 800 + 208).",
  },
  "math-number:division:fair-share": {
    prompt: "Twelve snacks are shared fairly among 4 friends. How many snacks does each friend get?",
    choices: ["2", "3", "4"],
    correct: "3",
    value: 3,
    derivation: "12 snacks ÷ 4 friends = 3 snacks each.",
  },
  "math-number:division:unknown-factor": {
    prompt: "A box holds 8 pencils and there are 40 pencils to pack. How many boxes are needed?",
    choices: ["4", "5", "6"],
    correct: "5",
    value: 5,
    derivation: "8 × 5 = 40, so 40 pencils ÷ 8 to a box = 5 boxes.",
  },
  "math-number:division:remainders": {
    prompt: "There are 26 children and each bus seats 6. How many buses must be booked so nobody is left behind?",
    choices: ["4", "5", "6"],
    correct: "5",
    value: 5,
    derivation: "26 ÷ 6 fills 4 buses with 2 children left over, so one more bus is needed: 5.",
  },
  "math-number:division:big-quotients": {
    prompt: "A school library puts 1,248 books evenly onto 8 shelves. How many books go on each shelf?",
    choices: ["146", "156", "166"],
    correct: "156",
    value: 156,
    derivation: "1,248 ÷ 8 = 156 books on each shelf, with none left over.",
  },
  // ---- Wave 2, band 10-18 ----
  "math-applied:geometry:scale-drawing": {
    prompt:
      "A map says 1 centimetre stands for 2 kilometres. A river is 4 centimetres long on the map. How many kilometres long is it on the ground?",
    choices: ["2", "6", "8"],
    correct: "8",
    value: 8,
    derivation: "4 centimetres × 2 kilometres per centimetre = 8 kilometres.",
  },
  "math-number:division:standard-algorithm": {
    prompt: "A trip costs 4,368 coins in total and 28 people share the cost equally. How many coins does each person pay?",
    choices: ["146", "156", "166"],
    correct: "156",
    value: 156,
    derivation: "4,368 ÷ 28 = 156 coins each (28 × 156 = 4,368).",
  },
  "math-number:fractions:multiply": {
    prompt: "A recipe needs 2/3 of a cup, but only half of the recipe is being made. How many cups are needed?",
    choices: ["1/3", "2/3", "4/3"],
    correct: "1/3",
    value: 1 / 3,
    derivation: "Half of 2/3 is 2/3 × 1/2 = 1/3 of a cup.",
  },
  "math-number:fractions:divide": {
    prompt: "A roll of ribbon is 6 metres long and each ribbon takes 3/4 of a metre. How many ribbons can be cut?",
    choices: ["4.5", "8", "12"],
    correct: "8",
    value: 8,
    derivation: "6 ÷ 3/4 = 6 × 4/3 = 8 ribbons.",
  },
  "math-applied:measure:accuracy": {
    prompt:
      "A tape's smallest mark is a centimetre. A report writes a beam as 2.4837 metres. What should the report say, in metres?",
    choices: ["2.4837", "2.48", "2.4"],
    correct: "2.48",
    value: 2.48,
    derivation: "Centimetre marks support hundredths of a metre, and 2.4837 rounds to 2.48.",
  },
  "math-applied:rates:unit-rate": {
    prompt:
      "One stall sells 3 metres of rope for 6 coins; another sells 5 metres for 8 coins. How many coins is one metre at the cheaper stall?",
    choices: ["1.6", "2", "2.5"],
    correct: "1.6",
    value: 1.6,
    derivation: "6 ÷ 3 = 2 coins per metre and 8 ÷ 5 = 1.6 coins per metre, so the cheaper metre costs 1.6 coins.",
  },
  "math-applied:rates:constant-speed": {
    prompt:
      "A walker covers 12 kilometres in 3 hours at one steady pace. How many hours does a path of 20 kilometres take at the same pace?",
    choices: ["4", "5", "6"],
    correct: "5",
    value: 5,
    derivation: "12 ÷ 3 = 4 kilometres in one hour, and 20 ÷ 4 = 5 hours.",
  },
  "math-applied:rates:one-step": {
    prompt: "A trail is 12 kilometres long and 5 kilometres are still ahead. How many kilometres has the walker already gone?",
    choices: ["5", "7", "17"],
    correct: "7",
    value: 7,
    derivation: "12 − 5 = 7 kilometres already walked.",
  },
  "math-applied:rates:two-step": {
    prompt: "A stall charges 4 coins once, then 3 coins for each cup. The budget is 19 coins. How many cups fit?",
    choices: ["4", "5", "6"],
    correct: "5",
    value: 5,
    derivation: "19 − 4 = 15 coins left for cups, and 15 ÷ 3 = 5 cups.",
  },
  "math-applied:trig:bearings": {
    prompt:
      "A boat must go 6 kilometres east and 8 kilometres north. What is its bearing — the angle from north, to the nearest degree?",
    choices: ["37°", "45°", "53°"],
    correct: "37°",
    derivation:
      "The angle from north has tangent 6 ÷ 8 = 0.75, which is about 37°. (Judgment call flagged for the educator: the row states the two distances but no angle; the answer needs inverse tangent and rounding to the nearest degree.)",
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
