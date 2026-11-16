/**
 * clue-scene-kinds-a.tsx — the container clue scenes (Wave 1):
 * "bus-boarding" and "pack-boxes", drawn live as ink line-art on
 * paper, in the pilot renderer's discipline (ClueScene.tsx). Each
 * component returns an SVG fragment only — the parent supplies
 * the <svg viewBox="0 0 320 190"> wrapper, the pause / still
 * handling and the Replay button.
 *
 * Answer-blind, structurally (the clue-scene-types.ts pattern):
 * a component receives ONLY its scene description (the givens
 * from the item's question) and a phase — "setup" before the
 * pick, "solved" after a correct one. It never receives the
 * answer, a choice, or a pick. The setup film sets the scene
 * only: children queue at a stop with no bus in sight, pencils
 * lie in a loose pile beside one empty box — no digits, no
 * ticks, no formed groups, nothing that counts the containers
 * out. The solved beat computes its grouping from the givens at
 * solve time (buses of `seats`, boxes of `perBox`, ticks from
 * groupTicks), exactly the derivation the result card prints a
 * moment later; a remainder rides in one last, part-full bus and
 * its tick is the total itself.
 *
 * Motion discipline, copied from the pilot: CSS keyframes only
 * (transform / opacity / stroke draw-on), authored so every
 * element's resting state IS the film's final frame — the
 * keyframes only run it in, once. Lines curve, nothing is
 * ruler-straight where it shows, and a seeded layout (from
 * clue-scene-easing.ts) keeps each scatter identical on every
 * load: the queue and the pile are computed once and reused as
 * the solved beat's starting positions, so the same objects
 * travel across the phase change.
 */
import type { CSSProperties } from "react";
import {
  groupTicks,
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

/* ── bus-boarding ──────────────────────────────────────────── */

/**
 * The queue at the stop (seeded: same every load). One line of
 * children along the bottom, heads at y≈154; the solved beat
 * reuses these exact spots as where each child boards from.
 */
function queuePositions(total: number): { x: number; y: number }[] {
  const rnd = seeded(13);
  const queue: { x: number; y: number }[] = [];
  for (let i = 0; i < total; i++) {
    const t = total === 1 ? 0.5 : i / (total - 1);
    queue.push({ x: 40 + t * 262, y: 154 + (rnd() - 0.5) * 5 });
  }
  return queue;
}

/** Parked bus origins: up to 3 per row, each bus ≈ 88×34. */
function busOrigin(b: number): { x: number; y: number } {
  return { x: 16 + (b % 3) * 102, y: b < 3 ? 38 : 92 };
}

/** Window-seat offsets inside one bus, one per seat. */
function seatOffset(slot: number): { x: number; y: number } {
  return { x: 13 + slot * 11.5, y: 15 };
}

/** One waiting child: a head and a shoulders arc, queue-sized. */
function ChildFigure() {
  return (
    <>
      <circle className="cs-child-head" r="4.6" />
      <path className="cs-child-body" d="M-6.5 11 Q0 4 6.5 11" />
    </>
  );
}

export function BusBoardingScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "bus-boarding" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { total, seats } = description;
  const queue = queuePositions(total);
  const busCount = Math.ceil(total / seats);
  const fullTicks = groupTicks(total, seats);
  const hasRemainder = total % seats !== 0;
  const tickValues = hasRemainder ? [...fullTicks, total] : fullTicks;
  const busStart = (b: number) => (stepDelay ? stepDelay(b) : 0.3 + b * 1.0);
  const inBus = (b: number) => Math.min(seats, total - b * seats);
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 20 Q160 16 296 20" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M14 172 Q160 176 306 172" style={delay(0)} />
      {/* The bus stop: a post and a round sign, no words, no numbers. */}
      <path className="cs-line cs-draw" pathLength={1} d="M20 172 Q19 144 20 118" style={delay(0.2)} />
      <g className="cs-pop" style={delay(0.35)}>
        <circle className="cs-sign" cx="20" cy="106" r="11" />
        <path className="cs-line cs-band" d="M13 106 Q20 103 27 106" />
      </g>
      {phase === "setup"
        ? queue.map((p, i) => (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
              <g className="cs-pop" style={delay(0.45 + i * 0.045)}>
                <ChildFigure />
              </g>
            </g>
          ))
        : null}
      {phase === "solved" ? (
        <>
          {/* Buses arrive one at a time and park in rows. */}
          {Array.from({ length: busCount }, (_, b) => {
            const o = busOrigin(b);
            return (
              <g key={`bus-${b}`} transform={`translate(${o.x} ${o.y})`}>
                <g className="cs-slide" style={slideFrom(-(o.x + 96), 0, busStart(b))}>
                  <rect className="cs-bus" x="0" y="0" width="88" height="34" rx="7" />
                  {Array.from({ length: seats }, (_, s) => {
                    const so = seatOffset(s);
                    return (
                      <rect
                        key={s}
                        className="cs-bus-window"
                        x={so.x - 5}
                        y={so.y - 8}
                        width="10"
                        height="14"
                        rx="2"
                      />
                    );
                  })}
                  <path className="cs-line cs-band" d="M4 27 Q44 29 84 27" />
                  <circle className="cs-bus-wheel" cx="18" cy="34" r="4.5" />
                  <circle className="cs-bus-wheel" cx="70" cy="34" r="4.5" />
                </g>
              </g>
            );
          })}
          {/* Each child slides from their queue spot to a window seat. */}
          {queue.map((start, i) => {
            const b = Math.floor(i / seats);
            const slot = i % seats;
            const o = busOrigin(b);
            const so = seatOffset(slot);
            const fin = { x: o.x + so.x, y: o.y + so.y };
            return (
              <g key={i} transform={`translate(${fin.x.toFixed(1)} ${fin.y.toFixed(1)})`}>
                <g
                  className="cs-slide"
                  style={slideFrom(start.x - fin.x, start.y - fin.y, busStart(b) + 0.28 + slot * 0.06)}
                >
                  <circle className="cs-head-dot" r="3.4" />
                </g>
              </g>
            );
          })}
          {/* A tick pops above each bus as it fills. */}
          {tickValues.map((t, b) => {
            const o = busOrigin(b);
            return (
              <text
                key={`tick-${b}`}
                className={`cs-tick${b === tickValues.length - 1 ? " cs-tick-final" : ""}`}
                x={o.x + 44}
                y={o.y - 8}
                style={delay(busStart(b) + 0.28 + inBus(b) * 0.06 + 0.22)}
              >
                {t}
              </text>
            );
          })}
        </>
      ) : null}
    </>
  );
}

