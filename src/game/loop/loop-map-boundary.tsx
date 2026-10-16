import { Component, type JSX, type ReactNode } from "react";
import { TILE_FALLBACK_COPY } from "@/map/tile-fallback-copy.ts";

/**
 * The one line that takes the map's place when the GeoDetective map is off
 * (WS-4 Phase 1). role="status" so screen readers announce it once.
 */
export function LoopMapOffLine(): JSX.Element {
  return (
    <p role="status" className="m-0 px-1 text-sm text-muted">
      {TILE_FALLBACK_COPY.loopMapOff}
    </p>
  );
}

/**
 * If the GeoDetective map cannot start (for example, no WebGL, which makes
 * MapLibre's constructor throw), the loop keeps running with the same line
 * instead of crashing the screen. The clue, guess box and feedback do not
 * depend on the map.
 */
export class LoopMapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("[meridian] GeoDetective map failed to start:", error);
  }

  render(): ReactNode {
    if (this.state.failed) return <LoopMapOffLine />;
    return this.props.children;
  }
}
