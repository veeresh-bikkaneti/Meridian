import type { MotionTier } from "./types.ts";

export function getSystemMotionTier(): MotionTier {
  if (typeof window === "undefined") return "flat";

  // Reduced motion strictly collapses to flat per AGENTS.md and motion tokens
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return "flat";

  // Check weak device or Save-Data
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  if (nav.connection?.saveData) return "lite";
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 2) {
    return "lite";
  }

  // Check WebGL availability
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "lite";
  } catch {
    return "lite";
  }

  return "full";
}

