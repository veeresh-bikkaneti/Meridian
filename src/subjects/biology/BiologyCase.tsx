/**
 * Biology case flow — the component the biology subject module's
 * load() returns (contract I1). A thin wrapper over the shared
 * SubjectCase, passing the subject's title, test-id prefix, band
 * items and answer lookup.
 *
 * No clue scenes exist yet for biology items. When a later wave adds
 * scenes, they will be passed here as the scene hook, mirroring
 * GeneralKnowledgeCase.
 */
import type { SubjectProps } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import type { ResetHistoryResult } from "@/game/reset-history";
import { SubjectCase } from "../shared/SubjectCase";
import { itemsForGroup, answerFor } from "./items";

export default function BiologyCase(
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
      title="Biology"
      subjectId="biology"
      itemsForGroup={itemsForGroup}
      answerFor={answerFor}
      {...props}
    />
  );
}
