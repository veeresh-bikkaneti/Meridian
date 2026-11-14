/**
 * Generic subject case flow, shared by every subject (extracted from
 * the math case, scale-play wave 1, with no visual change).
 *
 * Flow, per the plan's table (§3): the problem is read through the
 * existing ClueCard (the item's why, numbers kept to the question),
 * the shared AnswerCard asks one question, and the result mirrors
 * LoopReveal's visual language with the item's useElsewhere as "You
 * just used this in…". LoopReveal itself takes a geographic
 * LoopPuzzleState + LoopClueFile, so it is not reused as a component —
 * fabricating a puzzle for it would invent scores, which its own
 * comment forbids.
 *
 * DetectiveHost and the detective machine are unchanged and not mounted
 * here: the pair ships dark behind detectivePair in prod, and subject
 * items have no voice clips, so the case is text only with no new
 * audio. The win fires GameApp's existing celebration through
 * onCelebrate, on the same first-win guard LoopScreen uses.
 *
 * Each subject's own case component is a thin wrapper that passes its
 * title, its test-id prefix, its band items and its answer lookup.
 */
import { useEffect, useRef, useState } from "react";
import type { AgeGroup, SubjectProps, UnitItem } from "../registry";
import { getAgeGroup } from "@/game/age-profile";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ClueCard } from "@/game/loop/LoopScreen";
import {
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
  type CelebrationSpec,
} from "@/components/celebration-copy";
import { AnswerCard } from "./AnswerCard";
import { HomeButton } from "@/components/ui/home-button";
import { ScreenShell } from "@/components/ui/screen-shell";
import { advanceCasePhase, type AnswerFor, type CasePhase } from "./answer";

export type SubjectCaseConfig = {
  /** Subject title as kids see it ("Math", "Physics", …). */
  title: string;
  /** Prefix for data-testids ("math" keeps math-case, math-result, …). */
  testIdPrefix: string;
  /** The subject's playable items for one age band, in deal order. */
  itemsForGroup: (group: AgeGroup) => UnitItem[];
  /** The subject's answer lookup, keyed by item id. */
  answerFor: AnswerFor;
};

export function SubjectCase({
  title,
  testIdPrefix,
  itemsForGroup,
  answerFor,
  group,
  onExit,
  onCelebrate,
}: SubjectCaseConfig &
  SubjectProps & {
    /** GameApp's celebration trigger (the same one LoopScreen receives). */
    onCelebrate?: (spec: CelebrationSpec) => void;
  }) {
  const reduced = usePrefersReducedMotion();
  // The registry passes the session's group; fall back to the stored
  // profile read so a direct mount still deals the right band.
  const band = group ?? getAgeGroup();
  const items = itemsForGroup(band);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // "main" asks the entry; "followUp" asks its follow-up; "done"
  // shows the result with both answers.
  const [phase, setPhase] = useState<CasePhase>("main");
  const solved = phase === "done";
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Arrival focus, the LoopScreen pattern: land focus on the heading so
  // it is never stranded on the Home card that opened the case.
  useEffect(() => {
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, []);

  const item = items[index] ?? null;
  const answer = item ? answerFor(item.id) : null;

  if (!item || !answer) {
    return (
      <ScreenShell onHome={onExit} title={`${title} case`} titleRef={headingRef}>
        <p className="mt-4 text-fg">
          No {title.toLowerCase()} case is ready for this age band yet.
        </p>
      </ScreenShell>
    );
  }

  // The entry currently being asked: the follow-up once the main
  // answer is correct, otherwise the entry itself.
  const active = phase === "followUp" && answer.followUp ? answer.followUp : answer;

  // Shared correct-answer path for picks and typed numbers: advance
  // the phase, and celebrate once, on the first correct answer.
  const onCorrect = () => {
    setPhase((p) => advanceCasePhase(answer, p, true));
    setPicked(null);
    if (phase === "main" && onCelebrate && !hasCelebratedFirstWin()) {
      markFirstWinCelebrated();
      onCelebrate(celebrationSpec("mystery-solved", "first-win"));
    }
  };

  const pick = (choice: string) => {
    if (solved) return;
    if (choice === active.correct) {
      onCorrect();
    } else {
      setPicked(choice);
    }
  };

  const checkNumber = (value: number | null, raw: string) => {
    if (solved) return;
    // A number entry carries its value; an unparseable typed answer
    // is wrong the same way a wrong pick is.
    if (value === null || active.value === undefined || value !== active.value) {
      setPicked(raw);
    } else {
      onCorrect();
    }
  };

  const nextCase = () => {
    setIndex((i) => (i + 1) % items.length);
    setPicked(null);
    setPhase("main");
  };

  return (
    <ScreenShell
      onHome={onExit}
      testId={`${testIdPrefix}-case`}
      data={{ "data-band": band, "data-item": item.id }}
      eyebrow="Case file · Why it matters"
      title={`Why Do We Learn This? — ${title}`}
      titleRef={headingRef}
      sub={`Case ${index + 1} of ${items.length} · Ages ${band}`}
    >

      <div className="mt-6 grid gap-4">
        <ClueCard tier={title} index={0} text={item.why} revealed reduced={reduced} />
        {!solved ? (
          <AnswerCard
            key={`${item.id}:${phase}`}
            prompt={active.prompt}
            choices={active.choices}
            picked={picked}
            onPick={pick}
            testId={`${testIdPrefix}-answer-card`}
            kind={active.kind ?? "choice"}
            onNumber={checkNumber}
            moveFocus={phase === "followUp"}
          />
        ) : (
          <section
            aria-label="You solved it"
            className="loop-reveal mode-surface rounded-2xl border p-4"
            data-testid={`${testIdPrefix}-result`}
          >
            <p className="verdict-headline loop-verdict-headline">🎯 You got it!</p>
            <p className="mt-2 text-fg">
              The answer is <strong>{answer.correct}</strong>. {answer.derivation}
            </p>
            {answer.followUp ? (
              <p className="mt-2 text-fg">
                Follow-up: <strong>{answer.followUp.correct}</strong>.{" "}
                {answer.followUp.derivation}
              </p>
            ) : null}
            <p className="mt-3 text-fg" data-testid={`${testIdPrefix}-used-in`}>
              You just used this in… {item.useElsewhere[0] ?? "everyday life"}.
            </p>
            <div className="mt-4 grid gap-2">
              {items.length > 1 ? (
                <button
                  type="button"
                  className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-fg"
                  onClick={nextCase}
                >
                  🔎 Next case
                </button>
              ) : null}
              <HomeButton onHome={onExit} testId="home-button-end" variant="secondary" className="w-full rounded-xl" />
            </div>
          </section>
        )}
      </div>
    </ScreenShell>
  );
}
