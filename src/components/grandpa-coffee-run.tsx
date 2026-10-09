import { useCallback, useEffect, useRef, useState } from "react";
import "./grandpa-coffee-run.css";
import { BODY as COMET_BODY, BODY_LIGHT as COMET_BODY_LIGHT } from "./comet-mascot";
import {
  buildStraightTrail,
  buildTourPath,
  type DocRect,
  type TourGeometry,
  type TourMeasurements,
  type TourStop,
} from "./grandpa-tour";

/**
 * Grandpa's Tasting Tour — animated donation scene on the Chart Room home.
 *
 * Veeresh 2026-10-07: the mobile (≤1023.5px) screenplay is a guided tasting
 * tour. Beats (mobile):
 *  0. Origin — ~1s after load (staggered entrance plays first), a small
 *     brass compass-rose node marks the trail origin top-left, by the
 *     Meridian banner.
 *  1. The tasting tour — grandpa walks a dotted S-trail (2px, 6/6 dash,
 *     round caps, brass) down the page gutters. At EACH option he STOPS,
 *     turns to look at it, sips his coffee (~0.8s), then walks on. Stop
 *     order: difficulty picker → GeoDetective card → edition cards. The trail weaves AROUND cards — never
 *     behind, never on — keeping ≥16px from every interactive rect
 *     (verified by a sampling gate in grandpa-tour.ts; violations step down
 *     the fallback ladder). The strip's donation cloud (grown-up lock) is
 *     visible in the closing band from the start of the walk, and the
 *     strip walker is tappable (moving tap targets still avoided: the
 *     tappable walker is the parked strip figure, not the moving tour
 *     walker). The whole journey is hard-capped at 10s. *  2. Top-up — at the pour waypoint just above the park strip he holds up
 *     his mug and the existing gooseneck-kettle dolly-vertigo pour plays
 *     (scale 0.25→2.6x, spout-tip transform origin, visible fill + steam
 *     burst, ~2.8s). Wordless.
 *  3. Settle — he sits on the bench facing the viewer, beside a tiny
 *     static Comet plush (Veeresh 2026-10-07). The
 *     trail fades to ~18% over ~2s. The donation cloud fades in with
 *     Veeresh's locked copy ("Grown-ups — buy me a coffee? ☕" /
 *     "Your support keeps Meridian free for kids"). Tapping grandpa OR the
 *     cloud opens the "ask a grown-up" gate INSIDE THE SAME CLOUD — Continue
 *     opens Ko-fi in a new tab and the cloud reverts; Cancel/Esc reverts
 *     too. The ask shows once per session (sessionStorage).
 *
 * Return visits (same calendar day): faint trail, grandpa already seated,
 * no replay — tracked via localStorage `meridian.grandpaTour.lastDate`
 * (local YYYY-MM-DD). Next day the full walk replays.
 *
 * Fallback ladder (automatic step-down, never breaks the page):
 *   full weave → simplified straight trail → current bottom-strip walk →
 *   grandpa hidden (the env/offline fail-closed gates).
 * Trail geometry is measured at runtime AFTER `document.fonts.ready` and
 * never redrawn mid-walk; a resize/orientation change mid-walk settles the
 * tour immediately, and re-measures once settled.
 *
 * Desktop (≥1024px) keeps the previous behavior: one slow 9.5s stroll
 * across the viewport (no cloud) → kettle beat at 45% → park finale with
 * the donation cloud. The mid-walk cheers text is gone everywhere — the
 * walk is silent/wordless by design now.
 *
 * Hard rules (grep-verifiable):
 * - inline SVG only — no new assets, no npm packages
 * - zero imports from the audio system (no sfx.ts) — silent
 * - zero analytics calls (no gtag) — Game Designer's COPPA call stands
 * - URL from VITE_KOFI_URL build env; unset/empty → renders nothing
 * - plain window.open with noopener/noreferrer, never the router <Link>
 * - hidden while offline
 * - never gates gameplay; no perks, no tiers UI
 * - prefers-reduced-motion: settled scene ONLY — no trail, no walker
 * - the trail layer never intercepts input (pointer-events: none)
 */
const KOFI_URL = import.meta.env.VITE_KOFI_URL?.trim() || undefined;

