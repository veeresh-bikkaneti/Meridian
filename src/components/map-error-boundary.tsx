import { Component, createRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { emitMapError } from "@/lib/observability";
import { isNewBuildDeployed } from "@/game/build-staleness";

/**
 * Error boundary around the lazily-loaded screens and map (P0 Safari
 * launch fix). A chunk-load failure (stale hashed URL after a deploy,
 * flaky connection, CDN hiccup) — or a post-load render error inside
 * the wrapped screen — must never strand the player on a blank page:
 * this renders a user-friendly retry card instead.
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
 *
 * #210: the card answers the question the player is actually asking —
 * "is this tab just old?" When the error lands, the boundary probes
 * `isNewBuildDeployed()` (the same probe openRun and LoopScreen use):
 *
 * - Stale build → the card becomes the owner-approved update prompt
 *   ("A new version of Meridian is available." + Refresh), the same
 *   words as every other stale surface, instead of a generic failure.
 * - Anything else → destination-neutral copy naming the wrapped
 *   surface (`surface` prop): this boundary wraps GeoDetective and
 *   Cold Trail as well as the map, and "Couldn't load the map" was
 *   simply wrong on those screens.
 *
 * The probe never blocks the card: the neutral card renders at once
 * and swaps in place if the probe lands stale (the probe itself is
 * bounded at 8 s inside build-staleness). It fails closed — any probe
 * problem keeps the neutral card. While the separate chunk-recovery
 * handler (#245) may auto-reload a stale tab on its own schedule,
 * this card remains the player's own visible, tappable recovery for
 * as long as it is on screen.
 */
export class MapErrorBoundary extends Component<
  {
    children: ReactNode;
    /** What this boundary wraps, for the neutral card's heading:
     *  "the map" (default), "GeoDetective", "Cold Trail", … */
    surface?: string;
    /** Test seam: substitute the staleness probe. Defaults to the
     *  real build-meta probe. */
    probeStaleBuild?: () => Promise<boolean>;
  },
  { error: Error | null; staleBuild: boolean }
> {
  state = { error: null as Error | null, staleBuild: false };
  private alertRef = createRef<HTMLDivElement>();
  private probedFor: Error | null = null;
  private unmounted = false;

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidMount(): void {
    // The chunk can fail on the very first render (the boundary then mounts
    // already holding the error) — move focus to the alert either way.
    if (this.state.error) {
      this.focusAlert();
      this.startStaleProbe(this.state.error);
    }
  }

  componentDidUpdate(
    _prevProps: { children: ReactNode },
    prevState: { error: Error | null; staleBuild: boolean },
  ): void {
    // When the fallback appears, move focus to it so screen-reader and
    // keyboard users land on the recovery UI instead of a silent blank.
    if (this.state.error && !prevState.error) this.focusAlert();
    if (this.state.error) this.startStaleProbe(this.state.error);
  }

  componentWillUnmount(): void {
    this.unmounted = true;
  }

  componentDidCatch(error: Error): void {
    // Leave a trace for diagnosis; the UI below is what the player sees.
    console.error("[meridian] satellite map failed:", error);
    // Observability: report on the shared endpoint-gated path (name +
    // truncated message only — see src/lib/observability.ts). No-op
    // until an endpoint is configured in flags.json.
    emitMapError(error);
    this.startStaleProbe(error);
  }

  /** #210: ask once per error whether a newer build is deployed. */
  private startStaleProbe(error: Error): void {
    if (this.probedFor === error) return;
    this.probedFor = error;
    const probe = this.props.probeStaleBuild ?? isNewBuildDeployed;
    void probe()
      .then((stale) => {
        if (!this.unmounted && stale) this.setState({ staleBuild: true });
      })
      .catch(() => {
        // Fail closed: a probe problem keeps the neutral card.
      });
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
      const surface = this.props.surface ?? "the map";
      return (
        <div
          ref={this.alertRef}
          role="alert"
          tabIndex={-1}
          className="absolute inset-0 flex items-center justify-center bg-bg p-6 focus:outline-none"
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
            {this.state.staleBuild ? (
              <>
                <p className="text-base font-semibold text-fg">
                  A new version of Meridian is available.
                </p>
                <p className="mt-1 text-sm text-muted">
                  Your game is safe &mdash; this tab is running an older
                  copy. Refresh to get the new version and keep playing.
                </p>
                <div className="mt-4 flex justify-center">
                  <Button type="button" onClick={this.retry}>
                    Refresh
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-fg">
                  Couldn&rsquo;t load {surface}.
                </p>
                <p className="mt-1 text-sm text-muted">
                  Your game is safe &mdash; it just didn&rsquo;t finish
                  loading. Check your connection, then try again.
                </p>
                <div className="mt-4 flex justify-center">
                  <Button type="button" onClick={this.retry}>
                    Try again
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
