import type { ComponentProps, ComponentType } from "react";
import { ChallengeCompleteShell } from "./challenge-complete-shell";
import { distanceKm } from "@/game/geo";
import { formatLength, unitForEdition } from "@/game/units";
import { isHit, radiusKm } from "@/game/radius";
import { placesFor, poolSizeFor, storyForBand } from "@/game/generated-places";
import { preloadTerritory } from "@/game/territory";
import type { Starter } from "@/game/starters";
import { ADMIN1_BY_COUNTRY, COUNTRIES, findRegion, STATES, greaterSideKm } from "@/game/regions";
import { shouldFireAiStory } from "@/game/story-ai";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase } from "@/game/run";
import { isPickerDifficulty, type PickerDifficulty } from "@/game/tier-filter";
import { dealingPoolFor } from "@/game/easy-curation";
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
import { scoreRingForEdition } from "@/game/score";
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
import { SCORING_VERSION, scorePlace, type Difficulty } from "@/game/scoring";
import { createDealer, poolForNewRun, seenStoreFor, mintSeed, wasClearedCelebrated, markClearedCelebrated, clearClearedMark, memorySeenStore, isBandCleared } from "@/game/trail";
import { resolveRunPool } from "@/game/pool";
import { MapErrorBoundary } from "./map-error-boundary";
import { Compass, Flag, Globe2, MapPin, MoreHorizontal } from "lucide-react";
import { SoundToggle } from "./SoundToggle";
import {
  FIRST_VISIT_QUEUE_KEY,
  STORAGE_KEYS,
  challengeRecordedKeyDef,
  challengeRecordedSummaryKeyDef,
  storyKeyDef,
} from "../platform/storage/keys.ts";
import {
  getSessionStorageItem,
  getStorageItem,
  removeSessionStorageItem,
  setSessionStorageItem,
  setStorageItem,
} from "../platform/storage/browser-storage.ts";
import {
  initAudio,
  isSoundEnabled,
  playCardTap,
  playDifficultySelect,
  playEditionEntrance,
  playLose,
  playWin,
} from "@/game/audio/sfx";
import { playCelebrationSound, safePlay, soundAudible } from "@/game/audio/play-guards";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { EndOfFlowHome } from "@/components/ui/end-of-flow-home";
import { QuestionBubble, type BubbleViewState } from "./question-bubble";
import { HintPanel } from "./hint-panel";
import { HighContrastToggle } from "./high-contrast-toggle";
import { directionalHint } from "./hint-logic";
import { canUseHint } from "@/game/age-profile/run-config.ts";
import { ResultCard } from "./result-card";
import { RunSummaryCard } from "./run-summary";
import { ShareButton } from "./share-button";
import { ReviewComplete } from "./review-complete";
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
  buildCollisionCounts,
  buildQuestionLabel,
  hasNameCollision,
} from "@/game/question-label";
import {
  REVEAL_WATCHDOG_MS,
  shouldArmRevealWatchdog,
} from "./reveal-watchdog";
import { isEnabled, loadFlags, getObservabilityEndpoint } from "@/lib/flags";
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
import type { MapMark, MapVariation, ScoutRestoreView } from "@/lib/map-view-types";
import { SCOUT_COPY } from "./scout-copy.ts";
import { TILE_FALLBACK_COPY } from "@/lib/tile-fallback-copy.ts";
import { MapModeToggle } from "./map-mode-toggle.tsx";
import {
  TUTORIAL_EDITION,
  TUTORIAL_REGION_ID,
  TUTORIAL_REGION_NAME,
  hasSeenTutorial,
  markTutorialSeen,
  TUTORIAL_INVITE_DISMISS_EVENT,
  type TutorialBeat,
} from "@/game/tutorial";
import { TutorialInvite, TutorialOverlay } from "./tutorial-overlay";
import {
  emptyLearningStore,
  growthLineFor,
  growthSummary,
  readLearningStore,
  recordAnswer,
  writeLearningStore,
  type LearningStore,
} from "@/game/learning";
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
import {
  challengeRouteTuple,
  readRouteAttempts,
  recordRouteCompletion,
} from "@/game/challenge-attempts";
import {
  classifyVerdict,
  exactRouteTargetShareText,
  hitMaskFromResults,
  maxAttainableRemaining,
  mintWinnerBlock,
  passAlongReceipt,
  routeTierCeiling,
  trailingStreak,
  verdictAriaSentence,
  verdictAttemptsFacts,
  verdictDuelLine,
  verdictMarginSentence,
  verdictSubLine,
  VERDICT_HEADLINES,
  VERDICT_ICONS,
  type VerdictClass,
} from "@/game/challenge-verdict";

type LegacySnapshotBand = Exclude<BandRunConfig["band"], AgeBandId>;

/**
 * A persisted run-config snapshot (meridian.loop.v2) may still carry a
 * pre-age-groups id. Map it to the current group wherever an AgeGroup is
 * needed; the snapshot itself is never rewritten or rejected.
 */
function normalizeSnapshotBand(b: AgeBandId | LegacySnapshotBand): AgeBandId {
  if (b === "5-7" || b === "8-10") return "7-10";
  if (b === "11-13") return "10-18";
  return b;
}

/**
 * Snapshot a missed place's full question context for the deck: a review
 * card replays the exact question the player missed (same framing, same
 * hit radius, same label), with no region-chunk fetch at review time.
 */
function snapshotForDeck(
  place: Starter,
  run: Run,
  radiusKm: number,
): DeckPlaceSnapshot {
  return {
    id: place.id,
    name: place.name,
    lon: place.lon,
    lat: place.lat,
    story: place.story,
    history: place.history,
    fact: place.fact,
    curated: place.curated,
    difficulty: place.difficulty,
    edition: run.edition,
    regionId: run.regionId,
    regionName: run.regionName,
    subdivision: place.subdivision,
    iso2: place.iso2,
    originRegionId: place.originRegionId,
    sourceLabel: place.sourceLabel,
    sourceHref: place.sourceHref,
    mapMode: run.edition === "globe" ? "globe" : "flat",
    regionBounds: run.edition === "globe" ? undefined : boundsFor(run),
    radiusKm,
  };
}

/**
 * The persisted pin-drop for the in-progress place. `drop`/`revealDone`
 * are React state only, so a page reload during the result card used to
 * strand the run (phase "done"/"story" restored, but no card and no
 * Next place). The drop is written on pin commit and cleared on
 * continue/replay/end/leave; on reload the mount restore rehydrates it
 * when it matches the dealt place, else fails safe by advancing (the
 * result is already scored).
 * Fail closed to null on anything malformed or tampered.
 */
