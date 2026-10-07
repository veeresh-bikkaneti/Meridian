import { useCallback, useEffect, useRef, useState } from "react";
import "./grandpa-coffee-run.css";
import { SupportGateDialog } from "./support-gate-dialog";

/**
 * Grandpa's Coffee Run — animated donation scene on the Chart Room home.
 *
 * Veeresh 2026-10-07, explicit vision, replacing PR #91's static sign:
 * Grandpa (elderly explorer with cane + coffee mug) walks in from the left
 * edge, following an unrolling dotted treasure-map trail toward Comet.
 * Halfway he stops, turns to the viewer, and raises his mug in a "cheers"
 * toast — that's the ask. Then he parks by Comet and idles, thought cloud
 * (coffee refill) floating overhead. Tapping him opens the "ask a grown-up"
 * gate to Ko-fi.
 *
 * Four beats (JS-driven, CSS-animated):
 *  1. Entrance — walker slides in from off-screen left; dotted path unrolls.
 *  2. Walk — bob + cane tap + periodic mug sip, cloud tracks overhead.
 *  3. Cheers — travel pauses at 45%, front pose fades in, mug raised,
 *     donation text appears. The single attention moment.
 *  4. Arrival — travel resumes, he parks left of Comet, idles (gentle sway,
 *     occasional sip). Cloud stays.
 *
 * Clean-UX bar: charming, never annoying. One 5.2s walk, then quiet idle.
 * Never blocks edition cards or CTAs (E2E-verified at 360px).
 *
 * Hard rules (grep-verifiable):
 * - inline SVG only — no new assets, no npm packages
 * - zero imports from the audio system (no sfx.ts) — silent
 * - zero analytics calls (no gtag) — Game Designer's COPPA call stands
 * - URL from VITE_KOFI_URL build env; unset/empty → renders nothing
 * - plain window.open with noopener/noreferrer, never the router <Link>
 * - hidden while offline
 * - never gates gameplay; no perks, no tiers UI
 * - prefers-reduced-motion: parked statically near Comet, no walk/sway/
 *   cheers animation; cloud static; cheers text shown statically so the
 *   CTA stays discoverable
 */
const KOFI_URL = import.meta.env.VITE_KOFI_URL?.trim() || undefined;

// Walk travel time (the cheers pause freezes the timeline on top of this).
const WALK_MS = 5200;
// Fraction of the walk at which Grandpa stops for the cheers beat.
const CHEERS_AT = 0.45;
const CHEERS_HOLD_MS = 1700;

const INK = "#0c181d";
const BRASS = "#e8b64c";
const COAT = "#7a5a3a";
const COAT_DARK = "#5e4229";
const SKIN = "#f2c9a0";
const HAIR = "#f5f2ea";
const TROUSER = "#33404f";
const CANE = "#6b4a2c";
const COFFEE = "#4a2c14";

type Beat = "walking" | "cheering" | "idle";

export function GrandpaCoffeeRun() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [beat, setBeat] = useState<Beat>("walking");
  const walkerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
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

  // Beat machine: walking → cheering (travel paused) → walking → idle.
  useEffect(() => {
    if (reducedMotion) {
      setBeat("idle");
      return;
    }
    const walker = walkerRef.current;
    if (!walker) return;
    let resumeTimer = 0;
    const cheerTimer = window.setTimeout(() => {
      setBeat("cheering");
      resumeTimer = window.setTimeout(() => {
        // Resume travel; the travel animation's `animationend` flips to idle.
        setBeat("walking");
      }, CHEERS_HOLD_MS);
    }, WALK_MS * CHEERS_AT);
    const onArrive = (e: AnimationEvent) => {
      if (e.animationName === "grandpa-travel") setBeat("idle");
    };
    walker.addEventListener("animationend", onArrive);
    return () => {
      window.clearTimeout(cheerTimer);
      window.clearTimeout(resumeTimer);
      walker.removeEventListener("animationend", onArrive);
    };
  }, [reducedMotion]);

  const openGate = useCallback(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  if (!online) return null;
  // Fail-closed: no Ko-fi URL configured → render nothing.
  if (!KOFI_URL) return null;

  return (
    <>
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

      <button
        ref={walkerRef}
        type="button"
        className="grandpa-walker"
        data-testid="grandpa-walker"
        onClick={openGate}
        aria-label="Grandpa's coffee run. Activate to support the expedition on Ko-fi — asks a grown-up first."
      >
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

            {/* ============ FRONT POSE — cheers, facing the viewer ============ */}
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
              {/* right arm raised high — the toast */}
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
                <ellipse cx="78" cy="12" rx="6.5" ry="2" fill={COFFEE} />
              </g>
              {/* toast sparkles */}
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
          </svg>

          {/* Thought cloud: coffee refill — tracks him the whole way. */}
          <span className="thought-cloud">
            <svg viewBox="0 0 72 52">
              <circle cx="16" cy="46" r="2.5" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
              <circle cx="25" cy="40" r="3.5" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
              <path
                d="M22 34 Q14 34 14 26 Q14 17 23 17 Q25 9 34 9 Q43 9 45 17 Q54 17 54 26 Q54 34 46 34 Z"
                fill="#fffdf8"
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* little coffee cup */}
              <rect
                x="29"
                y="20"
                width="13"
                height="11"
                rx="2"
                fill={BRASS}
                stroke={INK}
                strokeWidth="1.5"
              />
              <path
                d="M42 22 Q46 25 42 28"
                stroke={INK}
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
              {/* refill arrow circling the cup */}
              <path
                className="refill-arrow"
                d="M27 15 Q35 10 43 15"
                stroke={INK}
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M43 15 l-4.5 -1 1.5 4.2 Z"
                fill={INK}
              />
            </svg>
          </span>
        </span>

        {/* The ask — visible only during the cheers beat (or statically
            under reduced motion). Tapping anywhere on grandpa opens the gate. */}
        <span className="grandpa-cheers-text" aria-hidden="true">
          <strong>Support the Expedition</strong>
          <span>Grown-ups — fuel Comet&rsquo;s journey</span>
        </span>
      </button>
    </div>
    {/*
      The gate dialog lives OUTSIDE .grandpa-scene on purpose:
      the scene is pointer-events:none (only the walker re-enables),
      and an inherited none would make the native <dialog> unclickable.
    */}
    <SupportGateDialog dialogRef={dialogRef} koFiUrl={KOFI_URL} />
    </>
  );
}
