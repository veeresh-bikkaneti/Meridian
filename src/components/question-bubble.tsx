import { ChevronDown, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { difficultyChip, type Difficulty } from "@/game/scoring";
import { bubbleHeaderText } from "@/game/question-label";
import { nameTier } from "@/game/place-name";
import { PlaceNameText } from "@/components/place-name";
import { ScrollCue, useMoreBelow } from "@/components/scroll-cue";
import type { Edition } from "@/game/run";

export type BubbleViewState = "open" | "collapsed" | "dismissed";

// Frosted chrome tokens shared by the floating aim/reveal chrome.
const CHROME =
  "backdrop-blur-[14px] bg-[rgba(10,12,16,0.72)] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";

// UX §6.1 — gesture hints for the current model: tap proposes,
// double-tap / double-click drops the pin, pinch zooms.
const HINT_EMPTY = "Tap the map to place your pin. Double-tap to drop it. Pinch to zoom.";
const HINT_PIN = "Tap to move the pin. Double-tap the map or press Drop pin — that's your one guess.";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Fade/rise entrance. Plays on mount (initial card mount, the dismissed
 * target button, and the hint paragraph's own reveal on expand) — one
 * requestAnimationFrame effect per transition, never chained timers.
 * The reveal rides the locally-vendored motionmaxxing curve
 * var(--pcard-ease-reveal) (= --ease-snap-settle); the .pcard scope on the
 * card wrapper provides it. */
function Enter({
  children,
  durationMs,
  reduced,
}: {
  children: React.ReactNode;
  durationMs: number;
  reduced: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`transition-all ease-[var(--pcard-ease-reveal)] ${
        entered
          ? "translate-y-0 scale-100 opacity-100"
          : reduced
            ? "translate-y-0 scale-100 opacity-0"
            : "translate-y-1 scale-[0.98] opacity-0"
      }`}
      style={{ transitionDuration: `${reduced ? 150 : durationMs}ms` }}
    >
      {children}
    </div>
  );
}

export function QuestionBubble({
  edition,
  regionName,
  placeName,
  difficulty,
  hasPin,
  view,
  onViewChange,
}: {
  edition: Edition;
  regionName: string;
  placeName: string;
  difficulty: Difficulty;
  hasPin: boolean;
  view: BubbleViewState;
  onViewChange: (view: BubbleViewState) => void;
}) {
  const reduced = usePrefersReducedMotion();
  // Cartographer's Plate PR3 — the "more below" cue for the name+hint
  // scroll region. Decorative only (aria-hidden); hidden when the
  // content fits or the region is scrolled to the bottom.
  const { ref: scrollRef, moreBelow } = useMoreBelow<HTMLDivElement>();

  if (view === "dismissed") {
    return (
      <div className="pcard pointer-events-none absolute top-[max(5.5rem,env(safe-area-inset-top))] min-[420px]:top-[max(3.625rem,env(safe-area-inset-top))] left-2.5 z-20">
        <Enter durationMs={267} reduced={reduced}>
          <button
            type="button"
            aria-label="Show question"
            onClick={() => onViewChange("open")}
            className={`pointer-events-auto flex size-11 items-center justify-center rounded-full text-white ${CHROME}`}
          >
            <Target className="size-5" aria-hidden="true" />
          </button>
        </Enter>
      </div>
    );
  }

  const expanded = view === "open";
  // Cartographer's Plate PR3 — the meta band is pinned above the name:
  // eyebrow + difficulty chip in one baseline row, plus the dismiss
  // control. The chip is LOCKED in the band (spec §6.4): same size,
  // label, and position at every tier — never compacts, never leaves,
  // never shrinks below 11px. `position: sticky; top: 0` per spec §5 —
  // the shell's flex-column layout keeps it pinned while the name+hint
  // region scrolls beneath it.
  const metaBand = (
    <div className="name-meta bubble-meta">
      <p className="name-eyebrow">{bubbleHeaderText(edition, regionName)}</p>
      <div className="bubble-meta-actions">
        <span data-testid="difficulty-chip" className="difficulty-chip">
          {difficultyChip(difficulty)}
        </span>
        <button
          type="button"
          aria-label="Hide question"
          onClick={() => onViewChange("dismissed")}
          className="bubble-icon-button"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
  return (
    <div className="pcard pointer-events-none absolute top-[max(5.5rem,env(safe-area-inset-top))] min-[420px]:top-[max(3.625rem,env(safe-area-inset-top))] left-2.5 z-20 w-[min(224px,calc(100vw-20px))] sm:w-[248px]">
      {/* No remount key on this Enter: the card shell stays MOUNTED across
          expand/collapse. Remounting on the view state would detach the
          scroll region div while useMoreBelow's effect keeps observing the
          dead element — the "more below" cue would freeze (spec §8.1).
          The toggle transition is the hint's own reveal + the chevron. */}
      <Enter durationMs={400} reduced={reduced}>
        <div
          className="game-chrome bubble-shell pointer-events-auto rounded-[20px]"
          data-name-tier={nameTier(placeName)}
        >
          {metaBand}
          {/* Place-card redesign 2026-10-11: the card is COMPACT by
              default on mobile (collapsed). The place name IS the question
              — it stays visible in every card state; only the instructions
              fold. One scroll region, kept mounted so useMoreBelow's ref
              stays valid across expand/collapse: collapsed caps it at
              min(24dvh, 12rem) (the card can never fill the screen), open
              keeps the min(38dvh, 20rem) backstop. The hint paragraph
              mounts only when open — folded means removed from AT — with
              its own snap-settle reveal (transform/opacity only). */}
          <div className="scroll-cue-wrap bubble-scroll-wrap">
            <div
              ref={scrollRef}
              className={expanded ? "bubble-scroll" : "bubble-scroll pcard-compact"}
              role="region"
              aria-label="Place name — scroll for more"
              tabIndex={0}
            >
              <h2
                className="place-name qname"
                data-name-tier={nameTier(placeName)}
                title={placeName}
              >
                <PlaceNameText name={placeName} />
              </h2>
              {expanded ? (
                <Enter durationMs={250} reduced={reduced}>
                  <p className="bubble-hint">{hasPin ? HINT_PIN : HINT_EMPTY}</p>
                </Enter>
              ) : null}
            </div>
            <ScrollCue visible={moreBelow} />
          </div>
          {/* The toggle names its consequence: the NAME stays put, the
              INSTRUCTIONS fold (spec §5/§8.6). aria-expanded tracks the
              panel; the chevron rides the vendored curves. */}
          <button
            type="button"
            className="bubble-toggle"
            aria-expanded={expanded}
            onClick={() => onViewChange(expanded ? "collapsed" : "open")}
          >
            <ChevronDown
              className={`size-5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {expanded ? "Hide instructions" : "Show instructions"}
          </button>
        </div>
      </Enter>
    </div>
  );
}
