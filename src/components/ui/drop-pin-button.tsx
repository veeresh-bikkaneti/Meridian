import { MapPin } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

export type DropPinAim = { lon: number; lat: number };

/**
 * The explicit, accessible commit path (double-tap / double-click also
 * commits). Floating bottom-center pill, rendered by SatelliteMap as a map
 * overlay.
 *
 * - Visible but disabled until a pin is placed (M12): discoverability of the
 *   commit path beats hiding it; disabled-until-placed teaches tap-then-drop.
 * - Native <button>: Tab-reachable, Enter/Space activates, >=44px hit area.
 * - Press: vibrate(10) (guarded) + :active scale(0.98); the commit itself is
 *   answered by the reveal camera + result card.
 * - Ready pulse: when a pin is first placed, the button emits one 600ms
 *   gold glow pulse — "you can commit now". Skipped under reduced motion
 *   (the global kill-switch zeroes the animation).
 */
export function DropPinButton(props: {
  aim: DropPinAim | null;
  onDrop: (lon: number, lat: number) => void;
}): JSX.Element {
  const hintId = "drop-pin-hint";
  const disabled = props.aim === null;
  const [readyPulse, setReadyPulse] = useState(false);
  const wasDisabled = useRef(disabled);

  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      setReadyPulse(true);
      const t = setTimeout(() => setReadyPulse(false), 650);
      return () => clearTimeout(t);
    }
    wasDisabled.current = disabled;
  }, [disabled]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        aria-label="Drop pin and lock in your guess"
        aria-describedby={disabled ? hintId : undefined}
        onClick={() => {
          const aim = props.aim;
          if (!aim) return;
          if (typeof navigator.vibrate === "function") navigator.vibrate(10);
          props.onDrop(aim.lon, aim.lat);
        }}
        className={`pointer-events-auto flex min-h-[44px] min-w-[160px] items-center justify-center gap-2 rounded-full border border-white/10 bg-[rgba(10,12,16,0.72)] px-6 py-3 text-base font-semibold text-white opacity-100 backdrop-blur-[14px] transition-opacity duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${
          readyPulse ? "meridian-ready-pulse" : ""
        }`}
      >
        <MapPin aria-hidden="true" size={20} />
        Drop pin
      </button>
      {disabled && (
        <span id={hintId} className="sr-only">
          Place a pin on the map first.
        </span>
      )}
    </>
  );
}
