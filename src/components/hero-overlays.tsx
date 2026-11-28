/**
 * Hero overlays (game-app-map step 21, TD-06.16): the painted-mountain
 * hero's motion overlays (trail + trekker) and the full-viewport chart-room
 * backdrop behind the home screen. Moved out of src/components/game-app.tsx.
 * Decorative only; the motion gates mirror CardFilm (reduced-motion,
 * Save-Data, low-memory -> the still).
 */
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Hero motion V1 — "the journey up": an SVG overlay that tracks the
 * painted mountain art exactly (same 800×533 viewBox, sliced like the
 * img's object-fit: cover / right-bottom) — a dotted trail whose dots
 * march along the painted switchbacks, a gold pulse that climbs the
 * trail to the summit, a waving flag on the peak, and soft cloud
 * forms drifting in front of the upper slopes (owner's V1b pick,
 * 2026-11-04: the painted summits already sit in mist bands, so the
 * clouds move — "the mountains are in the cloud"). V1b also answers
 * his "very subtle" note: bigger pulse core + halo + comet tail,
 * larger/brisker trail dots, wider flag wave. Zero new assets.
 *
 * Motion gates mirror CardFilm (card-film.tsx), the same pattern
 * the trekker overlay below uses: prefers-reduced-motion (the
 * shared hook, so an OS flip mid-session lands on the still too),
 * Save-Data, or deviceMemory ≤ 2 — any of them means the pulse and
 * clouds are never rendered, and the CSS kills the march + wave:
 * the JS `reduced` state is reflected onto this SVG as the
 * `hv5-trail-still` class, and home-v5.css sets `animation: none`
 * on the dots + flag under that class (mirroring its
 * prefers-reduced-motion rules, which only cover the OS gate),
 * leaving a static dotted trail. The loops otherwise run
 * continuously; no timer ever stops them.
 *
 * The tradeoff, stated plainly (the same one CardFilm records):
 * WCAG 2.2.2 asks for a stop on moving content that lasts more
 * than five seconds. These hero loops are continuous looping
 * decorative motion with no pause button — the hero has no pause
 * button by the owner's autoloop order (2026-11-03: "we dont need
 * playbutton it should be in autoloop"). The stops that remain
 * are the gates above: a player who prefers reduced motion, or
 * is saving data, or is on a low-memory device never gets the
 * motion at all, only the still. Do not add a button back
 * without a new owner order.
 */
export function HeroTrailOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [staticGate] = useState<boolean>(heroStaticGateAtMount);
  const reduced = reducedMotion || staticGate;
  const trail =
    "M322 528 C 305 500, 345 480, 350 460 C 355 438, 300 432, 292 408 C 284 384, 312 362, 340 350 C 375 336, 415 340, 408 318 C 402 298, 380 285, 402 268 C 428 248, 486 240, 512 226 C 532 215, 500 200, 492 182 C 486 166, 498 148, 503 134";
  return (
    <svg
      className={reduced ? "hv5-trail hv5-trail-still" : "hv5-trail"}
      viewBox="0 0 800 533"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="hv5-cloud-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <path
        d={trail}
        fill="none"
        stroke="#7c5a1e"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeDasharray="0.1 11"
        className="hv5-trail-dots"
        opacity="0.95"
      />
      {!reduced ? (
        <g className="hv5-clouds" aria-hidden="true">
          <g className="hv5-cloud-drift-a" filter="url(#hv5-cloud-soft)" fill="#fdfbf3">
            <ellipse cx="0" cy="118" rx="120" ry="17" opacity="0.32" />
            <ellipse cx="85" cy="106" rx="80" ry="13" opacity="0.26" />
            <ellipse cx="-80" cy="108" rx="70" ry="12" opacity="0.22" />
            <ellipse cx="560" cy="238" rx="130" ry="15" opacity="0.2" />
            <ellipse cx="645" cy="228" rx="75" ry="11" opacity="0.16" />
            {/* The same bank again, +800: the drift translates one
                full pattern width, so this copy lands exactly where
                the first sat at loop reset — no empty bank, no pop. */}
            <g transform="translate(800 0)">
              <ellipse cx="0" cy="118" rx="120" ry="17" opacity="0.32" />
              <ellipse cx="85" cy="106" rx="80" ry="13" opacity="0.26" />
              <ellipse cx="-80" cy="108" rx="70" ry="12" opacity="0.22" />
              <ellipse cx="560" cy="238" rx="130" ry="15" opacity="0.2" />
              <ellipse cx="645" cy="228" rx="75" ry="11" opacity="0.16" />
            </g>
          </g>
          <g className="hv5-cloud-drift-b" filter="url(#hv5-cloud-soft)" fill="#fdfbf3">
            <ellipse cx="330" cy="168" rx="105" ry="14" opacity="0.24" />
            <ellipse cx="405" cy="158" rx="65" ry="10" opacity="0.19" />
            <ellipse cx="60" cy="268" rx="95" ry="12" opacity="0.15" />
            <g transform="translate(800 0)">
              <ellipse cx="330" cy="168" rx="105" ry="14" opacity="0.24" />
              <ellipse cx="405" cy="158" rx="65" ry="10" opacity="0.19" />
              <ellipse cx="60" cy="268" rx="95" ry="12" opacity="0.15" />
            </g>
          </g>
        </g>
      ) : null}
      {!reduced ? (
        <g className="hv5-trail-pulse">
          <path
            d={trail}
            fill="none"
            stroke="#e9cd7d"
            strokeWidth="7"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="10 90"
            opacity="0.55"
            className="hv5-pulse-tail"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="10"
              to="-90"
              dur="9s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.55;0.55;0"
              keyTimes="0;0.05;0.93;1"
              dur="9s"
              repeatCount="indefinite"
            />
          </path>
          <circle r="13" fill="#b8932f" opacity="0.28" className="hv5-pulse-halo">
            <animateMotion dur="9s" repeatCount="indefinite" path={trail} />
            <animate
              attributeName="opacity"
              values="0;0.28;0.28;0"
              keyTimes="0;0.06;0.92;1"
              dur="9s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            r="8.5"
            fill="#b8932f"
            stroke="#fffdf6"
            strokeWidth="2.5"
            className="hv5-pulse-core"
          >
            <animateMotion dur="9s" repeatCount="indefinite" path={trail} />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.06;0.92;1"
              dur="9s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ) : null}
      <g transform="translate(20 6)">
        <g className="hv5-trail-flag">
          <line x1="503" y1="134" x2="503" y2="106" stroke="#4c3a14" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M503 107 L525 112 L503 118 Z" fill="#8a6d2f" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Hero trekker — "Just a child, trekking" (prototype v2 from
 * branch design/hero-trekker-prototype, composed into production
 * on the owner's ship word, 2026-11-04 21:15: "Ship it — fold the
 * simple trekker into the home build"). Owner's simplification
 * ruling, 2026-11-04 20:29, on
 * the v1 "Catch It, Pin It" prototype: "Reduce the size of the
 * animated cartoon guy, this is supposed be a child walking the
 * trail and let just keep it to that. No more complexities, but
 * while trekking you need sticks and make it realistic trekking
 * please and wind blowing, climbing slowly."
 *
 * So v2 is ONLY a child trekking. The paper, the gust event, the
 * tumble, the catch, the hold-up map reveal, the tuck and the point
 * are all DELETED. What remains, on ONE 18s SMIL master clock:
 *   0–1.1s    he fades in inside the valley mist at the leg's foot
 *   1.1–15.3s slow climb up ONE painted switchback leg (leg 3 of the
 *             v1 spline), two trekking poles working the whole way
 *   15.3–16.7s he fades into the mist bank at the leg's top end
 *   16.7–18s  reset happens invisible inside the mist — no jump cut
 *
 * The figure is a CHILD, drawn ~44 units tall (v1's adult was ~69.5;
 * ≈63%), with child proportions: head ≈27% of height, shorter legs.
 * He keeps the identity the brainstorm chose: rust-orange headwrap,
 * teal backpack. He leans ~6° into the slope.
 *
 * The pole gait is the realism core. Legs, arms and poles are all
 * keyframed path shapes on one 1.8s step clock, opposite pairing
 * like a real climber: each pole PLANTS on the trail ahead at the
 * same beat as the OPPOSITE foot, stays grounded while the body
 * passes over it (the tip sweeps back relative to the body), pushes
 * off behind, then swings forward lifted for the next plant. Pole
 * tips pass through y=0 (the trail under his feet) at every stance
 * keyframe — a floating pole would fail the owner's ask.
 *
 * Wind is an always-on layer, not an event: the headwrap's two tail
 * strands stream and flutter on their own fast clocks, the jacket
 * hem flutters, and the valley mist drifts on the climb leg. The
 * prototype's own ambient peak/summit clouds are NOT ported: the
 * trail overlay's drifting clouds are the hero's one cloud layer.
 * The mist stays — it is this figure's fade staging (he fades in
 * and out inside it), sitting on the leg, not a second weather
 * layer.
 *
 * Gates mirror CardFilm (card-film.tsx): prefers-reduced-motion
 * (the shared hook), Save-Data, or deviceMemory ≤ 2 get the STILL
 * instead — the same SVG with its clock paused mid-climb
 * (t = 7.25s: both poles on the ground, front planted, rear at
 * push-off, headwrap streaming). The loop itself never stops on a
 * timer; like the V1 overlay it is ambient, aria-hidden art.
 * When the gate lifts mid-session (the shared hook is live, so an
 * OS flip lands here), the effect below un-pauses the clock and
 * the climb resumes from the still frame.
 *
 * The tradeoff, stated plainly (the same one CardFilm records):
 * WCAG 2.2.2 asks for a stop on moving content that lasts more
 * than five seconds. This loop is continuous looping decorative
 * motion with no pause button — the hero has no pause button by
 * the owner's autoloop order (2026-11-03: "we dont need
 * playbutton it should be in autoloop"). The stops that remain
 * are the gates above: a player who prefers reduced motion, or
 * is saving data, or is on a low-memory device never gets the
 * motion at all, only the still. Do not add a button back
 * without a new owner order.
 */
const TREKKER_CLIMB_PATH =
  "M294 406 C 288 386, 315 362, 342 351 C 368 340, 398 336, 402 321";

/** Save-Data / low-memory gate, mirroring CardFilm's mount read.
 * Shared by both hero overlays (trail + trekker). */
function heroStaticGateAtMount(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  const mem = nav.deviceMemory;
  return typeof mem === "number" && mem > 0 && mem <= 2;
}

export function HeroTrekkerOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [staticGate] = useState<boolean>(heroStaticGateAtMount);
  const still = reducedMotion || staticGate;
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (!still) {
      // The gate lifted mid-session: resume the master clock from
      // wherever the still froze it — without this the clock stays
      // paused at 7.25 forever even though `still` is false again.
      svg.unpauseAnimations();
      return;
    }
    // The still IS the mid-climb frame: freeze the master clock on it.
    svg.pauseAnimations();
    svg.setCurrentTime(7.25);
  }, [still]);
  return (
    <svg
      ref={svgRef}
      className="hv5-trekker"
      viewBox="0 0 800 533"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="tk-mist" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffdf6" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#fffdf6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fffdf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The trekker rig: one small group climbing the leg on the 18s
          clock. Fades in inside the foot mist, fades out inside the
          top mist; the position reset rides the invisible window. */}
      <g opacity="0">
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.06;0.85;0.93;1" dur="18s" repeatCount="indefinite" />
        <animateMotion
          path={TREKKER_CLIMB_PATH}
          keyPoints="0;1;1;0"
          keyTimes="0;0.92;0.97;1"
          calcMode="linear"
          dur="18s"
          repeatCount="indefinite"
        />
        {/* ~6° forward lean into the slope, pivoting on the ground
            point; inside it, the step bob (two bobs per step cycle). */}
        <g transform="rotate(6)">
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0;0 -0.8;0 0;0 -0.8;0 0" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" />

            {/* Far leg (darker): stance in the second half-cycle,
                swing in the first — opposite the near leg. */}
            <path fill="none" stroke="#4a3826" strokeWidth="3.6" strokeLinecap="round">
              <animate attributeName="d" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite"
                values="M-1 -18 L0 -9 L-4.5 -1;M-1 -18 L4.5 -10 L0 -3.5;M-1 -18 L4 -9 L5 0;M-1 -18 L3 -9.5 L0.5 0;M-1 -18 L0 -9 L-4.5 -1" />
            </path>
            <ellipse rx="2.7" ry="1.5" fill="#3d2c12">
              <animate attributeName="cx" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="-4.5;0;5;0.5;-4.5" />
              <animate attributeName="cy" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="-1;-3.5;0;0;-1" />
            </ellipse>

            {/* Far arm + its pole: plants WITH the near foot (opposite
                pairing) — tip grounded ahead at cycle start, sweeps
                back, pushes off at mid-cycle, swings forward lifted. */}
            <path fill="none" stroke="#8a3f1f" strokeWidth="3.4" strokeLinecap="round">
              <animate attributeName="d" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite"
                values="M-3 -29 L-7 -26 L-5 -21.5;M-3 -29 L-8 -25.5 L-6 -21;M-3 -29 L-6 -25 L-4 -20;M-3 -29 L-6.5 -25 L-4.5 -20.5;M-3 -29 L-7 -26 L-5 -21.5" />
            </path>
            <circle r="2" fill="#caa06a">
              <animate attributeName="cx" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="-5;-6;-4;-4.5;-5" />
              <animate attributeName="cy" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="-21.5;-21;-20;-20.5;-21.5" />
            </circle>

            {/* Teal backpack behind the torso; torso over it, with a
                wind-fluttered hem at its back-bottom corner. */}
            <rect x="-13.5" y="-31" width="8.5" height="14.5" rx="4" fill="#177e70" />
            <rect x="-14.5" y="-32.5" width="7" height="4" rx="2" fill="#12685c" />
            <rect x="-5" y="-32" width="12" height="14" rx="5" fill="#9c4a24" />
            <path d="M-5 -19.5 C -8 -18.5, -9 -16.5, -8.2 -14.5" fill="none" stroke="#7e3a1c" strokeWidth="2.4" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" values="-3 -5 -19.5;4 -5 -19.5;-3 -5 -19.5" keyTimes="0;0.5;1" dur="0.7s" repeatCount="indefinite" />
            </path>

            {/* Near leg: stance in the first half-cycle (foot planted,
                body passes over it), swing in the second. */}
            <path fill="none" stroke="#5a4632" strokeWidth="3.6" strokeLinecap="round">
              <animate attributeName="d" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite"
                values="M1 -18 L4 -9 L5 0;M1 -18 L3 -9.5 L0.5 0;M1 -18 L0 -9 L-4.5 -1;M1 -18 L4.5 -10 L0 -3.5;M1 -18 L4 -9 L5 0" />
            </path>
            <ellipse rx="2.7" ry="1.5" fill="#4c3a14">
              <animate attributeName="cx" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="5;0.5;-4.5;0;5" />
              <animate attributeName="cy" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="0;0;-1;-3.5;0" />
            </ellipse>

            {/* The far pole, drawn after the legs on purpose: its
                shaft crosses behind the body from the back hand, and
                at this size the plant only reads if the lower shaft
                and tip stay visible against the trail. */}
            <path fill="none" stroke="#4a5058" strokeWidth="1.9" strokeLinecap="round">
              <animate attributeName="d" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite"
                values="M-5 -21.5 L8 0;M-6 -21 L1 0;M-4 -20 L-6 -0.5;M-4.5 -20.5 L0 -4.5;M-5 -21.5 L8 0" />
            </path>

            {/* Near arm + its pole: plants WITH the far foot at
                mid-cycle, pushes off as the cycle wraps. Elbow stays
                bent; the hand rides the pole grip. */}
            <path fill="none" stroke="#9c4a24" strokeWidth="3.4" strokeLinecap="round">
              <animate attributeName="d" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite"
                values="M4 -29 L7 -25.5 L5.5 -20;M4 -29 L8.5 -25.5 L6.5 -20.5;M4 -29 L10 -26 L8 -21.5;M4 -29 L9 -25.5 L7 -21;M4 -29 L7 -25.5 L5.5 -20" />
            </path>
            <path fill="none" stroke="#565d66" strokeWidth="1.9" strokeLinecap="round">
              <animate attributeName="d" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite"
                values="M5.5 -20 L-6 -0.5;M6.5 -20.5 L1 -4.5;M8 -21.5 L10 0;M7 -21 L2 0;M5.5 -20 L-6 -0.5" />
            </path>
            <circle r="2" fill="#caa06a">
              <animate attributeName="cx" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="5.5;6.5;8;7;5.5" />
              <animate attributeName="cy" calcMode="linear" keyTimes="0;0.25;0.5;0.75;1" dur="1.8s" repeatCount="indefinite" values="-20;-20.5;-21.5;-21;-20" />
            </circle>

            {/* Headwrap tails: two strands streaming behind the head,
                fluttering on their own fast clocks — the wind never
                stops, the whole loop long. */}
            <g transform="translate(-4.2 -38.5)">
              <path d="M0 0 C -5 0.5, -9 3, -12.5 6.5" fill="none" stroke="#e07b2a" strokeWidth="3" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" values="-4;6;-4" keyTimes="0;0.5;1" dur="0.6s" repeatCount="indefinite" />
              </path>
              <path d="M0 1.5 C -4 2, -7 4.5, -9.5 7" fill="none" stroke="#c25e2e" strokeWidth="2.2" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" values="5;-5;5" keyTimes="0;0.5;1" dur="0.45s" repeatCount="indefinite" />
              </path>
            </g>
            {/* Head + rust-orange headwrap (child: head ≈27% of height). */}
            <circle cx="1.5" cy="-37.5" r="5.9" fill="#caa06a" />
            <path d="M-4.4 -37.5 A 5.9 5.9 0 0 1 7.4 -37.5 Z" fill="#e07b2a" />
            <rect x="-4.4" y="-39.8" width="11.8" height="2.4" rx="1.2" fill="#c25e2e" />
          </g>
        </g>
      </g>

      {/* Valley mist over the leg's foot: thick at the loop point
          (his entrance), thin while he climbs. Front of the figure. */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="-6 0;6 0;-6 0" keyTimes="0;0.5;1" dur="18s" repeatCount="indefinite" />
        <ellipse cx="330" cy="452" rx="150" ry="62" fill="url(#tk-mist)">
          <animate attributeName="opacity" values="0.95;0.5;0.22;0.22;0.75;1" keyTimes="0;0.09;0.22;0.9;0.97;1" dur="18s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Mist bank at the leg's top end: thin while he climbs, thick
          at the exit so the reset happens inside it — no jump cut. */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="-5 0;5 0;-5 0" keyTimes="0;0.5;1" dur="18s" repeatCount="indefinite" />
        <ellipse cx="415" cy="312" rx="95" ry="30" fill="url(#tk-mist)">
          <animate attributeName="opacity" values="0.35;0.15;0.15;0.7;1;0.35" keyTimes="0;0.1;0.8;0.88;0.95;1" dur="18s" repeatCount="indefinite" />
        </ellipse>
      </g>
    </svg>
  );
}

