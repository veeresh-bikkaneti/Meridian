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
 * scene hook. For ages 7-10, 10-18 and 18+, an item that carries a
 * scene description (scenes.ts, in data next to the answers) gets
 * a short live-drawn film above its clue card; every other item
 * and band is exactly as before (ages 18+ descriptions exist only
 * for the two covered items — the held survey-check item carries
 * none, so it stays scene-less). The hook is answer-blind —
 * SubjectCase hands it the phase from the case's own state, never
 * the answer.
 *
 * Act 3: math also passes the resultExtra hook — for the same
 * items whose description carries a summary, the solved
 * result section gains the summary's full script as standing
 * text (the narrated performance itself lives in the scene).
 */
import type { SubjectProps } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import type { ResetHistoryResult } from "@/game/reset-history";
import { SubjectCase } from "../shared/SubjectCase";
import { ClueScene, ClueSummaryText } from "../shared/ClueScene";
import { itemsForGroup } from "./items";
import { answerFor } from "./answers";
import { clueSceneFor } from "./scenes";

export default function MathCase(
  props: SubjectProps & {
    /** GameApp's celebration trigger (the same one LoopScreen receives). */
    onCelebrate?: (spec: CelebrationSpec) => void;
    /** GameApp's End game, forwarded to the shared case's header. */
    onEndGame?: () => void;
    /** GameApp's "Start over" reset flow, forwarded to the case footer. */
    onResetHistory?: () => ResetHistoryResult;
    /** GameApp's GeoDetective resume, forwarded to the case header. */
    onResumeCase?: () => void;
    /** Whether a GeoDetective mystery is mid-play (the loop store). */
    loopInProgress?: boolean;
  },
) {
  return (
    <SubjectCase
      title="Math"
      testIdPrefix="math"
      itemsForGroup={itemsForGroup}
      answerFor={answerFor}
      scene={(item, phase, reduced, band) => {
        if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;
        const description = clueSceneFor(item.id);
        if (!description) return null;
        return <ClueScene key={item.id} description={description} phase={phase} reduced={reduced} />;
      }}
      resultExtra={(item, _reduced, band) => {
        if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;
        const description = clueSceneFor(item.id);
        if (!description?.summary) return null;
        return <ClueSummaryText summary={description.summary} />;
      }}
      {...props}
    />
  );
}
