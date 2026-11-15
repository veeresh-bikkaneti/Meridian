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