/**
 * Full-viewport chart-room atmosphere behind the home screen: brass
 * graticule, topographic contour lines, vignette. Decorative only.
 */
export function AtlasBackdrop() {
  return (
    <div className="atlas-bg" aria-hidden="true">
      <svg
        className="atlas-contours"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M-20,110 C140,80 260,150 420,120 S700,100 830,140" />
          <path d="M-20,150 C140,120 260,190 420,160 S700,140 830,180" />
          <path d="M-20,470 C160,440 300,510 470,480 S720,460 830,500" />
          <path d="M-20,510 C160,480 300,550 470,520 S720,500 830,540" />
          <path d="M120,300 c40,-55 130,-55 170,0 c40,55 -40,110 -85,80 c-45,-30 -110,-25 -85,-80 Z" />
          <path d="M150,300 c28,-38 92,-38 120,0 c28,38 -28,76 -60,56 c-32,-20 -78,-18 -60,-56 Z" />
          <path d="M620,380 c40,-55 130,-55 170,0 c40,55 -40,110 -85,80 c-45,-30 -110,-25 -85,-80 Z" />
          <path d="M650,380 c28,-38 92,-38 120,0 c28,38 -28,76 -60,56 c-32,-20 -78,-18 -60,-56 Z" />
          <path d="M540,180 c30,-42 100,-42 130,0 c30,42 -30,84 -65,62 c-35,-22 -85,-20 -65,-62 Z" />
        </g>
      </svg>
    </div>
  );
}
