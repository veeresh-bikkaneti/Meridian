/**
 * EarnedBadgeRow.tsx — earned badges shown on the home page card.
 *
 * Owner 2026-10-09: badges display ON the home page card — no separate
 * Passport page. Reads the device-local earned list
 * (`meridian.passport.badges.v1`); the home menu remounts when a loop
 * screen closes, so this is always fresh on return.
 *
 * Cosmetic ONLY: badge name + blurb. No points, no band state, no
 * age numbers, no easy/hard language — the band stays invisible.
 */

import { useEffect, useRef, useState } from "react";
import autoAnimate from "@formkit/auto-animate";
import {
  earnedPassportBadges,
  getPassportBadge,
} from "@/game/passport/badges";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function EarnedBadgeRow() {
  // Read once on mount: home remounts after every loop, so this is fresh.
  const [earned] = useState(() => earnedPassportBadges());
  // #113 BLOCK: the blurb lived in a hover-only `title` tooltip — unreachable
  // on touch. Tapping a chip toggles its blurb as visible text instead.
  const [openId, setOpenId] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const rowRef = useRef<HTMLDivElement | null>(null);

  // auto-animate: badge chips and blurb expand/collapse animate automatically.
  // Skipped under prefers-reduced-motion.
  useEffect(() => {
    if (reducedMotion) return;
    const el = rowRef.current;
    if (!el) return;
    const controls = autoAnimate(el);
    // destroy() (not disable()): disconnects the MutationObserver,
    // ResizeObserver and the 2s poll interval, and drops the element from
    // the library's module-level parents set. disable() leaves all of
    // those live, leaking one observer set per home remount.
    return () => controls.destroy?.();
  }, [reducedMotion]);

  if (earned.length === 0) return null;

  return (
    <div
      ref={rowRef}
      className="atlas-badges"
      data-testid="earned-badges"
      role="list"
      aria-label="Badges you've earned"
    >
      {earned.map((b) => {
        const def = getPassportBadge(b.id);
        if (!def) return null;
        const open = openId === b.id;
        return (
          <span key={b.id} role="listitem">
            <button
              type="button"
              className="atlas-badge-chip"
              aria-expanded={open}
              aria-label={`${def.name}. ${open ? "Hide" : "Show"} badge details.`}
              data-testid={`badge-chip-${b.id}`}
              onClick={() => setOpenId(open ? null : b.id)}
            >
              <span aria-hidden="true">🏅</span> {def.name}
            </button>
            {open ? (
              <span className="atlas-badge-blurb" data-testid={`badge-blurb-${b.id}`}>
                {def.blurb}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
