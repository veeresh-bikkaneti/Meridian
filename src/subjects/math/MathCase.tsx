/**
 * Math case flow (scale-play wave 1) — the component the math subject
 * module's load() returns (contract I1).
 *
 * A thin wrapper over the shared SubjectCase: the flow itself (ClueCard
 * -> AnswerCard -> result with "You just used this in…") lives in
 * src/subjects/shared/SubjectCase.tsx, extracted from this file with no
 * visual change. Math passes its title, its test-id prefix (so the
 * wave-1 e2e ids stay math-case / math-answer-card / math-result), its
 * band items and its answer lookup.
 */
import type { SubjectProps } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import { SubjectCase } from "../shared/SubjectCase";
import { itemsForGroup } from "./items";
import { answerFor } from "./answers";

export default function MathCase(
  props: SubjectProps & {
    /** GameApp's celebration trigger (the same one LoopScreen receives). */
    onCelebrate?: (spec: CelebrationSpec) => void;
  },
) {
  return (
    <SubjectCase
      title="Math"
      testIdPrefix="math"
      itemsForGroup={itemsForGroup}
      answerFor={answerFor}
      {...props}
    />
  );
}
