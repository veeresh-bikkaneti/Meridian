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
  "physics:drop:down": {
    prompt: "A ball sits on a shelf above a bucket. You let go. Which way does the ball move?",
    choices: ["Down into the bucket", "Up into the air", "It stays on the shelf"],
    correct: "Down into the bucket",
    derivation: "Nothing holds the ball up once you let go, so it falls down into the bucket.",
  },
  "physics:friction:measure-slide": {
    prompt:
      "A crate slides on this floor and stops at a mark before a glass pane. You give it the same push again on the same floor. Where does it stop?",
    choices: ["At the same mark", "Sooner than the mark", "Farther than the mark"],
    correct: "At the same mark",
    derivation:
      "The same push on the same floor meets the same grip, so the crate slides the same distance and stops at the same mark.",
  },
  "physics:ramp:faster-hits-harder": {
    prompt:
      "Two balls roll into the same cup, one after the other. One ball is moving faster. After which ball does the cup slide farther?",
    choices: ["After the faster ball", "After the slower ball", "The same after both"],
    correct: "After the faster ball",
    derivation: "The faster ball carries more motion, so it shoves the cup farther than the slower ball.",
  },
  "physics:arrive:equal-steps": {
    prompt:
      "Two carts leave for the same line. One moves 3 tiles each step. The other moves 1 tile each step. Which cart reaches the line first?",
    choices: [
      "The 3-tiles-each-step cart",
      "The 1-tile-each-step cart",
      "They arrive together",
    ],
    correct: "The 3-tiles-each-step cart",
    derivation: "3 tiles each step beats 1 tile each step, so the 3-tile cart reaches the line first.",
  },
  "physics:lever:seesaw": {
    prompt: "A board over a log must lift a box. You push one end down. What happens to the other end?",
    choices: ["It goes up and lifts the box", "It goes down too", "It stays still"],
    correct: "It goes up and lifts the box",
    derivation: "Pushing one end of a board over a log down lifts the other end up — and the box with it.",
  },
  "physics:balance:tug": {
    prompt:
      "Ana and Ben push a stuck gate from opposite sides with pushes that match exactly. Does the gate move?",
    choices: ["No, it stays still", "Yes, toward Ana", "Yes, toward Ben"],
    correct: "No, it stays still",
    derivation: "Matching pushes cancel each other out, so the gate stays still.",
  },
  "physics:energy:wound-moves": {
    prompt:
      "A toy car must cross a mat to a friend. One car is wound up. One is not. Which car moves?",
    choices: ["The wound-up car", "The car that was not wound", "Neither car moves"],
    correct: "The wound-up car",
    derivation: "The wound-up car has stored energy to spend on moving; the unwound car has none, so it stays still.",
  },
  "physics:shadow:blocks": {
    prompt:
      "A lamp lights a book. A sheet of cardboard you cannot see through goes between the book and your eye. Can you still see the book?",
    choices: [
      "No, the cardboard blocks the light",
      "Yes, the light goes through the cardboard",
      "Yes, the book glows on its own",
    ],
    correct: "No, the cardboard blocks the light",
    derivation:
      "You see the book only when light reflected from it reaches your eye — the cardboard blocks that light, so the book is not seen.",
  },
  "physics:mirror:sends-back": {
    prompt: "A lamp lights a book on a shelf. How do you see the book?",
    choices: [
      "Light bounces off the book into your eye",
      "Light that only shines on the shelf",
      "Light that shines from your eye onto the book",
    ],
    correct: "Light bounces off the book into your eye",
    derivation: "You see the book because light bounces off it and into your eye.",
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
  "physics:push:mass": {
    prompt:
      "Two carts get the same push. One cart holds more boxes. Which cart's motion changes more?",
    choices: ["The lighter cart", "The heavier cart", "They change the same"],
    correct: "The lighter cart",
    derivation: "The same push changes a lighter cart's motion more — the heavier cart resists the change.",
  },
  "physics:push:table": {
    prompt:
      "A dock cart's card lists net force, mass, and acceleration for two trials. The mass matches. The net force does not. Which trial's motion changes more?",
    choices: [
      "The trial with the larger net force",
      "The trial with the smaller net force",
      "They change the same",
    ],
    correct: "The trial with the larger net force",
    derivation:
      "With the same mass, the larger net force gives the larger acceleration, so that trial's motion changes more.",
  },
  "physics:ramp:higher-stored": {
    prompt: "Two carts sit on one hill, one higher than the other. Which cart has more stored energy?",
    choices: ["The higher cart", "The lower cart", "They have the same"],
    correct: "The higher cart",
    derivation: "Higher on the hill means more stored energy — the higher cart has more.",
  },
  "physics:energy:transfer": {
    prompt: "A ball rolls into a cup and stops. The cup starts to slide. Where did the ball's motion go?",
    choices: ["It moved into the cup", "It disappeared", "It stayed in the ball"],
    correct: "It moved into the cup",
    derivation: "The ball's motion did not vanish — it passed into the cup, which is why the cup slides.",
  },
  "physics:sound:medium": {
    prompt:
      "A bell must be heard across a gap. One path is air. One path is drawn as empty. Which path carries the sound?",
    choices: ["The air path", "The empty path", "Neither path carries it"],
    correct: "The air path",
    derivation: "Sound needs a material to travel through — the air path carries it, the empty gap does not.",
  },
  "physics:mirror:three-ways": {
    prompt: "A lamp shines on a dark cloth, a clear sheet, and a mirror. Which material reflects the light?",
    choices: ["The mirror", "The dark cloth", "The clear sheet"],
    correct: "The mirror",
    derivation:
      "In this model, the mirror is the one that reflects the light — the dark cloth absorbs it and the clear sheet lets it through.",
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
