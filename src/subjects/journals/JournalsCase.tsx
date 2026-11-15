/**
 * Journals case flow (Stream D, PR D1) — the component the journals
 * subject module's load() returns (contract I1).
 *
 * A thin wrapper over the shared SubjectCase. The clip movies are not
 * rendered yet, so the lead card shows the clip's caption text (the v2
 * plan's poster/caption fallback). Rows without a caption file show the
 * question only.
 */
import type { SubjectProps, UnitItem } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import type { ResetHistoryResult } from "@/game/reset-history";
import { ClueCard } from "@/game/loop/LoopScreen";
import { SubjectCase } from "../shared/SubjectCase";
import { itemsForGroup, captionRefFor } from "./items";
import { answerFor } from "./answers";
import { captionTextFor } from "./caption-files";

function captionLead(item: UnitItem, reduced: boolean) {
  const text = captionTextFor(captionRefFor(item.id));
  if (!text) return null;
  return (
    <div data-testid="journals-caption">
      <ClueCard tier="Clip captions" index={0} text={text} revealed reduced={reduced} />
    </div>
  );
}

export default function JournalsCase(
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
      title="Journals"
      testIdPrefix="journals"
      itemsForGroup={itemsForGroup}
      answerFor={answerFor}
      lead={captionLead}
      {...props}
    />
  );
}
