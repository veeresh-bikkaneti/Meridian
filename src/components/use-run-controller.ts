import { useCallback, type RefObject } from "react";
import {
  startRun,
  resumeRun,
  type Edition,
  type Run,
} from "@/game/run";
import { type PickerDifficulty } from "@/game/tier-filter";
import { dealingPoolFor } from "@/game/easy-curation";
import {
  wasClearedCelebrated,
  markClearedCelebrated,
  clearClearedMark,
} from "@/game/trail";
import {
  TUTORIAL_PLACE_ID,
  markTutorialSeen,
  type TutorialBeat,
} from "@/game/tutorial";
import {
  REVIEW_DECK_REGION_ID,
  REVIEW_DECK_REGION_NAME,
  dueEntries,
  emptyReviewDeck,
  readReviewDeck,
} from "@/game/review-deck";
import { preloadTerritory } from "@/game/territory";
import { placesFor } from "@/game/generated-places";
import { trailDate, type DiscardedNotice } from "@/game/shell-helpers";
import { type ClearedInfo } from "./cleared-celebration";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";
import {
  setSessionStorageItem,
} from "../platform/storage/browser-storage.ts";
import { stampCleanExitDirty } from "@/game/clean-exit";
import { recordMilestone, emitEvent, sanitizeError } from "@/lib/observability";
import { safePlay, soundAudible } from "@/game/audio/play-guards";
import { playEditionEntrance } from "@/game/audio/sfx";
import {
  preloadAdmin1Boundaries,
  preloadAdmin1ForCountry,
  admin1ChunkIso2ForRegion,
} from "@/game/reverse-geocode";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import { isChunkLoadError, shouldReportChunkFailure } from "@/lib/chunk-recovery";
import { resolveSession } from "../game/storage-slot.ts";
import { isNewBuildDeployed, staleRefreshRecentlyUsed } from "@/game/build-staleness";

/** The starting (region-loading) state shape. */
export type RunStarting = {
  edition: Edition;
  regionId: string;
  regionName: string;
  choice: PickerDifficulty;
};

/** The start-error state shape. */
export type RunStartError = {
  message: string;
  staleBuild: boolean;
  edition: Edition;
  regionId: string;
  regionName: string;
  choice: PickerDifficulty;
};

/**
 * The shell-owned setters and helpers the run controller needs.
 * Setters that are only ever set to null are typed narrowly.
 */
export type RunControllerDeps = {
  runStartGenRef: RefObject<number>;
  setRun: (run: Run | null) => void;
  setMenu: (value: null) => void;
  setStarting: (s: RunStarting | null) => void;
  setStartError: (e: RunStartError | null) => void;
  setTutorial: (t: TutorialBeat | null) => void;
  setCleared: (c: ClearedInfo | null) => void;
  setDiscardedNotice: (n: DiscardedNotice | null) => void;
  ensureSession: (run: Run | null) => void;
  difficultyChoice: PickerDifficulty;
  readRun: () => Run | null;
  poolForRunStart: (
    allPlaces: { id: string }[],
    edition: Edition,
    regionId: string,
    choice: PickerDifficulty,
  ) => { poolIds: string[]; prevLastId: string | null; cycleCompleted: boolean };
  globeTierSplitFor: (edition: Edition, regionId: string) => Promise<boolean>;
};

function writeRun(run: Run) {
  try {
    // Each challenge format persists to its OWN slot (pausedRunMc3,
    // pausedRunMc2) so a build from before that format existed never
    // sees its saves (§Q1-A4); everything else keeps the shipped slot.
    const def =
      run.challengeOrigin === "mc3"
        ? STORAGE_KEYS.pausedRunMc3
        : run.challengeOrigin === "mc2"
          ? STORAGE_KEYS.pausedRunMc2
          : STORAGE_KEYS.pausedRun;
    setSessionStorageItem(def, run);
    // Crash-loop breaker: this page now holds unsaved-crash state. If the
    // process is killed without unloading, the next boot must not
    // auto-resume; `pagehide` clears this flag on every clean unload.
    stampCleanExitDirty();
  } catch {
    // The run still lives in memory when storage is blocked.
  }
}

/**
 * Step 7 — run controller (`commit`, `openRun`, `startReview`).
 * Owns the run lifecycle. `openRun` still awaits `preloadTerritory()`
 * before a run commits, still honors `runStartGenRef`, and still skips
 * territory preload for review runs. `commit` stays the one writer
 * that pairs `writeRun` + `setRun`.
 */
