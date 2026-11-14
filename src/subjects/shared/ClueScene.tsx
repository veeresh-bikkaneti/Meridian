/**
 * ClueScene — a short film for a subject case's clue, drawn live
 * in the browser as ink line-art on paper (feat/clue-scene-pilot).
 * It sits above the text clue, which stays as the readable
 * fallback and caption; no new screen, no video file, no sound.
 *
 * Answer-blind, structurally (the subject-host-props.ts pattern):
 * this component receives ONLY a scene description (the givens
 * from the item's question, in data next to the answers) and a
 * phase — "setup" before the pick, "solved" after a correct one.
 * It never receives the answer, a choice, or a pick. The setup
 * film sets the scene only; the solved beat computes its grouping
 * from the givens at solve time, the derivation the result card
 * prints a moment later.
 *
 * Motion discipline: CSS keyframes only (transform / opacity /
 * stroke draw-on), authored so every element's resting state IS
 * the film's final frame. The film plays once, then rests; a
 * Replay button runs it again. Animations pause while the scene
 * is off screen or the tab is hidden (IntersectionObserver +
 * visibilitychange, the GkGlobeOverlay rule). Under reduced
 * motion the parent passes reduced and the scene renders the
 * still frame of the current phase — no animation at all.
 *
 * The drawing discipline owes to the line-art-animation library
 * (MIT; see clue-scene-easing.ts): lines curve, nothing is
 * ruler-straight, and a seeded layout keeps the scatter identical
 * on every load. Its imperative DOM builders were not copied —
 * this tree renders SVG declaratively.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  countingTicks,
  dealOrder,
  type ClueSceneDescription,
  type ClueScenePhase,
} from "./clue-scene-types";
import { seeded } from "./clue-scene-easing";

export type { ClueScenePhase };

const delay = (s: number): CSSProperties => ({ animationDelay: `${s.toFixed(2)}s` });
const slideFrom = (fx: number, fy: number, s: number): CSSProperties =>
  ({
    "--fx": `${fx.toFixed(1)}px`,
    "--fy": `${fy.toFixed(1)}px`,
    animationDelay: `${s.toFixed(2)}s`,
  }) as CSSProperties;

/** The loose pile the coin scene opens with (seeded: same every load). */
function coinPile(total: number): { x: number; y: number }[] {
  const rnd = seeded(7);
  const pile: { x: number; y: number }[] = [];
  for (let i = 0; i < total; i++) {
    pile.push({ x: 52 + rnd() * 216, y: 100 + rnd() * 24 });
  }
  return pile;
}

/** Slot offsets inside one coin group (a centre coin, the rest ringed). */
function groupSlot(slot: number, groupSize: number): { x: number; y: number } {
  if (slot === 0 || groupSize === 1) return { x: 0, y: 0 };
  const angle = ((slot - 1) / (groupSize - 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * 12, y: Math.sin(angle) * 11 };
}

function CoinGroupsScene({
  description,
  phase,
}: {
  description: Extract<ClueSceneDescription, { kind: "coin-groups" }>;
  phase: ClueScenePhase;
}) {
  const pile = coinPile(description.total);
  const ticks = countingTicks(description);
  const groups = description.total / description.groupSize;
  const cols = Math.max(2, Math.ceil(Math.sqrt(groups * 1.8)));
  const groupCentre = (g: number) => ({
    x: 52 + (g % cols) * (216 / (cols - 1)),
    y: g < cols ? 58 : 116,
  });
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 92 Q160 86 296 92" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 140 Q160 145 304 140" style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d="M44 140 L40 166 M276 140 L280 166" style={delay(0.25)} />
      {phase === "setup"
        ? pile.map((p, i) => (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
              <g className="cs-pop" style={delay(0.5 + i * 0.055)}>
                <circle className="cs-coin" r="8.5" />
                <circle className="cs-coin-inner" r="4.4" />
              </g>
            </g>
          ))
        : pile.map((start, i) => {
            const g = Math.floor(i / description.groupSize);
            const slot = i % description.groupSize;
            const c = groupCentre(g);
            const off = groupSlot(slot, description.groupSize);
            const fin = { x: c.x + off.x, y: c.y + off.y };
            return (
              <g key={i} transform={`translate(${fin.x.toFixed(1)} ${fin.y.toFixed(1)})`}>
                <g
                  className="cs-slide"
                  style={slideFrom(start.x - fin.x, start.y - fin.y, 0.3 + g * 0.55 + slot * 0.07)}
                >
                  <circle className="cs-coin" r="8.5" />
                  <circle className="cs-coin-inner" r="4.4" />
                </g>
              </g>
            );
          })}
      {phase === "solved" ? (
        <>
          {Array.from({ length: groups }, (_, g) => {
            const c = groupCentre(g);
            return (
              <ellipse
                key={`ring-${g}`}
                className="cs-ring"
                cx={c.x}
                cy={c.y}
                rx="25"
                ry="22"
                style={delay(0.3 + g * 0.55 + description.groupSize * 0.07 + 0.65)}
              />
            );
          })}
          {ticks.map((t, ti) => (
            <text
              key={`tick-${t}`}
              className={`cs-tick${ti === ticks.length - 1 ? " cs-tick-final" : ""}`}
              x={30 + ti * (260 / Math.max(ticks.length - 1, 1))}
              y="24"
              style={delay(0.3 + ti * 0.55 + description.groupSize * 0.07 + 0.8)}
            >
              {t}
            </text>
          ))}
        </>
      ) : null}
    </>
  );
}

