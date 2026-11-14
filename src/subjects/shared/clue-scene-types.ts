/**
 * clue-scene-types.ts — the shape of a clue scene description.
 *
 * A description is DATA (each subject keeps its own, next to its
 * answers): the givens from an item's question, drawn as a scene,
 * plus one label per phase. It never carries the answer, a choice
 * or a pick — the renderer (ClueScene.tsx) receives a description
 * and a phase, nothing else, so a scene cannot give the answer
 * away before the pick. The grouping a solved beat shows is
 * computed by the renderer from the givens at solve time, exactly
 * the derivation the result card then prints.
 *
 * The labels carry no numbers: numbers live in the question only.
 */
export type ClueScenePhase = "setup" | "solved";

/**
 * The counting ticks a solved beat shows, in order — the skip-count
 * jumps for the coin and pencil scenes (5, 10, … / 4, 8, …). Pure
 * arithmetic on the description's givens; the fair-share scene
 * deals instead of counting, so it has no ticks.
 */
export function countingTicks(description: ClueSceneDescription): number[] {
  if (description.kind === "coin-groups") {
    const ticks: number[] = [];
    for (let n = description.groupSize; n <= description.total; n += description.groupSize) {
      ticks.push(n);
    }
    return ticks;
  }
  if (description.kind === "pencil-packs") {
    const ticks: number[] = [];
    for (let g = 1; g <= description.packs; g++) {
      ticks.push(g * description.perPack);
    }
    return ticks;
  }
  return [];
}

/**
 * The dealing order for the fair-share solved beat: which friend
 * each snack goes to, one by one, round and round (0, 1, 2, 3, 0, …)
 * until the plate is empty. Every friend ends with the same count
 * because the total divides by the friends — the item's own givens.
 */
export function dealOrder(description: ClueSceneDescription): number[] {
  if (description.kind !== "fair-share") return [];
  const order: number[] = [];
  for (let i = 0; i < description.total; i++) {
    order.push(i % description.friends);
  }
  return order;
}

export type ClueSceneDescription =
  | {
      kind: "coin-groups";
      /** Coins on the table — a given from the question. */
      total: number;
      /** Coins per group — a given from the question. */
      groupSize: number;
      labelSetup: string;
      labelSolved: string;
    }
  | {
      kind: "pencil-packs";
      /** Packs on the shelf — a given from the question. */
      packs: number;
      /** Pencils in each pack — a given from the question. */
      perPack: number;
      labelSetup: string;
      labelSolved: string;
    }
  | {
      kind: "fair-share";
      /** Snacks on the plate — a given from the question. */
      total: number;
      /** Friends sharing them — a given from the question. */
      friends: number;
      labelSetup: string;
      labelSolved: string;
    };
