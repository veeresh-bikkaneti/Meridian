import { useEffect, useState } from "react";

/**
 * Shared reduced-motion hook (spec §7.4).
 *
 * SSR-safe: when `window` (or `matchMedia`) is unavailable the hook returns
 * `false` and never throws. Subscribes to the media-query change event so a
 * mid-session OS setting flip is honored without a reload.
 *
 * Note: reduced motion mutes *animation*, never *sound* — the sound toggle
 * is the sound control (spec §4.6).
 */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function queryMatches(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(queryMatches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    // Re-read here: the setting may have changed between render and effect.
    setReduced(mql.matches);
    const onChange = (event: MediaQueryListEvent): void => setReduced(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
