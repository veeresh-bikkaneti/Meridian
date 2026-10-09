import { Component, type ReactElement, type ReactNode } from "react";
import { storytellerFigureUrl } from "./storyteller-lines";
import "./storyteller-home.css";

// Storyteller banner shell — the lazy chunk's loading skeleton and error
// boundary. This module is intentionally light (no storyteller-home import)
// so game-app can bundle it in the main chunk while the host stays lazy.
//
// Owner directive 2026-10-09: the storyteller sits IN THE BANNER beside the
// Meridian branding — always visible, mobile and desktop. If the lazy chunk
// fails, the banner fails closed to a static, silent figure rather than
// breaking home.

/** 56px placeholder while the host chunk loads (aria-hidden, no layout jump). */
export function StorytellerBannerSkeleton(): ReactElement {
  return <span className="storyteller-banner-skeleton" aria-hidden="true" />;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * Error boundary around the banner host. On chunk/load/render failure the
 * banner keeps a static figure (silent, non-interactive) — home never breaks.
 */
export class StorytellerBannerBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Fail closed — the crash reporter (watchdog) already captures the error.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <span className="storyteller-banner-static" aria-hidden="true">
          <img src={storytellerFigureUrl()} alt="" decoding="async" />
        </span>
      );
    }
    return this.props.children;
  }
}
