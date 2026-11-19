import { Component, type JSX, type ReactNode } from "react";
import { TILE_FALLBACK_COPY } from "@/map/tile-fallback-copy.ts";
import { emitMapError } from "@/lib/observability";
import { isWebgl2Unavailable } from "@/lib/webgl2-unavailable";

/**
 * The one line that takes the map's place when the GeoDetective map is off
 * (WS-4 Phase 1). role="status" so screen readers announce it once.
 * `copy` lets a surface whose play depends on the map (Cold Trail) show
 * its own truthful line instead of the GeoDetective one, which promises
 * that clues and guesses still work.
 */
export function LoopMapOffLine({
  copy = TILE_FALLBACK_COPY.loopMapOff,
}: {
  copy?: string;
} = {}): JSX.Element {
  return (
    <p role="status" className="m-0 px-1 text-sm text-muted">
      {copy}
    </p>
  );
}

/**
 * If the GeoDetective map cannot start (for example, no WebGL, which makes
 * MapLibre's constructor throw), the loop keeps running with the same line
 * instead of crashing the screen. The clue, guess box and feedback do not
 * depend on the map.
 *
 * Reporting (arena-narrowed): a contained failure is logged to the console
 * always. It is ALSO filed as a crash report via emitMapError — except
 * when the failure is the permanent WebGL2 gap, which is a device limit,
 * not a bug: that one stays console-only, exactly as before. The boundary
 * never rethrows; the fallback renders either way. (The predicate lives
 * in the leaf module src/lib/webgl2-unavailable.ts so this boundary does
 * not import the satellite-map stack.)
 */
export class LoopMapBoundary extends Component<
  {
    children: ReactNode;
    /** Fired once from componentDidCatch, whatever the failure was. */
    onFailed?: () => void;
    /** Takes the map's place on failure (default: LoopMapOffLine). */
    fallback?: ReactNode;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("[meridian] GeoDetective map failed to start:", error);
    this.props.onFailed?.();
    if (!isWebgl2Unavailable(error)) emitMapError(error);
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? <LoopMapOffLine />;
    return this.props.children;
  }
}
