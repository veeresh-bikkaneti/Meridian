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
import type { CSSProperties, ReactNode } from "react";
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

/* ── Wave 4 kinds (Physics 7-10): push-duel, tile-steps ───────
   Same discipline as the kinds above: givens only in the setup
   film, no digits before the pick; the solved beat computes its
   outcome from the givens at solve time. push-duel paces three
   steps (the arrows press, the block answers, the final tick);
   tile-steps paces one step per hop, each hop's tick the running
   count of tiles covered. */

/** One push arrow, pointing right, its length set by the push's
 * strength — the question's own given, drawn spatially. */
function PushArrow({ headX, y, len, flip }: { headX: number; y: number; len: number; flip?: boolean }) {
  const tailX = flip ? headX + len : headX - len;
  const tipBack = flip ? headX + 11 : headX - 11;
  return (
    <>
      <path className="cs-line cs-band" d={`M${tailX} ${y} Q${(tailX + headX) / 2} ${y - 2} ${headX} ${y}`} />
      <path className="cs-tip" d={`M${headX} ${y} L${tipBack} ${y - 5.5} L${tipBack} ${y + 5.5} Z`} />
    </>
  );
}

export function PushDuelScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "push-duel" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { leftPower, rightPower } = description;
  const dir = leftPower > rightPower ? 1 : rightPower > leftPower ? -1 : 0;
  const finalCx = 160 + dir * 40;
  const pressStart = stepDelay ? stepDelay(0) : 0.5;
  const answerStart = stepDelay ? stepDelay(1) : 1.3;
  const tickStart = stepDelay ? stepDelay(2) : 2.1;
  const block = (cx: number) => (
    <>
      <rect className="cs-pack" x={cx - 23} y="116" width="46" height="34" rx="4" />
      <path className="cs-line cs-band" d={`M${cx - 22} 128 Q${cx} 126 ${cx + 22} 128`} />
      <path className="cs-line cs-soft" d={`M${cx - 8} 117 Q${cx - 9} 133 ${cx - 8} 149 M${cx + 8} 117 Q${cx + 9} 133 ${cx + 8} 149`} />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 40 Q160 36 296 40" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 152 Q160 156 304 152" style={delay(0)} />
      {phase === "setup" ? (
        <>
          <g className="cs-pop" style={delay(0.35)}>{block(160)}</g>
          <g className="cs-pop" style={delay(0.5)}>
            <PushArrow headX={123} y={133} len={26 + leftPower * 16} />
          </g>
          <g className="cs-pop" style={delay(0.6)}>
            <PushArrow headX={197} y={133} len={26 + rightPower * 16} flip />
          </g>
        </>
      ) : (
        <>
          <g className="cs-slide" style={slideFrom(-26, 0, pressStart)}>
            <PushArrow headX={123} y={133} len={26 + leftPower * 16} />
          </g>
          <g className="cs-slide" style={slideFrom(26, 0, pressStart)}>
            <PushArrow headX={197} y={133} len={26 + rightPower * 16} flip />
          </g>
          {dir !== 0 ? (
            <g transform={`translate(${dir * 40} 0)`}>
              <g className="cs-slide" style={slideFrom(-dir * 40, 0, answerStart)}>{block(160)}</g>
            </g>
          ) : (
            <>
              <g className="cs-cheer" style={delay(answerStart)}>{block(160)}</g>
              <path
                className="cs-line cs-band cs-fade"
                d="M128 108 Q124 133 128 150 M192 108 Q196 133 192 150"
                style={delay(answerStart + 0.2)}
              />
            </>
          )}
          <text className="cs-tick cs-tick-final" x={finalCx} y="88" style={delay(tickStart + 0.55)}>
            {dir > 0 ? "→" : dir < 0 ? "←" : "="}
          </text>
        </>
      )}
    </>
  );
}

/** The box the single tile-steps item pushes (a plain crate). */
function StepBoxArt() {
  return (
    <>
      <rect className="cs-pack" x="-25" y="-25" width="26" height="25" rx="3" />
      <path className="cs-line cs-band" d="M-24 -8 Q-12 -10 0 -8" />
    </>
  );
}

/** The cart the two-cart tile-steps item races (a crate on wheels). */
function StepCartArt() {
  return (
    <>
      <rect className="cs-pack" x="-24" y="-23" width="25" height="17" rx="3" />
      <path className="cs-line cs-band" d="M-23 -12 Q-12 -14 0 -12" />
      <circle className="cs-bus-wheel" cx="-17" cy="-2" r="3.6" />
      <circle className="cs-bus-wheel" cx="-6" cy="-2" r="3.6" />
    </>
  );
}

