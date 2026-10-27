/** Storage key for a future palette toggle. This module does not read or write it. */
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
