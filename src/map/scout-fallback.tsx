/**
 * Scout Map static fallback (PBI-4) — the last-resort map surface.
 *
 * When even the outline WebGL render fails, satellite-map.tsx swaps the
 * map container for this component: the pre-baked equirectangular world
 * outline (public/scout-fallback.svg, ≤ 100 kB, zero labels) with the
 * pin-drop UI intact. The projection is linear, so taps invert to exact
 * lon/lat — correct coordinate mapping with no camera, no zoom, no tiles.
 *
 * Keyboard parity: arrow keys move a crosshair, Enter/Space places the
 * aim pin (Escape bubbles to the wrapper, which clears the aim). Marks
 * (aim/pin/spot) render from the same prop shape the map uses; the true
 * spot only renders once `revealed` (committed pin), mirroring the map.
 *
 * The mapping helpers are pure and node-testable.
 */

import {
  useCallback,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MapMark } from "./satellite-map.tsx";

export interface FallbackRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Invert a client point inside the fallback box to lon/lat. The SVG is
 * equirectangular with preserveAspectRatio="none", so the mapping is
 * linear and exact. Clamped to the world bounds.
 */
export function fallbackLonLat(clientX: number, clientY: number, rect: FallbackRect): {
  lon: number;
  lat: number;
} {
  const fx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const fy = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  const cx = Math.min(1, Math.max(0, fx));
  const cy = Math.min(1, Math.max(0, fy));
  return { lon: cx * 360 - 180, lat: 90 - cy * 180 };
}

/** Project lon/lat to percentage offsets inside the fallback box. */
export function fallbackXY(lon: number, lat: number): { xPct: number; yPct: number } {
  return { xPct: ((lon + 180) / 360) * 100, yPct: ((90 - lat) / 180) * 100 };
}

/** Resolve the fallback asset URL against the Vite base ("/Meridian/" on Pages). */
export function scoutFallbackUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
    const base = env?.BASE_URL ?? "/";
    const normalized = base.endsWith("/") ? base : `${base}/`;
    return `${normalized}scout-fallback.svg`;
  } catch {
    return "/scout-fallback.svg";
  }
}

const CROSSHAIR_STEP = 1 / 48;
const CROSSHAIR_STEP_SHIFT = 1 / 12;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function ScoutFallbackMap(props: {
  marks?: readonly MapMark[];
  /** True-spot coordinates — rendered only when `revealed` (committed pin). */
  spot?: { lon: number; lat: number } | null;
  revealed?: boolean;
  onAim?: (lon: number, lat: number) => void;
}): JSX.Element {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [crosshair, setCrosshair] = useState<{ fx: number; fy: number } | null>(null);
  const onAimRef = useRef(props.onAim);
  onAimRef.current = props.onAim;

  const placeAt = useCallback((clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { lon, lat } = fallbackLonLat(clientX, clientY, rect);
    onAimRef.current?.(lon, lat);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      placeAt(e.clientX, e.clientY);
    },
    [placeAt],
  );

  const onKeyDown = useCallback((e: ReactKeyboardEvent) => {
    // Escape bubbles to the wrapper (aim-clear); everything else is ours.
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    if (e.key === "Enter" || e.key === " ") {
      const c = crosshair ?? { fx: 0.5, fy: 0.5 };
      onAimRef.current?.(c.fx * 360 - 180, 90 - c.fy * 180);
      return;
    }
    const step = e.shiftKey ? CROSSHAIR_STEP_SHIFT : CROSSHAIR_STEP;
    setCrosshair((prev) => {
      const c = prev ?? { fx: 0.5, fy: 0.5 };
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      return { fx: clamp01(c.fx + dx), fy: clamp01(c.fy + dy) };
    });
  }, [crosshair]);

  const marks = props.marks ?? [];
  const showSpot = props.revealed && props.spot;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-[#070b14]"
      data-testid="scout-fallback"
    >
      <div
        ref={boxRef}
        className="relative aspect-[2/1] max-h-full w-full"
      >
        <img
          src={scoutFallbackUrl()}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
        {/* Tap layer: single tap aims (Drop pin button commits, as on the map). */}
        <div
          role="application"
          aria-roledescription="map"
          aria-label="World outline map. Tap to place your pin, then use the Drop pin button. Arrow keys move the aim crosshair; Enter places the pin."
          tabIndex={0}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="absolute inset-0 cursor-crosshair outline-none"
          style={{ touchAction: "manipulation" }}
        />
        {marks.map((mark, i) => {
          const { xPct, yPct } = fallbackXY(mark.lon, mark.lat);
          const toneClass =
            mark.tone === "aim"
              ? "border-2 border-white bg-transparent"
              : mark.tone === "pin"
                ? "bg-[#f2c14e]"
                : "border-2 border-[#f2c14e] bg-transparent";
          return (
            <div
              key={`${mark.tone}-${i}`}
              aria-hidden="true"
              className={`pointer-events-none absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_rgba(0,0,0,0.55)] ${toneClass}`}
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
            />
          );
        })}
        {showSpot ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#f2c14e] bg-transparent shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
            style={{
              left: `${fallbackXY(props.spot!.lon, props.spot!.lat).xPct}%`,
              top: `${fallbackXY(props.spot!.lon, props.spot!.lat).yPct}%`,
            }}
          />
        ) : null}
        {crosshair ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
            style={{ left: `${crosshair.fx * 100}%`, top: `${crosshair.fy * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
