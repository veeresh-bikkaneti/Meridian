/**
 * clue-scene-kinds-e.tsx — the fraction clue scenes (scenes
 * wave, visual-questions spec §3.4): "fraction-slice" and
 * "fraction-fill", drawn live as ink line-art on paper, in the
 * pilot renderer's discipline (ClueScene.tsx). Each component
 * returns an SVG fragment only — the parent supplies the
 * <svg viewBox="0 0 320 190"> wrapper, the pause / still
 * handling and the Replay button.
 *
 * Answer-blind, structurally (the clue-scene-types.ts pattern):
 * a component receives ONLY its scene description (the givens
 * from the item's question) and a phase — "setup" before the
 * pick, "solved" after a correct one. It never receives the
 * answer, a choice, or a pick. These kinds model parts of ONE
 * whole — never the fair-share scene's dealt discrete snacks,
 * which would teach a wrong model (spec §3.4). The setup film
 * performs the verb's first beat only: the first cut is made,
 * the first pour begins and stops below both marks. The
 * solved beat computes its result from the givens at solve
 * time: slices separate and the taken parts fill; the bottles
 * fill to their marks and a shared twelfths grid fades in —
 * the derivation, drawn.
 *
 * Motion discipline, copied from the pilot: CSS keyframes only
 * (transform / opacity / stroke draw-on), authored so every
 * element's resting state IS the film's final frame.
 */
import type { CSSProperties } from "react";
import type { ClueSceneDescription, ClueScenePhase } from "./clue-scene-types";

const delay = (s: number): CSSProperties => ({ animationDelay: `${s.toFixed(2)}s` });
const slideFrom = (fx: number, fy: number, s: number): CSSProperties =>
  ({
    "--fx": `${fx.toFixed(1)}px`,
    "--fy": `${fy.toFixed(1)}px`,
    animationDelay: `${s.toFixed(2)}s`,
  }) as CSSProperties;

/** A wedge path for slice i of `parts`, centred at (cx, cy). */
function wedgePath(cx: number, cy: number, r: number, i: number, parts: number): string {
  const a0 = ((i * 360) / parts - 90) * (Math.PI / 180);
  const a1 = (((i + 1) * 360) / parts - 90) * (Math.PI / 180);
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = 360 / parts > 180 ? 1 : 0;
  return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}

/** The outward direction a slice separates along (its mid-angle). */
function wedgeOut(cx: number, cy: number, i: number, parts: number, dist: number) {
  const mid = (((i + 0.5) * 360) / parts - 90) * (Math.PI / 180);
  return { x: Math.cos(mid) * dist, y: Math.sin(mid) * dist, cx, cy };
}

/* ── fraction-slice ──────────────────────────────────────────
   Cut one whole into equal parts. A second whole (the
   equivalence item) is cut finer beside it; solved, the taken
   parts of both fill the same brass and their top edges align
   on one line — the same amount, drawn. Steps pace one slice
   at a time across both wholes, in order. */

export function FractionSliceScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "fraction-slice" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, slice s's beat starts at
   * stepDelay(s) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const wholes = [
    { cx: description.parts2 ? 84 : 160, cy: 96, r: description.parts2 ? 44 : 56, parts: description.parts, taken: description.taken, offset: 0 },
    ...(description.parts2
      ? [{ cx: 236, cy: 96, r: 44, parts: description.parts2, taken: description.taken2 ?? 0, offset: description.parts }]
      : []),
  ];
  const stepStart = (s: number) => (stepDelay ? stepDelay(s) : 0.35 + s * 0.6);
  const totalSteps = wholes.reduce((a, w) => a + w.parts, 0);
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 168 Q160 172 296 168" style={delay(0.1)} />
      {wholes.map((w, wi) => (
        <g key={wi}>
          <circle className="cs-line cs-draw" pathLength={1} cx={w.cx} cy={w.cy} r={w.r} style={delay(0)} />
          {/* Cut lines: setup draws the first cut only; solved
              draws them all as the slices separate. */}
          {Array.from({ length: w.parts }, (_, i) => {
            const a = ((i * 360) / w.parts - 90) * (Math.PI / 180);
            const isFirstCut = i === 0;
            if (phase === "setup" && !isFirstCut) return null;
            return (
              <path
                key={`cut-${i}`}
                className="cs-line cs-draw"
                pathLength={1}
                d={`M${w.cx} ${w.cy} L${(w.cx + w.r * Math.cos(a)).toFixed(1)} ${(w.cy + w.r * Math.sin(a)).toFixed(1)}`}
                style={delay(phase === "setup" ? 1.0 : 0.3 + i * 0.12)}
              />
            );
          })}
          {phase === "solved"
            ? Array.from({ length: w.parts }, (_, i) => {
                const out = wedgeOut(w.cx, w.cy, i, w.parts, 5);
                const takenSlice = i < w.taken;
                return (
                  <g
                    key={`wedge-${i}`}
                    transform={`translate(${out.x.toFixed(1)} ${out.y.toFixed(1)})`}
                  >
                    <g className="cs-slide" style={slideFrom(-out.x, -out.y, stepStart(w.offset + i))}>
                      <path
                        className={takenSlice ? "cs-wedge-taken" : "cs-wedge"}
                        d={wedgePath(w.cx, w.cy, w.r - 2, i, w.parts)}
                      />
                    </g>
                  </g>
                );
              })
            : null}
        </g>
      ))}
      {phase === "solved" && wholes.length === 2 ? (
        <>
          {/* The taken parts align to the same edge. */}
          <path
            className="cs-line cs-band cs-draw"
            pathLength={1}
            d="M30 52 Q160 48 290 52"
            style={delay(stepStart(totalSteps - 1) + 0.7)}
          />
          <text className="cs-tick cs-tick-final" x="160" y="26" style={delay(stepStart(totalSteps - 1) + 1.0)}>
            {`${description.taken}/${description.parts} = ${description.taken2}/${description.parts2}`}
          </text>
        </>
      ) : null}
      {phase === "solved" && wholes.length === 1 ? (
        <text className="cs-tick cs-tick-final" x="160" y="24" style={delay(stepStart(totalSteps - 1) + 0.6)}>
          {`${description.taken}/${description.parts}`}
        </text>
      ) : null}
    </>
  );
}