function readDrop(): Drop | null {
  try {
    const parsed: unknown = getSessionStorageItem(STORAGE_KEYS.pausedDrop);
    return isDrop(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDrop(drop: Drop) {
  try {
    setSessionStorageItem(STORAGE_KEYS.pausedDrop, drop);
  } catch {
    // The drop still lives in memory when storage is blocked.
  }
}

/**
 * Place-card collapse redesign (2026-10-11): the question card opens
 * COMPACT on narrow viewports (mobile-first 390px) so it never fills the
 * screen; desktop keeps the full open card with instructions. One helper
 * feeds the state initializer, the per-place reset, and replay — a single
 * source of truth for the default. The 40rem matchMedia check sets only
 * the INITIAL view state in JS; there is no compact CSS media query —
 * compactness comes from the `pcard-compact` class on .bubble-scroll,
 * which QuestionBubble applies when `!expanded`.
 */
function defaultBubbleView(): BubbleViewState {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 40rem)").matches
  ) {
    return "collapsed";
  }
  return "open";
}

export function PlayLoaded({
  mapHost: MapHost,
  revealStory,
  verdictGrandpaPosterUrl,
  verdictGrandpaVideoUrl,
  clearDrop,
  poolForRunStart,
  run,
  places,
  challengeCatalog,
  session,
  onRun,
  onBankPlace,
  onEndGame: requestEndGame,
  onEditions,
  onChallengeDone,
  onChallengeRetry,
  onSummaryDone: finishSummary,
  onReplayed,
  onReviewDeck,
  onResetHistory,
  onReviewChallenge,
  onCleared,
  celebrationOpen,
  reviewEntries,
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
}: {
  /** The lazy satellite-map host, supplied by the composer as a slot. */
  mapHost: ComponentType<
    ComponentProps<(typeof import("@/map/satellite-map-host"))["SatelliteMapHost"]>
  >;
  /** Rewrite a place story for the reveal (composer-owned). */
  revealStory: (placeId: string, authored: string) => Promise<string>;
  /** Grandpa verdict poster URL (composer-owned asset). */
  verdictGrandpaPosterUrl: string;
  /** Grandpa verdict video URL (composer-owned asset). */
  verdictGrandpaVideoUrl: string;
  /** Drop the persisted drop (composer-owned; also used by the run controller). */
  clearDrop: () => void;
  /** Pool builder for a run start (composer-owned; also used by the run controller). */
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
  run: Run;
  places: Starter[];
  /** Package B (§1(f)): the challenge route's full region catalog,
   * loaded by Play for challenge runs (where `places` is only the
   * route itself). Null for normal runs and while loading. */
  challengeCatalog?: Starter[] | null;
  /** Effective age band for tolerance + round params (parent-set). */
  ageBand: AgeBandId;
  session: Session | null;
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
  onEndGame: () => SessionSummary | null;
  onEditions: () => void;
  /** mc2 challenge Done: clear the challenge slot, offer the displaced run back. */
  onChallengeDone?: () => void;
  /** Verdict Retry (Package B): start this route again at once. */
  onChallengeRetry?: (route: ChallengeRoute) => void;
  onSummaryDone: () => void;
  onReplayed: (run: Run) => void;
  /** A difficulty band was just cleared: show the celebration dialog. */
  onCleared: (info: ClearedInfo) => void;
  /** "Review my misses" from the end-game summary. */
  onReviewDeck: () => void;
  /** Run the "Start over" history reset (GameApp owns the flow). */
  onResetHistory: () => ResetHistoryResult;
  /** "Challenge a friend — pick a map" from review-complete (§1(e)). */
  onReviewChallenge: () => void;
  /**
   * Whether the cleared-mode celebration dialog is open. The M5 Escape
   * handler yields while it is open so one Escape press dismisses only
   * the dialog (the dialog's own handler), never the result card beneath.
   */
  celebrationOpen: boolean;
  /**
   * Review sessions only: the due deck entries in session order (null for
   * normal runs). Each entry's snapshot carries the card's original
   * question context.
   */
  reviewEntries: DeckEntry[] | null;
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
}) {
  // Review-deck session: a synthetic Run reusing this game loop. The deck
  // queue (due order) is the pool; review answers never bank into the
  // session and the cleared-mode celebration never fires here.
  const review = isReviewRun(run);
  const challenge = isChallengeRun(run);
  const reviewEntryById = useMemo(
    () => new Map((reviewEntries ?? []).map((entry) => [entry.place.id, entry] as const)),
    [reviewEntries],
  );
  // Session pool: the catalog filtered to this run's persisted poolIds.
  // Computed once at session start and saved on the run, so a reload
  // rebuilds the identical pool (not a reshuffled smaller one). An empty
  // band stays empty — resolveRunPool only widens to the full catalog for
  // legacy/tampered pools, never for a deliberately empty band.
  const pool = useMemo(
    () => resolveRunPool(places, run.poolIds),
    [places, run.poolIds],
  );
  // Question disambiguation: same-name/same-country collision counts over
  // the dealt pool, built once per pool (O(n)). Globe edition only — the
  // whole pool is one country in country edition, and state edition shows
  // the bare name.
  const collisionCounts = useMemo(
    () => (run.edition === "globe" ? buildCollisionCounts(pool) : null),
    [pool, run.edition],
  );
  // Endless dealer: per-session shuffle (fresh seed per run, so restarts no
  // longer deterministically repeat the same first question), per-cycle
  // reseed, and a persistent no-repeat history in local storage. The dealer
  // is created once per run
  // identity (seed); run.index advances within it. A reload restores the same
  // seed and pool, so the resumed run keeps dealing the same session's order.
  const dealer = useMemo(
    () =>
      createDealer(
        pool,
        run.seed,
        // Review and challenge runs get a throwaway in-memory seen
        // store: their places must never enter the player's persistent
        // no-repeat history (a friend's picks are not places this
        // player was dealt). Normal runs use the real local-storage
        // store, scoped to edition/region/band.
        review || challenge
          ? memorySeenStore()
          : seenStoreFor(run.edition, run.regionId, run.difficultyChoice),
        run.index,
        run.prevLastId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, run.seed, run.dateKey, run.edition, run.regionId, run.difficultyChoice, run.prevLastId, review, challenge],
  );
  const place = review || challenge ? pool[run.index] : dealer.at(run.index);
  /** The deck entry behind the dealt card (review sessions only). */
  const reviewEntry = review && place ? reviewEntryById.get(place.id) : undefined;
  // The qualified question label ("Manhattan, Nebraska, United States" in
  // globe; "Manhattan, Nebraska" in country; bare name in state). Computed
  // once per place and shared by the question bubble and the result card so
  // what you were asked matches what you're shown. Fail-closed inside
  // buildQuestionLabel: unresolvable parents fall back to the bare name.
  const questionLabel = useMemo(() => {
    if (!place) return "";
    if (review) {
      // Review cards replay the original question verbatim: the label uses
      // the card's original edition (never the synthetic review run).
      const edition = reviewEntry?.place.edition ?? "globe";
      return buildQuestionLabel({
        edition,
        place,
        countryRegionId:
          edition === "country" ? (reviewEntry?.place.regionId ?? null) : null,
        hasCollision: false,
      });
    }
    return buildQuestionLabel({
      edition: run.edition,
      place,
      countryRegionId: run.edition === "country" ? run.regionId : null,
      hasCollision: collisionCounts ? hasNameCollision(place, collisionCounts) : false,
    });
  }, [place, review, reviewEntry, run.edition, run.regionId, collisionCounts]);
  // Record dealt places into the no-repeat history as the run advances.
  // Skipped for review sessions and the tutorial practice round: the deck
  // queue is the dealing order (and the review namespace must never pollute
  // real regions' histories), and the tour must not pollute the France
  // band's persistent history with its practice place.
  useEffect(() => {
    if (review || tutorial || challenge) return;
    dealer.markDealtThrough(run.index);
  }, [dealer, review, challenge, run.index, tutorial]);
  // Tutorial beat 1 → 2: the pin was committed (phase left "aim"), so the
  // reveal feedback takes over. Any later phase change is a real run's
  // business — tutorial is already 2 or 3 by then.
  useEffect(() => {
    if (tutorial === 1 && run.phase !== "aim") onTutorialAdvance(2);
  }, [tutorial, run.phase, onTutorialAdvance]);
  const [aim, setAim] = useState<{ lon: number; lat: number } | null>(null);
  // Target-chip settle state (§Q4): true while aim movements are
  // arriving; the chip hides until ~700 ms after the last one.
  const [chipSettling, setChipSettling] = useState(false);
  const chipSettleTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (chipSettleTimer.current !== null) window.clearTimeout(chipSettleTimer.current);
    },
    [],
  );
  // A11y (WCAG 4.1.3): the sr-only live region announces aim transitions so
  // screen-reader users get feedback for place/move/clear. Cleared whenever
  // the phase changes, at which point phase messaging takes over.
  const [aimAnnouncement, setAimAnnouncement] = useState<string | null>(null);
  // Pairing rule: every writeDrop/setDrop site must pair with clearDrop — see STORAGE_KEYS.pausedDrop.
  const [drop, setDrop] = useState<Drop | null>(null);
  // Ref mirror of the drop's hit outcome for the reveal-complete sound.
  // (Avoids stale closure: onRevealComplete fires from the map's animation
  // controller, which may hold an older render's callback.)
  const dropHitRef = useRef<boolean | null>(null);
  const [story, setStory] = useState<string | null>(null);
  const [bubble, setBubble] = useState<BubbleViewState>(defaultBubbleView);
  const userCollapsedBubbleRef = useRef(false);
  const [cardDismissed, setCardDismissed] = useState(false);
  // Hint UI (follow-up Item A — hints are a REAL feature, owner 2026-10-09).
  // Hints NEVER touch points. Per-place usage drives the 10-18 one-per-place
  // policy; the run-level hintsUsed accumulates for the snapshot. The
  // mascot offer dismissal resets per run (not per place) — no nagging.
  const [hintsUsedThisPlace, setHintsUsedThisPlace] = useState(0);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [offerDismissed, setOfferDismissed] = useState(false);
  // Gap-view reveal: the result card stays hidden until the map's reveal
  // reaches its end state (`reveal-done` → onRevealComplete). Reset per place.
  const [revealDone, setRevealDone] = useState(false);
  // Z3/Z4 zoom-space: replay remounts the map (fresh intro + fresh
  // controller). Replaying the same region must not reuse the old map
  // instance — its controller is terminal (revealDone) and its highlight
  // belongs to the previous run.
  const [mapKey, setMapKey] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  /**
   * PBI-5: the webglcontextlost runtime tripwire — the ONLY automatic
   * mid-game switch. Game state (run/place/aim/drop) lives above the map,
   * so the remount loses nothing; the doomed viewport re-opens mid-SPACE
   * via initialView (no page reload). Repeat storms are guarded: an
   * already-scout mount never re-switches.
   */
  const [scoutSwitchView, setScoutSwitchView] = useState<ScoutRestoreView | null>(null);
  const [mapRemountNonce, setMapRemountNonce] = useState(0);
  /**
   * PBI-5: the deferred switch note — keyed to the switch event + place
   * id, rendered at the next game-natural break (story + revealDone),
   * cleared on Continue / dismiss. Never mid-round.
   */
  const [scoutSwitchNote, setScoutSwitchNote] = useState<{ placeId: string } | null>(null);
  const mapModeRef = useRef(mapMode);
  mapModeRef.current = mapMode;

  const handleWebglContextLost = useCallback(
    (view: ScoutRestoreView) => {
      if (mapModeRef.current !== "full") return;
      applyMapMode("scout", "contextlost"); // Q3: new qualifying event
      setScoutSwitchView(view);
      setMapRemountNonce((n) => n + 1);
      if (place) setScoutSwitchNote({ placeId: place.id });
    },
    [applyMapMode, place],
  );

  /**
   * WS-4 Phase 1: "Try again" taps this visit (the satellite map reports each
   * one). In memory only: it is never stored, so a reload starts at zero.
   */
  const [tileRetriesUsed, setTileRetriesUsed] = useState(0);
  const handleTileRetry = useCallback(() => setTileRetriesUsed((n) => n + 1), []);
  /** WS-4 Phase 1: the deferred "switched to Scout Map" note (tile path). */
  const [tileSwitchNote, setTileSwitchNote] = useState<{ placeId: string } | null>(null);

  /**
   * WS-4 Phase 1: satellite pictures failed after the one retry. Switch to
   * Scout Map for this visit only. Unlike the context-loss switch, this calls
   * no writeStoredMapMode: nothing is saved, and a reload returns to full.
   * (No manual choice can be pending against it: a manual toggle now
   * leaves the run entirely — see handleManualMapMode in GameApp.)
   * The mode itself goes through GameApp's applySessionMapMode, which
   * reconciles the home notices this switch would otherwise falsify
   * (BLOCK-B) — this handler never touches the raw setter.
   */
  const handleTileFallback = useCallback(
    (view: ScoutRestoreView) => {
      if (mapModeRef.current !== "full") return;
      setReportMapMode("scout");
      applySessionMapMode("scout");
      setScoutSwitchView(view);
      setMapRemountNonce((n) => n + 1);
      if (place) setTileSwitchNote({ placeId: place.id });
    },
    [applySessionMapMode, place],
  );

  /**
   * Issue #330: the unknown-memory trial's Scout map stayed stable past
   * its soak — upgrade the session to the full map. Mirrors the tile
   * fallback's remount (live viewport carried over, nothing stored),
   * in reverse. No switch note: the player did not lose anything, the
   * map simply got richer, and device-driven switches are silent.
   * Challenge runs are excluded: a challenge's map is picked at its
   * welcome card, and a challenge is never re-mapped mid-run.
   */
  const handleScoutUpgrade = useCallback(
    (view: ScoutRestoreView) => {
      if (mapModeRef.current !== "scout") return;
      if (challenge) return;
      // #330 cure: re-check at fire time — a stored manual record
      // written after boot (a manual choice that did not pass through
      // the handlers that clear eligibility) stands over the trial,
      // and the upgrade must never override it.
      if (readStoredMapMode()?.source === "manual") return;
      onScoutUpgrade();
      setScoutSwitchView(view);
      setMapRemountNonce((n) => n + 1);
    },
    [onScoutUpgrade, challenge, readStoredMapMode],
  );

  // The switch viewport is consumed by the remount it triggers; clear it
  // when the place changes so later mounts never re-open a stale view.
  const lastPlaceIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = place?.id ?? null;
    if (lastPlaceIdRef.current !== id) {
      lastPlaceIdRef.current = id;
      setScoutSwitchView(null);
    }
  }, [place]);
  // Learning outcomes (flag-gated, observational). The store is read once
  // at boot after the shared flags load resolves; the boot-time flag value
  // is authoritative for the session (no mid-game surprises). Flag off =
  // no reads, no writes, no traces — dealing/scoring/session byte-identical.
  const [learningEnabled, setLearningEnabled] = useState(false);
  const [friendChallengesEnabled, setFriendChallengesEnabled] = useState(false);
  // Unit B: the detectivePair flag also gates the pair's game-end
  // celebration on the run summary (every edition). Boot-time value,
  // like the other flag reads here; off = the summary is today's.
  const [detectivePairEnabled, setDetectivePairEnabled] = useState(false);
  const [learningStore, setLearningStore] = useState<LearningStore | null>(null);
  useEffect(() => {
    let active = true;
    // Kill-switch-style track (writes persistent data): await the shared
    // load so a remote decision wins the boot-time race deterministically.
    loadFlags().then(() => {
      if (!active) return;
      // Challenge runs are excluded even when the flag is on: a
      // friend's route must not write this player's learning record.
      const on = isEnabled("learningOutcomes") && !challenge;
      setLearningEnabled(on);
      if (on) setLearningStore(readLearningStore() ?? emptyLearningStore());
      setFriendChallengesEnabled(isEnabled("friendChallenges"));
      setDetectivePairEnabled(isEnabled("detectivePair"));
    });
    return () => {
      active = false;
    };
  }, [challenge]);
  // Session score: the HUD total accumulates across edition switches until
  // End game. Falls back to the run's own results when no session exists
  // (defensive; openRun always ensures one).
  const sessionTotal =
    session?.totalScore ?? run.results.reduce((sum, r) => sum + r.score, 0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Per-difficulty rows for the score breakdown popover: only modes the
  // player has actually played this session, easy → medium → hard.
  // formatSuccessRate never prints "0%" — with zero places the mode simply
  // isn't listed.
  const breakdownDifficulties = session
    ? summarizeSession(session).byDifficulty.filter((d) => d.places > 0)
    : [];

  // Escape closes the score breakdown for keyboard users (it holds no
  // focusables, so focus never enters it; the toggle button re-opens it).
  useEffect(() => {
    if (!showBreakdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBreakdown(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showBreakdown]);

  // Reload-mid-reveal restore: `drop`/`revealDone` are in-memory only, so a
  // page reload during the result card used to strand the run — phase
  // "done"/"story" restored from session storage, but no card and no Next
  // place button. Rehydrate the persisted drop when it matches the dealt
  // place (the reveal animation already played pre-reload, so the card
  // shows immediately); otherwise fail safe by advancing to the next
  // question — the interrupted place's result is already in run.results
  // (dropPin appends it), so this loses nothing and never double-scores.
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    if (run.phase !== "done" && run.phase !== "story") return;
    const saved = readDrop();
    const dealt = dealer.at(run.index);
    if (saved && dealt && saved.placeId === dealt.id) {
      setDrop(saved);
      setRevealDone(true);
    } else {
      clearDrop();
      onRun(continueRun(run));
    }
    // Mount-once: dealer/run/onRun are the initial restored values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAim(null);
    setBubble(defaultBubbleView());
    if (
      run.results.length > 0 ||
      (session?.placesPlayed ?? 0) > 0 ||
      userCollapsedBubbleRef.current
    ) {
      setBubble("collapsed");
    }
    setCardDismissed(false);
    // Hint UI resets per place (10-18: one hint per place).
    setHintsUsedThisPlace(0);
    setHintMessage(null);
  }, [place?.id]);

  // Mascot offer dismissal resets per run (a new run is a fresh chance).
  useEffect(() => {
    setOfferDismissed(false);
  }, [run?.seed]);

  // Reveal watchdog (deadlock fail-safe): the result card renders only after
  // the map's reveal reaches its end state (`reveal-done` → onRevealComplete).
  // If that signal is ever lost — a stuck controller beat, a swallowed
  // moveend, an exception in the reveal dispatch, a mid-beat commit whose beat
  // never completes — the run would strand in "Showing the answer." with no
  // result card, no Next place, and drop-pin disabled. That is a hard
  // game-flow deadlock, so it can never be left to the map alone: while the
  // story phase is showing an unrevealed place, arm a one-shot timer that
  // forces the reveal complete. The real `reveal-done` always wins the race
  // (the timeout is far longer than the 2.2 s reveal beat), and the timer is
  // cleared the moment the reveal completes or the place changes. The
  // console warning leaves a trace for future diagnosis, and the existing
  // sr-only live region announces the card exactly as it does for a normal
  // reveal, so screen-reader users get the same feedback.
  useEffect(() => {
    if (!shouldArmRevealWatchdog(run.phase, place != null, revealDone)) return;
    const placeId = place!.id;
    const timer = window.setTimeout(() => {
      console.warn(
        `[meridian] reveal watchdog fired for place "${placeId}": ` +
          "the map never emitted reveal-done; forcing the result card so " +
          "the game cannot deadlock in \"Showing the answer.\".",
      );
      setRevealDone(true);
    }, REVEAL_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [run.phase, place?.id, revealDone]);

  // M5: Escape dismisses the result card when committed, and toggles the
  // question bubble when aiming with no pin (AIM_EMPTY). Pin clearing (AIM_PIN)
  // is handled by satellite-map via onClearAim; the AIM_PIN guard below keeps
  // this listener from double-handling it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // The cleared celebration owns Escape while it is open: its own
      // handler dismisses the dialog, and falling through here would also
      // dismiss the result card beneath it (phase "done" !== "aim"). Yield
      // when the dialog is closed and the M5 behavior is unchanged.
      if (celebrationOpen) return;
      if (run.phase !== "aim") {
        setCardDismissed(true);
        return;
      }
      if (aim !== null) return;
      setBubble((view) => {
        const next =
          view === "dismissed" ? view : view === "collapsed" ? "open" : "collapsed";
        userCollapsedBubbleRef.current = next !== "open";
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [run.phase, aim, celebrationOpen]);

  useEffect(() => {
    // Review and challenge sessions: an exhausted queue (place undefined)
    // renders the completion screen — never the run "done" phase.
    if (review || challenge) return;
    if (place || run.phase === "done" || run.phase === "summary") return;
    onRun({ ...run, phase: "done" });
  }, [onRun, place, review, challenge, run]);

  useEffect(() => {
    if (run.phase !== "story" || !place) {
      setStory(null);
      return;
    }
    let cancel = false;
    const placeId = place.id;
    // Age-profile card boundary (Phase 1 §2 mid-session rule): a staged
    // band change applies to the NEXT card, never the current one. The pool
    // was composed at run start under the old band, so the new card's story
    // is re-mapped for the effective band from the place's rung parts.
    const boundaryProfile = applyPendingAtBoundary();
    const authored = storyForBand(place, resolveBand(boundaryProfile));
    setStory(authored);
    // Blurb-only generated places skip the stylistic rewrite: the result
    // card's useAiStory owns Nano enrichment for them (one model wake,
    // badged sentence). Waking the model twice per reveal — rewrite plus
    // story query — costs battery for no added teaching.
    if (shouldFireAiStory(place)) return;
    void revealStory(placeId, authored).then((text) => {
      if (!cancel) setStory(text);
    });
    return () => {
      cancel = true;
    };
  }, [place, run.phase]);

  const marks = useMemo<readonly MapMark[] | undefined>(() => {
    if (run.phase === "aim") {
      return aim ? [{ lon: aim.lon, lat: aim.lat, tone: "aim" }] : undefined;
    }
    if (!drop || !place || drop.placeId !== place.id) return undefined;
    return [
      { lon: drop.lon, lat: drop.lat, tone: "pin" },
      { lon: place.lon, lat: place.lat, tone: "spot" },
    ];
  }, [aim, drop, place, run.phase]);

  const variation = useMemo<MapVariation | null>(() => {
    if (run.phase === "aim" || !drop || !place || drop.placeId !== place.id) return null;
    return {
      pin: { lon: drop.lon, lat: drop.lat },
      spot: { lon: place.lon, lat: place.lat },
      kilometers: drop.distanceKm,
      // Review cards replay the original question's hit radius.
      // Otherwise the age-profile band scales the tolerance (Phase 1 §3a):
      // x1.5 / x1.25 / x1.0, clamps applied after the multiplier.
      // Challenge runs are the exception: the radius is the one the
      // link pinned, snapshotted on the run (challengeRadiusOf) —
      // never scaled by the player's age band, because sender and
      // receiver may be in different bands and a shared route is only
      // fair if both players face the identical circle. mc1 routes
      // resolve to the historic 750 km through the same accessor.
      // This value must match the one onConfirm judges with, below.
      radiusKm: challenge
        ? challengeRadiusOf(run)
        : review
          ? (reviewEntry?.place.radiusKm ?? radiusKm("globe", 0))
          : pinToleranceKm(run.bandConfig?.band ? normalizeSnapshotBand(run.bandConfig.band) : ageBand, run.edition, greaterSideKm(boundsFor(run))),
      // Same unit as the result headline — USA plays read miles (owner ruling 2026-10-11).
      unit: unitForEdition(run.edition, run.regionId),
    };
  }, [drop, place, review, reviewEntry, run]);

  function onAim(lon: number, lat: number) {
    if (run.phase !== "aim" || !place) return;
    setAimAnnouncement(
      aim
        ? "Pin moved. Double-tap the map or press Drop pin to lock in your guess."
        : "Pin placed. Double-tap the map or press Drop pin to lock in your guess.",
    );
    setAim({ lon, lat });
    // The target chip yields while the pin is in motion and settles
    // back once aim movements stop (see the chip's comment).
    setChipSettling(true);
    if (chipSettleTimer.current !== null) window.clearTimeout(chipSettleTimer.current);
    chipSettleTimer.current = window.setTimeout(() => setChipSettling(false), 700);
  }

  // M5: Escape with a pin clears it.
  function onClearAim() {
    if (run.phase !== "aim") return;
    setAimAnnouncement("Pin cleared.");
    setAim(null);
  }

  function onConfirm(lon: number, lat: number) {
    if (run.phase !== "aim" || !place) return;
    const distance = distanceKm([lon, lat], [place.lon, place.lat]);
    // Review cards are judged against the hit radius of the original
    // question (snapshotted at miss time) — the same bar as the first try.
    // Otherwise the age-profile band scales the tolerance (Phase 1 §3a).
    // Challenge runs judge against the run's snapshotted radius (see
    // the variation above for why): this is the judgement call site,
    // and the mc1 E2E 600 km-hit / 800 km-miss pair brackets the 750 km
    // an mc1 route resolves to through the same accessor.
    const radius = challenge
      ? challengeRadiusOf(run)
      : review
        ? (reviewEntry?.place.radiusKm ?? radiusKm("globe", 0))
        : pinToleranceKm(run.bandConfig?.band ? normalizeSnapshotBand(run.bandConfig.band) : ageBand, run.edition, greaterSideKm(boundsFor(run)));
    const hit = isHit(distance, radius);
    // v3: the place is scored with the streak engine + difficulty multiplier;
    // a miss scores 0 and resets the streak (handled in dropPin). Review is
    // practice, not scoring: no points, so nothing can leak into the session.
    const scored =
      !review && hit
        ? scorePlace({
            distanceKm: distance,
            ring: scoreRingForEdition(run.edition),
            difficulty: place.difficulty,
            streakBefore: run.streak,
            edition: run.edition,
            regionId: run.regionId,
            pin: [lon, lat],
            target: [place.lon, place.lat],
          })
        : null;
    setAim(null);
    setAimAnnouncement(null);
    const nextDrop: Drop = {
      lon,
      lat,
      distanceKm: distance,
      placeId: place.id,
      breakdown: scored,
      streakBefore: run.streak,
    };
    setDrop(nextDrop);
    // Mirror the hit outcome for the reveal-complete fanfare (ref avoids
    // stale closures in the map's animation callback).
    dropHitRef.current = scored !== null;
    // Persisted so a reload during the result card can rehydrate it; the
    // mount restore validates the shape and the place match before use.
    writeDrop(nextDrop);
    const bankedBefore = run.results.length;
    const nextRun = dropPin(run, distance, radius, scored);
    onRun(nextRun);
    // Bank the scored place into the session exactly once: dropPin appends
    // exactly one result per aim-phase commit, so the length check guards
    // the (unreachable here) no-op path. Skipped for the tutorial practice
    // round — the tour is unscored practice. Review sessions record their
    // learning record and deck sync below but never bank into the session's
    // totals and streaks. Challenge runs skip banking for the same
    // reason they skip the other stores: the score belongs to the
    // shared route's own completion screen, not to this player's
    // session totals.
    if (!tutorial && !challenge && nextRun.results.length > bankedBefore) {
      if (!review) {
        onBankPlace({
          edition: run.edition,
          score: hit && scored ? scored.score : 0,
          hit,
          distanceKm: distance,
          streakAfter: nextRun.streak,
          difficultyChoice: run.difficultyChoice,
          regionId: run.regionId,
          regionName: run.regionName,
        });
      }
      // Learning record: observational, flag-gated, fail closed. Runs
      // *beside* bankPlace — never inside dropPin/bankPlace — and can never
      // throw into the pin-commit path or corrupt the session. The growth
      // line on the reveal card is derived from the stored record at render
      // time, so it survives a reload exactly like the drop does.
      //
      // Review answers record against the card's ORIGINAL edition/region
      // (never the synthetic review run), so retention, mastery, and
      // region trends stay truthful — and the deck sync lives here too:
      // a normal-play miss joins the deck, a review answer reschedules its
      // card, and a newly mastered place leaves the deck.
      if (learningEnabled) {
        try {
          setLearningStore((prev) => {
            const at = Date.now();
            const answered = recordAnswer(prev ?? emptyLearningStore(), {
              placeId: place.id,
              edition: review ? (reviewEntry?.place.edition ?? "globe") : run.edition,
              regionId: review ? (reviewEntry?.place.regionId ?? run.regionId) : run.regionId,
              regionName: review ? (reviewEntry?.place.regionName ?? run.regionName) : run.regionName,
              distanceKm: distance,
              radiusKm: radius,
              hit,
              score: hit && scored ? scored.score : 0,
              at,
            });
            // recordAnswer is pure (same input → same output), so even if
            // React re-invokes this updater the write is idempotent.
            writeLearningStore(answered.store);
            try {
              const deck = readReviewDeck() ?? emptyReviewDeck();
              let nextDeck = deck;
              // Idempotency guard: the updater above must stay pure — if
              // React ever re-invokes it, the second pass must not advance
              // the Leitner streak a second time for the same attempt.
              const alreadyRecorded =
                deck.entries[place.id]?.lastReviewedAt === at;
              if (!alreadyRecorded) {
                if (review) {
                  nextDeck = recordReview(deck, place.id, hit, at);
                } else if (!hit) {
                  nextDeck = upsertMiss(deck, snapshotForDeck(place, run, radius), at);
                }
              }
              if (answered.event.newlyMastered) {
                nextDeck = removeDeckEntry(nextDeck, place.id);
              }
              writeReviewDeck(nextDeck);
            } catch {
              // Deck storage failure must never break the game.
            }
            return answered.store;
          });
        } catch {
          // Storage failure must never break the game.
        }
      }
    }
  }

  function onTutorialCardAdvance() {
    // The tutorial practice round has no "next place" (its single-place
    // pool would recycle the same question): the card's Next place button
    // and the beat-2 "Got it" button both advance the tour to the closing
    // hook instead.
    setCardDismissed(true);
    onTutorialAdvance(3);
  }

  // Hint UI (follow-up Item A): a hint reveals a directional nudge —
  // never points, never the answer. The policy comes from the run's
  // band snapshot (deal-time); the button state is per-place for 10-18.
  // Fail closed: no place or no bounds = no hint.
  function onUseHint() {
    if (!run || !place) return;
    const policy = run.bandConfig?.hintPolicy ?? "none";
    if (!canUseHint(policy, hintsUsedThisPlace)) return;
    // Globe edition has no region bounds: fall back to the whole world.
    // The quadrant is still coarse enough to never pinpoint.
    const b: [number, number, number, number] = bounds ?? [-180, -90, 180, 90];
    const message = directionalHint(place.lon, place.lat, b);
    setHintMessage(message);
    setHintsUsedThisPlace((n) => n + 1);
    onRun({ ...run, hintsUsed: (run.hintsUsed ?? 0) + 1 });
  }

  function onContinue() {
    // Cleared-mode primary trigger, checked BEFORE advancing: if the
    // just-answered place completes the band's catalog (persistent history
    // plus the place just answered covers every band place), the band is
    // cleared. Celebrate INSTEAD of advancing — the player stays on the
    // answered reveal, and tapping "Next place" again advances normally
    // because the mark is already set. Never fires mid-question: this is
    // the "Next place" handler only.
    const justAnswered = dealer.at(run.index);
    // The mark check comes first: once celebrated, no later tap in this
    // cycle can re-trigger, so the catalog/history scan below is skipped.
    // Review sessions never celebrate clears: the deck is a practice queue,
    // not a difficulty band.
    if (!review && !challenge && justAnswered && !wasClearedCelebrated(run.edition, run.regionId, run.difficultyChoice)) {
      // The band catalog is the unfiltered region catalog narrowed by the
      // run's difficulty band — the same filter the replay path uses.
      const bandCatalogIds = dealingPoolFor(places, run.difficultyChoice).map(
        (place) => place.id,
      );
      if (bandCatalogIds.length > 0) {
        // The persistent history plus the place just answered covers the
        // band's catalog: the band is cleared. Checked through the
        // canonical isBandCleared helper over a union store (the history
        // write for the just-answered place may not have landed yet).
        const seenUnion = memorySeenStore();
        seenUnion.write([
          ...seenStoreFor(run.edition, run.regionId, run.difficultyChoice).read(),
          justAnswered.id,
        ]);
        if (isBandCleared(bandCatalogIds, seenUnion)) {
          markClearedCelebrated(run.edition, run.regionId, run.difficultyChoice);
          onCleared({
            edition: run.edition,
            regionId: run.regionId,
            regionName: run.regionName,
            choice: run.difficultyChoice,
          });
          return;
        }
      }
    }
    setDrop(null);
    clearDrop();
    setAimAnnouncement(null);
    setRevealDone(false);
    onRun(continueRun(run));
    // Celebration audio (spec §3): the next chart unrolls — fired when the
    // player taps "Next place" and a new question actually deals. The
    // cleared path above returns early, so the celebration never
    // double-sounds the applause; reload-restores advance silently.
    playCelebrationSound("nextPlace");
    // Wave 1 P0 Item 3 (3B): the Next place button unmounts with the
    // result card, so without this focus falls to body. After the new
    // question commits, land on its map (tabIndex 0, role application):
    // one Tab then reaches the new question's controls, and the live
    // paragraph above announces the new question ("Find …").
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(".satellite-map")
        ?.focus({ preventScroll: true });
    }, 0);
  }

  function onEndGame() {
    if (challenge) {
      clearDrop();
      onRun(endRun(run).run);
      return;
    }
    // The summary tallies the whole session (every edition played), not
    // just this run; the session ends here.
    const final = requestEndGame();
    setSummary(final);
    clearDrop();
    onRun(endRun(run).run);
  }

  function onSummaryDone() {
    setSummary(null);
    finishSummary();
    // Wave 1 P0 Item 3 (3C): closing the summary unmounts Play — and the
    // End-game opener with it — for home, so returning focus to the
    // opener would land on body. Focus return rides GameApp's
    // landHomeFocusRef flag (set by the summary-done handler that
    // finishSummary runs): its effect retries after every commit and
    // lands on the home heading once Choose has mounted — never body,
    // never a hidden control. No setTimeout here: a single-shot timeout
    // silently no-ops when Choose has not mounted yet.
  }

  function onSummaryPlayAgain() {
    setSummary(null);
    void onReplay();
  }

  // Play-again replay: the same resumeRun chain as openRun. A finished run
  // (phase "summary") always restarts via startRun with a fresh dealing seed,
  // so the replayed run opens on a different first question. Local state is
  // reset explicitly because the [place?.id] effect below only fires when the
  // dealt place actually changes.
  async function onReplay() {
    setAim(null);
    setAimAnnouncement(null);
    setDrop(null);
    clearDrop();
    userCollapsedBubbleRef.current = false;
    setBubble(defaultBubbleView());
    setCardDismissed(false);
    setRevealDone(false);
    // Fresh map instance for the replayed run (see mapKey above).
    setMapKey((k) => k + 1);
    const replayDateKey = trailDate();
    // Play again replays under the SAME difficulty band the run started with:
    // the pool is re-filtered from run.difficultyChoice — never silently
    // widened back to the full catalog.
    const { poolIds: replayPoolIds, prevLastId: replayPrevLastId, cycleCompleted: replayCycleCompleted } = poolForRunStart(
      dealingPoolFor(places ?? [], run.difficultyChoice),
      run.edition,
      run.regionId,
      run.difficultyChoice,
    );
    // Cleared-mode backstop, same as openRun: a completed cycle here means
    // the band was fully played through (e.g. a crash before the onContinue
    // trigger could celebrate). Already celebrated -> the new cycle begins
    // silently; otherwise celebrate immediately, once per clear.
    if (replayCycleCompleted) {
      if (wasClearedCelebrated(run.edition, run.regionId, run.difficultyChoice)) {
        clearClearedMark(run.edition, run.regionId, run.difficultyChoice);
      } else {
        markClearedCelebrated(run.edition, run.regionId, run.difficultyChoice);
        onCleared({
          edition: run.edition,
          regionId: run.regionId,
          regionName: run.regionName,
          choice: run.difficultyChoice,
        });
      }
    }
    const freshRun = resumeRun(
      run,
      {
        edition: run.edition,
        regionId: run.regionId,
        regionName: run.regionName,
        dateKey: replayDateKey,
        difficultyChoice: run.difficultyChoice,
      },
      replayPoolIds,
      replayPrevLastId,
    );
    // Core F-2: the replayed run commits only after the territory
    // preload lands — the same awaited funnel as openRun. A summary can
    // be reached in a document where the countries-50m load failed or
    // never started (its readers fail closed), and the replay's first
    // pin drop must score against the real data. preloadTerritory
    // never rejects, so this await cannot fail the replay.
    await preloadTerritory();
    onRun(freshRun);
    // Play again after End game: the old session ended with the summary, so
    // the replay starts a brand-new session.
    onReplayed(freshRun);
  }

  // Review sessions replay each card's original question context: the map
  // reframes per card. The satellite-map effect remounts on edition/region/
  // bounds change — but a review advance can change ONLY the card (same
  // edition/region/mode, new bounds identity), and the in-place effect
  // remount does not reliably re-run the narrow beat (live bug: Nebraska
  // card 2 stuck on the intro globe). Keying by review card forces the
  // proven fresh-mount path per card, exactly like the replay remount.
  const mapKeyForCard = review && place ? `review:${place.id}:${mapKey}` : mapKey;
  const mapEdition: Edition = review ? (reviewEntry?.place.edition ?? "globe") : run.edition;
  const mapRegionName = review
    ? (reviewEntry?.place.regionName ?? REVIEW_DECK_REGION_NAME)
    : run.regionName;
  // The satellite map resolves its region geometry BY NAME (the atlas
  // index in satellite-map.tsx), so it must be handed the region's real
  // name — never the run's display name. A challenge run's regionName
  // is "<Region> challenge" (challengeRunFields), which names no atlas
  // region: the lookup missed, the painter fell back to an empty
  // polygon, and the challenge map showed no region outline or border
  // on either renderer (owner report, 2026-10-29). Display surfaces
  // (the question bubble) keep mapRegionName; only the map gets this.
  const satelliteRegionName = challenge
    ? (findRegion(run.edition, run.challengeRegionId ?? "globe")?.name ??
      mapRegionName)
    : mapRegionName;
  const mode = review
    ? (reviewEntry?.place.mapMode ?? "globe")
    : run.edition === "globe"
      ? "globe"
      : "flat";
  const bounds = review
    ? reviewEntry?.place.regionBounds
    : run.edition === "globe"
      ? undefined
      : boundsFor(run);
  // The reveal card describes the question as originally asked: the card's
  // original edition/region, never the synthetic review run.
  const displayRun: Run =
    review && reviewEntry
      ? { ...run, edition: reviewEntry.place.edition, regionName: reviewEntry.place.regionName }
      : run;
  // Cards due right now (for the end-game "Review my misses" invitation).
  // Read fresh when the summary opens — the deck may have grown during
  // the session that just ended.
  const reviewDueCount = useMemo(
    () =>
      learningEnabled && run.phase === "summary"
        ? deckCounts(readReviewDeck() ?? emptyReviewDeck(), Date.now()).due
        : 0,
    [learningEnabled, run.phase],
  );

  // "Start over" entry on ReviewComplete (manifest 2026-10-28, D16):
  // its visibility derives from a FRESH deck read at this render — not
  // from the home reset epoch and not from deck state threaded down —
  // so a reset performed on this screen hides the control at once, and
  // total={pool.length} below stays the review-queue total it has
  // always been.
  const reviewDeckTotal =
    review && run.index >= pool.length
      ? deckCounts(readReviewDeck() ?? emptyReviewDeck(), Date.now()).total
      : 0;

  // "Challenge a friend — pick a map" on ReviewComplete (manifest
  // §1(e)): entering the creation flow sounds the card tap (the
  // Package B precedent — every creation entry sounds); the GameApp
  // handler owns the exit + mini-picker transition and re-checks the
  // flag at tap. Rendered only while this screen's boot-authoritative
  // flag read says on — see the ReviewComplete call site below.
  const reviewChallengeTap = useCallback(() => {
    playCardTap();
    onReviewChallenge();
  }, [onReviewChallenge]);

  /**
   * The summary's friend-challenge offers (manifest §1(d), Package A):
   * primary = the sender's OWN route — the places they just played, in
   * play order, first ten, offered once at least five were played; its
   * share opens a preview sheet first, carrying the exact-route
   * disclosure (the privacy trade's mitigation, §3). Secondary = a
   * fresh five in the same region. A run that ends before five places
   * has no exact route to share, so the fresh offer becomes the
   * primary and shares directly — on the Globe in its shipped mc1 form
   * byte for byte. A globe exact primary's TEXT also stays the shipped
   * one; its fragment is mc1, every other exact fragment is mc3.
   * Computed from the dealer: for a normal run the place at index i IS
   * dealer.at(i), so the played ids are exact — PlaceResult carries
   * scores, not ids.
   */
  const summaryChallengeOffers = useMemo(() => {
    const none = { primary: null, secondary: null } as {
      primary: {
        url: string;
        text: string;
        label: string;
        exact?: boolean;
        placeCount?: number;
        regionName?: string;
      } | null;
      secondary: { url: string; text: string; label: string } | null;
    };
    if (!friendChallengesEnabled || challenge || review || run.phase !== "summary") return none;
    const origin = `${window.location.origin}${window.location.pathname}`;
    // The exact offer needs the sender's own five; the FRESH offer does
    // not — the shipped summary offered a fresh route even when the run
    // ended before five places, and that surface is frozen in kind (the
    // frozen E2E pair at friend-challenge.desktop.spec.ts:792/:820 pins
    // it). Gating both on the played count was a Package A regression,
    // caught by those frozen tests.
    const playedIds: string[] = [];
    for (let i = 0; i < run.results.length; i++) {
      const dealt = dealer.at(i);
      if (dealt) playedIds.push(dealt.id);
    }
    // Package B (§Q2-B3): the summary exact mint carries the sender's
    // winner block — their score ON THIS ROUTE (the first ten played
    // places, the ones the route actually contains), their hit-mask
    // over those places, and attempts = storedCount + 1. The
    // recording itself happens in the effect under this memo, once
    // per run; here we only read the store. Globe exact stays mc1
    // and carries nothing (the frozen surface), and a zero route
    // score mints no block — the share then keeps its shipped text.
    const exactIds = playedIds.slice(0, CHALLENGE_MAX_PLACES);
    const routeScore = run.results
      .slice(0, CHALLENGE_MAX_PLACES)
      .reduce((s, r) => s + r.score, 0);
    const summaryTuple = challengeRouteTuple({
      scoringVersion: SCORING_VERSION,
      edition: run.edition,
      regionId: run.regionId,
      ids: exactIds,
    });
    let summaryAttempts = readRouteAttempts(summaryTuple) + 1;
    // Split-failure edge: with session storage blocked and local
    // storage working, the recording effect can record a completion
    // this read saw as absent, so this count can over-report by one.
    if (getSessionStorageItem(challengeRecordedSummaryKeyDef(run.seed))) {
      summaryAttempts = readRouteAttempts(summaryTuple);
    }
    const summaryWinner =
      run.edition === "globe"
        ? null
        : mintWinnerBlock({
            myScore: routeScore,
            myMask: hitMaskFromResults(run.results.slice(0, CHALLENGE_MAX_PLACES)),
            myAttempts: summaryAttempts,
            incomingBest: null,
          }).winner;
    const exact =
      run.results.length >= CHALLENGE_MIN_PLACES
        ? createChallengeRoute({
            edition: run.edition,
            regionId: run.regionId,
            scoringVersion: SCORING_VERSION,
            mode: "exact",
            exactIds: playedIds,
            winner: summaryWinner ?? undefined,
          })
        : null;
    const seenIds = new Set(
      seenStoreFor(run.edition, run.regionId, run.difficultyChoice).read(),
    );
    const sources = buildCreationSources({
      catalog: pool,
      choice: run.difficultyChoice,
      seenIds,
      runPoolIds: run.poolIds,
    });
    const fresh = createChallengeRoute({
      edition: run.edition,
      regionId: run.regionId,
      scoringVersion: SCORING_VERSION,
      mode: "fresh",
      sources,
      dealSeed: run.seed,
    });
    const regionPhrase =
      run.edition === "globe" ? "on the Globe" : `in ${exact?.regionName ?? run.regionName}`;
    const freshSecondary = fresh
      ? {
          url: `${origin}${fresh.fragment}`,
          label: `New route in ${fresh.regionName} instead`,
          text: buildFreshChallengeShareText({
            placeCount: fresh.placeCount,
            regionName: fresh.regionName,
            radiusKm: fresh.radiusKm,
            url: `${origin}${fresh.fragment}`,
          }),
        }
      : null;
    if (exact) {
      return {
        primary: {
          url: `${origin}${exact.fragment}`,
          // One label in every edition (manifest §1(d)): the primary
          // opens the preview sheet, whose disclosure names the
          // exact-route privacy trade before anything is shared.
          label: CHALLENGE_EXACT_SHARE_LABEL,
          exact: true,
          placeCount: exact.placeCount,
          regionName: exact.regionName,
          text: exact.fragment.startsWith("#c=mc1.")
            ? `Play the same ${exact.placeCount} places on the Globe!\n${origin}${exact.fragment}`
            : summaryWinner
              ? // The exact-with-target form (§Q3): the score hook is
                // the block's own attested number, so the words and
                // the wire can never disagree.
                exactRouteTargetShareText({
                  senderScore: summaryWinner.senderScore,
                  placeCount: exact.placeCount,
                  regionName: exact.regionName,
                  radiusKm: exact.radiusKm,
                  url: `${origin}${exact.fragment}`,
                })
              : `Play the same ${exact.placeCount} places ${regionPhrase}! I scored ${sessionTotal.toLocaleString("en-US")}.\n${CHALLENGE_VERSION_LINE}\n${origin}${exact.fragment}`,
        },
        secondary: freshSecondary,
      };
    }
    // No exact offer (fewer than five played): the fresh route becomes
    // the primary. On the Globe it takes the SHIPPED form byte for
    // byte — the same flat deal from this run's pool and seed, encoded
    // mc1 — because that surface predates mc2 and is frozen in kind.
    if (run.edition === "globe") {
      const gnPool = pool.filter((p) => /^gn-[0-9]+$/.test(p.id));
      if (gnPool.length < CHALLENGE_MIN_PLACES) return none;
      const ids = dealChallenge(
        gnPool.map((p) => ({ id: p.id, w: 1 })),
        CHALLENGE_MIN_PLACES,
        run.seed,
      );
      const fragment = encodeChallenge(ids, SCORING_VERSION);
      return {
        primary: {
          url: `${origin}${fragment}`,
          label: CHALLENGE_SHARE_LABEL,
          text: `Play the same ${ids.length} places on the Globe!\n${origin}${fragment}`,
        },
        secondary: null,
      };
    }
    if (!fresh) return none;
    return {
      primary: {
        url: `${origin}${fresh.fragment}`,
        label: CHALLENGE_SHARE_LABEL,
        text: freshSecondary!.text,
      },
      secondary: null,
    };
  }, [friendChallengesEnabled, challenge, review, run, dealer, pool, sessionTotal]);

  // Package B (§Q2-B3): arriving at a normal run's summary records
  // the completion that stands behind the exact-route mint — once
  // per run, guarded by a session storage marker with the run slots'
  // own lifetime (a reload at the summary cannot count the same play
  // twice; a genuinely replayed route is a new run and counts). Only
  // where a mint can exist: non-Globe (Globe exact is the frozen mc1
  // surface), at least five played, flag on.
  useEffect(() => {
    if (challenge || review || run.phase !== "summary") return;
    if (!friendChallengesEnabled || run.edition === "globe") return;
    if (run.results.length < CHALLENGE_MIN_PLACES) return;
    const ids: string[] = [];
    for (let i = 0; i < Math.min(run.results.length, CHALLENGE_MAX_PLACES); i++) {
      const dealt = dealer.at(i);
      if (dealt) ids.push(dealt.id);
    }
    if (ids.length < CHALLENGE_MIN_PLACES) return;
    const marker = challengeRecordedSummaryKeyDef(run.seed);
    // The port never throws and reads a blocked marker as absent;
    // recordRouteCompletion's own store fails just as softly, so a
    // blocked tab still ends at the mint reporting stored+1 unstored.
    if (getSessionStorageItem(marker)) return;
    recordRouteCompletion(
      challengeRouteTuple({
        scoringVersion: SCORING_VERSION,
        edition: run.edition,
        regionId: run.regionId,
        ids,
      }),
    );
    setSessionStorageItem(marker, "1");
  }, [
    challenge,
    review,
    run.phase,
    run.seed,
    run.edition,
    run.regionId,
    run.results.length,
    friendChallengesEnabled,
    dealer,
  ]);

  // The exact-route preview sheet (manifest §1(d)): the primary's tap
  // opens it BEFORE any sharing — the disclosure line is the privacy
  // trade's mitigation, and a share failure inside it still leaves a
  // visible, copyable link (§5). Rendered only while the summary is up
  // and the primary is an exact offer.
  const [summaryPreviewOpen, setSummaryPreviewOpen] = useState(false);
  const exactPrimary =
    run.phase === "summary" && summaryChallengeOffers.primary?.exact
      ? summaryChallengeOffers.primary
      : null;
  const summaryPreviewEl =
    summaryPreviewOpen && exactPrimary ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Challenge a friend"
        data-testid="challenge-preview"
      >
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
          <h2 className="font-display text-2xl text-fg">Challenge a friend</h2>
          <p className="mt-3 text-base text-fg">
            {exactPrimary.placeCount} places · {exactPrimary.regionName}
          </p>
          <p className="mt-2 text-base text-muted">
            This shares the exact places you just played, in order.
          </p>
          <p className="mt-2 text-base text-muted">{CHALLENGE_FAIRNESS_COPY}</p>
          <div className="mt-5 flex flex-col gap-2">
            <div data-testid="challenge-share-container" data-challenge-url={exactPrimary.url}>
              <ShareButton
                title="Meridian friend challenge"
                text={exactPrimary.text}
                url={exactPrimary.url}
                label={CHALLENGE_SHARE_LABEL}
                className="w-full"
                failureFallback={
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                    {exactPrimary.text}
                  </pre>
                }
              />
            </div>
            <Button variant="secondary" onClick={() => setSummaryPreviewOpen(false)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  // --- Package B: mid-run (b) and reveal (c) challenge creation ---
  // One creation path behind two entries: the run-menu item (aim) and
  // the result-card footer link (reveal). Both deal a FRESH five from
  // the run's region — the widening chain is the manifest §1(b) one:
  // run pool → region band, seen-INCLUDED → the run's loaded catalog,
  // which is buildCreationSources with NO seenIds (nothing is
  // subtracted). One honesty note: on Globe the loaded catalog is the
  // tier-split subset the run itself loaded, so the last step widens
  // within that subset — still in-region, still fail-closed (no source
  // reaching five means no entry is offered).
  // Creation is a pure read + fresh deal: it never touches the run,
  // the dealer, or the pool, and the flag is re-read at tap time
  // (click-atomic, §4) rather than trusted from render state. Normal
  // runs only — the same exclusion the summary offers ship with:
  // challenge runs pass their route along at completion (§1(f)) and
  // review is its own surface (§1(e), Package C).
  const [runChallengePreview, setRunChallengePreview] = useState<ChallengeCreation | null>(null);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const runChallengeSources = useMemo(
    () =>
      !challenge && !review && places
        ? buildCreationSources({
            catalog: places,
            choice: run.difficultyChoice,
            runPoolIds: run.poolIds,
          })
        : [],
    [challenge, review, places, run.difficultyChoice, run.poolIds],
  );
  const runChallengeAvailable =
    friendChallengesEnabled &&
    runChallengeSources.some(
      (source) => new Set(source.map((entry) => entry.id)).size >= CHALLENGE_MIN_PLACES,
    );
  const createRunChallenge = useCallback(() => {
    if (!isEnabled("friendChallenges")) return;
    const creation = createChallengeRoute({
      edition: run.edition,
      regionId: run.regionId,
      scoringVersion: SCORING_VERSION,
      mode: "fresh",
      sources: runChallengeSources,
      dealSeed: mintSeed(),
    });
    if (creation) {
      // The cartographer's tap, matching the other challenge entry
      // points (Package A's panel-cured precedent): entering the
      // creation flow sounds, whichever entry the player used.
      playCardTap();
      setRunChallengePreview(creation);
    }
  }, [run.edition, run.regionId, runChallengeSources]);
  // The menu never survives the run it belongs to: Escape closes it,
  // and the summary (or a new run) closes it too.
  useEffect(() => {
    if (!runMenuOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setRunMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runMenuOpen]);
  useEffect(() => {
    if (run.phase === "summary") setRunMenuOpen(false);
  }, [run.phase]);
  // The preview sheet for (b)/(c): the picker's sheet copy — what the
  // friend gets, stated before anything is shared; a share failure
  // inside it still leaves a visible, copyable link (§5).
  const runChallengePreviewEl = runChallengePreview ? (() => {
    const creation = runChallengePreview;
    const url = `${window.location.origin}${window.location.pathname}${creation.fragment}`;
    const text = buildFreshChallengeShareText({
      placeCount: creation.placeCount,
      regionName: creation.regionName,
      radiusKm: creation.radiusKm,
      url,
    });
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Challenge a friend"
        data-testid="challenge-preview"
      >
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
          <h2 className="font-display text-2xl text-fg">Challenge a friend</h2>
          <p className="mt-3 text-base text-fg">
            {creation.placeCount} places in {creation.regionName}
          </p>
          <p className="mt-1 text-base text-muted">
            Get inside the {creation.radiusKm} km circle — closer is better!
          </p>
          <p className="mt-2 text-base text-muted">{CHALLENGE_FAIRNESS_COPY}</p>
          <p className="mt-2 text-base text-muted">
            Your friend gets this exact route — the same {creation.placeCount} places, in this order.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <div data-testid="challenge-share-container" data-challenge-url={url}>
              <ShareButton
                title="Meridian friend challenge"
                text={text}
                url={url}
                label={CHALLENGE_SHARE_LABEL}
                className="w-full"
                failureFallback={
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                    {text}
                  </pre>
                }
              />
            </div>
            <Button variant="secondary" onClick={() => setRunChallengePreview(null)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  })() : null;

  // Review session complete: the due queue is exhausted. A bounded,
  // completable session — ADHD-friendly — never the endless run.
  if (review && run.index >= pool.length) {
    return (
      <section className="mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 pt-2 pb-8">
      <ReviewComplete
        results={run.results}
        total={pool.length}
        onDone={onEditions}
        onResetHistory={reviewDeckTotal > 0 ? onResetHistory : undefined}
        onChallengeFriend={friendChallengesEnabled ? reviewChallengeTap : undefined}
      />
      </section>
    );
  }
  if (challenge && (run.index >= pool.length || run.phase === "summary")) {
    // The completion screen's Done handler, shared by the screen and
    // its end-of-flow HomeButton slot.
    const challengeDoneHandler =
      (run.challengeOrigin === "mc2" || run.challengeOrigin === "mc3") && onChallengeDone
        ? onChallengeDone
        : onEditions;
    return (
      <ChallengeCompleteShell
        run={run}
        total={pool.length}
        onDone={challengeDoneHandler}
        onRetry={
          run.challengeWinner && onChallengeRetry
            ? () =>
                onChallengeRetry({
                  edition: run.edition,
                  regionId: run.challengeRegionId ?? "globe",
                  regionName:
                    findRegion(run.edition, run.challengeRegionId ?? "globe")?.name ??
                    run.regionName,
                  radiusKm: run.challengeRadiusKm ?? 750,
                  ids: [...run.poolIds],
                  originFormat: "mc3",
                  winner: run.challengeWinner ?? null,
                })
            : undefined
        }
        shareEnabled={friendChallengesEnabled}
        regionCatalog={challengeCatalog}
        posterUrl={verdictGrandpaPosterUrl}
        videoUrl={verdictGrandpaVideoUrl}
        homeButton={
          <EndOfFlowHome onHome={challengeDoneHandler} variant="primary" testId="challenge-done" />
        }
      />
    );
  }

  return (
    <section className="relative h-dvh bg-bg">
      <div className="absolute inset-0">
        <MapErrorBoundary>
            <MapHost
              key={`${mapKeyForCard}:${mapRemountNonce}`}
              tileRetriesUsed={tileRetriesUsed}
              onTileRetry={handleTileRetry}
              onTileFallback={handleTileFallback}
              onScoutUpgrade={scoutUpgradeEligible ? handleScoutUpgrade : undefined}
              mode={mode}
              mapMode={mapMode}
              initialView={scoutSwitchView}
              onWebglContextLost={handleWebglContextLost}
              edition={mapEdition}
              regionName={satelliteRegionName}
              bounds={bounds}
              onAim={onAim}
              onConfirm={onConfirm}
              onClearAim={onClearAim}
              marks={marks}
              variation={variation}
              spot={place ? { lon: place.lon, lat: place.lat } : null}
              onRevealComplete={() => {
                setRevealDone(true);
                // Guess outcome fanfare: hit → triumphant win, miss →
                // descending lose. Uses the ref (not stale closure).
                if (soundAudible() && dropHitRef.current !== null) {
                  safePlay(dropHitRef.current ? playWin : playLose);
                }
              }}
            />
          </MapErrorBoundary>
        <div className="pointer-events-none absolute top-2 right-2.5 left-2.5 z-30 flex items-start justify-between gap-2 sm:top-3 sm:right-3 sm:left-3 sm:gap-3">
          <div className="flex items-start gap-1.5 sm:gap-2">
            {review ? (
              <Button variant="secondary" className="pointer-events-auto" onClick={onEditions}>
                {REVIEW_DECK_COPY.exitReview}
              </Button>
            ) : (
              <EndOfFlowHome onHome={onEditions} variant="secondary" className="pointer-events-auto" />
            )}
            {/* In-game mute (Veeresh's ask): the same meridian.sound toggle
                as the home header, reachable mid-game. Mutes every sound —
                all play calls go through the isSoundEnabled() gate. */}
            <SoundToggle
              testId="sound-toggle-game"
              className="pointer-events-auto rounded-md border border-line bg-surface px-2.5 py-2 text-fg transition-colors"
            />
            {/* High-contrast view (manifest 2026-10-27): the same
                meridian.palette toggle, reachable mid-game; flipping
                repaints in place and never ends the run. Sized to the
                44px tap-target floor. */}
            <HighContrastToggle
              testId="high-contrast-toggle-game"
              className="pointer-events-auto flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-fg transition-colors"
            />
            {/* Scout Map settings toggle. The choice writes
                meridian:map-mode and sends the player home — the new
                mode takes effect in the next game, because the map is
                built once per game (owner ruling, 2026-10-20). In a
                challenge run it renders its challenge context instead
                (reason copy, no switch): a challenge's map is picked
                at challenge open, and the flip must never force-home
                out of a challenge (owner ruling, 2026-10-29). */}
            <MapModeToggle
              mapMode={mapMode}
              onSelect={onManualMapMode}
              context={challenge ? "challenge" : "play"}
            />
            {/* Package B (§1(b)): the run menu. Mid-run challenge
                creation lives HERE — one item in this overflow, in the
                header chrome cluster beside the other run controls —
                never as a new button on the aim surface, and physically
                separated from End game (which sits in the bottom dock /
                top-right score cluster). Aim phase only: the reveal has
                its own entry (§1(c)) and the summary its own (§1(d)).
                The button is not rendered at all when no route can be
                dealt or the flag is off: flag-off means the feature
                does not exist (§4). The popover is RIGHT-anchored on
                purpose: this cluster's right edge sits ~297px from the
                viewport's left at any width, so the 288px panel always
                fits on screen — a left-anchored panel would spill past
                the right edge on phone-width viewports. */}
            {runChallengeAvailable && run.phase === "aim" ? (
              <div className="relative pointer-events-auto">
                <button
                  type="button"
                  data-testid="run-menu-button"
                  aria-expanded={runMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Run menu"
                  onClick={() => setRunMenuOpen((v) => !v)}
                  className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface text-fg transition-colors"
                >
                  <MoreHorizontal aria-hidden="true" size={20} />
                </button>
                {runMenuOpen ? (
                  <div
                    role="menu"
                    data-testid="run-menu"
                    className="pointer-events-auto absolute top-full right-0 z-40 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="run-menu-challenge"
                      onClick={() => {
                        setRunMenuOpen(false);
                        createRunChallenge();
                      }}
                      className="flex min-h-[44px] w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-fg transition-colors hover:bg-bg"
                    >
                      {challengeMidRunLabel(run.regionName)}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {review ? (
            <p
              data-testid="review-progress"
              className="game-chrome pointer-events-auto rounded-md px-3 py-2 text-sm font-semibold"
            >
              {REVIEW_DECK_COPY.progressOf} {Math.min(run.index + 1, pool.length)} of{" "}
              {pool.length}
            </p>
          ) : challenge ? (
            <p
              data-testid="challenge-progress"
              className="game-chrome pointer-events-auto rounded-md px-3 py-2 text-sm font-semibold tabular-nums"
            >
              Place {Math.min(run.index + 1, pool.length)} of {pool.length} ·{" "}
              {run.results.reduce((s, r) => s + r.score, 0).toLocaleString("en-US")} pts
            </p>
          ) : (
          <div className="flex flex-col items-end gap-0.5 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                data-testid="score-total"
                aria-expanded={showBreakdown}
                aria-controls="session-score-breakdown"
                aria-label={`Session score ${sessionTotal.toLocaleString("en-US")}. Toggle score breakdown by edition and difficulty.`}
                onClick={() => setShowBreakdown((v) => !v)}
                className="game-chrome pointer-events-auto rounded-md px-2 py-0.5 text-[11px] leading-tight font-semibold tabular-nums whitespace-nowrap sm:px-3 sm:py-2 sm:text-sm"
              >
                SCORE {sessionTotal.toLocaleString("en-US")}
              </button>
              {showBreakdown && session ? (
                <div
                  id="session-score-breakdown"
                  data-testid="session-score-breakdown"
                  className="pointer-events-auto absolute top-full right-0 z-40 mt-1 w-44 rounded-md border border-line bg-surface p-2 text-xs shadow-lg"
                >
                  {summarizeSession(session).byEdition.map((b) => (
                    <div key={b.edition} className="flex items-center justify-between py-1">
                      <span className="text-muted">{EDITION_LABELS[b.edition]}</span>
                      <span className="font-semibold tabular-nums text-fg">
                        {b.score.toLocaleString("en-US")}
                      </span>
                    </div>
                  ))}
                  {breakdownDifficulties.length > 0 ? (
                    <>
                      <div className="my-1 border-t border-line" aria-hidden="true" />
                      {breakdownDifficulties.map((d) => (
                        <div
                          key={d.difficulty}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-muted">
                            {DIFFICULTY_LABELS[d.difficulty]} · {d.hits}/{d.places} (
                            {formatSuccessRate(d.hits, d.places)})
                          </span>
                          <span className="font-semibold tabular-nums text-fg">
                            {d.score.toLocaleString("en-US")}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="sr-only">
              Session score {sessionTotal.toLocaleString("en-US")}
            </span>
            <div className="flex items-center gap-1.5">
              {run.streak >= 2 ? (
                // The flame celebrates the LIVE streak in this run (each
                // edition is a fresh run with its own combo); the summary's
                // "best streak" is session-wide and may come from another
                // edition. Both labels are honest about what they measure.
                <p
                  data-testid="streak-flame"
                  className="game-chrome rounded-md px-1.5 py-0.5 text-[11px] leading-tight tabular-nums whitespace-nowrap sm:px-3 sm:py-1.5 sm:text-sm"
                >
                  <span role="img" aria-label={`${run.streak}-place streak`}>
                    🔥
                  </span>{" "}
                  {run.streak}
                </p>
              ) : null}
              <p className="game-chrome rounded-md px-2 py-0.5 text-[11px] leading-tight whitespace-nowrap sm:px-3 sm:py-2 sm:text-sm">
                {/* Session-scoped places (not this run's): switching editions
                    no longer drops the counter back to 0. */}
                {session?.hits ?? run.hits} placed
              </p>
            </div>
            {/* Place-card redesign 2026-10-11: the aim-phase End-game pill
                lives in the bottom-right dock (it overlapped the question
                card's X dismiss at 390px when it sat here). During
                story/done the question card's X is gone, so this slot never
                overlapped — the pill is restored here for those phases, in
                its pre-redesign slot. Never shown in summary; the action
                (onEndGame) is untouched. */}
            {run.phase === "story" || run.phase === "done" ? (
              <button
                type="button"
                onClick={onEndGame}
                className="game-chrome pointer-events-auto rounded-md px-3 py-1.5 text-xs"
              >
                End game
              </button>
            ) : null}
          </div>
          )}
        </div>
      </div>
      {/* The target chip (§Q4, Package B): bottom-centre above the
          aim controls, non-interactive and aria-hidden (the live
          region owns announcements). It shows the chain's best and
          the running score — until the target leaves reach: once
          running + the most the remaining stops can still pay < the
          best, the chip drops the target and counts landed stops
          instead (a deficit counter must not ride a run that can no
          longer be won). It hides while the aim pin is being moved:
          onAim fires through a drag, so the chip yields and settles
          back ~700 ms after the last aim movement. */}
      {challenge && run.challengeWinner && (run.phase === "aim" || run.phase === "story") && !chipSettling
        ? (() => {
            const best = run.challengeWinner.bestScore;
            const running = run.results.reduce((s, r) => s + r.score, 0);
            // Attainability at the remaining places' OWN tiers
            // (owner D2 amendment, 2026-11-01): the tier-blind bound
            // fired late or never on easy routes, so the deficit
            // counter rode runs that could no longer be won.
            const remainingDifficulties = run.poolIds
              .slice(run.results.length)
              .map((id) => pool.find((p) => p.id === id)?.difficulty ?? 5);
            const unreachable =
              running +
                maxAttainableRemaining(
                  remainingDifficulties,
                  trailingStreak(run.results),
                ) <
              best;
            const hits = run.results.filter((r) => r.hit).length;
            return (
              <div
                data-testid="challenge-target-chip"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-30 flex justify-center"
              >
                <p className="game-chrome rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums">
                  {unreachable
                    ? `landed ${hits} of ${pool.length}`
                    : `🎯 ${best.toLocaleString("en-US")} · you ${running.toLocaleString("en-US")}`}
                </p>
              </div>
            );
          })()
        : null}
      {/* Bottom-right dock (aim phase): the hint cluster rides ABOVE the
          End-game pill in a single flex column, so the two can never
          overlap (flex layout, no absolute offsets between them).
          Bottom-anchored at the End game's old 6.5rem slot, clear of the
          zoom controls below. #113's no-overlap rule holds for the
          question bubble in its normal, collapsed state. One accepted
          exception (owner, 2026-10-20): if a player expands the
          instructions while the hint offer is up on a short screen, the
          dock can cover the bubble's "Hide instructions" toggle — a
          known trade, recorded in BRANCH_STATUS.md. The End-game action
          (onEndGame) is untouched. */}
      {run.phase === "aim" ? (
        <div
          className="pointer-events-none absolute right-3 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-30 flex w-[min(300px,calc(100vw-24px))] flex-col items-end gap-2"
          data-testid="aim-dock"
        >
          {place ? (
            <HintPanel
              policy={run.bandConfig?.hintPolicy ?? "none"}
              hintsUsedThisPlace={hintsUsedThisPlace}
              missCount={run.results.filter((r) => !r.hit).length}
              hintMessage={hintMessage}
              offerDismissed={offerDismissed}
              onUseHint={onUseHint}
              onDismissOffer={() => setOfferDismissed(true)}
            />
          ) : null}
          <button
            type="button"
            onClick={onEndGame}
            data-testid="end-game-button"
            className="game-chrome pointer-events-auto flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold"
          >
            End game
          </button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {run.phase === "aim"
          ? (aimAnnouncement ?? (place ? `Find ${questionLabel}.` : null))
          : run.phase === "story" && place && revealDone
            ? `Pin dropped. ${drop ? formatLength(drop.distanceKm, unitForEdition(run.edition, run.regionId)) : "Hit"}. ${questionLabel}.${drop?.breakdown ? ` +${drop.breakdown.score} points.` : ""}`
            : run.phase === "story" && place
              // Wave 1 P0 Item 3: this paragraph is the ONE designated
              // reveal announcer, and it must announce exactly once per
              // reveal. The pre-card "Showing the answer." text was a
              // second announcement in the same reveal window, so the
              // beat stays silent here and speaks once at revealDone.
              ? null
              : run.phase === "summary" && summary
                ? `Game over. ${summary.placesPlayed} places, ${summary.hits} hits, total score ${summary.totalScore.toLocaleString("en-US")} — ${summary.byEdition
                    .map((b) => `${EDITION_LABELS[b.edition]} ${b.score.toLocaleString("en-US")}`)
                    .join(", ")}. Average ${summary.averagePerPlace} per place, best streak ${summary.bestStreak}.`
                : place
                  ? `Pin dropped.${drop ? ` ${formatLength(drop.distanceKm, unitForEdition(run.edition, run.regionId))}.` : ""} ${questionLabel} missed.`
                  : `${run.regionName} finished.`}
      </p>
      {run.phase === "aim" && place ? (
        <>
          <QuestionBubble
            edition={mapEdition}
            regionName={mapRegionName}
            placeName={questionLabel}
            difficulty={place.difficulty}
            hasPin={aim !== null}
            view={bubble}
            onViewChange={(next) => {
              userCollapsedBubbleRef.current = next !== "open";
              setBubble(next);
            }}
          />
          {/* Hint UI now lives in the bottom-right aim dock (above the
              End-game pill) — see the dock comment. Removed 2026-10-19:
              the old top-anchored cluster (top-28rem) grew downward into
              the bottom-anchored End-game pill on short viewports. */}
        </>
      ) : run.phase === "aim" && pool.length === 0 ? (
        <div
          data-testid="empty-band"
          className="pointer-events-auto absolute inset-x-3 top-16 z-30 mx-auto max-w-md rounded-xl border border-line bg-surface p-5 text-center shadow-lg"
        >
          <p className="text-sm tracking-wide text-muted uppercase">No places on this path</p>
          <p className="mt-2 text-lg text-fg">
            This learning path has no places here yet. Try a different path &mdash; or a
            different edition &mdash; to keep exploring.
          </p>
        </div>
      ) : null}
      {run.phase !== "aim" && run.phase !== "summary" && revealDone ? (
        <ResultCard
          run={displayRun}
          place={place}
          placeLabel={questionLabel}
          drop={drop}
          story={story}
          empty={places.length === 0}
          dismissed={cardDismissed}
          onDismissedChange={setCardDismissed}
          onContinue={() => {
            // PBI-5: the deferred switch note clears on Continue — it
            // belongs to the round that was playing at switch time.
            setScoutSwitchNote(null);
            (tutorial ? onTutorialCardAdvance : onContinue)();
          }}
          // Full dealing pool (not the banded subset): the nearest-place
          // fallback for the "Your pin" line scans it for the closest
          // same-territory place. Same array reference — no copy.
          poolPlaces={places}
          // The growth line is derived from the place's recorded attempts
          // (including the commit that just revealed it), so it recomputes
          // identically after a reload. Null when the flag is off.
          growthLine={
            learningEnabled && place
              ? growthLineFor(learningStore?.records[place.id]?.attempts ?? [])
              : null
          }
          // Package B (§1(c)): the reveal footer's challenge link —
          // present only when a fresh in-region route can be dealt.
          challengeOffer={
            runChallengeAvailable
              ? { regionName: run.regionName, onChallenge: createRunChallenge }
              : null
          }
        />
      ) : null}
      {runChallengePreviewEl}
      {/* WS-4 Phase 1: the same deferred break as the note below, for the
          satellite-failure switch. Its own copy and its own dismiss. */}
      {(tileSwitchNote && place && tileSwitchNote.placeId === place.id && (run.phase === "story" || run.phase === "done") && revealDone) ? (
        <div
          data-testid="tile-switch-note"
          role="status"
          className="pointer-events-none fixed inset-x-4 top-16 z-50"
        >
          <div className="game-chrome pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl p-4 pl-5 shadow-xl">
            <p className="m-0 flex-1 text-sm leading-snug">{TILE_FALLBACK_COPY.switchNote}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setTileSwitchNote(null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--game-chrome-line)] text-lg leading-none text-[var(--atlas-muted)] transition-colors hover:text-[var(--atlas-ink)]"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      ) : null}
      {/*
        PBI-5: the deferred Scout Map switch note — GameApp-level, SIBLING
        of ResultCard (never inside it). Renders only at the game-natural
        break (round end: story OR done phase + reveal done — a miss lands
        in "done", and the note must show there too), keyed to the switch
        event's place id; a tap anywhere else leaves it for that round only.
        fixed inset-x-4 top-16 z-50, role="status", one line + 44px dismiss.
      */}
      {(scoutSwitchNote && place && scoutSwitchNote.placeId === place.id && (run.phase === "story" || run.phase === "done") && revealDone) ? (
        <div
          data-testid="scout-switch-note"
          role="status"
          className="pointer-events-none fixed inset-x-4 top-16 z-50"
        >
          <div className="game-chrome pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl p-4 pl-5 shadow-xl">
            <p className="m-0 flex-1 text-sm leading-snug">{SCOUT_COPY.switchNote}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setScoutSwitchNote(null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--game-chrome-line)] text-lg leading-none text-[var(--atlas-muted)] transition-colors hover:text-[var(--atlas-ink)]"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      ) : null}
      {/* First-run tutorial beats. Beats 1–2 float over the map without
          intercepting taps (the overlay is pointer-transparent except its
          own buttons); beat 3 is the closing dialog. The tour never reaches
          the summary phase (its card advance goes to beat 3 instead), and
          the overlay stays out of the way if it ever does. */}
      {tutorial !== null && run.phase !== "summary" ? (
        <TutorialOverlay
          beat={tutorial}
          distanceKm={drop?.distanceKm ?? null}
          unit="km"
          hit={
            run.results.length > 0
              ? run.results[run.results.length - 1]!.hit
              : false
          }
          onSkip={onTutorialEnd}
          onGotIt={() => onTutorialAdvance(3)}
          onFinish={onTutorialEnd}
        />
      ) : null}
      {run.phase === "summary" && summary ? (
        <RunSummaryCard
          summary={summary}
          regionName={run.regionName}
          dateKey={run.dateKey}
          growth={
            learningEnabled
              ? growthSummary(learningStore ?? emptyLearningStore(), Date.now())
              : null
          }
          detectiveCelebration={detectivePairEnabled}
          onDone={onSummaryDone}
          onPlayAgain={onSummaryPlayAgain}
          onReview={onReviewDeck}
          reviewDueCount={reviewDueCount}
          challengePrimary={summaryChallengeOffers.primary}
          challengeSecondary={summaryChallengeOffers.secondary}
          onChallengePrimaryPreview={() => setSummaryPreviewOpen(true)}
        />
      ) : null}
      {summaryPreviewEl}
    </section>
  );
}
