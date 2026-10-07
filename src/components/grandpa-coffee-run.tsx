import { useCallback, useEffect, useRef, useState } from "react";
import "./grandpa-coffee-run.css";

/**
 * Grandpa's Coffee Run — animated donation scene on the Chart Room home.
 *
 * Veeresh 2026-10-07, explicit vision (park workflow rework):
 * Grandpa (elderly explorer with cane + coffee mug) strolls in from the left
 * edge at a leisurely pace, following an unrolling dotted treasure-map trail
 * toward Comet. NO thought cloud during the walk. Halfway he raises his mug
 * and a coffee kettle drops from the top of the screen in a dolly-vertigo
 * move — descending while scaling up dramatically toward the viewer — tilts,
 * pours and fills his mug (visible fill + steam burst), then rises/fades away.
 * Grandpa walks on to a little park by Comet: an SVG tree + wooden bench.
 * He sits on the bench facing the viewer, head fixed (NO pointer tracking —
 * Comet already moves its head; two tracking heads is annoying), waving/
 * cheering gently with his filled mug (periodic mug-lift invite + steam).
 * The thought cloud appears at the finale with "Help me buy coffee!".
 *
 * The key UX change: tapping grandpa OR the cloud opens the "ask a grown-up"
 * gate INSIDE THE SAME CLOUD — the cloud content swaps (animated) to the
 * confirmation workflow with inline [Continue]/[Cancel]. No separate dialog
 * box; the UI never gets crowded. Continue opens Ko-fi in a new tab and the
 * cloud reverts; Cancel/Esc reverts too. Continue is focused on open.
 *
 * Beats (JS-driven, CSS-animated):
 *  1. Walk — slow stroll (~9.5s): bob + cane tap + periodic mug sip. No cloud.
 *  2. Kettle — travel pauses at 45%, front pose fades in, mug raised; the
 *     kettle drops, pours, fills the mug, vanishes (~2.8s spectacle).
 *  3. Walk — travel resumes to the parking spot.
 *  4. Seated finale — park vignette (tree + bench) fades in; grandpa sits on
 *     the bench facing the viewer, mug raised with steam, head fixed. Every
 *     ~6s the mug-lift invite fires (the attention-grabber). The cloud opens
 *     with the donation ask; tapping it (or grandpa) swaps the cloud to the
 *     gate workflow.
 *
 * Clean-UX bar: charming, never annoying. The kettle moment is the single
 * spectacle; everything else stays calm. One slow walk per page load, then
 * the quiet park finale. Never blocks edition cards or CTAs
 * (E2E-verified at 360px).
 *
 * Hard rules (grep-verifiable):
 * - inline SVG only — no new assets, no npm packages
 * - zero imports from the audio system (no sfx.ts) — silent
 * - zero analytics calls (no gtag) — Game Designer's COPPA call stands
 * - URL from VITE_KOFI_URL build env; unset/empty → renders nothing
 * - plain window.open with noopener/noreferrer, never the router <Link>
 * - hidden while offline
 * - never gates gameplay; no perks, no tiers UI
 * - prefers-reduced-motion: static park scene — grandpa seated on the bench,
 *   cloud shown statically, no walk/kettle/gesture — the CTA stays
 *   discoverable
 */
const KOFI_URL = import.meta.env.VITE_KOFI_URL?.trim() || undefined;

// Slow stroll across the dotted path (the kettle pause freezes the
// timeline on top of this). Veeresh 2026-10-07: "he is going too fast" —
// was 5200ms, now a leisurely ~9.5s.
const WALK_MS = 9500;
// Fraction of the walk at which the kettle drops.
const KETTLE_AT = 0.45;
// Drop (~0.8s) + hover/tilt/pour (~1.2s) + rise/fade (~0.6s) + margin.
const KETTLE_HOLD_MS = 2800;

