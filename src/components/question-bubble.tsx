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

/** Fade/rise entrance. Remounts (via key) replay it for collapse/expand. */
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
      className={`transition-all ease-[cubic-bezier(0.16,1,0.3,1)] ${
        entered
          ? "translate-y-0 scale-100 opacity-100"
          : reduced
            ? "translate-y-0 scale-100 opacity-0"
            : "translate-y-3 scale-[0.98] opacity-0"
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
      <div className="pointer-events-none absolute top-[max(6rem,env(safe-area-inset-top))] left-2.5 z-20">
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
    <div className="pointer-events-none absolute top-[max(6rem,env(safe-area-inset-top))] left-2.5 z-20 w-[min(352px,calc(100vw-20px))]">
      <Enter key={view} durationMs={expanded ? 400 : 333} reduced={reduced}>
        <div
          className="game-chrome bubble-shell pointer-events-auto rounded-[20px]"
          data-name-tier={nameTier(placeName)}
        >
          {metaBand}
          {/* The backstop (spec §5): name + hint as ONE scroll region.
              The scrollbar stays visually hidden (PR #77 — Veeresh's
              will: no scrollbar arrows over the name); the fade + ⋯ +
              "more below" cue is the scroll signal. Keyboard users reach
              the region via tabindex="0" (spec §8.1). */}
          <div className="scroll-cue-wrap bubble-scroll-wrap" hidden={!expanded}>
            <div
              ref={scrollRef}
              className="bubble-scroll"
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
              <p className="bubble-hint">{hasPin ? HINT_PIN : HINT_EMPTY}</p>
            </div>
            <ScrollCue visible={moreBelow} />
          </div>
          {/* Collapsed: meta band + toggle only. The name folds away
              entirely (honest; never clamped) — the folded panel uses
              `hidden`, removed from AT (spec §5/§8.6). */}
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
            {expanded ? "Hide place name" : "Show place name"}
          </button>
        </div>
      </Enter>
    </div>
  );
}
