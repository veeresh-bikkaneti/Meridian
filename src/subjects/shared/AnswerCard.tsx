/**
 * The one new UI piece in the scale-play plan (§3), shared by every
 * subject case: a small multiple-choice answer card, styled from the
 * existing clue card (mode-card + name-eyebrow). 44px+ tap targets,
 * real <button>s so the keyboard reaches every choice, and no motion
 * of its own — it renders identically under reduced motion.
 *
 * Number mode (v2): when the entry's kind is "number", the card
 * renders one labelled number input and a Check button instead of
 * choices — same card, same wrong-answer line, Enter submits.
 */
import { useState } from "react";
import { parseTypedNumber } from "./answer.ts";

export function AnswerCard({
  prompt,
  choices,
  picked,
  onPick,
  testId = "subject-answer-card",
  kind = "choice",
  onNumber,
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
}) {
  const [typed, setTyped] = useState("");
  const wrong = picked !== null;

  const checkNumber = () => {
    onNumber?.(parseTypedNumber(typed), typed);
  };

  return (
    <article className="mode-card p-4" data-testid={testId} aria-label="Answer the question">
      <p className="name-eyebrow">Your turn</p>
      <p className="mt-1 text-fg">{prompt}</p>
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
              inputMode="decimal"
              autoComplete="off"
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
        </form>
      ) : (
        <div className="mt-3 grid gap-2">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-left text-fg"
              aria-pressed={picked === choice}
              onClick={() => onPick(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
      {wrong ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Not quite — have another go. The story above holds the clue.
        </p>
      ) : null}
    </article>
  );
}
