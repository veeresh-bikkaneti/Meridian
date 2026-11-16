/**
 * Math answers (waves 1 to 3) — the I2 rows carry no answer field, so
 * each answer lives here, keyed by item id, derived from that row's why
 * and objective (plan §4 option (a): derive + document + educator
 * sign-off). Every derivation is listed in the PR body for the educator.
 * Wave-2 entries use only the numbers and givens stated in their row's
 * why / objective; the one exception is flagged in its derivation.
 * Wave-3 entries split the same way: the rows that stated their givens
 * use them verbatim, and the rows that stated no numbers carry authored
 * givens, each flagged in its derivation for the educator (the wave-1
 * mental-strategies precedent).
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
  // ---- Wave 3, band 7-10 (givens stated in the row) ----
  "math-number:fractions:fair-parts": {
    prompt: "Four friends share one pizza, cut into equal parts so nobody gets a bigger piece. What do we call one piece?",
    choices: ["1/2", "1/4", "1/3"],
    correct: "1/4",
    value: 1 / 4,
    derivation: "One pizza cut into 4 equal parts: each part is 1/4 of the pizza.",
  },
  "math-number:fractions:equivalent": {
    prompt:
      "Two pizzas are the same size. One is cut into 2 pieces and a friend takes 1; the other is cut into 4 pieces and a friend takes 2. Who has more?",
    choices: ["The friend with 1 of 2 pieces", "They have the same amount", "The friend with 2 of 4 pieces"],
    correct: "They have the same amount",
    derivation: "1/2 and 2/4 name the same amount: 2/4 is 1/2 written with smaller pieces.",
  },
  "math-number:fractions:compare-unlike": {
    prompt: "Two bottles of the same size are 3/4 full and 2/3 full. Which bottle holds more?",
    choices: ["The 3/4-full bottle", "The 2/3-full bottle", "They hold the same"],
    correct: "The 3/4-full bottle",
    derivation: "3/4 = 9/12 and 2/3 = 8/12, so 3/4 holds more.",
  },
  // ---- Wave 3, band 7-10 (authored givens, flagged per entry) ----
  "math-number:groups:arrays": {
    prompt: "A wall is built in 4 rows of 5 bricks. How many bricks are there in all?",
    choices: ["9", "20", "25"],
    correct: "20",
    value: 20,
    derivation:
      "4 rows of 5 bricks = 5 + 5 + 5 + 5 = 20 bricks. (The row names no numbers; this example follows its objective — finding the total in a rectangle of rows by adding the rows — and is flagged for the educator.)",
  },
  "math-applied:measure:longer-than": {
    prompt: "A board measures 86 centimetres and a shelf measures 92 centimetres. How many centimetres longer is the shelf than the board?",
    choices: ["6", "8", "178"],
    correct: "6",
    value: 6,
    derivation:
      "92 − 86 = 6 centimetres longer. (The row names no numbers; this example follows its objective — comparing two measured lengths and finding the centimetre gap — and is flagged for the educator.)",
  },
  "math-applied:measure:choose-unit": {
    prompt: "You are measuring the long path to the river. Which unit fits best?",
    choices: ["Millimetres", "Centimetres", "Metres"],
    correct: "Metres",
    derivation:
      "A long path is measured in metres; centimetres and millimetres fit short lengths. (The row names no numbers; this example follows its objective — choosing centimetres or metres for a short shelf and a long path, asking the path — and is flagged for the educator.)",
  },
  "math-applied:measure:elapsed-time": {
    prompt: "A walk starts at 10:15 and must end at 10:50. How many minutes sit between those two times?",
    choices: ["25", "35", "45"],
    correct: "35",
    value: 35,
    derivation:
      "From 10:15 to 10:50 is 50 − 15 = 35 minutes. (The row names no numbers; this example follows its objective — computing the minutes between two clock times — and is flagged for the educator.)",
  },
  "math-applied:measure:perimeter": {
    prompt: "A sandbox is 4 metres long and 3 metres wide. How much border is needed to go all the way around it?",
    choices: ["7", "12", "14"],
    correct: "14",
    value: 14,
    derivation:
      "4 + 3 + 4 + 3 = 14 metres of border. (The row names no numbers; this example follows its objective — totalling the sides of a sandbox border — and is flagged for the educator.)",
  },
  "math-applied:measure:rect-area": {
    prompt: "A rectangular floor is 5 metres long and 3 metres wide. What is its area, in square metres?",
    choices: ["8", "15", "16"],
    correct: "15",
    value: 15,
    derivation:
      "5 × 3 = 15 square metres, the same as counting every tile. (The row names no numbers; this example follows its objective — the area of a rectangle from its length and width — and is flagged for the educator.)",
  },
  // ---- Wave 3, band 10-18 (givens stated in the row) ----
  "math-number:division:two-digit-divisors": {
    prompt: "A builder has 157 bricks to load onto pallets of 12. How many full pallets can be loaded?",
    choices: ["12", "13", "14"],
    correct: "13",
    value: 13,
    derivation: "157 ÷ 12 = 13 full pallets with 1 brick left over (13 × 12 = 156, and 156 + 1 = 157).",
  },
  "math-number:fractions:add-unlike": {
    prompt: "A recipe wants 1/2 of a cup of one thing and 1/3 of a cup of another. How much is that altogether?",
    choices: ["1/6", "2/5", "5/6"],
    correct: "5/6",
    value: 5 / 6,
    derivation: "1/2 + 1/3 = 3/6 + 2/6 = 5/6 of a cup.",
  },
  "math-applied:trig:missing-angle": {
    prompt: "A ramp rises 1 metre over a 4 metre run. How steep is it, in degrees, to the nearest degree?",
    choices: ["14°", "45°", "76°"],
    correct: "14°",
    derivation:
      "The steepness angle has tangent 1 ÷ 4 = 0.25, which is about 14°. (Judgment call flagged for the educator: the row states the rise and run but no angle; the answer needs inverse tangent and rounding to the nearest degree, the same method as the played trig:bearings item, for which this row is the prerequisite.)",
  },
  // ---- Wave 3, band 10-18 (authored givens, flagged per entry) ----
  "math-number:place:decimal-shifts": {
    prompt: "A distance is written as 4.6 kilometres. The mapmaker rewrites every distance ten times larger. What is the new number?",
    choices: ["0.46", "46", "460"],
    correct: "46",
    value: 46,
    derivation:
      "4.6 × 10 = 46; every digit moves one place to the left. (The row names no numbers; this example follows its objective — how a digit's value changes by a factor of 10 — and is flagged for the educator.)",
  },
  "math-applied:measure:volume-box": {
    prompt: "A crate is 4 cubes long, 3 cubes wide and 2 cubes high. How many unit cubes fill it?",
    choices: ["9", "14", "24"],
    correct: "24",
    value: 24,
    derivation:
      "4 × 3 × 2 = 24 unit cubes. (The row names no numbers; this example follows its objective — how many unit cubes fill a rectangular box, from its edge lengths — and is flagged for the educator.)",
  },
  "math-applied:geometry:coordinates": {
    prompt: "On a grid map, a bridge sits at (2, 5) and a camp sits at (9, 5), on the same horizontal line. How many units apart are they?",
    choices: ["4", "7", "11"],
    correct: "7",
    value: 7,
    derivation:
      "Both points share the height 5, so subtract the first numbers: 9 − 2 = 7 units. (The row names no numbers; this example follows its objective — the length of a horizontal side from coordinates that share one coordinate — and is flagged for the educator.)",
  },
  "math-applied:geometry:pythagoras": {
    prompt:
      "A ramp must reach a door 6 metres up, with an 8 metre ground run and a square corner on the ground. How long is the sloping board?",
    choices: ["10", "12", "14"],
    correct: "10",
    value: 10,
    derivation:
      "6² + 8² = 36 + 64 = 100, and the square root of 100 is 10, so the board is 10 metres. (The row names no numbers; this example follows its objective — the sloping side of a right triangle from its rise and ground run — and is flagged for the educator.)",
  },
  "math-applied:geometry:distance-points": {
    prompt: "A bridge sits at grid point (1, 2) and a camp sits at (4, 6). How many units is the straight line between them?",
    choices: ["5", "7", "9"],
    correct: "5",
    value: 5,
    derivation:
      "The points differ by 3 across and 4 up; 3² + 4² = 9 + 16 = 25, and the square root of 25 is 5 units. (The row names no numbers; this example follows its objective — the straight-line distance between two coordinate points — and is flagged for the educator.)",
  },
  "math-applied:geometry:cylinder-volume": {
    prompt:
      "A rain barrel is a cylinder with radius 2 metres and height 5 metres. Using 3.14 in the circle rule, how many cubic metres of water fit?",
    choices: ["31.4", "62.8", "125.6"],
    correct: "62.8",
    value: 62.8,
    derivation:
      "3.14 × 2² × 5 = 3.14 × 4 × 5 = 62.8 cubic metres. (The row names no numbers; this example follows its objective — the volume of a cylinder when the problem says to use 3.14 in the circle rule — and is flagged for the educator.)",
  },
  "math-applied:rates:proportion": {
    prompt:
      "A walk covers the same distance each hour: 2 hours is 8 kilometres and 3 hours is 12 kilometres. How many kilometres is that in one hour — the single number that fills every row?",
    choices: ["2", "4", "6"],
    correct: "4",
    value: 4,
    derivation:
      "8 ÷ 2 = 4 and 12 ÷ 3 = 4, so each hour adds 4 kilometres. (The row names no numbers; this example follows its objective — the constant of proportionality in a table of hours and kilometres — and is flagged for the educator.)",
  },
  "math-applied:rates:rearrange": {
    prompt: "The rule is distance = speed × time. A trip covers 60 kilometres at 12 kilometres per hour. How many hours does it take?",
    choices: ["5", "6", "72"],
    correct: "5",
    value: 5,
    derivation:
      "Turning the rule around: time = distance ÷ speed = 60 ÷ 12 = 5 hours. (The row names no numbers; this example follows its objective — rearranging distance = speed × time to find the missing time — and is flagged for the educator.)",
  },
  "math-applied:rates:linear-model": {
    prompt: "A tank starts with 90 litres of water and loses 15 litres each day. On which day does the tank reach empty?",
    choices: ["Day 5", "Day 6", "Day 7"],
    correct: "Day 6",
    value: 6,
    derivation:
      "90 ÷ 15 = 6, so the tank reaches empty on day 6. (The row names no numbers; this example follows one part of its objective — entering the day the tank reaches empty — and is flagged for the educator.)",
  },
  "math-applied:trig:ratios": {
    prompt: "A ramp rises 3 metres and its sloping side is 5 metres. What is the rise divided by the sloping side?",
    choices: ["0.6", "0.8", "1.25"],
    correct: "0.6",
    value: 0.6,
    derivation:
      "3 ÷ 5 = 0.6, a number that belongs to the ramp's angle, not its size. (The row names no numbers; this example follows its objective — a side ratio for an acute angle, rise divided by the sloping side — and is flagged for the educator.)",
  },
  "math-applied:trig:missing-side": {
    prompt:
      "A pole casts a shadow 9 metres long. The sun sits at 45° above the ground, an angle where a pole's height equals its shadow's length. How many metres tall is the pole?",
    choices: ["6", "9", "18"],
    correct: "9",
    value: 9,
    derivation:
      "At 45° the height and the shadow are equal, so the pole is 9 metres tall. (The row names no numbers; this example follows its objective — a missing side from an acute angle and one side, a pole's height from its shadow — and is flagged for the educator.)",
  },
  "math-applied:trig:triangle-area": {
    prompt:
      "A triangular roof panel has two sides of 10 metres and 8 metres with a 30° angle between them. The area rule is 1/2 × first side × second side × sin of the angle between them, and sin 30° is 0.5. How many square metres of sheet are needed?",
    choices: ["20", "40", "80"],
    correct: "20",
    value: 20,
    derivation:
      "1/2 × 10 × 8 × 0.5 = 20 square metres. (The row names no numbers; this example follows its objective — the area of a triangle that is not a right triangle, from two sides and the included angle — and is flagged for the educator.)",
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
