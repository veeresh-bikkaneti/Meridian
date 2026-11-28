import type { Starter } from "@/game/starters";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase } from "@/game/run";
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { ChallengeComplete } from "./challenge-complete";

/**
 * B1 (TD-06.16): the completion screen's verdict settle flags live in
 * the composer (game-app.tsx), which owns the single `<main>` — the
 * `<main>` carries `data-verdict-settled` and the settle gesture
 * handlers, so the DOM matches main. The flags arrive here as props
 * (settled / settledByGesture / onSettle / onSettleByGesture) and are
 * passed through to ChallengeComplete; this shell renders no wrapper
 * element, so the verdict content sits directly in the composer's
 * `<main>`, as it did on main. The Grandpa poster/video URLs and the
 * end-of-flow HomeButton still arrive as slots from the composer.
 * A second completed challenge starts unsettled because the composer
 * resets the flags when the verdict branch deactivates.
 */
export function ChallengeCompleteShell({
  run,
  total,
  onDone,
  onRetry,
  shareEnabled,
  regionCatalog,
  posterUrl,
  videoUrl,
  homeButton,
  settled,
  settledByGesture,
  onSettle,
  onSettleByGesture,
}: {
  run: Run;
  total: number;
  onDone: () => void;
  /** Verdict-screen Retry (Package B): replay the received route at
   * once. Only offered when the route carried a winner block. */
  onRetry?: () => void;
  /** The completion re-share renders only while the flag is on: a flag
   * flipped off mid-challenge drops the share, never the run (§4). */
  shareEnabled: boolean;
  /** The completed route's OWN region catalog (Package B, §1(f)).
   * Null while the catalog has not loaded. */
  regionCatalog?: readonly Starter[] | null;
  /** Grandpa clip URLs + the end-of-flow HomeButton, passed in as
   * slots from the composer (see the module header). */
  posterUrl: string;
  videoUrl: string;
  homeButton: ReactNode;
  /** Verdict settle flags, owned by the composer (B1). */
  settled: boolean;
  settledByGesture: boolean;
  onSettle: () => void;
  onSettleByGesture: () => void;
}) {
  return (
    <ChallengeComplete
      run={run}
      total={total}
      onDone={onDone}
      onRetry={onRetry}
      shareEnabled={shareEnabled}
      regionCatalog={regionCatalog}
      posterUrl={posterUrl}
      videoUrl={videoUrl}
      homeButton={homeButton}
      settled={settled}
      settledByGesture={settledByGesture}
      onSettle={onSettle}
      onSettleByGesture={onSettleByGesture}
    />
  );
}
