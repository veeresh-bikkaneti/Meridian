/**
 * clue-scene-kinds-b.tsx — the place-value clue scenes (Wave 1,
 * builder B): place-value, place-compare and digit-shift. Each is
 * a short film drawn live in the browser as ink line-art on paper,
 * rendered as an SVG fragment inside ClueScene's frame (the parent
 * supplies the <svg viewBox="0 0 320 190"> wrapper).
 *
 * Answer-blind, structurally (the ClueScene.tsx pattern): each
 * component receives ONLY its scene description (the givens from
 * the item's question) and a phase — "setup" before the pick,
 * "solved" after a correct one. It never receives the answer, a
 * choice, or a pick. The setup film shows the givens only: loose
 * piles of notes and coins, two route columns drawn at identical
 * weight, ten-stones on a path — no digits, no totals, no winner
 * marks. The solved beat computes its grouping, comparison or
 * shift from the givens at solve time, exactly the derivation the
 * result card prints a moment later, and only then do digits
 * appear, as counting ticks.
 *
 * Motion discipline (the pilot's, unchanged): CSS keyframes only
 * (transform / opacity / stroke draw-on), authored so every
 * element's resting state IS the film's final frame. The film
 * plays once, then rests. Lines curve, nothing is ruler-straight,
 * and a seeded layout keeps the scatter identical on every load.
 */
import type { CSSProperties } from "react";
import {
  placeColumns,
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

/* ── Place value ───────────────────────────────────────────────
   3 hundred notes, 4 ten notes, 5 one coins (= 345) in the item
   this was drawn for; every count comes from the givens. */

/** One piece of money, centred on the origin: a wide hundred
 * note, a smaller ten note, or the pilot's one coin. Notes reuse
 * the pack's paper styling, with a soft inner line. */
function PlacePieceArt({ column }: { column: number }) {
  if (column === 0) {
    return (
      <>
        <rect className="cs-pack" x="-17" y="-10" width="34" height="20" rx="4" />
        <path className="cs-line cs-band" d="M-11 -3 Q0 -5 11 -3" />
        <path className="cs-line cs-soft" d="M-11 4 Q0 2 11 4" />
      </>
    );
  }
  if (column === 1) {
    return (
      <>
        <rect className="cs-pack" x="-12" y="-8" width="24" height="16" rx="3.5" />
        <path className="cs-line cs-band" d="M-7 -2 Q0 -4 7 -2" />
      </>
    );
  }
  return (
    <>
      <circle className="cs-coin" r="8.5" />
      <circle className="cs-coin-inner" r="4.4" />
    </>
  );
}

const PLACE_CX = [70, 160, 250];
/** How far each piece in a neat stack sits above the one below. */
const PLACE_STEP = [13, 11, 12];
const PLACE_BASE_Y = 136;

export function PlaceValueScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "place-value" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const colStart = (c: number) => (stepDelay ? stepDelay(c) : 0.35 + c * 0.8);
  const counts = [description.hundreds, description.tens, description.ones];
  const place = [100, 10, 1];
  // The loose piles (seeded: same scatter on every load), one
  // cluster per column, lying on the counter.
  const loose = counts.map((count, c) => {
    const rnd = seeded(31 + c * 17);
    return Array.from({ length: count }, () => ({
      x: (PLACE_CX[c] ?? 160) + (rnd() * 60 - 30),
      y: 114 + rnd() * 22,
    }));
  });
  // Running totals after each column settles: 300, 340, 345.
  const running: number[] = [];
  counts.forEach((count, c) => {
    running.push((running[c - 1] ?? 0) + count * (place[c] ?? 1));
  });
  let gi = 0;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 92 Q160 86 296 92" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 150 Q160 155 304 150" style={delay(0)} />
      {phase === "solved"
        ? counts.map((_, c) => {
            const cx = PLACE_CX[c] ?? 160;
            return (
              <path
                key={`guide-${c}`}
                className="cs-line cs-soft cs-draw"
                pathLength={1}
                d={`M${cx - 30} 148 Q${cx - 32} 95 ${cx - 30} 44 M${cx + 30} 148 Q${cx + 32} 95 ${cx + 30} 44`}
                style={delay(0.2 + c * 0.15)}
              />
            );
          })
        : null}
      {counts.map((count, c) =>
        Array.from({ length: count }, (_, i) => {
          const start = loose[c]?.[i] ?? { x: PLACE_CX[c] ?? 160, y: 120 };
          const myGi = gi++;
          if (phase === "setup") {
            return (
              <g key={`${c}-${i}`} transform={`translate(${start.x.toFixed(1)} ${start.y.toFixed(1)})`}>
                <g className="cs-pop" style={delay(0.5 + myGi * 0.055)}>
                  <PlacePieceArt column={c} />
                </g>
              </g>
            );
          }
          const fin = { x: PLACE_CX[c] ?? 160, y: PLACE_BASE_Y - i * (PLACE_STEP[c] ?? 12) };
          return (
            <g key={`${c}-${i}`} transform={`translate(${fin.x} ${fin.y})`}>
              <g className="cs-slide" style={slideFrom(start.x - fin.x, start.y - fin.y, colStart(c) + i * 0.07)}>
                <PlacePieceArt column={c} />
              </g>
            </g>
          );
        }),
      )}
      {phase === "solved"
        ? counts.map((count, c) =>
            count > 0 ? (
              <text
                key={`tick-${c}`}
                className={`cs-tick${c === counts.length - 1 ? " cs-tick-final" : ""}`}
                x={PLACE_CX[c] ?? 160}
                y="30"
                style={delay(colStart(c) + count * 0.07 + 0.65)}
              >
                {running[c]}
              </text>
            ) : null,
          )
        : null}
    </>
  );
}

/* ── Place compare ─────────────────────────────────────────────
   Routes of 358 vs 385 steps in the item this was drawn for;
   both lengths come from the givens. Each side draws the route's
   place columns as three small stacks above a path with a flag,
   in identical weight and style on both sides. */

const COMPARE_STEP = [8, 8, 9];
const COMPARE_BASE_Y = 128;

function CompareStackArt({ column }: { column: number }) {
  if (column === 0) {
    return <rect className="cs-pack" x="-11" y="-5" width="22" height="10" rx="2.5" />;
  }
  if (column === 1) {
    return <rect className="cs-pack" x="-9" y="-4.5" width="18" height="9" rx="2.5" />;
  }
  return <circle className="cs-coin" r="5.5" />;
}

/** The ring that wraps one stack in the comparison sweep, sized
 * to that stack's own height. */
function stackRing(cx: number, count: number, column: number) {
  const step = COMPARE_STEP[column] ?? 9;
  const top = COMPARE_BASE_Y - Math.max(count - 1, 0) * step;
  return { cx, cy: (top + COMPARE_BASE_Y) / 2, rx: 20, ry: (COMPARE_BASE_Y - top) / 2 + 14 };
}

