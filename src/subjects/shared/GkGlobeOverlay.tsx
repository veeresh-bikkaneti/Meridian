/**
 * GkGlobeOverlay — motion for the general-knowledge card, which has
 * no film (feat/why-learn-living-atlas; the media note lives in
 * src/assets/why-learn/subject-card-media.ts: three attempts to
 * animate the relief map redrew it, and a film that redraws the map
 * teaches a wrong map).
 *
 * So the card takes its motion the way the home hero takes its own:
 * the painting never moves, and the motion lives in overlay layers
 * above it. The still itself is never filtered, tinted or
 * transformed. Above the pristine map, in the map's own image space
 * (viewBox 0 0 200 100, sliced like the img's object-fit: cover):
 *
 * - two soft cloud banks drift across the top on the home hero's
 *   clocks (28 s and 40 s, opposite phases; a short back-and-forth
 *   travel, so no overlay geometry ever leaves the card's box);
 * - a dotted route arcs from Iberia (90, 28) across the Atlantic to
 *   a North-America east-coast port (48.5, 30.5), its dots marching
 *   on the hero's 3 s cycle; on the card's spotlight turn the route
 *   draws itself in over 1.5 s (the .is-spot rule in styles.css);
 * - the pin drops on that port — 450 ms with the home pin's
 *   overshoot curve, exactly one 600 ms pulse ring — once after
 *   the page settles, and again on each spotlight turn (the picker
 *   passes the turn count; a remount on it replays the drop).
 *
 * Gates: under prefers-reduced-motion the overlay does not render
 * at all (the still stands alone), and an IntersectionObserver
 * pauses every animation while the card is off screen, the same
 * off-screen rule the card films follow. The whole layer is
 * aria-hidden decoration and takes no clicks.
 */
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function GkGlobeOverlay({ spotTurns }: { spotTurns: number }) {
  const reducedMotion = usePrefersReducedMotion();
  // 0 = the pin has not dropped yet; each later value remounts the
  // pin group (the key below) and replays its drop + ring.
  const [dropKey, setDropKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  // The first drop lands once the page has settled (the approved
  // mock's timing), not during the cards' entrance cascade.
  useEffect(() => {
    const t = setTimeout(() => setDropKey(1), 1750);
    return () => clearTimeout(t);
  }, []);

  // Each spotlight turn drops the pin again.
  useEffect(() => {
    if (spotTurns > 0) setDropKey(spotTurns + 1);
  }, [spotTurns]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setPaused(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  if (reducedMotion) return null;

  return (
    <span ref={rootRef} className={`wl-gk-over${paused ? " wl-gk-paused" : ""}`} aria-hidden="true">
      <svg className="wl-gk-cloud wl-gk-cloud-a" viewBox="0 0 200 90" preserveAspectRatio="none" fill="#ffffff">
        <ellipse cx="36" cy="32" rx="30" ry="10" />
        <ellipse cx="64" cy="23" rx="20" ry="8" />
        <ellipse cx="122" cy="17" rx="24" ry="8" />
        <ellipse cx="152" cy="27" rx="18" ry="7" />
        <ellipse cx="10" cy="21" rx="16" ry="6" />
      </svg>
      <svg className="wl-gk-cloud wl-gk-cloud-b" viewBox="0 0 200 90" preserveAspectRatio="none" fill="#ffffff">
        <ellipse cx="82" cy="36" rx="34" ry="11" />
        <ellipse cx="108" cy="27" rx="22" ry="8" />
        <ellipse cx="172" cy="21" rx="20" ry="7" />
        <ellipse cx="22" cy="27" rx="18" ry="7" />
      </svg>
      <svg className="wl-gk-map" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <clipPath id="wl-gk-routeclip">
            <rect className="wl-gk-cliprect" x="0" y="0" width="200" height="100" />
          </clipPath>
        </defs>
        <g clipPath="url(#wl-gk-routeclip)">
          <path
            className="wl-gk-dots"
            d="M90 28 Q69 15 48.5 30.5"
            fill="none"
            stroke="#f7ead0"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeDasharray="0.1 5.5"
          />
          <circle cx="90" cy="28" r="1.6" fill="#f7ead0" stroke="#a5761f" strokeWidth=".5" />
          <circle cx="48.5" cy="30.5" r="1.6" fill="#f7ead0" stroke="#a5761f" strokeWidth=".5" />
        </g>
        <g key={dropKey} className={dropKey > 0 ? "wl-gk-pinwrap dropping" : "wl-gk-pinwrap"}>
          <circle className="wl-gk-ring" cx="48.5" cy="30.5" r="2" fill="none" stroke="#b3372a" strokeWidth="1.1" />
          <g transform="translate(48.5 30.5)">
            <g className="wl-gk-pin">
              <path
                d="M0 0 C-4.6-6.2-6.6-9.4-6.6-13 A6.6 6.6 0 1 1 6.6-13 C6.6-9.4 4.6-6.2 0 0Z"
                fill="#b3372a"
              />
              <circle cx="0" cy="-13" r="2.7" fill="#fdf6e0" />
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
