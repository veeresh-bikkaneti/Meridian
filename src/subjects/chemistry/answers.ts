/**
 * Chemistry answers — the I2 rows carry no answer field, so each
 * answer lives here, keyed by item id, derived from that row's why
 * and objective. Every derivation is listed in the PR body for
 * educator review (review runs alongside release, owner rule Nov 13).
 *
 * Wording follows docs/scaling/chemistry/fact-notes.md: salt on roads
 * is claimed only as lowering water's freezing point; no melt speed
 * and no temperature is stated. No biology in any question.
 */
import type { AnswerEntry } from "../shared/answer.ts";

export const CHEMISTRY_ANSWERS: Record<string, AnswerEntry> = {
  "chemistry:states:solid-liquid": {
    prompt: "An ice pop is hard in the cold and drips when the room is warm. What changed it?",
    choices: ["Warmth melted it", "The cold melted it", "It dried up"],
    correct: "Warmth melted it",
    derivation: "Warmth changed the solid ice pop into a liquid: heating melted it.",
  },
  "chemistry:states:melt-freeze": {
    prompt:
      "A puddle was ice this morning and water at lunch. Tonight turns cold again. What can the water turn back into?",
    choices: ["Ice", "Steam", "Stone"],
    correct: "Ice",
    derivation: "Cooling the water can freeze it back into ice — this change can be reversed.",
  },
  "chemistry:materials:sort": {
    prompt: "Two spoons look the same, but one bends and one does not. Which property tells them apart?",
    choices: ["Whether it bends", "How loud it is", "How it smells"],
    correct: "Whether it bends",
    derivation: "The spoons were sorted by flexibility — whether the material bends.",
  },
  "chemistry:states:road-salt": {
    prompt: "Crews spread salt on an icy road. What does the salt do to the water in the ice?",
    choices: [
      "It lowers the freezing point of the water",
      "It warms the road like a heater",
      "It makes the ice heavier",
    ],
    correct: "It lowers the freezing point of the water",
    derivation:
      "Salt is a deicer: it lowers water's freezing point, so the ice melts at a temperature where plain ice would stay frozen.",
  },
  "chemistry:mixtures:dissolve": {
    prompt: "A solid stirred into water disappears from sight. Where did it go?",
    choices: [
      "It is still there, as pieces too small to see",
      "It stopped existing",
      "It turned into air",
    ],
    correct: "It is still there, as pieces too small to see",
    derivation:
      "Dissolving breaks the solid into pieces too small to see — the substance is still in the water.",
  },
  "chemistry:reactions:weight": {
    prompt:
      "Substances are mixed on a scale and the mix looks different. What happens to the total weight?",
    choices: ["It stays the same", "It drops to zero", "It doubles"],
    correct: "It stays the same",
    derivation:
      "Heating, cooling or mixing does not make matter vanish: the total weight stays the same.",
  },
  "chemistry:reactions:rate": {
    prompt:
      "Two glow sticks are the same. One sits in warm water, one in ice water. Which one fades first?",
    choices: ["The one in warm water", "The one in ice water", "They fade together"],
    correct: "The one in warm water",
    derivation:
      "Warmer reacting particles react faster, so the warm-water glow stick uses itself up and fades first.",
  },
  "chemistry:reactions:mass": {
    prompt:
      "A simple reaction changes how the substances look. You count the atoms on each side of the tally. What does the count show?",
    choices: [
      "The same count on both sides — no atom vanished",
      "Fewer atoms after the reaction",
      "New atoms appeared from nowhere",
    ],
    correct: "The same count on both sides — no atom vanished",
    derivation: "Atoms are conserved in a reaction, so the count — and the mass — matches on both sides.",
  },
  "chemistry:reactions:explain": {
    prompt:
      "Two elements sit in the same column of the periodic table. One reacts with oxygen in a known way. What does the column pattern predict about the other?",
    choices: ["It reacts in a similar way", "It never reacts", "It turns into the first element"],
    correct: "It reacts in a similar way",
    derivation:
      "Elements in the same column share outer-electron patterns, so they react in similar ways.",
  },
};

export function answerFor(itemId: string): AnswerEntry | null {
  return CHEMISTRY_ANSWERS[itemId] ?? null;
}
