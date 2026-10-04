import { Component, createRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { emitMapError } from "@/lib/observability";

/**
 * Error boundary around the lazily-loaded SatelliteMap (P0 Safari launch
 * fix). A chunk-load failure (stale hashed URL after a deploy, flaky
 * connection, CDN hiccup) — or a post-load render error inside the map —
 * must never strand the player on a blank page: this renders a
 * user-friendly retry card instead.
 *
 * "Try again" reloads the whole page — deliberately NOT an in-place
 * re-import. Two platform facts force this: (1) React.lazy caches the
 * factory's rejected promise per component type, so re-rendering the same
 * lazy() rethrows the cached error without any network request; (2) even a
 * FRESH import() of the same failed URL rejects without re-fetching — the
 * browser negatively caches the failed module fetch for the life of the
 * document (verified empirically on Chromium: abort and 404 alike; a
 * second import() of the same URL rejects with zero network activity).
 * Minting a new lazy() per attempt therefore cannot recover. A reload gets
 * a fresh module map and genuinely re-fetches the chunk — and it is also
 * the only recovery for the stale-deploy case (the old hashed URL is gone
 * for good; only a fresh shell has the new one). The run is restored from
 * sessionStorage on boot, so retrying never loses the game in progress.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  private alertRef = createRef<HTMLDivElement>();

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidMount(): void {
    // The chunk can fail on the very first render (the boundary then mounts
    // already holding the error) — move focus to the alert either way.
    if (this.state.error) this.focusAlert();
  }

  componentDidUpdate(
    _prevProps: { children: ReactNode },
    prevState: { error: Error | null },
  ): void {
    // When the fallback appears, move focus to it so screen-reader and
    // keyboard users land on the recovery UI instead of a silent blank.
    if (this.state.error && !prevState.error) this.focusAlert();
  }

  componentDidCatch(error: Error): void {
    // Leave a trace for diagnosis; the UI below is what the player sees.
    console.error("[meridian] satellite map failed:", error);
    // Observability: report on the shared endpoint-gated path (name +
    // truncated message only — see src/lib/observability.ts). No-op
    // until an endpoint is configured in flags.json.
    emitMapError(error);
  }

  private focusAlert(): void {
    this.alertRef.current?.focus({ preventScroll: true });
  }

  private retry = (): void => {
    // Reload: the only recovery that actually re-fetches the chunk (see the
    // doc comment above). The boot restores the run from sessionStorage, so
    // the player's game survives the reload intact.
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          ref={this.alertRef}
          role="alert"
          tabIndex={-1}
          className="absolute inset-0 flex items-center justify-center bg-bg p-6 focus:outline-none"
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-base font-semibold text-fg">
              Couldn&rsquo;t load the map.
            </p>
            <p className="mt-1 text-sm text-muted">
              Your game is safe &mdash; the map just didn&rsquo;t finish
              loading. Check your connection, then try again.
            </p>
            <div className="mt-4 flex justify-center">
              <Button type="button" onClick={this.retry}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
