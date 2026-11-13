/**
 * Physics answers — the I2 rows carry no answer field, so each answer
 * lives here, keyed by item id, derived from that row's why and
 * objective. Every derivation is listed in the PR body for educator
 * review (review runs alongside release, owner rule Nov 13).
 *
 * Each entry is one multiple-choice question in the shared AnswerEntry
 * shape. Numeric answers also carry their value so unit tests can
 * recompute them from the derivation inputs.
 */
import type { AnswerEntry } from "../shared/answer.ts";

export const PHYSICS_ANSWERS: Record<string, AnswerEntry> = {
  "physics:push:which-way": {
    prompt:
      "Ana pushes a box toward the right. Ben pushes it toward the left. Ana's push is stronger. Which way does the box move?",
    choices: ["To the right", "To the left", "It does not move"],
    correct: "To the right",
    derivation: "The stronger push wins: Ana's stronger push moves the box to the right.",
  },
  "physics:push:equal-pushes": {
    prompt: "A box moves 2 tiles with each push. How many tiles do 4 equal pushes cover?",
    choices: ["6", "8", "10"],
    correct: "8",
    value: 8,
    derivation: "4 pushes × 2 tiles = 8 tiles.",
  },
  "physics:magnet:flip": {
    prompt:
      "Two magnets pull together to hold a cabinet shut. Someone turns one magnet around. What happens now?",
    choices: ["They still pull together", "They now push apart", "Nothing changes"],
    correct: "They now push apart",
    derivation: "Turning one magnet around swaps pull for push: the pair now pushes apart.",
  },
  "physics:arrive:unit-rate": {
    prompt:
      "One cart covers 8 metres in 2 seconds. Another covers 9 metres in 3 seconds. They leave together for the same bridge. Which cart arrives first?",
    choices: [
      "The 8 metres in 2 seconds cart",
      "The 9 metres in 3 seconds cart",
      "They arrive together",
    ],
    correct: "The 8 metres in 2 seconds cart",
    derivation:
      "Unit rates: 8 ÷ 2 = 4 metres each second; 9 ÷ 3 = 3 metres each second. The faster cart arrives first.",
  },
  "physics:ramp:slope-ratio": {
    prompt: "Ramp A rises 2 for a run of 4. Ramp B rises 2 for a run of 2. Which ramp is steeper?",
    choices: ["Ramp A", "Ramp B", "They are the same"],
    correct: "Ramp B",
    derivation: "Steepness = rise ÷ run. A: 2 ÷ 4 = 0.5. B: 2 ÷ 2 = 1. B is steeper.",
  },
  "physics:magnet:closer": {
    prompt:
      "Two pairs of magnets are the same, but one pair sits closer together. Which pair pulls harder?",
    choices: ["The closer pair", "The farther pair", "They pull the same"],
    correct: "The closer pair",
    derivation: "Magnets pull harder when they are closer together.",
  },
  "physics:ramp:adult-ratio": {
    prompt: "Boom A rises 3 for a run of 6. Boom B rises 4 for a run of 6. Which boom is steeper?",
    choices: ["Boom A", "Boom B", "They are the same"],
    correct: "Boom B",
    derivation: "Steepness = rise ÷ run. A: 3 ÷ 6 = 0.5. B: 4 ÷ 6 ≈ 0.67. B is steeper.",
  },
  "physics:arrive:adult-time": {
    prompt:
      "A cart's card states distance = speed × time. The distance is 12 kilometres and the speed is 4 kilometres per hour. How long is the trip?",
    choices: ["2 hours", "3 hours", "4 hours"],
    correct: "3 hours",
    value: 3,
    derivation: "time = distance ÷ speed = 12 ÷ 4 = 3 hours.",
  },
  "physics:energy:missing": {
    prompt:
      "A battery log says: change in stored energy = energy in − energy out. Stored energy rose by 3 units and the house drew 2 units out. How many units did the panels put in?",
    choices: ["1 unit", "3 units", "5 units"],
    correct: "5 units",
    value: 5,
    derivation: "3 = energy in − 2, so energy in = 3 + 2 = 5 units.",
  },
};

export function answerFor(itemId: string): AnswerEntry | null {
  return PHYSICS_ANSWERS[itemId] ?? null;
}