export function TileStepsScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "tile-steps" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, hop h's beat starts at
   * stepDelay(h) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { tilesPerStep, hops, rivalTilesPerStep } = description;
  const hopStart = (h: number) => (stepDelay ? stepDelay(h) : 0.4 + h * 0.6);
  // One hopper's copies: each hop but the last lands, holds a
  // beat and fades (the counter-step keyframes) as the next hop
  // takes over; the last hop stands. `fadeLast` keeps the rival
  // cart standing where the race left it too.
  const hopper = (
    perStep: number,
    x0: number,
    tileW: number,
    floorY: number,
    art: ReactNode,
    keyPrefix: string,
  ) =>
    Array.from({ length: hops }, (_, h) => {
      const finX = x0 + (h + 1) * perStep * tileW;
      const prevX = x0 + h * perStep * tileW;
      const inner = (
        <g className="cs-slide" style={slideFrom(prevX - finX, 0, hopStart(h))}>
          {art}
        </g>
      );
      return (
        <g key={`${keyPrefix}-${h}`} transform={`translate(${finX} ${floorY})`}>
          {h < hops - 1 ? (
            <g className="cs-counter-step" style={delay(hopStart(h))}>{inner}</g>
          ) : (
            inner
          )}
        </g>
      );
    });
  if (rivalTilesPerStep === undefined) {
    const tileW = 29;
    const x0 = 44;
    const tiles = tilesPerStep * hops;
    const finalX = x0 + tiles * tileW;
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 52 Q160 48 296 52" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d="M20 154 Q160 158 300 154" style={delay(0)} />
        {Array.from({ length: tiles }, (_, i) => (
          <g key={`tile-${i}`} className="cs-pop" style={delay(0.25 + i * 0.04)}>
            <rect className="cs-bar" x={x0 + i * tileW + 1} y="138" width={tileW - 2} height="14" rx="3" />
          </g>
        ))}
        <path className="cs-line cs-draw" pathLength={1} d={`M${x0} 138 L${x0} 112`} style={delay(0.3)} />
        <path className="cs-flag cs-pop" d={`M${x0} 112 L${x0 + 14} 116.5 L${x0} 121 Z`} style={delay(0.5)} />
        {phase === "setup" ? (
          <g transform={`translate(${x0} 138)`}>
            <g className="cs-pop" style={delay(0.55)}>
              <StepBoxArt />
            </g>
          </g>
        ) : (
          <>
            {hopper(tilesPerStep, x0, tileW, 138, <StepBoxArt />, "box")}
            {Array.from({ length: hops }, (_, h) => (
              <text
                key={`tick-${h}`}
                className={`cs-tick${h === hops - 1 ? " cs-tick-final" : ""}`}
                x={x0 + (h + 1) * tilesPerStep * tileW - (tilesPerStep * tileW) / 2}
                y="106"
                style={delay(hopStart(h) + 0.4)}
              >
                {(h + 1) * tilesPerStep}
              </text>
            ))}
            <ellipse
              className="cs-ring"
              cx={finalX - 12}
              cy="125"
              rx="23"
              ry="20"
              style={delay(hopStart(hops - 1) + 0.55)}
            />
          </>
        )}
      </>
    );
  }
  const tileW = 26;
  const x0 = 36;
  const tiles = tilesPerStep * hops;
  const leadFinalX = x0 + tiles * tileW;
  const lane = (floorY: number, keyPrefix: string) =>
    Array.from({ length: tiles }, (_, i) => (
      <g key={`${keyPrefix}-${i}`} className="cs-pop" style={delay(0.25 + i * 0.03)}>
        <rect className="cs-bar" x={x0 + i * tileW + 1} y={floorY} width={tileW - 2} height="11" rx="3" />
      </g>
    ));
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 172 Q160 176 300 172" style={delay(0)} />
      {lane(102, "lead-tile")}
      {lane(150, "rival-tile")}
      {/* The finish line both carts race for (a given). */}
      <path className="cs-line cs-draw" pathLength={1} d={`M${leadFinalX} 168 L${leadFinalX} 62`} style={delay(0.3)} />
      <path className="cs-flag cs-pop" d={`M${leadFinalX} 62 L${leadFinalX - 14} 66.5 L${leadFinalX} 71 Z`} style={delay(0.5)} />
      {phase === "setup" ? (
        <>
          <g transform={`translate(${x0} 102)`}>
            <g className="cs-pop" style={delay(0.55)}>
              <StepCartArt />
            </g>
          </g>
          <g transform={`translate(${x0} 150)`}>
            <g className="cs-pop" style={delay(0.65)}>
              <StepCartArt />
            </g>
          </g>
        </>
      ) : (
        <>
          {hopper(tilesPerStep, x0, tileW, 102, <StepCartArt />, "lead")}
          {hopper(rivalTilesPerStep, x0, tileW, 150, <StepCartArt />, "rival")}
          {Array.from({ length: hops }, (_, h) => (
            <text
              key={`tick-${h}`}
              className={`cs-tick${h === hops - 1 ? " cs-tick-final" : ""}`}
              x={x0 + (h + 1) * tilesPerStep * tileW - (tilesPerStep * tileW) / 2}
              y="76"
              style={delay(hopStart(h) + 0.4)}
            >
              {(h + 1) * tilesPerStep}
            </text>
          ))}
          {Array.from({ length: hops }, (_, h) => (
            <circle
              key={`dot-${h}`}
              className="cs-stone cs-pop"
              cx={x0 + (h + 1) * rivalTilesPerStep * tileW - 4}
              cy="168"
              r="3"
              style={delay(hopStart(h) + 0.35)}
            />
          ))}
          <ellipse
            className="cs-ring"
            cx={leadFinalX - 11}
            cy="90"
            rx="21"
            ry="18"
            style={delay(hopStart(hops - 1) + 0.55)}
          />
        </>
      )}
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

/* ── Wave 5 kinds (Physics 7-10): magnet-pair, wind-up ───────
   Same discipline as the kinds above: givens only in the setup
   film, no digits before the pick; the solved beat computes its
   outcome from the givens at solve time. magnet-pair paces
   three steps (one magnet flips, the pair springs apart, the
   final tick); wind-up paces three (the key turns, the wound
   car rolls, the final tick). Neither kind moves anything at
   all in setup. */