// Slow stroll across the dotted path (the kettle pause freezes the
// timeline on top of this). Veeresh 2026-10-07: "he is going too fast" —
// was 5200ms, now a leisurely ~9.5s. (Desktop strip-walk only.)
const WALK_MS = 9500;
// Fraction of the walk at which the kettle drops.
const KETTLE_AT = 0.45;
// Drop (~0.8s) + hover/tilt/pour (~1.2s) + rise/fade (~0.6s) + margin.
const KETTLE_HOLD_MS = 2800;

// --- Tasting-tour tuning (mobile) ---
const MOBILE_QUERY = "(max-width: 1023.5px)";
const TOUR_LAST_DATE_KEY = "meridian.grandpaTour.lastDate";
const TOUR_ASK_SHOWN_KEY = "meridian.grandpaTour.askShown";
/** Total journey hard cap, measured from the first step. */
const TOUR_JOURNEY_CAP_MS = 12_000;
/** Normal journey target — comfortably under the cap. */
const TOUR_TARGET_MS = 6_000;
/** Sip dwell at each tasting stop. */
const TOUR_SIP_MS = 800;
/** Top-up pour — matches the kettle-drop keyframes. */
const TOUR_POUR_MS = 2800;
/** Tour figure size (smaller than the strip's 64px walker). */
const TOUR_WALKER_PX = 44;

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
/** Strip mode: "strip" = current beat machine (desktop + level-2 fallback);
 *  "tour" = the tasting tour drives (walker hidden); "seated" = static finale. */
type StripMode = "strip" | "tour" | "seated";
type TourStage = "compass" | "walk" | "settled" | "faint";
type TourPhase = "walk" | "sip" | "pour" | "done";

function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia !== "undefined" &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

function readStorage(key: string, store: "local" | "session"): string | null {
  try {
    const s = store === "local" ? localStorage : sessionStorage;
    return s.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string, store: "local" | "session"): void {
  try {
    const s = store === "local" ? localStorage : sessionStorage;
    s.setItem(key, value);
  } catch {
    /* storage unavailable — the tour still plays; gating just retries */
  }
}

/* ================= Grandpa figure (shared SVG, three poses) ================= */

function GrandpaFigure({
  clipId,
  testIdPrefix,
}: {
  clipId: string;
  testIdPrefix: string;
}) {
  const t = (name: string) => `${testIdPrefix}-${name}`;
  return (
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
          <clipPath id={clipId}>
            <rect x="71.5" y="11.5" width="13" height="15" rx="2" />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <g className="mug-fill" data-testid={t("mug-fill")}>
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
          <g data-testid={t("pupils")}>
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
        <g className="seated-mug-gesture" data-testid={t("mug-gesture")}>
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
  );
}

/* ================= Gooseneck kettle (shared) ================= */

function GrandpaKettle({ testIdPrefix }: { testIdPrefix: string }) {
  const t = (name: string) => `${testIdPrefix}-${name}`;
  return (
    <span className="kettle-stage" aria-hidden="true" data-testid={t("kettle")}>
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
          data-testid={t("kettle-stream")}
          d="M18 82 L18 108"
          stroke={COFFEE}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/* ================= Tour measurement (DOM → grandpa-tour.ts) ================= */

function docRectOf(el: Element): DocRect {
  const r = el.getBoundingClientRect();
  const sy = window.scrollY;
  return {
    left: r.left,
    top: r.top + sy,
    right: r.right,
    bottom: r.bottom + sy,
    width: r.width,
    height: r.height,
  };
}

/** Beat 0 position: midpoint between the eyebrow row and the title. */
function measureOrigin(): { x: number; y: number } {
  const fallback = { x: 26, y: 84 + window.scrollY };
  const main = document.querySelector("main.atlas-home");
  const eyebrow = main?.querySelector(".atlas-eyebrow");
  const title = main?.querySelector(".atlas-title");
  if (!eyebrow || !title) return fallback;
  const er = eyebrow.getBoundingClientRect();
  const tr = title.getBoundingClientRect();
  if (er.bottom <= 0 || tr.top <= 0) return fallback;
  return { x: 26, y: (er.bottom + tr.top) / 2 + window.scrollY };
}

function measureTour(): TourMeasurements | null {
  const main = document.querySelector("main.atlas-home");
  const scene = document.querySelector('[data-testid="grandpa-scene"]');
  const walker = document.querySelector('[data-testid="grandpa-walker"]');
  if (!main || !scene || !walker) return null;
  const pick = (id: string): DocRect | null => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el ? docRectOf(el) : null;
  };
  const difficulty = pick("tour-stop-difficulty");
  const geodetective = pick("tour-stop-geodetective");
  const editions = pick("tour-stop-editions");
  if (!difficulty || !geodetective || !editions) return null;
  const stops: TourStop[] = [
    { key: "difficulty", rect: difficulty },
    { key: "geodetective", rect: geodetective },
    { key: "editions", rect: editions },
  ];
  const interactives: DocRect[] = [];
  main
    .querySelectorAll('button, a[href], input, select, textarea, [role="button"]')
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      if (getComputedStyle(el).visibility === "hidden") return;
      interactives.push(docRectOf(el));
    });
  const wr = walker.getBoundingClientRect();
  if (wr.width <= 0) return null;
  return {
    viewportWidth: document.documentElement.clientWidth,
    docHeight: Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ),
    stops,
    interactives,
    originY: measureOrigin().y,
    stripTop: docRectOf(scene).top,
    bench: {
      x: wr.left + wr.width / 2,
      y: wr.top + window.scrollY + wr.height / 2,
    },
  };
}

