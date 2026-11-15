/**
 * clue-scene-kinds-c.tsx — three more clue films for the wave-1
 * expansion, drawn live in the browser as ink line-art on paper,
 * in the same discipline as the pilot renderer (ClueScene.tsx).
 * Each component returns an SVG fragment only; the parent scene
 * supplies the <svg> frame (viewBox="0 0 320 190").
 *
 * Answer-blind, structurally (the subject-host-props.ts pattern):
 * each component receives ONLY a scene description (the givens
 * from the item's question, in data next to the answers) and a
 * phase — "setup" before the pick, "solved" after a correct one.
 * It never receives the answer, a choice, or a pick. The setup
 * film sets the scene only and draws no digits at all; the solved
 * beat computes its grouping from the givens at solve time, the
 * derivation the result card prints a moment later.
 *
 * Motion discipline: CSS keyframes only (transform / opacity /
 * stroke draw-on), authored so every element's resting state IS
 * the film's final frame. The one exception is chunk-share's
 * intermediate counters: each is replaced by the next running
 * total, so its keyframes end faded (resting opacity 0) and only
 * the final counter per shelf stands. The film plays once, then
 * rests. Lines curve, nothing is ruler-straight.
 */
import type { CSSProperties } from "react";
import {
  chunkPlan,
  type ClueSceneDescription,
  type ClueScenePhase,
} from "./clue-scene-types";

const delay = (s: number): CSSProperties => ({ animationDelay: `${s.toFixed(2)}s` });
const slideFrom = (fx: number, fy: number, s: number): CSSProperties =>
  ({
    "--fx": `${fx.toFixed(1)}px`,
    "--fy": `${fy.toFixed(1)}px`,
    animationDelay: `${s.toFixed(2)}s`,
  }) as CSSProperties;

/* ── rounding-line ──────────────────────────────────────────────
   A curved line between two flagged ends; a stone sits on it at
   the value's proportional place. Solved: the midpoint fades in,
   the stone slides to the nearer end, and the rounded value pops
   above that end. */

function RoundingLineScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "rounding-line" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { value, low, high } = description;
  const x0 = 30;
  const x1 = 290;
  // The line's curve: M30 112 Q160 104 290 110 — its height at t.
  const lineYAt = (t: number) =>
    (1 - t) * (1 - t) * 112 + 2 * (1 - t) * t * 104 + t * t * 110;
  const t = (value - low) / (high - low);
  const markerX = x0 + t * (x1 - x0);
  const markerY = lineYAt(t);
  const midX = (x0 + x1) / 2;
  const midY = lineYAt(0.5);
  // Nearer end wins; a tie goes to the high end.
  const toHigh = high - value <= value - low;
  const endX = toHigh ? x1 : x0;
  const endY = lineYAt(toHigh ? 1 : 0);
  const rounded = toHigh ? high : low;
  const stone = (
    <>
      <circle className="cs-stone" r="6.5" />
      <circle className="cs-snack-dot" r="2.2" />
    </>
  );
  return (
    <>
      <path className="cs-line cs-draw" pathLength={1} d="M30 112 Q160 104 290 110" style={delay(0)} />
      {/* Flag poles at both ends; pennants pop in beside them. */}
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d="M30 112 L29 93 M290 110 L291 91"
        style={delay(0.3)}
      />
      <path className="cs-flag cs-pop" d="M29 93 L45 97.5 L29 103 Z" style={delay(0.55)} />
      <path className="cs-flag cs-pop" d="M291 91 L275 95.5 L291 101 Z" style={delay(0.65)} />
      {phase === "setup" ? (
        <g transform={`translate(${markerX.toFixed(1)} ${markerY.toFixed(1)})`}>
          <g className="cs-pop" style={delay(0.6)}>
            {stone}
          </g>
        </g>
      ) : (
        <>
          <path
            className="cs-line cs-soft cs-fade"
            strokeDasharray="3 3"
            d={`M${midX} ${(midY - 24).toFixed(1)} Q${midX + 1} ${midY.toFixed(1)} ${midX} ${(midY + 20).toFixed(1)}`}
            style={delay(stepDelay ? stepDelay(0) : 0.5)}
          />
          <g transform={`translate(${endX} ${endY.toFixed(1)})`}>
            <g className="cs-slide" style={slideFrom(markerX - endX, markerY - endY, stepDelay ? stepDelay(1) : 0.8)}>
              {stone}
            </g>
          </g>
          <text className="cs-tick cs-tick-final" x={endX} y="76" style={delay(stepDelay ? stepDelay(1) + 0.8 : 1.6)}>
            {rounded}
          </text>
        </>
      )}
    </>
  );
}

