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
  "chemistry:materials:magnet": {
    prompt: "A pile of bits looks the same. Which ones will jump to the magnet?",
    choices: ["The iron bits", "The wooden bits", "The plastic bits"],
    correct: "The iron bits",
    derivation: "A magnet pulls iron, but it does not pull wood or plastic.",
  },
  "chemistry:pieces:rebuild": {
    prompt: "The bridge model is too short. Can the same pieces make a longer one?",
    choices: [
      "Yes — take it apart and build it longer with the same pieces",
      "No — short pieces can never make a longer bridge",
      "Only if you add new pieces",
    ],
    correct: "Yes — take it apart and build it longer with the same pieces",
    derivation:
      "The same pieces can make a new shape — take the model apart and rebuild it, using every piece and adding none.",
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
  "chemistry:states:particles": {
    prompt:
      "The kettle picture goes from ice, to water, to invisible water vapour above the spout. What did the warmth change?",
    choices: [
      "The water, from solid to liquid to gas",
      "The kettle's colour",
      "The water, back into ice",
    ],
    correct: "The water, from solid to liquid to gas",
    derivation: "Warmth changes water from solid ice to liquid water to invisible water vapour.",
  },
  "chemistry:water:cycle": {
    prompt:
      "The puddle disappeared and the sky has a cloud. Where did the water go, and how does it come back?",
    choices: [
      "Up into the air, into a cloud, and back as rain or snow",
      "Down into the ground, where it stays for good",
      "It disappeared for good",
    ],
    correct: "Up into the air, into a cloud, and back as rain or snow",
    derivation: "The water went up into the air, into a cloud, and comes back as rain or snow.",
  },
  "chemistry:reactions:new-look": {
    prompt:
      "A shop counter stirs two plain substances. The picture may bubble. Is that still the same stuff?",
    choices: [
      "It might be a new substance — a new look can mean a reaction happened",
      "It is certainly the same stuff",
      "It is certainly a new substance",
    ],
    correct: "It might be a new substance — a new look can mean a reaction happened",
    derivation:
      "Mixing may make a new substance with different properties — a new look can mean a reaction happened.",
  },
  "chemistry:reactions:rust": {
    prompt: "A metal bike sat out in the rain. It looks different. Did the material change?",
    choices: [
      "Yes — iron exposed to oxygen and water turns to rust",
      "No — rain only makes it look wet",
      "No — it only got dirty",
    ],
    correct: "Yes — iron exposed to oxygen and water turns to rust",
    derivation:
      "Iron becomes rust when it is exposed to oxygen and water — the metal itself changed.",
  },
  "chemistry:materials:identify": {
    prompt: "Three unmarked blocks could be three different materials. Which test tells them apart?",
    choices: [
      "Whether each block dissolves in water",
      "Whether each block floats",
      "Which block looks the shiniest",
    ],
    correct: "Whether each block dissolves in water",
    derivation:
      "A material can be told apart by its properties — here, whether it dissolves in water.",
  },
  "chemistry:elements:detective": {
    prompt:
      "Sodium and potassium are both soft, shiny metals in the same column of the periodic table. Which one reacts more with oxygen?",
    choices: ["Potassium", "Sodium", "They react the same"],
    correct: "Potassium",
    derivation:
      "Further down the same column, the metal reacts more strongly — potassium reacts more with oxygen than sodium.",
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