function fontsReady(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    try {
      document.fonts.ready.then(
        () => finish(true),
        () => finish(false),
      );
    } catch {
      finish(false);
    }
  });
}

/* ================= The tour layer (beats 0–2, mobile) ================= */

function TourLayer({
  tour,
  onHandoff,
}: {
  tour: { stage: TourStage; geometry: TourGeometry | null; origin: { x: number; y: number } | null };
  onHandoff: () => void;
}) {
  const { stage, geometry, origin } = tour;
  const docRef = useRef<HTMLDivElement | null>(null);
  const walkerRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [phase, setPhase] = useState<TourPhase>("walk");
  const [stopIndex, setStopIndex] = useState(-1);
  const [pose, setPose] = useState<"side" | "pour">("side");
  const [facing, setFacing] = useState<1 | -1>(1);
  // Scroll posture for the journey: "snap" (snapped to top at walk start),
  // "nosnap" (user had already scrolled — no yank), "optout" (user scrolled
  // mid-walk — all further auto-scroll suppressed). Exposed as
  // data-tour-scroll for E2E.
  const [scrollNote, setScrollNote] = useState<"snap" | "nosnap" | "optout">(
    "snap",
  );
  const onHandoffRef = useRef(onHandoff);
  onHandoffRef.current = onHandoff;

  // Walk engine — JS-driven position along the path with sip dwell at each
  // stop and the kettle top-up at the pour waypoint. Time-based (not
  // frame-based) so the 10s hard cap holds even when frames drop.
  useEffect(() => {
    if (stage !== "walk" || !geometry) return;
    const path = pathRef.current;
    const walker = walkerRef.current;
    const doc = docRef.current;
    if (!path || !walker || !doc) return;
    let cancelled = false;
    const timers: number[] = [];
    const total = geometry.totalLength;
    if (!(total > 0)) return;

    type Leg = { to: number; kind: "stop" | "pour" | "end"; stopIndex: number };
    const legs: Leg[] = [
      ...geometry.stopDistances.map((d, i) => ({
        to: d,
        kind: "stop" as const,
        stopIndex: i,
      })),
      { to: geometry.pourDistance, kind: "pour" as const, stopIndex: -1 },
      { to: total, kind: "end" as const, stopIndex: -1 },
    ];
    const facingForStop = (i: number): 1 | -1 =>
      geometry.stopSides[i] === "left" ? 1 : -1;
    const lastFacing = (): 1 | -1 =>
      geometry.stopSides.length > 0
        ? facingForStop(geometry.stopSides.length - 1)
        : -1;

    const walkBudgetMs = Math.max(
      4000,
      TOUR_TARGET_MS -
        geometry.stopDistances.length * TOUR_SIP_MS -
        TOUR_POUR_MS -
        600,
    );
    const speed = total / (walkBudgetMs / 1000); // px per second

    // The tour starts at the top of the page — but only if the user hasn't
    // already scrolled. Yanking a scrolled-in user back to top is pure
    // disorientation (UX review 2026-10-07).
    try {
      if (window.scrollY < 100) {
        window.scrollTo({ top: 0, behavior: "auto" });
      } else {
        setScrollNote("nosnap");
      }
    } catch {
      /* noop */
    }

    let raf = 0;
    let dist = 0;
    let legIdx = 0;
    let mode: "walk" | "sip" | "pour" = "walk";
    let resumeAt = 0;
    let last = performance.now();
    const t0 = last;
    // User-initiated scroll opts out of ALL further auto-scroll: the walk
    // continues visually, but the camera stays where the player put it.
    // Only wheel/touchmove/keyboard-scroll count — the tour's own
    // programmatic scrollTo calls must not trip the opt-out.
    let autoScroll = true;
    const optOut = () => {
      if (!autoScroll) return;
      autoScroll = false;
      setScrollNote("optout");
    };
    const onWheelIntent = () => optOut();
    const onTouchIntent = () => optOut();
    const onKeyIntent = (e: KeyboardEvent) => {
      if (
        e.key === " " ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "PageUp" ||
        e.key === "PageDown" ||
        e.key === "Home" ||
        e.key === "End"
      )
        optOut();
    };
    window.addEventListener("wheel", onWheelIntent, { passive: true });
    window.addEventListener("touchmove", onTouchIntent, { passive: true });
    window.addEventListener("keydown", onKeyIntent);

    setFacing(geometry.simplified ? -1 : facingForStop(0));

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scrollLeg = (to: number) => {
      if (!autoScroll) return;
      try {
        const pt = path.getPointAtLength(Math.min(to, total));
        const y = pt.y - window.innerHeight * 0.45;
        window.scrollTo({
          top: Math.max(0, Math.min(y, maxScroll())),
          behavior: "smooth",
        });
      } catch {
        /* noop */
      }
    };
    scrollLeg(legs[0].to);

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      setPhase("done");
      // Let the tour walker fade before the strip takes over the finale.
      // (The effect cleanup clears this timeout on unmount; no cancelled
      // check here — cancelled is already true by design at this point.)
      timers.push(
        window.setTimeout(() => {
          onHandoffRef.current();
        }, 450),
      );
    };

    const frame = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      // Glue the document-space layer to the scrolled page.
      doc.style.transform = `translateY(${-window.scrollY}px)`;
      // Hard cap: the journey never runs past 10s.
      if (now - t0 > TOUR_JOURNEY_CAP_MS) {
        finish();
        return;
      }
      if (mode === "walk") {
        dist += speed * dt;
        const leg = legs[legIdx];
        if (dist >= leg.to) {
          dist = leg.to;
          if (leg.kind === "stop") {
            mode = "sip";
            resumeAt = now + TOUR_SIP_MS;
            setPhase("sip");
            setStopIndex(leg.stopIndex);
            setFacing(facingForStop(leg.stopIndex));
          } else if (leg.kind === "pour") {
            mode = "pour";
            resumeAt = now + TOUR_POUR_MS;
            setPhase("pour");
            setPose("pour");
          } else {
            finish();
            return;
          }
        }
      } else if (now >= resumeAt) {
        const arrivedLeg = legs[legIdx];
        if (arrivedLeg.kind === "pour") setPose("side");
        mode = "walk";
        legIdx += 1;
        const leg = legs[legIdx];
        if (leg.kind === "stop") setFacing(facingForStop(leg.stopIndex));
        else setFacing(lastFacing());
        setPhase("walk");
        scrollLeg(leg.to);
      }
      try {
        const pt = path.getPointAtLength(Math.min(dist, total));
        const hw = TOUR_WALKER_PX / 2;
        walker.style.transform = `translate(${pt.x - hw}px, ${pt.y - hw * 1.32}px)`;
      } catch {
        /* noop */
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Never redraw mid-walk: a true viewport-width change (rotation, window
    // resize — NOT the mobile URL bar's height-only resize) settles the tour
    // immediately instead of walking a stale trail.
    const startW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== startW) finish();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("wheel", onWheelIntent);
      window.removeEventListener("touchmove", onTouchIntent);
      window.removeEventListener("keydown", onKeyIntent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, geometry]);

  // Scroll glue for the non-walking stages (compass pop, settled/faint trail).
  useEffect(() => {
    if (stage === "walk") return;
    const doc = docRef.current;
    if (!doc) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      doc.style.transform = `translateY(${-window.scrollY}px)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stage]);

  const W = geometry?.width ?? (typeof window !== "undefined" ? window.innerWidth : 390);
  const H = geometry?.height ?? 1600;
  const hw = TOUR_WALKER_PX / 2;
  const startX = (origin?.x ?? geometry?.origin.x ?? 26) - hw;
  const startY = (origin?.y ?? geometry?.origin.y ?? 84) - hw * 1.32;

  return (
    <div
      className="tour-layer"
      data-testid="grandpa-tour"
      data-tour-stage={stage}
      data-tour-phase={phase}
      data-stop-index={stopIndex}
      data-tour-beat={phase === "pour" ? "pour" : undefined}
      data-tour-scroll={scrollNote}
      aria-hidden="true"
    >
      <div ref={docRef} className="tour-doc" style={{ height: H }}>
        {origin && stage !== "faint" && (
          <div
            className="tour-caption"
            data-testid="tour-caption"
            style={{ left: origin.x + 20, top: origin.y - 10 }}
          >
            Grandpa's rounds ☕
          </div>
        )}
        <svg
          className="tour-svg"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          data-testid="grandpa-tour-svg"
        >
          {origin && (
            <g transform={`translate(${origin.x} ${origin.y})`}>
              <g className="tour-compass-pop">
                <circle r="9" className="tour-compass-ring" />
                <path
                  d="M0 -6.5 L1.8 -1.8 L6.5 0 L1.8 1.8 L0 6.5 L-1.8 1.8 L-6.5 0 L-1.8 -1.8 Z"
                  className="tour-compass-star"
                />
                <circle r="1.5" className="tour-compass-dot" />
              </g>
            </g>
          )}
          {geometry && (
            <path
              ref={pathRef}
              className="tour-trail"
              d={geometry.d}
              data-testid="grandpa-tour-path"
            />
          )}
        </svg>
        {stage === "walk" && geometry && (
          <div
            ref={walkerRef}
            className="tour-walker"
            data-pose={pose}
            data-facing={facing}
            data-testid="grandpa-tour-walker"
            style={{ transform: `translate(${startX}px, ${startY}px)` }}
          >
            <span className="tour-flip">
              <span className="tour-bob">
                <GrandpaFigure
                  clipId="grandpa-tour-mug-clip"
                  testIdPrefix="grandpa-tour"
                />
                <GrandpaKettle testIdPrefix="grandpa-tour" />
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= The scene (strip finale + desktop) ================= */

export function GrandpaCoffeeRun() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [beat, setBeat] = useState<Beat>("walking");
  const [cloud, setCloud] = useState<Cloud>("ask");
  const [askVisible, setAskVisible] = useState(true);
  const walkerRef = useRef<HTMLDivElement | null>(null);
  const continueRef = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useRef(
    typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;
  const [isMobile] = useState(isMobileViewport);
  const [mode, setMode] = useState<StripMode>(() => {
    if (
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return "seated";
    if (isMobileViewport()) {
      // Return visits (same calendar day): no replay — already seated.
      if (readStorage(TOUR_LAST_DATE_KEY, "local") === localDateKey())
        return "seated";
      return "tour";
    }
    return "strip";
  });
  const [tour, setTour] = useState<{
    stage: TourStage;
    geometry: TourGeometry | null;
    origin: { x: number; y: number } | null;
  } | null>(null);

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

  // Beat machine for the "strip" mode: the previous behavior — desktop's
  // slow stroll, and the mobile level-2 fallback walk. (In "tour" mode the
  // tour layer drives; in "seated" mode the finale is static.)
  useEffect(() => {
    if (mode === "seated" || reducedMotion) {
      setBeat("seated");
      return;
    }
    if (mode !== "strip") return;
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
  }, [mode, reducedMotion]);

  // Tasting-tour orchestration (mobile, fresh visit): Beat 0 compass at ~1s,
  // then measure after the staggered entrance + fonts.ready and start the
  // walk — or step down the fallback ladder.
  useEffect(() => {
    if (mode !== "tour") return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        timers.push(window.setTimeout(res, ms));
      });
    (async () => {
      await wait(1000);
      if (cancelled) return;
      setTour({ stage: "compass", geometry: null, origin: measureOrigin() });
      const [fontsOk] = await Promise.all([fontsReady(2500), wait(600)]);
      if (cancelled) return;
      let m: TourMeasurements | null = null;
      try {
        m = measureTour();
      } catch {
        m = null;
      }
      let geo: TourGeometry | null = null;
      if (m) {
        try {
          geo = fontsOk ? buildTourPath(m) : null;
        } catch {
          geo = null;
        }
        if (!geo) {
          try {
            geo = buildStraightTrail(m);
          } catch {
            geo = null;
          }
        }
      }
      if (cancelled) return;
      if (!geo) {
        // Level 2: the current bottom-strip walk.
        setTour(null);
        setMode("strip");
        // The walk never started — release any Storyteller yield.
        window.dispatchEvent(new Event("meridian:tour-walk-end"));
        return;
      }
      setTour({ stage: "walk", geometry: geo, origin: geo.origin });
      // The tour takes focus: dismiss Comet's transient greeting so the
      // fixed bubble can't end up covering a CTA once the walk's
      // auto-scroll moves the page beneath it.
      window.dispatchEvent(new Event("meridian:tour-walk-start"));
    })();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [mode]);

  // The handoff: tour walker arrives at the bench → the strip takes over the
  // finale (seated grandpa, fading trail, session-gated cloud).
  const onTourHandoff = useCallback(() => {
    setTour((t) => (t ? { ...t, stage: "settled" } : t));
    setMode("seated");
    // The walk is over — the Storyteller may return.
    window.dispatchEvent(new Event("meridian:tour-walk-end"));
    // Flip the beat in the same render: the cloud is a new element here, so
    // it appears at full opacity (no CSS transition from a prior hidden
    // state) — matching the strip's original finale behavior.
    setBeat("seated");
    writeStorage(TOUR_LAST_DATE_KEY, localDateKey(), "local");
    // The once-per-session cloud gate lives in the effect below — it runs on
    // the mode change and owns the session flag, so the cloud shows on the
    // first visit and stays hidden on later ones.
  }, []);

  // A viewport-width change across the mobile breakpoint mid-tour settles
  // immediately — the desktop scene is a different layout.
  useEffect(() => {
    if (mode !== "tour") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) onTourHandoff();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, onTourHandoff]);

  // Return visits (same calendar day): the faint trail, no walker, no replay.
  // Measured after fonts so the ghost of the tour lines up with the cards.
  useEffect(() => {
    if (mode !== "seated" || !isMobile || reducedMotion) return;
    if (readStorage(TOUR_LAST_DATE_KEY, "local") !== localDateKey()) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        timers.push(window.setTimeout(res, ms));
      });
    (async () => {
      const [fontsOk] = await Promise.all([fontsReady(2500), wait(1600)]);
      if (cancelled) return;
      let m: TourMeasurements | null = null;
      try {
        m = measureTour();
      } catch {
        m = null;
      }
      let geo: TourGeometry | null = null;
      if (m) {
        try {
          geo = fontsOk ? buildTourPath(m) : buildStraightTrail(m);
        } catch {
          geo = null;
        }
      }
      if (cancelled || !geo) return;
      setTour({ stage: "faint", geometry: geo, origin: geo.origin });
    })();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [mode, isMobile, reducedMotion]);

  // Session-gate the ask on mobile settle (return visits + reduced motion).
  // Desktop keeps the previous behavior: the cloud shows every load.
  useEffect(() => {
    if (mode !== "seated" || !isMobile || reducedMotion) return;
    if (readStorage(TOUR_ASK_SHOWN_KEY, "session")) setAskVisible(false);
    else {
      writeStorage(TOUR_ASK_SHOWN_KEY, "1", "session");
      setAskVisible(true);
    }
  }, [mode, isMobile, reducedMotion]);

  // Re-measure the settled/faint trail on resize/orientation change — never
  // mid-walk (a mid-walk width change settles the tour instead).
  useEffect(() => {
    const stage = tour?.stage;
    if (stage !== "settled" && stage !== "faint") return;
    let t = 0;
    const remeasure = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        let m: TourMeasurements | null = null;
        try {
          m = measureTour();
        } catch {
          m = null;
        }
        if (!m) return;
        let geo: TourGeometry | null = null;
        try {
          geo = buildTourPath(m) ?? buildStraightTrail(m);
        } catch {
          geo = null;
        }
        if (geo)
          setTour((prev) =>
            prev ? { ...prev, geometry: geo, origin: geo.origin } : prev,
          );
      }, 300);
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
    };
  }, [tour?.stage]);

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

  // The cloud shows: in "strip" mode always (previous behavior); on mobile
  // also during the tasting tour (the grown-up lock is discoverable from the
  // first beat) and once settled — both once per session via askVisible.
  const showCloud =
    mode === "strip"
      ? true
      : mode === "tour"
        ? isMobile && askVisible
        : mode === "seated"
          ? !isMobile || askVisible
          : false;
  const walkerInteractive = showCloud;

  return (
    <>
      {tour && (
        <TourLayer
          key="grandpa-tour-layer"
          tour={tour}
          onHandoff={onTourHandoff}
        />
      )}
      {/* Skip control: the ONE interactive element in the tour plane. Rendered
          outside the aria-hidden tour layer so it stays accessible. Tapping it
          settles the tour immediately — same end-state as a completed walk. */}
      {mode === "tour" && (
        <button
          type="button"
          className="tour-skip"
          data-testid="tour-skip"
          onClick={onTourHandoff}
        >
          Skip tour
        </button>
      )}
      <div
        className="grandpa-scene"
        data-testid="grandpa-scene"
        data-beat={beat}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        data-mode={mode}
        data-tour={mode === "tour" ? "active" : undefined}
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
          role={walkerInteractive ? "button" : undefined}
          tabIndex={walkerInteractive ? 0 : undefined}
          className="grandpa-walker"
          data-testid="grandpa-walker"
          onClick={walkerInteractive ? openCloudGate : undefined}
          onKeyDown={walkerInteractive ? onWalkerKeyDown : undefined}
          aria-label={
            walkerInteractive
              ? "Grandpa's Tasting Tour. Activate to support Meridian on Ko-fi — asks a grown-up first."
              : undefined
          }
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
              {/* Comet plush — a tiny STATIC toy at the bench's right end.
                  Veeresh 2026-10-07: set dressing, zero animation; keeps the
                  two-character warmth without motion competing with the mug.
                  Kid-safety: the plush sits inside the walker's donation tap
                  target, but a toy must never trigger the Ko-fi gate — taps
                  here stop propagation and just squish (CSS :active). */}
              <g
                data-testid="grandpa-comet-plush"
                className="grandpa-comet-plush"
                onClick={(e) => e.stopPropagation()}
              >
                <ellipse cx="42" cy="104" rx="7" ry="8" fill={COMET_BODY} stroke={INK} strokeWidth="1.5" />
                <circle cx="42" cy="94" r="6.5" fill={COMET_BODY} stroke={INK} strokeWidth="1.5" />
                <polygon points="37,89.5 38.5,84.5 40,89.5" fill={BRASS} stroke={INK} strokeWidth="1" />
                <polygon points="44,89.5 45.5,84.5 47,89.5" fill={BRASS} stroke={INK} strokeWidth="1" />
                <circle cx="39.8" cy="93.5" r="1.1" fill={INK} />
                <circle cx="44.2" cy="93.5" r="1.1" fill={INK} />
                <ellipse cx="42" cy="97" rx="3.4" ry="2.6" fill={COMET_BODY_LIGHT} />
              </g>
            </svg>
          </span>

          <span className="grandpa-bob" aria-hidden="true">
            <GrandpaFigure clipId="grandpa-mug-clip" testIdPrefix="grandpa" />
            {/* The kettle — drops from the top in a dolly-vertigo move during
                the kettle beat: descends while scaling up toward the viewer,
                tilts over the raised mug, pours, then rises/fades away. */}
            <GrandpaKettle testIdPrefix="grandpa" />
          </span>

          {/* The cloud — the finale ask, or the in-cloud gate workflow.
              Tapping grandpa OR this cloud swaps it to the gate; the whole
              flow lives here so the UI never gets crowded. Copy per the Game
              Designer's kid-friendly brief. */}
          {showCloud && (
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
                    aria-label="Grown-ups — buy me a coffee? Activate to learn how to support Meridian."
                  >
                    <strong>Grown-ups — buy me a coffee? ☕</strong>
                    <span>Your support keeps Meridian free for kids</span>
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
                      You're leaving Meridian to visit Ko-fi. Ask a grown-up!
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
          )}
        </div>
      </div>
    </>
  );
}