/* ── pack-boxes ────────────────────────────────────────────── */

/**
 * The loose pile of pencils on the table (seeded: same every
 * load), each with a slight lean. The solved beat reuses these
 * exact spots as where each pencil is picked up from.
 */
function pencilPile(total: number): { x: number; y: number; rot: number }[] {
  const rnd = seeded(29);
  const pile: { x: number; y: number; rot: number }[] = [];
  for (let i = 0; i < total; i++) {
    pile.push({ x: 34 + rnd() * 252, y: 100 + rnd() * 26, rot: (rnd() - 0.5) * 36 });
  }
  return pile;
}

/** One pencil glyph: a tip triangle over a short body. */
function PencilArt() {
  return (
    <>
      <path className="cs-tip" d="M0 0 L4.6 0 L2.3 -6 Z" />
      <rect className="cs-pencil" x="0" y="0" width="4.6" height="19" />
    </>
  );
}

/** Box origins in the solved row: 5 boxes of ≈56px across. */
function boxOrigin(g: number): { x: number; y: number } {
  return { x: 10 + g * 62, y: 92 };
}

/** A hand-drawn box outline (curved corners, no ruler edges). */
function boxPath(x: number, y: number): string {
  return (
    `M${x + 3} ${y} Q${x + 28} ${y - 3} ${x + 53} ${y} ` +
    `Q${x + 57} ${y + 24} ${x + 53} ${y + 48} ` +
    `Q${x + 28} ${y + 51} ${x + 3} ${y + 48} ` +
    `Q${x - 1} ${y + 24} ${x + 3} ${y} Z`
  );
}