/* ── split-product ──────────────────────────────────────────────
   A hall of long rows. Solved: every row splits at the round
   part's fraction — the round part fills brass-soft, the leftover
   gold — then the two part-products count up and the total stands
   as the final tick. All numbers are computed from the givens. */

function SplitProductScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "split-product" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. Steps:
   * 0 the split overlays, 1 the round-part tick, 2 the leftover
   * tick, 3 the final tick. */
  stepDelay?: (step: number) => number;
}) {
  const { rows, perRow, splitHigh, splitLow } = description;
  const splitBase = stepDelay ? stepDelay(0) : 0.5;
  const barX = 35;
  const barW = 250;
  const barH = 13;
  const firstY = 52;
  const step = 16;
  const splitW = barW * (splitHigh / perRow);
  const splitX = barX + splitW;
  const highTotal = splitHigh * rows;
  const lowTotal = splitLow * rows;
  const total = perRow * rows;
  // Tiny chair nubs along a bar's top edge, as one bumpy path.
  const nubs = (y: number) => {
    let d = "";
    for (let nx = barX + 12; nx < barX + barW - 10; nx += 26) {
      d += `M${nx} ${y} q3.5 -4.5 7 0 `;
    }
    return d.trim();
  };
  const popBase = phase === "solved" ? 0.15 : 0.35;
  return (
    <>
      {Array.from({ length: rows }, (_, r) => {
        const y = firstY + r * step;
        return (
          <g key={`bar-${r}`}>
            <g className="cs-pop" style={delay(popBase + r * 0.09)}>
              <rect className="cs-bar" x={barX} y={y} width={barW} height={barH} rx="6.5" />
              <path className="cs-line cs-soft" d={nubs(y)} />
            </g>
            {phase === "solved" ? (
              <g key={`split-${r}`}>
                <path
                  className="cs-split-high cs-fade"
                  d={`M${(barX + 6.5).toFixed(1)} ${y} H${splitX.toFixed(1)} V${y + barH} H${(barX + 6.5).toFixed(1)} Q${barX} ${y + barH} ${barX} ${y + 6.5} Q${barX} ${y} ${(barX + 6.5).toFixed(1)} ${y} Z`}
                  style={delay(splitBase + r * 0.06)}
                />
                <path
                  className="cs-split-low cs-fade"
                  d={`M${splitX.toFixed(1)} ${y} H${(barX + barW - 6.5).toFixed(1)} Q${barX + barW} ${y} ${barX + barW} ${y + 6.5} Q${barX + barW} ${y + barH} ${(barX + barW - 6.5).toFixed(1)} ${y + barH} H${splitX.toFixed(1)} Z`}
                  style={delay(splitBase + 0.05 + r * 0.06)}
                />
                <path
                  className="cs-line cs-band cs-fade"
                  d={`M${splitX.toFixed(1)} ${y + 1} Q${(splitX + 1.2).toFixed(1)} ${y + 6.5} ${splitX.toFixed(1)} ${y + 12}`}
                  style={delay(splitBase + r * 0.06)}
                />
              </g>
            ) : null}
          </g>
        );
      })}
      {phase === "solved" ? (
        <>
          <text
            className="cs-tick"
            x={(barX + splitW / 2).toFixed(1)}
            y="40"
            style={delay(stepDelay ? stepDelay(1) : 1.5)}
          >
            {highTotal}
          </text>
          <text
            className="cs-tick"
            x={(splitX + (barW - splitW) / 2).toFixed(1)}
            y="40"
            style={delay(stepDelay ? stepDelay(2) : 2.1)}
          >
            {lowTotal}
          </text>
          <text className="cs-tick cs-tick-final" x="160" y="18" style={delay(stepDelay ? stepDelay(3) : 2.7)}>
            {total}
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── chunk-share ────────────────────────────────────────────────
   A pile of book bundles on the left, empty shelves in two
   columns of four. Solved: the per-shelf share is dealt in
   place-value chunks — one alike bundle glyph per chunk flies to
   every shelf in turn, and each shelf's counter steps up by the
   chunk (the chunk's value lives in the counters, not the glyph).
   Intermediate counters rest faded; the final counter stands. */

/** One bundle glyph: three small books standing side by side. */
function BookBundle() {
  return (
    <>
      <rect className="cs-book" x="0" y="-9" width="6.5" height="9" rx="1" />
      <rect className="cs-book-gold" x="7.5" y="-8" width="6.5" height="8" rx="1" />
      <rect className="cs-book" x="15" y="-9" width="6.5" height="9" rx="1" />
    </>
  );
}

function ChunkShareScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "chunk-share" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, chunk c's beat starts at
   * stepDelay(c) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const chunks = chunkPlan(description);
  const running: number[] = [];
  chunks.reduce((acc, c) => {
    const next = acc + c;
    running.push(next);
    return next;
  }, 0);
  const shelfPos = (s: number) => ({
    x0: 104 + Math.floor(s / 4) * 108,
    y: 62 + (s % 4) * 40,
  });
  const pileTop = { x: 52, y: 100 };
  const chunkStart = (c: number) => (stepDelay ? stepDelay(c) : 0.4 + c * 1.15);
  const pileTilt = [-2, 1.5, -1, 2, -1.5];
  return (
    <>
      <path className="cs-line cs-draw" pathLength={1} d="M14 174 Q52 177 90 174" style={delay(0.05)} />
      {/* The unsorted pile: five bundles stacked, slightly askew. */}
      {pileTilt.map((tilt, i) => {
        const w = i % 2 === 0 ? 54 : 48;
        const y = 160 - i * 12;
        return (
          <g key={`pile-${i}`} transform={`rotate(${tilt} 52 ${(y + 5.5).toFixed(1)})`}>
            <g className="cs-pop" style={delay(0.35 + i * 0.1)}>
              <rect
                className={i % 2 === 0 ? "cs-pile-book" : "cs-pile-book-gold"}
                x={52 - w / 2}
                y={y}
                width={w}
                height="11"
                rx="2.5"
              />
            </g>
          </g>
        );
      })}
      {/* Empty shelves: a curved plank with two bracket ticks. */}
      {Array.from({ length: description.shares }, (_, s) => {
        const { x0, y } = shelfPos(s);
        return (
          <g key={`shelf-${s}`}>
            <path
              className="cs-line cs-draw"
              pathLength={1}
              d={`M${x0} ${y} Q${x0 + 46} ${y + 3} ${x0 + 92} ${y}`}
              style={delay(0.15 + s * 0.07)}
            />
            <path
              className="cs-line cs-draw"
              pathLength={1}
              d={`M${x0} ${y} L${x0 - 2} ${y + 7} M${x0 + 92} ${y} L${x0 + 94} ${y + 7}`}
              style={delay(0.25 + s * 0.07)}
            />
          </g>
        );
      })}
      {phase === "solved" ? (
        <>
          {chunks.map((_, c) =>
            Array.from({ length: description.shares }, (_, s) => {
              const { x0, y } = shelfPos(s);
              const gx = x0 + 8;
              const gy = y - c * 9;
              return (
                <g key={`bundle-${c}-${s}`} transform={`translate(${gx} ${gy})`}>
                  <g
                    className="cs-slide"
                    style={slideFrom(pileTop.x - gx, pileTop.y - gy, chunkStart(c) + s * 0.09)}
                  >
                    <BookBundle />
                  </g>
                </g>
              );
            }),
          )}
          {Array.from({ length: description.shares }, (_, s) => {
            const { x0, y } = shelfPos(s);
            return chunks.map((_, c) => {
              const isFinal = c === chunks.length - 1;
              return (
                <text
                  key={`counter-${s}-${c}`}
                  className={
                    isFinal
                      ? "cs-counter cs-counter-final cs-tick-final"
                      : "cs-counter cs-counter-step"
                  }
                  x={x0 + 88}
                  y={y - 5}
                  style={delay(chunkStart(c) + s * 0.09 + 0.6)}
                >
                  {running[c]}
                </text>
              );
            });
          })}
        </>
      ) : null}
    </>
  );
}

export { ChunkShareScene, RoundingLineScene, SplitProductScene };
