/**
 * Math clue scenes (pilot, feat/clue-scene-pilot) — one scene
 * description per item, in data, next to the answers in answers.ts.
 * A later item needs only a new description here, never new code:
 * the renderer (src/subjects/shared/ClueScene.tsx) reads these.
 *
 * Answer-blindness is structural, the subject-host-props.ts
 * pattern: a description carries only the givens from the item's
 * own question (the coins on the table, the packs on the shelf,
 * the snacks and the friends). The renderer receives a description
 * and a phase ("setup" | "solved") — never the answer, a choice,
 * or a pick — so the setup film can only set the scene.
 *
 * Each description also carries its SUMMARY: the narrated
 * walk-through of the solving (act 3), played only after a
 * correct pick. The script lines are word-for-word the captions;
 * the clip timings were measured when the clips were rendered
 * (public/audio/subjects/manifest.json carries the same numbers).
 * The summary sits in the solved-phase data path only — the
 * renderer never reads it before the solve.
 */
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

export type { ClueSceneDescription };
export {
  countingTicks,
  dealOrder,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "../shared/clue-scene-types.ts";

export const MATH_CLUE_SCENES: Record<string, ClueSceneDescription> = {
  "math-number:groups:skip-count": {
    kind: "coin-groups",
    total: 40,
    groupSize: 5,
    labelSetup: "Coins wait in a loose pile on a table, ready to be counted.",
    labelSolved: "The coins slide into equal groups and are counted in jumps.",
    summary: {
      clip: "skip-count.mp3",
      duration: 18.77,
      lines: [
        { text: "Here is the clever way to count the coins.", at: 0 },
        { text: "Slide them into groups of five, and count in fives.", at: 2.87 },
        { text: "5, 10.", at: 6.74 },
        { text: "15, 20.", at: 8.16 },
        { text: "25, 30.", at: 9.83 },
        { text: "35, 40.", at: 11.58 },
        { text: "8 groups of five make 40 coins. Counting in fives finds the groups fast!", at: 13.33 },
      ],
      beats: [0, 0, 2, 2, 2, 2, 0],
    },
  },
  "math-number:tables:facts": {
    kind: "pencil-packs",
    packs: 7,
    perPack: 4,
    labelSetup: "Packs of pencils stand in a row on a shelf.",
    labelSolved: "The packs are emptied and the pencils are counted in jumps.",
    summary: {
      clip: "pencil-packs.mp3",
      duration: 17.22,
      lines: [
        { text: "Here is the clever way to count the pencils.", at: 0 },
        { text: "Tip out one pack at a time, and count in fours.", at: 3.06 },
        { text: "4, 8.", at: 6.64 },
        { text: "12, 16.", at: 7.99 },
        { text: "20, 24, 28.", at: 9.57 },
        { text: "7 packs of four make 28 pencils. That is the four times table at work!", at: 11.82 },
      ],
      beats: [0, 0, 2, 2, 3, 0],
    },
  },
  "math-number:division:fair-share": {
    kind: "fair-share",
    total: 12,
    friends: 4,
    labelSetup: "A plate of snacks sits on a table, with friends waiting around it.",
    labelSolved: "The snacks are dealt out one by one until every friend has the same.",
    summary: {
      clip: "fair-share.mp3",
      duration: 18.74,
      lines: [
        { text: "Here is the fair way to share the snacks.", at: 0 },
        { text: "Deal them out one by one. Round one: one for every friend.", at: 2.76 },
        { text: "Round two: one more for every friend.", at: 7.28 },
        { text: "Round three: one more for every friend.", at: 10.12 },
        { text: "Every friend has 3 snacks, and the plate is empty. Sharing one by one keeps it fair!", at: 13.09 },
      ],
      beats: [0, 4, 4, 4, 0],
    },
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return MATH_CLUE_SCENES[itemId] ?? null;
}