export function PackBoxesScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "pack-boxes" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { total, perBox } = description;
  const pile = pencilPile(total);
  const ticks = groupTicks(total, perBox);
  const boxCount = Math.ceil(total / perBox);
  const groupStart = (g: number) => (stepDelay ? stepDelay(g) : 0.35 + g * 0.85);
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 184 Q160 187 304 184" style={delay(0.15)} />
      {phase === "setup" ? (
        <>
          {/* One open, empty box at the side — never the full row. */}
          <g className="cs-pop" style={delay(0.5)}>
            <path className="cs-line" d="M256 88 Q256 72 258 60 Q280 57 302 60 Q304 72 304 88" />
            <path className="cs-line" d="M258 88 Q280 91 302 88" />
            <path className="cs-line cs-band" d="M258 60 Q248 54 244 46 M302 60 Q312 54 316 46" />
          </g>
          {pile.map((p, i) => (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)})`}>
              <g className="cs-pop" style={delay(0.4 + i * 0.03)}>
                <PencilArt />
              </g>
            </g>
          ))}
        </>
      ) : (
        <>
          {/* Pencils slide from the pile into their box, group by group. */}
          {pile.map((start, i) => {
            const g = Math.floor(i / perBox);
            const slot = i % perBox;
            const o = boxOrigin(g);
            const fin = { x: o.x + 8 + slot * 5.7, y: o.y + 20 };
            return (
              <g key={i} transform={`translate(${fin.x.toFixed(1)} ${fin.y.toFixed(1)})`}>
                <g
                  className="cs-slide"
                  style={slideFrom(start.x - fin.x, start.y - fin.y, groupStart(g) + slot * 0.06)}
                >
                  <PencilArt />
                </g>
              </g>
            );
          })}
          {/* A box draws in around each group as it completes. */}
          {Array.from({ length: boxCount }, (_, g) => {
            const o = boxOrigin(g);
            return (
              <path
                key={`box-${g}`}
                className="cs-line cs-draw"
                pathLength={1}
                d={boxPath(o.x, o.y)}
                style={delay(groupStart(g) + perBox * 0.06 + 0.12)}
              />
            );
          })}
          {/* A tick pops above each box as it fills. */}
          {ticks.map((t, g) => {
            const o = boxOrigin(g);
            return (
              <text
                key={`tick-${t}`}
                className={`cs-tick${g === ticks.length - 1 ? " cs-tick-final" : ""}`}
                x={o.x + 28}
                y={o.y - 10}
                style={delay(groupStart(g) + perBox * 0.06 + 0.4)}
              >
                {t}
              </text>
            );
          })}
        </>
      )}
    </>
  );
}

/* ── Wave 2 kinds (Math 10-18): array-grid, scale-line, percent-bar ──
   Same discipline as the wave-1 kinds above: givens only in the
   setup film, no digits before the pick; the solved beat computes
   its splits and ticks from the givens at solve time. Steps:
   array-grid paces like split-product (split, wide tick, narrow
   tick, final tick); scale-line paces two steps (the kilometre
   marks, then the final tick); percent-bar paces three (the split,
   the saved tick, the final tick on the closing line). */

export function ArrayGridScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "array-grid" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { rows, perRow, splitHigh, splitLow } = description;
  const x0 = 35;
  const w = 250;
  const splitX = x0 + (w * splitHigh) / perRow;
  const firstY = 30;
  const stepY = 6.2;
  const rowH = 4.6;
  const splitBase = stepDelay ? stepDelay(0) : 0.5;
  return (
    <>
      <path className="cs-line cs-draw" pathLength={1} d="M28 176 Q160 180 292 176" style={delay(0)} />
      {Array.from({ length: rows }, (_, r) => {
        const y = firstY + r * stepY;
        return (
          <g key={`row-${r}`}>
            <g className="cs-pop" style={delay(0.25 + r * 0.03)}>
              <rect className="cs-bar" x={x0} y={y} width={w} height={rowH} rx="2.3" />
            </g>
            {phase === "solved" ? (
              <>
                <path
                  className="cs-split-high cs-fade"
                  d={`M${x0 + 2} ${y} H${splitX.toFixed(1)} V${y + rowH} H${x0 + 2} Z`}
                  style={delay(splitBase + r * 0.02)}
                />
                <path
                  className="cs-split-low cs-fade"
                  d={`M${splitX.toFixed(1)} ${y} H${x0 + w - 2} V${y + rowH} H${splitX.toFixed(1)} Z`}
                  style={delay(splitBase + 0.05 + r * 0.02)}
                />
              </>
            ) : null}
          </g>
        );
      })}
      {phase === "solved" ? (
        <>
          <path
            className="cs-line cs-band cs-fade"
            d={`M${splitX.toFixed(1)} 26 Q${(splitX + 1.5).toFixed(1)} 96 ${splitX.toFixed(1)} ${(firstY + rows * stepY).toFixed(1)}`}
            style={delay(splitBase)}
          />
          <text className="cs-tick" x={((x0 + splitX) / 2).toFixed(1)} y="20" style={delay(stepDelay ? stepDelay(1) : 1.5)}>
            {splitHigh * rows}
          </text>
          <text className="cs-tick" x={((splitX + x0 + w) / 2).toFixed(1)} y="20" style={delay(stepDelay ? stepDelay(2) : 2.1)}>
            {splitLow * rows}
          </text>
          <text className="cs-tick cs-tick-final" x="160" y="186" style={delay(stepDelay ? stepDelay(3) : 2.7)}>
            {rows * perRow}
          </text>
        </>
      ) : null}
    </>
  );
}

export function ScaleLineScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "scale-line" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { kilometres, metresPerKm } = description;
  const x0 = 30;
  const x1 = 290;
  const y = 108;
  const wholeKm = Math.floor(kilometres);
  const marks = Array.from({ length: wholeKm }, (_, i) => ({
    x: x0 + ((i + 1) / kilometres) * (x1 - x0),
    value: (i + 1) * metresPerKm,
  }));
  const marksStart = stepDelay ? stepDelay(0) : 0.6;
  return (
    <>
      {/* The river above the measuring bar. */}
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M28 62 Q80 50 128 60 Q176 70 224 58 Q262 50 294 60" style={delay(0.1)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M36 76 Q96 66 160 74 Q224 82 286 72" style={delay(0.2)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0} ${y} Q160 ${y - 6} ${x1} ${y}`} style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M${x0} ${y} L${x0 - 1} ${y - 18} M${x1} ${y} L${x1 + 1} ${y - 18}`} style={delay(0.3)} />
      <path className="cs-flag cs-pop" d={`M${x0 - 1} ${y - 18} L15 ${y - 13.5} L${x0 - 1} ${y - 8} Z`} style={delay(0.5)} />
      <path className="cs-flag cs-pop" d={`M${x1 + 1} ${y - 18} L${x1 + 17} ${y - 13.5} L${x1 + 1} ${y - 8} Z`} style={delay(0.6)} />
      {phase === "solved" ? (
        <>
          {marks.map((m, i) => (
            <g key={`mark-${i}`}>
              <path
                className="cs-line cs-band cs-fade"
                d={`M${m.x.toFixed(1)} ${y - 12} Q${(m.x + 1).toFixed(1)} ${y} ${m.x.toFixed(1)} ${y + 10}`}
                style={delay(marksStart + i * 0.25)}
              />
              <text className="cs-tick" x={m.x.toFixed(1)} y={y + 30} style={delay(marksStart + 0.3 + i * 0.25)}>
                {m.value}
              </text>
            </g>
          ))}
          <text className="cs-tick cs-tick-final" x={x1 - 6} y={y - 28} style={delay(stepDelay ? stepDelay(1) + 0.7 : 1.9)}>
            {kilometres * metresPerKm}
          </text>
        </>
      ) : null}
    </>
  );
}

export function PercentBarScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "percent-bar" }>;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  const { total, percentOff } = description;
  const saved = (total * percentOff) / 100;
  const pay = total - saved;
  const x0 = 35;
  const w = 250;
  const y = 84;
  const h = 26;
  const splitX = x0 + (w * percentOff) / 100;
  const splitStart = stepDelay ? stepDelay(0) : 0.55;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      <g className="cs-pop" style={delay(0.35)}>
        <rect className="cs-bar" x={x0} y={y} width={w} height={h} rx="7" />
      </g>
      {/* A small stack of price coins under the bar (the price is
          the question's own given; the coins carry no digits). */}
      {Array.from({ length: 5 }, (_, i) => (
        <g key={`coin-${i}`} transform={`translate(${120 + i * 20} 132)`}>
          <g className="cs-pop" style={delay(0.5 + i * 0.08)}>
            <circle className="cs-coin" r="7" />
            <circle className="cs-coin-inner" r="3.6" />
          </g>
        </g>
      ))}
      {phase === "solved" ? (
        <>
          <path
            className="cs-split-low cs-fade"
            d={`M${x0 + 7} ${y} H${splitX.toFixed(1)} V${y + h} H${x0 + 7} Q${x0} ${y + h} ${x0} ${y + 13} Q${x0} ${y} ${x0 + 7} ${y} Z`}
            style={delay(splitStart)}
          />
          <path
            className="cs-line cs-band cs-fade"
            d={`M${splitX.toFixed(1)} ${y + 1} Q${(splitX + 1.2).toFixed(1)} ${y + h / 2} ${splitX.toFixed(1)} ${y + h - 1}`}
            style={delay(splitStart + 0.05)}
          />
          <text className="cs-tick" x={((x0 + splitX) / 2).toFixed(1)} y={y - 12} style={delay(stepDelay ? stepDelay(1) + 0.6 : 1.5)}>
            {saved}
          </text>
          <text className="cs-tick cs-tick-final" x={((splitX + x0 + w) / 2).toFixed(1)} y={y - 12} style={delay(stepDelay ? stepDelay(2) + 0.6 : 2.3)}>
            {pay}
          </text>
        </>
      ) : null}
    </>
  );
}

/* ── share-bar (wave 3) ────────────────────────────────────────
   A bill bar. Setup: the plain bar and a small stack of coins —
   no cuts, no digits. Solved, in five steps: 0 the two share
   cuts fade in, 1 the first share's tick, 2 the second share's
   tick, 3 the rest splits in two with its two equal ticks, 4 one
   rest share shrinks under its discount and the final tick
   stands. Every value is computed from the givens. */

function shareFmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function ShareBarScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "share-bar" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { total, firstNumerator, firstDenominator, secondNumerator, secondDenominator, discountPercent } = description;
  const first = (total * firstNumerator) / firstDenominator;
  const second = (total * secondNumerator) / secondDenominator;
  const restEach = (total - first - second) / 2;
  const finalPay = restEach * (1 - discountPercent / 100);
  const x0 = 35;
  const w = 250;
  const y = 84;
  const h = 26;
  const cut1 = x0 + (w * first) / total;
  const cut2 = cut1 + (w * second) / total;
  const cut3 = cut2 + (w * restEach) / total;
  const cutStart = stepDelay ? stepDelay(0) : 0.55;
  const segPath = (xa: number, xb: number) =>
    `M${xa.toFixed(1)} ${y} H${xb.toFixed(1)} V${y + h} H${xa.toFixed(1)} Z`;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      <g className="cs-pop" style={delay(0.35)}>
        <rect className="cs-bar" x={x0} y={y} width={w} height={h} rx="7" />
      </g>
      {Array.from({ length: 5 }, (_, i) => (
        <g key={`coin-${i}`} transform={`translate(${120 + i * 20} 132)`}>
          <g className="cs-pop" style={delay(0.5 + i * 0.08)}>
            <circle className="cs-coin" r="7" />
            <circle className="cs-coin-inner" r="3.6" />
          </g>
        </g>
      ))}
      {phase === "solved" ? (
        <>
          <path className="cs-split-high cs-fade" d={segPath(x0 + 2, cut1)} style={delay(cutStart)} />
          <path className="cs-split-low cs-fade" d={segPath(cut1, cut2)} style={delay(cutStart + 0.05)} />
          <path
            className="cs-line cs-band cs-fade"
            d={`M${cut1.toFixed(1)} ${y + 1} Q${(cut1 + 1.2).toFixed(1)} ${y + h / 2} ${cut1.toFixed(1)} ${y + h - 1} M${cut2.toFixed(1)} ${y + 1} Q${(cut2 + 1.2).toFixed(1)} ${y + h / 2} ${cut2.toFixed(1)} ${y + h - 1}`}
            style={delay(cutStart + 0.05)}
          />
          <text className="cs-tick" x={((x0 + cut1) / 2).toFixed(1)} y={y - 12} style={delay(stepDelay ? stepDelay(1) + 0.6 : 1.5)}>
            {shareFmt(first)}
          </text>
          <text className="cs-tick" x={((cut1 + cut2) / 2).toFixed(1)} y={y - 12} style={delay(stepDelay ? stepDelay(2) + 0.6 : 2.2)}>
            {shareFmt(second)}
          </text>
          <path
            className="cs-line cs-band cs-fade"
            d={`M${cut3.toFixed(1)} ${y + 1} Q${(cut3 + 1.2).toFixed(1)} ${y + h / 2} ${cut3.toFixed(1)} ${y + h - 1}`}
            style={delay(stepDelay ? stepDelay(3) : 2.8)}
          />
          <text className="cs-tick" x={((cut2 + cut3) / 2).toFixed(1)} y={y - 12} style={delay(stepDelay ? stepDelay(3) + 0.6 : 3.3)}>
            {shareFmt(restEach)}
          </text>
          <text className="cs-tick" x={((cut3 + x0 + w) / 2).toFixed(1)} y={y - 12} style={delay(stepDelay ? stepDelay(3) + 0.6 : 3.3)}>
            {shareFmt(restEach)}
          </text>
          <path className="cs-split-low cs-fade" d={segPath(cut3, x0 + w - 2)} style={delay(stepDelay ? stepDelay(4) : 3.9)} />
          <text className="cs-tick cs-tick-final" x={((cut3 + x0 + w) / 2).toFixed(1)} y={y + h + 24} style={delay(stepDelay ? stepDelay(4) + 0.6 : 4.4)}>
            {shareFmt(finalPay)}
          </text>
        </>
      ) : null}
    </>
  );
}
