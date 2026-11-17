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
  /**
   * Where the visible prompt sits (Round 2, Q1 — owner-ruled):
   * "overlay" (default) fixes it below the header, out of the
   * document flow, so a prompt appearing can never push the
   * header — or anything else — down the page. "flow" is the
   * pre-Q1 behaviour, rendering in place at the mount point.
   * The owner's word flips it back with this one prop.
   */
  placement?: "overlay" | "flow";
};

/** Fixed below the header, centred, on the overlay layer. The
 *  position, top offset, gutters, max width/height and z-index all
 *  live in styles.css (.first-visit-queue-overlay): the home page
 *  lifts every direct child with position: relative, and only the
 *  named rule outranks that lift — bare utilities lose to it, and
 *  a full-width class made the sheet overflow small viewports. */
const OVERLAY_CLASS = "first-visit-queue-overlay inset-x-4 mx-auto max-w-xl";

export function FirstVisitQueue({ prompts, seenKey, onDone, className, placement = "overlay" }: FirstVisitQueueProps) {
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
      <div
        className={placement === "overlay" ? `${OVERLAY_CLASS} ${className ?? ""}`.trim() : className}
        data-testid="first-visit-queue"
        data-prompt-id={current.id}
        data-placement={placement}
      >
        {current.node}
      </div>
    </AdvanceContext.Provider>
  );
}
