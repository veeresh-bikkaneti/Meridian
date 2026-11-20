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
 *
 * Arrival modal (owner direction, 2026-11-20): a prompt flagged
 * `modal` is an ARRIVAL modal, not a gameplay one — it renders only
 * where the host mounts the queue (Home, before any game can start)
 * and while it is up the page is held: a backdrop covers the page,
 * scrolling is locked, focus is trapped inside the prompt, and the
 * host makes the page inert (onModalChange drives the host's inert
 * wrapper, the same mechanism as the ask-first age gate). There is
 * no dismiss-without-answering: no backdrop-click close, no Escape
 * close — the prompt's own answer control is the only way out. The
 * modal layer renders through a portal to document.body so it can
 * escape the host's inert subtree; the portal waits for mount so
 * prerendered shells never try to portal on the server.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const AdvanceContext = createContext<() => void>(() => {});

/** Called by the visible prompt's dismiss/complete control. */
export const useFirstVisitAdvance = () => useContext(AdvanceContext);

export type FirstVisitPrompt = {
  id: string;
  node: ReactNode;
  /**
   * Arrival-modal prompt: while this prompt is the visible one the
   * page behind it is held (backdrop, scroll lock, focus trap, host
   * inert) until the prompt's own control answers it. Only for
   * prompts that can appear at arrival, never over gameplay.
   */
  modal?: boolean;
  /**
   * Accessible name for the arrival-modal layer: the id of the
   * heading inside this prompt's node, rendered on the modal div
   * as aria-labelledby. Prompts without a heading of their own
   * omit it (React drops an undefined aria-labelledby).
   */
  labelledBy?: string;
};

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
  /**
   * Fires with true while a `modal` prompt is the visible one and
   * false once it leaves, so the host can make the page inert for
   * exactly that span (the ask-first age gate's mechanism).
   */
  onModalChange?: (active: boolean) => void;
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

/** The modal variant keeps the overlay's box (same seat below the
 *  header, same gutters and fit) and adds the modal layer's z-index
 *  via .first-visit-queue-modal in styles.css. */
const MODAL_CLASS = "first-visit-queue-modal";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * The arrival-modal hold: while `active`, lock page scroll, keep
 * focus inside `containerRef`'s box, swallow Escape (there is no
 * dismiss-without-answering), and tell the host to inert the page.
 * Everything is restored when the modal prompt leaves.
 */
function useArrivalModal(
  active: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  onModalChange?: (active: boolean) => void,
) {
  useEffect(() => {
    if (!active) return;
    onModalChange?.(true);

    const body = document.body;
    const root = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevRootOverflow = root.style.overflow;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    // Focus starts inside the sheet: the prompt's first control.
    focusablesIn(containerRef.current)[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // No dismiss-without-answering: the key is swallowed so no
        // handler behind the modal can treat it as a close either.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusablesIn(containerRef.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = containerRef.current?.contains(document.activeElement) ?? false;
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const container = containerRef.current;
      if (container && e.target instanceof Node && !container.contains(e.target)) {
        focusablesIn(container)[0]?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      // A tap on the backdrop drops focus to the body (it is not a
      // focusable element); pull focus back inside once the tap has
      // resolved, so focus lives in the sheet for its whole stay.
      const container = containerRef.current;
      if (container && e.target instanceof Node && !container.contains(e.target)) {
        requestAnimationFrame(() => focusablesIn(container)[0]?.focus());
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      body.style.overflow = prevBodyOverflow;
      root.style.overflow = prevRootOverflow;
      onModalChange?.(false);
    };
  }, [active, containerRef, onModalChange]);
}

export function FirstVisitQueue({ prompts, seenKey, onDone, onModalChange, className, placement = "overlay" }: FirstVisitQueueProps) {
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

  const modalActive = current?.modal === true;
  const modalRef = useRef<HTMLDivElement | null>(null);
  // Portals cannot render during prerender/SSR: the modal layer
  // waits for the client mount, then takes the page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useArrivalModal(modalActive && mounted, modalRef, onModalChange);

  if (!current) return null;

  if (modalActive) {
    if (!mounted) return null;
    return (
      <AdvanceContext.Provider value={advance}>
        {createPortal(
          <>
            {/* The backdrop has no click handler on purpose: there
                is no dismiss-without-answering. It covers the page
                so taps land on it, never on the page behind. */}
            <div className="first-visit-modal-backdrop" data-testid="first-visit-modal-backdrop" aria-hidden="true" />
            <div
              ref={modalRef}
              className={`${OVERLAY_CLASS} ${MODAL_CLASS} ${className ?? ""}`.trim()}
              data-testid="first-visit-queue"
              data-prompt-id={current.id}
              data-placement={placement}
              data-modal="true"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={current.labelledBy}
            >
              {current.node}
            </div>
          </>,
          document.body,
        )}
      </AdvanceContext.Provider>
    );
  }

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
