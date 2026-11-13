import type { AnswerCheckResult, InteractiveItemSpec } from "./types.ts";
import { MODERN_WORLD_FILM_IDS } from "./journal-films.ts";

export const INTERACTIVE_ITEM_IDS = [
  "math-number:groups:skip-count",
  "physics:arrive:equal-steps",
  "chemistry:states:solid-liquid",
  "social-studies:route:trip-clock",
  "general-knowledge:mixed:opera-years-ago",
  "great-leaders:lincoln-memorial",
  ...MODERN_WORLD_FILM_IDS,
] as const;

export type InteractiveItemId = (typeof INTERACTIVE_ITEM_IDS)[number];

export function isInteractiveItem(id: string): id is InteractiveItemId {
  return (INTERACTIVE_ITEM_IDS as readonly string[]).includes(id);
}

/**
 * Returns current year from device clock at play time.
 * Never hard-codes the year.
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getInteractiveSpec(id: string): InteractiveItemSpec | null {
  const currentYear = getCurrentYear();
  const operaYearsAgo = currentYear - 1973;

  switch (id) {
    case "math-number:groups:skip-count":
      return {
        id,
        subjectId: "math",
        title: "Skip Counting Coins",
        prompt: "Forty coins are spilled on the shop counter. Tap the next number counting by 5s:",
        choices: [
          { label: "38", value: 38 },
          { label: "40", value: 40 },
          { label: "45", value: 45 },
        ],
        correctValue: 40,
        explanation:
          "Counting in 5s reaches 40 coins quickly and cleanly: 35 + 5 = 40! All 40 coins are counted in 8 steps.",
        type: "multiple-choice",
      };

    case "physics:arrive:equal-steps":
      return {
        id,
        subjectId: "physics",
        title: "Cart Race: Equal Steps",
        prompt:
          "Two carts leave for the same line. Cart A moves 3 tiles each step. Cart B moves 1 tile each step. Which cart reaches the line first?",
        choices: [
          { label: "Cart A (3 tiles each step)", value: "cart-a" },
          { label: "Cart B (1 tile each step)", value: "cart-b" },
        ],
        correctValue: "cart-a",
        explanation:
          "Cart A moves 3 tiles per step, so it crosses the line in 3 steps while Cart B only reaches tile 3!",
        type: "predict-see",
      };

    case "chemistry:states:solid-liquid":
      return {
        id,
        subjectId: "chemistry",
        title: "States of Matter: Ice & Water",
        prompt:
          "The ice pop is hard in the cold and drips when the room is warm. What state did the warm room turn the solid ice into?",
        choices: [
          { label: "Solid ice", value: "solid" },
          { label: "Liquid water", value: "liquid" },
        ],
        correctValue: "liquid",
        explanation:
          "Warmth melts solid ice into liquid water. Putting it back into the cold freezer turns it into solid ice again!",
        type: "multiple-choice",
      };

    case "social-studies:route:trip-clock":
      return {
        id,
        subjectId: "social-studies",
        title: "Trip Clock: Distance & Time",
        prompt:
          "The bus drives 40 km every hour and the museum is 120 km away. How many whole hours does the trip take?",
        choices: [
          { label: "2 hours", value: 2 },
          { label: "3 hours", value: 3 },
          { label: "4 hours", value: 4 },
        ],
        correctValue: 3,
        explanation:
          "120 km ÷ 40 km/h = 3 hours! (40 km + 40 km + 40 km = 120 km). You will arrive in exactly 3 hours.",
        type: "multiple-choice",
      };

    case "general-knowledge:mixed:opera-years-ago":
      return {
        id,
        subjectId: "general-knowledge",
        title: "Sydney Opera House Timeline",
        prompt: `A postcard says the Sydney Opera House opened in 1973. How many years ago was that? (${currentYear} − 1973)`,
        choices: [
          { label: `${operaYearsAgo - 10} years ago`, value: operaYearsAgo - 10 },
          { label: `${operaYearsAgo} years ago`, value: operaYearsAgo },
          { label: `${operaYearsAgo + 10} years ago`, value: operaYearsAgo + 10 },
        ],
        correctValue: operaYearsAgo,
        explanation: `From ${currentYear}, subtracting 1973 gives ${operaYearsAgo} years ago! Subtracting saves counting back one year at a time.`,
        type: "multiple-choice",
      };

    case "great-leaders:lincoln-memorial":
      return {
        id,
        subjectId: "journal",
        title: "Lincoln Memorial: Years & Statue",
        prompt:
          "Work on the Lincoln Memorial began in 1914. It was dedicated in 1922. How many years did it take to build?",
        choices: [
          { label: "6 years", value: 6 },
          { label: "8 years", value: 8 },
          { label: "10 years", value: 10 },
        ],
        correctValue: 8,
        explanation: "1922 minus 1914 = 8 years to construct the Lincoln Memorial.",
        type: "journal-two-step",
        stepTwo: {
          prompt: "In the big statue inside the memorial, does Lincoln sit or stand?",
          choices: [
            { label: "He sits", value: "sits" },
            { label: "He stands", value: "stands" },
          ],
          correctValue: "sits",
          explanation:
            "Abraham Lincoln sits inside the memorial, carved in 28 blocks of Georgia white marble.",
        },
      };

    default:
      return null;
  }
}

export function checkAnswer(
  itemId: string,
  answer: string | number,
  step = 1,
): AnswerCheckResult {
  const spec = getInteractiveSpec(itemId);
  if (!spec) {
    return {
      correct: false,
      reason: "Item does not have an active interaction.",
    };
  }

  if (step === 2 && spec.stepTwo) {
    const isCorrect = String(answer).toLowerCase() === String(spec.stepTwo.correctValue).toLowerCase();
    return {
      correct: isCorrect,
      reason: isCorrect
        ? spec.stepTwo.explanation
        : "Not quite — take another close look at the memorial statue!",
    };
  }

  const isCorrect = String(answer).toLowerCase() === String(spec.correctValue).toLowerCase();
  return {
    correct: isCorrect,
    reason: isCorrect
      ? spec.explanation
      : "Not quite — check the numbers and try again!",
  };
}

