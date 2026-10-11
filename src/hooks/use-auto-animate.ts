import { useEffect, useState } from "react";
import autoAnimate from "@formkit/auto-animate";
import type { AutoAnimateOptions } from "@formkit/auto-animate";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion.ts";

/**
 * Shared auto-animate hook — the single place enter/exit/move transitions
 * are enabled across Meridian (GeoDetective lists, sheets, case cards...).
 *
 * Wraps @formkit/auto-animate (pinned EXACT at 0.10.0 — the security-audited
 * build; no caret in package.json). Follows the EarnedBadgeRow pattern:
 * enable in an effect, destroy() (not disable()) on cleanup so the
 * MutationObserver / ResizeObserver / poll interval are disconnected and
 * the element leaves the library's module-level parents set.
 *
 * KID-SAFETY (non-negotiable, educational game):
 * - prefers-reduced-motion: reduce → autoAnimate is NEVER called. Content
 *   appears instantly and stays fully interactive. The hook listens for
 *   mid-session OS setting flips (via usePrefersReducedMotion), so a kid
 *   toggling the setting takes effect without a reload: animation turns
 *   off (controls destroyed) the moment the query matches.
 * - Motion profile: transform/opacity WAAPI keyframes only (the library's
 *   defaults); default duration 200ms, ease-out — cheap on mobile GPUs.
 *
 * TIMING CONTRACTS (chained-timer law): enabling/disabling animation lives
 * in this hook's OWN dedicated effect, keyed on [reducedMotion, element].
 * It is never chained with narration sync, tour sequencing, or any other
 * state transition — host components only attach the returned ref.
 *
 * The `animate` parameter exists for tests (dependency injection); hosts
 * always call useAutoAnimate() with no arguments.
 */

export const AUTO_ANIMATE_DEFAULTS: AutoAnimateOptions = {
  duration: 200,
  easing: "ease-out",
};

export type AutoAnimateFn = typeof autoAnimate;

export function useAutoAnimate<T extends HTMLElement>(
  options: Partial<AutoAnimateOptions> = AUTO_ANIMATE_DEFAULTS,
  animate: AutoAnimateFn = autoAnimate,
): (instance: T | null) => void {
  const reducedMotion = usePrefersReducedMotion();
  // Callback ref via state setter: refires on mount/unmount so the effect
  // below always sees the live element (or null after unmount).
  const [el, setEl] = useState<T | null>(null);

  // Dedicated effect — one effect per transition (chained-timer law).
  useEffect(() => {
    // Reduced motion: do not enable anything. Content renders instantly.
    if (reducedMotion || el === null) return;
    const controls = animate(el, options);
    return () => {
      // destroy() (not disable()): disconnects observers + the poll
      // interval and drops the element from the module-level parents set.
      controls.destroy?.();
    };
  }, [reducedMotion, el, options, animate]);

  return setEl;
}
