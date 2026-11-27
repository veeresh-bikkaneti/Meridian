import type { Starter } from "@/game/starters";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase } from "@/game/run";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { ChallengeComplete } from "./challenge-complete";

/**
 * Step 12 cure round 2 (TD-06.9): the completion screen's page shell
 * lives HERE in the composer (this file is already in pageLocalMain),
 * with its verdict settle flags. The flags live HERE — local useState in a
 * component that mounts only when the completion screen shows — as
 * they did on main: a second completed challenge starts unsettled
 * because the shell remounts, and no settle state or reset effect
 * lives on the long-lived PlayLoaded branch during play. The Grandpa
 * poster/video URLs and the end-of-flow HomeButton still arrive as
 * slots from the composer.
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
}) {
  const [verdictSettled, setVerdictSettled] = useState(false);
  const [verdictSettledByGesture, setVerdictSettledByGesture] = useState(false);
  const settleVerdict = useCallback(() => setVerdictSettled(true), []);
  const settleVerdictByGesture = useCallback(() => {
    setVerdictSettled(true);
    setVerdictSettledByGesture(true);
  }, []);
  const incomingWinner = run.challengeWinner ?? null;
  return (
    <section
      className="mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 pt-2 pb-8"
      data-verdict-settled={incomingWinner ? verdictSettled : undefined}
      onClick={incomingWinner ? settleVerdictByGesture : undefined}
      onKeyDown={incomingWinner ? settleVerdictByGesture : undefined}
    >
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
        settled={verdictSettled}
        settledByGesture={verdictSettledByGesture}
        onSettle={settleVerdict}
        onSettleByGesture={settleVerdictByGesture}
      />
    </section>
  );
}

