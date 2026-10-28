/**
 * High-contrast view preference — storage + application for the map
 * palette (Council manifest 2026-10-27-high-contrast-view, D2/D7/D8).
 *
 * `palette.ts` stays pure (its test pins it free of storage/DOM), so
 * this module owns the side effects, mirroring the sound toggle in
 * `src/game/audio/sfx.ts`: storage behind try/catch (absent or
 * throwing storage never crashes the game), values in selectPalette's
 * token language ("high-contrast" / "standard") under
 * PALETTE_STORAGE_KEY, and a "meridian:palette-change" CustomEvent —
 * the `meridian:sound-change` precedent — so mounted maps repaint in
 * place on a live swap.
 *
 * Application is one attribute: `data-palette="high-contrast"` on the
 * root element selects the `:root[data-palette="high-contrast"]`
 * block in styles.css, whose --map-* overrides are the HIGH_CONTRAST
 * tokens (a source-pin test keeps the two from drifting). Standard
 * removes the attribute. Fail closed throughout: any unknown stored
 * value resolves to STANDARD via selectPalette.
 */
import {
  HIGH_CONTRAST,
  PALETTE_STORAGE_KEY,
  selectPalette,
  type MapPalette,
} from "./palette.ts";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The stored palette, fail-closed: anything but the exact token is STANDARD. */
export function readPalettePreference(): MapPalette {
  try {
    return selectPalette(storage()?.getItem(PALETTE_STORAGE_KEY));
  } catch {
    return selectPalette(null);
  }
}

export function isHighContrastEnabled(): boolean {
  return readPalettePreference() === HIGH_CONTRAST;
}

function applyPalette(high: boolean): void {
  try {
    if (typeof document !== "undefined") {
      if (high) {
        document.documentElement.setAttribute("data-palette", "high-contrast");
      } else {
        document.documentElement.removeAttribute("data-palette");
      }
    }
  } catch {
    // No DOM (tests, SSR) — the stored value still applies next boot.
  }
  // Same-tab storage events don't fire, so this explicit event is the
  // live-swap channel (the meridian:sound-change precedent in sfx.ts).
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<boolean>("meridian:palette-change", { detail: high }),
      );
    }
  } catch {
    // Non-browser context — no listeners to notify.
  }
}

/** Apply the stored preference (boot, D7). Returns the active palette. */
export function applyPalettePreference(): MapPalette {
  const palette = readPalettePreference();
  applyPalette(palette === HIGH_CONTRAST);
  return palette;
}

/**
 * Persist + apply a toggle flip. The in-session attribute flips even
 * when storage is unavailable (private mode) — the game plays on and
 * the stored value simply won't survive a reload. Never throws.
 */
export function setHighContrastEnabled(on: boolean): void {
  try {
    storage()?.setItem(PALETTE_STORAGE_KEY, on ? "high-contrast" : "standard");
  } catch {
    // Storage unavailable — silent, the in-session apply below still runs.
  }
  applyPalette(on);
}
