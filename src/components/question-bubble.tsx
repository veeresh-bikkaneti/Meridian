import { ChevronDown, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { difficultyChip, type Difficulty } from "@/game/scoring";
import { bubbleHeaderText } from "@/game/question-label";
import { nameTier } from "@/game/place-name";
import { PlaceNameText } from "@/components/place-name";
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

  if (view === "dismissed") {
    return (
      <div className="pointer-events-none absolute top-[max(4rem,env(safe-area-inset-top))] left-2.5 z-20">
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
  // Cartographer's Plate PR2 — the meta band is pinned above the name:
  // eyebrow + difficulty chip in one baseline row. The chip is LOCKED in
  // the band (spec §6.4): same size, label, and position at every tier —
  // never compacts, never leaves, never shrinks below 11px.
  const metaBand = (
    <div className="name-meta">
      <p className="name-eyebrow">{bubbleHeaderText(edition, regionName)}</p>
      <span data-testid="difficulty-chip" className="difficulty-chip">
        {difficultyChip(difficulty)}
      </span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute top-[max(4rem,env(safe-area-inset-top))] left-2.5 z-20 w-[min(352px,calc(100vw-20px))]">
      <Enter key={view} durationMs={expanded ? 400 : 333} reduced={reduced}>
        <div className="game-chrome pointer-events-auto rounded-[20px] p-3 pl-4">
          {metaBand}
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {expanded ? (
                <h2
                  className="place-name qname mt-1.5"
                  data-name-tier={nameTier(placeName)}
                  title={placeName}
                >
                  <PlaceNameText name={placeName} />
                </h2>
              ) : (
                <p
                  className="place-name qname mt-1.5"
                  data-name-tier={nameTier(placeName)}
                  title={placeName}
                >
                  <PlaceNameText name={placeName} />
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                aria-label={expanded ? "Collapse question" : "Expand question"}
                aria-expanded={expanded}
                onClick={() => onViewChange(expanded ? "collapsed" : "open")}
                className="flex size-11 items-center justify-center rounded-full text-[var(--atlas-muted)] transition-all duration-150 hover:bg-white/10 hover:text-[var(--atlas-ink)] active:scale-95"
              >
                <ChevronDown
                  className={`size-5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                aria-label="Hide question"
                onClick={() => onViewChange("dismissed")}
                className="flex size-11 items-center justify-center rounded-full text-[var(--atlas-muted)] transition-all duration-150 hover:bg-white/10 hover:text-[var(--atlas-ink)] active:scale-95"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          {expanded ? (
            <p className="bubble-hint">{hasPin ? HINT_PIN : HINT_EMPTY}</p>
          ) : null}
        </div>
      </Enter>
    </div>
  );
}
