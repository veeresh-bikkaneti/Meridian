import { lazy, type ComponentProps, type JSX } from "react";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import { writeLoopOpen } from "./store";

/**
 * GeoDetectiveHost.tsx — the GeoDetective screen host (game-app-map
 * step 15, TD-06.11).
 *
 * Owns what GameApp used to hold inline for GeoDetective: the
 * React.lazy LoopScreen and the leave wiring — clearing this
 * area's persisted open flag, then the shell's close callback.
 * GameApp keeps only the open state and the render site's Suspense
 * + MapErrorBoundary wrappers (the boundary is a components/root
 * module; the composer owns it until it moves to layer 6 — the
 * TD-06.6 age-profile host split).
 *
 * LoopScreen stays lazy: it statically imports LoopMap, which
 * value-imports maplibre-gl (~1.1 MB) and its stylesheet, so the
 * screen loads only when the player opens GeoDetective, never on
 * boot. The screen has no default export, so the lazy factory
 * adapts its named export.
 *
 * The props are LoopScreen's own, derived by type query (a type
 * query is not a runtime edge): the shell hands the host its close
 * callback and its celebration callback; the host wraps the first
 * with the flag clear and passes the second through untouched.
 */

const loadLoopScreen = () => import("@/game/loop/LoopScreen");
// #209: the load is raced against CHUNK_LOAD_TIMEOUT_MS (inside
// withChunkTimeout) — a HUNG import never settles, so without the
// race the Suspense fallback at the render site would spin forever;
// with it, the race rejection lands in MapErrorBoundary's
// recoverable card instead.
const LoopScreen = lazy(() =>
  withChunkTimeout(loadLoopScreen(), "GeoDetective screen").then((m) => ({
    default: m.LoopScreen,
  })),
);

type GeoDetectiveHostProps = ComponentProps<
  (typeof import("@/game/loop/LoopScreen"))["LoopScreen"]
>;

export function GeoDetectiveHost({ onLeave, onCelebrate }: GeoDetectiveHostProps): JSX.Element {
  return (
    <LoopScreen
      onLeave={() => {
        writeLoopOpen(false);
        onLeave();
      }}
      onCelebrate={onCelebrate}
    />
  );
}