function PencilPacksScene({
  description,
  phase,
}: {
  description: Extract<ClueSceneDescription, { kind: "pencil-packs" }>;
  phase: ClueScenePhase;
}) {
  const ticks = countingTicks(description);
  const packX = (g: number) => 38 + g * 36;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 184 Q160 187 304 184" style={delay(0.15)} />
      {Array.from({ length: description.packs }, (_, g) => (
        <g key={`pack-${g}`} transform={`translate(${packX(g)} 88)`}>
          <g className="cs-pop" style={delay(0.35 + g * 0.13)}>
            <rect className="cs-pack" x="0" y="0" width="28" height="58" rx="3" />
            <path className="cs-line cs-band" d="M1 40 Q14 42 27 40" />
            {phase === "setup" ? (
              <g className="cs-fade" style={delay(0.7 + g * 0.13)}>
                {Array.from({ length: description.perPack }, (_, s) => {
                  const tx = 4 + s * 5.6;
                  return (
                    <path
                      key={s}
                      className="cs-tip"
                      d={`M${tx.toFixed(1)} 1 L${(tx + 2.4).toFixed(1)} -9 L${(tx + 4.8).toFixed(1)} 1 Z`}
                    />
                  );
                })}
              </g>
            ) : (
              <path className="cs-line" d="M2 2 Q14 -5 26 2" />
            )}
          </g>
        </g>
      ))}
      {phase === "solved"
        ? Array.from({ length: description.packs }, (_, g) =>
            Array.from({ length: description.perPack }, (_, s) => {
              const x = packX(g) + 4 + s * 6.2;
              return (
                <g key={`pencil-${g}-${s}`} transform={`translate(${x.toFixed(1)} 165)`}>
                  <g className="cs-pop" style={delay(0.4 + g * 0.6 + s * 0.05)}>
                    <path className="cs-tip" d="M0 0 L4.6 0 L2.3 -6 Z" />
                    <rect className="cs-pencil" x="0" y="0" width="4.6" height="19" />
                  </g>
                </g>
              );
            }),
          )
        : null}
      {phase === "solved"
        ? ticks.map((t, ti) => (
            <text
              key={`tick-${t}`}
              className={`cs-tick${ti === ticks.length - 1 ? " cs-tick-final" : ""}`}
              x={packX(ti) + 14}
              y="26"
              style={delay(0.4 + ti * 0.6 + 0.35)}
            >
              {t}
            </text>
          ))
        : null}
    </>
  );
}

const FRIEND_X = [48, 122, 198, 272];
const SNACK_STACK = [
  { x: -8, y: 0 },
  { x: 8, y: 0 },
  { x: 0, y: -7 },
  { x: -4, y: -1 },
];

function snackPile(total: number): { x: number; y: number }[] {
  const rows = [
    { y: 72, xs: [-20, -7, 6, 19] },
    { y: 81, xs: [-26, -13, 0, 13, 26] },
    { y: 89, xs: [-14, 0, 14] },
  ];
  const pile: { x: number; y: number }[] = [];
  for (const row of rows) {
    for (const dx of row.xs) pile.push({ x: 160 + dx, y: row.y });
  }
  return pile.slice(0, total);
}

