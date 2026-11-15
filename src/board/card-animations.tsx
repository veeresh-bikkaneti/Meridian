/**
 * Board v3 — the card animation family (spec §4).
 *
 * One family, in the homepage cards' language: the scenes are the
 * owner-seen mockup's, recoloured to the home-v5 palette (parchment,
 * ink, brass-brown, forest, sage — the values in home-v5.css). Every
 * loop is 3–5 s, one action + a satisfying end pose, 1 s hold.
 *
 * Motion budget (§4, enforced here, not hoped for): a shared registry
 * lets at most 1 window move on phones / 2 on desktop; every other
 * window shows its END POSE (the solved sum, the planted flag) — the
 * same still that Calm mode and prefers-reduced-motion show. A story
 * banner exists only while its card is open, so it is always the
 * focused one. Animation never carries information: title, promise
 * and status are real text beside the window.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { AnimKind } from "./status-core.ts";

/* ---------------- motion budget registry ---------------- */

const registry = new Set<HTMLElement>();
let observer: IntersectionObserver | null = null;

function budget(): number {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches ? 1 : 2;
}

function refresh() {
  const visible = [...registry].filter((el) => el.dataset.v3Visible === "1");
  const limit = budget();
  visible.forEach((el, i) => {
    el.classList.toggle("v3-playing", i < limit);
  });
}

function register(el: HTMLElement): () => void {
  registry.add(el);
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          (e.target as HTMLElement).dataset.v3Visible = e.isIntersecting ? "1" : "0";
        }
        refresh();
      },
      { threshold: 0.35 },
    );
  }
  observer.observe(el);
  return () => {
    registry.delete(el);
    observer?.unobserve(el);
    refresh();
  };
}

/* ---------------- the scenes (hv5 palette) ---------------- */

const INK = "#33302a";
const SOFT = "#5c564a";
const BRASS = "#8a6d2f";
const GOLD = "#b8932f";
const FOREST = "#33503f";
const SAGE = "#8fa382";
const CARD = "#fdfbf3";
const PARCH = "#f6f1e3";
const STAMP = "#b3543f";

