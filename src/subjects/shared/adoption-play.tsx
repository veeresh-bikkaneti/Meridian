/**
 * ADOPTION MOCK (staging only — never a PR): the INTERACTABLE
 * prototype for the coin case (owner direction, 2026-11-24 15:32
 * CST: "we want to make the question interactable… where player
 * can move things to see and play and solve" + "explanation on
 * answer should be a motion video").
 *
 * Two staging components:
 *
 * - CoinPlayScene: the clue scene made playable. Forty loose coins
 *   the player moves into groups of five — by pointer drag, or by
 *   tapping a coin (the tap sends it into the current group: the
 *   touch fallback). Each completed group locks and the running
 *   count speaks in fives (5, 10, … 40 chips). The scene honours
 *   the answer-blind scene contract: it reports ONLY progress
 *   (groups complete) and solved — never the answer, a choice, or
 *   a pick — through its callbacks. It knows the givens from the
 *   item's own question (40 coins, groups of 5), exactly what the
 *   film scene's description carries.
 *
 * - ExplanationMotion: the result band's explanation as a MOTION
 *   segment (Lane B addendum): coins slide into groups of five
 *   and the count builds 5, 10, … 40, auto-playing on mount. The
 *   text derivation stays below it as the fallback. Reduced
 *   motion lands on the still (the grouped tableau) — the house
 *   gate; Save-Data/low-memory stills are the production mirror.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

/* Deterministic scatter so the spill looks the same every mount. */
function jitter(id: number, salt: number, range: number): number {
  const v = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453;
  return Math.floor((v - Math.floor(v)) * range) - range / 2;
}

const DICE_SLOTS: Array<{ x: number; y: number }> = [
  { x: 24, y: 26 },
  { x: 76, y: 26 },
  { x: 50, y: 52 },
  { x: 24, y: 78 },
  { x: 76, y: 78 },
];

