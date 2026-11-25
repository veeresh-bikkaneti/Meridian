import { lazy, type JSX } from "react";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import { writeColdTrailOpen } from "./store";

/**
 * ColdTrailHost.tsx — the Cold Trail screen host (game-app-map
 * step 14, TD-06.10).
 *
 * Owns what GameApp used to hold inline for Cold Trail: the
 * React.lazy TrailScreen and the leave wiring — clearing this
 * area's persisted open flag, then the shell's close callback.
 * GameApp keeps only the open state and the render site's Suspense
 * + MapErrorBoundary wrappers (the boundary is a components/root
 * module; the composer owns it until it moves to layer 6 — the
 * TD-06.6 age-profile host split).
 *
 * TrailScreen stays lazy: it statically imports LoopMap, which
 * value-imports maplibre-gl (~1.1 MB) and its stylesheet, so the
 * screen loads only when the player opens Cold Trail, never on
 * boot. The screen has no default export, so the lazy factory
 * adapts its named export.
 */

const loadTrailScreen = () => import("@/game/coldtrail/TrailScreen");
// #209: the load is raced against CHUNK_LOAD_TIMEOUT_MS (inside
// withChunkTimeout) — a HUNG import never settles, so without the
// race the Suspense fallback at the render site would spin forever;
// with it, the race rejection lands in MapErrorBoundary's
// recoverable card instead.
const TrailScreen = lazy(() =>
  withChunkTimeout(loadTrailScreen(), "Cold Trail screen").then((m) => ({
    default: m.TrailScreen,
  })),
);

export function ColdTrailHost({ onLeave }: { onLeave: () => void }): JSX.Element {
  return (
    <TrailScreen
      onLeave={() => {
        writeColdTrailOpen(false);
        onLeave();
      }}
    />
  );
}
