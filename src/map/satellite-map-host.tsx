import { lazy, Suspense, type ComponentProps } from "react";
import { withChunkTimeout } from "@/lib/chunk-timeout";

/**
 * The lazy satellite map, owned HERE (TD-06.15b): the play view under
 * `src/components/` must not import `@/map/**`, so the composer passes
 * this host in as a slot (`mapHost`) and the play view renders it with
 * its own internal map props. The chunk stays lazy: MapLibre loads on
 * demand, behind Suspense + MapErrorBoundary at the render site. The
 * boundary's "Try again" reloads the page: re-rendering a React.lazy
 * after a chunk failure rethrows its cached rejection, and even a fresh
 * import() of the same failed URL is negatively cached by the browser
 * for the life of the document — only a reload genuinely re-fetches the
 * chunk. The run is restored from session storage on boot, so the game
 * survives the reload.
 */
const SatelliteMap = lazy(() =>
  withChunkTimeout(import("@/map/satellite-map"), "Satellite map"),
);

/**
 * Suspense fallback while the lazy satellite-map chunk downloads. Mirrors
 * the in-map tile-loading pill's spinner styling (`.meridian-spinner`).
 */
function MapLoadingFallback() {
  return (
    <div
      role="status"
      data-testid="map-loading"
      className="absolute inset-0 flex items-center justify-center bg-bg"
    >
      <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-2.5 pr-5 pl-3.5 text-sm font-medium text-fg">
        <span
          aria-hidden="true"
          className="meridian-spinner block h-4 w-4 rounded-full border-2 border-muted/40 border-t-fg"
        />
        Loading map&hellip;
      </div>
    </div>
  );
}

export type SatelliteMapHostProps = ComponentProps<typeof SatelliteMap>;

/**
 * Renders the lazy satellite map behind its loading fallback. The
 * error boundary stays at the render site (the play view), so a chunk
 * failure still shows the retry UI instead of a blank page.
 */
export function SatelliteMapHost(props: SatelliteMapHostProps) {
  return (
    <Suspense fallback={<MapLoadingFallback />}>
      <SatelliteMap {...props} />
    </Suspense>
  );
}
