import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

/**
 * On-screen +/- zoom controls (P0-02). Bottom-right, stacked, frosted chrome
 * matching the map overlays. Custom buttons (not MapLibre NavigationControl)
 * so they match the chrome tokens and announce via aria-live.
 *
 * The zoom itself is user-invoked, so the parent passes `essential: true`
 * (UX 4.6): it animates even under prefers-reduced-motion.
 */
export function ZoomControls(props: {
  /** Current zoom, rounded — announced politely after a button press (M10). */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}): JSX.Element {
  const [announcement, setAnnouncement] = useState("");
  const announceNext = useRef(false);

  useEffect(() => {
    if (announceNext.current) {
      announceNext.current = false;
      setAnnouncement(`Zoom level ${props.zoom}`);
    }
  }, [props.zoom]);

  const press = (dir: 1 | -1) => {
    announceNext.current = true;
    if (dir === 1) props.onZoomIn();
    else props.onZoomOut();
  };

  const buttonClass =
    "pointer-events-auto flex h-[44px] w-[44px] items-center justify-center rounded-full " +
    "border border-white/10 bg-[rgba(10,12,16,0.72)] text-white backdrop-blur-[14px] " +
    "transition-all duration-150 hover:border-white/25 hover:bg-[rgba(20,24,32,0.85)] " +
    "hover:shadow-[0_0_16px_rgba(242,193,78,0.25)] active:scale-[0.98]";

  return (
    <div
      className="pointer-events-none absolute right-[10px] z-20 flex flex-col gap-2"
      style={{ bottom: "max(10px, env(safe-area-inset-bottom, 0px))" }}
    >
      <button type="button" aria-label="Zoom in" onClick={() => press(1)} className={buttonClass}>
        <Plus aria-hidden="true" size={22} />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => press(-1)} className={buttonClass}>
        <Minus aria-hidden="true" size={22} />
      </button>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
