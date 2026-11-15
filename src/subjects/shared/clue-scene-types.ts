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
 *
 * A description may also carry a SUMMARY (act 3): the narrated
 * walk-through of the solving that plays only after a correct
 * pick. Its script lives here, in the solved-phase data path —
 * the renderer reads it only when the phase is "solved", so no
 * line, clip name or timing is reachable before the pick. Because
 * it plays after the solve, the script may state the answer and
 * the method's numbers; the closing line names the method.
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

/** One line of a scene summary's narration. */
export interface ClueSceneSummaryLine {
  /** The spoken line, word for word the caption shown for its step. */
  text: string;
  /** Seconds into the clip where this line starts (measured when
   * the clip was rendered; the caption steps and the re-paced
   * solved beat both read these offsets). */
  at: number;
}

/**
 * A scene's narrated solved summary: one clip, its script, and
 * the beat map that paces the solved animation to the narration.
 * `beats` runs parallel to `lines`: how many animation steps
 * begin inside that line — groups for the coin scene, packs for
 * the pencil scene, single snacks for the fair-share scene. The
 * opening line usually carries 0 (the stage rests) and the
 * closing line 0 (the finished picture rests).
 */
export interface ClueSceneSummary {
  /** Narration clip file name, served from public/audio/subjects/.
   * A plain name — no path, and no digits: a file name must never
   * be able to leak an answer before the pick. */
  clip: string;
  /** The clip's whole length in seconds (measured at render). */
  duration: number;
  /** The script, in order: one line per solving step, then a
   * closing line that names the method. */
  lines: ClueSceneSummaryLine[];
  /** Animation steps beginning in each line, parallel to lines. */
  beats: number[];
}

/** How many animation steps a summary paces in total. */
export function summaryStepCount(summary: ClueSceneSummary): number {
  return summary.beats.reduce((a, b) => a + b, 0);
}

/**
 * The line a given animation step belongs to, and the step's
 * index inside that line — the map the renderer uses to re-pace
 * the solved beat to the narration. Steps beyond the beat map
 * clamp to the closing line.
 */
export function summaryStepLine(
  summary: ClueSceneSummary,
  step: number,
): { line: number; indexInLine: number } {
  let acc = 0;
  for (let li = 0; li < summary.beats.length; li++) {
    const count = summary.beats[li] ?? 0;
    if (step < acc + count) return { line: li, indexInLine: step - acc };
    acc += count;
  }
  return { line: summary.beats.length - 1, indexInLine: 0 };
}

/**
 * When an animation step starts in a summary performance: its
 * line's offset in the clip, a small lead-in, then the step's
 * stagger inside the line (the stagger is the scene kind's own —
 * groups land slower than single snacks).
 */
export function summaryStepStart(
  summary: ClueSceneSummary,
  step: number,
  stagger: number,
): number {
  const { line, indexInLine } = summaryStepLine(summary, step);
  return (summary.lines[line]?.at ?? 0) + 0.12 + indexInLine * stagger;
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
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "pencil-packs";
      /** Packs on the shelf — a given from the question. */
      packs: number;
      /** Pencils in each pack — a given from the question. */
      perPack: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "fair-share";
      /** Snacks on the plate — a given from the question. */
      total: number;
      /** Friends sharing them — a given from the question. */
      friends: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    };
