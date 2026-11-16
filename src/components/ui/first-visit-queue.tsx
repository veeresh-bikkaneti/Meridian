/**
 * FirstVisitQueue: one first-visit prompt at a time (Stream S
 * contract, fix/ui-shared-shell, item 9) — the cure for the
 * first-visit pile-up where the Scout Map notice, tour banner,
 * read-aloud sheet and support bubble all showed at once.
 *
 * The queue owns ORDER and MEMORY only; it has no chrome of its own
 * (designer seat): it renders the hosts' existing prompt nodes
 * unmodified, one at a time, in the order given (Stream N wires
 * Home's order). A prompt the player has already seen — recorded
 * under `seenKey` in localStorage — never shows again. The visible
 * prompt's own dismiss/complete control calls the advance hook
 * (useFirstVisitAdvance), which marks it seen and shows the next.
 *
 * Band rules (UX seat): every prompt must be dismissible in one tap
 * and none may be modal over gameplay — those are properties of the
 * host nodes; the queue guarantees the one-at-a-time half and that
 * advancing never touches screen state behind the prompt.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const AdvanceContext = createContext<() => void>(() => {});

/** Called by the visible prompt's dismiss/complete control. */
export const useFirstVisitAdvance = () => useContext(AdvanceContext);

export type FirstVisitPrompt = { id: string; node: ReactNode };

function readSeen(seenKey: string): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(seenKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seenKey: string, seen: ReadonlySet<string>) {
  try {
    localStorage.setItem(seenKey, JSON.stringify([...seen]));
  } catch {
    /* Storage unavailable (private mode): the queue still advances
     * for this visit; prompts may re-show next visit. */
  }
}

export type FirstVisitQueueProps = {
  /** Most important first; rendered one at a time, in this order. */
  prompts: readonly FirstVisitPrompt[];
  /** localStorage key holding the seen prompt ids. */
  seenKey: string;
  /** Fires when the last unseen prompt is advanced past. */
  onDone?: () => void;
  className?: string;
};

export function FirstVisitQueue({ prompts, seenKey, onDone, className }: FirstVisitQueueProps) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => readSeen(seenKey));
  const current = prompts.find((prompt) => !seen.has(prompt.id));

  const advance = useCallback(() => {
    if (!current) return;
    const next = new Set(seen);
    next.add(current.id);
    writeSeen(seenKey, next);
    setSeen(next);
    if (prompts.every((prompt) => next.has(prompt.id))) onDone?.();
  }, [current, seen, prompts, seenKey, onDone]);

  if (!current) return null;
  return (
    <AdvanceContext.Provider value={advance}>
      <div className={className} data-testid="first-visit-queue" data-prompt-id={current.id}>
        {current.node}
      </div>
    </AdvanceContext.Provider>
  );
}