export function PlaceCompareScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "place-compare" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const sides = [
    { value: description.left, centre: 80, cols: placeColumns(description.left) },
    { value: description.right, centre: 240, cols: placeColumns(description.right) },
  ];
  // The deciding column: the first place where the digits differ
  // (-1 when the two routes are the same length).
  const deciding = sides[0].cols.findIndex((d, c) => d !== sides[1].cols[c]);
  const winner = description.left === description.right ? -1 : description.left > description.right ? 0 : 1;
  const loser = winner === -1 ? -1 : 1 - winner;
  const sweepStart = (c: number) => (stepDelay ? stepDelay(c) : 0.4 + c * 0.7);

  const renderSide = (s: number) => {
    const side = sides[s] ?? sides[0];
    return (
      <>
        <path className="cs-line cs-draw" pathLength={1} d={`M${side.centre - 62} 140 Q${side.centre} 145 ${side.centre + 62} 140`} style={delay(0)} />
        <path className="cs-line cs-draw" pathLength={1} d={`M${side.centre + 60} 140 Q${side.centre + 59} 128 ${side.centre + 60} 116`} style={delay(0.2)} />
        <path className="cs-tip" d={`M${side.centre + 60} 116 L${side.centre + 72} 120.5 L${side.centre + 60} 125 Z`} />
        {side.cols.map((count, c) =>
          Array.from({ length: count }, (_, i) => (
            <g
              key={`${s}-${c}-${i}`}
              transform={`translate(${side.centre - 44 + c * 44} ${COMPARE_BASE_Y - i * (COMPARE_STEP[c] ?? 9)})`}
            >
              <g className="cs-pop" style={delay(0.35 + c * 0.12 + i * 0.04)}>
                <CompareStackArt column={c} />
              </g>
            </g>
          )),
        )}
      </>
    );
  };

  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M160 28 Q157 95 160 162" style={delay(0.1)} />
      {sides.map((_, s) =>
        phase === "solved" && s === loser ? (
          <g key={`side-${s}`} className="cs-dim" style={delay(sweepStart(deciding))}>
            {renderSide(s)}
          </g>
        ) : (
          <g key={`side-${s}`}>{renderSide(s)}</g>
        ),
      )}
      {phase === "solved" ? (
        <>
          {/* Equal columns before the deciding one: both sides ring. */}
          {sides[0].cols.map((_, c) =>
            deciding === -1 || c < deciding
              ? sides.map((side, s) => {
                  const ring = stackRing(side.centre - 44 + c * 44, side.cols[c] ?? 0, c);
                  return (
                    <ellipse
                      key={`ring-${s}-${c}`}
                      className="cs-ring cs-ring-soft"
                      cx={ring.cx}
                      cy={ring.cy}
                      rx={ring.rx}
                      ry={ring.ry}
                      style={delay(sweepStart(c))}
                    />
                  );
                })
              : null,
          )}
          {/* The deciding column: the larger stack rings in brass
              and its side stays full-weight (the other side dims). */}
          {deciding >= 0 && winner >= 0
            ? (() => {
                const side = sides[winner] ?? sides[0];
                const ring = stackRing(side.centre - 44 + deciding * 44, side.cols[deciding] ?? 0, deciding);
                return (
                  <ellipse
                    className="cs-ring"
                    cx={ring.cx}
                    cy={ring.cy}
                    rx={ring.rx}
                    ry={ring.ry}
                    style={delay(sweepStart(deciding))}
                  />
                );
              })()
            : null}
          {winner >= 0 ? (
            <text
              className="cs-tick cs-tick-final"
              x={sides[winner]?.centre ?? 160}
              y="24"
              style={delay(stepDelay ? stepDelay(deciding + 1) + 0.1 : sweepStart(Math.max(deciding, 0)) + 0.55)}
            >
              {Math.max(description.left, description.right)}
            </text>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* ── Digit shift ───────────────────────────────────────────────
   A 70-step path stretched ten times (→ 700) in the item this
   was drawn for; the value and the factor come from the givens.
   The path carries value/10 ten-stones; the solved beat grows
   each one into a hundred-stone, one place further left. */

function TenStoneArt() {
  return <rect className="cs-pack" x="-12" y="-5" width="24" height="10" rx="5" />;
}

function HundredStoneArt() {
  return (
    <>
      <rect className="cs-pack" x="-17" y="-6" width="34" height="12" rx="5" />
      <path className="cs-line cs-band" d="M-16 0 Q0 -2 16 0" />
    </>
  );
}

export function DigitShiftScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "digit-shift" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const stones = Math.max(0, Math.round(description.value / 10));
  const eachWorth = 10 * description.factor;
  const stoneStart = (i: number) => (stepDelay ? stepDelay(i) : 0.35 + i * 0.45);
  const setupPos = (i: number) => ({
    x: 40 + i * 38,
    y: 110 + Math.round(Math.sin(i * 1.35) * 6),
  });
  return (
    <>
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d="M14 124 Q60 100 104 114 Q148 128 192 110 Q236 94 282 108 Q300 113 308 106"
        style={delay(0)}
      />
      {phase === "solved" ? (
        // The empty ones place that opens at the right as the row
        // nudges one place to the left.
        <path
          className="cs-line cs-soft cs-draw"
          pathLength={1}
          d="M284 140 Q282 112 284 88 Q295 84 306 88 Q308 112 306 140"
          style={delay(0.3)}
        />
      ) : null}
      {Array.from({ length: stones }, (_, i) => {
        const start = setupPos(i);
        if (phase === "setup") {
          return (
            <g key={i} transform={`translate(${start.x} ${start.y})`}>
              <g className="cs-pop" style={delay(0.4 + i * 0.08)}>
                <TenStoneArt />
              </g>
            </g>
          );
        }
        const fin = { x: start.x - 12, y: start.y };
        return (
          <g key={i} transform={`translate(${fin.x} ${fin.y})`}>
            <g className="cs-slide" style={slideFrom(start.x - fin.x, 0, 0.35)}>
              <g className="cs-grow" style={delay(stoneStart(i))}>
                <HundredStoneArt />
              </g>
            </g>
          </g>
        );
      })}
      {phase === "solved"
        ? Array.from({ length: stones }, (_, i) => (
            <text
              key={`tick-${i}`}
              className={`cs-tick${i === stones - 1 ? " cs-tick-final" : ""}`}
              x={setupPos(i).x - 12}
              y="48"
              style={delay(stoneStart(i) + 0.5)}
            >
              {(i + 1) * eachWorth}
            </text>
          ))
        : null}
    </>
  );
}

/* ── Wave 2 kinds (Math 10-18): map-scale, fraction-bar,
   fraction-measure ─────────────────────────────────────────────
   Same discipline as the kinds above: givens only before the
   pick, no digits in the setup film; the solved beat computes
   its counts from the givens at solve time. Steps: map-scale
   paces one step per centimetre; fraction-bar paces two (the
   shading, then the halved part); fraction-measure paces one
   step per measured piece. */

export function MapScaleScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "map-scale" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { mapCm, kmPerCm } = description;
  const x0 = 40;
  const segW = 55;
  const mapY = 62;
  const groundY = 138;
  const segStart = (s: number) => (stepDelay ? stepDelay(s) : 0.4 + s * 0.55);
  return (
    <>
      {/* The map: a parchment sheet with the river drawn on it. */}
      <path className="cs-line cs-draw" pathLength={1} d="M30 34 Q160 28 290 34 Q294 62 290 92 Q160 98 30 92 Q26 62 30 34 Z" style={delay(0)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M${x0} ${mapY + 6} Q${x0 + mapCm * segW * 0.4} ${mapY - 8} ${x0 + mapCm * segW * 0.7} ${mapY + 4} Q${x0 + mapCm * segW * 0.9} ${mapY + 10} ${x0 + mapCm * segW} ${mapY}`} style={delay(0.25)} />
      {/* The ground line below the map. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0} ${groundY} Q160 ${groundY + 5} ${x0 + mapCm * segW} ${groundY}`} style={delay(0.15)} />
      {phase === "solved"
        ? Array.from({ length: mapCm }, (_, s) => {
            const sx = x0 + s * segW;
            return (
              <g key={`seg-${s}`}>
                <path
                  className="cs-line cs-band cs-fade"
                  d={`M${sx} ${mapY - 12} Q${sx + 1} ${mapY} ${sx} ${mapY + 12} M${sx} ${groundY - 12} Q${sx + 1} ${groundY} ${sx} ${groundY + 12}`}
                  style={delay(segStart(s))}
                />
                <path
                  className="cs-split-low cs-fade"
                  d={`M${sx + 2} ${groundY - 5} H${sx + segW - 2} V${groundY + 5} H${sx + 2} Z`}
                  style={delay(segStart(s) + 0.15)}
                />
                <text className={`cs-tick${s === mapCm - 1 ? " cs-tick-final" : ""}`} x={sx + segW / 2} y={groundY + 28} style={delay(segStart(s) + 0.45)}>
                  {(s + 1) * kmPerCm}
                </text>
              </g>
            );
          })
        : null}
      {phase === "solved" ? (
        <path
          className="cs-line cs-band cs-fade"
          d={`M${x0 + mapCm * segW} ${mapY - 12} Q${x0 + mapCm * segW + 1} ${mapY} ${x0 + mapCm * segW} ${mapY + 12} M${x0 + mapCm * segW} ${groundY - 12} Q${x0 + mapCm * segW + 1} ${groundY} ${x0 + mapCm * segW} ${groundY + 12}`}
          style={delay(segStart(mapCm - 1) + 0.3)}
        />
      ) : null}
    </>
  );
}

export function FractionBarScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "fraction-bar" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { numerator, denominator } = description;
  const x0 = 45;
  const w = 230;
  const y = 76;
  const h = 34;
  const partW = w / denominator;
  const shadeStart = stepDelay ? stepDelay(0) : 0.55;
  const halfStart = stepDelay ? stepDelay(1) : 1.5;
  // Half of the shaded part, in bar parts: numerator/2 parts —
  // a whole number of parts for the items this kind serves.
  const halfParts = numerator / 2;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      <g className="cs-pop" style={delay(0.35)}>
        <rect className="cs-bar" x={x0} y={y} width={w} height={h} rx="7" />
      </g>
      {Array.from({ length: denominator - 1 }, (_, i) => {
        const x = x0 + (i + 1) * partW;
        return (
          <path
            key={`div-${i}`}
            className="cs-line cs-soft cs-draw"
            pathLength={1}
            d={`M${x.toFixed(1)} ${y + 2} Q${(x + 1).toFixed(1)} ${y + h / 2} ${x.toFixed(1)} ${y + h - 2}`}
            style={delay(0.45 + i * 0.1)}
          />
        );
      })}
      {phase === "solved" ? (
        <>
          {Array.from({ length: numerator }, (_, i) => (
            <path
              key={`shade-${i}`}
              className="cs-split-high cs-fade"
              d={`M${(x0 + i * partW + 2).toFixed(1)} ${y + 2} H${(x0 + (i + 1) * partW - 2).toFixed(1)} V${y + h - 2} H${(x0 + i * partW + 2).toFixed(1)} Z`}
              style={delay(shadeStart + i * 0.18)}
            />
          ))}
          <path
            className="cs-split-low cs-fade"
            d={`M${(x0 + 2).toFixed(1)} ${y + 2} H${(x0 + halfParts * partW - 2).toFixed(1)} V${y + h - 2} H${(x0 + 2).toFixed(1)} Z`}
            style={delay(halfStart)}
          />
          <ellipse
            className="cs-ring"
            cx={x0 + (halfParts * partW) / 2}
            cy={y + h / 2}
            rx={(halfParts * partW) / 2 + 7}
            ry={h / 2 + 8}
            style={delay(halfStart + 0.25)}
          />
          <text className="cs-tick cs-tick-final" x={x0 + (halfParts * partW) / 2} y={y - 14} style={delay(halfStart + 0.6)}>
            {`${halfParts}/${denominator}`}
          </text>
        </>
      ) : null}
    </>
  );
}

