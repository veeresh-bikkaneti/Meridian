import { useCallback, useEffect, useRef, useState } from "react";
import { CometGreeting } from "./comet-greeting";
import "./comet-mascot.css";

// Palette matches the Chart Room theme (sea-chart ink + brass on deep sea),
// same values as the Chart Room Crew art in characters.tsx.
const INK = "#0c181d";
const BRASS = "#e8b64c";
const PAPER = "#f0e7d2";
const BODY = "#31456f";
const BODY_LIGHT = "#4a5f92";

// 8-sector cursor math (mascot spec §5): 70px dead zone around the mascot,
// 0.12 rad of hysteresis slack around each sector boundary so the head
// doesn't jitter when the pointer sits on a boundary.
const DEAD_ZONE_PX = 70;
const HYSTERESIS_RAD = 0.12;
const SECTOR = Math.PI / 4; // 45°

// Head offsets in SVG units per sector, ordered E, SE, S, SW, W, NW, N, NE
// (atan2 in y-down screen coords: 0 = east, +90° = south). Pupils move at
// half the head offset so they stay inside the eye whites.
const HEAD_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [5, 0],
  [3.5, 3.5],
  [0, 5],
  [-3.5, 3.5],
  [-5, 0],
  [-3.5, -3.5],
  [0, -5],
  [3.5, -3.5],
];
const PUPIL_SCALE = 0.5;

const BLINK_MIN_MS = 4000;
const BLINK_MAX_MS = 7000;
const BLINK_SHUT_MS = 150;
const BOOP_WINDOW_MS = 2500; // boops inside this window count toward dizzy
const DIZZY_BOOPS = 4;

function sectorForAngle(angle: number): number {
  return ((Math.round(angle / SECTOR) % 8) + 8) % 8;
}

