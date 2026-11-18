/**
 * Chemistry case flow — the component the chemistry subject module's
 * load() returns (contract I1). A thin wrapper over the shared
 * SubjectCase, passing chemistry's title, subject id, band items
 * and answer lookup.
 *
 * Clue scenes (expansion waves 7-8): chemistry also passes
 * the scene hook, mirroring PhysicsCase. For ages 7-10, 10-18
 * and 18+, an item that carries a scene description
 * (scenes.ts, in data next to the answers) gets a short
 * live-drawn film above its clue card; every item carries one
 * since wave 8 completed Chemistry 16/16. The hook is
 * answer-blind — SubjectCase hands it the phase from the case's
 * own state, never the answer.
 *
 * Act 3: chemistry also passes the resultExtra hook — for the
 * same items whose description carries a summary, the solved
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

export default function ChemistryCase(
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
      title="Chemistry"
      subjectId="chemistry"
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
