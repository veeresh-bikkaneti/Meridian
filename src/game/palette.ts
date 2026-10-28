/** Storage key for the palette toggle (shipped in game-app.tsx). This module does not read or write it. */
export const PALETTE_STORAGE_KEY = "meridian.palette";

export type MapPalette = {
  water: string;
  land: string;
  arc: string;
  lake: string;
  coast: string;
};

/** Live dark-theme map tokens from src/styles.css (:root and data-theme="night"). */
export const STANDARD: MapPalette = {
  water: "#10262e",
  land: "#3c4a3c",
  arc: "#f4f1ea",
  lake: "#1c5160",
  coast: "#0c1816",
};

/**
 * Neutrals for water/land (not blue-vs-green) and a yellow-orange arc.
 * water/land >= 9:1 so one arc can stay >= 3:1 on both.
 */
export const HIGH_CONTRAST: MapPalette = {
  water: "#0b0d10",
  land: "#f6f3ea",
  arc: "#c45c12",
  lake: "#1a1d22",
  coast: "#050608",
};

/**
 * Mark tokens: the colours drawn ON the map surface (pins, answer,
 * highlight, borders, parks, crosshair, lit wash). Added by the
 * council addendum 2026-10-28 (D9): flipping land dark→cream
 * invalidates every dark-land-tuned mark until it is re-measured,
 * so the marks a palette must carry are part of the token contract,
 * not theme leftovers.
 */
export type MapMarkTokens = {
  pin: string;
  answer: string;
  highlight: string;
  border: string;
  park: string;
  cross: string;
  lit: string;
};

/** Today's dark-theme mark values, exactly as styles.css ships them. */
export const STANDARD_MARKS: MapMarkTokens = {
  pin: "#f4f1ea",
  answer: "#f2c14e",
  highlight: "#f2c14e",
  border: "#24302c",
  park: "#1f4d36",
  cross: "#d7ddd9",
  lit: "#6e9084",
};

/**
 * High-contrast marks, adjudicated in the D9 addendum with ratios
 * from this module's contrastRatio: pin/answer/highlight/cross
 * clear 3:1 on HC land, water, AND lake; answer === highlight;
 * border sits in [1.90, 2.00] on land and park in [1.25, 1.50],
 * so boundaries stay subtle under the marks; lit is a pale wash
 * (<=1.45 on land) that the marks still clear 3:1 against.
 */
export const HIGH_CONTRAST_MARKS: MapMarkTokens = {
  pin: "#b04a9e",
  answer: "#a86c00",
  highlight: "#a86c00",
  border: "#beaf8d",
  park: "#cfdcb4",
  cross: "#757575",
  lit: "#f0dca0",
};

/** WCAG 2 relative luminance contrast. Unrounded. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const channel = (start: number): number => {
      const s = parseInt(hex.slice(start, start + 2), 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const lighter = Math.max(lum(a), lum(b));
  const darker = Math.min(lum(a), lum(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Fail closed: only the exact token "high-contrast" selects the high-contrast palette. */
export function selectPalette(raw: unknown): MapPalette {
  if (raw === "high-contrast") return HIGH_CONTRAST;
  return STANDARD;
}
