import { Component, createRef, type ReactNode } from "react";
import { ErrorScreen } from "@/components/ui/error-screen";
import {
  attemptGuardedChunkReload,
  isChunkLoadError,
  markChunkReloadNotice,
  shouldReportChunkFailure,
} from "@/lib/chunk-recovery";
import {
  clearPersistedScreenOpen,
  isPersistedScreen,
  rearmPersistedScreenOpen,
} from "@/lib/persisted-screen";
import { emitMapError } from "@/lib/observability";
import { isNewBuildDeployed } from "@/game/build-staleness";
import { CURRENT_BUILD_ID } from "@/game/build-staleness";
import { staleRefreshRecentlyUsed } from "@/game/build-staleness";
import { hashForScreen } from "@/lib/screen-hash";

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
 * problem keeps the neutral card. For a chunk-load failure with a
 * stale verdict the boundary also issues the guarded one-time reload
 * itself (attemptGuardedChunkReload): the chunk-recovery handler
 * (#245) defers to this card's stale copy as "the app's own offer",
 * so without this the two recoveries deadlock and only a manual tap
 * recovers (the 2026-11-17 LoopScreen crash). When the guard refuses
 * — the episode already reloaded once — this card remains the
 * player's own visible, tappable recovery for as long as it is on
 * screen.
 *
 * The Refresh offer is one-shot per tab, like every other stale
 * surface: `meridian.staleRefresh` (the same key game-app.tsx uses)
 * is set when the player taps Refresh, and while it is set the probe
 * is skipped — if the refreshed tab STILL fails, the build is broken,
 * not stale, and the neutral card is the honest answer.
 *
 * PR 3 Step 3.9 (owner-approved 2026-11-17): the card IS the shared
 * ErrorScreen in its embedded mode — the panel alone, in place,
 * with no page header. The Home exit is passed only for the
 * persisted screens (INV2 below): the bare-map usage sits inside
 * a run in progress, its reload restores that run, and a Home
 * button there would lie. Both cards' copy rides the title/body
 * props word for word — the stale wording is owner-approved and
 * does not change.
 *
 * Item 7 (INV1/INV2): GeoDetective and Cold Trail persist an "open"
 * flag that boot reads to restore the screen, so a load failure
 * used to trap the player — every later visit restored the broken
 * screen, and Try again's reload restored it too. For those two
 * surfaces the catch clears the persisted flag (see
 * src/lib/persisted-screen.ts), so the next visit lands on Home;
 * the card gains a Home control beside Try again / Refresh, and
 * Try again re-arms the flag before reloading so the retry — and
 * only the retry — restores the screen for one more attempt.
 */

/** One-shot stale-refresh guard key — must match game-app.tsx's
 *  STALE_REFRESH_KEY (pinned together in map-error-boundary.test.ts). */
const STALE_REFRESH_KEY = "meridian.staleRefresh";
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
  // F1b: the player chose Home — a stale probe that resolves after
  // this must not re-arm or reload the failed screen behind them.
  private exitChosen = false;
  // F1d: a chunk failure whose report was suppressed at catch (the
  // guarded reload gets the first failure in silence). If the player
  // abandons the screen via Home instead, the failure is genuine and
  // unrecovered — goHome emits the deferred report before leaving.
  private suppressedChunkError: Error | null = null;

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
    // Item 7 (INV1): a persisted screen that failed to load must not
    // be restored on the next visit — clear its open flag now, so
    // any later visit lands on Home. No-op for other surfaces.
    clearPersistedScreenOpen(this.props.surface);
    // Leave a trace for diagnosis; the UI below is what the player sees.
    console.error("[meridian] satellite map failed:", error);
    this.reportError(error);
    this.startStaleProbe(error);
  }

  /** Observability: report on the shared endpoint-gated path (name +
   *  truncated message only — see src/lib/observability.ts). No-op
   *  until an endpoint is configured in flags.json.
   *
   *  A chunk-load failure is the exception: it is recoverable version
   *  skew until proven otherwise, and the guarded reload (the
   *  chunk-recovery handler, or this boundary's own stale-probe path
   *  below) gets the first failure in silence — a skew the reload
   *  heals must not file a crash report. The failure is reported
   *  only when it is the post-reload repeat: a fresh chunk-reload
   *  stamp in sessionStorage means a guarded reload already happened
   *  and the chunk still failed, so the build is genuinely broken.
   *  When storage itself is unreadable the reload cannot be verified
   *  either, so the failure is reported rather than swallowed. */
  private reportError(error: Error): void {
    if (!isChunkLoadError(error)) {
      emitMapError(error);
      return;
    }
    // F3: the shared discipline — report only the post-reload repeat
    // for THIS surface (a fresh stamp whose companion record does not
    // name a different surface), or when storage is unreadable.
    let report: boolean;
    try {
      report = shouldReportChunkFailure(
        window.sessionStorage,
        Date.now(),
        this.props.surface ?? "the map",
      );
    } catch {
      report = true;
    }
    if (report) {
      this.suppressedChunkError = null;
      emitMapError(error);
    } else {
      // Held for F1d: emitted by goHome if the player abandons the
      // screen; a healed reload never files it.
      this.suppressedChunkError = error;
    }
  }

  /** #210: ask once per error whether a newer build is deployed.
   *  Skipped when this tab already refreshed once for staleness —
   *  the one-shot guard the other stale surfaces use. */
  private startStaleProbe(error: Error): void {
    if (this.probedFor === error) return;
    this.probedFor = error;
    // F6: the one-shot guard is time-bound now — a mark older than
    // the window (or the legacy "1") no longer skips the probe.
    if (staleRefreshRecentlyUsed()) return;
    const probe = this.props.probeStaleBuild ?? isNewBuildDeployed;
    void probe()
      .then((stale) => {
        if (!this.unmounted && stale) this.setState({ staleBuild: true });
        // F1b: Home was chosen while the probe was in flight — the
        // player's exit wins; no re-arm, no reload.
        if (!this.unmounted && !this.exitChosen && stale && isChunkLoadError(error)) {
          // Confirmed chunk skew recovers itself (2026-11-17): the
          // guarded one-time reload onto the fresh shell. This card's
          // own stale copy makes the chunk-recovery handler stand
          // down (it defers to any on-screen stale offer), so leaving
          // the reload to that handler deadlocks — the player stays
          // on this card unless they tap Refresh. If the guard
          // refuses (this episode already reloaded once, or the
          // stamp could not be verified), the stale card just set
          // above remains as the manual path. The persisted screen is
          // re-armed inside the reload, so the fresh shell restores
          // the screen the player asked for.
          attemptGuardedChunkReload({
            buildId: CURRENT_BUILD_ID,
            surface: this.props.surface ?? "the map",
            beforeReload: () => rearmPersistedScreenOpen(this.props.surface),
          });
        }
      })
      .catch(() => {
        // Fail closed: a probe problem keeps the neutral card.
      });
  }

  private focusAlert(): void {
    this.alertRef.current?.focus({ preventScroll: true });
  }

  private retry = (): void => {
    // Item 7: the catch cleared the failed screen's persisted open
    // flag; re-arm it so this reload — the player's own retry —
    // restores the screen for one more attempt. A later visit that
    // is not a retry lands on Home instead.
    rearmPersistedScreenOpen(this.props.surface);
    // Reload: the only recovery that actually re-fetches the chunk (see the
    // doc comment above). The boot restores the run from sessionStorage, so
    // the player's game survives the reload intact. Leave the notice flag
    // first, so the reloaded page explains itself exactly as an
    // auto-reload does (chunk-recovery, manifest D9). A stale-card Refresh
    // also arms the one-shot guard, so a still-broken refreshed tab gets
    // the neutral card instead of an endless Refresh prompt.
    markChunkReloadNotice();
    if (this.state.staleBuild) {
      try {
        // F6: a timestamp, not "1" — readers honour it only inside
        // the freshness window (staleRefreshRecentlyUsed).
        window.sessionStorage.setItem(STALE_REFRESH_KEY, String(Date.now()));
      } catch {
        // Storage full/blocked — the reload still happens.
      }
    }
    window.location.reload();
  };

  private goHome = (): void => {
    // Item 7 (INV2): the way out that is not a retry. The failed
    // screen's persisted open flag was cleared at catch time (and
    // is cleared again here), so the reload boots to Home.
    // F1b: cancel any in-flight stale probe's reload first.
    this.exitChosen = true;
    clearPersistedScreenOpen(this.props.surface);
    // F1d: a chunk failure suppressed at catch is reported now —
    // the player is abandoning the screen, so no recovery will heal
    // it; a genuine failure must not vanish. (Tab-close stays
    // unreported: an accepted residual, noted in the PR body.)
    if (this.suppressedChunkError) {
      const deferred = this.suppressedChunkError;
      this.suppressedChunkError = null;
      emitMapError(deferred);
    }
    // F1c: strip the failed screen's hash before reloading — boot's
    // deep-link reader would otherwise resurrect the screen from
    // #geodetective / #coldtrail. Mirror game-app's hash effect:
    // Home's hash is hashForScreen("home").
    try {
      window.history.replaceState(null, "", hashForScreen("home") ?? "#home");
    } catch {
      try {
        window.location.hash = hashForScreen("home") ?? "#home";
      } catch {
        // Hash rewrite is best-effort; the cleared flags still land Home.
      }
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      const surface = this.props.surface ?? "the map";
      // Item 7 (INV2): persisted screens (GeoDetective, Cold Trail)
      // get a Home control beside the retry — the exit that does
      // not restore the broken screen.
      const persisted = isPersistedScreen(this.props.surface);
      return (
        <div
          ref={this.alertRef}
          role="alert"
          tabIndex={-1}
          data-map-error-card=""
          data-surface={surface}
          className="absolute inset-0 flex items-center justify-center bg-bg p-6 focus:outline-none"
        >
          {this.state.staleBuild ? (
            <ErrorScreen
              embedded
              onRetry={this.retry}
              onHome={persisted ? this.goHome : undefined}
              title="A new version of Meridian is available."
              body="Your game is safe — this tab is running an older copy. Refresh to get the new version and keep playing."
              actions={{ retryLabel: "Refresh" }}
            />
          ) : (
            <ErrorScreen
              embedded
              onRetry={this.retry}
              onHome={persisted ? this.goHome : undefined}
              title={`Couldn’t load ${surface}.`}
              body="Your game is safe — it just didn’t finish loading. Check your connection, then try again."
              actions={{ retryLabel: "Try again" }}
            />
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
