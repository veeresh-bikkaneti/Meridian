import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary around the lazily-loaded SatelliteMap (P0 Safari launch
 * fix). A chunk-load failure (stale hashed URL after a deploy, flaky
 * connection, CDN hiccup) must never strand the player on a blank page:
 * this renders a user-friendly retry card instead. "Try again" re-attempts
 * the dynamic import (remounting the React.lazy component re-invokes its
 * factory); "Reload" falls back to a full page reload. The run state is
 * untouched — retrying never loses the game in progress.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Leave a trace for diagnosis; the UI below is what the player sees.
    console.error("[meridian] satellite map chunk failed to load:", error);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-bg p-6"
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-base font-semibold text-fg">
              Couldn&rsquo;t load the map.
            </p>
            <p className="mt-1 text-sm text-muted">
              Your game is safe &mdash; only the map download failed. Check
              your connection and try again.
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
