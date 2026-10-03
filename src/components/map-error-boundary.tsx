import { Component, createRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary around the lazily-loaded SatelliteMap (P0 Safari launch
 * fix). A chunk-load failure (stale hashed URL after a deploy, flaky
 * connection, CDN hiccup) — or a post-load render error inside the map —
 * must never strand the player on a blank page: this renders a
 * user-friendly retry card instead.
 *
 * "Try again" is NOT a plain state reset: React.lazy caches the factory's
 * rejected promise per component type (the factory runs only while the
 * payload is still pending, so after a rejection every render of the same
 * lazy() throws the cached error). The parent therefore passes `onRetry`,
 * which mints a FRESH React.lazy component whose factory re-invokes the
 * dynamic import; the boundary clears its own error state alongside. (If
 * `onRetry` is omitted, retry only clears the state — a chunk failure would
 * then re-throw the cached rejection, so always pass it for lazy chunks.)
 * "Reload" falls back to a full page reload. The run state is untouched —
 * retrying never loses the game in progress.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode; onRetry?: () => void },
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
    _prevProps: { children: ReactNode; onRetry?: () => void },
    prevState: { error: Error | null },
  ): void {
    // When the fallback appears, move focus to it so screen-reader and
    // keyboard users land on the recovery UI instead of a silent blank.
    if (this.state.error && !prevState.error) this.focusAlert();
  }

  componentDidCatch(error: Error): void {
    // Leave a trace for diagnosis; the UI below is what the player sees.
    console.error("[meridian] satellite map failed:", error);
  }

  private focusAlert(): void {
    this.alertRef.current?.focus({ preventScroll: true });
  }

  private retry = (): void => {
    // onRetry first: the parent mints the fresh lazy component, then the
    // boundary clears its error so the new component renders (React batches
    // both updates into one pass).
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  private reload = (): void => {
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
            <div className="mt-4 flex justify-center gap-2">
              <Button type="button" onClick={this.retry}>
                Try again
              </Button>
              <Button type="button" variant="secondary" onClick={this.reload}>
                Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
