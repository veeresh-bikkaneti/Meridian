/**
 * Social studies answers — the I2 rows carry no answer field, so each
 * answer lives here, keyed by item id, derived from that row's why
 * and objective. Every derivation is listed in the PR body for
 * educator review (review runs alongside release, owner rule Nov 13).
 *
 * Numbers come from the row's why wherever the why carries them
 * (density, trip-clock, scale-ratio, travel-time). Two questions use
 * an example built from the objective, as math's unreviewed items
 * did: area-by-squares (rows of squares) and trip-cost (example
 * prices, labelled as such in the question, per the screened-topics
 * limit for money questions).
 */
import type { AnswerEntry } from "../shared/answer.ts";

export const SOCIAL_STUDIES_ANSWERS: Record<string, AnswerEntry> = {
  "social-studies:region:area-by-squares": {
    prompt:
      "One field covers 3 rows of 4 grid squares. Another field covers 2 rows of 4 grid squares. Which field is bigger, and by how many squares?",
    choices: ["The first field, by 4 squares", "The second field, by 4 squares", "They are the same size"],
    correct: "The first field, by 4 squares",
    value: 4,
    derivation: "3 × 4 = 12 squares and 2 × 4 = 8 squares; 12 − 8 = 4, so the first field is bigger by 4 squares.",
  },
  "social-studies:route:count-the-steps": {
    prompt:
      "The map's scale bar is marked 10 km. The route from school to the museum measures 4 bar lengths along the map. How far is the trip?",
    choices: ["14 km", "40 km", "400 km"],
    correct: "40 km",
    value: 40,
    derivation: "4 bar lengths × 10 km = 40 km.",
  },
  "social-studies:route:trip-clock": {
    prompt: "The bus drives 40 km every hour, and the museum is 120 km away. How many hours does the trip take?",
    choices: ["2 hours", "3 hours", "4 hours"],
    correct: "3 hours",
    value: 3,
    derivation: "120 ÷ 40 = 3 hours.",
  },
  "social-studies:region:density": {
    prompt:
      "Town A has 1,000 people in 2 square km. Town B has 1,000 people in 8 square km. Which town is more crowded?",
    choices: ["Town A", "Town B", "They are equally crowded"],
    correct: "Town A",
    derivation:
      "Town A: 1,000 ÷ 2 = 500 people per square km. Town B: 1,000 ÷ 8 = 125 per square km, so Town A is more crowded.",
  },
  "social-studies:route:scale-ratio": {
    prompt:
      "A hiking map is drawn at a scale of 1:50,000. The trail measures 7 cm on the map. How far is the real walk?",
    choices: ["0.35 km", "3.5 km", "35 km"],
    correct: "3.5 km",
    value: 3.5,
    derivation: "7 × 50,000 = 350,000 cm on the ground, and 350,000 cm = 3.5 km.",
  },
  "social-studies:route:travel-time": {
    prompt: "You live 90 km from the station and ride at a steady 15 km/h. How long does the ride take?",
    choices: ["3 hours", "6 hours", "9 hours"],
    correct: "6 hours",
    value: 6,
    derivation: "Time = distance ÷ speed: 90 ÷ 15 = 6 hours.",
  },
  "social-studies:region:flat-map-area": {
    prompt: "On a common flat wall map, Greenland looks about as large as Africa. What is really true?",
    choices: [
      "Africa is far bigger — the flat map stretches places near the poles",
      "Greenland and Africa are the same size",
      "Greenland is really bigger than Africa",
    ],
    correct: "Africa is far bigger — the flat map stretches places near the poles",
    derivation:
      "A flat map stretches regions near the poles, so Greenland only looks as large as Africa; Africa is far bigger.",
  },
  "social-studies:route:great-circle": {
    prompt: "On a flat map, a long flight's shortest path bends toward the pole instead of looking straight. Why?",
    choices: [
      "That curved-looking path is the shortest route on the round Earth",
      "Pilots curve the path to save paperwork",
      "A straight line on the flat map is always shorter",
    ],
    correct: "That curved-looking path is the shortest route on the round Earth",
    derivation:
      "The Earth is round: the shortest surface route follows a great circle, which looks curved on a flat map.",
  },
  "social-studies:compare:trip-cost": {
    prompt:
      "With these example prices, a delivery van can take the toll road: 80 km, $10 of fuel plus a $6 toll. Or the free road: 100 km, $13 of fuel and no toll. Which route costs less money, and by how much?",
    choices: ["The free road, by $3", "The toll road, by $3", "They cost the same"],
    correct: "The free road, by $3",
    value: 3,
    derivation: "Toll road: $10 + $6 = $16. Free road: $13. $16 − $13 = $3, so the free road costs $3 less.",
  },
};

export function answerFor(itemId: string): AnswerEntry | null {
  return SOCIAL_STUDIES_ANSWERS[itemId] ?? null;
}
