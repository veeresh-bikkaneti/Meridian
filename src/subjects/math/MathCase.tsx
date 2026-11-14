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
 * Holmes & Watson follow-up (owner rules, 2026-11-12): when — and only
 * when — the detectivePair flag resolves on (the game-app.tsx pattern:
 * await the shared flags load, then read the flag; boot-time value is
 * authoritative), the pair's bench strip mounts above the case and
 * SubjectCase's answer-blind events drive its voice (case-voice.ts).
 * The strip is behind React.lazy, so a flag-off session contains no
 * pair DOM at all and renders exactly what main renders. No flag
 * default is changed here.
 */
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { SubjectProps } from "../registry";
import type { CelebrationSpec } from "@/components/celebration-copy";
import { isEnabled, loadFlags } from "@/lib/flags";
import { SubjectCase, type SubjectCaseEvent } from "../shared/SubjectCase";
import { itemsForGroup } from "./items";
import { answerFor } from "./answers";
import type { MathCaseEvent } from "./case-voice";

const MathPair = lazy(() => import("./MathPair"));

export default function MathCase(
  props: SubjectProps & {
    /** GameApp's celebration trigger (the same one LoopScreen receives). */
    onCelebrate?: (spec: CelebrationSpec) => void;
  },
) {
  const [pairOn, setPairOn] = useState(false);
  const [events, setEvents] = useState<readonly MathCaseEvent[]>([]);

  useEffect(() => {
    let active = true;
    loadFlags().then(() => {
      if (active) setPairOn(isEnabled("detectivePair"));
    });
    return () => {
      active = false;
    };
  }, []);

  const onCaseEvent = useCallback((event: SubjectCaseEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const subjectCase = (
    <SubjectCase
      title="Math"
      testIdPrefix="math"
      itemsForGroup={itemsForGroup}
      answerFor={answerFor}
      onCaseEvent={pairOn ? onCaseEvent : undefined}
      {...props}
    />
  );
  if (!pairOn) return subjectCase;
  return (
    <>
      <Suspense fallback={null}>
        <MathPair events={events} />
      </Suspense>
      {subjectCase}
    </>
  );
}
