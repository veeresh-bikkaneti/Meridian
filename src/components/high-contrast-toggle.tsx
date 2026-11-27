/**
 * HighContrastToggle (TD-06.15a): the high-contrast view toggle,
 * extracted from game-app.tsx as a pure move.
 *
 * High-contrast view toggle (manifest 2026-10-27): the SoundToggle
 * pattern for the map palette — persisted under `meridian.palette`
 * (PALETTE_STORAGE_KEY), default OFF (standard), one instance in the
 * home hero and one in the game chrome, each reading the persisted
 * value on mount. Flipping it repaints the map IN PLACE via the
 * palette-preference module (data-palette attribute + the
 * meridian:palette-change event): unlike the Scout Map switch it
 * never ends a game and never navigates, because the palette is a
 * paint choice, not a map-build input. A corrupt stored value fails
 * closed to standard inside selectPalette — the toggle just shows
 * OFF.
 *
 * A slot component: Play and Home render it directly, so the toggle
 * is never passed down through the composer as a prop.
 */
import { useState, type CSSProperties } from "react";
import { Contrast } from "lucide-react";
import {
  isHighContrastEnabled,
  setHighContrastEnabled,
} from "@/game/palette-preference";

export type HighContrastToggleProps = {
  testId: string;
  className?: string;
  style?: CSSProperties;
  iconClassName?: string;
};

export function HighContrastToggle({
  testId,
  className,
  style,
  iconClassName = "size-5",
}: HighContrastToggleProps) {
  const [highContrast, setHighContrast] = useState<boolean>(() => isHighContrastEnabled());
  const toggleHighContrast = () => {
    try {
      const next = !highContrast;
      setHighContrastEnabled(next);
      setHighContrast(next);
    } catch {
      // The palette is enhancement-only; the toggle itself never throws.
    }
  };
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={highContrast}
      aria-label={highContrast ? "Turn high contrast off" : "Turn high contrast on"}
      title={highContrast ? "High contrast on" : "High contrast off"}
      onClick={toggleHighContrast}
      // atlas-contrast-toggle: the dedicated class both hosts share, so
      // styles.css can give [aria-pressed="true"] a VISIBLE pressed state
      // (brass fill + filled icon, the .atlas-seg pattern) — aria-pressed
      // alone is invisible to the sighted low-vision users this serves
      // (panel BLOCK 3; manifest Scenarios 1–2: "I can see it pressed").
      className={className ? `atlas-contrast-toggle ${className}` : "atlas-contrast-toggle"}
      style={style}
    >
      <Contrast className={iconClassName} aria-hidden="true" />
      {/* Visible text label (item 37): the control was icon-only, so a
          sighted player had no way to know what it does. The word rides
          beside the icon in both hosts; the hosts' classes give it room
          (the hero host is min-width 44px inline-flex, the game host is
          min-w-11 with padding). */}
      <span className="text-sm font-medium">Contrast</span>
    </button>
  );
}
