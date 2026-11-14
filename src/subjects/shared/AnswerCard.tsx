/**
 * The one new UI piece in the scale-play plan (§3), shared by every
 * subject case: a small multiple-choice answer card, styled from the
 * existing clue card (mode-card + name-eyebrow). 44px+ tap targets,
 * real <button>s so the keyboard reaches every choice, and no motion
 * of its own — it renders identically under reduced motion.
 *
 * Number mode (v2): when the entry's kind is "number", the card
 * renders one labelled text input (minus key available) and a Check
 * button instead of choices — same card, same wrong-answer line,
 * Enter submits. A one-line hint under the input reminds players to
 * use a point for decimals.
 */
import { useEffect, useRef, useState } from "react";
import { parseTypedNumber } from "./answer.ts";

export function AnswerCard({
  prompt,
  choices,
  picked,
  onPick,
  testId = "subject-answer-card",
  kind = "choice",
  onNumber,
  moveFocus = false,
}: {
  prompt: string;
  choices: string[];
  /** The last picked choice, or null before the first pick. A wrong pick
   * stays visible as kind feedback ("try again") until a correct one. */
  picked: string | null;
  onPick: (choice: string) => void;
  /** data-testid for the card; each subject passes its own prefix so
   * per-subject e2e specs keep stable ids (math: "math-answer-card"). */
  testId?: string;
  /** "choice" picks one of `choices`; "number" types a number instead. */
  kind?: "choice" | "number";
  /** Number mode only: called with the parsed number (or null when the
   * typed text is not a number) when the player checks an answer. The
   * second argument is the raw typed text, so the case can show the
   * same wrong-answer line for a mistyped answer. */
  onNumber?: (value: number | null, raw: string) => void;
  /** When true, move focus to the question heading on mount — used
   * when a follow-up question appears, so keyboard and screen-reader
   * users land on it. */
  moveFocus?: boolean;
}) {
  const [typed, setTyped] = useState("");
  // Bumped on every check so a repeated wrong answer remounts the
  // status line and screen readers hear "Not quite" again.
  const [announceTick, setAnnounceTick] = useState(0);
  const promptRef = useRef<HTMLHeadingElement | null>(null);
  const wrong = picked !== null;

  useEffect(() => {
    if (!moveFocus) return;
    const el = promptRef.current;
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, [moveFocus]);

  const checkNumber = () => {
    onNumber?.(parseTypedNumber(typed), typed);
    setAnnounceTick((tick) => tick + 1);
  };

  const pick = (choice: string) => {
    onPick(choice);
    setAnnounceTick((tick) => tick + 1);
  };

  return (
    <article className="mode-card p-4" data-testid={testId} aria-label="Answer the question">
      <p className="name-eyebrow">Your turn</p>
      <h2
        ref={promptRef}
        id={`${testId}-prompt`}
        tabIndex={-1}
        className="mt-1 text-base font-normal text-fg"
      >
        {prompt}
      </h2>
      {kind === "number" ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            checkNumber();
          }}
        >
          <label htmlFor={`${testId}-number`} className="text-sm text-muted">
            Type your answer
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={`${testId}-number`}
              type="text"
              inputMode="text"
              pattern="-?[0-9, ]*\\.?[0-9 ]*"
              autoComplete="off"
              aria-describedby={`${testId}-number-hint`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-2 text-fg"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-xl border border-line bg-bg px-4 py-2 text-fg"
            >
              Check
            </button>
          </div>
          <p id={`${testId}-number-hint`} className="mt-2 text-sm text-muted">
            Use a point for decimals, like 3.5
          </p>
        </form>
      ) : (
        <div className="mt-3 grid gap-2">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-left text-fg"
              aria-pressed={picked === choice}
              onClick={() => pick(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
      {wrong ? (
        <p
          key={announceTick}
          className="mt-3 text-sm text-muted"
          role="status"
          data-announce={announceTick}
        >
          Not quite — have another go. The story above holds the clue.
        </p>
      ) : null}
    </article>
  );
}
