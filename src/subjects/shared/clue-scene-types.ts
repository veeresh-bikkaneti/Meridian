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

/**
 * The counting ticks for the container scenes (bus-boarding,
 * pack-boxes): the running total each time a container fills —
 * the multiples of the container size up to the total. A
 * remainder adds no tick here: the part-full container's tick is
 * the total itself, which the scene appends.
 */
export function groupTicks(total: number, groupSize: number): number[] {
  const ticks: number[] = [];
  for (let n = groupSize; n <= total; n += groupSize) {
    ticks.push(n);
  }
  return ticks;
}

/**
 * The chunking plan for a chunk-share solved beat: the per-share
 * quotient split into place-value chunks (156 → [100, 50, 6]),
 * dealt to every share in turn — the school chunking method, pure
 * arithmetic on the givens. Empty when the givens do not divide
 * evenly (the kind is only written for totals that do).
 */
export function chunkPlan(description: ClueSceneDescription): number[] {
  if (description.kind !== "chunk-share") return [];
  const quotient = description.total / description.shares;
  if (!Number.isInteger(quotient) || quotient <= 0) return [];
  const digits = String(quotient).split("").map(Number);
  const chunks: number[] = [];
  digits.forEach((digit, i) => {
    const place = 10 ** (digits.length - 1 - i);
    if (digit > 0) chunks.push(digit * place);
  });
  return chunks;
}

/**
 * The unit that fits a unit-fit scene's path: the counts the path
 * would take in each unit are pathLength × 1000 (millimetres),
 * × 100 (centimetres) and × 1 (metres); the fitting unit is the
 * largest whose count stays countable (at most 100 steps) — the
 * judgement the item teaches, computed from the given alone.
 */
export function fittingUnit(description: ClueSceneDescription): "mm" | "cm" | "m" | null {
  if (description.kind !== "unit-fit") return null;
  if (description.pathLength * 1000 <= 100) return "mm";
  if (description.pathLength * 100 <= 100) return "cm";
  if (description.pathLength <= 100) return "m";
  return null;
}

/** Minutes between a clock-arc scene's two clock times. */
export function elapsedMinutes(description: ClueSceneDescription): number {
  if (description.kind !== "clock-arc") return 0;
  const start = description.startHour * 60 + description.startMinute;
  const end = description.endHour * 60 + description.endMinute;
  return end - start;
}

/** The place-value columns of a whole number: [hundreds, tens, ones]
 * for the numbers the place kinds draw (0–999). */
export function placeColumns(value: number): [number, number, number] {
  return [Math.floor(value / 100) % 10, Math.floor(value / 10) % 10, value % 10];
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
    }
  | {
      kind: "bus-boarding";
      /** Children waiting — a given from the question. */
      total: number;
      /** Seats on each bus — a given from the question. */
      seats: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "pack-boxes";
      /** Pencils to pack — a given from the question. */
      total: number;
      /** Pencils in each box — a given from the question. */
      perBox: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "place-value";
      /** Hundreds in the amount — a given from the question. */
      hundreds: number;
      /** Tens in the amount — a given from the question. */
      tens: number;
      /** Ones in the amount — a given from the question. */
      ones: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "place-compare";
      /** One route's length in steps — a given from the question. */
      left: number;
      /** The other route's length — a given from the question. */
      right: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "rounding-line";
      /** The number to round — a given from the question. */
      value: number;
      /** The hundred below it — a given from the question. */
      low: number;
      /** The hundred above it — a given from the question. */
      high: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "digit-shift";
      /** The starting number — a given from the question. */
      value: number;
      /** The stretch factor — a given from the question. */
      factor: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "split-product";
      /** Rows of chairs — a given from the question. */
      rows: number;
      /** Chairs in each row — a given from the question. */
      perRow: number;
      /** The round part of a row — split from the question's number. */
      splitHigh: number;
      /** The leftover part of a row — split from the question's number. */
      splitLow: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "chunk-share";
      /** Books to share — a given from the question. */
      total: number;
      /** Shelves sharing them — a given from the question. */
      shares: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "tile-grid";
      /** Rows in the rectangle — a given from the question. */
      rows: number;
      /** Tiles in each row — a given from the question. */
      cols: number;
      /** Brick glyph + row guides for the arrays item. */
      brick?: boolean;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "measure-trace";
      /** "loop": trace every side of a length × width rectangle.
       * "bars": trace two aligned lengths and bracket the gap. */
      mode: "loop" | "bars";
      /** Loop: the long side. Bars: the shorter length. */
      length: number;
      /** Loop: the short side. Bars: the longer length. */
      width: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "fraction-slice";
      /** Equal parts the first whole is cut into — a given. */
      parts: number;
      /** Parts taken from the first whole — a given. */
      taken: number;
      /** A second whole's parts (the equivalence item). */
      parts2?: number;
      /** Parts taken from the second whole. */
      taken2?: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "fraction-fill";
      /** First bottle's fill: numerator of denominator — givens. */
      numerator: number;
      denominator: number;
      /** Second bottle's fill — givens from the question. */
      otherNumerator: number;
      otherDenominator: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "clock-arc";
      /** Start time — givens from the question. */
      startHour: number;
      startMinute: number;
      /** End time — givens from the question. */
      endHour: number;
      endMinute: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    }
  | {
      kind: "unit-fit";
      /** The path's length in metres — the staging given the fit
       * judgement is computed from (see fittingUnit). */
      pathLength: number;
      labelSetup: string;
      labelSolved: string;
      /** Narrated solved summary (act 3); solved phase only. */
      summary?: ClueSceneSummary;
    };
