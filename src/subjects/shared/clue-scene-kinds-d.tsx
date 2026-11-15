/**
 * clue-scene-kinds-d.tsx — the measure clue scenes (scenes wave,
 * visual-questions spec §3.4): "tile-grid", "measure-trace",
 * "clock-arc" and "unit-fit", drawn live as ink line-art on paper,
 * in the pilot renderer's discipline (ClueScene.tsx). Each
 * component returns an SVG fragment only — the parent supplies
 * the <svg viewBox="0 0 320 190"> wrapper, the pause / still
 * handling and the Replay button.
 *
 * Answer-blind, structurally (the clue-scene-types.ts pattern):
 * a component receives ONLY its scene description (the givens
 * from the item's question) and a phase — "setup" before the
 * pick, "solved" after a correct one. It never receives the
 * answer, a choice, or a pick. The setup film performs the
 * question's verb, first beat only (spec §3.1 class B): the
 * first row of tiles is laid, the first side is bordered, the
 * first five-minute chunk of the arc is drawn, the ant takes
 * one step — the remaining units stay visibly unperformed, and
 * no counting affordance appears. The solved beat computes its
 * grouping from the givens at solve time, exactly the
 * derivation the result card prints a moment later.
 *
 * Motion discipline, copied from the pilot: CSS keyframes only
 * (transform / opacity / stroke draw-on), authored so every
 * element's resting state IS the film's final frame — the
 * keyframes only run it in, once. New animation classes for
 * this wave reference the shared easing tokens by name
 * (born-aligned bar B1); the fills below reuse the pilot's
 * classes wherever one already does the job.
 */
