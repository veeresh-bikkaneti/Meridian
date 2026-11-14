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
 *
 * Clue scene pilot (feat/clue-scene-pilot): math also passes the
 * scene hook. For ages 7-10 only, an item that carries a scene
 * description (scenes.ts, in data next to the answers) gets a short
 * live-drawn film above its clue card; every other item and band is
 * exactly as before. The hook is answer-blind — SubjectCase hands
 * it the phase from the case's own state, never the answer.
 */
import type { SubjectProps } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import { SubjectCase } from "../shared/SubjectCase";
import { ClueScene } from "../shared/ClueScene";
import { itemsForGroup } from "./items";
import { answerFor } from "./answers";
import { clueSceneFor } from "./scenes";

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
      scene={(item, phase, reduced, band) => {
        if (band !== "7-10") return null;
        const description = clueSceneFor(item.id);
        if (!description) return null;
        return <ClueScene key={item.id} description={description} phase={phase} reduced={reduced} />;
      }}
      {...props}
    />
  );
}
