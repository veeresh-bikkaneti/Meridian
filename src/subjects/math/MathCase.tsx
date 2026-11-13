/**
 * Math case flow (scale-play wave 1) — the component the math subject
 * module's load() returns (contract I1).
 *
 * Flow, per the plan's table (§3): the problem is read through the
 * existing ClueCard (the item's why, numbers kept to the question), the
 * new AnswerCard asks one question, and the result mirrors LoopReveal's
 * visual language with the item's useElsewhere as "You just used this
 * in…". LoopReveal itself takes a geographic LoopPuzzleState +
 * LoopClueFile, so it is not reused as a component — fabricating a
 * puzzle for it would invent scores, which its own comment forbids.
 *
 * DetectiveHost and the detective machine are unchanged and not mounted
 * here: the pair ships dark behind detectivePair in prod, and math items
 * have no voice clips, so the case is text only with no new audio.
 * The win fires GameApp's existing celebration through onCelebrate,
 * on the same first-win guard LoopScreen uses.
 */
import { useEffect, useRef, useState } from "react";
import type { SubjectProps } from "../registry";
import { getAgeGroup } from "@/game/age-profile";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ClueCard } from "@/game/loop/LoopScreen";
import {
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
  type CelebrationSpec,
} from "@/components/celebration-copy";
import { itemsForGroup } from "./items";
import { answerFor } from "./answers";
import { AnswerCard } from "./AnswerCard";

export default function MathCase({
  group,
  onExit,
  onCelebrate,
}: SubjectProps & {
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
  const [solved, setSolved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Arrival focus, the LoopScreen pattern: land focus on the heading so
  // it is never stranded on the Home card that opened the case.
  useEffect(() => {
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus();
  }, []);

  const item = items[index] ?? null;
  const answer = item ? answerFor(item.id) : null;

  if (!item || !answer) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl text-fg">
          Math case
        </h1>
        <p className="mt-4 text-muted">No math case is ready for this age band yet.</p>
        <button
          type="button"
          className="mt-6 min-h-[44px] rounded-xl border border-line bg-bg px-4 py-2 text-fg"
          onClick={onExit}
        >
          Back to Home
        </button>
      </main>
    );
  }

  const pick = (choice: string) => {
    if (solved) return;
    if (choice === answer.correct) {
      setSolved(true);
      setPicked(null);
      if (onCelebrate && !hasCelebratedFirstWin()) {
        markFirstWinCelebrated();
        onCelebrate(celebrationSpec("mystery-solved", "first-win"));
      }
    } else {
      setPicked(choice);
    }
  };

  const nextCase = () => {
    setIndex((i) => (i + 1) % items.length);
    setPicked(null);
    setSolved(false);
  };

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8"
      data-testid="math-case"
      data-band={band}
      data-item={item.id}
    >
      <p className="name-eyebrow">Case file · Why it matters</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl text-fg">
        Why Do We Learn This? — Math
      </h1>
      <p className="mt-2 text-sm text-muted">
        Case {index + 1} of {items.length} · Ages {band}
      </p>

      <div className="mt-6 grid gap-4">
        <ClueCard tier="Math" index={0} text={item.why} revealed reduced={reduced} />
        {!solved ? (
          <AnswerCard prompt={answer.prompt} choices={answer.choices} picked={picked} onPick={pick} />
        ) : (
          <section
            aria-label="You solved it"
            className="loop-reveal mode-surface rounded-2xl border p-4"
            data-testid="math-result"
          >
            <p className="verdict-headline loop-verdict-headline">🎯 You got it!</p>
            <p className="mt-2 text-fg">
              The answer is <strong>{answer.correct}</strong>. {answer.derivation}
            </p>
            <p className="mt-3 text-fg" data-testid="math-used-in">
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
              <button
                type="button"
                className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-fg"
                onClick={onExit}
              >
                Back to Home
              </button>
            </div>
          </section>
        )}
        {!solved ? (
          <button
            type="button"
            className="min-h-[44px] rounded-xl border border-line bg-bg px-4 py-2 text-fg"
            onClick={onExit}
          >
            Back to Home
          </button>
        ) : null}
      </div>
    </main>
  );
}