/** One magnet glyph, centred on the origin: a bar with a pole
 * cap at each end; `flipped` swaps which cap carries the band,
 * the turned-around magnet of the solved beat. */
function MagnetArt({ flipped }: { flipped?: boolean }) {
  return (
    <>
      <rect className="cs-pack" x="-20" y="-9" width="40" height="18" rx="3" />
      <path className={flipped ? "cs-line cs-soft" : "cs-line cs-band"} d="M-19 -3 Q-10 -5 -1 -3" />
      <path className={flipped ? "cs-line cs-band" : "cs-line cs-soft"} d="M1 3 Q10 1 19 3" />
    </>
  );
}

export function MagnetPairScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "magnet-pair" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  if (description.twoPairs) {
    // Wave-6 variant (physics:magnet:closer): two pairs rest at
    // different gaps — the gaps are the question's givens, drawn
    // as they are, with no snap and no winner marked. Solved in
    // three steps: 0 the closer pair snaps shut, 1 the farther
    // pair only nudges, 2 the final tick stands over the closer
    // pair. The wave-5 cabinet path below is untouched.
    const snapStart = stepDelay ? stepDelay(0) : 0.5;
    const nudgeStart = stepDelay ? stepDelay(1) : 1.4;
    const tickStart = stepDelay ? stepDelay(2) : 2.3;
    const pairY = 108;
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d="M16 164 Q160 168 304 164" style={delay(0)} />
        <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M28 ${pairY + 22} Q88 ${pairY + 25} 148 ${pairY + 22}`} style={delay(0.15)} />
        <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M172 ${pairY + 22} Q232 ${pairY + 25} 292 ${pairY + 22}`} style={delay(0.2)} />
        {phase === "setup" ? (
          <>
            <g transform={`translate(62 ${pairY})`}>
              <g className="cs-pop" style={delay(0.45)}><MagnetArt /></g>
            </g>
            <g transform={`translate(114 ${pairY})`}>
              <g className="cs-pop" style={delay(0.55)}><MagnetArt /></g>
            </g>
            <g transform={`translate(200 ${pairY})`}>
              <g className="cs-pop" style={delay(0.65)}><MagnetArt /></g>
            </g>
            <g transform={`translate(268 ${pairY})`}>
              <g className="cs-pop" style={delay(0.75)}><MagnetArt /></g>
            </g>
          </>
        ) : (
          <>
            {/* The closer pair snaps shut. */}
            <g transform={`translate(62 ${pairY})`}>
              <g className="cs-pop" style={delay(0.3)}><MagnetArt /></g>
            </g>
            <g transform={`translate(102 ${pairY})`}>
              <g className="cs-slide" style={slideFrom(12, 0, snapStart)}><MagnetArt /></g>
            </g>
            {/* The farther pair only tugs a little way. */}
            <g transform={`translate(200 ${pairY})`}>
              <g className="cs-pop" style={delay(0.35)}><MagnetArt /></g>
            </g>
            <g transform={`translate(265 ${pairY})`}>
              <g className="cs-slide" style={slideFrom(3, 0, nudgeStart)}><MagnetArt /></g>
            </g>
            <ellipse className="cs-ring" cx="82" cy={pairY} rx="52" ry="24" style={delay(tickStart + 0.4)} />
            <text className="cs-tick cs-tick-final" x="82" y="58" style={delay(tickStart + 0.55)}>
              ✓
            </text>
          </>
        )}
      </>
    );
  }
  const flipStart = stepDelay ? stepDelay(0) : 0.5;
  const apartStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  // Cabinet doors: two panels meeting at the centre seam; in
  // the solved beat each panel rests swung a little outward,
  // pushed open as its magnet springs away from the other.
  const door = (side: 1 | -1, open: boolean) => {
    const x0 = side < 0 ? 62 : 160;
    const lean = open ? side * 7 : 0;
    return (
      <path
        className="cs-line cs-draw"
        pathLength={1}
        d={`M${x0 + lean} 62 Q${x0 + 49} 58 ${x0 + 98 - lean} 62 L${x0 + 98 - lean * 0.4} 150 Q${x0 + 49} 154 ${x0 + lean * 0.4} 150 Z`}
        style={delay(0.15)}
      />
    );
  };
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 164 Q160 168 304 164" style={delay(0)} />
      {phase === "setup" ? (
        <>
          {door(-1, false)}
          {door(1, false)}
          {/* The pair snapped together on the seam, holding the
              cabinet shut — no flip, no gap. */}
          <g transform="translate(140 106)">
            <g className="cs-pop" style={delay(0.45)}>
              <MagnetArt />
            </g>
          </g>
          <g transform="translate(180 106)">
            <g className="cs-pop" style={delay(0.55)}>
              <MagnetArt />
            </g>
          </g>
        </>
      ) : (
        <>
          {door(-1, true)}
          {door(1, true)}
          {/* One magnet turns around (its pole bands swap), then
              the pair springs apart to its resting places. */}
          <g transform="translate(102 106)">
            <g className="cs-slide" style={slideFrom(38, 0, apartStart)}>
              <MagnetArt />
            </g>
          </g>
          <g transform="translate(218 106)">
            <g className="cs-slide" style={slideFrom(-38, 0, apartStart)}>
              <g className="cs-grow" style={delay(flipStart)}>
                <MagnetArt flipped />
              </g>
            </g>
          </g>
          <text className="cs-tick cs-tick-final" x="160" y="46" style={delay(tickStart + 0.55)}>
            ↔
          </text>
        </>
      )}
    </>
  );
}