const SCENES: Record<AnimKind, { label: string; svg: ReactNode }> = {
  sum: {
    label: "A sum being solved: 12 divided by 3 equals 4",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A sum being solved: 12 divided by 3 equals 4">
        <rect x="14" y="12" width="332" height="178" rx="12" fill={FOREST} stroke={BRASS} strokeWidth="3" />
        <text x="40" y="72" fontFamily="Georgia,serif" fontSize="42" fill={PARCH}>12 ÷ 3 = </text>
        <text className="sum-q" x="252" y="72" fontFamily="Georgia,serif" fontSize="42" fill={GOLD}>?</text>
        <text className="sum-a" x="252" y="72" fontFamily="Georgia,serif" fontSize="42" fill={GOLD}>4</text>
        <path className="sum-tick" d="M292 44 l10 12 l20 -26" fill="none" stroke={SAGE} strokeWidth="6" strokeLinecap="round" />
        <g className="sum-dots-scattered" fill={PARCH}>
          <circle cx="70" cy="112" r="8" /><circle cx="118" cy="100" r="8" /><circle cx="168" cy="116" r="8" /><circle cx="216" cy="102" r="8" />
          <circle cx="92" cy="146" r="8" /><circle cx="142" cy="156" r="8" /><circle cx="196" cy="148" r="8" /><circle cx="248" cy="158" r="8" />
          <circle cx="66" cy="168" r="8" /><circle cx="272" cy="118" r="8" /><circle cx="300" cy="150" r="8" /><circle cx="238" cy="128" r="8" />
        </g>
        <g className="sum-dots-grouped" fill={GOLD}>
          <circle cx="66" cy="118" r="8" /><circle cx="92" cy="118" r="8" /><circle cx="79" cy="142" r="8" />
          <circle cx="140" cy="118" r="8" /><circle cx="166" cy="118" r="8" /><circle cx="153" cy="142" r="8" />
          <circle cx="214" cy="118" r="8" /><circle cx="240" cy="118" r="8" /><circle cx="227" cy="142" r="8" />
          <circle cx="288" cy="118" r="8" /><circle cx="314" cy="118" r="8" /><circle cx="301" cy="142" r="8" />
        </g>
        <g className="sum-groups-circles" fill="none" stroke={SAGE} strokeWidth="2.5">
          <ellipse cx="79" cy="128" rx="30" ry="26" /><ellipse cx="153" cy="128" rx="30" ry="26" />
          <ellipse cx="227" cy="128" rx="30" ry="26" /><ellipse cx="301" cy="128" rx="30" ry="26" />
        </g>
      </svg>
    ),
  },
  pin: {
    label: "A pin dropping onto a map of capitals",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A pin dropping onto a map of capitals">
        <path className="pin-coast" d="M8 150 C 60 120, 74 150, 120 128 S 210 84, 262 108 S 336 128, 354 96" fill="none" stroke={FOREST} strokeWidth="4" strokeLinecap="round" />
        <path className="pin-trail" d="M196 138 C 240 160, 300 168, 350 158" fill="none" stroke={BRASS} strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" />
        <path className="pin-star" d="M186 118 l6.2 12.6 13.9 2 -10 9.8 2.4 13.7 -12.5 -6.6 -12.5 6.6 2.4 -13.7 -10 -9.8 13.9 -2 Z" stroke={BRASS} strokeWidth="2.5" fill="transparent" />
        <g className="pin-drop">
          <path d="M110 34 c-16 0 -26 10 -26 23 c0 17 26 39 26 39 s26 -22 26 -39 c0 -13 -10 -23 -26 -23 Z" fill={STAMP} />
          <circle cx="110" cy="57" r="9.5" fill={CARD} />
        </g>
        <g className="pin-flag">
          <rect x="212" y="96" width="4" height="34" fill={INK} />
          <path d="M216 96 l20 7 l-20 7 Z" fill={BRASS} />
        </g>
      </svg>
    ),
  },
  magnifier: {
    label: "A magnifier sweeping across a clue card",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A magnifier sweeping across a clue card">
        <rect x="34" y="34" width="292" height="134" rx="12" fill={CARD} stroke={BRASS} strokeWidth="2" />
        <path d="M58 74 h180 M58 102 h220 M58 130 h150" stroke={SAGE} strokeWidth="7" strokeLinecap="round" opacity=".7" />
        <path className="mag-secret" d="M238 118 l5 10.4 11.5 1.7 -8.3 8.1 2 11.4 -10.2 -5.4 -10.2 5.4 2 -11.4 -8.3 -8.1 11.5 -1.7 Z" fill={GOLD} />
        <g className="mag-glass">
          <circle cx="96" cy="100" r="37" fill="rgba(51,80,63,.12)" stroke={BRASS} strokeWidth="5" />
          <path d="M124 128 L168 172" stroke={BRASS} strokeWidth="11" strokeLinecap="round" />
        </g>
      </svg>
    ),
  },
  compass: {
    label: "A compass finding the way",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A compass finding the way">
        <circle cx="180" cy="101" r="72" fill={CARD} stroke={BRASS} strokeWidth="3" />
        <circle cx="180" cy="101" r="56" fill="none" stroke={SAGE} strokeWidth="1.5" />
        <text x="180" y="44" textAnchor="middle" fontFamily="Georgia,serif" fontSize="19" fill={BRASS}>N</text>
        <g className="compass-needle">
          <path d="M180 52 L192 101 L180 150 L168 101 Z" fill={STAMP} />
          <path d="M180 52 L192 101 L168 101 Z" fill={INK} opacity=".8" />
        </g>
        <circle cx="180" cy="101" r="8" fill={BRASS} />
      </svg>
    ),
  },
  river: {
    label: "A river flowing through the land",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A river flowing through the land">
        <path d="M8 96 C 70 60, 120 128, 190 84 S 300 40, 352 74" fill="none" stroke="#b9c8bb" strokeWidth="26" strokeLinecap="round" />
        <path className="river-flow" d="M8 96 C 70 60, 120 128, 190 84 S 300 40, 352 74" fill="none" stroke={FOREST} strokeWidth="5" strokeLinecap="round" />
        <circle className="river-dot" r="8" fill={GOLD} />
        <circle cx="66" cy="40" r="5" fill={SAGE} /><circle cx="300" cy="150" r="5" fill={SAGE} /><circle cx="238" cy="34" r="5" fill={SAGE} />
      </svg>
    ),
  },
  flask: {
    label: "A flask bubbling in the science lab",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A flask bubbling in the science lab">
        <path d="M158 30 h44 M168 30 v44 l-34 62 a14 14 0 0 0 12 21 h68 a14 14 0 0 0 12 -21 l-34 -62 v-44" fill="rgba(51,80,63,.10)" stroke={SOFT} strokeWidth="3.5" />
        <path d="M141 118 h78 l7 18 a14 14 0 0 1 -12 21 h-68 a14 14 0 0 1 -12 -21 Z" fill={FOREST} opacity=".55" />
        <circle className="flask-bub" cx="166" cy="140" r="6" fill={CARD} />
        <circle className="flask-bub b2" cx="184" cy="146" r="4.5" fill={CARD} />
        <circle className="flask-bub b3" cx="196" cy="138" r="5.5" fill={CARD} />
        <path d="M256 60 l4.5 9.5 10.5 1.5 -7.6 7.4 1.8 10.4 -9.2 -4.9 -9.2 4.9 1.8 -10.4 -7.6 -7.4 10.5 -1.5 Z" fill={GOLD} />
      </svg>
    ),
  },
  book: {
    label: "A journal whose pages keep turning",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A journal whose pages keep turning">
        <path d="M110 42 C 140 28, 168 34, 180 46 V 160 C 168 148, 140 142, 110 156 Z" fill={CARD} stroke={BRASS} strokeWidth="2.5" />
        <path d="M250 42 C 220 28, 192 34, 180 46 V 160 C 192 148, 220 142, 250 156 Z" fill={CARD} stroke={BRASS} strokeWidth="2.5" />
        <path className="book-page" d="M180 46 C 192 34, 220 28, 250 42 V 156 C 220 142, 192 148, 180 160 Z" fill="rgba(184,147,47,.25)" stroke={BRASS} strokeWidth="1.5" />
        <path d="M126 66 C 146 58, 160 60, 168 66 M126 88 C 146 80, 160 82, 168 88 M126 110 C 146 102, 160 104, 168 110" stroke={SAGE} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8" />
      </svg>
    ),
  },
  mic: {
    label: "A microphone with one clear voice",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A microphone with one clear voice">
        <rect x="164" y="34" width="32" height="62" rx="16" fill={BRASS} />
        <path d="M138 84 a42 42 0 0 0 84 0 M180 126 v26 M156 168 h48" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path className="mic-arc" d="M238 62 a52 52 0 0 1 0 62" fill="none" stroke={FOREST} strokeWidth="6" strokeLinecap="round" />
        <path className="mic-arc a2" d="M262 48 a76 76 0 0 1 0 90" fill="none" stroke={FOREST} strokeWidth="6" strokeLinecap="round" />
        <path className="mic-arc a3" d="M286 34 a100 100 0 0 1 0 118" fill="none" stroke={FOREST} strokeWidth="6" strokeLinecap="round" />
      </svg>
    ),
  },
  gear: {
    label: "The gears behind the scenes",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="The gears behind the scenes">
        <g className="gear-spin">
          <path d="M180 52 l7 14 15 -6 2 16 16 2 -6 15 14 7 -14 7 6 15 -16 2 -2 16 -15 -6 -7 14 -7 -14 -15 6 -2 -16 -16 -2 6 -15 -14 -7 14 -7 -6 -15 16 -2 2 -16 15 6 Z" fill="rgba(138,109,47,.18)" stroke={BRASS} strokeWidth="3" />
          <circle cx="180" cy="101" r="17" fill={CARD} stroke={BRASS} strokeWidth="3" />
        </g>
        <circle cx="86" cy="150" r="17" fill="rgba(51,80,63,.15)" stroke={FOREST} strokeWidth="3" />
        <circle cx="282" cy="52" r="13" fill="rgba(143,163,130,.25)" stroke={SAGE} strokeWidth="3" />
      </svg>
    ),
  },
  star: {
    label: "A card lighting up with a new idea",
    svg: (
      <svg viewBox="0 0 360 202" role="img" aria-label="A card lighting up with a new idea">
        <rect x="86" y="30" width="188" height="142" rx="14" fill={CARD} stroke={BRASS} strokeWidth="2.5" />
        <path className="star-pop" d="M180 56 l11.5 23.4 25.8 3.7 -18.7 18.2 4.4 25.7 -23 -12.1 -23 12.1 4.4 -25.7 -18.7 -18.2 25.8 -3.7 Z" fill={GOLD} />
        <path d="M112 150 h136" stroke={SAGE} strokeWidth="6" strokeLinecap="round" opacity=".7" />
      </svg>
    ),
  },
};

/** The 16:9 feature-card animation window. */
export function AnimWindow({ kind }: { kind: AnimKind }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) return register(ref.current);
  }, []);
  return (
    <div className="v3-anim-window" ref={ref} data-anim={kind}>
      {SCENES[kind].svg}
    </div>
  );
}

/** The smaller story-card banner: a light travelling the rail. */
export function StoryBanner() {
  return (
    <div className="v3-story-banner" aria-hidden="true">
      <svg viewBox="0 0 300 64" preserveAspectRatio="none">
        <path d="M6 44 C 70 22, 140 54, 210 34 S 280 26, 296 36" fill="none" stroke="rgba(138,109,47,.4)" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <circle className="sc-travel" cx="8" cy="40" r="6" fill={BRASS} />
      </svg>
    </div>
  );
}