/* ── fraction-fill ───────────────────────────────────────────
   Fill a container to a fraction mark. Two bottles of the
   same size stand side by side, each with its mark. Setup:
   the first pour begins and stops below both marks. Solved:
   both bottles fill to their marks (steps 0 and 1), then a
   shared twelfths grid fades in over both (step 2) and the
   fuller bottle is ringed — 9 twelfths against 8, drawn. */

export function FractionFillScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "fraction-fill" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, step s's beat starts at
   * stepDelay(s) instead of the film's own stagger. Steps:
   * 0 the first fill, 1 the second fill, 2 the shared grid. */
  stepDelay?: (step: number) => number;
}) {
  const stepStart = (s: number) => (stepDelay ? stepDelay(s) : 0.35 + s * 0.95);
  const bottles = [
    { x: 78, frac: description.numerator / description.denominator, num: description.numerator, den: description.denominator },
    { x: 196, frac: description.otherNumerator / description.otherDenominator, num: description.otherNumerator, den: description.otherDenominator },
  ];
  const bw = 52;
  const bh = 104;
  const by = 44;
  const fuller = bottles[0]!.frac >= bottles[1]!.frac ? 0 : 1;
  const lcm = (description.denominator * description.otherDenominator) /
    gcd(description.denominator, description.otherDenominator);
  return (
    <>
      <path className="cs-line cs-draw" pathLength={1} d="M20 158 Q160 162 300 158" style={delay(0)} />
      {bottles.map((b, bi) => {
        const fillH = b.frac * (bh - 8);
        const setupH = bi === 0 ? (bh - 8) * 0.3 : 0;
        const shownH = phase === "setup" ? setupH : fillH;
        return (
          <g key={bi}>
            {/* The fill: rests at its phase height; in setup it
                rises only partway, below both marks. */}
            {shownH > 0 ? (
              <g className="cs-slide" style={slideFrom(0, 16, phase === "setup" ? 1.0 : stepStart(bi))}>
                <rect
                  className="cs-liquid"
                  x={b.x + 4}
                  y={(by + 4 + (bh - 8 - shownH)).toFixed(1)}
                  width={bw - 8}
                  height={shownH.toFixed(1)}
                  rx="4"
                />
              </g>
            ) : null}
            <path
              className="cs-bottle cs-draw"
              pathLength={1}
              d={`M${b.x + 10} ${by} Q${b.x + 26} ${by - 4} ${b.x + 42} ${by} Q${b.x + 50} ${by + 30} ${b.x + 48} ${by + bh - 8} Q${b.x + 26} ${by + bh + 2} ${b.x + 4} ${by + bh - 8} Q${b.x + 2} ${by + 30} ${b.x + 10} ${by} Z`}
              style={delay(0.15 + bi * 0.12)}
            />
            {/* The fraction mark on the bottle's side. */}
            <path
              className="cs-line cs-band"
              d={`M${b.x - 6} ${(by + bh - 4 - fillH).toFixed(1)} L${b.x + 2} ${(by + bh - 4 - fillH).toFixed(1)}`}
            />
            {phase === "solved" ? (
              <>
                {/* The shared grid: one line per twelfth. */}
                <g className="cs-fade" style={delay(stepStart(2))}>
                  {Array.from({ length: lcm - 1 }, (_, i) => {
                    const gy = by + 4 + ((i + 1) * (bh - 8)) / lcm;
                    return (
                      <path key={i} className="cs-line cs-soft" strokeWidth={0.8} d={`M${b.x + 5} ${gy.toFixed(1)} L${b.x + bw - 5} ${gy.toFixed(1)}`} />
                    );
                  })}
                </g>
                <text className="cs-tick" x={b.x + bw / 2} y={by + bh + 24} style={delay(stepStart(bi) + 0.6)}>
                  {`${Math.round(b.frac * lcm)}/${lcm}`}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
      {phase === "solved" ? (
        <>
          <ellipse
            className="cs-ring"
            cx={bottles[fuller]!.x + bw / 2}
            cy={by + bh / 2}
            rx={bw / 2 + 9}
            ry={bh / 2 + 8}
            style={delay(stepStart(2) + 0.5)}
          />
          <text className="cs-tick cs-tick-final" x={bottles[fuller]!.x + bw / 2} y="24" style={delay(stepStart(2) + 0.8)}>
            {`${bottles[fuller]!.num}/${bottles[fuller]!.den}`}
          </text>
        </>
      ) : null}
    </>
  );
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