export function CoinPlayScene({
  total,
  groupSize,
  active,
  reduced,
  onProgress,
  onSolved,
}: {
  total: number;
  groupSize: number;
  active: boolean;
  reduced: boolean;
  onProgress: (groupsComplete: number) => void;
  onSolved: () => void;
}) {
  const groups = total / groupSize;
  const [placed, setPlaced] = useState<number[]>([]);
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const trayRefs = useRef<Array<HTMLDivElement | null>>([]);
  const solvedFired = useRef(false);

  const currentGroup = Math.min(Math.floor(placed.length / groupSize), groups - 1);
  const groupsComplete = Math.floor(placed.length / groupSize);
  const allDone = placed.length === total;

  useEffect(() => {
    onProgress(groupsComplete);
  }, [groupsComplete, onProgress]);

  /* The callback identity changes on every parent render; the
   * solved beat must survive the progress-report re-render that
   * lands in the same moment, so the timer keys off allDone only
   * and calls the latest callback through a ref. */
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;
  useEffect(() => {
    if (!allDone || solvedFired.current) return;
    solvedFired.current = true;
    const t = window.setTimeout(() => onSolvedRef.current(), 800);
    return () => window.clearTimeout(t);
  }, [allDone]);

  const place = (id: number) => {
    setPlaced((p) => (p.includes(id) || p.length >= total ? p : [...p, id]));
  };

  const coinAt = (group: number, slot: number): number | undefined =>
    placed[group * groupSize + slot];

  return (
    <div
      className={`wl-play${reduced ? " is-reduced" : ""}`}
      data-testid="math-coin-play"
      aria-label="Play scene: group the coins in fives"
    >
      <div className="wl-play-counts" aria-hidden="true">
        {Array.from({ length: groupsComplete }, (_, g) => (
          <span key={g} className="wl-count-chip">
            {(g + 1) * groupSize}
          </span>
        ))}
        <span className="wl-play-count-label">
          {placed.length} of {total} coins grouped
        </span>
      </div>

      <div className="wl-play-spill">
        {Array.from({ length: total }, (_, id) => {
          if (placed.includes(id)) return null;
          const col = id % 8;
          const row = Math.floor(id / 8);
          const isDragging = drag?.id === id;
          return (
            <button
              key={id}
              type="button"
              className="wl-coin"
              data-testid={`play-coin-${id}`}
              aria-label="Coin — tap or drag it into the group"
              disabled={!active}
              style={{
                left: `calc(${col * 12.5}% + ${6 + jitter(id, 1, 8)}px)`,
                top: `${row * 37 + 6 + jitter(id, 2, 7)}px`,
                zIndex: isDragging ? 30 : id,
                transform: isDragging
                  ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.12)`
                  : undefined,
              }}
              onPointerDown={(e) => {
                if (!active) return;
                try {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                } catch {
                  /* capture is a drag nicety; taps must never die here */
                }
                dragStart.current = { id, x: e.clientX, y: e.clientY, moved: false };
              }}
              onPointerMove={(e) => {
                const s = dragStart.current;
                if (!s || s.id !== id) return;
                const dx = e.clientX - s.x;
                const dy = e.clientY - s.y;
                if (Math.abs(dx) + Math.abs(dy) > 6) s.moved = true;
                if (s.moved) setDrag({ id, dx, dy });
              }}
              onPointerUp={(e) => {
                const s = dragStart.current;
                dragStart.current = null;
                setDrag(null);
                if (!s || s.id !== id || !active) return;
                if (!s.moved) {
                  place(id);
                  return;
                }
                const tray = trayRefs.current[currentGroup];
                const r = tray?.getBoundingClientRect();
                if (
                  r &&
                  e.clientX >= r.left - 14 &&
                  e.clientX <= r.right + 14 &&
                  e.clientY >= r.top - 14 &&
                  e.clientY <= r.bottom + 14
                ) {
                  place(id);
                }
              }}
              onPointerCancel={() => {
                dragStart.current = null;
                setDrag(null);
              }}
            >
              <span aria-hidden="true">★</span>
            </button>
          );
        })}
        {allDone ? (
          <p className="wl-play-done">
            {groups} groups of {groupSize} — {total}!
          </p>
        ) : null}
      </div>

      <div className="wl-play-trays">
        {Array.from({ length: groups }, (_, g) => (
          <div
            key={g}
            ref={(el) => {
              trayRefs.current[g] = el;
            }}
            data-testid={`play-tray-${g}`}
            className={`wl-tray${g === currentGroup && !allDone ? " is-current" : ""}${
              g < groupsComplete ? " is-locked" : ""
            }`}
          >
            {Array.from({ length: groupSize }, (_, s) => {
              const coin = coinAt(g, s);
              if (coin === undefined) return null;
              const pos = DICE_SLOTS[s];
              return (
                <span
                  key={s}
                  className="wl-coin wl-coin-in-tray"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  aria-hidden="true"
                >
                  <span>★</span>
                </span>
              );
            })}
            {g < groupsComplete ? (
              <span className="wl-tray-count" aria-hidden="true">
                {(g + 1) * groupSize}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* The explanation as motion: coins slide from a loose pile into
 * eight trays of five; each tray's cumulative count badge pops in
 * as its group lands. Grid space is 100 × 68; horizontal offsets
 * use cqw and vertical cqh against the segment's own box
 * (container-type: size in the staging CSS). */
export function ExplanationMotion({
  total,
  groupSize,
  reduced,
}: {
  total: number;
  groupSize: number;
  reduced: boolean;
}) {
  const groups = total / groupSize;
  const [run, setRun] = useState(0);

  const slotPos = (g: number, s: number) => {
    const col = g % 4;
    const row = Math.floor(g / 4);
    const trayX = 35 + col * 16.25;
    const trayY = row === 0 ? 5 : 52;
    const slot = DICE_SLOTS[s];
    return { x: trayX + (slot.x / 100) * 14, y: trayY + (slot.y / 100) * 40 };
  };
  const pilePos = (id: number) => ({
    x: 4 + ((id * 7) % 22) + jitter(id, 3, 4),
    y: 10 + ((id * 11) % 52) + jitter(id, 4, 5),
  });

  return (
    <div className="wl-explain" data-testid="math-explanation-motion">
      <p className="wl-explain-title">▶ Watch it — the clever way to count</p>
      <div
        className={`wl-explain-stage${reduced ? " is-still" : ""}`}
        key={run}
        aria-hidden="true"
      >
        {Array.from({ length: groups }, (_, g) => {
          const col = g % 4;
          const row = Math.floor(g / 4);
          return (
            <div
              key={g}
              className="wl-explain-tray"
              style={{
                left: `${35 + col * 16.25}%`,
                top: `${row === 0 ? 5 : 52}%`,
                width: "14%",
                height: "40%",
              }}
            />
          );
        })}
        {Array.from({ length: total }, (_, id) => {
          const g = Math.floor(id / groupSize);
          const s = id % groupSize;
          const to = slotPos(g, s);
          const from = pilePos(id);
          const delay = 0.4 + g * 0.85 + s * 0.1;
          return (
            <span
              key={id}
              className="wl-coin wl-explain-coin"
              style={
                {
                  left: `${to.x}%`,
                  top: `${to.y}%`,
                  "--fx": `${from.x - to.x}cqw`,
                  "--fy": `${(from.y - to.y) * (100 / 68)}cqh`,
                  animationDelay: `${delay}s`,
                } as CSSProperties
              }
            >
              <span>★</span>
            </span>
          );
        })}
        {Array.from({ length: groups }, (_, g) => {
          const col = g % 4;
          const row = Math.floor(g / 4);
          return (
            <span
              key={g}
              className="wl-explain-badge"
              style={{
                left: `${35 + col * 16.25 + 11}%`,
                top: `${(row === 0 ? 5 : 52) - 3}%`,
                animationDelay: `${0.4 + g * 0.85 + 0.55}s`,
              }}
            >
              {(g + 1) * groupSize}
            </span>
          );
        })}
      </div>
      {!reduced ? (
        <button
          type="button"
          className="wl-explain-replay"
          onClick={() => setRun((r) => r + 1)}
        >
          ↻ Watch it again
        </button>
      ) : null}
    </div>
  );
}