const INK = "#0c181d";
const BRASS = "#e8b64c";
const COAT = "#7a5a3a";
const COAT_DARK = "#5e4229";
const SKIN = "#f2c9a0";
const HAIR = "#f5f2ea";
const TROUSER = "#33404f";
const CANE = "#6b4a2c";
const COFFEE = "#4a2c14";
const COFFEE_SURFACE = "#5d3a1c";
const WOOD = "#8a5a34";
const PAPER = "#fffdf8";
const LEAF = "#7d8b5f";
const LEAF_DARK = "#66744c";
const TRUNK = "#6b4a2c";

// --- End of tuning constants ---

type Beat = "walking" | "kettle" | "seated";
type Cloud = "ask" | "gate";

export function GrandpaCoffeeRun() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [beat, setBeat] = useState<Beat>("walking");
  const [cloud, setCloud] = useState<Cloud>("ask");
  const walkerRef = useRef<HTMLDivElement | null>(null);
  const continueRef = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useRef(
    typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Beat machine: walking → kettle (travel paused) → walking → seated.
  useEffect(() => {
    if (reducedMotion) {
      setBeat("seated");
      return;
    }
    const walker = walkerRef.current;
    if (!walker) return;
    let resumeTimer = 0;
    const kettleTimer = window.setTimeout(() => {
      setBeat("kettle");
      resumeTimer = window.setTimeout(() => {
        // Resume travel; the travel animation's `animationend` flips to seated.
        setBeat("walking");
      }, KETTLE_HOLD_MS);
    }, WALK_MS * KETTLE_AT);
    const onArrive = (e: AnimationEvent) => {
      if (e.animationName === "grandpa-travel") setBeat("seated");
    };
    walker.addEventListener("animationend", onArrive);
    return () => {
      window.clearTimeout(kettleTimer);
      window.clearTimeout(resumeTimer);
      walker.removeEventListener("animationend", onArrive);
    };
  }, [reducedMotion]);

  const openCloudGate = useCallback(() => {
    setCloud((c) => (c === "ask" ? "gate" : c));
  }, []);

  const closeCloudGate = useCallback((refocusWalker = true) => {
    setCloud("ask");
    if (refocusWalker) walkerRef.current?.focus();
  }, []);

  const onContinue = useCallback(() => {
    window.open(KOFI_URL, "_blank", "noopener,noreferrer");
    closeCloudGate();
  }, [closeCloudGate]);

  // UX: focus lands on Continue the moment the gate opens.
  useEffect(() => {
    if (cloud === "gate") continueRef.current?.focus();
  }, [cloud]);

  const onGateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeCloudGate();
      }
    },
    [closeCloudGate],
  );

  const onWalkerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCloudGate();
      }
    },
    [openCloudGate],
  );

  if (!online) return null;
  // Fail-closed: no Ko-fi URL configured → render nothing.
  if (!KOFI_URL) return null;

  return (
    <div
      className="grandpa-scene"
      data-testid="grandpa-scene"
      data-beat={beat}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      {/* Dotted treasure-map trail unrolling beneath his feet. */}
      <div
        className="grandpa-path"
        aria-hidden="true"
        data-testid="grandpa-path"
      >
        <svg viewBox="0 0 1000 60" preserveAspectRatio="none">
          <line x1="6" y1="36" x2="868" y2="36" className="trail-dots" />
          <g className="trail-x" transform="translate(924 36)">
            <line x1="-11" y1="-11" x2="11" y2="11" />
            <line x1="11" y1="-11" x2="-11" y2="11" />
          </g>
        </svg>
      </div>

      <div
        ref={walkerRef}
        role="button"
        tabIndex={0}
        className="grandpa-walker"
        data-testid="grandpa-walker"
        onClick={openCloudGate}
        onKeyDown={onWalkerKeyDown}
        aria-label="Grandpa's coffee run. Activate to support Meridian on Ko-fi — asks a grown-up first."
      >
        {/* Park vignette — tree + bench. Paints BEHIND grandpa (DOM order),
            fades in when he sits down. Same unit scale as grandpa's SVG
            (100 units = --gw), so coordinates line up 1:1. */}
        <span
          className="park-vignette"
          aria-hidden="true"
          data-testid="grandpa-park"
        >
          <svg viewBox="-90 0 210 140" className="park-svg">
            {/* soft ground shadow under tree + bench */}
            <ellipse cx="-10" cy="136" rx="85" ry="5" fill={INK} opacity="0.12" />
            {/* tree — trunk + foliage, left of the bench */}
            <g data-testid="grandpa-tree">
              <path
                d="M-86 138 L-74 138 L-77 96 L-79 78 L-83 96 Z"
                fill={TRUNK}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M-80 100 L-92 88"
                stroke={TRUNK}
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M-80 92 L-68 80"
                stroke={TRUNK}
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle cx="-80" cy="58" r="22" fill={LEAF} stroke={INK} strokeWidth="2" />
              <circle cx="-99" cy="70" r="16" fill={LEAF} stroke={INK} strokeWidth="2" />
              <circle cx="-61" cy="70" r="16" fill={LEAF} stroke={INK} strokeWidth="2" />
              <circle cx="-80" cy="40" r="17" fill={LEAF} stroke={INK} strokeWidth="2" />
              <circle cx="-88" cy="52" r="9" fill={LEAF_DARK} opacity="0.7" />
              <circle cx="-72" cy="66" r="8" fill={LEAF_DARK} opacity="0.7" />
            </g>
            {/* bench — grandpa sits on it (seat top at Py 112 = his Gy 104).
                Backrest peeks out behind his shoulders. */}
            <g data-testid="grandpa-bench">
              <rect x="-18" y="70" width="7" height="44" fill={WOOD} stroke={INK} strokeWidth="2" />
              <rect x="41" y="70" width="7" height="44" fill={WOOD} stroke={INK} strokeWidth="2" />
              <rect x="-24" y="72" width="76" height="8" rx="3.5" fill={WOOD} stroke={INK} strokeWidth="2" />
              <rect x="-24" y="88" width="76" height="8" rx="3.5" fill={WOOD} stroke={INK} strokeWidth="2" />
              <rect x="-24" y="112" width="76" height="8" rx="3.5" fill={WOOD} stroke={INK} strokeWidth="2.5" />
              <rect x="-18" y="120" width="7" height="18" fill={WOOD} stroke={INK} strokeWidth="2" />
              <rect x="39" y="120" width="7" height="18" fill={WOOD} stroke={INK} strokeWidth="2" />
            </g>
          </svg>
        </span>

        <span className="grandpa-bob" aria-hidden="true">
          <svg viewBox="0 0 100 132" className="grandpa-svg">
            {/* ============ SIDE POSE — walking profile, facing right ============ */}
            <g className="pose pose-side">
              {/* legs, mid-stride */}
              <path
                d="M44 86 L39 116"
                stroke={TROUSER}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <ellipse cx="37" cy="118" rx="7" ry="4" fill={INK} />
              <path
                d="M56 86 L63 116"
                stroke={TROUSER}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <ellipse cx="65" cy="118" rx="7" ry="4" fill={INK} />
              {/* long explorer coat */}
              <path
                d="M36 90 L34 60 Q34 50 44 47 L58 47 Q67 50 67 60 L65 90 Q50 94 36 90 Z"
                fill={COAT}
                stroke={INK}
                strokeWidth="2.5"
              />
              <circle cx="50" cy="62" r="2" fill={BRASS} />
              <circle cx="50" cy="72" r="2" fill={BRASS} />
              {/* scarf trailing behind */}
              <path
                d="M43 51 Q34 55 29 63"
                stroke={BRASS}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M42 49 Q50 53 58 49"
                stroke={BRASS}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              {/* head in profile */}
              <circle
                cx="62"
                cy="33"
                r="13"
                fill={SKIN}
                stroke={INK}
                strokeWidth="2.5"
              />
              <path
                d="M74 32 L79 35 L74 38"
                fill={SKIN}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="66" cy="31" r="1.8" fill={INK} />
              <path
                d="M61 26 Q65 24 69 26"
                stroke={HAIR}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              {/* white side hair */}
              <circle cx="52" cy="31" r="5" fill={HAIR} />
              {/* beard tuft under chin */}
              <path
                d="M57 43 Q63 52 71 45 Q67 52 59 49 Z"
                fill={HAIR}
                stroke={INK}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* flat cap */}
              <path
                d="M49 27 Q51 17 62 17 Q71 17 73 25 L71 28 Q61 24 51 28 Z"
                fill={COAT_DARK}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M71 25 L80 27 L71 29 Z"
                fill={COAT_DARK}
                stroke={INK}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* cane in the front hand */}
              <g className="cane">
                <line
                  x1="70"
                  y1="68"
                  x2="75"
                  y2="116"
                  stroke={CANE}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                <path
                  d="M70 68 Q70 61 77 61"
                  stroke={CANE}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle
                  cx="70"
                  cy="69"
                  r="4.5"
                  fill={SKIN}
                  stroke={INK}
                  strokeWidth="2"
                />
              </g>
              {/* coffee mug in the back hand */}
              <g className="mug-arm">
                <line
                  x1="46"
                  y1="62"
                  x2="35"
                  y2="76"
                  stroke={COAT}
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <circle
                  cx="34"
                  cy="77"
                  r="4.5"
                  fill={SKIN}
                  stroke={INK}
                  strokeWidth="2"
                />
                <g className="mug">
                  <rect
                    x="22"
                    y="68"
                    width="15"
                    height="17"
                    rx="3"
                    fill={BRASS}
                    stroke={INK}
                    strokeWidth="2.5"
                  />
                  <path
                    d="M37 72 Q42 76 37 81"
                    stroke={INK}
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <ellipse cx="29.5" cy="70" rx="6" ry="2" fill={COFFEE} />
                  <path
                    className="steam steam-1"
                    d="M27 64 Q29 60 27 56"
                    stroke={INK}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                  <path
                    className="steam steam-2"
                    d="M33 64 Q31 60 33 56"
                    stroke={INK}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                </g>
              </g>
            </g>

            {/* ============ FRONT POSE — kettle beat: mug raised to be filled.
                 The mug starts EMPTY; the kettle pours and .mug-fill rises. ============ */}
            <g className="pose pose-front">
              {/* legs planted */}
              <path
                d="M42 88 L41 116"
                stroke={TROUSER}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <ellipse cx="41" cy="118" rx="7" ry="4" fill={INK} />
              <path
                d="M58 88 L59 116"
                stroke={TROUSER}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <ellipse cx="59" cy="118" rx="7" ry="4" fill={INK} />
              {/* coat, front view */}
              <path
                d="M32 90 L30 60 Q30 48 42 46 L58 46 Q70 48 70 60 L68 90 Q50 95 32 90 Z"
                fill={COAT}
                stroke={INK}
                strokeWidth="2.5"
              />
              <circle cx="50" cy="62" r="2" fill={BRASS} />
              <circle cx="50" cy="72" r="2" fill={BRASS} />
              <path
                d="M40 48 Q50 54 60 48"
                stroke={BRASS}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              {/* head, front */}
              <circle
                cx="50"
                cy="33"
                r="14"
                fill={SKIN}
                stroke={INK}
                strokeWidth="2.5"
              />
              <circle cx="44" cy="31" r="2" fill={INK} />
              <circle cx="56" cy="31" r="2" fill={INK} />
              <path
                d="M40 25 Q44 23 48 25"
                stroke={HAIR}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M52 25 Q56 23 60 25"
                stroke={HAIR}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="37" cy="33" r="5" fill={HAIR} />
              <circle cx="63" cy="33" r="5" fill={HAIR} />
              <circle cx="39" cy="37" r="3" fill="#e8a0a0" opacity="0.55" />
              <circle cx="61" cy="37" r="3" fill="#e8a0a0" opacity="0.55" />
              <path
                d="M41 40 Q50 48 59 40"
                stroke={INK}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
              {/* flat cap */}
              <path
                d="M36 26 Q38 13 50 13 Q62 13 64 26 L62 29 Q50 24 38 29 Z"
                fill={COAT_DARK}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* right arm raised high — the mug, awaiting the kettle */}
              <line
                x1="62"
                y1="58"
                x2="78"
                y2="30"
                stroke={COAT}
                strokeWidth="8"
                strokeLinecap="round"
              />
              <circle
                cx="78"
                cy="28"
                r="4.5"
                fill={SKIN}
                stroke={INK}
                strokeWidth="2"
              />
              <g transform="rotate(14 78 20)">
                <rect
                  x="70"
                  y="10"
                  width="16"
                  height="18"
                  rx="3"
                  fill={BRASS}
                  stroke={INK}
                  strokeWidth="2.5"
                />
                <path
                  d="M86 14 Q91 18 86 23"
                  stroke={INK}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <clipPath id="grandpa-mug-clip">
                  <rect x="71.5" y="11.5" width="13" height="15" rx="2" />
                </clipPath>
                <g clipPath="url(#grandpa-mug-clip)">
                  <g className="mug-fill" data-testid="grandpa-mug-fill">
                    <rect x="70" y="12" width="16" height="16" fill={COFFEE} />
                    <ellipse cx="78" cy="12" rx="7" ry="2.2" fill={COFFEE_SURFACE} />
                  </g>
                </g>
                {/* steam burst once the pour lands */}
                <path
                  className="pour-steam pour-steam-1"
                  d="M75 6 Q77 1 75 -4"
                  stroke={INK}
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  className="pour-steam pour-steam-2"
                  d="M81 6 Q79 1 81 -4"
                  stroke={INK}
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
              {/* kettle-moment sparkles */}
              <path
                className="cheers-spark"
                d="M90 8 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z"
                fill={BRASS}
                stroke={INK}
                strokeWidth="1"
              />
              <path
                className="cheers-spark cheers-spark-2"
                d="M62 4 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z"
                fill={BRASS}
                stroke={INK}
                strokeWidth="1"
              />
              {/* left arm down, cane planted */}
              <line
                x1="38"
                y1="58"
                x2="32"
                y2="80"
                stroke={COAT}
                strokeWidth="8"
                strokeLinecap="round"
              />
              <line
                x1="32"
                y1="78"
                x2="32"
                y2="116"
                stroke={CANE}
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <path
                d="M32 78 Q32 71 39 71"
                stroke={CANE}
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle
                cx="32"
                cy="79"
                r="4.5"
                fill={SKIN}
                stroke={INK}
                strokeWidth="2"
              />
            </g>

            {/* ============ SEATED POSE — the park finale: on the bench, facing
                 the viewer, head fixed, mug raised with steam + periodic
                 invite flourish. (The bench itself lives in .park-vignette.) ============ */}
            <g className="pose pose-seated">
              {/* coat, seated */}
              <path
                d="M38 104 L37 72 Q37 60 50 60 Q63 60 63 72 L62 104 Q50 108 38 104 Z"
                fill={COAT}
                stroke={INK}
                strokeWidth="2.5"
              />
              <circle cx="50" cy="76" r="2" fill={BRASS} />
              <circle cx="50" cy="86" r="2" fill={BRASS} />
              {/* shins + shoes */}
              <path d="M42 104 L41 122" stroke={TROUSER} strokeWidth="9" strokeLinecap="round" />
              <path d="M58 104 L59 122" stroke={TROUSER} strokeWidth="9" strokeLinecap="round" />
              <ellipse cx="41" cy="124" rx="7" ry="4" fill={INK} />
              <ellipse cx="59" cy="124" rx="7" ry="4" fill={INK} />
              {/* head — fixed, facing the viewer with a warm expression.
                  Veeresh 2026-10-07: no pointer tracking on grandpa; Comet
                  already moves its head and two tracking heads is annoying. */}
              <g className="grandpa-head">
                <circle cx="50" cy="40" r="13" fill={SKIN} stroke={INK} strokeWidth="2.5" />
                <ellipse cx="44.5" cy="38" rx="3.6" ry="4.2" fill={PAPER} stroke={INK} strokeWidth="1.5" />
                <ellipse cx="55.5" cy="38" rx="3.6" ry="4.2" fill={PAPER} stroke={INK} strokeWidth="1.5" />
                <g data-testid="grandpa-pupils">
                  <circle cx="44.5" cy="38.5" r="1.7" fill={INK} />
                  <circle cx="55.5" cy="38.5" r="1.7" fill={INK} />
                  <circle cx="43.9" cy="37.9" r="0.6" fill="#fff" />
                  <circle cx="54.9" cy="37.9" r="0.6" fill="#fff" />
                </g>
                <path d="M40 31 Q44.5 29 49 31" stroke={HAIR} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M51 31 Q55.5 29 60 31" stroke={HAIR} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <circle cx="39" cy="43" r="2.6" fill="#e8a0a0" opacity="0.55" />
                <circle cx="61" cy="43" r="2.6" fill="#e8a0a0" opacity="0.55" />
                <path
                  d="M41 48 Q50 62 59 48 Q55 56 50 56 Q45 56 41 48 Z"
                  fill={HAIR}
                  stroke={INK}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M45 47 Q50 50 55 47" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
                {/* flat cap */}
                <path
                  d="M37 32 Q39 20 50 20 Q61 20 63 32 L61 34 Q50 30 39 34 Z"
                  fill={COAT_DARK}
                  stroke={INK}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </g>
              {/* right arm raised — the persistent cheers, steaming mug.
                  Every ~6s the whole group does a gentle invite flourish
                  (see .seated-mug-gesture) with a fresh puff of steam. */}
              <g className="seated-mug-gesture" data-testid="grandpa-mug-gesture">
                <line x1="62" y1="68" x2="80" y2="36" stroke={COAT} strokeWidth="8" strokeLinecap="round" />
                <circle cx="80" cy="34" r="4.5" fill={SKIN} stroke={INK} strokeWidth="2" />
                <g transform="rotate(10 80 26)">
                  <rect x="72" y="16" width="16" height="18" rx="3" fill={BRASS} stroke={INK} strokeWidth="2.5" />
                  <path d="M88 20 Q93 24 88 29" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <ellipse cx="80" cy="18" rx="6.5" ry="2" fill={COFFEE} />
                  <path
                    className="steam steam-1"
                    d="M77 12 Q79 8 77 4"
                    stroke={INK}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                  <path
                    className="steam steam-2"
                    d="M83 12 Q81 8 83 4"
                    stroke={INK}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                  {/* the fresh puff — fires in sync with the invite flourish */}
                  <path
                    className="mug-puff"
                    d="M80 10 Q82 5 80 0"
                    stroke={INK}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0"
                  />
                </g>
              </g>
              {/* gentle sparkles on the raised mug */}
              <path
                className="seated-spark"
                d="M94 12 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z"
                fill={BRASS}
                stroke={INK}
                strokeWidth="1"
              />
              {/* left arm resting on his lap */}
              <line x1="38" y1="68" x2="42" y2="96" stroke={COAT} strokeWidth="8" strokeLinecap="round" />
              <circle cx="42" cy="98" r="4.5" fill={SKIN} stroke={INK} strokeWidth="2" />
              {/* cane leaning against the bench */}
              <line x1="24" y1="82" x2="18" y2="130" stroke={CANE} strokeWidth="4.5" strokeLinecap="round" />
              <path d="M24 82 Q24 75 31 75" stroke={CANE} strokeWidth="4.5" fill="none" strokeLinecap="round" />
            </g>
          </svg>

          {/* The kettle — drops from the top in a dolly-vertigo move during
              the kettle beat: descends while scaling up toward the viewer,
              tilts over the raised mug, pours, then rises/fades away. */}
          <span className="kettle-stage" aria-hidden="true" data-testid="grandpa-kettle">
            <svg viewBox="0 0 80 110" className="kettle-svg">
              {/* handle (behind the body) */}
              <path
                d="M62 32 Q79 36 75 54 Q73 64 62 62"
                stroke={CANE}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              {/* gooseneck spout: ink outline, brass inner, tip at (18, 79) */}
              <path
                d="M34 56 Q22 58 19 68 L18 78"
                stroke={INK}
                strokeWidth="11"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M34 56 Q22 58 19 68 L18 78"
                stroke={BRASS}
                strokeWidth="6.5"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse cx="18" cy="79" rx="3.5" ry="2" fill={INK} />
              {/* body */}
              <path
                d="M28 36 Q28 27 38 25 L58 25 Q68 27 68 36 L64 66 Q63 73 55 73 L41 73 Q33 73 32 66 Z"
                fill={BRASS}
                stroke={INK}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* brass band */}
              <path
                d="M29 44 L67 44"
                stroke={INK}
                strokeWidth="1.5"
                opacity="0.5"
              />
              {/* lid + knob */}
              <ellipse cx="48" cy="25" rx="11" ry="4" fill={BRASS} stroke={INK} strokeWidth="2" />
              <circle cx="48" cy="20" r="3.5" fill={INK} />
              {/* pour stream — lives only during the pour window */}
              <path
                className="kettle-stream"
                data-testid="grandpa-kettle-stream"
                d="M18 82 L18 108"
                stroke={COFFEE}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>

        {/* The mid-walk ask — visible only during the kettle beat. */}
        <span className="grandpa-cheers-text" aria-hidden="true">
          <strong>Support the Expedition</strong>
          <span>Grown-ups — help keep Meridian funded and free for kids</span>
        </span>

        {/* The cloud — the finale ask, or the in-cloud gate workflow.
            Tapping grandpa OR this cloud swaps it to the gate; the whole
            flow lives here so the UI never gets crowded. */}
        <div
          className="grandpa-donation-bubble"
          data-testid="grandpa-donation-bubble"
          data-cloud={cloud}
        >
          <div key={cloud} className="bubble-pane">
            {cloud === "ask" ? (
              <button
                type="button"
                className="bubble-ask"
                data-testid="grandpa-bubble-ask"
                onClick={(e) => {
                  e.stopPropagation();
                  openCloudGate();
                }}
                aria-label="Help me buy coffee! Activate to learn how to support Meridian."
              >
                <strong>Help me buy coffee! ☕</strong>
                <span>Grown-ups — donations keep Meridian free for kids</span>
              </button>
            ) : (
              <div
                className="bubble-gate"
                role="dialog"
                aria-label="Support Meridian on Ko-fi"
                data-testid="grandpa-cloud-gate"
                onKeyDown={onGateKeyDown}
              >
                <p className="bubble-gate-title">
                  You&rsquo;re leaving Meridian to visit Ko-fi. Ask a grown-up!
                </p>
                <p className="bubble-gate-sub">
                  Meridian is free forever — every game, every map, every mystery.
                </p>
                <div className="bubble-gate-actions">
                  <button
                    type="button"
                    ref={continueRef}
                    className="bubble-btn bubble-btn-primary"
                    data-testid="grandpa-cloud-continue"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContinue();
                    }}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="bubble-btn"
                    data-testid="grandpa-cloud-cancel"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeCloudGate();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