import type { CSSProperties } from "react";
import {
  elapsedMinutes,
  fittingUnit,
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

/* ── tile-grid ───────────────────────────────────────────────
   Cover a rectangle with unit squares. Setup lays the first
   row only; solved lays row by row with a running tick per
   row (5, 10, 15 …), then one brass wash turns rows into area.
   The arrays item reuses the stage with brick glyphs and row
   guides (spec §3.4). */

export function TileGridScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "tile-grid" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, row r's beat starts at
   * stepDelay(r) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { rows, cols, brick } = description;
  const cell = Math.min(34, 176 / cols, 118 / rows);
  const w = cell * cols;
  const h = cell * rows;
  const x0 = (320 - w) / 2;
  const y0 = 42 + (118 - h) / 2;
  const rowStart = (r: number) => (stepDelay ? stepDelay(r) : 0.35 + r * 0.9);
  const laidRows = phase === "setup" ? 1 : rows;
  return (
    <>
      {/* Dimension brackets outside the outline — no numerals. */}
      <path
        className="cs-line cs-soft cs-draw"
        pathLength={1}
        d={`M${x0 - 8} ${y0 + h + 12} Q${x0 + w / 2} ${y0 + h + 16} ${x0 + w + 8} ${y0 + h + 12}`}
        style={delay(0.55)}
      />
      <path
        className="cs-line cs-soft cs-draw"
        pathLength={1}
        d={`M${x0 + w + 12} ${y0 - 6} Q${x0 + w + 16} ${y0 + h / 2} ${x0 + w + 12} ${y0 + h + 6}`}
        style={delay(0.7)}
      />
      {/* The empty outline the tiles will cover. */}
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d={`M${x0} ${y0} Q${x0 + w / 2} ${y0 - 3} ${x0 + w} ${y0} Q${x0 + w + 3} ${y0 + h / 2} ${x0 + w} ${y0 + h} Q${x0 + w / 2} ${y0 + h + 3} ${x0} ${y0 + h} Q${x0 - 3} ${y0 + h / 2} ${x0} ${y0} Z`}
        style={delay(0)}
      />
      {brick && phase === "solved"
        ? Array.from({ length: rows - 1 }, (_, r) => (
            <path
              key={`guide-${r}`}
              className="cs-line cs-soft cs-fade"
              strokeDasharray="3 3"
              d={`M${x0 + 2} ${y0 + (r + 1) * cell} Q${x0 + w / 2} ${y0 + (r + 1) * cell + 2} ${x0 + w - 2} ${y0 + (r + 1) * cell}`}
              style={delay(rowStart(r + 1) + 0.3)}
            />
          ))
        : null}
      {Array.from({ length: laidRows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          // Bricks stagger alternate rows by half a cell.
          const shift = brick && r % 2 === 1 ? cell / 2 : 0;
          const tx = x0 + ((c * cell + shift) % w);
          const ty = y0 + r * cell;
          const start =
            phase === "setup" ? 1.15 + c * 0.14 : rowStart(r) + c * 0.07;
          return (
            <g key={`${r}-${c}`} transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)})`}>
              <g className="cs-slide" style={slideFrom(-46, 8, start)}>
                <rect
                  className={brick ? "cs-brick" : "cs-tile"}
                  x="1"
                  y="1"
                  width={(cell - 2).toFixed(1)}
                  height={(cell - 2).toFixed(1)}
                  rx="2.5"
                />
              </g>
            </g>
          );
        }),
      )}
      {phase === "solved" ? (
        <>
          {Array.from({ length: rows }, (_, r) => (
            <text
              key={`tick-${r}`}
              className={`cs-tick${r === rows - 1 ? " cs-tick-final" : ""}`}
              x={x0 + w + 26}
              y={y0 + r * cell + cell / 2 + 4}
              style={delay(rowStart(r) + cols * 0.07 + 0.35)}
            >
              {(r + 1) * cols}
            </text>
          ))}
          {/* One brass wash: the rows become area. */}
          <rect
            className="cs-wash cs-fade"
            x={x0 + 1}
            y={y0 + 1}
            width={w - 2}
            height={h - 2}
            style={delay(rowStart(rows - 1) + cols * 0.07 + 0.8)}
          />
        </>
      ) : null}
    </>
  );
}

/* ── measure-trace ───────────────────────────────────────────
   Travel a length and total it. "loop": a border goes around
   a rectangle side by side, ticks running (4, 7, 11, 14), and
   a brass trace closes the loop — the interior is sand, never
   tiles (the area/perimeter invariant, spec §6.2). "bars": two
   aligned lengths are traced and the gap between their ends
   is bracketed — solved only. */

export function MeasureTraceScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "measure-trace" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. Loop steps
   * are the four sides; bars steps are trace, trace, gap. */
  stepDelay?: (step: number) => number;
}) {
  const stepStart = (s: number) => (stepDelay ? stepDelay(s) : 0.35 + s * 0.9);
  if (description.mode === "bars") {
    const scale = 1.9;
    const shortW = description.length * scale;
    const longW = description.width * scale;
    const bx = 42;
    const gapX = bx + shortW;
    const endX = bx + longW;
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 24 Q160 20 296 24" style={delay(0.1)} />
        {/* The two lengths, aligned at the left. */}
        {[
          { y: 62, w: shortW },
          { y: 116, w: longW },
        ].map((bar, i) => (
          <g key={i}>
            <rect className="cs-bar" x={bx} y={bar.y} width={bar.w.toFixed(1)} height="15" rx="6" />
            {phase === "setup" && i === 0 ? (
              <path
                className="cs-line cs-band cs-draw"
                pathLength={1}
                d={`M${bx + 3} ${bar.y - 7} Q${bx + bar.w / 2} ${bar.y - 10} ${bx + bar.w - 3} ${bar.y - 7}`}
                style={delay(1.0)}
              />
            ) : null}
            {phase === "solved" ? (
              <path
                className="cs-line cs-band cs-draw"
                pathLength={1}
                d={`M${bx + 3} ${bar.y - 7} Q${bx + bar.w / 2} ${bar.y - 10} ${bx + bar.w - 3} ${bar.y - 7}`}
                style={delay(stepStart(i))}
              />
            ) : null}
          </g>
        ))}
        {phase === "solved" ? (
          <>
            <text className="cs-tick" x={bx + shortW / 2} y="50" style={delay(stepStart(0) + 0.55)}>
              {description.length}
            </text>
            <text className="cs-tick" x={bx + longW / 2} y="104" style={delay(stepStart(1) + 0.55)}>
              {description.width}
            </text>
            {/* The gap between the two ends, bracketed. */}
            <path
              className="cs-line cs-band cs-draw"
              pathLength={1}
              d={`M${gapX.toFixed(1)} 146 Q${((gapX + endX) / 2).toFixed(1)} 150 ${endX.toFixed(1)} 146 M${gapX.toFixed(1)} 140 L${gapX.toFixed(1)} 148 M${endX.toFixed(1)} 140 L${endX.toFixed(1)} 148`}
              style={delay(stepStart(2))}
            />
            <text
              className="cs-tick cs-tick-final"
              x={((gapX + endX) / 2).toFixed(1)}
              y="172"
              style={delay(stepStart(2) + 0.55)}
            >
              {description.width - description.length}
            </text>
          </>
        ) : null}
      </>
    );
  }
  // Loop mode: the sandbox, in true proportion to its sides.
  const unit = Math.min(150 / description.length, 112 / description.width);
  const w = description.length * unit;
  const h = description.width * unit;
  const x0 = (320 - w) / 2;
  const y0 = 40 + (118 - h) / 2;
  const sides = [description.length, description.width, description.length, description.width];
  const running: number[] = [];
  sides.forEach((s) => running.push((running[running.length - 1] ?? 0) + s));
  const stipple = (() => {
    const rnd = seeded(41);
    return Array.from({ length: 14 }, () => ({
      x: x0 + 12 + rnd() * (w - 24),
      y: y0 + 12 + rnd() * (h - 24),
    }));
  })();
  const plankFor = (s: number) => {
    // Side 0 bottom, 1 right, 2 top, 3 left — around the loop.
    if (s === 0) return { x: x0, y: y0 + h - 4, w, h: 7, horiz: true };
    if (s === 1) return { x: x0 + w - 4, y: y0, w: 7, h, horiz: false };
    if (s === 2) return { x: x0, y: y0 - 3, w, h: 7, horiz: true };
    return { x: x0 - 3, y: y0, w: 7, h, horiz: false };
  };
  const tickPos = (s: number) => {
    if (s === 0) return { x: x0 + w / 2, y: y0 + h + 24 };
    if (s === 1) return { x: x0 + w + 20, y: y0 + h / 2 };
    if (s === 2) return { x: x0 + w / 2, y: y0 - 14 };
    return { x: x0 - 20, y: y0 + h / 2 };
  };
  return (
    <>
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d={`M${x0} ${y0} Q${x0 + w / 2} ${y0 - 3} ${x0 + w} ${y0} Q${x0 + w + 3} ${y0 + h / 2} ${x0 + w} ${y0 + h} Q${x0 + w / 2} ${y0 + h + 3} ${x0} ${y0 + h} Q${x0 - 3} ${y0 + h / 2} ${x0} ${y0} Z`}
        style={delay(0)}
      />
      {stipple.map((p, i) => (
        <circle key={i} className="cs-snack-dot" cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="1.6" />
      ))}
      {/* The start-corner flag: where the walk around begins. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0} ${y0 + h} L${x0 - 1} ${y0 + h - 20}`} style={delay(0.3)} />
      <path className="cs-flag cs-pop" d={`M${x0 - 1} ${y0 + h - 20} L${x0 + 13} ${y0 + h - 16} L${x0 - 1} ${y0 + h - 12} Z`} style={delay(0.5)} />
      {/* Setup: one plank along the long side only. Solved: a
          plank per side, in walking order, tick per side. */}
      {(phase === "setup" ? [0] : [0, 1, 2, 3]).map((s) => {
        const p = plankFor(s);
        const start = phase === "setup" ? 1.2 : stepStart(s);
        return (
          <g key={`plank-${s}`} className="cs-slide" style={slideFrom(p.horiz ? -30 : 0, p.horiz ? 0 : -24, start)}>
            <rect className="cs-plank" x={p.x} y={p.y} width={p.w} height={p.h} rx="3" />
          </g>
        );
      })}
      {phase === "solved" ? (
        <>
          {sides.map((_, s) => {
            const tp = tickPos(s);
            return (
              <text
                key={`tick-${s}`}
                className={`cs-tick${s === 3 ? " cs-tick-final" : ""}`}
                x={tp.x}
                y={tp.y}
                style={delay(stepStart(s) + 0.55)}
              >
                {running[s]}
              </text>
            );
          })}
          {/* The loop closes: one ring pulse at the start flag,
              then the brass trace runs once around the outside. */}
          <circle
            className="cs-ring"
            cx={x0}
            cy={y0 + h}
            r="9"
            style={delay(stepStart(3) + 0.8)}
          />
          <path
            className="cs-line cs-band cs-draw"
            pathLength={1}
            d={`M${x0 - 7} ${y0 + h + 7} Q${x0 + w / 2} ${y0 + h + 11} ${x0 + w + 7} ${y0 + h + 7} Q${x0 + w + 11} ${y0 + h / 2} ${x0 + w + 7} ${y0 - 7} Q${x0 + w / 2} ${y0 - 11} ${x0 - 7} ${y0 - 7} Q${x0 - 11} ${y0 + h / 2} ${x0 - 7} ${y0 + h + 7} Z`}
            style={delay(stepStart(3) + 1.0)}
          />
        </>
      ) : null}
    </>
  );
}

