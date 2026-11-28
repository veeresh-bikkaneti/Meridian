import type { ComponentProps, ComponentType } from "react";
import { PlayLoaded } from "./play-loaded";
import { distanceKm } from "@/game/geo";
import { placesFor, poolSizeFor, storyForBand } from "@/game/generated-places";
import type { Starter } from "@/game/starters";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase } from "@/game/run";
import { isPickerDifficulty, type PickerDifficulty } from "@/game/tier-filter";
import {
  bankPlace,
  clearDiscardedShadow,
  DIFFICULTY_LABELS,
  EDITION_LABELS,
  endSession,
  formatSuccessRate,
  isSessionLive,
  startSession,
  summarizeSession,
  type Session,
  type SessionSummary,
} from "@/game/session";
// Phase 0 shell split (slice 1): pure helpers moved verbatim to
// src/game/shell-helpers.ts; the shell imports them back.
import {
  boundsFor,
  discardedNoticeText,
  isChallengeRun,
  isDrop,
  isEdition,
  isPhase,
  isPlaceResult,
  isReviewRun,
  isScoredPlace,
  runResultsTotals,
  trailDate,
  type DiscardedNotice,
  type Drop,
} from "@/game/shell-helpers";
import { loadedForKey, placesLoadKey, type LoadedFor } from "@/game/places-load-key";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { ErrorScreen } from "@/components/ui/error-screen";
import { ClearedCelebrationDialog, type ClearedInfo } from "./cleared-celebration";
import {
  applyPendingAtBoundary,
  audioMode,
  getAgeGroup,
  isLoopLocked,
  pinToleranceKm,
  resolveBand,
  type AgeBandId,
  type BandRunConfig,
} from "@/game/age-profile";
import {
  emitEvent,
  installGlobalErrorHandlers,
  noteRecoverySignal,
  recordMilestone,
  sanitizeError,
  setObservabilityEndpoint,
  setReportMapMode,
  wasMapAttributedCrash,
} from "@/lib/observability";
import type { MapMode } from "@/lib/map-mode";
import {
  TUTORIAL_EDITION,
  TUTORIAL_REGION_ID,
  TUTORIAL_REGION_NAME,
  hasSeenTutorial,
  markTutorialSeen,
  TUTORIAL_INVITE_DISMISS_EVENT,
  type TutorialBeat,
} from "@/game/tutorial";
import {
  REVIEW_DECK_COPY,
  REVIEW_DECK_REGION_ID,
  REVIEW_DECK_REGION_NAME,
  deckCounts,
  deckStarter,
  dueEntries,
  emptyReviewDeck,
  readReviewDeck,
  recordReview,
  removeDeckEntry,
  upsertMiss,
  writeReviewDeck,
  type DeckEntry,
  type DeckPlaceSnapshot,
} from "@/game/review-deck";
import { resetHistory, type ResetHistoryResult } from "@/game/reset-history";
import {
  buildCreationSources,
  buildFreshChallengeShareText,
  CHALLENGE_BROKEN_LINK_COPY,
  CHALLENGE_CHILD_COPY,
  CHALLENGE_FAIRNESS_COPY,
  CHALLENGE_GLOBE_RADIUS_KM,
  CHALLENGE_LOAD_FAILURE_COPY,
  CHALLENGE_MAX_PLACES,
  CHALLENGE_MC3_PREFIX,
  CHALLENGE_MIN_PLACES,
  CHALLENGE_REGION_ID,
  CHALLENGE_REGION_NAME,
  CHALLENGE_SHARE_LABEL,
  CHALLENGE_EXACT_SHARE_LABEL,
  CHALLENGE_RESHARE_LABEL,
  CHALLENGE_UNKNOWN_CONTENT_COPY,
  CHALLENGE_UNKNOWN_REGION_COPY,
  CHALLENGE_VERSION_COPY,
  CHALLENGE_VERSION_LINE,
  CHALLENGE_WELCOME_TITLE,
  challengeFreshRouteLabel,
  challengeMidRunLabel,
  challengeRadiusOf,
  challengeRevealLabel,
  challengeRunFields,
  createChallengeRoute,
  dealChallenge,
  encodeChallenge,
  isLegalWinnerBlock,
  routeCeiling,
  type ChallengeCreation,
  type ChallengeRoute,
  type ChallengeWinner,
} from "@/game/challenge";