export function FractionMeasureScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "fraction-measure" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { total, pieceNumerator, pieceDenominator } = description;
  const pieces = Math.round(total / (pieceNumerator / pieceDenominator));
  const x0 = 28;
  const w = 264;
  const y = 84;
  const h = 26;
  const pieceW = w / pieces;
  const pieceStart = (s: number) => (stepDelay ? stepDelay(s) : 0.4 + s * 0.5);
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      {/* The roll: a long bar with a curled end. */}
      <g className="cs-pop" style={delay(0.35)}>
        <rect className="cs-bar" x={x0} y={y} width={w} height={h} rx="7" />
      </g>
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0 + w} ${y + 3} Q${x0 + w + 13} ${y + h / 2} ${x0 + w} ${y + h - 3}`} style={delay(0.5)} />
      {/* Scissors waiting at the start of the roll. */}
      <g className="cs-pop" style={delay(0.6)}>
        <circle className="cs-line" cx="22" cy="128" r="4.5" />
        <circle className="cs-line" cx="22" cy="142" r="4.5" />
        <path className="cs-line" d="M26 130 L40 138 M26 140 L40 133" />
      </g>
      {phase === "solved"
        ? Array.from({ length: pieces }, (_, s) => {
            const sx = x0 + s * pieceW;
            return (
              <g key={`piece-${s}`}>
                <path
                  className={`${s % 2 === 0 ? "cs-split-high" : "cs-split-low"} cs-fade`}
                  d={`M${(sx + 2).toFixed(1)} ${y + 2} H${(sx + pieceW - 2).toFixed(1)} V${y + h - 2} H${(sx + 2).toFixed(1)} Z`}
                  style={delay(pieceStart(s))}
                />
                {s > 0 ? (
                  <path
                    className="cs-line cs-band cs-fade"
                    d={`M${sx.toFixed(1)} ${y - 5} Q${(sx + 1).toFixed(1)} ${y + h / 2} ${sx.toFixed(1)} ${y + h + 5}`}
                    style={delay(pieceStart(s) + 0.1)}
                  />
                ) : null}
                <text className={`cs-tick${s === pieces - 1 ? " cs-tick-final" : ""}`} x={(sx + pieceW / 2).toFixed(1)} y={y - 12} style={delay(pieceStart(s) + 0.35)}>
                  {s + 1}
                </text>
              </g>
            );
          })
        : null}
    </>
  );
}

/* ── timeline-line (wave 3) ────────────────────────────────────
   A long line of years with a marker at each end. Setup: the
   line and its two end markers only — no digits, no rings, no
   winner. Solved in compare mode (countGap false): step 0 rings
   the earlier marker under its year tick, step 1 rings the
   later marker under its year tick, step 2 stands the final
   tick over the earlier marker. Solved in gap mode (countGap
   true): the gap is counted off in decades — one step per
   decade hop (a short last hop when the gap is not a round
   ten), each hop's tick the running count, the last tick the
   whole gap, final. The years and the gap come from the givens
   (the gap item's later year is the current year, resolved by
   the description's builder at play time). */

export function TimelineLineScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "timeline-line" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { startYear, endYear, countGap } = description;
  const x0 = 34;
  const x1 = 286;
  const y = 112;
  const gap = endYear - startYear;
  const hops = Math.max(1, Math.ceil(gap / 10));
  const hopX = (i: number) => x0 + (Math.min((i + 1) * 10, gap) / gap) * (x1 - x0);
  const hopValue = (i: number) => Math.min((i + 1) * 10, gap);
  const marker = (cx: number, dly: number) => (
    <g transform={`translate(${cx} ${y})`}>
      <g className="cs-pop" style={delay(dly)}>
        <circle className="cs-stone" r="6.5" />
        <circle className="cs-snack-dot" r="2.2" />
      </g>
    </g>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 52 Q160 46 296 52" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0} ${y} Q160 ${y - 6} ${x1} ${y}`} style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0} ${y} L${x0 - 1} ${y - 19} M${x1} ${y} L${x1 + 1} ${y - 19}`} style={delay(0.3)} />
      <path className="cs-flag cs-pop" d={`M${x0 - 1} ${y - 19} L${x0 + 15} ${y - 14.5} L${x0 - 1} ${y - 9} Z`} style={delay(0.5)} />
      <path className="cs-flag cs-pop" d={`M${x1 + 1} ${y - 19} L${x1 - 15} ${y - 14.5} L${x1 + 1} ${y - 9} Z`} style={delay(0.6)} />
      {marker(x0, 0.55)}
      {marker(x1, 0.65)}
      {phase === "solved" && !countGap ? (
        <>
          <ellipse className="cs-ring" cx={x0} cy={y} rx="17" ry="15" style={delay(stepDelay ? stepDelay(0) + 0.5 : 0.9)} />
          <text className="cs-tick" x={x0} y={y + 32} style={delay(stepDelay ? stepDelay(0) + 0.6 : 1.0)}>
            {startYear}
          </text>
          <ellipse className="cs-ring" cx={x1} cy={y} rx="17" ry="15" style={delay(stepDelay ? stepDelay(1) + 0.5 : 1.7)} />
          <text className="cs-tick" x={x1} y={y + 32} style={delay(stepDelay ? stepDelay(1) + 0.6 : 1.8)}>
            {endYear}
          </text>
          <text className="cs-tick cs-tick-final" x={x0} y={y - 34} style={delay(stepDelay ? stepDelay(2) + 0.6 : 2.5)}>
            {startYear}
          </text>
        </>
      ) : null}
      {phase === "solved" && countGap ? (
        <>
          {Array.from({ length: hops }, (_, i) => (
            <g key={`hop-${i}`}>
              <path
                className="cs-line cs-band cs-fade"
                d={`M${hopX(i).toFixed(1)} ${y - 12} Q${(hopX(i) + 1).toFixed(1)} ${y} ${hopX(i).toFixed(1)} ${y + 10}`}
                style={delay(stepDelay ? stepDelay(i) : 0.7 + i * 0.5)}
              />
              <text
                className={`cs-tick${i === hops - 1 ? " cs-tick-final" : ""}`}
                x={hopX(i).toFixed(1)}
                y={y - 26}
                style={delay(stepDelay ? stepDelay(i) + 0.45 : 1.1 + i * 0.5)}
              >
                {hopValue(i)}
              </text>
            </g>
          ))}
        </>
      ) : null}
    </>
  );
}

/* ── Wave 4 kinds (Physics 7-10): slide-stop, cup-shove ────────
   Same discipline as the kinds above: givens only before the
   pick, no digits in the setup film; the solved beat computes
   its outcome from the givens at solve time. slide-stop paces
   three steps (the slide, the ghost repeat, the final tick);
   cup-shove paces three (the slower hit, the faster hit, the
   final tick). Neither kind shows any slide at all in setup. */

/** One crate glyph, drawn from its left edge on the floor. */
function SlideCrateArt() {
  return (
    <>
      <rect className="cs-pack" x="0" y="-26" width="30" height="26" rx="3" />
      <path className="cs-line cs-band" d="M1 -10 Q15 -12 29 -10" />
    </>
  );
}

export function SlideStopScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "slide-stop" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { slideTiles } = description;
  const x0 = 28;
  const segW = 33;
  const segs = 8;
  const floorY = 142;
  const startX = 36;
  const markX = x0 + slideTiles * segW;
  const finX = markX - 30;
  const slideStart = stepDelay ? stepDelay(0) : 0.5;
  const ghostStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 48 Q160 44 296 48" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0 - 8} ${floorY} Q160 ${floorY + 4} ${x0 + segs * segW + 8} ${floorY}`} style={delay(0)} />
      {/* Floor segments: plain texture marks, no numbers. */}
      {Array.from({ length: segs + 1 }, (_, i) => (
        <path
          key={`seg-${i}`}
          className="cs-line cs-soft cs-draw"
          pathLength={1}
          d={`M${x0 + i * segW} ${floorY - 5} Q${x0 + i * segW + 1} ${floorY} ${x0 + i * segW} ${floorY + 4}`}
          style={delay(0.2 + i * 0.05)}
        />
      ))}
      {/* The mark the first slide stopped at (the question's own
          given) and the glass pane beyond it. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M${markX} ${floorY} L${markX} ${floorY - 26}`} style={delay(0.35)} />
      <path className="cs-flag cs-pop" d={`M${markX} ${floorY - 26} L${markX + 14} ${floorY - 21.5} L${markX} ${floorY - 17} Z`} style={delay(0.55)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M284 82 Q286 112 284 142" style={delay(0.4)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M276 96 Q277 104 276 112" style={delay(0.5)} />
      {phase === "setup" ? (
        <g transform={`translate(${startX} ${floorY})`}>
          <g className="cs-pop" style={delay(0.5)}>
            <SlideCrateArt />
          </g>
        </g>
      ) : (
        <>
          <g transform={`translate(${finX} ${floorY})`}>
            <g className="cs-slide" style={slideFrom(startX - finX, 0, slideStart)}>
              <SlideCrateArt />
            </g>
          </g>
          {/* The repeat run, ghosted over the first: same push,
              same floor, same stopping place. */}
          <g transform={`translate(${finX - 5} ${floorY - 5})`}>
            <g className="cs-dim">
              <g className="cs-slide" style={slideFrom(startX - (finX - 5), 5, ghostStart)}>
                <SlideCrateArt />
              </g>
            </g>
          </g>
          <ellipse className="cs-ring" cx={finX + 15} cy={floorY - 13} rx="24" ry="20" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={markX} y={floorY - 40} style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/** One cup glyph, drawn around its centre on the floor. */
