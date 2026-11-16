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