/**
 * Async boundary for an in-progress run: the region's chunk loads here
 * (normally a cache hit from region selection; a fresh fetch after a page
 * reload). Shows a loading state while fetching and FAILS CLOSED on error —
 * the run never plays with a partial or missing pool.
 */
export function Play({
  mapHost,
  clearDrop,
  globeTierSplitFor,
  revealStory,
  verdictGrandpaPosterUrl,
  verdictGrandpaVideoUrl,
  poolForRunStart,
  run,
  session,
  onRun,
  onBankPlace,
  onEndGame,
  onEditions,
  onChallengeDone,
  onChallengeRetry,
  onSummaryDone,
  onReplayed,
  onReviewDeck,
  onResetHistory,
  onReviewChallenge,
  onCleared,
  celebrationOpen,
  tutorial,
  onTutorialAdvance,
  onTutorialEnd,
  ageBand,
  mapMode,
  onManualMapMode,
  applyMapMode,
  applySessionMapMode,
  scoutUpgradeEligible,
  onScoutUpgrade,
  readStoredMapMode,
  onPlacesChange,
  verdictSettled,
  verdictSettledByGesture,
  onSettleVerdict,
  onSettleVerdictByGesture,
}: {
  /** The lazy satellite-map host, supplied by the composer as a slot. */
  mapHost: ComponentType<
    ComponentProps<(typeof import("@/map/satellite-map-host"))["SatelliteMapHost"]>
  >;
  /** Drop the persisted drop (composer-owned). */
  clearDrop: () => void;
  /** Pool builder for a run start (composer-owned). */
  poolForRunStart: (
    allPlaces: { id: string }[],
    edition: Edition,
    regionId: string,
    choice: PickerDifficulty,
  ) => {
    poolIds: string[];
    prevLastId: string | null;
    cycleCompleted: boolean;
  };
  /** Globe tier-split decision for a run's pool load (composer-owned; also used by the run controller). */
  globeTierSplitFor: (edition: Edition, regionId: string) => Promise<boolean>;
  /** Rewrite a place story for the reveal (composer-owned). */
  revealStory: (placeId: string, authored: string) => Promise<string>;
  /** Grandpa verdict poster URL (composer-owned asset). */
  verdictGrandpaPosterUrl: string;
  /** Grandpa verdict video URL (composer-owned asset). */
  verdictGrandpaVideoUrl: string;
  run: Run;
  session: Session | null;
  /** Effective age band for tolerance + round params (parent-set). */
  ageBand: AgeBandId;
  onRun: (run: Run) => void;
  onBankPlace: (input: {
    edition: Edition;
    score: number;
    hit: boolean;
    distanceKm: number;
    streakAfter: number;
    difficultyChoice: PickerDifficulty;
    regionId: string;
    regionName: string;
  }) => void;
  /** Ends the session and returns its summary (null when there is no session). */
  onEndGame: () => SessionSummary | null;
  /** mc2 challenge Done: clear the challenge slot, offer the displaced run back. */
  onChallengeDone?: () => void;
  /** Verdict Retry (Package B): start this route again at once. */
  onChallengeRetry?: (route: ChallengeRoute) => void;
  /** Back to the edition picker mid-run; the session stays alive. */
  onEditions: () => void;
  /** Summary dismissed after End game; the session is already ended. */
  onSummaryDone: () => void;
  /** A fresh run started via Play again; starts a fresh session. */
  onReplayed: (run: Run) => void;
  /** "Review my misses" from the end-game summary. */
  onReviewDeck: () => void;
  /** Run the "Start over" history reset (GameApp owns the flow). */
  onResetHistory: () => ResetHistoryResult;
  /** "Challenge a friend — pick a map" from review-complete (§1(e)). */
  onReviewChallenge: () => void;
  /** A difficulty band was just cleared: show the celebration dialog. */
  onCleared: (info: ClearedInfo) => void;
  /**
   * Whether the cleared-mode celebration dialog is open. The M5 Escape
   * handler yields while it is open so one Escape press dismisses only
   * the dialog (the dialog's own handler), never the result card beneath.
   */
  celebrationOpen: boolean;
  /** First-run tutorial beat (null when inactive); owned by GameApp. */
  tutorial: TutorialBeat | null;
  /** Advance the tutorial to a beat. */
  onTutorialAdvance: (beat: TutorialBeat) => void;
  /** Skip/finish the tutorial: tear down the practice round. */
  onTutorialEnd: () => void;
  /** Scout Map: the game map mode, owned by GameApp. */
  mapMode: MapMode;
  /**
   * Manual settings-toggle switch. GameApp owns it: it persists the
   * manual record, applies the mode, and sends the player home — the
   * map is built once per game, so the new mode takes effect in the
   * next game (owner ruling, 2026-10-20).
   */
  onManualMapMode: (mode: MapMode) => void;
  /**
   * Apply a runtime auto-switch. Only the webglcontextlost tripwire
   * calls this (applied immediately, with a remount).
   */
  applyMapMode: (mode: MapMode, source: "contextlost") => void;
  /**
   * Apply a runtime SESSION-ONLY switch (tile fallback). GameApp owns
   * it so the home notices are reconciled there — never the raw state
   * setter (BLOCK-B).
   */
  applySessionMapMode: (mode: MapMode) => void;
  /** Issue #330: this boot is an unknown-memory Scout trial. */
  scoutUpgradeEligible: boolean;
  /** Issue #330: apply the trial's session-only upgrade to full. */
  onScoutUpgrade: () => void;
  /** Step 8: the capability stored-record reader, surfaced by the
   * map-mode hook so PlayLoaded's upgrade re-check reads the record
   * without the composer importing the capability module. */
  readStoredMapMode: ReturnType<
    (typeof import("@/map/use-map-mode"))["useMapMode"]
  >["readStoredMapMode"];
  /** B1: report the loaded places (keyed) to the composer, so the
   * composer's single `<main>` can carry the active Play branch's
   * class. Called with null while loading / on a key change. */
  onPlacesChange?: (loaded: { key: string; places: Starter[] | null }) => void;
  /** Verdict settle flags, owned by the composer (B1) — passed through
   * to PlayLoaded / ChallengeCompleteShell. */
  verdictSettled: boolean;
  verdictSettledByGesture: boolean;
  onSettleVerdict: () => void;
  onSettleVerdictByGesture: () => void;
}) {
  // The catalog is stored WITH the key it was loaded for and only used while
  // that key is the current run's key. Play stays mounted across run changes
  // (GameApp renders it whenever `run` is set), so a plain `places` state would
  // hand PlayLoaded the previous band's catalog for one commit: wrong pool, a
  // dealer on the new band's seen store, and a stale place written into the
  // new band's no-repeat history. Deriving `places` makes that commit
  // impossible: a key mismatch renders "Loading places" instead.
  const challenge = isChallengeRun(run);
  const loadKey = challenge
    ? `${CHALLENGE_REGION_ID}:${run.poolIds.join(",")}`
    : placesLoadKey(run.edition, run.regionId, run.difficultyChoice);
  const [loadedPlaces, setLoadedPlaces] = useState<LoadedFor<Starter[]> | null>(null);
  const [poolFailure, setPoolFailure] = useState<LoadedFor<string> | null>(null);
  const places = loadedForKey(loadedPlaces, loadKey);
  // Package B (§1(f)): for a challenge run, `places` above is only the
  // route's own places — the completion screen's fresh secondary deals
  // from the route's REGION, so the full catalog the load branch fetched
  // is kept alongside, keyed the same way.
  const [loadedChallengeCatalog, setLoadedChallengeCatalog] =
    useState<LoadedFor<Starter[]> | null>(null);
  const challengeCatalog = loadedForKey(loadedChallengeCatalog, loadKey);
  const poolError = loadedForKey(poolFailure, loadKey);
  // B1: report the loaded places (keyed) to the composer, so its single
  // `<main>` carries the active Play branch's class. The key lets the
  // composer tell a stale catalog from the current run's — a key change
  // reports null first, so the composer renders the loading `<main>`
  // instead of the previous run's branch for one frame.
  useEffect(() => {
    onPlacesChange?.({ key: loadKey, places });
  }, [loadKey, places, onPlacesChange]);
  // Review sessions: the due deck entries in session order (the poolIds
  // order). Null for normal runs.
  const [reviewEntries, setReviewEntries] = useState<DeckEntry[] | null>(null);
  const review = isReviewRun(run);

  // Observability: the run is interactive once its places are loaded and
  // it is in the aim phase — the last milestone of a healthy run start.
  useEffect(() => {
    if (places && run.phase === "aim") {
      recordMilestone("game_loaded", { edition: run.edition, regionId: run.regionId, chunkId: run.regionId });
    }
  }, [places, run.phase, run.edition, run.regionId]);

  useEffect(() => {
    let cancelled = false;
    setPoolFailure(null);
    setReviewEntries(null);
    if (review) {
      // Review deck: no chunk fetch — due cards carry their own snapshots.
      // Aligned to the run's poolIds (the session queue); a deck that
      // changed since session start fails closed to the currently-due list.
      try {
        const deck = readReviewDeck() ?? emptyReviewDeck();
        const due = dueEntries(deck, Date.now());
        const byId = new Map(due.map((entry) => [entry.place.id, entry]));
        const ordered = run.poolIds
          .map((id) => byId.get(id))
          .filter((entry): entry is DeckEntry => entry !== undefined);
        const entries = ordered.length > 0 ? ordered : due;
        if (!cancelled) {
          setReviewEntries(entries);
          setLoadedPlaces({ key: loadKey, value: entries.map(deckStarter) });
        }
      } catch {
        if (!cancelled) {
          setPoolFailure({ key: loadKey, value: "Could not load your review deck." });
        }
      }
      return () => {
        cancelled = true;
      };
    }
    if (challenge) {
      // Challenge pool: the places are exactly the link's ids, in the
      // link's order — no dealer, no band filter, no seen-history. Each
      // id is looked up in THIS device's own catalog FOR THE ROUTE'S
      // REGION (the Globe for mc1; the named state or country for mc2);
      // an id that catalog does not know fails the whole run closed
      // with the child-friendly copy, never a substituted place.
      placesFor(run.edition, run.challengeRegionId ?? "globe", undefined, false).then(
        (list) => {
          if (cancelled) return;
          setLoadedChallengeCatalog({ key: loadKey, value: list });
          const byId = new Map(list.map((p) => [p.id, p]));
          const ordered: Starter[] = [];
          for (const id of run.poolIds) {
            const found = byId.get(id);
            if (!found) {
              setPoolFailure({ key: loadKey, value: CHALLENGE_CHILD_COPY });
              return;
            }
            ordered.push(found);
          }
          setLoadedPlaces({ key: loadKey, value: ordered });
        },
        (err: unknown) => {
          if (!cancelled) {
            setPoolFailure({
              key: loadKey,
              value: err instanceof Error ? err.message : String(err),
            });
          }
        },
      );
      return () => {
        cancelled = true;
      };
    }
    globeTierSplitFor(run.edition, run.regionId)
      .then((tierSplit) =>
        placesFor(run.edition, run.regionId, run.difficultyChoice, tierSplit),
      )
      .then(
        (list) => {
          if (!cancelled) setLoadedPlaces({ key: loadKey, value: list });
        },
        (err: unknown) => {
          if (!cancelled) {
            setPoolFailure({
              key: loadKey,
              value: err instanceof Error ? err.message : String(err),
            });
          }
        },
      );
    return () => {
      cancelled = true;
    };
    // Keyed on the load key, not on the individual run fields. For the Globe
    // the key contains the learning path, so a band change (celebration
    // promotion, replay at another path) loads the new band's catalog and, until
    // it arrives, renders "Loading places" - never the old band's catalog.
    // For every other region the key has no band part, so a band change does
    // not reload or remount. Flag on: the Globe loads only the tiers of the
    // new path. Flag off: the reload is unnecessary (the pool is the full
    // Globe pool for every band) but harmless: globeTierSplitFor returns its
    // cached value and placesFor hits the chunk cache, so the same full pool
    // comes back after one "Loading places" frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  if (poolError) {
    // The shared ErrorScreen (PR 3 Step 3.8): the failure copy rides
    // its title/body props verbatim — the loader's message plus the
    // standing explanation. This surface has exactly one recovery
    // door, as it did hand-built: picking the region again
    // (onEditions), so both ErrorScreen exits converge on it. A true
    // in-place retry would need a load nonce in the pool loader,
    // which is outside this surface. The region loading state below
    // and the pinned stale-build/offline notices elsewhere keep
    // their specialised surfaces.
    return (
      <ErrorScreen
        onHome={onEditions}
        onRetry={onEditions}
        title="Couldn't load places."
        body={`${poolError} The run was not started with a partial pool — pick the region again to retry.`}
      />
    );
  }

  if (!places) {
    return (
      <>
        <p className="name-eyebrow">Loading places</p>
        <h1 className="mode-title mt-2 text-4xl text-fg">{run.regionName}</h1>
        <p className="mt-4 max-w-md text-lg text-fg" role="status">
          Fetching this region&rsquo;s places&hellip;
        </p>
      </>
    );
  }

  return (
    <PlayLoaded
      mapHost={mapHost}
      revealStory={revealStory}
      verdictGrandpaPosterUrl={verdictGrandpaPosterUrl}
      verdictGrandpaVideoUrl={verdictGrandpaVideoUrl}
      clearDrop={clearDrop}
      poolForRunStart={poolForRunStart}
      run={run}
      places={places}
      challengeCatalog={challengeCatalog}
      session={session}
      onRun={onRun}
      onBankPlace={onBankPlace}
      onEndGame={onEndGame}
      onEditions={onEditions}
      onChallengeDone={onChallengeDone}
      onChallengeRetry={onChallengeRetry}
      onSummaryDone={onSummaryDone}
      onReplayed={onReplayed}
      onReviewDeck={onReviewDeck}
      onResetHistory={onResetHistory}
      onReviewChallenge={onReviewChallenge}
      onCleared={onCleared}
      celebrationOpen={celebrationOpen}
      reviewEntries={reviewEntries}
      tutorial={tutorial}
      onTutorialAdvance={onTutorialAdvance}
      onTutorialEnd={onTutorialEnd}
      ageBand={ageBand}
      mapMode={mapMode}
      onManualMapMode={onManualMapMode}
      applyMapMode={applyMapMode}
      applySessionMapMode={applySessionMapMode}
      scoutUpgradeEligible={scoutUpgradeEligible}
      onScoutUpgrade={onScoutUpgrade}
      readStoredMapMode={readStoredMapMode}
      verdictSettled={verdictSettled}
      verdictSettledByGesture={verdictSettledByGesture}
      onSettleVerdict={onSettleVerdict}
      onSettleVerdictByGesture={onSettleVerdictByGesture}
    />
  );
}
