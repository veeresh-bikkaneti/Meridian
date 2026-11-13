/**
 * General knowledge case flow — the component the general-knowledge
 * subject module's load() returns (contract I1). A thin wrapper over
 * the shared SubjectCase, passing the subject's title, test-id
 * prefix, band items and answer lookup.
 */
import type { SubjectProps } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import { SubjectCase } from "../shared/SubjectCase";
import { itemsForGroup } from "./items";
import { answerFor } from "./answers";

export default function GeneralKnowledgeCase(
  props: SubjectProps & {
    /** GameApp's celebration trigger (the same one LoopScreen receives). */
    onCelebrate?: (spec: CelebrationSpec) => void;
  },
) {
  return (
    <SubjectCase
      title="General knowledge"
      testIdPrefix="general-knowledge"
      itemsForGroup={itemsForGroup}
      answerFor={answerFor}
      {...props}
    />
  );
}
