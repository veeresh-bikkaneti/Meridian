/**
 * WhyLearnWorld — the Living Atlas page world for the Why Learn
 * picker (feat/why-learn-living-atlas, the owner's pick, 2026-11-14).
 *
 * The home hero's mountain painting becomes this page's world: the
 * band sits at the top of the screen behind the header and the hero
 * card, sliced exactly like the home hero's wrap (the same art file,
 * object-fit: cover / right bottom), and the montage wash already on
 * the page continues underneath it. The painting itself never moves.
 *
 * The two overlays are the home hero's own, composed here a second
 * time because they live as private components inside game-app.tsx
 * and the picker is a lazy chunk that must not import the app shell:
 * WorldTrailOverlay is HeroTrailOverlay (the dotted trail marching
 * on the painted switchbacks, the gold pulse climbing it, two cloud
 * banks drifting at 28 s / 40 s, the summit flag waving at 2.2 s)
 * and WorldTrekkerOverlay is HeroTrekkerOverlay (the child trekker
 * on the same one 18 s SMIL master clock, poles planting as he
 * climbs one switchback leg). Geometry, clocks and gates are the
 * home components' own; only the class names are wl-scoped for
 * this page's stylesheet, and the cloud banks drift a short
 * back-and-forth instead of a full scene width, for the reason
 * recorded at the banks themselves. The gates mirror the
 * originals: prefers-reduced-motion (the shared hook, live on OS
 * flips), Save-Data, or deviceMemory ≤ 2 land on the still — the
 * trail drawn but unmoving, the trekker frozen mid-climb — and no
 * pause button is added: continuous decorative loops sit under the
 * owner's autoloop order (2026-11-03), with these gates as the
 * stops that remain, the tradeoff CardFilm records.
 *
 * The band is decoration: aria-hidden, pointer-events none, and it
 * is display:none wherever the page's other art is off (the
 * high-contrast / forced-colors rules in styles.css).
 */
import { useEffect, useRef, useState } from "react";
import heroMountainUrl from "@/assets/home-v5/hero-mountain.webp";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function WhyLearnWorld() {
  return (
    <div className="wl-world" aria-hidden="true">
      <img className="wl-world-img" src={heroMountainUrl} alt="" />
      <WorldTrailOverlay />
      <WorldTrekkerOverlay />
    </div>
  );
}

function WorldTrailOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [staticGate] = useState<boolean>(wlStaticGateAtMount);
  const reduced = reducedMotion || staticGate;
  const trail =
    "M322 528 C 305 500, 345 480, 350 460 C 355 438, 300 432, 292 408 C 284 384, 312 362, 340 350 C 375 336, 415 340, 408 318 C 402 298, 380 285, 402 268 C 428 248, 486 240, 512 226 C 532 215, 500 200, 492 182 C 486 166, 498 148, 503 134";
  return (
    <svg
      className={reduced ? "wl-trail wl-trail-still" : "wl-trail"}
      viewBox="0 0 800 533"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="wl-cloud-soft" x="-40%" y="-40%" width="180%" height="180%">
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
        className="wl-trail-dots"
        opacity="0.95"
      />
      {!reduced ? (
        <g className="wl-clouds" aria-hidden="true">
          {/* Cloud banks, adapted from the home hero's in one
              respect: on Home each bank is a doubled pattern that
              drifts a full scene width (±800 units), which puts
              SVG geometry outside the page box — fine on Home,
              but this screen carries a no-clipped-elements
              guarantee at phone widths (its E2E spec measures
              every descendant's rect against the viewport). Here
              the banks keep the home shapes, heights and opacities
              with every ellipse inside the painting's frame, and
              drift a short ±24 units back and forth on the same
              28 s / 40 s clocks (styles.css, wl-clouddrift-a/b). */}
          <g className="wl-cloud-drift-a" filter="url(#wl-cloud-soft)" fill="#fdfbf3">
            <ellipse cx="150" cy="118" rx="120" ry="17" opacity="0.32" />
            <ellipse cx="235" cy="106" rx="80" ry="13" opacity="0.26" />
            <ellipse cx="90" cy="108" rx="60" ry="12" opacity="0.22" />
            <ellipse cx="560" cy="238" rx="130" ry="15" opacity="0.2" />
            <ellipse cx="645" cy="228" rx="75" ry="11" opacity="0.16" />
          </g>
          <g className="wl-cloud-drift-b" filter="url(#wl-cloud-soft)" fill="#fdfbf3">
            <ellipse cx="330" cy="168" rx="105" ry="14" opacity="0.24" />
            <ellipse cx="405" cy="158" rx="65" ry="10" opacity="0.19" />
            <ellipse cx="160" cy="268" rx="95" ry="12" opacity="0.15" />
          </g>
        </g>
      ) : null}
      {!reduced ? (
        <g className="wl-trail-pulse">
          <path
            d={trail}
            fill="none"
            stroke="#e9cd7d"
            strokeWidth="7"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="10 90"
            opacity="0.55"
            className="wl-pulse-tail"
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
          <circle r="13" fill="#b8932f" opacity="0.28" className="wl-pulse-halo">
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
            className="wl-pulse-core"
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
        <g className="wl-trail-flag">
          <line x1="503" y1="134" x2="503" y2="106" stroke="#4c3a14" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M503 107 L525 112 L503 118 Z" fill="#8a6d2f" />
        </g>
      </g>
    </svg>
  );
}

const TREKKER_CLIMB_PATH =
  "M294 406 C 288 386, 315 362, 342 351 C 368 340, 398 336, 402 321";

function wlStaticGateAtMount(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  const mem = nav.deviceMemory;
  return typeof mem === "number" && mem > 0 && mem <= 2;
}

function WorldTrekkerOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [staticGate] = useState<boolean>(wlStaticGateAtMount);
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
      className="wl-trekker"
      viewBox="0 0 800 533"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="wl-tk-mist" cx="50%" cy="50%" r="50%">
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
        <ellipse cx="330" cy="452" rx="150" ry="62" fill="url(#wl-tk-mist)">
          <animate attributeName="opacity" values="0.95;0.5;0.22;0.22;0.75;1" keyTimes="0;0.09;0.22;0.9;0.97;1" dur="18s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Mist bank at the leg's top end: thin while he climbs, thick
          at the exit so the reset happens inside it — no jump cut. */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="-5 0;5 0;-5 0" keyTimes="0;0.5;1" dur="18s" repeatCount="indefinite" />
        <ellipse cx="415" cy="312" rx="95" ry="30" fill="url(#wl-tk-mist)">
          <animate attributeName="opacity" values="0.35;0.15;0.15;0.7;1;0.35" keyTimes="0;0.1;0.8;0.88;0.95;1" dur="18s" repeatCount="indefinite" />
        </ellipse>
      </g>
    </svg>
  );
}
