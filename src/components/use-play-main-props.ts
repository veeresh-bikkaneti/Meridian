/**
 * B1 (TD-06.16): the composer's single `<main>` carries the active
 * screen's class + data attributes, so the DOM matches main (where
 * each branch rendered its own `<main>`). The values the composer
 * cannot derive itself arrive from the screens:
 * - `playPlaces`: Play reports its loaded places (keyed); the
 *   composer derives the Play branch (loading / review-complete /
 *   verdict / map) from `run` + the pool, exactly as PlayLoaded
 *   does. A key mismatch reads as "loading" — never the previous
 *   run's branch for one frame.
 * - `verdictSettled` / `verdictSettledByGesture`: the challenge
 *   verdict settle flags, owned here so the `<main>` can carry
 *   `data-verdict-settled` and the settle gesture handlers. They
 *   reset when the verdict branch deactivates (effect below), so a
 *   second completed challenge starts unsettled, as on main.
 *
 * Lives in its own hook (not in game-app.tsx) so the composer's
 * line count stays under the shrink-only ceiling.
 */
import { useCallback, useEffect, useState } from "react";
import { CHALLENGE_REGION_ID } from "@/game/challenge";
import { placesLoadKey } from "@/game/places-load-key";
import { resolveRunPool } from "@/game/pool";
import type { Run } from "@/game/run";
import { isChallengeRun, isReviewRun } from "@/game/shell-helpers";
import type { Starter } from "@/game/starters";

export function usePlayMainProps(run: Run | null) {
  const [playPlacesState, setPlayPlacesState] = useState<{
    key: string;
    places: Starter[] | null;
  } | null>(null);
  const [verdictSettled, setVerdictSettled] = useState(false);
  const [verdictSettledByGesture, setVerdictSettledByGesture] = useState(false);
  const settleVerdict = useCallback(() => setVerdictSettled(true), []);
  const settleVerdictByGesture = useCallback(() => {
    setVerdictSettled(true);
    setVerdictSettledByGesture(true);
  }, []);
  // The Play branch's `<main>` props, derived here so the composer's
  // single `<main>` carries them. Mirrors Play / PlayLoaded's branch
  // order exactly (poolError and loading share the loading `<main>`;
  // main rendered no `<main>` for the pool-error branch, but the shell
  // owns exactly one, so the loading `<main>` stands in for it).
  // `playPlaces` is the composer's mirror of Play's loaded catalog,
  // gated on the load key (same formula as Play) so a run change
  // reads as "loading" synchronously — never the previous run's
  // branch for one frame.
  const playLoadKey = run
    ? isChallengeRun(run)
      ? `${CHALLENGE_REGION_ID}:${run.poolIds.join(",")}`
      : placesLoadKey(run.edition, run.regionId, run.difficultyChoice)
    : null;
  const playPlaces =
    playPlacesState !== null && playLoadKey !== null && playPlacesState.key === playLoadKey
      ? playPlacesState.places
      : null;
  const playBranch = run
    ? !playPlaces
      ? "loading"
      : isReviewRun(run) && run.index >= resolveRunPool(playPlaces, run.poolIds).length
        ? "review"
        : isChallengeRun(run) &&
            (run.index >= resolveRunPool(playPlaces, run.poolIds).length ||
              run.phase === "summary")
          ? "verdict"
          : "map"
    : null;
  const playMainProps =
    playBranch === "loading"
      ? {
          className:
            "mode-screen mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col justify-center px-5 py-8",
        }
      : playBranch === "review" || playBranch === "verdict"
        ? {
            className:
              "mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 pt-2 pb-8",
            ...(playBranch === "verdict"
              ? {
                  "data-verdict-settled":
                    run?.challengeWinner != null ? verdictSettled : undefined,
                  onClick: run?.challengeWinner != null ? settleVerdictByGesture : undefined,
                  onKeyDown: run?.challengeWinner != null ? settleVerdictByGesture : undefined,
                }
              : {}),
          }
        : playBranch === "map"
          ? { className: "relative h-dvh bg-bg" }
          : null;
  // A second completed challenge starts unsettled: when the verdict
  // branch deactivates, the flags reset, so the next activation reads
  // false before ChallengeCompleteShell reports in.
  useEffect(() => {
    if (playBranch !== "verdict") {
      setVerdictSettled(false);
      setVerdictSettledByGesture(false);
    }
  }, [playBranch]);
  return {
    playMainProps,
    setPlayPlacesState,
    verdictSettled,
    verdictSettledByGesture,
    settleVerdict,
    settleVerdictByGesture,
  };
}