/** One toy car glyph, centred on its floor line: a body, a
 * cabin, and two wheels. */
function ToyCarArt() {
  return (
    <>
      <rect className="cs-pack" x="-24" y="-20" width="48" height="15" rx="4" />
      <path className="cs-line cs-band" d="M-12 -20 Q-8 -29 2 -29 Q10 -29 13 -20" />
      <circle className="cs-bus-wheel" cx="-14" cy="-3" r="4.4" />
      <circle className="cs-bus-wheel" cx="14" cy="-3" r="4.4" />
    </>
  );
}

/** The winding key on the wound car's roof: a stem and a bow. */
function WindKeyArt() {
  return (
    <>
      <path className="cs-line cs-band" d="M0 -29 L0 -38" />
      <circle className="cs-line" cx="-5" cy="-41" r="3.6" />
      <circle className="cs-line" cx="5" cy="-41" r="3.6" />
    </>
  );
}

export function WindUpScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "wind-up" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const keyStart = stepDelay ? stepDelay(0) : 0.5;
  const rollStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const floorY = 148;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 40 Q160 36 296 40" style={delay(0.1)} />
      {/* The mat both cars rest on. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M28 ${floorY + 6} Q160 ${floorY + 10} 292 ${floorY + 6}`} style={delay(0)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M36 ${floorY + 14} Q160 ${floorY + 17} 284 ${floorY + 14}`} style={delay(0.15)} />
      {phase === "setup" ? (
        <>
          {/* Two cars at rest; the wound one carries its key —
              the question's own given. No motion. */}
          <g transform={`translate(78 ${floorY})`}>
            <g className="cs-pop" style={delay(0.45)}>
              <ToyCarArt />
              <WindKeyArt />
            </g>
          </g>
          <g transform={`translate(242 ${floorY})`}>
            <g className="cs-pop" style={delay(0.6)}>
              <ToyCarArt />
            </g>
          </g>
        </>
      ) : (
        <>
          {/* The key turns on the wound car, then that car rolls
              across the mat; the unwound car never moves. */}
          <g transform={`translate(172 ${floorY})`}>
            <g className="cs-slide" style={slideFrom(78 - 172, 0, rollStart)}>
              <ToyCarArt />
              <g className="cs-grow" style={delay(keyStart)}>
                <WindKeyArt />
              </g>
            </g>
          </g>
          <g transform={`translate(242 ${floorY})`}>
            <g className="cs-pop" style={delay(0.3)}>
              <ToyCarArt />
            </g>
          </g>
          <ellipse className="cs-ring" cx="172" cy={floorY - 16} rx="34" ry="26" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="172" y="86" style={delay(tickStart + 0.55)}>
            →
          </text>
        </>
      )}
    </>
  );
}

/* ── Wave 6 kinds (Physics 10-18): rate-race, same-push ──────
   Same discipline as the kinds above: givens only in the setup
   film, no digits and no winner before the pick; the solved
   beat computes its outcome from the givens at solve time.
   rate-race paces three steps (the first second's hops, the
   second second's hops that end the race, the final tick);
   same-push paces three (the arrows press, both carts roll,
   the final tick). */

/** One race cart's hops, tile-steps style: each hop but the
 * last lands, holds a beat and fades as the next takes over. */
function raceHopper(
  perHopPx: number,
  hops: number,
  x0: number,
  floorY: number,
  hopStart: (h: number) => number,
  keyPrefix: string,
) {
  return Array.from({ length: hops }, (_, h) => {
    const finX = x0 + (h + 1) * perHopPx;
    const prevX = x0 + h * perHopPx;
    const inner = (
      <g className="cs-slide" style={slideFrom(prevX - finX, 0, hopStart(h))}>
        <StepCartArt />
      </g>
    );
    return (
      <g key={`${keyPrefix}-${h}`} transform={`translate(${finX} ${floorY})`}>
        {h < hops - 1 ? (
          <g className="cs-counter-step" style={delay(hopStart(h))}>{inner}</g>
        ) : (
          inner
        )}
      </g>
    );
  });
}

