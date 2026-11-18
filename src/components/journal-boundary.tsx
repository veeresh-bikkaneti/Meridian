import { Component, type ReactNode } from "react";

// Journal player shell — the lazy chunk's fail-closed error boundary.
// This module is intentionally light (no journal-player import) so
// game-app can bundle it in the main chunk while the player stays lazy.
//
// Arena F4: JournalPlayer's chunk failure used to unmount the whole
// app to the router error page, taking Home with it. In the spirit of
// storyteller-banner-shell.tsx, this boundary fails closed instead:
// on chunk/load/render failure the journal entry keeps its text and
// simply has no player — Home never breaks. Reporting flows through
// the global handlers' chunk discipline (chunk-recovery's
// shouldReportChunkFailure, applied in observability.ts): this
// boundary deliberately emits nothing itself.

interface JournalBoundaryState {
  failed: boolean;
}

export class JournalBoundary extends Component<
  { children: ReactNode },
  JournalBoundaryState
> {
  state: JournalBoundaryState = { failed: false };

  static getDerivedStateFromError(): JournalBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Fail closed — reporting is the global handlers' job (see above).
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