export function useRunController(deps: RunControllerDeps) {
  const {
    runStartGenRef,
    setRun,
    setMenu,
    setStarting,
    setStartError,
    setTutorial,
    setCleared,
    setDiscardedNotice,
    ensureSession,
    difficultyChoice,
    readRun,
    poolForRunStart,
    globeTierSplitFor,
  } = deps;

  const commit = useCallback((next: Run) => {
    writeRun(next);
    setRun(next);
    // A new or continued run retires any boot discard notice: the
    // notice describes a game that is gone, and returning home later
    // (Editions) must not resurrect it beside the fresh game.
    setDiscardedNotice(null);
  }, [setRun, setDiscardedNotice]);

  const openRun = useCallback(
    async (
      edition: Edition,
      regionId: string,
      regionName: string,
      choice: PickerDifficulty,
      opts?: { fresh?: boolean; tutorial?: boolean },
    ) => {
      // BLOCK-A: stamp this start (see runStartGenRef). A manual
      // map-mode switch — or a newer start — bumps the generation and
      // makes this one stale; the checks after the awaits below then
      // bail instead of committing a run nobody is waiting for.
      const gen = ++runStartGenRef.current;
      // Edition entrance fanfare: the player is making their grand arrival
      // into an edition (gladiator-into-the-arena energy). Not for the
      // tutorial (quiet practice round).
      if (!opts?.tutorial && soundAudible()) safePlay(playEditionEntrance);
      setStarting({ edition, regionId, regionName, choice });
      setStartError(null);
      recordMilestone("run_start", { edition, regionId, chunkId: regionId });
      // D1: arm the clean-exit dirty marker NOW, before the data-chunk
      // load below — not only later in writeRun/commit.
      stampCleanExitDirty();
      try {
        // The region's chunk(s) load here — never eagerly, never partial.
        recordMilestone("data_chunk_load_start", { edition, regionId, chunkId: regionId });
        const tierSplit = await globeTierSplitFor(edition, regionId);
        if (gen !== runStartGenRef.current) return; // stale (BLOCK-A)
        // F2b: the countries-50m territory data loads in parallel with
        // the places and is awaited before the run commits.
        const [places] = await withChunkTimeout(
          Promise.all([
            placesFor(edition, regionId, choice, tierSplit),
            preloadTerritory(),
          ]),
          `places for ${regionName}`,
        );
        if (gen !== runStartGenRef.current) return; // stale (BLOCK-A)
        recordMilestone("data_loaded", { edition, regionId, chunkId: regionId });
        const dateKey = trailDate();
        let poolIds: string[];
        let prevLastId: string | null;
        if (opts?.tutorial) {
          poolIds = [TUTORIAL_PLACE_ID];
          prevLastId = null;
        } else {
          const banded = dealingPoolFor(places, choice);
          const started = poolForRunStart(banded, edition, regionId, choice);
          poolIds = started.poolIds;
          prevLastId = started.prevLastId;
          if (started.cycleCompleted) {
            if (wasClearedCelebrated(edition, regionId, choice)) {
              clearClearedMark(edition, regionId, choice);
            } else {
              markClearedCelebrated(edition, regionId, choice);
              setCleared({ edition, regionId, regionName, choice });
            }
          }
        }
        const today = { edition, regionId, regionName, dateKey, difficultyChoice: choice };
        const next =
          opts?.tutorial || opts?.fresh
            ? startRun(today, poolIds, prevLastId)
            : resumeRun(readRun(), today, poolIds, prevLastId);
        commit(next);
        // Switching editions keeps the session (and its score) alive: a new
        // session starts only when none is live.
        ensureSession(next);
        setMenu(null);
        setTutorial(opts?.tutorial ? 1 : null);
        if (opts?.tutorial) {
          markTutorialSeen();
        }
        window.setTimeout(() => {
          void preloadAdmin1Boundaries();
          const chunkIso2 = admin1ChunkIso2ForRegion(regionId);
          if (chunkIso2) void preloadAdmin1ForCountry(chunkIso2);
        }, 10000);
      } catch (err) {
        // BLOCK-A: a stale start fails silently.
        if (gen !== runStartGenRef.current) return;
        const message = `Could not load places for ${regionName}: ${err instanceof Error ? err.message : String(err)}`;
        let staleBuild = false;
        try {
          staleBuild = !staleRefreshRecentlyUsed() && (await isNewBuildDeployed());
        } catch {
          staleBuild = false;
        }
        if (gen !== runStartGenRef.current) return;
        setStartError({
          message: staleBuild ? message : `We couldn't open ${regionId === "globe" ? "the Globe" : regionName} right now. Check that you're online, then tap Play again.`,
          staleBuild,
          edition,
          regionId,
          regionName,
          choice,
        });
        let reportStartError = true;
        if (isChunkLoadError(err) || isChunkLoadError(message)) {
          try {
            reportStartError = shouldReportChunkFailure(resolveSession() ?? null, Date.now());
          } catch {
            reportStartError = true;
          }
        }
        if (reportStartError) {
          emitEvent({
            type: "js_error",
            ts: Date.now(),
            buildId: "",
            error: sanitizeError(new Error(message)),
          });
        }
      } finally {
        // Only the current start owns the loading state (BLOCK-A).
        if (gen === runStartGenRef.current) setStarting(null);
      }
    },
    [commit, ensureSession, runStartGenRef, setStarting, setStartError, setMenu, setTutorial, setCleared, poolForRunStart, globeTierSplitFor],
  );

  /**
   * Start a review session over the currently-due deck cards. The session is
   * a synthetic Run (regionId "review-deck") whose pool is the due queue in
   * due order. Deliberately no ensureSession: review answers never bank
   * into the session — review is practice, not scoring.
   */
  const startReview = useCallback(() => {
    const deck = readReviewDeck() ?? emptyReviewDeck();
    const due = dueEntries(deck, Date.now());
    if (due.length === 0) return;
    // F2b: review runs skip openRun (and its awaited territory preload);
    // start the load here.
    void preloadTerritory();
    const next = startRun(
      {
        edition: "globe",
        regionId: REVIEW_DECK_REGION_ID,
        regionName: REVIEW_DECK_REGION_NAME,
        dateKey: trailDate(),
        difficultyChoice,
      },
      due.map((entry) => entry.place.id),
      null,
    );
    commit(next);
    setMenu(null);
  }, [commit, difficultyChoice, setMenu]);

  return { commit, openRun, startReview };
}