export function RateRaceScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "rate-race" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { firstMetres, firstSeconds, secondMetres, secondSeconds } = description;
  const firstPerSecond = firstMetres / firstSeconds;
  const secondPerSecond = secondMetres / secondSeconds;
  // The race ends when the faster cart arrives: it runs for its
  // own seconds, one hop per second, and the other cart hops
  // the same count at its own slower pace.
  const fasterIsFirst = firstPerSecond >= secondPerSecond;
  const hops = fasterIsFirst ? firstSeconds : secondSeconds;
  const x0 = 36;
  const pxPerMetre = 24;
  const bridgeX = x0 + (fasterIsFirst ? firstMetres : secondMetres) * pxPerMetre;
  const laneA = 96;
  const laneB = 148;
  const hopStart = (h: number) => (stepDelay ? stepDelay(h) : 0.4 + h * 0.7);
  const tickStart = stepDelay ? stepDelay(hops) : 0.4 + hops * 0.7;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 168 Q160 172 304 168" style={delay(0)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M28 ${laneA + 4} Q160 ${laneA + 7} 292 ${laneA + 4}`} style={delay(0.12)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M28 ${laneB + 4} Q160 ${laneB + 7} 292 ${laneB + 4}`} style={delay(0.18)} />
      {/* The bridge both carts leave for (a given). */}
      <path className="cs-line cs-draw" pathLength={1} d={`M${bridgeX} 168 L${bridgeX} 58`} style={delay(0.3)} />
      <path className="cs-flag cs-pop" d={`M${bridgeX} 58 L${bridgeX - 14} 62.5 L${bridgeX} 67 Z`} style={delay(0.5)} />
      {phase === "setup" ? (
        <>
          <g transform={`translate(${x0} ${laneA})`}>
            <g className="cs-pop" style={delay(0.55)}><StepCartArt /></g>
          </g>
          <g transform={`translate(${x0} ${laneB})`}>
            <g className="cs-pop" style={delay(0.65)}><StepCartArt /></g>
          </g>
        </>
      ) : (
        <>
          {raceHopper(firstPerSecond * pxPerMetre, hops, x0, laneA, hopStart, "first")}
          {raceHopper(secondPerSecond * pxPerMetre, hops, x0, laneB, hopStart, "second")}
          {/* Per-second ticks under each cart: the metres each
              hop covers, landing with the hop that earns them. */}
          {Array.from({ length: hops - 1 }, (_, h) => (
            <text
              key={`tick-a-${h}`}
              className="cs-tick"
              x={x0 + (h + 1) * firstPerSecond * pxPerMetre - 6}
              y={laneA - 34}
              style={delay(hopStart(h) + 0.35)}
            >
              {(h + 1) * firstPerSecond}
            </text>
          ))}
          {Array.from({ length: hops - 1 }, (_, h) => (
            <text
              key={`tick-b-${h}`}
              className="cs-tick"
              x={x0 + (h + 1) * secondPerSecond * pxPerMetre - 6}
              y={laneB - 34}
              style={delay(hopStart(h) + 0.35)}
            >
              {(h + 1) * secondPerSecond}
            </text>
          ))}
          <ellipse
            className="cs-ring"
            cx={bridgeX - 11}
            cy={(fasterIsFirst ? laneA : laneB) - 13}
            rx="21"
            ry="18"
            style={delay(tickStart + 0.4)}
          />
          <text className="cs-tick cs-tick-final" x={bridgeX - 11} y="44" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/** The load a same-push cart carries: small boxes stacked on
 * the cart's bed (the question's given, drawn as it is). */
function LoadBoxes({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          className="cs-pack"
          x={-22 + (i % 2) * 13}
          y={-34 - Math.floor(i / 2) * 11}
          width="12"
          height="10"
          rx="2"
        />
      ))}
    </>
  );
}

export function SamePushScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "same-push" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const { leftBoxes, rightBoxes, leftForce, rightForce } = description;
  const pressStart = stepDelay ? stepDelay(0) : 0.5;
  const rollStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const floorY = 146;
  // The winner, computed from the givens: with different loads
  // the lighter cart wins; with equal loads the larger force
  // wins. The loser still rolls — just not as far.
  const leftWins = leftBoxes !== rightBoxes ? leftBoxes < rightBoxes : leftForce > rightForce;
  const leftRoll = leftWins ? 72 : 22;
  const rightRoll = leftWins ? 22 : 72;
  const leftX = 78;
  const rightX = 218;
  const arrow = (cartX: number, force: number, start: number) => (
    <g className="cs-grow" style={delay(start)}>
      <path className="cs-line cs-band" d={`M${cartX - 30 - force * 13} ${floorY - 14} Q${cartX - 28 - force * 6} ${floorY - 17} ${cartX - 29} ${floorY - 14}`} />
      <path className="cs-tip" d={`M${cartX - 29} ${floorY - 14} L${cartX - 36} ${floorY - 19} L${cartX - 35} ${floorY - 9} Z`} />
    </g>
  );
  const cart = (boxes: number) => (
    <>
      <StepCartArt />
      <LoadBoxes count={boxes} />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 40 Q160 36 296 40" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${floorY + 6} Q160 ${floorY + 10} 304 ${floorY + 6}`} style={delay(0)} />
      {phase === "setup" ? (
        <>
          {/* Both carts at rest, loads and push arrows drawn as
              the question gives them. No motion, no winner. */}
          {arrow(leftX, leftForce, 0.5)}
          {arrow(rightX, rightForce, 0.6)}
          <g transform={`translate(${leftX} ${floorY})`}>
            <g className="cs-pop" style={delay(0.45)}>{cart(leftBoxes)}</g>
          </g>
          <g transform={`translate(${rightX} ${floorY})`}>
            <g className="cs-pop" style={delay(0.55)}>{cart(rightBoxes)}</g>
          </g>
        </>
      ) : (
        <>
          {arrow(leftX, leftForce, pressStart)}
          {arrow(rightX, rightForce, pressStart + 0.1)}
          <g transform={`translate(${leftX + leftRoll} ${floorY})`}>
            <g className="cs-slide" style={slideFrom(-leftRoll, 0, rollStart)}>{cart(leftBoxes)}</g>
          </g>
          <g transform={`translate(${rightX + rightRoll} ${floorY})`}>
            <g className="cs-slide" style={slideFrom(-rightRoll, 0, rollStart + 0.1)}>{cart(rightBoxes)}</g>
          </g>
          <ellipse
            className="cs-ring"
            cx={(leftWins ? leftX + leftRoll : rightX + rightRoll) - 11}
            cy={floorY - 13}
            rx="24"
            ry="20"
            style={delay(tickStart + 0.4)}
          />
          <text
            className="cs-tick cs-tick-final"
            x={(leftWins ? leftX + leftRoll : rightX + rightRoll) - 11}
            y="84"
            style={delay(tickStart + 0.55)}
          >
            ✓
          </text>
        </>
      )}
    </>
  );
}

