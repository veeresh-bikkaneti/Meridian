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