function angDist(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const q = matchMedia(query);
    const onChange = () => setMatches(q.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

type Eyes = "open" | "happy" | "dizzy";
type BoopState = "idle" | "booped" | "dizzy";

/**
 * Comet — the star-dragon pup hosting the Chart Room home page.
 * Inline SVG (zero external assets), transform-only animation.
 * Home page only: mounted by the edition picker, never in-game.
 */
export function CometMascot() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const finePointer = useMediaQuery("(pointer: fine)");
  // Cursor tracking is a fine-pointer, full-motion treat only.
  const tracking = finePointer && !reducedMotion;

  const [sector, setSector] = useState(-1); // -1 = neutral (dead zone)
  const [eyes, setEyes] = useState<Eyes>("open");
  const [boopState, setBoopState] = useState<BoopState>("idle");
  const [greetingOpen, setGreetingOpen] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const sectorRef = useRef(-1);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const eyesRef = useRef<Eyes>("open");
  const boopsRef = useRef<number[]>([]);
  const timersRef = useRef<number[]>([]);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);
  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  const showEyes = useCallback((next: Eyes) => {
    eyesRef.current = next;
    setEyes(next);
  }, []);

  // Cursor tracking: rAF-throttled pointermove → 8-sector head turn.
  useEffect(() => {
    if (!tracking) {
      sectorRef.current = -1;
      setSector(-1);
      return;
    }
    const onMove = (e: PointerEvent) => {
      pendingRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const p = pendingRef.current;
        const el = btnRef.current;
        if (!p || !el) return;
        const r = el.getBoundingClientRect();
        const dx = p.x - (r.left + r.width / 2);
        const dy = p.y - (r.top + r.height / 2);
        let next = -1;
        if (Math.hypot(dx, dy) >= DEAD_ZONE_PX) {
          const angle = Math.atan2(dy, dx);
          const cur = sectorRef.current;
          next =
            cur === -1 || angDist(angle, cur * SECTOR) >= SECTOR / 2 + HYSTERESIS_RAD
              ? sectorForAngle(angle)
              : cur;
        }
        if (next !== sectorRef.current) {
          sectorRef.current = next;
          setSector(next);
        }
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [tracking]);

  // Blink every 4–7s (randomized) — the cheapest "alive" signal. Skipped
  // entirely under prefers-reduced-motion (static pose, no idle).
  useEffect(() => {
    if (reducedMotion) return;
    let alive = true;
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        if (!alive) return;
        if (eyesRef.current === "open") {
          showEyes("happy");
          id = window.setTimeout(() => {
            if (!alive) return;
            if (eyesRef.current === "happy") showEyes("open");
            schedule();
          }, BLINK_SHUT_MS);
        } else {
          schedule();
        }
      }, BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS));
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [reducedMotion, showEyes]);

  // Boop: squash-and-stretch via WAAPI (300–450ms, snappy not floaty).
  // Four boops inside the window → the dizzy easter egg.
  const handleBoop = useCallback(() => {
    const el = btnRef.current;
    const now = Date.now();
    boopsRef.current = boopsRef.current.filter((t) => now - t < BOOP_WINDOW_MS);
    boopsRef.current.push(now);
    const dizzy = boopsRef.current.length >= DIZZY_BOOPS;

    if (!reducedRef.current && el && typeof el.animate === "function") {
      if (dizzy) {
        el.animate(
          [
            { transform: "rotate(0deg)" },
            { transform: "rotate(9deg)", offset: 0.25 },
            { transform: "rotate(-7deg)", offset: 0.55 },
            { transform: "rotate(4deg)", offset: 0.8 },
            { transform: "rotate(0deg)" },
          ],
          { duration: 700, easing: "ease-in-out" },
        );
      } else {
        el.animate(
          [
            { transform: "scale(1, 1)" },
            { transform: "scale(1.14, 0.82)", offset: 0.35 },
            { transform: "scale(0.94, 1.1)", offset: 0.7 },
            { transform: "scale(1, 1)" },
          ],
          { duration: 420, easing: "ease-out" },
        );
      }
    }

    if (dizzy) {
      boopsRef.current = [];
      showEyes("dizzy");
      setBoopState("dizzy");
      later(() => {
        showEyes("open");
        setBoopState("idle");
      }, 1400);
    } else {
      showEyes("happy");
      setBoopState("booped");
      later(() => {
        // Don't clobber a dizzy that started after this boop.
        if (eyesRef.current === "happy") showEyes("open");
        setBoopState((s) => (s === "booped" ? "idle" : s));
      }, 800);
    }
  }, [later, showEyes]);

  const [hx, hy] = sector === -1 ? [0, 0] : HEAD_OFFSETS[sector];
  const px = hx * PUPIL_SCALE;
  const py = hy * PUPIL_SCALE;

  return (
    <div
      className="comet-wrap"
      data-greeting={greetingOpen ? "open" : "closed"}
      data-testid="comet-wrap"
    >
      <CometGreeting onOpenChange={setGreetingOpen} />
      <button
        ref={btnRef}
        type="button"
        className="comet-mascot"
        data-testid="comet-mascot"
        data-state={boopState}
        data-tracking={tracking ? "on" : "off"}
        aria-label="Comet the star-dragon pup. Activate to boop."
        onClick={handleBoop}
      >
        <svg
          className="comet-svg"
          data-eyes={eyes}
          viewBox="0 0 120 120"
          aria-hidden="true"
          focusable="false"
        >
          {/* dotted star trail */}
          <circle cx="12" cy="94" r="1.8" fill={BRASS} />
          <circle cx="20" cy="100" r="1.4" fill={PAPER} />
          <circle cx="6" cy="103" r="1.4" fill={PAPER} />
          {/* sparkling tail */}
          <path d="M86 92 Q102 90 106 74 Q98 82 86 82 Z" fill={BODY} stroke={INK} strokeWidth="2.5" />
          <polygon
            className="comet-tail-star"
            points="100,62 101.6,66.4 106,68 101.6,69.6 100,74 98.4,69.6 94,68 98.4,66.4"
            fill="#ffe9a8"
            stroke={INK}
            strokeWidth="1"
          />
          <circle cx="110" cy="60" r="1.6" fill={BRASS} />
          {/* stubby wings */}
          <ellipse
            cx="30" cy="64" rx="10" ry="16" fill={BODY_LIGHT} stroke={INK} strokeWidth="2.5"
            transform="rotate(24 30 64)"
          />
          <ellipse
            cx="90" cy="64" rx="10" ry="16" fill={BODY_LIGHT} stroke={INK} strokeWidth="2.5"
            transform="rotate(-24 90 64)"
          />
          {/* chubby midnight-blue body */}
          <ellipse cx="60" cy="80" rx="30" ry="28" fill={BODY} />
          <ellipse cx="60" cy="80" rx="30" ry="28" fill="none" stroke={INK} strokeWidth="3" />
          <ellipse cx="60" cy="90" rx="17" ry="14" fill={BODY_LIGHT} opacity="0.9" />
          {/* head — translates toward the cursor when tracking */}
          <g className="comet-head" style={{ transform: `translate(${hx}px, ${hy}px)` }}>
            <circle cx="60" cy="46" r="19" fill={BODY} stroke={INK} strokeWidth="3" />
            {/* brass head spikes */}
            <polygon points="46,31 50,22 54,31" fill={BRASS} stroke={INK} strokeWidth="1.5" />
            <polygon points="66,31 70,22 74,31" fill={BRASS} stroke={INK} strokeWidth="1.5" />
            {/* open tracking eyes */}
            <g className="comet-eyes-open">
              <ellipse cx="51" cy="43" rx="5.5" ry="6.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
              <ellipse cx="69" cy="43" rx="5.5" ry="6.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
              <g data-testid="comet-pupils" style={{ transform: `translate(${px}px, ${py}px)` }}>
                <circle cx="51" cy="43" r="2.4" fill={INK} />
                <circle cx="69" cy="43" r="2.4" fill={INK} />
                <circle cx="50.2" cy="42.2" r="0.9" fill="#fffdf8" />
                <circle cx="68.2" cy="42.2" r="0.9" fill="#fffdf8" />
              </g>
            </g>
            {/* happy closed eyes — blink + boop */}
            <g className="comet-eyes-happy">
              <path d="M45 42 Q48 39 51 42" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M69 42 Q72 39 75 42" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
            {/* dizzy X eyes — the 4-boop easter egg */}
            <g className="comet-eyes-dizzy">
              <path d="M47 40 L55 46 M55 40 L47 46" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
              <path d="M65 40 L73 46 M73 40 L65 46" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
            </g>
            {/* round snout */}
            <ellipse cx="60" cy="52" rx="11" ry="8.5" fill={BODY_LIGHT} />
            <circle cx="56" cy="51" r="1.8" fill={INK} />
            <circle cx="64" cy="51" r="1.8" fill={INK} />
            <path d="M55 57 Q60 60 65 57" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      </button>
    </div>
  );
}