/* ── Wave 7 kinds (Chemistry): melt-freeze, bend-test ──────────
   Same discipline as the kinds above: givens only in the setup
   film, no winner before the pick. melt-freeze paces three
   steps in both directions (the warmth waves / the returning
   cold, the melt or freeze itself, the final tick); bend-test
   paces three (the press, the flex, the final tick). */

/** A wavy warmth line, drawn beside the ice pop in the melt
 * direction's solved beat only — never in setup. */
function WarmthWaves({ x, y, start }: { x: number; y: number; start: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <path
          key={`warm-${i}`}
          className="cs-line cs-band cs-pop"
          d={`M${x + i * 16} ${y + 14} Q${x + i * 16 + 5} ${y + 6} ${x + i * 16} ${y - 2} Q${x + i * 16 - 5} ${y - 10} ${x + i * 16} ${y - 18}`}
          style={delay(start + i * 0.18)}
        />
      ))}
    </>
  );
}

export function MeltFreezeScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "melt-freeze" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const firstStart = stepDelay ? stepDelay(0) : 0.5;
  const changeStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 164;
  if (description.freeze) {
    // Freeze direction: an open puddle (the given) under a
    // darkening sky; the solved beat brings the cold back and
    // ice skins over the water.
    const puddleCx = 160;
    const puddleCy = 138;
    return (
      <>
        <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
        <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
        {/* The open puddle: plain water, no ice skin anywhere. */}
        <ellipse className="cs-line cs-draw" pathLength={1} cx={puddleCx} cy={puddleCy} rx="86" ry="13" style={delay(0.3)} />
        <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M96 ${puddleCy + 2} Q160 ${puddleCy + 7} 224 ${puddleCy + 2}`} style={delay(0.45)} />
        {phase === "solved" ? (
          <>
            {/* Step 0: the sky darkens — a moon and cold stars. */}
            <circle className="cs-coin cs-pop" cx="262" cy="58" r="11" style={delay(firstStart)} />
            <circle className="cs-coin-inner cs-pop" cx="258" cy="55" r="2" style={delay(firstStart + 0.15)} />
            {[52, 96, 140].map((sx, i) => (
              <path
                key={`star-${i}`}
                className="cs-line cs-band cs-pop"
                d={`M${sx} 50 L${sx} 60 M${sx - 5} 55 L${sx + 5} 55`}
                style={delay(firstStart + 0.2 + i * 0.15)}
              />
            ))}
            {/* Step 1: ice skins over the puddle, crack by crack. */}
            {[0, 1, 2, 3].map((i) => (
              <path
                key={`skin-${i}`}
                className="cs-line cs-band cs-draw"
                pathLength={1}
                d={`M${92 + i * 36} ${puddleCy - 3} Q${106 + i * 36} ${puddleCy + 3} ${120 + i * 36} ${puddleCy - 2}`}
                style={delay(changeStart + i * 0.16)}
              />
            ))}
            <ellipse className="cs-ring" cx={puddleCx} cy={puddleCy} rx="92" ry="19" style={delay(tickStart + 0.4)} />
            <text className="cs-tick cs-tick-final" x={puddleCx} y="98" style={delay(tickStart + 0.55)}>
              ✓
            </text>
          </>
        ) : null}
      </>
    );
  }
  // Melt direction: a whole ice pop on its stick. Setup shows
  // the pop whole with no drips and no warmth marked.
  const popCx = 160;
  const popTop = 52;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The stick, then the pop body resting whole on it. */}
      <rect className="cs-pack cs-pop" x={popCx - 4} y="118" width="8" height="34" rx="3" style={delay(0.4)} />
      <g className={phase === "solved" ? "cs-cheer" : "cs-pop"} style={delay(phase === "solved" ? changeStart + 0.5 : 0.5)}>
        <path
          className="cs-stone"
          d={`M${popCx - 22} 124 L${popCx - 22} ${popTop + 16} Q${popCx - 22} ${popTop} ${popCx} ${popTop} Q${popCx + 22} ${popTop} ${popCx + 22} ${popTop + 16} L${popCx + 22} 124 Q${popCx} 118 ${popCx - 22} 124 Z`}
        />
        <path className="cs-line cs-band" d={`M${popCx - 21} 84 Q${popCx} 79 ${popCx + 21} 84`} />
      </g>
      {phase === "solved" ? (
        <>
          {/* Step 0: warmth waves rise on both sides. */}
          <WarmthWaves x={popCx - 58} y={104} start={firstStart} />
          <WarmthWaves x={popCx + 34} y={104} start={firstStart + 0.2} />
          {/* Step 1: drips run down and pool at the base. */}
          {[-14, 2, 16].map((dx, i) => (
            <g key={`drip-${i}`} transform={`translate(${popCx + dx} 152)`}>
              <g className="cs-slide" style={slideFrom(0, -26, changeStart + i * 0.22)}>
                <path className="cs-tip" d="M0 -6 Q4 2 0 6 Q-4 2 0 -6 Z" />
              </g>
            </g>
          ))}
          <ellipse className="cs-line cs-band cs-pop" cx={popCx} cy="158" rx="30" ry="4.5" style={delay(changeStart + 0.7)} />
          <ellipse className="cs-ring" cx={popCx} cy="92" rx="34" ry="46" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x={popCx} y="30" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}

/** One spoon, lying along y=0 from its bowl (left) to its tip
 * (right). `bent` draws the tip curved down — solved phase only. */
function SpoonArt({ bent }: { bent?: boolean }) {
  return (
    <>
      <ellipse className="cs-stone" cx="-52" cy="0" rx="17" ry="9" />
      <path
        className="cs-line"
        d={bent ? "M-36 0 Q10 -2 44 2 Q58 4 64 14" : "M-36 0 Q14 -3 66 0"}
      />
      <path className="cs-line cs-band" d="M-62 -3 Q-52 -6 -42 -3" />
    </>
  );
}

export function BendTestScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "bend-test" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const pressStart = stepDelay ? stepDelay(0) : 0.5;
  const flexStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const topY = 76;
  const lowY = 128;
  const pressArrow = (y: number, start: number) => (
    <path
      className="cs-line cs-band cs-pop"
      d={`M222 ${y - 34} L222 ${y - 14} M216 ${y - 20} L222 ${y - 12} L228 ${y - 20}`}
      style={delay(start)}
    />
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 36 Q160 32 296 36" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 164 Q160 168 304 164" style={delay(0)} />
      {/* The table edges the spoons rest on. */}
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M28 ${topY + 14} Q160 ${topY + 18} 292 ${topY + 14}`} style={delay(0.2)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M28 ${lowY + 14} Q160 ${lowY + 18} 292 ${lowY + 14}`} style={delay(0.25)} />
      {/* Setup: both spoons whole and unpressed, identical.
          Solved: the upper spoon is drawn bent (its resting
          frame), the lower one stays stiff — which bends is
          spent only in the solved phase. */}
      <g transform={`translate(150 ${topY})`}>
        <g className="cs-pop" style={delay(0.45)}>
          <SpoonArt bent={phase === "solved"} />
        </g>
      </g>
      <g transform={`translate(150 ${lowY})`}>
        <g className="cs-pop" style={delay(0.6)}>
          <SpoonArt />
        </g>
      </g>
      {phase === "solved" ? (
        <>
          {/* Step 0: a press lands on each tip alike. */}
          {pressArrow(topY, pressStart)}
          {pressArrow(lowY, pressStart + 0.15)}
          {/* Step 1: the flex shows — a soft ring under the
              bent tip; the stiff spoon gets none. */}
          <ellipse className="cs-ring-soft cs-pop" cx="216" cy={topY + 10} rx="18" ry="9" style={delay(flexStart + 0.3)} />
          <ellipse className="cs-ring" cx="150" cy={topY} rx="86" ry="24" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="150" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      ) : null}
    </>
  );
}
/* ── scale-balance ───────────────────────────────────────────
   Two substances in jars rest on a top-pan scale. Setup: the
   dial face is blank — no needle, no reading — so nothing
   about the total is shown before the pick. Solved: one jar
   pours into the other on the same pan (nothing leaves, nothing
   is added), the mix's look changes, and only then does the
   needle appear, settling at the dial's centre mark. */

export function ScaleBalanceScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "scale-balance" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const pourStart = stepDelay ? stepDelay(0) : 0.5;
  const mixStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 172;
  const panY = 108;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The scale body and its pan. */}
      <path className="cs-line cs-draw" pathLength={1} d="M104 156 L124 116 L196 116 L216 156" style={delay(0.2)} />
      <path className="cs-line cs-draw" pathLength={1} d="M96 164 Q160 160 224 164 M104 116 Q160 112 216 116" style={delay(0.25)} />
      <ellipse className="cs-line cs-draw" pathLength={1} cx="160" cy={panY} rx="72" ry="8" style={delay(0.3)} />
      {/* The dial: a blank face in setup — the needle and its
          centre mark exist only in the solved beat. */}
      <circle className="cs-pack cs-pop" cx="160" cy="140" r="15" style={delay(0.4)} />
      {phase === "solved" ? (
        <>
          <path className="cs-line cs-band cs-pop" d="M160 140 L160 128 M155 131 L160 127 L165 131" style={delay(tickStart)} />
          <circle className="cs-coin-inner cs-pop" cx="160" cy="140" r="2.4" style={delay(tickStart + 0.1)} />
        </>
      ) : null}
      {/* The two jars on the pan. In the solved resting frame
          the right jar tips over the left one, pouring in. */}
      <g transform="translate(128 84)">
        <g className="cs-pop" style={delay(0.5)}>
          <rect className="cs-pack" x="-16" y="-24" width="32" height="40" rx="3" />
          <path className="cs-line cs-band" d="M-15 2 Q0 0 15 2" />
          <circle className="cs-stone" cx="-6" cy="8" r="2.6" />
          <circle className="cs-stone" cx="5" cy="11" r="2.6" />
        </g>
      </g>
      {phase === "setup" ? (
        <g transform="translate(192 84)">
          <g className="cs-pop" style={delay(0.65)}>
            <rect className="cs-pack" x="-16" y="-24" width="32" height="40" rx="3" />
            <path className="cs-line cs-band" d="M-15 -8 Q0 -10 15 -8" />
            <path className="cs-line" d="M-9 8 L9 8 M-9 13 L9 13" />
          </g>
        </g>
      ) : (
        <>
          {/* Step 0: the right jar pours into the left one —
              every drop stays on the same pan. */}
          <g transform="translate(178 62) rotate(48)">
            <g className="cs-slide" style={slideFrom(-14, 22, pourStart)}>
              <rect className="cs-pack" x="-16" y="-24" width="32" height="40" rx="3" />
              <path className="cs-line cs-band" d="M-15 -8 Q0 -10 15 -8" />
            </g>
          </g>
          {[0, 1, 2].map((i) => (
            <circle
              key={`pour-${i}`}
              className="cs-stone cs-pop"
              cx={150 + i * 5}
              cy={66 + i * 7}
              r="2.4"
              style={delay(pourStart + 0.25 + i * 0.14)}
            />
          ))}
          {/* Step 1: the mixed jar's look changes — both
              patterns together in one jar. */}
          <g transform="translate(128 84)">
            <g className="cs-pop" style={delay(mixStart)}>
              <circle className="cs-coin" cx="-8" cy="-2" r="2.6" />
              <circle className="cs-coin" cx="7" cy="4" r="2.6" />
              <path className="cs-line cs-band" d="M-11 12 Q0 10 11 12" />
            </g>
          </g>
          <ellipse className="cs-ring" cx="160" cy="140" rx="21" ry="21" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}

/* ── bubble-reaction ─────────────────────────────────────────
   Two plain substances in jars flank an empty mixing glass on
   a shop counter. Setup: the glass is empty and still — no
   bubbles, no changed look. Solved: both jars pour in, then
   bubbles rise through the mix and its look changes. */

function BubbleGlassArt() {
  return (
    <>
      <path className="cs-line" d="M-26 -40 L-22 36 Q0 42 22 36 L26 -40" />
      <path className="cs-line cs-soft" d="M-24 -14 Q0 -18 24 -14" />
    </>
  );
}

export function BubbleReactionScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "bubble-reaction" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  void description;
  const pourStart = stepDelay ? stepDelay(0) : 0.5;
  const bubbleStart = stepDelay ? stepDelay(1) : 1.4;
  const tickStart = stepDelay ? stepDelay(2) : 2.3;
  const groundY = 172;
  const counterY = 148;
  const jarArt = (bandY: number) => (
    <>
      <rect className="cs-pack" x="-15" y="-22" width="30" height="38" rx="3" />
      <path className="cs-line cs-band" d={`M-14 ${bandY} Q0 ${bandY - 2} 14 ${bandY}`} />
    </>
  );
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 30 Q160 26 296 30" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d={`M16 ${groundY} Q160 ${groundY + 4} 304 ${groundY}`} style={delay(0)} />
      {/* The shop counter. */}
      <path className="cs-line cs-draw" pathLength={1} d={`M28 ${counterY} Q160 ${counterY + 4} 292 ${counterY}`} style={delay(0.15)} />
      <path className="cs-line cs-soft cs-draw" pathLength={1} d={`M40 ${counterY} L36 ${groundY} M280 ${counterY} L284 ${groundY}`} style={delay(0.2)} />
      {/* The mixing glass, centre: empty in both phases' rest
          until the solved beat fills it. */}
      <g transform="translate(160 104)">
        <g className="cs-pop" style={delay(0.35)}>
          <BubbleGlassArt />
        </g>
      </g>
      {phase === "setup" ? (
        <>
          <g transform="translate(84 122)">
            <g className="cs-pop" style={delay(0.5)}>{jarArt(0)}</g>
          </g>
          <g transform="translate(236 122)">
            <g className="cs-pop" style={delay(0.65)}>{jarArt(-8)}</g>
          </g>
        </>
      ) : (
        <>
          {/* Step 0: both jars tip and pour into the glass. */}
          <g transform="translate(112 66) rotate(42)">
            <g className="cs-slide" style={slideFrom(-28, 56, pourStart)}>{jarArt(0)}</g>
          </g>
          <g transform="translate(208 66) rotate(-42)">
            <g className="cs-slide" style={slideFrom(28, 56, pourStart + 0.15)}>{jarArt(-8)}</g>
          </g>
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={`stream-${i}`}
              className="cs-stone cs-pop"
              cx={i < 2 ? 138 + i * 5 : 178 - (i - 2) * 5}
              cy={74 + (i % 2) * 9}
              r="2.3"
              style={delay(pourStart + 0.3 + i * 0.12)}
            />
          ))}
          {/* Step 1: bubbles rise through the mix, and a new
              band marks its changed look. */}
          <g transform="translate(160 104)">
            <path className="cs-line cs-band cs-pop" d="M-23 18 Q0 15 23 18" style={delay(bubbleStart)} />
            {[
              { x: -12, y: 22 }, { x: -4, y: 8 }, { x: 5, y: 26 }, { x: 12, y: 0 },
              { x: -9, y: -4 }, { x: 3, y: -10 }, { x: 14, y: 16 }, { x: -15, y: 10 },
            ].map((b, i) => (
              <circle
                key={`bubble-${i}`}
                className="cs-coin cs-pop"
                cx={b.x}
                cy={b.y}
                r={i % 3 === 0 ? 3.6 : 2.5}
                style={delay(bubbleStart + 0.15 + i * 0.13)}
              />
            ))}
          </g>
          <ellipse className="cs-ring" cx="160" cy="104" rx="36" ry="48" style={delay(tickStart + 0.4)} />
          <text className="cs-tick cs-tick-final" x="160" y="34" style={delay(tickStart + 0.55)}>
            ✓
          </text>
        </>
      )}
    </>
  );
}
