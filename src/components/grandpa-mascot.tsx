import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  DIRECTION_DEAD_ZONE,
  DIRECTION_SECTOR,
  directionCellIndex,
  directionForPointer,
  type GrandpaDirection,
} from "./grandpa-direction";
import {
  grandpaDirectionsUrl,
  grandpaReactionsUrl,
} from "./storyteller-lines";

/**
 * Grandpa mascot (page-mascot, MIT) — replaces the circular-masked
 * storyteller JPEG.
 *
 * Owner rulings (2026-10-10, settled — do not redesign):
 * - Figure-tap = pause/resume narration. The tap calls onToggle; the
 *   mascot reaction is a subordinate visual ack ONLY: a ~180ms blink
 *   flash + a squash bounce (skipped under prefers-reduced-motion).
 *   No dizzy-after-N-taps, no payoff cycle (heart/sparkle/delighted) —
 *   rapid taps mean pause/resume toggling, not a toy.
 * - Cursor tracking is desktop-only: gated on
 *   matchMedia('(hover: hover) and (pointer: fine)') exactly like the
 *   skill. Touch/mobile stays on the static center cell, no listeners.
 * - Real <button>, aria-label preserved, keyboard operable, focus-visible
 *   outline (see storyteller-mascot.css).
 */

export { directionForPointer, type GrandpaDirection };

const REACTIONS = ["blink"] as const;
type Reaction = (typeof REACTIONS)[number];

const HYSTERESIS = 0.12;
const BLINK_MS = 180;
const SQUASH_MS = 420;

const SQUASH: Keyframe[] = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.10, 0.86)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.95, 1.08)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];

/** background-size 300% makes each cell a clean 0/50/100% step on both axes. */
function cell(index: number): CSSProperties {
  return {
    backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
  };
}

function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

const layer: CSSProperties = {
  backgroundSize: "300% 300%",
  backgroundRepeat: "no-repeat",
};

export interface GrandpaMascotProps {
  /** What a screen reader calls it — the pause/resume narration label. */
  label: string;
  /** Figure-tap = pause/resume narration (owner ruling 1). */
  onToggle?: () => void;
  /** Fires when the directions sheet preloads (keeps storyteller_ready). */
  onLoaded?: () => void;
  className?: string;
}

export function GrandpaMascot({
  label,
  onToggle,
  onLoaded,
  className,
}: GrandpaMascotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const squashRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<number[]>([]);
  const [direction, setDirection] = useState<GrandpaDirection>("center");
  const [reaction, setReaction] = useState<Reaction | null>(null);

  // Preload the directions sheet; onLoaded on resolve keeps the
  // storyteller_ready milestone the old <img onLoad> fired.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) onLoaded?.();
    };
    img.src = grandpaDirectionsUrl();
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  // Cursor tracking — desktop only, exactly like page-mascot.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }

    let sector = -1;
    let pointer: { x: number; y: number } | null = null;

    const aim = () => {
      const button = buttonRef.current;
      if (!button || !pointer) return;

      const box = button.getBoundingClientRect();
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);

      if (Math.hypot(dx, dy) < DIRECTION_DEAD_ZONE) {
        sector = -1;
        setDirection("center");
        return;
      }

      // Hold the current sector until the pointer is well past its edge.
      const angle = Math.atan2(dy, dx);
      if (
        sector !== -1 &&
        Math.abs(wrap(angle - sector * DIRECTION_SECTOR)) <
          DIRECTION_SECTOR / 2 + HYSTERESIS
      ) {
        return;
      }

      const next = directionForPointer(dx, dy);
      sector = Math.round(angle / DIRECTION_SECTOR);
      setDirection(next);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", aim, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", aim);
    };
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(window.clearTimeout);
    };
  }, []);

  const handleTap = () => {
    // The tap's job is pause/resume — everything else is a subordinate ack.
    onToggle?.();

    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    setReaction("blink");
    timersRef.current.push(
      window.setTimeout(() => setReaction(null), BLINK_MS),
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Per-keyframe easing with the effect itself linear: an easing on the
    // effect would reinterpret every offset and front-load the bounce.
    squashRef.current?.animate(SQUASH, {
      duration: SQUASH_MS,
      easing: "linear",
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`storyteller-figure${className ? ` ${className}` : ""}`}
      data-testid="storyteller-figure"
      aria-label={label}
      onClick={handleTap}
    >
      <span ref={squashRef} className="mascot-squash" aria-hidden="true">
        <span
          data-testid="storyteller-figure-directions"
          className="mascot-layer"
          style={{
            ...layer,
            backgroundImage: `url(${grandpaDirectionsUrl()})`,
            ...cell(directionCellIndex(direction)),
            opacity: reaction ? 0 : 1,
          }}
        />
        {/* Always mounted so the sheet is fetched up front, never on the
            first tap. */}
        <span
          data-testid="storyteller-figure-reactions"
          className="mascot-layer"
          style={{
            ...layer,
            backgroundImage: `url(${grandpaReactionsUrl()})`,
            ...cell(REACTIONS.indexOf(reaction ?? "blink")),
            opacity: reaction ? 1 : 0,
          }}
        />
      </span>
    </button>
  );
}
