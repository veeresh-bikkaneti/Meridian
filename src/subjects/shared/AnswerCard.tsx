/**
 * The one new UI piece in the scale-play plan (§3), shared by every
 * subject case: a small multiple-choice answer card, styled from the
 * existing clue card (mode-card + name-eyebrow). 44px+ tap targets,
 * real <button>s so the keyboard reaches every choice, and no motion
 * of its own — it renders identically under reduced motion.
 */
export function AnswerCard({
  prompt,
  choices,
  picked,
  onPick,
  testId = "subject-answer-card",
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
}) {
  const wrong = picked !== null;
  return (
    <article className="mode-card p-4" data-testid={testId} aria-label="Answer the question">
      <p className="name-eyebrow">Your turn</p>
      <p className="mt-1 text-fg">{prompt}</p>
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
      {wrong ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Not quite — have another go. The story above holds the clue.
        </p>
      ) : null}
    </article>
  );
}