/* ── clock-arc ───────────────────────────────────────────────
   A clock face; the minute hand sweeps the arc between the
   two given times, chunked in fives (spec §3.4). Setup draws
   the first five-minute chunk only, over a faint ghost of
   the whole arc. Solved fades the chunks in one by one with
   a running tick (5, 10, …) and rests with the hand at the
   end time. */

const CLOCK = { cx: 160, cy: 98, r: 60 };
const polar = (minute: number, r: number) => {
  const a = ((minute % 60) * 6 * Math.PI) / 180;
  return { x: CLOCK.cx + r * Math.sin(a), y: CLOCK.cy - r * Math.cos(a) };
};
const arcPath = (fromMinute: number, toMinute: number, r: number) => {
  const p0 = polar(fromMinute, r);
  const p1 = polar(toMinute, r);
  const large = (toMinute - fromMinute) % 60 > 30 ? 1 : 0;
  return `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${r} ${r} 0 ${large} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
};

export function ClockArcScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "clock-arc" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, chunk c's beat starts at
   * stepDelay(c) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const total = elapsedMinutes(description);
  const chunks = Math.max(1, Math.round(total / 5));
  const chunkStart = (c: number) => (stepDelay ? stepDelay(c) : 0.4 + c * 0.6);
  const handMinute = phase === "setup" ? description.startMinute : description.endMinute;
  const hand = polar(handMinute, CLOCK.r * 0.74);
  const hourAngle = ((description.startHour % 12) + description.startMinute / 60) * 30;
  const hourA = (hourAngle * Math.PI) / 180;
  const hourHand = {
    x: CLOCK.cx + CLOCK.r * 0.46 * Math.sin(hourA),
    y: CLOCK.cy - CLOCK.r * 0.46 * Math.cos(hourA),
  };
  return (
    <>
      <circle className="cs-line cs-draw" pathLength={1} cx={CLOCK.cx} cy={CLOCK.cy} r={CLOCK.r} style={delay(0)} />
      {Array.from({ length: 12 }, (_, i) => {
        const outer = polar(i * 5, CLOCK.r - 3);
        const inner = polar(i * 5, CLOCK.r - 9);
        return (
          <path
            key={i}
            className="cs-line cs-soft"
            d={`M${inner.x.toFixed(1)} ${inner.y.toFixed(1)} L${outer.x.toFixed(1)} ${outer.y.toFixed(1)}`}
          />
        );
      })}
      {/* The ghost of the whole arc — the question mark. */}
      <path
        className="cs-line cs-soft cs-fade"
        strokeDasharray="3 4"
        d={arcPath(description.startMinute, description.endMinute, CLOCK.r + 9)}
        style={delay(0.5)}
      />
      {phase === "setup" ? (
        <path
          className="cs-line cs-band cs-draw"
          pathLength={1}
          d={arcPath(description.startMinute, description.startMinute + 5, CLOCK.r + 9)}
          style={delay(1.0)}
        />
      ) : (
        Array.from({ length: chunks }, (_, c) => (
          <path
            key={`chunk-${c}`}
            className="cs-line cs-band cs-fade"
            strokeWidth={3}
            d={arcPath(description.startMinute + c * 5, description.startMinute + (c + 1) * 5, CLOCK.r + 9)}
            style={delay(chunkStart(c))}
          />
        ))
      )}
      {/* Hands: the hour hand at the start hour; the minute hand
          rests at the phase's time (start in setup, end solved). */}
      <path className="cs-line" d={`M${CLOCK.cx} ${CLOCK.cy} L${hourHand.x.toFixed(1)} ${hourHand.y.toFixed(1)}`} />
      <g className="cs-pop" style={delay(0.6)}>
        <path className="cs-line cs-band" strokeWidth={3} d={`M${CLOCK.cx} ${CLOCK.cy} L${hand.x.toFixed(1)} ${hand.y.toFixed(1)}`} />
        <circle className="cs-coin" cx={CLOCK.cx} cy={CLOCK.cy} r="4.5" />
      </g>
      {phase === "solved"
        ? Array.from({ length: chunks }, (_, c) => (
            <text
              key={`tick-${c}`}
              className={`cs-tick${c === chunks - 1 ? " cs-tick-final" : ""}`}
              x={52 + c * (216 / Math.max(chunks - 1, 1))}
              y="20"
              style={delay(chunkStart(c) + 0.4)}
            >
              {(c + 1) * 5}
            </text>
          ))
        : null}
    </>
  );
}

/* ── unit-fit ────────────────────────────────────────────────
   Judgement, no counting: a long path outgrows the frame, and
   three step glyphs — ant-step, finger-step, stride — show
   fit by absurdity (spec §3.4). Setup: the path draws past
   the edge and the ant takes one step. Solved: the ant's
   trail and the finger's steps fade out as absurd, and the
   stride that fits (computed by fittingUnit) walks the path
   and is ringed. */

function AntGlyph() {
  return (
    <>
      <circle className="cs-ant" r="3.2" />
      <path className="cs-line" strokeWidth={1} d="M-3 2 L-5 5 M0 3 L0 6 M3 2 L5 5" />
    </>
  );
}
function FingerGlyph() {
  return <rect className="cs-finger" x="-4" y="-9" width="8" height="18" rx="4" />;
}
function StrideGlyph() {
  return (
    <>
      <circle className="cs-child-head" cx="0" cy="-13" r="4.4" />
      <path className="cs-line" strokeWidth={1.6} d="M0 -9 L-1 0 M-1 0 L-8 10 M-1 0 L7 9 M0 -8 L-7 -3 M0 -8 L6 -4" />
    </>
  );
}

export function UnitFitScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "unit-fit" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, glyph g's beat starts at
   * stepDelay(g) instead of the film's own stagger. Steps:
   * 0 the ant, 1 the finger, 2 the stride. */
  stepDelay?: (step: number) => number;
}) {
  const fit = fittingUnit(description);
  const stepStart = (s: number) => (stepDelay ? stepDelay(s) : 0.4 + s * 1.0);
  const pathD = "M-6 128 Q60 118 128 126 Q210 136 326 122";
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 34 Q160 28 296 34" style={delay(0.1)} />
      {/* The path itself, running out of the frame's right edge. */}
      <path className="cs-line cs-draw" pathLength={1} d={pathD} style={delay(0)} />
      <path className="cs-line cs-soft" d="M286 108 L286 148 M296 108 L296 148" />
      {phase === "setup" ? (
        <>
          <g transform="translate(30 122)">
            <g className="cs-pop" style={delay(0.9)}>
              <AntGlyph />
            </g>
          </g>
          <circle className="cs-snack-dot cs-fade" cx="44" cy="126" r="1.8" style={delay(1.3)} />
        </>
      ) : (
        <>
          {/* The ant: a dotted trail that gives up, dimmed. */}
          <g className={fit === "mm" ? undefined : "cs-dim"} style={delay(stepStart(0) + 0.5)}>
            {Array.from({ length: 7 }, (_, i) => (
              <circle key={i} className="cs-snack-dot cs-fade" cx={34 + i * 9} cy={124 - (i % 2) * 2} r="1.8" style={delay(stepStart(0) + i * 0.09)} />
            ))}
            <g transform="translate(102 120)">
              <g className="cs-pop" style={delay(stepStart(0) + 0.6)}>
                <AntGlyph />
              </g>
            </g>
          </g>
          {/* The finger: a few steps, then dimmed the same way. */}
          <g className={fit === "cm" ? undefined : "cs-dim"} style={delay(stepStart(1) + 0.5)}>
            {[128, 148, 168].map((x, i) => (
              <g key={x} transform={`translate(${x} 118)`}>
                <g className="cs-pop" style={delay(stepStart(1) + i * 0.14)}>
                  <FingerGlyph />
                </g>
              </g>
            ))}
          </g>
          {/* The stride: walks the path at a size that fits. */}
          {[206, 248, 290].map((x, i) => (
            <g key={x} transform={`translate(${x} 112)`}>
              <g className="cs-pop" style={delay(stepStart(2) + i * 0.16)}>
                <StrideGlyph />
              </g>
            </g>
          ))}
          <ellipse
            className="cs-ring"
            cx={fit === "mm" ? 102 : fit === "cm" ? 148 : 290}
            cy={fit === "mm" ? 120 : fit === "cm" ? 118 : 110}
            rx="17"
            ry="21"
            style={delay(stepStart(2) + 0.7)}
          />
        </>
      )}
    </>
  );
}
