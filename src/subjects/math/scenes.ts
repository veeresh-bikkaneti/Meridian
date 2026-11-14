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
 */
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

export type { ClueSceneDescription };
export { countingTicks, dealOrder } from "../shared/clue-scene-types.ts";

export const MATH_CLUE_SCENES: Record<string, ClueSceneDescription> = {
  "math-number:groups:skip-count": {
    kind: "coin-groups",
    total: 40,
    groupSize: 5,
    labelSetup: "Coins wait in a loose pile on a table, ready to be counted.",
    labelSolved: "The coins slide into equal groups and are counted in jumps.",
  },
  "math-number:tables:facts": {
    kind: "pencil-packs",
    packs: 7,
    perPack: 4,
    labelSetup: "Packs of pencils stand in a row on a shelf.",
    labelSolved: "The packs are emptied and the pencils are counted in jumps.",
  },
  "math-number:division:fair-share": {
    kind: "fair-share",
    total: 12,
    friends: 4,
    labelSetup: "A plate of snacks sits on a table, with friends waiting around it.",
    labelSolved: "The snacks are dealt out one by one until every friend has the same.",
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return MATH_CLUE_SCENES[itemId] ?? null;
}