function SnackArt() {
  return (
    <>
      <circle className="cs-snack" r="6" />
      <circle className="cs-snack-dot" cx="-2" cy="-1.5" r="1" />
      <circle className="cs-snack-dot" cx="2.2" cy="1" r="1" />
      <circle className="cs-snack-dot" cx="-0.5" cy="2.6" r="1" />
    </>
  );
}

function FairShareScene({
  description,
  phase,
}: {
  description: Extract<ClueSceneDescription, { kind: "fair-share" }>;
  phase: ClueScenePhase;
}) {
  const pile = snackPile(description.total);
  const order = dealOrder(description);
  const cheerDelay = 0.35 + description.total * 0.42 + 0.25;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 38 Q160 34 296 38" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M14 152 Q160 156 306 152" style={delay(0)} />
      {/* The snack stand at the back of the table. */}
      <ellipse className="cs-line cs-draw" pathLength={1} cx="160" cy="94" rx="54" ry="10" style={delay(0.2)} />
      <path className="cs-line cs-draw" pathLength={1} d="M160 104 L160 122 M146 124 Q160 121 174 124" style={delay(0.3)} />
      {/* Friends, with an empty plate each. */}
      {FRIEND_X.slice(0, description.friends).map((fx, fi) => (
        <g key={`friend-${fi}`}>
          <g className={phase === "solved" ? "cs-cheer" : undefined} style={phase === "solved" ? delay(cheerDelay) : undefined}>
            <circle className="cs-line cs-draw" pathLength={1} cx={fx} cy="58" r="11" style={delay(0.3 + fi * 0.15)} />
            <path
              className="cs-line cs-draw"
              pathLength={1}
              d={`M${fx - 4} 60 Q${fx} 64 ${fx + 4} 60`}
              style={delay(0.55 + fi * 0.15)}
            />
            <path
              className="cs-line cs-draw"
              pathLength={1}
              d={`M${fx - 17} 94 Q${fx} 76 ${fx + 17} 94`}
              style={delay(0.4 + fi * 0.15)}
            />
          </g>
          <ellipse
            className="cs-line cs-draw"
            pathLength={1}
            cx={fx}
            cy="140"
            rx="21"
            ry="5.5"
            style={delay(0.45 + fi * 0.15)}
          />
        </g>
      ))}
      {phase === "setup"
        ? pile.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`}>
              <g className="cs-pop" style={delay(0.6 + i * 0.06)}>
                <SnackArt />
              </g>
            </g>
          ))
        : pile.map((p, i) => {
            const friend = order[i] ?? 0;
            const round = Math.floor(i / description.friends);
            const off = SNACK_STACK[round % SNACK_STACK.length] ?? { x: 0, y: 0 };
            const fin = { x: (FRIEND_X[friend] ?? 160) + off.x, y: 131 + off.y };
            return (
              <g key={i} transform={`translate(${fin.x} ${fin.y})`}>
                <g className="cs-deal" style={slideFrom(p.x - fin.x, p.y - fin.y, 0.35 + i * 0.42)}>
                  <SnackArt />
                </g>
              </g>
            );
          })}
    </>
  );
}

export function ClueScene({
  description,
  phase,
  reduced,
}: {
  description: ClueSceneDescription;
  phase: ClueScenePhase;
  reduced: boolean;
}) {
  const [runKey, setRunKey] = useState(0);
  const [offScreen, setOffScreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // A phase change (the correct pick lands) starts the new beat.
  useEffect(() => {
    setRunKey((k) => k + 1);
  }, [phase]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOffScreen(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(root);
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const label = phase === "setup" ? description.labelSetup : description.labelSolved;

  return (
    <div
      ref={rootRef}
      className="clue-scene mode-card"
      data-testid="clue-scene"
      data-phase={phase}
      data-paused={offScreen || tabHidden ? "true" : undefined}
      data-still={reduced ? "true" : undefined}
    >
      <svg key={runKey} viewBox="0 0 320 190" role="img" aria-label={label}>
        {description.kind === "coin-groups" ? (
          <CoinGroupsScene description={description} phase={phase} />
        ) : description.kind === "pencil-packs" ? (
          <PencilPacksScene description={description} phase={phase} />
        ) : (
          <FairShareScene description={description} phase={phase} />
        )}
      </svg>
      {!reduced ? (
        <button type="button" className="clue-scene-replay" onClick={() => setRunKey((k) => k + 1)}>
          ↻ Replay the film
        </button>
      ) : null}
    </div>
  );
}