function ShoveCupArt({ cx }: { cx: number }) {
  return (
    <>
      <path className="cs-line" d={`M${cx - 14} 126 Q${cx - 12} 148 ${cx} 149 Q${cx + 12} 148 ${cx + 14} 126`} />
      <path className="cs-line" d={`M${cx - 14} 126 Q${cx} 123 ${cx + 14} 126`} />
    </>
  );
}

export function CupShoveScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "cup-shove" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  if (description.stopsDead) {
    // Wave-6 variant (physics:energy:transfer): ONE ball rolls
    // in, stops dead against the cup, and the cup slides away
    // on its own. Solved in three steps: 0 the ball rolls, 1
    // the ball stops and the cup slides, 2 the final tick. The
    // wave-4 two-ball path below is untouched.
    const rollStart = stepDelay ? stepDelay(0) : 0.5;
    const slideStart = stepDelay ? stepDelay(1) : 1.4;
    const tickStart = stepDelay ? stepDelay(2) : 2.3;
    const cupCx = 178;
    const slide = description.slowSlide;
    const ballRest = cupCx - 23;
    const ball = (cx: number) => (
      <>
        <circle className="cs-coin" cx={cx} cy="141" r="9" />
        <circle className="cs-coin-inner" cx={cx} cy="141" r="4.4" />
      </>
    );
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 52 Q160 48 296 52" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d="M16 152 Q160 156 304 152" style={delay(0)} />
        {phase === "setup" ? (
          <>
            <g className="cs-pop" style={delay(0.4)}>
              <ShoveCupArt cx={cupCx} />
            </g>
            <g className="cs-pop" style={delay(0.55)}>{ball(64)}</g>
          </>
        ) : (
          <>
            {/* The ball rolls in and stops dead at the cup. */}
            <g className="cs-slide" style={slideFrom(64 - ballRest, 0, rollStart)}>
              {ball(ballRest)}
            </g>
            <circle className="cs-stone cs-pop" cx={ballRest} cy="160" r="3.5" style={delay(slideStart + 0.3)} />
            {/* The cup slides away with the ball's motion. */}
            <g transform={`translate(${slide} 0)`}>
              <g className="cs-slide" style={slideFrom(-slide, 0, slideStart)}>
                <ShoveCupArt cx={cupCx} />
              </g>
            </g>
            <ellipse className="cs-ring" cx={cupCx + slide} cy="137" rx="22" ry="17" style={delay(tickStart + 0.4)} />
            <text className="cs-tick cs-tick-final" x={cupCx + slide} y="104" style={delay(tickStart + 0.55)}>
              ✓
            </text>
          </>
        )}
      </>
    );
  }
  const { slowSlide, fastSlide } = description;
  const cupCx = 196;
  const midCx = cupCx + slowSlide;
  const finalCx = midCx + fastSlide;
  const slowStart = stepDelay ? stepDelay(0) : 0.5;
  const fastStart = stepDelay ? stepDelay(1) : 1.5;
  const tickStart = stepDelay ? stepDelay(2) : 2.5;
  const ball = (cx: number) => (
    <>
      <circle className="cs-coin" cx={cx} cy="141" r="9" />
      <circle className="cs-coin-inner" cx={cx} cy="141" r="4.4" />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 52 Q160 48 296 52" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 152 Q160 156 304 152" style={delay(0)} />
      {phase === "setup" ? (
        <>
          <g className="cs-pop" style={delay(0.4)}>
            <ShoveCupArt cx={cupCx} />
          </g>
          <g className="cs-pop" style={delay(0.55)}>{ball(56)}</g>
          <g className="cs-pop" style={delay(0.65)}>{ball(88)}</g>
        </>
      ) : (
        <>
          {/* The slower ball rolls in; the cup slides a little. */}
          <g className="cs-slide" style={slideFrom(56 - (cupCx - 23), 0, slowStart)}>
            {ball(cupCx - 23)}
          </g>
          <g transform={`translate(${slowSlide} 0)`}>
            <g className="cs-counter-step" style={delay(slowStart + 0.15)}>
              <g className="cs-slide" style={slideFrom(-slowSlide, 0, slowStart + 0.15)}>
                <ShoveCupArt cx={cupCx} />
              </g>
            </g>
          </g>
          <circle className="cs-stone cs-pop" cx={midCx} cy="160" r="3.5" style={delay(slowStart + 0.55)} />
          {/* The faster ball rolls in, speed lines and all; the
              cup slides much farther from where it rested. */}
          <path
            className="cs-line cs-soft cs-fade"
            d="M214 132 Q228 131 240 132 M210 141 Q226 140 242 141 M214 150 Q228 149 240 150"
            style={delay(fastStart + 0.1)}
          />
          <g className="cs-slide" style={slideFrom(88 - (finalCx - 23), 0, fastStart)}>
            {ball(finalCx - 23)}
          </g>
          <g transform={`translate(${slowSlide + fastSlide} 0)`}>
            <g className="cs-slide" style={slideFrom(-fastSlide, 0, fastStart + 0.1)}>
              <ShoveCupArt cx={cupCx} />
            </g>
          </g>
          <circle className="cs-stone cs-pop" cx={finalCx} cy="160" r="3.5" style={delay(fastStart + 0.55)} />
          <ellipse className="cs-ring" cx={finalCx} cy="137" rx="22" ry="17" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={finalCx} y="104" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/* ── Wave 5 kind (Physics 7-10): drop-fall ───────────────────
   Same discipline as the kinds above: givens only before the
   pick, no digits in the setup film; the solved beat computes
   its outcome from the givens at solve time. drop-fall paces
   three steps (the ball drops, the bucket catches it, the
   final tick). The setup film shows no fall at all. */

export function DropFallScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "drop-fall" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const dropStart = stepDelay ? stepDelay(0) : 0.5;
  const catchStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const ballX = 196;
  const shelfY = 66;
  const floorY = 162;
  const ball = (
    <>
      <circle className="cs-coin" r="10" />
      <circle className="cs-coin-inner" r="4.8" />
    </>
  );
  const bucket = (
    <>
      <path className="cs-line" d="M-22 0 Q-19 24 -14 34 Q0 37 14 34 Q19 24 22 0" />
      <path className="cs-line cs-band" d="M-22 0 Q0 -4 22 0" />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${floorY} Q160 ${floorY + 4} 304 ${floorY}`} style={delay(0)} />
      {/* The shelf, high on the left, and its bracket. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M36 ${shelfY} Q120 ${shelfY - 4} 208 ${shelfY}`} style={delay(0.15)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M52 ${shelfY + 2} L52 ${shelfY + 22} M52 ${shelfY + 12} Q70 ${shelfY + 4} 84 ${shelfY + 2}`} style={delay(0.3)} />
      {/* The bucket waiting on the floor, under the shelf lip. */}
      <g transform={`translate(${ballX} 124)`}>
        {phase === "solved" ? (
          <g className="cs-cheer" style={delay(catchStart)}>{bucket}</g>
        ) : (
          <g className="cs-pop" style={delay(0.5)}>{bucket}</g>
        )}
      </g>
      {phase === "setup" ? (
        <g transform={`translate(${ballX} ${shelfY - 12})`}>
          <g className="cs-pop" style={delay(0.55)}>{ball}</g>
        </g>
      ) : (
        <>
          <g transform={`translate(${ballX} 118)`}>
            <g className="cs-slide" style={slideFrom(0, shelfY - 12 - 118, dropStart)}>{ball}</g>
          </g>
          <ellipse className="cs-ring" cx={ballX} cy="130" rx="30" ry="24" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={ballX} y="84" style={delay(tickStart + 0.55)}>
            ↓
          </text>
        </>
      )}
    </>
  );
}

/* ── Wave 6 kinds (Physics 10-18): slope-pair, hill-carts,
   sound-path ───────────────────────────────────────────────
   Same discipline as the kinds above: givens only in the setup
   film, no winner before the pick; the solved beat computes
   its outcome from the givens at solve time. slope-pair paces
   three steps (the first slope line draws, the second draws,
   the final tick over the steeper one); hill-carts paces three
   (the height marks rise, the stored-energy stacks pop, the
   final tick); sound-path paces three (the waves cross the
   air path, the waves fade at the empty gap, the final tick). */

/** One ramp on its rise/run grid: grid cells of `cell` px, the
 * ramp's run along the ground and its rise at the far end. The
 * ramp's own slope line is drawn only when `solvedLine` — in
 * setup the grid and the ramp's outline stand at equal weight. */
function RampGrid({
  ox,
  oy,
  rise,
  run,
  cell,
  lineStart,
}: {
  ox: number;
  oy: number;
  rise: number;
  run: number;
  cell: number;
  lineStart?: number;
}) {
  const topY = oy - rise * cell;
  const rightX = ox + run * cell;
  return (
    <>
      {Array.from({ length: run + 1 }, (_, i) => (
        <path
          key={`v-${i}`}
          className="cs-line cs-soft cs-draw"
          pathLength={1}
          d={`M${ox + i * cell} ${oy} Q${ox + i * cell + 1} ${oy - rise * cell * 0.5} ${ox + i * cell} ${topY}`}
          style={delay(0.2 + i * 0.05)}
        />
      ))}
      {Array.from({ length: rise + 1 }, (_, i) => (
        <path
          key={`h-${i}`}
          className="cs-line cs-soft cs-draw"
          pathLength={1}
          d={`M${ox} ${oy - i * cell} Q${ox + run * cell * 0.5} ${oy - i * cell - 1} ${rightX} ${oy - i * cell}`}
          style={delay(0.25 + i * 0.05)}
        />
      ))}
      {/* The ramp itself: a wedge under the slope. */}
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d={`M${ox} ${oy} L${rightX} ${oy} L${rightX} ${topY} Q${(ox + rightX) / 2} ${(oy + topY) / 2 + 3} ${ox} ${oy} Z`}
        style={delay(0.3)}
      />
      {lineStart !== undefined ? (
        <path
          className="cs-line cs-band cs-draw"
          pathLength={1}
          strokeWidth="3"
          d={`M${ox} ${oy} Q${(ox + rightX) / 2} ${(oy + topY) / 2 - 2} ${rightX} ${topY}`}
          style={delay(lineStart)}
        />
      ) : null}
    </>
  );
}

export function SlopePairScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "slope-pair" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { firstRise, firstRun, secondRise, secondRun } = description;
  const firstStart = stepDelay ? stepDelay(0) : 0.5;
  const secondStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 152;
  const cell = 15;
  const firstSteeper = firstRise / firstRun > secondRise / secondRun;
  const winnerCx = firstSteeper ? 40 + (firstRun * cell) / 2 : 190 + (secondRun * cell) / 2;
  const winnerTop = groundY - (firstSteeper ? firstRise : secondRise) * cell;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 156 Q160 160 304 156" style={delay(0)} />
      <RampGrid ox={40} oy={groundY} rise={firstRise} run={firstRun} cell={cell} lineStart={phase === "solved" ? firstStart : undefined} />
      <RampGrid ox={190} oy={groundY} rise={secondRise} run={secondRun} cell={cell} lineStart={phase === "solved" ? secondStart : undefined} />
      {phase === "solved" ? (
        <>
          <ellipse className="cs-ring" cx={winnerCx} cy={(groundY + winnerTop) / 2} rx={34} ry={26} style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={winnerCx} y="52" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/** A small cart glyph for the hill, centred on its ground point. */
function HillCartArt() {
  return (
    <>
      <rect className="cs-pack" x="-20" y="-19" width="40" height="14" rx="3" />
      <path className="cs-line cs-band" d="M-19 -11 Q0 -13 19 -11" />
      <circle className="cs-bus-wheel" cx="-11" cy="-3" r="3.8" />
      <circle className="cs-bus-wheel" cx="11" cy="-3" r="3.8" />
    </>
  );
}

export function HillCartsScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "hill-carts" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { lowStep, highStep } = description;
  const markStart = stepDelay ? stepDelay(0) : 0.5;
  const storeStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const stepPx = 17;
  const baseY = 158;
  const lowY = baseY - lowStep * stepPx;
  const highY = baseY - highStep * stepPx;
  const lowX = 96;
  const highX = 216;
  // The hill: a long rise from the low cart's shelf to the high
  // cart's shelf — the heights themselves are the givens.
  const hillD = `M24 ${baseY + 4} Q70 ${lowY + 8} ${lowX + 26} ${lowY + 3} Q160 ${highY + 10} ${highX - 30} ${highY + 3} Q260 ${highY + 1} 296 ${highY - 2}`;
  const storeStack = (cx: number, groundY: number, steps: number) =>
    Array.from({ length: steps }, (_, i) => (
      <circle
        key={`store-${i}`}
        className="cs-stone cs-pop"
        cx={cx + 30}
        cy={groundY - 6 - i * 9}
        r="4.2"
        style={delay(storeStart + i * 0.18)}
      />
    ));
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={hillD} style={delay(0)} />
      <g transform={`translate(${lowX} ${lowY})`}>
        <g className="cs-pop" style={delay(0.45)}><HillCartArt /></g>
      </g>
      <g transform={`translate(${highX} ${highY})`}>
        <g className="cs-pop" style={delay(0.6)}><HillCartArt /></g>
      </g>
      {phase === "solved" ? (
        <>
          {/* Height marks rise from the valley floor beside
              each cart — equal marks, honestly counted. */}
          {Array.from({ length: lowStep }, (_, i) => (
            <path
              key={`mark-l-${i}`}
              className="cs-line cs-band cs-draw"
              pathLength={1}
              d={`M${lowX - 32} ${baseY - i * stepPx - 4} Q${lowX - 26} ${baseY - i * stepPx - 6} ${lowX - 20} ${baseY - i * stepPx - 4}`}
              style={delay(markStart + i * 0.15)}
            />
          ))}
          {Array.from({ length: highStep }, (_, i) => (
            <path
              key={`mark-h-${i}`}
              className="cs-line cs-band cs-draw"
              pathLength={1}
              d={`M${highX - 32} ${baseY - i * stepPx - 4} Q${highX - 26} ${baseY - i * stepPx - 6} ${highX - 20} ${baseY - i * stepPx - 4}`}
              style={delay(markStart + i * 0.15)}
            />
          ))}
          {/* The stored-energy stacks: the higher cart's stack
              stands taller — shown only now, never in setup. */}
          {storeStack(lowX, lowY, lowStep)}
          {storeStack(highX, highY, highStep)}
          <ellipse className="cs-ring" cx={highX + 28} cy={highY - 14} rx="18" ry={10 + highStep * 5} style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={highX} y={highY - 44} style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

export function SoundPathScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "sound-path" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const airStart = stepDelay ? stepDelay(0) : 0.5;
  const gapStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const bellX = 52;
  const earX = 272;
  const airY = 74;
  const gapY = 132;
  const bell = (
    <>
      <path className="cs-tip" d={`M${bellX - 11} 96 Q${bellX - 12} 66 ${bellX} 60 Q${bellX + 12} 66 ${bellX + 11} 96 Q${bellX} 92 ${bellX - 11} 96 Z`} />
      <circle className="cs-stone" cx={bellX} cy="101" r="3.4" />
      <path className="cs-line cs-band" d={`M${bellX - 7} 58 Q${bellX} 52 ${bellX + 7} 58`} />
    </>
  );
  const ear = (cy: number) => (
    <path className="cs-line" d={`M${earX - 8} ${cy - 11} Q${earX + 10} ${cy - 8} ${earX + 6} ${cy + 2} Q${earX + 3} ${cy + 10} ${earX - 6} ${cy + 11} Q${earX - 1} ${cy + 3} ${earX - 2} ${cy - 2} Q${earX - 3} ${cy - 7} ${earX + 2} ${cy - 8}`} />
  );
  const arc = (x: number, cy: number, r: number, start: number, dim?: boolean) => (
    <path
      className={`cs-line ${dim ? "cs-soft cs-dim" : "cs-band"} cs-pop`}
      d={`M${x} ${cy - r} Q${x + r * 0.9} ${cy} ${x} ${cy + r}`}
      style={delay(start)}
    />
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 168 Q160 172 304 168" style={delay(0)} />
      <g className="cs-pop" style={delay(0.4)}>{bell}</g>
      {/* The two paths: the upper lane is filled with air dots;
          the lower lane is drawn empty between its banks. Both
          are the question's givens — no wave travels either
          before the pick. */}
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M92 ${airY - 20} Q180 ${airY - 24} 252 ${airY - 20} M92 ${airY + 20} Q180 ${airY + 24} 252 ${airY + 20}`} style={delay(0.25)} />
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={`air-${i}`} className="cs-stone cs-pop" cx={104 + i * 17} cy={airY + (i % 2 === 0 ? -6 : 6)} r="1.9" style={delay(0.35 + i * 0.05)} />
      ))}
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M92 ${gapY - 20} Q140 ${gapY - 23} 168 ${gapY - 20} M92 ${gapY + 20} Q140 ${gapY + 23} 168 ${gapY + 20} M216 ${gapY - 20} Q240 ${gapY - 22} 252 ${gapY - 20} M216 ${gapY + 20} Q240 ${gapY + 22} 252 ${gapY + 20}`} style={delay(0.3)} />
      <g className="cs-pop" style={delay(0.5)}>{ear(airY)}</g>
      <g className="cs-pop" style={delay(0.6)}>{ear(gapY)}</g>
      {phase === "solved" ? (
        <>
          {/* The waves cross the air path, hop by hop. */}
          {arc(96, airY, 10, airStart)}
          {arc(136, airY, 12, airStart + 0.25)}
          {arc(180, airY, 12, airStart + 0.5)}
          {arc(224, airY, 11, airStart + 0.75)}
          {/* At the empty gap the waves start — and fade out. */}
          {arc(96, gapY, 10, gapStart)}
          {arc(130, gapY, 11, gapStart + 0.3, true)}
          <ellipse className="cs-ring" cx={earX} cy={airY} rx="17" ry="20" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={earX} y="36" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── Wave 7 kinds (Chemistry): magnet-sort, rebuild-pieces ────
   Same discipline as the kinds above: givens only in the setup
   film. magnet-sort's pile is one seeded mixed scatter, reused
   as the solved beat's starting positions — the setup film
   never sorts it by material in any visible way (every glyph
   kind is scattered through every part of the pile); which bits
   leap is spent only in the solved phase. rebuild-pieces paces
   three steps (the pieces come apart, the longer rebuild, the
   final tick); magnet-sort paces three (the magnet passes, the
   iron bits leap, the final tick). */

/** The mixed pile: iron rounds, wooden squares and plastic
 * triangles scattered by one seeded layout — the same spots in
 * both phases, so the solved beat's leaps start from the pile
 * the setup film showed. Kind cycles round-robin through the
 * scatter, so no corner of the pile is one material. */
const SORT_BITS: { x: number; y: number; mat: number }[] = (() => {
  const rnd = seeded(29);
  const bits: { x: number; y: number; mat: number }[] = [];
  for (let i = 0; i < 15; i++) {
    bits.push({ x: 84 + rnd() * 152, y: 118 + rnd() * 30, mat: i % 3 });
  }
  return bits;
})();

function SortBitArt({ mat }: { mat: number }) {
  if (mat === 0) {
    return (
      <>
        <circle className="cs-coin" r="6.5" />
        <circle className="cs-coin-inner" r="3" />
      </>
    );
  }
  if (mat === 1) {
    return <rect className="cs-stone" x="-6" y="-6" width="12" height="12" rx="2" />;
  }
  return <path className="cs-tip" d="M0 -7 L7 5 L-7 5 Z" />;
}

/** A bar magnet glyph, centred on (0,0), poles at its ends. */
function SortMagnetArt() {
  return (
    <>
      <rect className="cs-pack" x="-26" y="-8" width="52" height="16" rx="3" />
      <path className="cs-line cs-band" d="M0 -8 L0 8" />
      <path className="cs-line" d="M-24 -3 Q-13 -5 -2 -3 M2 3 Q13 5 24 3" />
    </>
  );
}

export function MagnetSortScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "magnet-sort" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const passStart = stepDelay ? stepDelay(0) : 0.5;
  const leapStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  // Where the magnet rests in the solved beat (over the pile),
  // and where each iron bit lands hanging under it.
  const magnetX = 160;
  const magnetY = 74;
  const ironBits = SORT_BITS.filter((b) => b.mat === 0);
  const ironSlot = (bit: (typeof SORT_BITS)[number]) => {
    const i = ironBits.indexOf(bit);
    return { x: magnetX - 20 + i * 10, y: magnetY + 15 };
  };
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      <ellipse className="cs-line cs-soft cs-draw" pathLength={1} cx="160" cy="146" rx="104" ry="12" style={delay(0.25)} />
      {phase === "setup" ? (
        <>
          {/* The magnet held clear, up at the side. */}
          <g transform="translate(56 58)">
            <g className="cs-pop" style={delay(0.45)}>
              <SortMagnetArt />
            </g>
          </g>
          {SORT_BITS.map((b, i) => (
            <g key={`bit-${i}`} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
              <g className="cs-pop" style={delay(0.55 + i * 0.05)}>
                <SortBitArt mat={b.mat} />
              </g>
            </g>
          ))}
        </>
      ) : (
        <>
          {/* Step 0: the magnet slides in over the pile. */}
          <g transform={`translate(${magnetX} ${magnetY})`}>
            <g className="cs-slide" style={slideFrom(56 - magnetX, 58 - magnetY, passStart)}>
              <SortMagnetArt />
            </g>
          </g>
          {SORT_BITS.map((b, i) => {
            if (b.mat === 0) {
              const fin = ironSlot(b);
              return (
                <g key={`bit-${i}`} transform={`translate(${fin.x} ${fin.y})`}>
                  <g className="cs-slide" style={slideFrom(b.x - fin.x, b.y - fin.y, leapStart + i * 0.06)}>
                    <SortBitArt mat={b.mat} />
                  </g>
                </g>
              );
            }
            return (
              <g key={`bit-${i}`} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
                <g className="cs-pop" style={delay(0.3 + i * 0.04)}>
                  <SortBitArt mat={b.mat} />
                </g>
              </g>
            );
          })}
          <ellipse className="cs-ring" cx={magnetX} cy={magnetY + 6} rx="40" ry="24" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={magnetX} y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/** The bridge's pieces: two posts, two deck planks and one
 * crossbar. Setup spots build the short bridge; solved spots
 * lay the same five pieces out in one longer bridge — every
 * piece used, none added. */
const BRIDGE_PIECES: {
  setup: { x: number; y: number };
  apart: { x: number; y: number };
  solved: { x: number; y: number };
  shape: number;
}[] = [
  { setup: { x: 118, y: 122 }, apart: { x: 84, y: 148 }, solved: { x: 84, y: 122 }, shape: 0 },
  { setup: { x: 202, y: 122 }, apart: { x: 128, y: 152 }, solved: { x: 236, y: 122 }, shape: 0 },
  { setup: { x: 136, y: 106 }, apart: { x: 172, y: 148 }, solved: { x: 122, y: 106 }, shape: 1 },
  { setup: { x: 184, y: 106 }, apart: { x: 216, y: 152 }, solved: { x: 198, y: 106 }, shape: 1 },
  { setup: { x: 160, y: 92 }, apart: { x: 248, y: 146 }, solved: { x: 160, y: 106 }, shape: 1 },
];

function BridgePieceArt({ shape }: { shape: number }) {
  if (shape === 0) {
    return <rect className="cs-pack" x="-7" y="-20" width="14" height="40" rx="2" />;
  }
  return (
    <>
      <rect className="cs-pack" x="-34" y="-6" width="68" height="12" rx="2" />
      <path className="cs-line cs-band" d="M-32 0 Q0 -3 32 0" />
    </>
  );
}

export function RebuildPiecesScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "rebuild-pieces" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const apartStart = stepDelay ? stepDelay(0) : 0.5;
  const buildStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The banks the bridge spans. */}
      <path className="cs-line cs-draw" pathLength={1} d="M16 142 Q44 138 62 142 L62 164 M258 142 Q276 138 304 142 L304 164" style={delay(0.2)} />
      {phase === "setup" ? (
        <>
          {BRIDGE_PIECES.map((p, i) => (
            <g key={`piece-${i}`} transform={`translate(${p.setup.x} ${p.setup.y})`}>
              <g className="cs-pop" style={delay(0.4 + i * 0.1)}>
                <BridgePieceArt shape={p.shape} />
              </g>
            </g>
          ))}
          {/* The gap the short bridge cannot cross: open water
              showing on both sides of it. */}
          <path className="cs-line cs-soft cs-draw" pathLength={1} d="M66 156 Q96 152 110 156 M210 156 Q240 152 254 156" style={delay(0.6)} />
        </>
      ) : (
        <>
          {/* Steps 0-1 in one travel per piece: each piece slides
              from its short-bridge spot, out to its apart spot's
              side, and lands in the longer bridge (the slide
              starts from the setup spot; the apart beat is the
              spread of the starting cluster, read as the pieces
              coming apart before they land longer). */}
          {BRIDGE_PIECES.map((p, i) => (
            <g key={`piece-${i}`} transform={`translate(${p.solved.x} ${p.solved.y})`}>
              <g
                className="cs-slide"
                style={slideFrom(p.setup.x - p.solved.x, p.setup.y - p.solved.y, (i < 2 ? apartStart : buildStart) + i * 0.08)}
              >
                <BridgePieceArt shape={p.shape} />
              </g>
            </g>
          ))}
          <path className="cs-line cs-soft cs-draw" pathLength={1} d="M66 156 Q160 151 254 156" style={delay(buildStart + 0.4)} />
          <ellipse className="cs-ring" cx="160" cy="108" rx="104" ry="30" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="52" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}
/* ── rust-change ─────────────────────────────────────────────
   A metal bike that sat out in the rain. Setup follows the
   prompt's givens only: the bike as drawn, rain marks above
   it, and no rust anywhere — the prompt says it looks
   different, but which change is never shown before the pick.
   Solved: rain and air meet the frame again, and rust patches
   bloom along it. */

function BikeArt() {
  return (
    <>
      <circle className="cs-line" cx="-52" cy="34" r="20" />
      <circle className="cs-line" cx="52" cy="34" r="20" />
      <circle className="cs-coin-inner" cx="-52" cy="34" r="2.4" />
      <circle className="cs-coin-inner" cx="52" cy="34" r="2.4" />
      <path className="cs-line" d="M-52 34 L-8 -8 L52 34 M-8 -8 L6 34 L-52 34 M-8 -8 L-16 -16 M30 -14 L52 34 M22 -16 L30 -14" />
      <path className="cs-line cs-band" d="M-24 -18 Q-16 -21 -8 -18 M16 -19 Q24 -22 32 -18" />
    </>
  );
}

const RUST_PATCHES = [
  { x: 118, y: 92, rx: 9, ry: 4.5 },
  { x: 152, y: 76, rx: 7, ry: 4 },
  { x: 188, y: 94, rx: 10, ry: 5 },
  { x: 138, y: 108, rx: 6, ry: 3.5 },
  { x: 204, y: 78, rx: 6, ry: 3.5 },
];

export function RustChangeScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "rust-change" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const meetStart = stepDelay ? stepDelay(0) : 0.5;
  const bloomStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* Rain marks: the prompt's own given, drawn the same in
          both phases. */}
      {[72, 118, 164, 210, 248].map((sx, i) => (
        <path
          key={`rain-${i}`}
          className="cs-line cs-soft cs-draw"
          pathLength={1}
          d={`M${sx} 44 L${sx - 4} 58`}
          style={delay(0.3 + i * 0.08)}
        />
      ))}
      {/* The bike, plain metal in setup. */}
      <g transform="translate(160 96)">
        <g className="cs-pop" style={delay(0.45)}>
          <BikeArt />
        </g>
      </g>
      {phase === "solved" ? (
        <>
          {/* Step 0: water drops and air swirls meet the frame. */}
          {[0, 1, 2].map((i) => (
            <g key={`drop-${i}`} transform={`translate(${128 + i * 32} 66)`}>
              <g className="cs-slide" style={slideFrom(0, -18, meetStart + i * 0.16)}>
                <path className="cs-tip" d="M0 -6 Q4 2 0 6 Q-4 2 0 -6 Z" />
              </g>
            </g>
          ))}
          {[0, 1].map((i) => (
            <path
              key={`air-${i}`}
              className="cs-line cs-band cs-pop"
              d={`M${196 + i * 22} ${58 + i * 10} Q${206 + i * 22} ${52 + i * 10} ${214 + i * 22} ${60 + i * 10}`}
              style={delay(meetStart + 0.3 + i * 0.18)}
            />
          ))}
          {/* Step 1: rust patches bloom along the frame. */}
          {RUST_PATCHES.map((p, i) => (
            <ellipse
              key={`rust-${i}`}
              className="cs-tip cs-pop"
              cx={p.x}
              cy={p.y}
              rx={p.rx}
              ry={p.ry}
              style={delay(bloomStart + i * 0.14)}
            />
          ))}
          <ellipse className="cs-ring" cx="160" cy="98" rx="86" ry="52" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── glow-rate ───────────────────────────────────────────────
   Two glow sticks, one in a warm-water bowl and one in an
   ice-water bowl (the question's givens: the bowls are told
   apart by the warmth waves and ice cubes the question itself
   names). Setup: both sticks glow alike — neither is faded,
   dimmed or marked. Solved: the warm stick works through its
   glow and fades to dim while the cold one still glows. */

function GlowBowlArt({ warm }: { warm?: boolean }) {
  return (
    <>
      <path className="cs-line" d="M-40 6 Q0 16 40 6 L34 34 Q0 42 -34 34 Z" />
      <path className="cs-line cs-soft" d="M-38 4 Q0 13 38 4" />
      {warm ? (
        <>
          <path className="cs-line cs-band" d="M-14 -22 Q-10 -28 -14 -34 M2 -22 Q6 -28 2 -34" />
        </>
      ) : (
        <>
          <rect className="cs-pack" x="-18" y="-16" width="11" height="11" rx="2" transform="rotate(12 -12 -10)" />
          <rect className="cs-pack" x="6" y="-14" width="11" height="11" rx="2" transform="rotate(-10 11 -8)" />
        </>
      )}
    </>
  );
}

export function GlowRateScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "glow-rate" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const glowStart = stepDelay ? stepDelay(0) : 0.5;
  const fadeStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  const bowlY = 118;
  const stick = (cx: number, dimmed: boolean, start: number) => (
    <g transform={`translate(${cx} 92) rotate(-18)`}>
      <g className="cs-pop" style={delay(start)}>
        <rect className={dimmed ? "cs-stone cs-dim" : "cs-coin"} x="-5" y="-30" width="10" height="52" rx="5" />
        <path className="cs-line cs-band" d="M-4 -12 Q0 -14 4 -12" />
      </g>
    </g>
  );
  const glowHalo = (cx: number, start: number) => (
    <ellipse className="cs-ring-soft cs-pop" cx={cx} cy="88" rx="17" ry="34" style={delay(start)} />
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      <g transform={`translate(92 ${bowlY})`}>
        <g className="cs-pop" style={delay(0.35)}>
          <GlowBowlArt warm />
        </g>
      </g>
      <g transform={`translate(228 ${bowlY})`}>
        <g className="cs-pop" style={delay(0.45)}>
          <GlowBowlArt />
        </g>
      </g>
      {phase === "setup" ? (
        <>
          {/* Both sticks glow alike: a halo on each, no fade. */}
          {glowHalo(92, 0.6)}
          {glowHalo(228, 0.7)}
          {stick(92, false, 0.55)}
          {stick(228, false, 0.65)}
        </>
      ) : (
        <>
          {/* Step 0: the warm stick's glow burns brighter. */}
          <ellipse className="cs-ring cs-pop" cx="92" cy="88" rx="20" ry="38" style={delay(glowStart)} />
          {stick(228, false, 0.3)}
          {stick(92, false, 0.3)}
          {/* Step 1: the warm stick fades — a dull shell lands
              over the bright stick — while the cold stick's
              halo still stands. */}
          {glowHalo(228, fadeStart + 0.2)}
          <g transform="translate(92 92) rotate(-18)">
            <g className="cs-pop" style={delay(fadeStart)}>
              <rect className="cs-stone" x="-5" y="-30" width="10" height="52" rx="5" />
            </g>
          </g>
          <ellipse className="cs-ring" cx="92" cy="92" rx="30" ry="44" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="92" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}
