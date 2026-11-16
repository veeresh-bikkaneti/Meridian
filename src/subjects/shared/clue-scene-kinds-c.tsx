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
import { seeded } from "./clue-scene-easing";

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
  const firstY = 52;
  // Wave 3: a description with many rows (24) draws compact bars
  // so every row stays inside the frame; the wave-1 counts (8 or
  // fewer) keep the original bar height and step, byte for byte.
  const compact = rows > 8;
  const barH = compact ? 3.4 : 13;
  const step = compact ? Math.min(5.2, (176 - firstY) / rows) : 16;
  const splitW = barW * (splitHigh / perRow);
  const splitX = barX + splitW;
  const highTotal = splitHigh * rows;
  const lowTotal = splitLow * rows;
  const total = perRow * rows;
  // Tiny chair nubs along a bar's top edge, as one bumpy path.
  const nubs = (y: number) => {
    let d = "";
    const rise = compact ? 1.8 : 4.5;
    for (let nx = barX + 12; nx < barX + barW - 10; nx += 26) {
      d += `M${nx} ${y} q3.5 ${-rise} 7 0 `;
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
  // Many shares (the 10-18 standard-algorithm item shares among
  // 28 people): the two-column shelf wall cannot hold them, so
  // the same chunking beat plays on a compact grid of share
  // plates — one plate per share, the same bundle-per-chunk
  // flight, the same running counters, tighter stagger.
  if (description.shares > 8) {
    const cols = 7;
    const platePos = (s: number) => ({
      x: 38 + (s % cols) * 38,
      y: 62 + Math.floor(s / cols) * 31,
    });
    const compactStart = (c: number) => (stepDelay ? stepDelay(c) : 0.4 + c * 1.15);
    return (
      <>
        <path className="cs-line cs-draw" pathLength={1} d="M14 174 Q160 178 306 174" style={delay(0.05)} />
        {/* The unsorted pile along the top: five bundles askew. */}
        {pileTilt.map((tilt, i) => {
          const y = 22 + (i % 2) * 3;
          const x = 96 + i * 26;
          return (
            <g key={`cpile-${i}`} transform={`rotate(${tilt} ${x} ${y})`}>
              <g className="cs-pop" style={delay(0.3 + i * 0.08)}>
                <rect className={i % 2 === 0 ? "cs-pile-book" : "cs-pile-book-gold"} x={x - 11} y={y} width="22" height="8" rx="2" />
              </g>
            </g>
          );
        })}
        {Array.from({ length: description.shares }, (_, s) => {
          const p = platePos(s);
          return (
            <ellipse
              key={`plate-${s}`}
              className="cs-line cs-draw"
              pathLength={1}
              cx={p.x}
              cy={p.y + 12}
              rx="15"
              ry="4"
              style={delay(0.15 + s * 0.03)}
            />
          );
        })}
        {phase === "solved" ? (
          <>
            {chunks.map((_, c) =>
              Array.from({ length: description.shares }, (_, s) => {
                const p = platePos(s);
                const gx = p.x - 8;
                const gy = p.y + 6 - c * 6;
                return (
                  <g key={`cbundle-${c}-${s}`} transform={`translate(${gx} ${gy})`}>
                    <g className="cs-slide" style={slideFrom(160 - gx, 24 - gy, compactStart(c) + s * 0.035)}>
                      <g transform="scale(0.72)">
                        <BookBundle />
                      </g>
                    </g>
                  </g>
                );
              }),
            )}
            {Array.from({ length: description.shares }, (_, s) => {
              const p = platePos(s);
              return chunks.map((_, c) => {
                const isFinal = c === chunks.length - 1;
                return (
                  <text
                    key={`ccounter-${s}-${c}`}
                    className={isFinal ? "cs-counter cs-counter-final cs-tick-final" : "cs-counter cs-counter-step"}
                    x={p.x + 17}
                    y={p.y - 2}
                    style={delay(compactStart(c) + s * 0.035 + 0.5)}
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

/* ── Wave 2 kinds (Math 10-18): rate-bars, journey-line,
   spend-then-group, bearing-diagram ────────────────────────────
   Same discipline as the kinds above: givens only before the
   pick, no digits in the setup film; the solved beat computes
   its splits, hops and angles from the givens at solve time.
   Steps: rate-bars paces three (first bar priced, second bar
   priced, the cheaper bar ringed); journey-line paces one step
   per hour hop on a steady-pace item and two steps on a
   part-walked item (the walked fill, then the final tick);
   spend-then-group paces the one-off payment plus one step per
   group; bearing-diagram paces three (east leg, north leg, the
   angle arc). */

export function RateBarsScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "rate-bars" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { firstMetres, firstCoins, secondMetres, secondCoins } = description;
  const firstRate = firstCoins / firstMetres;
  const secondRate = secondCoins / secondMetres;
  const cheaperSecond = secondRate < firstRate;
  const x0 = 30;
  const perMetre = 46;
  const bars = [
    { metres: firstMetres, coins: firstCoins, rate: firstRate, y: 58, step: 0 },
    { metres: secondMetres, coins: secondCoins, rate: secondRate, y: 118, step: 1 },
  ];
  const barStart = (s: number) => (stepDelay ? stepDelay(s) : 0.5 + s * 0.95);
  return (
    <>
      <path className="cs-line cs-draw" pathLength={1} d="M16 176 Q160 180 304 176" style={delay(0)} />
      {bars.map((bar, bi) => {
        const w = bar.metres * perMetre;
        return (
          <g key={`bar-${bi}`}>
            <g className="cs-pop" style={delay(0.3 + bi * 0.15)}>
              <rect className="cs-bar" x={x0} y={bar.y} width={w} height="17" rx="6" />
            </g>
            {/* The stall's coins under its bar (a given; no digits). */}
            {Array.from({ length: bar.coins }, (_, i) => (
              <g key={`coin-${bi}-${i}`} transform={`translate(${x0 + 12 + i * 17} ${bar.y + 32})`}>
                <g className="cs-pop" style={delay(0.5 + bi * 0.15 + i * 0.05)}>
                  <circle className="cs-coin" r="6" />
                  <circle className="cs-coin-inner" r="3" />
                </g>
              </g>
            ))}
            {phase === "solved" ? (
              <>
                {Array.from({ length: bar.metres - 1 }, (_, i) => {
                  const x = x0 + (i + 1) * perMetre;
                  return (
                    <path
                      key={`split-${bi}-${i}`}
                      className="cs-line cs-band cs-fade"
                      d={`M${x} ${bar.y + 1} Q${x + 1} ${bar.y + 8.5} ${x} ${bar.y + 16}`}
                      style={delay(barStart(bar.step) + i * 0.12)}
                    />
                  );
                })}
                <text className="cs-tick" x={x0 + w / 2} y={bar.y - 10} style={delay(barStart(bar.step) + 0.55)}>
                  {bar.rate}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
      {phase === "solved" ? (
        <ellipse
          className="cs-ring"
          cx={x0 + ((cheaperSecond ? secondMetres : firstMetres) * perMetre) / 2}
          cy={(cheaperSecond ? 118 : 58) + 8.5}
          rx={((cheaperSecond ? secondMetres : firstMetres) * perMetre) / 2 + 9}
          ry="19"
          style={delay(stepDelay ? stepDelay(2) + 0.4 : 2.6)}
        />
      ) : null}
    </>
  );
}

export function JourneyLineScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "journey-line" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { totalKm, hours, targetKm, aheadKm } = description;
  const x0 = 26;
  const x1 = 294;
  const y = 118;
  const pathD = `M${x0} ${y} Q110 ${y - 14} 180 ${y - 4} Q240 ${y + 6} ${x1} ${y - 8}`;
  if (hours !== undefined && targetKm !== undefined) {
    // Steady pace: hops of totalKm/hours along the target path.
    const perHour = totalKm / hours;
    const hops = Math.round(targetKm / perHour);
    const hopX = (h: number) => x0 + (h / hops) * (x1 - x0);
    const knownX = x0 + (totalKm / targetKm) * (x1 - x0);
    const hopStart = (s: number) => (stepDelay ? stepDelay(s) : 0.4 + s * 0.5);
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 52 Q160 46 296 52" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d={pathD} style={delay(0)} />
        {/* The known stretch's end flag (a given distance). */}
        <path className="cs-line cs-draw" pathLength={1} d={`M${knownX.toFixed(1)} ${y - 4} L${knownX.toFixed(1)} ${y - 26}`} style={delay(0.3)} />
        <path className="cs-flag cs-pop" d={`M${knownX.toFixed(1)} ${y - 26} L${(knownX + 14).toFixed(1)} ${y - 21.5} L${knownX.toFixed(1)} ${y - 16} Z`} style={delay(0.5)} />
        <path className="cs-line cs-draw" pathLength={1} d={`M${x1} ${y - 8} L${x1} ${y - 30}`} style={delay(0.35)} />
        <path className="cs-flag cs-pop" d={`M${x1} ${y - 30} L${x1 - 14} ${y - 25.5} L${x1} ${y - 20} Z`} style={delay(0.55)} />
        {/* The walker at the start. */}
        <g className="cs-pop" style={delay(0.45)}>
          <circle className="cs-child-head" cx={x0} cy={y - 16} r="5" />
          <path className="cs-child-body" d={`M${x0 - 7} ${y - 4} Q${x0} ${y - 11} ${x0 + 7} ${y - 4}`} />
        </g>
        {phase === "solved"
          ? Array.from({ length: hops }, (_, h) => (
              <g key={`hop-${h}`}>
                <circle className="cs-stone cs-pop" cx={hopX(h + 1).toFixed(1)} cy={y - 2} r="4" style={delay(hopStart(h))} />
                <text className={`cs-tick${h === hops - 1 ? " cs-tick-final" : ""}`} x={hopX(h + 1).toFixed(1)} y={y + 24} style={delay(hopStart(h) + 0.3)}>
                  {h + 1}
                </text>
              </g>
            ))
          : null}
      </>
    );
  }
  // Part walked: the walked part fills in from the start; the
  // part still ahead (a given) is the unfilled remainder — the
  // fill's end is never marked before the pick.
  const walkedKm = totalKm - (aheadKm ?? 0);
  const walkedX = x0 + (walkedKm / totalKm) * (x1 - x0);
  const fillStart = stepDelay ? stepDelay(0) : 0.55;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 52 Q160 46 296 52" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={pathD} style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${x1} ${y - 8} L${x1} ${y - 30}`} style={delay(0.3)} />
      <path className="cs-flag cs-pop" d={`M${x1} ${y - 30} L${x1 - 14} ${y - 25.5} L${x1} ${y - 20} Z`} style={delay(0.5)} />
      <g className="cs-pop" style={delay(0.45)}>
        <circle className="cs-child-head" cx={x0} cy={y - 16} r="5" />
        <path className="cs-child-body" d={`M${x0 - 7} ${y - 4} Q${x0} ${y - 11} ${x0 + 7} ${y - 4}`} />
      </g>
      {phase === "solved" ? (
        <>
          <path
            className="cs-line cs-band cs-fade"
            strokeWidth="5"
            d={`M${x0} ${y} Q110 ${y - 14} 180 ${y - 4} Q${(180 + walkedX) / 2} ${y + 2} ${walkedX.toFixed(1)} ${y - 6}`}
            style={delay(fillStart)}
          />
          <circle className="cs-stone cs-pop" cx={walkedX.toFixed(1)} cy={y - 6} r="5" style={delay(fillStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={walkedX.toFixed(1)} y={y - 24} style={delay(stepDelay ? stepDelay(1) + 0.6 : 1.7)}>
            {walkedKm}
          </text>
        </>
      ) : null}
    </>
  );
}

export function SpendThenGroupScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "spend-then-group" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { total, fixedCost, perGroup } = description;
  const rest = total - fixedCost;
  const groups = Math.round(rest / perGroup);
  // The coin pile (a loose grid layout, same every load).
  const pilePos = (i: number) => ({
    x: 52 + (i % 7) * 17 + (Math.floor(i / 7) % 2) * 6,
    y: 62 + Math.floor(i / 7) * 17,
  });
  const groupPos = (g: number) => ({ x: 42 + g * 52, y: 138 });
  const payStart = stepDelay ? stepDelay(0) : 0.5;
  const groupStart = (g: number) => (stepDelay ? stepDelay(1 + g) : 1.3 + g * 0.55);
  const coin = (
    <>
      <circle className="cs-coin" r="7" />
      <circle className="cs-coin-inner" r="3.6" />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 34 Q160 30 296 34" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 168 Q160 172 304 168" style={delay(0)} />
      {/* The till at the top right, waiting for the one-off charge. */}
      <g className="cs-pop" style={delay(0.4)}>
        <path className="cs-line" d="M238 44 Q238 32 240 26 Q262 23 284 26 Q286 32 286 44" />
        <path className="cs-line" d="M240 44 Q262 47 284 44" />
      </g>
      {/* Empty cups along the bottom. */}
      {Array.from({ length: groups }, (_, g) => {
        const p = groupPos(g);
        return (
          <path
            key={`cup-${g}`}
            className="cs-line cs-draw"
            pathLength={1}
            d={`M${p.x - 12} ${p.y + 14} Q${p.x - 10} ${p.y + 28} ${p.x} ${p.y + 29} Q${p.x + 10} ${p.y + 28} ${p.x + 12} ${p.y + 14}`}
            style={delay(0.3 + g * 0.08)}
          />
        );
      })}
      {phase === "setup"
        ? Array.from({ length: total }, (_, i) => {
            const p = pilePos(i);
            return (
              <g key={i} transform={`translate(${p.x} ${p.y})`}>
                <g className="cs-pop" style={delay(0.45 + i * 0.04)}>
                  {coin}
                </g>
              </g>
            );
          })
        : Array.from({ length: total }, (_, i) => {
            const start = pilePos(i);
            let fin: { x: number; y: number };
            let startAt: number;
            if (i < fixedCost) {
              fin = { x: 250 + (i % 2) * 13, y: 52 + Math.floor(i / 2) * 11 };
              startAt = payStart + i * 0.09;
            } else {
              const j = i - fixedCost;
              const g = Math.floor(j / perGroup);
              const slot = j % perGroup;
              const p = groupPos(g);
              fin = { x: p.x - 8 + slot * 8, y: p.y + 6 - (slot % 2) * 3 };
              startAt = groupStart(g) + slot * 0.07;
            }
            return (
              <g key={i} transform={`translate(${fin.x} ${fin.y})`}>
                <g className="cs-slide" style={slideFrom(start.x - fin.x, start.y - fin.y, startAt)}>
                  {coin}
                </g>
              </g>
            );
          })}
      {phase === "solved" ? (
        <>
          <text className="cs-tick" x="262" y="18" style={delay(payStart + fixedCost * 0.09 + 0.4)}>
            {rest}
          </text>
          {Array.from({ length: groups }, (_, g) => {
            const p = groupPos(g);
            return (
              <ellipse
                key={`ring-${g}`}
                className="cs-ring"
                cx={p.x}
                cy={p.y + 12}
                rx="21"
                ry="17"
                style={delay(groupStart(g) + perGroup * 0.07 + 0.3)}
              />
            );
          })}
        </>
      ) : null}
    </>
  );
}

export function BearingDiagramScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "bearing-diagram" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { eastKm, northKm } = description;
  const scale = 88 / Math.max(eastKm, northKm);
  const ox = 92;
  const oy = 152;
  const eastX = ox + eastKm * scale;
  const northY = oy - northKm * scale;
  const bearing = Math.round((Math.atan2(eastKm, northKm) * 180) / Math.PI);
  const legStart = (s: number) => (stepDelay ? stepDelay(s) : 0.5 + s * 0.8);
  // The arc at the origin, from north toward the direct line.
  const arcR = 34;
  const endAngle = Math.atan2(eastKm, northKm);
  const arcEnd = { x: ox + Math.sin(endAngle) * arcR, y: oy - Math.cos(endAngle) * arcR };
  return (
    <>
      {/* Map frame and a faint grid. */}
      <path className="cs-line cs-draw" pathLength={1} d="M52 176 Q160 180 268 176 Q272 100 268 24 Q160 18 52 24 Q48 100 52 176 Z" style={delay(0)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M106 24 Q104 100 106 176 M160 20 Q158 100 160 178 M214 22 Q212 100 214 176" style={delay(0.15)} />
      {/* The north arrow at the harbour. */}
      <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${ox} ${oy} L${ox} ${oy - 52}`} style={delay(0.3)} />
      <path className="cs-tip cs-pop" d={`M${ox} ${oy - 60} L${ox - 4.5} ${oy - 48} L${ox + 4.5} ${oy - 48} Z`} style={delay(0.5)} />
      {/* The boat at the harbour. */}
      <g className="cs-pop" style={delay(0.45)}>
        <path className="cs-line" d={`M${ox - 9} ${oy + 3} Q${ox} ${oy + 8} ${ox + 9} ${oy + 3} L${ox + 6} ${oy - 3} L${ox - 6} ${oy - 3} Z`} />
        <path className="cs-line" d={`M${ox} ${oy - 3} L${ox} ${oy - 10}`} />
      </g>
      {phase === "solved" ? (
        <>
          <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${ox} ${oy} Q${(ox + eastX) / 2} ${oy + 3} ${eastX} ${oy}`} style={delay(legStart(0))} />
          <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${eastX} ${oy} Q${eastX + 3} ${(oy + northY) / 2} ${eastX} ${northY}`} style={delay(legStart(1))} />
          <path className="cs-line cs-soft cs-draw" pathLength={1} strokeDasharray="4 3" d={`M${ox} ${oy} Q${(ox + eastX) / 2} ${(oy + northY) / 2 - 6} ${eastX} ${northY}`} style={delay(legStart(1) + 0.3)} />
          <path
            className="cs-line cs-band cs-fade"
            d={`M${ox} ${oy - arcR} A${arcR} ${arcR} 0 0 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`}
            style={delay(stepDelay ? stepDelay(2) : 2.1)}
          />
          <text className="cs-tick cs-tick-final" x={ox + 26} y={oy - 44} style={delay(stepDelay ? stepDelay(2) + 0.7 : 2.8)}>
            {`${bearing}°`}
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── tower-measure (wave 3) ────────────────────────────────────
   A tower between two height lines. Setup: the tower outline
   and both guide lines (the question's two heights, drawn
   spatially) — no bracket, no digits, no difference. Solved in
   three steps: 0 the difference bracket fades in on the right,
   1 the tower's new part fills between the two heights, 2 the
   final tick stands beside the bracket with the difference,
   computed from the givens. */

export function TowerMeasureScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "tower-measure" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { oldHeight, newHeight } = description;
  const groundY = 156;
  const topY = 26;
  const yFor = (hgt: number) => groundY - (hgt / newHeight) * (groundY - topY);
  const newY = yFor(newHeight);
  const oldY = yFor(oldHeight);
  const diff = newHeight - oldHeight;
  return (
    <>
      <path className="cs-line cs-draw" pathLength={1} d="M20 156 Q160 160 300 156" style={delay(0)} />
      {/* The tower: a tapered shaft, a crown, and a spire. */}
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d={`M138 156 Q142 96 148 ${newY + 22} L150 ${newY + 10} M182 156 Q178 96 172 ${newY + 22} L170 ${newY + 10}`}
        style={delay(0.15)}
      />
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d={`M146 ${newY + 12} Q160 ${newY + 4} 174 ${newY + 12} L172 ${newY + 24} Q160 ${newY + 19} 148 ${newY + 24} Z`}
        style={delay(0.3)}
      />
      <path className="cs-line cs-draw" pathLength={1} d={`M160 ${newY + 6} L160 ${newY - 8}`} style={delay(0.4)} />
      <g className="cs-pop" style={delay(0.55)}>
        <circle className="cs-stone" cx="160" cy={newY - 11} r="3.2" />
      </g>
      {/* The two height guide lines — the question's own givens. */}
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M104 ${newY.toFixed(1)} Q190 ${(newY - 2).toFixed(1)} 268 ${newY.toFixed(1)}`} style={delay(0.45)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M104 ${oldY.toFixed(1)} Q190 ${(oldY - 2).toFixed(1)} 268 ${oldY.toFixed(1)}`} style={delay(0.55)} />
      {phase === "solved" ? (
        <>
          <path
            className="cs-line cs-band cs-fade"
            d={`M252 ${newY.toFixed(1)} L262 ${newY.toFixed(1)} L262 ${oldY.toFixed(1)} L252 ${oldY.toFixed(1)}`}
            style={delay(stepDelay ? stepDelay(0) : 0.7)}
          />
          <path
            className="cs-split-high cs-fade"
            d={`M149 ${(newY + 3).toFixed(1)} Q160 ${newY.toFixed(1)} 171 ${(newY + 3).toFixed(1)} L170 ${oldY.toFixed(1)} Q160 ${(oldY - 2).toFixed(1)} 150 ${oldY.toFixed(1)} Z`}
            style={delay(stepDelay ? stepDelay(1) : 1.4)}
          />
          <text className="cs-tick cs-tick-final" x="262" y={((newY + oldY) / 2 + 4).toFixed(1)} style={delay(stepDelay ? stepDelay(2) + 0.6 : 2.2)}>
            {diff}
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── seesaw-lift (wave 4) ──────────────────────────────────────
   A board over a log, a box on the far end. Setup: the board
   rests level, the box sits still — no tilt, no arrow. Solved
   in three steps: 0 a push arrow presses the near end down,
   1 the tilted board draws in and the box rides the far end
   up, 2 a ring and the final tick stand over the lifted box.
   The tilt is drawn as geometry, not a rotation, so the still
   frame rests exactly on the film's final frame. */

export function SeesawLiftScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "seesaw-lift" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const pressStart = stepDelay ? stepDelay(0) : 0.5;
  const tiltStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const boxArt = (
    <>
      <rect className="cs-pack" x="-14" y="-26" width="28" height="26" rx="3" />
      <path className="cs-line cs-band" d="M-13 -10 Q0 -12 13 -10" />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 40 Q160 36 296 40" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 160 Q160 164 304 160" style={delay(0)} />
      {/* The log the board rests over. */}
      <g className="cs-pop" style={delay(0.3)}>
        <circle className="cs-stone" cx="160" cy="147" r="12" />
        <circle className="cs-snack-dot" cx="160" cy="147" r="4" />
      </g>
      {phase === "setup" ? (
        <>
          <path className="cs-line cs-draw" pathLength={1} d="M38 122 Q160 117 282 122" style={delay(0.15)} />
          <path className="cs-line cs-draw" pathLength={1} d="M38 130 Q160 125 282 130" style={delay(0.25)} />
          <g transform="translate(252 122)">
            <g className="cs-pop" style={delay(0.5)}>{boxArt}</g>
          </g>
        </>
      ) : (
        <>
          {/* The push: an arrow presses the near end down. */}
          <g className="cs-slide" style={slideFrom(0, -16, pressStart)}>
            <path className="cs-line cs-band" d="M54 58 L54 94" />
            <path className="cs-tip" d="M54 103 L47 91 L61 91 Z" />
          </g>
          {/* The board, tipped over the log: near end down, far
              end up — drawn in as the tip happens. */}
          <path className="cs-line cs-draw" pathLength={1} d="M38 140 Q160 112 282 82" style={delay(tiltStart)} />
          <path className="cs-line cs-draw" pathLength={1} d="M38 148 Q160 120 282 90" style={delay(tiltStart + 0.1)} />
          <g transform="translate(252 88)">
            <g className="cs-slide" style={slideFrom(0, 34, tiltStart)}>
              {boxArt}
            </g>
          </g>
          <ellipse className="cs-ring" cx="252" cy="75" rx="21" ry="19" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="252" y="44" style={delay(tickStart + 0.55)}>
            ↑
          </text>
        </>
      )}
    </>
  );
}

/* ── light-path (wave 5) ─────────────────────────────────────
   A lamp, a book and an eye, left to right. Setup: the three
   objects only (plus, for the blocking item, the card waiting
   at the side) — NO ray path is drawn before the pick, because
   the path is the answer's mechanism. Solved in three steps:
   0 the ray runs from the lamp to the book, 1 it runs on from
   the book to the eye — or, with a card, the card slides in
   and the ray stops at it — 2 the final tick stands. One kind
   serves both items; `withCard` is the kind's own data. */

export function LightPathScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "light-path" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  if (description.threeMaterials) {
    // Wave-6 variant (physics:mirror:three-ways): one lamp
    // faces three materials stacked at the right — dark cloth,
    // clear sheet, mirror. Setup draws the objects only, no
    // ray at all. Solved in three steps: 0 the light runs to
    // the cloth and is soaked up, 1 it passes through the
    // sheet and bounces back off the mirror, 2 the final tick
    // stands over the mirror. The wave-5 paths below are
    // untouched.
    const clothStart = stepDelay ? stepDelay(0) : 0.5;
    const passStart = stepDelay ? stepDelay(1) : 1.4;
    const tickStart = stepDelay ? stepDelay(2) : 2.3;
    const lampX = 46;
    const matX = 238;
    const rows = [
      { cy: 56, kind: "cloth" },
      { cy: 98, kind: "sheet" },
      { cy: 140, kind: "mirror" },
    ] as const;
    const lampArt = (
      <>
        <path className="cs-line" d={`M${lampX} 156 L${lampX} 100`} />
        <path className="cs-tip" d={`M${lampX - 13} 102 L${lampX + 15} 84 L${lampX + 19} 98 L${lampX - 9} 108 Z`} />
        <path className="cs-line cs-band" d={`M${lampX - 10} 158 Q${lampX} 155 ${lampX + 10} 158`} />
      </>
    );
    const material = (cy: number, kind: string) => {
      if (kind === "cloth") {
        return (
          <>
            <path className="cs-line" d={`M${matX - 16} ${cy - 16} Q${matX} ${cy - 20} ${matX + 16} ${cy - 16} L${matX + 14} ${cy + 16} Q${matX} ${cy + 12} ${matX - 14} ${cy + 16} Z`} />
            <path className="cs-line cs-soft" d={`M${matX - 10} ${cy - 6} Q${matX} ${cy - 9} ${matX + 10} ${cy - 6} M${matX - 10} ${cy + 5} Q${matX} ${cy + 2} ${matX + 10} ${cy + 5}`} />
          </>
        );
      }
      if (kind === "sheet") {
        return (
          <>
            <rect className="cs-bar" x={matX - 4} y={cy - 17} width="8" height="34" rx="2" />
            <path className="cs-line cs-soft" d={`M${matX - 1} ${cy - 12} Q${matX + 1} ${cy} ${matX - 1} ${cy + 12}`} />
          </>
        );
      }
      return (
        <>
          <rect className="cs-pack" x={matX - 5} y={cy - 18} width="10" height="36" rx="2" />
          <path className="cs-line cs-band" d={`M${matX} ${cy - 13} Q${matX + 2} ${cy} ${matX} ${cy + 13}`} />
        </>
      );
    };
    const rayTo = (cy: number, start: number) => (
      <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${lampX + 17} 96 Q150 ${cy} ${matX - 18} ${cy}`} style={delay(start)} />
    );
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d="M20 160 Q160 164 300 160" style={delay(0)} />
        <g className="cs-pop" style={delay(0.35)}>{lampArt}</g>
        {rows.map((row, i) => (
          <g key={row.kind} className="cs-pop" style={delay(0.45 + i * 0.12)}>
            {material(row.cy, row.kind)}
          </g>
        ))}
        {phase === "solved" ? (
          <>
            {/* To the cloth: the light arrives and stops. */}
            {rayTo(rows[0].cy, clothStart)}
            <circle className="cs-stone cs-pop" cx={matX - 22} cy={rows[0].cy} r="3.2" style={delay(clothStart + 0.5)} />
            {/* Through the sheet: the light runs on past it. */}
            {rayTo(rows[1].cy, passStart)}
            <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M${matX + 6} ${rows[1].cy} Q${matX + 24} ${rows[1].cy - 2} ${matX + 40} ${rows[1].cy}`} style={delay(passStart + 0.35)} />
            {/* Off the mirror: the light bounces back. */}
            {rayTo(rows[2].cy, passStart + 0.2)}
            <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${matX - 6} ${rows[2].cy} Q${matX - 44} ${rows[2].cy + 16} ${matX - 78} ${rows[2].cy + 12}`} style={delay(passStart + 0.6)} />
            <ellipse className="cs-ring" cx={matX} cy={rows[2].cy} rx="16" ry="24" style={delay(tickStart + 0.4)} />
            <text className="cs-tick cs-tick-final" x={matX} y="98" style={delay(tickStart + 0.55)}>
              ✓
            </text>
          </>
        ) : null}
      </>
    );
  }
  const { withCard } = description;
  const rayStart = stepDelay ? stepDelay(0) : 0.5;
  const onwardStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const midY = 96;
  const lampX = 44;
  const bookX = 148;
  const eyeX = 272;
  const cardX = 214;
  const lamp = (
    <>
      <path className="cs-line" d={`M${lampX} 150 L${lampX} ${midY + 6}`} />
      <path className="cs-tip" d={`M${lampX - 13} ${midY + 8} L${lampX + 15} ${midY - 12} L${lampX + 19} ${midY + 2} L${lampX - 9} ${midY + 14} Z`} />
      <path className="cs-line cs-band" d={`M${lampX - 10} 152 Q${lampX} 149 ${lampX + 10} 152`} />
    </>
  );
  const book = (
    <>
      <rect className="cs-pack" x={bookX - 17} y={midY - 13} width="34" height="26" rx="3" />
      <path className="cs-line cs-band" d={`M${bookX} ${midY - 12} Q${bookX - 1} ${midY} ${bookX} ${midY + 12}`} />
      <path className="cs-line cs-soft" d={`M${bookX - 12} ${midY - 5} Q${bookX - 6} ${midY - 6} ${bookX - 3} ${midY - 5} M${bookX + 3} ${midY - 5} Q${bookX + 6} ${midY - 6} ${bookX + 12} ${midY - 5}`} />
    </>
  );
  const eye = (
    <>
      <path className="cs-line" d={`M${eyeX - 18} ${midY} Q${eyeX} ${midY - 15} ${eyeX + 18} ${midY} Q${eyeX} ${midY + 15} ${eyeX - 18} ${midY} Z`} />
      <circle className="cs-stone" cx={eyeX} cy={midY} r="6" />
      <circle className="cs-snack-dot" cx={eyeX} cy={midY} r="2.4" />
    </>
  );
  const card = (cx: number, cy: number) => (
    <>
      <rect className="cs-pack" x={cx - 13} y={cy - 30} width="26" height="60" rx="3" />
      <path className="cs-line cs-soft" d={`M${cx - 8} ${cy - 18} Q${cx} ${cy - 20} ${cx + 8} ${cy - 18} M${cx - 8} ${cy + 16} Q${cx} ${cy + 14} ${cx + 8} ${cy + 16}`} />
    </>
  );
  const ray = (x1: number, x2: number, start: number) => (
    <>
      <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${x1} ${midY - 4} Q${(x1 + x2) / 2} ${midY - 9} ${x2} ${midY - 4}`} style={delay(start)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M${x1} ${midY + 5} Q${(x1 + x2) / 2} ${midY} ${x2} ${midY + 5}`} style={delay(start + 0.12)} />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      {/* The shelf/table line the book rests on. */}
      <path className="cs-line cs-draw" pathLength={1} d="M20 154 Q160 158 300 154" style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${bookX - 30} 116 Q${bookX} 113 ${bookX + 30} 116`} style={delay(0.2)} />
      <g className="cs-pop" style={delay(0.35)}>{lamp}</g>
      <g className="cs-pop" style={delay(0.5)}>{book}</g>
      <g className="cs-pop" style={delay(0.65)}>{eye}</g>
      {withCard && phase === "setup" ? (
        /* The card waits at the side, out of the light's way. */
        <g className="cs-pop" style={delay(0.75)}>{card(292, 138)}</g>
      ) : null}
      {phase === "solved" ? (
        <>
          {ray(lampX + 16, bookX - 18, rayStart)}
          {withCard ? (
            <>
              {/* The ray runs on from the book — and stops at
                  the card, which slides in between book and eye. */}
              {ray(bookX + 18, cardX - 14, onwardStart)}
              <g transform={`translate(${cardX - 292} 0)`}>
                <g className="cs-slide" style={slideFrom(292 - cardX, 42, onwardStart)}>
                  {card(292, midY)}
                </g>
              </g>
            </>
          ) : (
            ray(bookX + 18, eyeX - 20, onwardStart)
          )}
          <ellipse className="cs-ring" cx={withCard ? cardX : eyeX} cy={midY} rx={withCard ? 24 : 28} ry={withCard ? 38 : 24} style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={withCard ? cardX : eyeX} y="52" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── energy-ledger (wave 6) ──────────────────────────────────
   A battery store and its log: change = in − out. Setup: the
   store outline and the two given bars (out, change) at equal
   weight — the in bar, which is the answer, is never drawn
   before the pick. Solved in three steps: 0 the out bar
   stands, 1 the change bar stacks onto it, 2 the in bar —
   exactly as long as the two stacked — draws above them with
   the final tick. Every length is computed from the givens. */

export function EnergyLedgerScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "energy-ledger" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { change, out } = description;
  const into = change + out;
  const outStart = stepDelay ? stepDelay(0) : 0.5;
  const stackStart = stepDelay ? stepDelay(1) : 1.4;
  const inStart = stepDelay ? stepDelay(2) : 2.3;
  const x0 = 92;
  const unit = 30;
  const inY = 62;
  const outY = 100;
  const changeY = 132;
  const bar = (y: number, units: number, cls: string, start: number) => (
    <g className="cs-grow" style={delay(start)}>
      <rect className={cls} x={x0} y={y - 10} width={units * unit} height="20" rx="3" />
    </g>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 168 Q160 172 304 168" style={delay(0)} />
      {/* The battery store the log belongs to. */}
      <g className="cs-pop" style={delay(0.4)}>
        <rect className="cs-pack" x="34" y="66" width="38" height="76" rx="4" />
        <path className="cs-line cs-band" d="M46 66 L46 56 Q53 53 60 56 L60 66" />
        <path className="cs-line cs-soft" d="M40 92 Q53 89 66 92 M40 116 Q53 113 66 116" />
      </g>
      {/* The log's two given bars, drawn in setup at rest. */}
      {phase === "setup" ? (
        <>
          <g className="cs-pop" style={delay(0.55)}>
            <rect className="cs-bar" x={x0} y={outY - 10} width={out * unit} height="20" rx="3" />
          </g>
          <g className="cs-pop" style={delay(0.65)}>
            <rect className="cs-bar" x={x0} y={changeY - 10} width={change * unit} height="20" rx="3" />
          </g>
        </>
      ) : (
        <>
          {/* Step 0: the out bar stands on its own line. */}
          {bar(outY, out, "cs-bar", outStart)}
          <text className="cs-tick" x={x0 + out * unit + 10} y={outY + 5} style={delay(outStart + 0.4)}>
            {out}
          </text>
          {/* Step 1: the change bar stacks onto the out bar's
              line, end to end. */}
          <g transform={`translate(${out * unit} ${outY - changeY})`}>
            <g className="cs-grow" style={delay(stackStart)}>
              <rect className="cs-split-high" x={x0} y={changeY - 10} width={change * unit} height="20" rx="3" />
            </g>
          </g>
          <text className="cs-tick" x={x0 + into * unit + 10} y={outY + 5} style={delay(stackStart + 0.4)}>
            {change}
          </text>
          {/* Step 2: the in bar above — exactly the stacked
              length — with the final tick. */}
          {bar(inY, into, "cs-split-low", inStart)}
          <text className="cs-tick cs-tick-final" x={x0 + into * unit + 10} y={inY + 5} style={delay(inStart + 0.5)}>
            {into}
          </text>
        </>
      )}
    </>
  );
}

/* ── Wave 7 kinds (Chemistry): salt-melt, dissolve,
   particle-states, water-cycle ────────────────────────────────
   Same discipline as the kinds above: givens only in the setup
   film, no outcome before the pick. Each kind paces three
   steps: salt-melt (the specks settle, the melt pools spread,
   the final tick — the air stays cold throughout, its cold
   marks drawn in both phases alike); dissolve (the crystals
   break, the tiny dots spread, the final tick; the threeBlocks
   variant drops one block per glass, one dissolves, two stay);
   particle-states (warmth reaches the first panels, the dots
   fly apart in the last, the final tick); water-cycle (the
   puddle shrinks and wisps rise, the cloud gathers, the rain
   falls back with the final tick). */

const SALT_SPECKS = [
  { x: 92, y: 118 },
  { x: 138, y: 112 },
  { x: 184, y: 119 },
  { x: 228, y: 113 },
];

export function SaltMeltScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "salt-melt" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const settleStart = stepDelay ? stepDelay(0) : 0.5;
  const meltStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const roadY = 148;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      {/* Cold-air marks: drawn in BOTH phases alike — the air
          never warms, before the pick or after it. */}
      {[64, 128, 192, 256].map((sx, i) => (
        <path
          key={`cold-${i}`}
          className="cs-line cs-soft cs-draw"
          pathLength={1}
          d={`M${sx} 52 L${sx} 64 M${sx - 5} 58 L${sx + 5} 58 M${sx - 4} 54 L${sx + 4} 62 M${sx - 4} 62 L${sx + 4} 54`}
          style={delay(0.3 + i * 0.08)}
        />
      ))}
      {/* The icy road: one unbroken sheet in setup. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${roadY} Q160 ${roadY + 4} 304 ${roadY}`} style={delay(0)} />
      <path className="cs-stone" d={`M28 128 Q160 122 292 128 L292 146 Q160 150 28 146 Z`} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M36 136 Q160 131 284 136" style={delay(0.35)} />
      {/* The salt specks resting on the ice (the givens). */}
      {SALT_SPECKS.map((s, i) => (
        <circle key={`salt-${i}`} className="cs-coin cs-pop" cx={s.x} cy={s.y} r="3.4" style={delay(0.5 + i * 0.1)} />
      ))}
      {phase === "solved" ? (
        <>
          {/* Step 0: the specks settle into the ice surface. */}
          {SALT_SPECKS.map((s, i) => (
            <ellipse
              key={`settle-${i}`}
              className="cs-ring-soft cs-pop"
              cx={s.x}
              cy={s.y + 8}
              rx="10"
              ry="4"
              style={delay(settleStart + i * 0.12)}
            />
          ))}
          {/* Step 1: melt pools spread around each speck while
              the cold marks above stay exactly as they were. */}
          {SALT_SPECKS.map((s, i) => (
            <ellipse
              key={`pool-${i}`}
              className="cs-line cs-band cs-pop"
              cx={s.x}
              cy={s.y + 16}
              rx="17"
              ry="5.5"
              style={delay(meltStart + i * 0.14)}
            />
          ))}
          <ellipse className="cs-ring" cx="160" cy="128" rx="112" ry="26" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="88" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/** One glass of water, centred on (0,0), waterline at y=-18. */
function DissolveGlassArt() {
  return (
    <>
      <path className="cs-line" d="M-30 -44 L-26 40 Q0 46 26 40 L30 -44" />
      <path className="cs-line cs-soft" d="M-28 -18 Q0 -22 28 -18" />
      <path className="cs-line cs-band" d="M-29 -30 Q0 -34 29 -30" />
    </>
  );
}

/** Tiny dots spread through a glass's water (solved only). */
function DissolvedDots({ start, small }: { start: number; small?: boolean }) {
  const rnd = seeded(small ? 41 : 37);
  const dots: { x: number; y: number }[] = [];
  const n = small ? 10 : 22;
  for (let i = 0; i < n; i++) {
    dots.push({ x: -22 + rnd() * 44, y: -14 + rnd() * 48 });
  }
  return (
    <>
      {dots.map((d, i) => (
        <circle
          key={`dot-${i}`}
          className="cs-stone cs-pop"
          cx={d.x.toFixed(1)}
          cy={d.y.toFixed(1)}
          r={small ? 1.3 : 1.7}
          style={delay(start + i * 0.05)}
        />
      ))}
    </>
  );
}

export function DissolveScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "dissolve" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const breakStart = stepDelay ? stepDelay(0) : 0.5;
  const spreadStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  if (description.threeBlocks) {
    // Identify variant: three unmarked blocks beside three
    // glasses in setup (nothing marks which is which); solved
    // drops one block into each glass — the middle one
    // dissolves, the other two stay whole.
    const glassX = [76, 160, 244];
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
        {glassX.map((gx, gi) => (
          <g key={`glass-${gi}`} transform={`translate(${gx} 108) scale(0.82)`}>
            <g className="cs-pop" style={delay(0.35 + gi * 0.12)}>
              <DissolveGlassArt />
            </g>
            {phase === "solved" && gi === 1 ? (
              <DissolvedDots start={spreadStart} small />
            ) : null}
            {phase === "solved" && gi !== 1 ? (
              <g transform="translate(0 16)">
                <g className="cs-slide" style={slideFrom(0, -64, breakStart + gi * 0.15)}>
                  <rect className="cs-pack" x="-11" y="-11" width="22" height="22" rx="2" />
                </g>
              </g>
            ) : null}
          </g>
        ))}
        {phase === "setup"
          ? glassX.map((gx, gi) => (
              <g key={`block-${gi}`} transform={`translate(${gx} 40)`}>
                <g className="cs-pop" style={delay(0.55 + gi * 0.12)}>
                  <rect className="cs-pack" x="-11" y="-11" width="22" height="22" rx="2" />
                  <path className="cs-line cs-band" d="M-10 -4 Q0 -6 10 -4" />
                </g>
              </g>
            ))
          : null}
        {phase === "solved" ? (
          <>
            {/* The dissolving block's own slide into its glass. */}
            <g transform="translate(160 124)">
              <g className="cs-slide" style={slideFrom(0, -84, breakStart + 0.1)}>
                <rect className="cs-pack cs-dim" x="-11" y="-11" width="22" height="22" rx="2" />
              </g>
            </g>
            <ellipse className="cs-ring" cx="160" cy="108" rx="34" ry="44" style={delay(tickStart + 0.4)} />
            <text className="cs-tick cs-tick-final" x="160" y="34" style={delay(tickStart + 0.55)}>
              ✓
            </text>
          </>
        ) : null}
      </>
    );
  }
  // Single glass: crystals whole at the bottom in setup.
  const crystals = [
    { x: -14, y: 26, r: 0 },
    { x: 2, y: 30, r: 24 },
    { x: 15, y: 25, r: 48 },
    { x: -4, y: 18, r: 12 },
  ];
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      <g transform="translate(160 104) scale(1.25)">
        <g className="cs-pop" style={delay(0.35)}>
          <DissolveGlassArt />
        </g>
        {phase === "setup" ? (
          crystals.map((c, i) => (
            <g key={`crystal-${i}`} transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}>
              <g className="cs-pop" style={delay(0.55 + i * 0.1)}>
                <path className="cs-stone" d="M0 -7 L6 0 L0 7 L-6 0 Z" />
              </g>
            </g>
          ))
        ) : (
          <>
            {/* Step 0: the crystals crack into shards. */}
            {crystals.map((c, i) => (
              <g key={`shard-${i}`} transform={`translate(${c.x} ${c.y}) rotate(${c.r + 30})`}>
                <g className="cs-pop" style={delay(breakStart + i * 0.12)}>
                  <path className="cs-stone cs-dim" d="M0 -3.5 L3 0 L0 3.5 L-3 0 Z" />
                </g>
              </g>
            ))}
            {/* Step 1: tiny dots spread through all the water. */}
            <DissolvedDots start={spreadStart} />
          </>
        )}
      </g>
      {phase === "solved" ? (
        <>
          <ellipse className="cs-ring" cx="160" cy="104" rx="48" ry="62" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="30" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/** Dot layouts for the three state panels: packed, loose,
 * flying apart — the question's own three pictures, drawn the
 * same in both phases (no warmth progression in setup). */
const PARTICLE_PANELS: { cx: number; dots: { x: number; y: number }[] }[] = [
  {
    cx: 62,
    dots: [
      { x: -12, y: -12 }, { x: 0, y: -12 }, { x: 12, y: -12 },
      { x: -12, y: 0 }, { x: 0, y: 0 }, { x: 12, y: 0 },
      { x: -12, y: 12 }, { x: 0, y: 12 }, { x: 12, y: 12 },
    ],
  },
  {
    cx: 160,
    dots: [
      { x: -16, y: -8 }, { x: -4, y: -14 }, { x: 10, y: -6 },
      { x: -10, y: 4 }, { x: 4, y: 2 }, { x: 16, y: 12 },
      { x: -16, y: 14 }, { x: 6, y: 14 },
    ],
  },
  {
    cx: 258,
    dots: [
      { x: -20, y: -18 }, { x: 2, y: -20 }, { x: 20, y: -14 },
      { x: -14, y: 2 }, { x: 12, y: 4 },
      { x: -20, y: 18 }, { x: 4, y: 16 }, { x: 20, y: 20 },
    ],
  },
];

export function ParticleStatesScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "particle-states" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const warmStart = stepDelay ? stepDelay(0) : 0.5;
  const flyStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const panelY = 96;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 164 Q160 168 304 164" style={delay(0)} />
      {/* A kettle under the panels: the question's own scene. */}
      <path className="cs-line cs-draw" pathLength={1} d="M138 164 L140 148 Q160 142 180 148 L182 164 M180 150 Q196 146 194 138" style={delay(0.25)} />
      {PARTICLE_PANELS.map((panel, pi) => (
        <g key={`panel-${pi}`}>
          <rect className="cs-line cs-draw" pathLength={1} x={panel.cx - 34} y={panelY - 38} width="68" height="76" rx="4" style={delay(0.3 + pi * 0.1)} />
          {panel.dots.map((d, i) => (
            <circle
              key={`dot-${pi}-${i}`}
              className="cs-stone cs-pop"
              cx={panel.cx + d.x}
              cy={panelY + d.y}
              r="3.4"
              style={delay(0.5 + pi * 0.1 + i * 0.04)}
            />
          ))}
          {phase === "solved" ? (
            <>
              {/* Steps 0-1: warmth waves rise under each panel
                  in turn, and arrows carry the eye packed →
                  loose → flying apart. */}
              {[0, 1].map((w) => (
                <path
                  key={`warm-${pi}-${w}`}
                  className="cs-line cs-band cs-pop"
                  d={`M${panel.cx - 8 + w * 16} ${panelY + 52} Q${panel.cx - 3 + w * 16} ${panelY + 46} ${panel.cx - 8 + w * 16} ${panelY + 40}`}
                  style={delay((pi === 2 ? flyStart : warmStart) + pi * 0.2 + w * 0.15)}
                />
              ))}
              {pi < 2 ? (
                <path
                  className="cs-line cs-band cs-draw"
                  pathLength={1}
                  d={`M${panel.cx + 38} ${panelY} Q${panel.cx + 47} ${panelY - 3} ${panel.cx + 56} ${panelY} M${panel.cx + 50} ${panelY - 5} L${panel.cx + 57} ${panelY} L${panel.cx + 50} ${panelY + 5}`}
                  style={delay(warmStart + 0.4 + pi * 0.3)}
                />
              ) : null}
            </>
          ) : null}
        </g>
      ))}
      {phase === "solved" ? (
        <>
          <ellipse className="cs-ring" cx="258" cy={panelY} rx="40" ry="44" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="258" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

export function WaterCycleScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "water-cycle" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const riseStart = stepDelay ? stepDelay(0) : 0.5;
  const cloudStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  const puddleCx = 108;
  const puddleCy = 146;
  const cloudD = "M196 58 Q202 40 222 42 Q230 28 248 34 Q264 26 274 40 Q292 40 290 56 Q288 66 272 64 L214 64 Q198 66 196 58 Z";
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* Setup: the puddle at full size, and the sky empty. */}
      {phase === "setup" ? (
        <ellipse className="cs-line cs-draw" pathLength={1} cx={puddleCx} cy={puddleCy} rx="62" ry="10" style={delay(0.35)} />
      ) : (
        <>
          {/* The puddle at its shrunken resting size. */}
          <ellipse className="cs-line cs-draw" pathLength={1} cx={puddleCx} cy={puddleCy} rx="30" ry="6" style={delay(riseStart + 0.5)} />
          <ellipse className="cs-line cs-soft cs-draw" pathLength={1} cx={puddleCx} cy={puddleCy} rx="62" ry="10" style={delay(0.2)} />
          {/* Step 0: wisps rise from the puddle into the sky. */}
          {[0, 1, 2].map((i) => (
            <path
              key={`wisp-${i}`}
              className="cs-line cs-band cs-pop"
              d={`M${88 + i * 22} 132 Q${96 + i * 22} 108 ${88 + i * 22} 88 Q${82 + i * 22} 72 ${92 + i * 22} 60`}
              style={delay(riseStart + i * 0.2)}
            />
          ))}
          {/* Step 1: the cloud gathers where the wisps rose. */}
          <path className="cs-line cs-band cs-draw" pathLength={1} d={cloudD} style={delay(cloudStart)} />
          {/* Step 2: rain falls back toward the ground. */}
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={`rain-${i}`}
              className="cs-line cs-band cs-pop"
              d={`M${214 + i * 16} 74 L${210 + i * 16} 90`}
              style={delay(tickStart + i * 0.1)}
            />
          ))}
          <ellipse className="cs-ring" cx="244" cy="48" rx="54" ry="26" style={delay(tickStart + 0.5)} />
          <text className="cs-tick cs-tick-final" x="244" y="112" style={delay(tickStart + 0.65)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}
/* ── atom-tally ──────────────────────────────────────────────
   A tally board with atom dots in two clusters — the
   question's own picture. Setup: the two clusters stand as
   given, uncounted, with no ring, mark or pairing drawn
   between them, so nothing states whether they match.
   Solved: the right cluster's dots rearrange into a new
   grouping (the reaction), then pairing rings join each left
   dot to a right dot, one for one. */

const TALLY_LEFT = [
  { x: 62, y: 74 }, { x: 84, y: 66 }, { x: 106, y: 74 },
  { x: 62, y: 100 }, { x: 84, y: 108 }, { x: 106, y: 100 },
];
const TALLY_RIGHT_FROM = [
  { x: 214, y: 74 }, { x: 236, y: 66 }, { x: 258, y: 74 },
  { x: 214, y: 100 }, { x: 236, y: 108 }, { x: 258, y: 100 },
];
/** The rearranged grouping: the same six dots, regrouped as
 * two trios — a new look, the same dots. */
const TALLY_RIGHT_TO = [
  { x: 226, y: 70 }, { x: 248, y: 70 }, { x: 237, y: 88 },
  { x: 226, y: 106 }, { x: 248, y: 106 }, { x: 237, y: 122 },
];

function AtomDot({ r }: { r?: number }) {
  return (
    <>
      <circle className="cs-coin" r={r ?? 8} />
      <circle className="cs-coin-inner" r={(r ?? 8) * 0.45} />
    </>
  );
}

export function AtomTallyScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "atom-tally" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const moveStart = stepDelay ? stepDelay(0) : 0.5;
  const pairStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The tally board's divider: layout only, no verdict. */}
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M160 52 L160 140" style={delay(0.25)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M36 146 Q160 150 284 146" style={delay(0.3)} />
      {/* The left cluster: the same in both phases. */}
      {TALLY_LEFT.map((p, i) => (
        <g key={`left-${i}`} transform={`translate(${p.x} ${p.y})`}>
          <g className="cs-pop" style={delay(0.45 + i * 0.07)}>
            <AtomDot />
          </g>
        </g>
      ))}
      {phase === "setup" ? (
        TALLY_RIGHT_FROM.map((p, i) => (
          <g key={`right-${i}`} transform={`translate(${p.x} ${p.y})`}>
            <g className="cs-pop" style={delay(0.55 + i * 0.07)}>
              <AtomDot />
            </g>
          </g>
        ))
      ) : (
        <>
          {/* Step 0: the right dots rearrange into trios. */}
          {TALLY_RIGHT_TO.map((p, i) => {
            const from = TALLY_RIGHT_FROM[i]!;
            return (
              <g key={`right-${i}`} transform={`translate(${p.x} ${p.y})`}>
                <g className="cs-slide" style={slideFrom(from.x - p.x, from.y - p.y, moveStart + i * 0.1)}>
                  <AtomDot />
                </g>
              </g>
            );
          })}
          {/* Step 1: pairing rings join the dots one for one
              across the divider — every dot has a partner. */}
          {TALLY_LEFT.map((p, i) => {
            const q = TALLY_RIGHT_TO[i]!;
            return (
              <path
                key={`pair-${i}`}
                className="cs-line cs-band cs-draw"
                pathLength={1}
                d={`M${p.x + 10} ${p.y} Q160 ${Math.min(p.y, q.y) - 14} ${q.x - 10} ${q.y}`}
                style={delay(pairStart + i * 0.13)}
              />
            );
          })}
          <ellipse className="cs-ring" cx="160" cy="94" rx="128" ry="52" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/* ── column-cousins ──────────────────────────────────────────
   A table grid with one column of tiles — the question's own
   layout. Setup: two tiles stand in the column, plain and
   unmarked, with no shared highlight and no spark on either,
   so nothing suggests how the second behaves. Solved: the
   upper tile sparks with an oxygen dot (the known reaction),
   then the lower tile sparks the same way. */

const COLUMN_TILES = [
  { cx: 160, cy: 62 },
  { cx: 160, cy: 106 },
];

function ColumnTileArt() {
  return (
    <>
      <rect className="cs-pack" x="-19" y="-16" width="38" height="32" rx="3" />
      <circle className="cs-stone" cx="0" cy="0" r="5" />
      <path className="cs-line cs-band" d="M-12 -9 Q0 -11 12 -9" />
    </>
  );
}

function SparkArt({ start }: { start: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const dx = [-16, -5, 6, 16][i]!;
        return (
          <path
            key={`spark-${i}`}
            className="cs-line cs-band cs-pop"
            d={`M${dx} -26 L${dx + (i % 2 === 0 ? -3 : 3)} -34`}
            style={delay(start + i * 0.1)}
          />
        );
      })}
      <circle className="cs-coin cs-pop" cx="24" cy="-18" r="5" style={delay(start + 0.2)} />
      <circle className="cs-coin-inner cs-pop" cx="24" cy="-18" r="2" style={delay(start + 0.3)} />
    </>
  );
}

export function ColumnCousinsScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "column-cousins" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const knownStart = stepDelay ? stepDelay(0) : 0.5;
  const cousinStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The table grid: rows and columns of empty tiles, with
          the question's one column standing at the centre. */}
      {[64, 108, 196, 240].map((gx, i) => (
        <g key={`side-${i}`} transform={`translate(${gx} ${i % 2 === 0 ? 62 : 106})`}>
          <g className="cs-pop" style={delay(0.3 + i * 0.08)}>
            <rect className="cs-bar" x="-19" y="-16" width="38" height="32" rx="3" />
          </g>
        </g>
      ))}
      {[64, 108, 196, 240].map((gx, i) => (
        <g key={`side2-${i}`} transform={`translate(${gx} ${i % 2 === 0 ? 106 : 62})`}>
          <g className="cs-pop" style={delay(0.38 + i * 0.08)}>
            <rect className="cs-bar" x="-19" y="-16" width="38" height="32" rx="3" />
          </g>
        </g>
      ))}
      {/* The column's two tiles: plain and unmarked in setup. */}
      {COLUMN_TILES.map((t, i) => (
        <g key={`tile-${i}`} transform={`translate(${t.cx} ${t.cy})`}>
          <g className="cs-pop" style={delay(0.5 + i * 0.12)}>
            <ColumnTileArt />
          </g>
        </g>
      ))}
      {phase === "solved" ? (
        <>
          {/* Step 0: the upper tile sparks with its oxygen dot
              — the known reaction from the question. */}
          <g transform={`translate(${COLUMN_TILES[0]!.cx} ${COLUMN_TILES[0]!.cy})`}>
            <SparkArt start={knownStart} />
          </g>
          {/* Step 1: the lower tile sparks in the same way. */}
          <g transform={`translate(${COLUMN_TILES[1]!.cx} ${COLUMN_TILES[1]!.cy})`}>
            <SparkArt start={cousinStart} />
          </g>
          <ellipse className="cs-ring" cx="160" cy="84" rx="34" ry="52" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="150" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── Wave 9 kinds (Social studies): globe-vs-map, great-circle,
   cost-compare ───────────────────────────────────────────────
   Same discipline as the kinds above: givens only in the setup
   film, no outcome before the pick. globe-vs-map paces three
   steps (the flat map's polar stretch marks widen, the true
   big land outline stands over the map, the final tick);
   great-circle paces three (the arc over the globe's pole
   draws, the same path draws curved on the flat map below,
   the final tick — a parameterised kind: any description's
   two pins and labels drive it, nothing is tied to one item);
   cost-compare paces three (the toll road's two coin stacks
   join into one, the free road's stack stands beside it, the
   final tick over the cheaper stack). Each ends with exactly
   one cs-tick cs-tick-final "✓". Coin counts are the
   question's givens; no scene label carries a digit. */

export function GlobeVsMapScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "globe-vs-map" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  void description;
  const stretchStart = stepDelay ? stepDelay(0) : 0.5;
  const truthStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  // Land blobs: on the globe the polar land stays small and
  // the great land below it is wide; on the flat map the polar
  // land is drawn stretched wide, as the prompt states it looks.
  const polarLand = (cx: number, cy: number, wide: number, high: number) => (
    <path className="cs-stone" d={`M${cx - wide} ${cy} Q${cx - wide / 2} ${cy - high} ${cx} ${cy - high + 2} Q${cx + wide / 2} ${cy - high} ${cx + wide} ${cy} Q${cx + wide / 2} ${cy + high - 2} ${cx} ${cy + high} Q${cx - wide / 2} ${cy + high - 2} ${cx - wide} ${cy} Z`} />
  );
  const greatLand = (cx: number, cy: number, wide: number, high: number) => (
    <path className="cs-pack" d={`M${cx - wide / 2} ${cy - high} Q${cx + wide / 4} ${cy - high - 4} ${cx + wide} ${cy - high / 3} Q${cx + wide / 2} ${cy + high / 2} ${cx + wide / 6} ${cy + high} Q${cx - wide / 3} ${cy + high / 2} ${cx - wide} ${cy} Q${cx - wide / 2} ${cy - high / 2} ${cx - wide / 2} ${cy - high} Z`} />
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 28 Q160 24 296 28" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 172 Q160 176 304 172" style={delay(0)} />
      {/* The globe, left: a circle with its lands at true shape. */}
      <circle className="cs-line cs-draw" pathLength={1} cx="82" cy="100" r="58" style={delay(0.15)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M28 82 Q82 92 136 82 M28 120 Q82 130 136 120" style={delay(0.25)} />
      <g className="cs-pop" style={delay(0.45)}>{polarLand(82, 62, 17, 9)}</g>
      <g className="cs-pop" style={delay(0.55)}>{greatLand(86, 112, 30, 24)}</g>
      {/* The flat map, right: a sheet whose polar land already
          stretches wide — the look the prompt itself states. */}
      <path className="cs-line cs-draw" pathLength={1} d="M176 48 Q238 44 300 48 Q303 100 300 152 Q238 156 176 152 Q173 100 176 48 Z" style={delay(0.2)} />
      <g className="cs-pop" style={delay(0.5)}>{polarLand(238, 68, 44, 10)}</g>
      <g className="cs-pop" style={delay(0.6)}>{greatLand(240, 118, 30, 22)}</g>
      {phase === "solved" ? (
        <>
          {/* Step 0: stretch arrows widen at the map's polar land. */}
          <path className="cs-line cs-band cs-pop" d="M188 68 L196 68 M292 68 L284 68" style={delay(stretchStart)} />
          <path className="cs-tip cs-pop" d="M186 68 L196 63 L196 73 Z" style={delay(stretchStart + 0.1)} />
          <path className="cs-tip cs-pop" d="M294 68 L284 63 L284 73 Z" style={delay(stretchStart + 0.2)} />
          {/* Step 1: the globe's great land stands over the map
              at its true size — far wider than the polar land. */}
          <g className="cs-pop" style={delay(truthStart)}>
            <path className="cs-split-high" d="M204 84 Q226 76 252 82 Q268 92 258 116 Q246 134 224 130 Q202 122 198 104 Q198 92 204 84 Z" />
          </g>
          <ellipse className="cs-ring" cx="230" cy="107" rx="38" ry="32" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="238" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

export function GreatCircleScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "great-circle" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  void description;
  const arcStart = stepDelay ? stepDelay(0) : 0.5;
  const flatStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const pin = (cx: number, cy: number, dly: number) => (
    <g className="cs-pop" style={delay(dly)}>
      <circle className="cs-coin" cx={cx} cy={cy} r="5" />
      <circle className="cs-coin-inner" cx={cx} cy={cy} r="2.2" />
    </g>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 24 Q160 20 296 24" style={delay(0.1)} />
      {/* The globe, above: two pins, no path before the pick. */}
      <circle className="cs-line cs-draw" pathLength={1} cx="160" cy="66" r="42" style={delay(0.15)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M122 54 Q160 62 198 54 M122 80 Q160 88 198 80" style={delay(0.25)} />
      {pin(132, 74, 0.45)}
      {pin(188, 74, 0.55)}
      {/* The flat map, below: the same two pins on a sheet. */}
      <path className="cs-line cs-draw" pathLength={1} d="M70 124 Q160 120 250 124 Q253 148 250 168 Q160 172 70 168 Q67 148 70 124 Z" style={delay(0.2)} />
      {pin(102, 148, 0.5)}
      {pin(218, 148, 0.6)}
      {phase === "solved" ? (
        <>
          {/* Step 0: the shortest path arcs over the globe's pole. */}
          <path className="cs-line cs-band cs-draw" pathLength={1} d="M132 74 Q160 18 188 74" style={delay(arcStart)} />
          {/* Step 1: the same path, drawn flat, bends the same way. */}
          <path className="cs-line cs-band cs-draw" pathLength={1} d="M102 148 Q160 122 218 148" style={delay(flatStart)} />
          <ellipse className="cs-ring" cx="160" cy="52" rx="34" ry="30" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="14" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

export function CostCompareScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "cost-compare" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { tollFuel, tollFee, freeFuel } = description;
  const joinStart = stepDelay ? stepDelay(0) : 0.5;
  const standStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const stack = (cx: number, baseY: number, count: number, dly: number) =>
    Array.from({ length: count }, (_, i) => (
      <circle key={`coin-${cx}-${i}`} className="cs-coin cs-pop" cx={cx} cy={baseY - i * 7} r="4.6" style={delay(dly + i * 0.03)} />
    ));
  const baseY = 156;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 28 Q160 24 296 28" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 162 Q160 166 304 162" style={delay(0)} />
      {/* Two roads across the top: the toll road with its
          barrier, the free road open. Givens from the prompt. */}
      <path className="cs-line cs-draw" pathLength={1} d="M28 52 Q160 46 292 52" style={delay(0.15)} />
      <path className="cs-line cs-band cs-draw" pathLength={1} d="M238 40 L238 58 M226 44 L250 44" style={delay(0.3)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M28 78 Q160 72 292 78" style={delay(0.2)} />
      {phase === "setup" ? (
        <>
          {/* The toll road's two stacks stand apart — fuel here,
              the toll there, never added before the pick. The
              free road's one stack stands on its own side. */}
          {stack(84, baseY, tollFuel, 0.45)}
          {stack(128, baseY, tollFee, 0.55)}
          {stack(228, baseY, freeFuel, 0.6)}
        </>
      ) : (
        <>
          {/* Step 0: the toll stacks join into one tall stack. */}
          {stack(84, baseY, tollFuel, 0.3)}
          <g transform="translate(-44 0)">
            <g className="cs-slide" style={slideFrom(44, tollFuel * 7, joinStart)}>
              {Array.from({ length: tollFee }, (_, i) => (
                <circle key={`fee-${i}`} className="cs-coin" cx={128} cy={baseY - (tollFuel + i) * 7} r="4.6" />
              ))}
            </g>
          </g>
          {/* Step 1: the free stack slides beside the joined
              stack — shorter, coin for coin. */}
          <g transform="translate(-116 0)">
            <g className="cs-slide" style={slideFrom(116, 0, standStart)}>
              {Array.from({ length: freeFuel }, (_, i) => (
                <circle key={`free-${i}`} className="cs-coin" cx={228} cy={baseY - i * 7} r="4.6" />
              ))}
            </g>
          </g>
          <ellipse className="cs-ring" cx="112" cy={baseY - (freeFuel * 7) / 2} rx="16" ry={(freeFuel * 7) / 2 + 10} style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="112" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/* ── stack-drops (wave 10, general knowledge) ───────────────────
   A peak silhouette stands beside a waterfall's single drop —
   the question's two givens. Solved: drop blocks stack one on
   top of another beside the peak in eight bands (each band
   stands for about ten drops), climbing to just under the
   summit, and the final tick lands. No stack, no counter and
   no numbers before the pick. */

export function StackDropsScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "stack-drops" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  void description;
  const bands = 8;
  const groundY = 168;
  const bandH = 15;
  const stackX = 118;
  const bandStart = (s: number) => (stepDelay ? stepDelay(s) : 0.4 + s * 0.45);
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 24 Q160 20 296 24" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The falls, left: a cliff with one drop ribbon — a given. */}
      <path className="cs-line cs-draw" pathLength={1} d="M28 60 Q52 56 74 60 L74 168 M28 60 L28 168" style={delay(0.15)} />
      <path className="cs-line cs-band cs-draw" pathLength={1} d="M44 62 Q48 110 44 164" style={delay(0.35)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M56 62 Q60 110 56 164" style={delay(0.45)} />
      {/* The peak, right: a tall silhouette — a given. */}
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d="M196 168 Q228 84 252 34 Q258 22 264 34 Q288 84 308 168"
        style={delay(0.2)}
      />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M244 48 Q252 36 260 44 Q266 36 272 50" style={delay(0.4)} />
      {phase === "solved" ? (
        <>
          {/* Steps 0-7: drop blocks stack beside the peak, one
              band at a time, each band a falls block with its
              water lines, climbing to just under the summit. */}
          {Array.from({ length: bands }, (_, i) => {
            const top = groundY - (i + 1) * bandH;
            return (
              <g key={`band-${i}`} className="cs-pop" style={delay(bandStart(i))}>
                <rect className="cs-pack" x={stackX} y={top} width="34" height={bandH - 2} rx="2" />
                <path className="cs-line cs-band" d={`M${stackX + 10} ${top + 2} Q${stackX + 12} ${top + bandH / 2} ${stackX + 10} ${top + bandH - 4}`} />
                <path className="cs-line cs-soft" d={`M${stackX + 22} ${top + 2} Q${stackX + 24} ${top + bandH / 2} ${stackX + 22} ${top + bandH - 4}`} />
              </g>
            );
          })}
          <ellipse className="cs-ring" cx={stackX + 17} cy={groundY - bands * bandH - 2} rx="26" ry="12" style={delay(bandStart(bands - 1) + 0.5)} />
          <text className="cs-tick cs-tick-final" x={stackX + 17} y={groundY - bands * bandH - 22} style={delay(bandStart(bands - 1) + 0.65)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── angle-sight (wave 10, general knowledge) ───────────────────
   An observer stands on the ground looking up at a tower; a
   short dashed sight ray leaves the observer's eye — the
   question's givens (the distance, the angle) drawn without a
   scale the height could be measured from: the ray stops in
   mid-air and never touches the tower before the pick. Solved:
   the ray runs on to the tower's top, the height is bracketed,
   and the final tick lands. */

export function AngleSightScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "angle-sight" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  void description;
  const groundY = 156;
  const eye = { x: 44, y: groundY - 14 };
  const top = { x: 252, y: 30 };
  const rayStart = stepDelay ? stepDelay(0) : 0.5;
  const bracketStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 24 Q160 20 296 24" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The tower, right: its outline only — no height mark. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M238 ${groundY} Q240 92 246 44 L246 30 M266 30 L266 44 Q272 92 274 ${groundY}`} style={delay(0.15)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M242 96 Q256 92 270 96 M244 64 Q256 60 268 64" style={delay(0.3)} />
      {/* The observer, left, at the given distance. */}
      <g className="cs-pop" style={delay(0.4)}>
        <circle className="cs-child-head" cx={eye.x} cy={eye.y} r="5" />
        <path className="cs-child-body" d={`M${eye.x - 7} ${groundY - 2} Q${eye.x} ${groundY - 9} ${eye.x + 7} ${groundY - 2}`} />
      </g>
      {/* The given sight direction: a short dashed ray that
          stops in mid-air, short of the tower. */}
      <path
        className="cs-line cs-soft cs-draw"
        pathLength={1}
        d={`M${eye.x + 4} ${eye.y - 2} Q86 ${eye.y - 26} 128 ${eye.y - 48}`}
        strokeDasharray="4 4"
        style={delay(0.55)}
      />
      {phase === "solved" ? (
        <>
          {/* Step 0: the sight line runs on to the tower's top. */}
          <path className="cs-line cs-band cs-draw" pathLength={1} d={`M${eye.x + 4} ${eye.y - 2} Q150 ${eye.y - 66} ${top.x} ${top.y + 2}`} style={delay(rayStart)} />
          {/* Step 1: the height bracket stands beside the tower. */}
          <path className="cs-line cs-band cs-draw" pathLength={1} d={`M288 ${groundY} L288 ${top.y} M282 ${groundY} L294 ${groundY} M282 ${top.y} L294 ${top.y}`} style={delay(bracketStart)} />
          <ellipse className="cs-ring" cx={top.x + 4} cy={top.y} rx="18" ry="12" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={top.x + 4} y={top.y - 20} style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── flow-counter (wave 10, general knowledge) ──────────────────
   A waterfall pours into its pool — the question's givens (the
   falls, its per-minute flow) with no counter and no total
   before the pick. Solved: a row of droplets stands for one
   minute's flow, the day's minutes multiply the droplets into
   a field under a sweeping sun arc, and the field gathers
   into three rising bars — the powers of ten — before the
   final tick. Digits live only in the narration and the
   result card, as in the earlier counter kinds. */

export function FlowCounterScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "flow-counter" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  void description;
  const groundY = 168;
  const minuteStart = stepDelay ? stepDelay(0) : 0.5;
  const dayStart = stepDelay ? stepDelay(1) : 1.5;
  const barsStart = stepDelay ? stepDelay(2) : 2.5;
  const drop = (cx: number, cy: number, dly: number, key: string) => (
    <path
      key={key}
      className="cs-tip cs-pop"
      d={`M${cx} ${cy - 6} Q${cx + 4.5} ${cy + 1} ${cx + 2.5} ${cy + 4.5} Q${cx} ${cy + 6.5} ${cx - 2.5} ${cy + 4.5} Q${cx - 4.5} ${cy + 1} ${cx} ${cy - 6} Z`}
      style={delay(dly)}
    />
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 24 Q160 20 296 24" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The falls, left: cliff, falling water, pool — givens. */}
      <path className="cs-line cs-draw" pathLength={1} d="M24 52 Q48 48 68 52 L68 168 M24 52 L24 168" style={delay(0.15)} />
      <path className="cs-line cs-band cs-draw" pathLength={1} d="M38 54 Q42 104 38 150" style={delay(0.35)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M52 54 Q56 104 52 150" style={delay(0.45)} />
      <ellipse className="cs-line cs-draw" pathLength={1} cx="46" cy="158" rx="30" ry="6" style={delay(0.3)} />
      {phase === "solved" ? (
        <>
          {/* Step 0: one minute's flow — a row of droplets. */}
          {[0, 1, 2, 3, 4].map((i) => drop(112 + i * 16, 148, minuteStart + i * 0.08, `min-${i}`))}
          {/* Step 1: the day multiplies them — a sun arc sweeps
              and the droplets fill a field, row on row. */}
          <path className="cs-line cs-band cs-draw" pathLength={1} d="M104 118 Q160 84 216 118" style={delay(dayStart)} />
          <circle className="cs-coin cs-pop" cx="160" cy="92" r="6" style={delay(dayStart + 0.3)} />
          {[0, 1].map((r) =>
            [0, 1, 2, 3, 4].map((i) => drop(112 + i * 16, 128 - r * 18, dayStart + 0.25 + (r * 5 + i) * 0.05, `day-${r}-${i}`)),
          )}
          {/* Step 2: the field gathers into rising bars — each
              bar ten times the last — and the tick lands. */}
          {[0, 1, 2].map((i) => (
            <rect
              key={`bar-${i}`}
              className="cs-pack cs-pop"
              x={248 + i * 18}
              y={groundY - 22 - i * 26}
              width="13"
              height={22 + i * 26}
              rx="2"
              style={delay(barsStart + i * 0.18)}
            />
          ))}
          <text className="cs-tick cs-tick-final" x="272" y={groundY - 22 - 2 * 26 - 14} style={delay(barsStart + 0.7)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}
