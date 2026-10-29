import { distanceKm } from "@/game/geo";
import { formatLength, unitForEdition } from "@/game/units";
import { isHit, radiusKm } from "@/game/radius";
import { placesFor, poolSizeFor, storyForBand } from "@/game/generated-places";
import { CURRENT_BUILD_ID, isNewBuildDeployed } from "@/game/build-staleness";
import { preloadAdmin1Boundaries, preloadAdmin1ForCountry, admin1ChunkIso2ForRegion } from "@/game/reverse-geocode";
import { preloadTerritory } from "@/game/territory";
import {
  clearRunAfterUncleanShutdown,
  handlePageHide,
  isUncleanShutdown,
  stampCleanExitDirty,
} from "@/game/clean-exit";
import type { Starter } from "@/game/starters";
import { ADMIN1_BY_COUNTRY, COUNTRIES, STATES, greaterSideKm, type Region, type RegionBounds } from "@/game/regions";
import { rewriteStory } from "@/game/rewrite";
import { shouldFireAiStory } from "@/game/story-ai";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase, type PlaceResult } from "@/game/run";
import { isPickerDifficulty, type PickerDifficulty } from "@/game/tier-filter";
import { dealingPoolFor } from "@/game/easy-curation";
import {
  bankPlace,
  clearSession,
  DIFFICULTY_LABELS,
  EDITION_LABELS,
  endSession,
  formatSuccessRate,
  IDLE_TIMEOUT_MS,
  idleTimeoutFromSearch,
  idleWarnMsFor,
  isIdleExpired,
  isSessionLive,
  readSession,
  seedSessionFromRun,
  startSession,
  summarizeSession,
  touchSession,
  writeSession,
  type Session,
  type SessionSummary,
} from "@/game/session";
import { scoreRingForEdition } from "@/game/score";
import { SCORING_VERSION, scorePlace, type ScoredPlace } from "@/game/scoring";
import { createDealer, poolForNewRun, seenStoreFor, mintSeed, wasClearedCelebrated, markClearedCelebrated, clearClearedMark, memorySeenStore, isBandCleared } from "@/game/trail";
import { resolveRunPool } from "@/game/pool";
import { loadedForKey, placesLoadKey, type LoadedFor } from "@/game/places-load-key";
import type { MapMark, MapVariation } from "@/map/satellite-map";
import { MapErrorBoundary } from "./map-error-boundary";
import { BootSplash } from "./boot-splash";
import "./home-v5.css";
import heroMountainUrl from "@/assets/home-v5/hero-mountain.webp";
import globeFallbackUrl from "@/assets/home-v5/globe-fallback.webp";
import desertRuinsUrl from "@/assets/home-v5/desert-ruins.webp";
import patagoniaUrl from "@/assets/home-v5/patagonia.webp";
import archiveToolsUrl from "@/assets/home-v5/archive-tools.webp";
import journalTreeUrl from "@/assets/home-v5/journal-tree.webp";
import binocularsHatUrl from "@/assets/home-v5/binoculars-hat.webp";
import { Compass, Contrast, Flag, Globe2, MapPin, MoreHorizontal, Volume2, VolumeX } from "lucide-react";
import {
  initAudio,
  isSoundEnabled,
  playCardTap,
  playDifficultySelect,
  playEditionEntrance,
  playLose,
  playWin,
  setSoundEnabled,
} from "@/game/audio/sfx";
import { playCelebrationSound, safePlay, soundAudible } from "@/game/audio/play-guards";
import {
  applyPalettePreference,
  isHighContrastEnabled,
  setHighContrastEnabled,
} from "@/game/palette-preference";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RunStartNotice } from "@/components/run-start-notice";
import { QuestionBubble, type BubbleViewState } from "./question-bubble";
import { HintPanel } from "./hint-panel";
import { directionalHint } from "./hint-logic";
import { canUseHint } from "@/game/age-profile/run-config.ts";
import { ResultCard } from "./result-card";
import { RunSummaryCard } from "./run-summary";
import { ShareButton } from "./share-button";
import { ClearedCelebrationDialog, type ClearedInfo } from "./cleared-celebration";
import { CometEmblem } from "./comet-emblem";
import { GrandpaCoffeeRun } from "./grandpa-coffee-run";
import {
  confidenceText,
  createJournalRotation,
  journalImageUrl,
  journalSetAt,
  journalSetByIndex,
  journalSetCount,
  journalSetIndexAt,
  nextEntryCountdown,
} from "./home-journal";
// Storyteller banner host (owner directive 2026-10-09): the Storyteller
// sits IN THE BANNER beside the Meridian branding — always visible, mobile
// and desktop. React.lazy — the host (and its copy chunk) never lands in
// the initial bundle. The shell (skeleton + error boundary) is a light
// module bundled with the main chunk; the boundary fails closed to a static
// figure so the banner never breaks home. Comet is retired as a host: a
// silent ~30px emblem stays in the eyebrow row (aria-hidden, decorative,
// never speaks).
import {
  StorytellerBannerBoundary,
  StorytellerBannerSkeleton,
} from "./storyteller-banner-shell";
// Age-profile system: the parent-set band (5-7 / 8-10 / 11-13). Game
// screens use ONLY this facade — the store is never imported directly.
// The settings screen is React.lazy: zero initial-bundle cost.
import "./age-profile/age-profile.css";
import { LockedLoop } from "./age-profile/LockedLoop";
import { ReadAloudPrefPrompt } from "./age-profile/ReadAloudPrefPrompt";
import { ReadAloudPrefSettings } from "./age-profile/ReadAloudPrefSettings";
import { EarnedBadgeRow } from "./passport/EarnedBadgeRow";
import { LazyHomeImage } from "./lazy-home-image";
import {
  applyPendingAtBoundary,
  audioMode,
  isLoopLocked,
  loadProfile,
  onAgeProfileChanged,
  pinToleranceKm,
  resolveBand,
  type AgeBandId,
} from "@/game/age-profile";
const AgeProfileSettings = lazy(() => import("./age-profile/AgeProfileSettings"));
const StorytellerHomeHost = lazy(() => import("./storyteller-home"));
// v5 hero globe: React.lazy like the storyteller host — the Three.js chunk
// never lands in the initial bundle; HomeGlobe itself dynamically imports
// three only when the hero nears the viewport.
// A failed globe-chunk fetch must never take the home page down with it:
// the lazy factory catches to a static-disc component (the same fallback
// HomeGlobe renders for reduced-motion / no-WebGL).
function GlobeChunkFallback() {
  return (
    <img
      className="hv5-globe-fallback"
      src={globeFallbackUrl}
      alt=""
      aria-hidden="true"
      width={800}
      height={800}
    />
  );
}
const HomeGlobe = lazy(() =>
  withChunkTimeout(import("./home-globe"), "the home globe")
    .then((m) => ({ default: m.HomeGlobe }))
    .catch(() => ({ default: GlobeChunkFallback })),
);
import {
  CelebrationOverlay,
  celebrationSeamSpec,
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
  type CelebrationSpec,
} from "./celebration-overlay";
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
import { consumeChunkReloadNotice, installChunkLoadRecovery } from "@/lib/chunk-recovery";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import { resolveGlobeTierSplit } from "@/lib/globe-tier-split";
import {
  emitEvent,
  initObservability,
  installGlobalErrorHandlers,
  noteRecoverySignal,
  recordMilestone,
  sanitizeError,
  setObservabilityEndpoint,
  setReportMapMode,
  wasMapAttributedCrash,
} from "@/lib/observability";
import type { MapMode, MapModeSource } from "@/map/capability";
import {
  planBootMapMode,
  probeWebGL,
  qualifyMapMode,
  readDeviceMemoryGB,
  readStoredMapMode,
  writeStoredMapMode,
} from "@/map/capability";
import type { ScoutRestoreView } from "@/map/satellite-map";
import { SCOUT_COPY } from "./scout-copy.ts";
import { TILE_FALLBACK_COPY } from "@/map/tile-fallback-copy.ts";
import { MapModeToggle } from "./map-mode-toggle.tsx";
import {
  TUTORIAL_EDITION,
  TUTORIAL_PLACE_ID,
  TUTORIAL_REGION_ID,
  TUTORIAL_REGION_NAME,
  hasSeenTutorial,
  isTutorialRunPool,
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
import { readLoopOpen, writeLoopOpen, peekLoopProgress } from "@/game/loop/store";
import { readColdTrailOpen, writeColdTrailOpen } from "@/game/coldtrail/store";
// F2 bundle split: GeoDetective (Loop) and Cold Trail are play-intent
// screens — they render only when the player opens them (or when a saved
// loopOpen flag restores GeoDetective on boot). Both screens statically
// import LoopMap, which value-imports maplibre-gl (~1.1 MB) and its
// stylesheet, so a static import here pulled the whole map library into
// the preloaded route chunk. They are React.lazy instead — the
// SatelliteMap pattern below — so MapLibre loads on demand, behind
// Suspense + MapErrorBoundary at the render sites. The screens have no
// default export, so the lazy factories adapt their named exports (the
// HomeGlobe idiom above).
const loadLoopScreen = () => import("@/game/loop/LoopScreen");
const loadTrailScreen = () => import("@/game/coldtrail/TrailScreen");
// #209: each lazy load is raced against CHUNK_LOAD_TIMEOUT_MS (inside
// withChunkTimeout) — a HUNG import never settles, so without the race
// the Suspense fallback below would spin forever; with it, the race
// rejection lands in MapErrorBoundary's recoverable card instead.
const LoopScreen = lazy(() =>
  withChunkTimeout(loadLoopScreen(), "GeoDetective screen").then((m) => ({
    default: m.LoopScreen,
  })),
);
const TrailScreen = lazy(() =>
  withChunkTimeout(loadTrailScreen(), "Cold Trail screen").then((m) => ({
    default: m.TrailScreen,
  })),
);
/**
 * F2b intent prefetch for the edition + case cards: hovering, focusing,
 * or pressing a card starts the countries-50m load (scorePlace's region
 * bonus + the reveal pin-compare read it). Fire-and-forget —
 * preloadTerritory never rejects, and openRun awaits it before any run
 * commits, so a cold prefetch never changes the outcome, only the wait.
 *
 * Deliberately NO component-chunk prefetch for Loop/Trail (Core F-4):
 * the old helpers fired the screens' dynamic import() on this same
 * intent signal, but a FAILED import() is negatively cached by the
 * browser for the life of the document (see map-error-boundary.tsx) —
 * a transient hover-time failure therefore guaranteed the click itself
 * failed into the error card. The territory DATA prefetch is safe to
 * keep by contrast: its loader evicts a failed load and retries on the
 * next call, and a miss degrades fail-closed at the readers instead of
 * surfacing an error card.
 *
 * #211 item 1: FOCUS is the weakest of the three intent signals — a
 * keyboard or screen-reader user tabs PAST these cards on the way to
 * somewhere else, and focus alone starts a ~206 KB (brotli) download.
 * On a Save-Data connection that spend is exactly what the player
 * asked the browser to avoid, so the focus-triggered prefetch is
 * gated on the Save-Data signal (the home-globe precedent in
 * home-globe.tsx reads the same `navigator.connection.saveData`).
 * Pointer intent (hover / press) is deliberate and stays ungated;
 * and nothing about play changes — a tap still awaits the load in
 * openRun before the run commits.
 */
function prefetchTerritoryData(): void {
  void preloadTerritory();
}

/** True when the browser reports the player's Save-Data preference. */
function saveDataEnabled(): boolean {
  try {
    return Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    );
  } catch {
    return false;
  }
}

/** The focus-triggered variant: skipped entirely under Save-Data. */
function prefetchTerritoryDataOnFocus(): void {
  if (saveDataEnabled()) return;
  prefetchTerritoryData();
}
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

/**
 * Watched by the inline crash watchdog injected into _shell.html
 * (scripts/crash-watchdog.mjs): set to true once the React root has
 * mounted and painted. The watchdog treats its absence after ~28s as a
 * boot failure. Same local `declare global` pattern as sports-ai.ts.
 */
declare global {
  interface Window {
    __meridian_ready?: boolean;
  }
}

/**
 * A review-deck session is a Run with this regionId (typed edition "globe")
 * so the PlayLoaded game loop is reused instead of forked. Every
 * review-specific branch keys off this predicate. Review runs never consult
 * the no-repeat history of real regions and never bank into the session —
 * review is practice, not scoring.
 */
import {
  buildCreationSources,
  CHALLENGE_BROKEN_LINK_COPY,
  CHALLENGE_CHILD_COPY,
  CHALLENGE_FAIRNESS_COPY,
  CHALLENGE_GLOBE_RADIUS_KM,
  CHALLENGE_LOAD_FAILURE_COPY,
  CHALLENGE_MAX_PLACES,
  CHALLENGE_MIN_PLACES,
  CHALLENGE_REGION_ID,
  CHALLENGE_REGION_NAME,
  CHALLENGE_SHARE_LABEL,
  CHALLENGE_EXACT_SHARE_LABEL,
  CHALLENGE_RESHARE_LABEL,
  CHALLENGE_UNKNOWN_CONTENT_COPY,
  CHALLENGE_UNKNOWN_REGION_COPY,
  CHALLENGE_WELCOME_TITLE,
  challengeFreshRouteLabel,
  challengeMidRunLabel,
  challengeRadiusOf,
  challengeRevealLabel,
  challengeRunFields,
  createChallengeRoute,
  dealChallenge,
  decodeChallenge,
  decodeChallengeLink,
  encodeChallenge,
  playOrder,
  resolveChallengeRoute,
  type ChallengeCreation,
  type ChallengeRoute,
} from "@/game/challenge";

function isReviewRun(run: Run): boolean {
  return run.regionId === REVIEW_DECK_REGION_ID;
}

/**
 * A friend-challenge run is identified by its region id alone — the run
 * carries no other marker. Every isolation guard in this file keys off
 * this one check, so there is exactly one place to get it right:
 * challenge runs never bank into the session, never write learning
 * records or review-deck cards, and never touch the persistent
 * no-repeat history (see the dealer, the flag effect, and onConfirm).
 * Why isolate them? The places were chosen by a FRIEND, not dealt to
 * this player — letting them into the player's own history, deck, or
 * score would teach the game the wrong lessons about what this player
 * has seen and how well they are doing.
 */
export function isChallengeRun(run: Run): boolean {
  return run.regionId === CHALLENGE_REGION_ID;
}

/**
 * Speaker toggle (SFX audio spec §4): persisted under `meridian.sound`,
 * default ON, and the single control for ALL sounds (the 7 shipped + the
 * 9 celebration recipes — every play call goes through the
 * `isSoundEnabled()` gate). Turning ON plays the card tap as confirmation;
 * OFF is silent. This toggle is the "reduced sound" control — reduced
 * motion never mutes audio (spec §4.6).
 *
 * One instance lives in the Chart Room home header; a second lives in the
 * game chrome so sound is reachable mid-game (Veeresh's explicit ask).
 * The two never co-mount — each reads the persisted value on mount, so a
 * toggle flipped on one screen is correct on the next.
 */
function SoundToggle({
  testId,
  className,
  style,
  iconClassName = "size-5",
}: {
  testId: string;
  className?: string;
  style?: CSSProperties;
  iconClassName?: string;
}) {
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const toggleSound = () => {
    try {
      const next = !soundOn;
      setSoundEnabled(next);
      setSoundOn(next);
      if (next) playCardTap();
    } catch {
      // Sound is enhancement-only; the toggle itself never throws.
    }
  };
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={soundOn}
      aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
      title={soundOn ? "Sound on" : "Sound off"}
      onClick={toggleSound}
      className={className}
      style={style}
    >
      {soundOn ? (
        <Volume2 className={iconClassName} aria-hidden="true" />
      ) : (
        <VolumeX className={iconClassName} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * High-contrast view toggle (manifest 2026-10-27): the SoundToggle
 * pattern for the map palette — persisted under `meridian.palette`
 * (PALETTE_STORAGE_KEY), default OFF (standard), one instance in the
 * home hero and one in the game chrome, each reading the persisted
 * value on mount. Flipping it repaints the map IN PLACE via the
 * palette-preference module (data-palette attribute + the
 * meridian:palette-change event): unlike the Scout Map switch it
 * never ends a game and never navigates, because the palette is a
 * paint choice, not a map-build input. A corrupt stored value fails
 * closed to standard inside selectPalette — the toggle just shows
 * OFF.
 */
function HighContrastToggle({
  testId,
  className,
  style,
  iconClassName = "size-5",
}: {
  testId: string;
  className?: string;
  style?: CSSProperties;
  iconClassName?: string;
}) {
  const [highContrast, setHighContrast] = useState<boolean>(() => isHighContrastEnabled());
  const toggleHighContrast = () => {
    try {
      const next = !highContrast;
      setHighContrastEnabled(next);
      setHighContrast(next);
    } catch {
      // The palette is enhancement-only; the toggle itself never throws.
    }
  };
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={highContrast}
      aria-label={highContrast ? "Turn high contrast off" : "Turn high contrast on"}
      title={highContrast ? "High contrast on" : "High contrast off"}
      onClick={toggleHighContrast}
      // atlas-contrast-toggle: the dedicated class both hosts share, so
      // styles.css can give [aria-pressed="true"] a VISIBLE pressed state
      // (brass fill + filled icon, the .atlas-seg pattern) — aria-pressed
      // alone is invisible to the sighted low-vision users this serves
      // (panel BLOCK 3; manifest Scenarios 1–2: "I can see it pressed").
      className={className ? `atlas-contrast-toggle ${className}` : "atlas-contrast-toggle"}
      style={style}
    >
      <Contrast className={iconClassName} aria-hidden="true" />
    </button>
  );
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
 * Session flag marking that this tab already reloaded for a stale build.
 * Prevents a refresh loop when a chunk is genuinely missing rather than
 * merely outdated.
 */
const STALE_REFRESH_KEY = "meridian.staleRefresh";

const RUN_KEY = "meridian.run";

/**
 * Saved mc2 challenge runs live under their OWN key (manifest C8): a
 * build from before mc2 existed never reads this key, so an mc2 save
 * can never be reinterpreted as a globe run by an old build — it is
 * simply invisible to it, and the old build boots whatever normal run
 * it finds under RUN_KEY. mc1 challenge saves keep using RUN_KEY,
 * exactly as the shipped build wrote them.
 */
const RUN_MC2_KEY = "meridian.run.mc2";

/**
 * Persisted pin-drop for the in-progress place. `drop`/`revealDone` are
 * React state only, so a page reload during the result card used to strand
 * the run (phase "done"/"story" restored, but no card and no Next place).
 * The drop is written on pin commit and cleared on continue/replay/end/leave;
 * on reload the mount restore rehydrates it when it matches the dealt
 * place, else fails safe by advancing (the result is already scored).
 */
const RUN_DROP_KEY = "meridian.drop";

/**
 * The satellite map (maplibre-gl + the atlas payloads) is the heaviest
 * module in the app and is only needed once a run starts. Loading it lazily
 * keeps it out of the boot bundle, so the menu paints on a fraction of the
 * JS (P0 Safari launch fix: the 2.57 MB synchronously-evaluated boot bundle
 * is the prime iOS-jetsam suspect). The Play path wraps it in Suspense (the
 * existing loading-spinner styling) and MapErrorBoundary (chunk-load
 * failure → retry UI, never a blank page). The boundary's "Try again"
 * reloads the page: re-rendering a React.lazy after a chunk failure
 * rethrows its cached rejection, and even a fresh import() of the same
 * failed URL is negatively cached by the browser for the life of the
 * document — only a reload genuinely re-fetches the chunk. The run is
 * restored from sessionStorage on boot, so the game survives the reload.
 */
const SatelliteMap = lazy(() =>
  withChunkTimeout(import("@/map/satellite-map"), "Satellite map"),
);

/**
 * Suspense fallback while the lazy satellite-map chunk downloads. Mirrors
 * the in-map tile-loading pill's spinner styling (`.meridian-spinner`).
 */
function MapLoadingFallback() {
  return (
    <div
      role="status"
      data-testid="map-loading"
      className="absolute inset-0 flex items-center justify-center bg-bg"
    >
      <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-2.5 pr-5 pl-3.5 text-sm font-medium text-fg">
        <span
          aria-hidden="true"
          className="meridian-spinner block h-4 w-4 rounded-full border-2 border-muted/40 border-t-fg"
        />
        Loading map&hellip;
      </div>
    </div>
  );
}

/**
 * Suspense fallback while a play-intent screen chunk (GeoDetective /
 * Cold Trail) downloads — PR #203 panel (Design BLOCK): the boot splash
 * it replaces is bottom-anchored brand markup with no status role, so
 * in-session it was silent to screen readers and visually unrelated to
 * the top-anchored screens it precedes. This clone of MapLoadingFallback's
 * pill sits at the top of the same shell the destination screens render
 * (reserved header space, no layout jump on arrival), NAMES the
 * destination, and announces via role="status". BootSplash remains only
 * at the boot !ready gate. Focus is not stranded: the destination
 * screens focus their heading on mount.
 */
function SessionLoadingFallback({ label }: { label: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <div
        role="status"
        data-testid="session-loading"
        className="flex items-center gap-2.5 self-start rounded-full border border-line bg-surface py-2.5 pr-5 pl-3.5 text-sm font-medium text-fg"
      >
        <span
          aria-hidden="true"
          className="meridian-spinner block h-4 w-4 rounded-full border-2 border-muted/40 border-t-fg"
        />
        {label}
      </div>
    </main>
  );
}

export type Drop = {
  lon: number;
  lat: number;
  distanceKm: number;
  placeId: string;
  /** The v3 breakdown for the reveal; null on a miss. */
  breakdown: ScoredPlace | null;
  /** Consecutive hits before this place (for the miss "streak reset" note). */
  streakBefore: number;
};

type ModelAvailability = "available" | "downloadable" | "downloading" | "unavailable";

type NanoSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

type LanguageModelGlobal = {
  availability: () => Promise<string>;
  create: () => Promise<NanoSession>;
};

function trailDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function boundsFor(run: Run): RegionBounds {
  if (run.regionId === CHALLENGE_REGION_ID) {
    // A challenge run's sentinel regionId names no real place; its
    // bounds are the REAL region's (the route's own region), so the
    // map frames and the territory resolves for the place the route is
    // actually about. Legacy mc1 saves carry no region: the globe.
    const regionId = run.challengeRegionId ?? "globe";
    if (run.edition === "state") {
      const regions = Object.values(ADMIN1_BY_COUNTRY).flat();
      return regions.find((region) => region.id === regionId)?.bounds ?? [0, 0, 0, 0];
    }
    if (run.edition === "country") {
      return COUNTRIES.find((region) => region.id === regionId)?.bounds ?? [0, 0, 0, 0];
    }
    return [0, 0, 0, 0];
  }
  if (run.edition === "state") {
    // States can drill from any country that maps subdivisions; look across all of them.
    const regions = Object.values(ADMIN1_BY_COUNTRY).flat();
    return regions.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
  }
  return COUNTRIES.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
}

function isEdition(value: unknown): value is Edition {
  return value === "state" || value === "country" || value === "globe";
}

function isPhase(value: unknown): value is RunPhase {
  return value === "aim" || value === "story" || value === "done" || value === "summary";
}

function isPlaceResult(value: unknown): value is PlaceResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.distanceKm === "number" &&
    typeof r.hit === "boolean" &&
    typeof r.score === "number"
  );
}

const DIFFICULTY_KEY = "meridian.difficulty";

/**
 * The picker's difficulty choice, persisted across page loads. Invalid or
 * missing values fall back to "medium" — the choice applies across
 * Globe → Country → State and survives edition switches.
 */
function readDifficultyChoice(): PickerDifficulty {
  try {
    if (typeof localStorage === "undefined") return "medium";
    const raw = localStorage.getItem(DIFFICULTY_KEY);
    return isPickerDifficulty(raw) ? raw : "medium";
  } catch {
    return "medium";
  }
}

function writeDifficultyChoice(choice: PickerDifficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, choice);
  } catch {
    // Storage blocked: the in-memory choice still applies this session.
  }
}

function readRunFrom(key: string): Run | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      !isEdition(record.edition) ||
      typeof record.regionId !== "string" ||
      typeof record.regionName !== "string" ||
      typeof record.dateKey !== "string" ||
      typeof record.index !== "number" ||
      typeof record.hits !== "number" ||
      !isPhase(record.phase)
    ) {
      return null;
    }
    // Range-check the restored numbers: a tampered sessionStorage index
    // (e.g. 1e15) would otherwise send the dealer spinning through billions
    // of cycles; a non-finite seed is meaningless. The cap is 20k (not 1M):
    // the dealer's resume re-derive is O(N^2/pool), measured ~52ms at 20k
    // but ~130s at 1M. Fail closed to null.
    if (
      !Number.isInteger(record.index) ||
      record.index < 0 ||
      record.index > 20_000 ||
      !Number.isInteger(record.hits) ||
      record.hits < 0 ||
      record.hits > 20_000
    ) {
      return null;
    }
    return {
      edition: record.edition,
      regionId: record.regionId,
      regionName: record.regionName,
      dateKey: record.dateKey,
      // Runs saved before the difficulty picker backfill to the default
      // band; resumeRun keeps a valid choice.
      difficultyChoice: backfillDifficultyChoice(record.difficultyChoice),
      index: record.index,
      hits: record.hits,
      phase: record.phase,
      // Runs saved before the streak engine backfill to 0; the version
      // gate in isResumable retires their unscored results anyway.
      streak:
        Number.isInteger(record.streak) && (record.streak as number) >= 0
          ? (record.streak as number)
          : 0,
      bestStreak:
        Number.isInteger(record.bestStreak) && (record.bestStreak as number) >= 0
          ? (record.bestStreak as number)
          : 0,
      results: Array.isArray(record.results)
        ? record.results.filter(isPlaceResult)
        : [],
      // Runs saved before per-session shuffle get a fresh seed; resumeRun
      // keeps a valid one.
      seed: typeof record.seed === "number" ? record.seed : mintSeed(),
      // Runs saved before pool persistence get [] here; resumeRun backfills
      // from the freshly computed pool.
      poolIds: Array.isArray(record.poolIds)
        ? record.poolIds.filter((id): id is string => typeof id === "string")
        : [],
      // Runs saved before the persistent no-repeat history get no boundary
      // id (null disables the swap), preserving their exact deal order.
      prevLastId: typeof record.prevLastId === "string" ? record.prevLastId : null,
      // Challenge fields (mc2): parsed back only when well-formed, so a
      // tampered save degrades to the mc1 defaults instead of inventing
      // a region or a radius. Absent on normal runs and legacy saves.
      ...(typeof record.challengeRegionId === "string"
        ? { challengeRegionId: record.challengeRegionId }
        : {}),
      ...(Number.isInteger(record.challengeRadiusKm) &&
      // The decode-side envelopes, re-checked at the save boundary: a
      // tampered slot must not widen the circle past what a link could
      // legally pin (Globe exactly 750; state [25,160]; country
      // [40,450]). Out-of-envelope degrades to the accessor default.
      (record.edition === "globe"
        ? record.challengeRadiusKm === CHALLENGE_GLOBE_RADIUS_KM
        : record.edition === "state"
          ? (record.challengeRadiusKm as number) >= 25 && (record.challengeRadiusKm as number) <= 160
          : (record.challengeRadiusKm as number) >= 40 && (record.challengeRadiusKm as number) <= 450)
        ? { challengeRadiusKm: record.challengeRadiusKm as number }
        : {}),
      ...(record.challengeOrigin === "mc1" || record.challengeOrigin === "mc2"
        ? { challengeOrigin: record.challengeOrigin }
        : {}),
    };
  } catch {
    return null;
  }
}

function readRun(): Run | null {
  return readRunFrom(RUN_KEY);
}

/** The saved mc2 challenge run, if one is in progress (see RUN_MC2_KEY). */
function readMc2Run(): Run | null {
  return readRunFrom(RUN_MC2_KEY);
}

function clearMc2Run() {
  try {
    sessionStorage.removeItem(RUN_MC2_KEY);
  } catch {
    // Storage blocked; the in-memory state is dropped regardless.
  }
}

function writeRun(run: Run) {
  try {
    // mc2 challenge runs persist to their own key (RUN_MC2_KEY) so old
    // builds never see them; everything else keeps the shipped key.
    const key = run.challengeOrigin === "mc2" ? RUN_MC2_KEY : RUN_KEY;
    sessionStorage.setItem(key, JSON.stringify(run));
    // Crash-loop breaker: this page now holds unsaved-crash state. If the
    // process is killed without unloading, the next boot must not
    // auto-resume; `pagehide` clears this flag on every clean unload.
    stampCleanExitDirty();
  } catch {
    // The run still lives in memory when storage is blocked.
  }
}

/** Loose ScoredPlace shape check: enough to render the reveal card. */
function isScoredPlace(value: unknown): value is ScoredPlace {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.base === "number" &&
    typeof b.diffMult === "number" &&
    typeof b.combo === "number" &&
    typeof b.streak === "number" &&
    typeof b.score === "number"
  );
}

function isDrop(value: unknown): value is Drop {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.lon === "number" &&
    Number.isFinite(d.lon) &&
    typeof d.lat === "number" &&
    Number.isFinite(d.lat) &&
    typeof d.distanceKm === "number" &&
    Number.isFinite(d.distanceKm) &&
    d.distanceKm >= 0 &&
    typeof d.placeId === "string" &&
    d.placeId.length > 0 &&
    typeof d.streakBefore === "number" &&
    Number.isInteger(d.streakBefore) &&
    d.streakBefore >= 0 &&
    (d.breakdown === null || isScoredPlace(d.breakdown))
  );
}

/** Fail closed to null on anything malformed or tampered. */
function readDrop(): Drop | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(RUN_DROP_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDrop(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDrop(drop: Drop) {
  try {
    sessionStorage.setItem(RUN_DROP_KEY, JSON.stringify(drop));
  } catch {
    // The drop still lives in memory when storage is blocked.
  }
}

function clearDrop() {
  try {
    sessionStorage.removeItem(RUN_DROP_KEY);
  } catch {
    // Absent or blocked storage: nothing to clear.
  }
}

/**
 * The run's dealing pool: the band-filtered catalog minus the device's
 * persistent no-repeat history (the cross-session no-repeat rule, tracked
 * per edition/region/difficulty band). Computed once when a run starts and
 * persisted on the run, so a reload rebuilds the identical pool. A place
 * never repeats until every other place in the band's pool has been dealt —
 * across days, reloads, and restarts. Side effect: when the band's full
 * cycle is exhausted, poolForNewRun clears that band's persistent history
 * so the new run starts a fresh shuffled cycle (other bands untouched).
 *
 * The band scope is the fix for "repeat mode": the pool is band-filtered
 * but the old history was shared across bands, so one band's dealt places
 * shrank another band's pool into rapid cycling. Each band now keeps its
 * own history; the pre-band history migrates lazily into the first band
 * touched (see seenStoreFor).
 *
 * Also threads through `cycleCompleted`: true when the band's persistent
 * history covered the whole band catalog and was just reset — the
 * cleared-mode celebration's backstop signal (see openRun).
 */
function poolForRunStart(
  allPlaces: { id: string }[],
  edition: Edition,
  regionId: string,
  choice: PickerDifficulty,
): { poolIds: string[]; prevLastId: string | null; cycleCompleted: boolean } {
  return poolForNewRun(allPlaces, seenStoreFor(edition, regionId, choice));
}

function isLanguageModel(value: unknown): value is LanguageModelGlobal {
  if (!value || typeof value !== "object") return false;
  const model = value as { availability?: unknown; create?: unknown };
  return typeof model.availability === "function" && typeof model.create === "function";
}

function readLanguageModel(): LanguageModelGlobal | null {
  const host = globalThis as { LanguageModel?: unknown };
  return isLanguageModel(host.LanguageModel) ? host.LanguageModel : null;
}

function asAvailability(status: string): ModelAvailability {
  if (
    status === "available" ||
    status === "downloadable" ||
    status === "downloading" ||
    status === "unavailable"
  ) {
    return status;
  }
  return "unavailable";
}

async function modelAvailability(): Promise<ModelAvailability> {
  const model = readLanguageModel();
  if (!model) return "unavailable";
  try {
    return asAvailability(await model.availability());
  } catch {
    return "unavailable";
  }
}

function storyKey(placeId: string): string {
  return `meridian.story.${placeId}`;
}

function readCachedStory(placeId: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const cached = localStorage.getItem(storyKey(placeId));
    if (cached === null || cached.trim() === "") return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedStory(placeId: string, text: string) {
  try {
    localStorage.setItem(storyKey(placeId), text);
  } catch {
    // A private window can refuse the cache. The story still shows once.
  }
}

async function askRewrite(authored: string): Promise<string> {
  const model = readLanguageModel();
  if (!model) throw new Error("LanguageModel is missing");
  const status = asAvailability(await model.availability());
  if (status !== "available") throw new Error("LanguageModel is not available");
  const session = await model.create();
  try {
    const reply = await session.prompt(
      `Rewrite the story in two sentences. Do not add facts.\n\n${authored}`,
    );
    if (typeof reply !== "string") throw new Error("unexpected rewrite");
    return reply;
  } finally {
    session.destroy?.();
  }
}

async function revealStory(placeId: string, authored: string): Promise<string> {
  const result = await rewriteStory({
    placeId,
    authored,
    cached: readCachedStory(placeId),
    availability: await modelAvailability(),
    ask: askRewrite,
  });
  if (result.store !== null) writeCachedStory(placeId, result.store);
  return result.text;
}

/**
 * Where the player is in the edition picker. The picker drills down
 * Globe -> Country -> State: `countries` lists the playable countries, and
 * `admin1` lists one country's states/provinces (each level is playable).
 * The run's `Edition` type is unchanged — only the menu needs the extra
 * level.
 */
type Menu =
  | { kind: "countries" }
  | { kind: "states" }
  | { kind: "challengeRegions" }
  | { kind: "admin1"; countryId: string; countryName: string; from: "countries" | "states" };

/**
 * Session state: the score accumulator that survives edition switches.
 * All mutations go through `update`/`replace`, which persist to
 * sessionStorage and keep `ref` (the read-current-value handle for event
 * handlers and the idle timer) in sync with the rendered state.
 */
function useSessionState() {
  const [session, setSession] = useState<Session | null>(null);
  const ref = useRef<Session | null>(null);
  const persist = useCallback((next: Session | null) => {
    ref.current = next;
    if (next) writeSession(next);
    else clearSession();
    setSession(next);
  }, []);
  const update = useCallback(
    (fn: (prev: Session | null) => Session | null) => {
      persist(fn(ref.current));
    },
    [persist],
  );
  const get = useCallback(() => ref.current, []);
  return { session, update, replace: persist, get };
}

/**
 * The globeTierSplit decision for a run's pool load. Only the Globe consults
 * the flag (and thereby waits for flags.json, at most ~1.5s, only on the first
 * Globe run of a page load); every other region gets false at once. Both
 * placesFor call sites use this one helper, and the resolver caches the first
 * answer, so a run's two loads can never disagree.
 */
function globeTierSplitFor(edition: Edition, regionId: string): Promise<boolean> {
  return edition === "globe" && regionId === "globe"
    ? resolveGlobeTierSplit()
    : Promise.resolve(false);
}

/**
 * Review-deck entry status for the edition picker. Gated on the
 * `learningOutcomes` flag like the other growth surfaces: flag off = no
 * deck entry at all (the deck only populates while the flag is on). Re-read
 * whenever the app returns to the picker (`run` → null): a review session
 * reschedules cards and a normal game adds misses, so a boot-time snapshot
 * would go stale — and a stale "N cards due" with an empty queue would make
 * "Start review" silently no-op.
 */
function useDeckStatus(
  run: Run | null,
  historyResetEpoch: number,
): { enabled: boolean; due: number; total: number } {
  const [status, setStatus] = useState({ enabled: false, due: 0, total: 0 });
  const onPicker = run === null;
  useEffect(() => {
    let active = true;
    loadFlags().then(() => {
      if (!active) return;
      if (!isEnabled("learningOutcomes")) {
        setStatus({ enabled: false, due: 0, total: 0 });
        return;
      }
      const deck = readReviewDeck() ?? emptyReviewDeck();
      if (!active) return;
      const { total, due } = deckCounts(deck, Date.now());
      setStatus({ enabled: true, total, due });
    });
    return () => {
      active = false;
    };
    // historyResetEpoch (D14): a reset performed on the picker must
    // re-read the deck in place — the picker never unmounted, so the
    // onPicker edge alone would leave the stale due count on screen.
  }, [onPicker, historyResetEpoch]);
  return status;
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

export function GameApp() {
  // SFX autoplay gate (audio spec §7): the AudioContext is created on the
  // first user gesture ONLY. `{ once: true }` listeners — load-bearing, not
  // optional: creating the context before a gesture leaves it `suspended`
  // and every sound silently no-ops. StrictMode-safe: the cleanup removes
  // the listeners on the double-mount's unmount, the remount re-registers.
  useEffect(() => {
    const boot = () => initAudio();
    window.addEventListener("pointerdown", boot, { once: true });
    window.addEventListener("keydown", boot, { once: true });
    return () => {
      window.removeEventListener("pointerdown", boot);
      window.removeEventListener("keydown", boot);
    };
  }, []);
  // High-contrast view (manifest 2026-10-27, D7): apply the stored
  // palette once at boot so a persisted "high-contrast" reaches the
  // --map-* vars on every GameApp-hosted screen (home, the quiz
  // editions, and GeoDetective's LoopScreen) without waiting for a
  // toggle tap. Fail-closed inside the module: corrupt → standard.
  useEffect(() => {
    applyPalettePreference();
  }, []);
  const [ready, setReady] = useState(false);
  // Exactly-once guard for the crash-watchdog ready signal below.
  const readySignaledRef = useRef(false);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  /**
   * Scout Map: the game map mode is owned HERE and threaded down as a
   * prop — satellite-map unmounts on the webglcontextlost teardown, so
   * the mode state can never live inside it. Full mode is the default;
   * every assignment persists through writeStoredMapMode (write policy
   * Q3: only on a new qualifying event or an explicit state change —
   * never rewritten per boot).
   */
  const [mapMode, setMapMode] = useState<MapMode>("full");
  /**
   * True once the boot map-mode qualification has run. The storyteller
   * greeting waits for this so narration never starts before the boot
   * mode is settled.
   */
  const [bootQualified, setBootQualified] = useState(false);
  /**
   * The manual-switch announcement ("Scout Map on — back home; your
   * next game uses Scout Map"). It lives HERE, not in the toggle:
   * flipping the switch unmounts Play — and the toggle with it — in
   * the same commit that lands the player home, so a live region
   * inside the toggle is destroyed before any screen reader can speak
   * its text (pipeline Block A). GameApp renders the region in every
   * screen branch (mapModeAnnouncer below), so the node survives the
   * Play → home switch and the text change is actually announced
   * (WCAG 4.1.3).
   */
  const [mapModeAnnouncement, setMapModeAnnouncement] = useState("");
  /**
   * Focus landing for the manual switch's forced exit: the switch
   * that had focus is destroyed with Play, so on landing home focus
   * moves to the home h1 (WCAG 2.4.3). handleManualMapMode sets the
   * flag; the effect below fires once Choose has mounted and
   * attached the ref.
   */
  const homeHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const landHomeFocusRef = useRef(false);
  /**
   * The VISIBLE sibling of the announcement above (Block B cure): when
   * a manual switch lands the player home, a dismissible notice in
   * Home's notice slot (the idle note's pattern) records what happened
   * — mode switched, next game uses the new map, score kept. Holds the
   * mode that was switched TO; null = no notice. The announcement is
   * spoken once and gone; this stays until dismissed.
   */
  const [mapSwitchedNote, setMapSwitchedNote] = useState<MapMode | null>(null);
  /**
   * Block C cure: set once by the boot effect when a FRESH
   * qualification silently auto-switches this boot to Scout, so Home
   * can show the non-blocking "You're on Scout Map" note for that
   * boot. A stored-record boot does not set it (nothing new happened),
   * and a manual flip from the Home control clears it (the player has
   * taken over; the "picked for this device" note is stale).
   */
  const [autoScoutNote, setAutoScoutNote] = useState(false);
  /**
   * Friend-challenge boot notice (cure round for PR #274): set by the
   * boot effect when a `#c=` link was tapped with the friendChallenges
   * flag ON but the challenge could not be loaded (broken link, unknown
   * place, or the Globe catalog failed to load). Home then shows the
   * child-friendly CHALLENGE_CHILD_COPY in a role="status" region for
   * the rest of that boot — a tapped link must never fail silently for
   * a kid, and there is no auto-dismiss, so a slow screen reader (or a
   * grown-up helping) still sees it. Flag OFF never sets it: with the
   * feature off there is nothing to explain.
   */
  const [challengeBootNotice, setChallengeBootNotice] = useState<string | null>(null);

  /**
   * A validated mc2 challenge waiting on its welcome card (Package A):
   * the boot decoded and membership-checked the route, but NOTHING is
   * displaced yet — the player's saved run stays exactly where it was
   * until they tap Start on the card (manifest C6). hasSavedRun drives
   * the card's "your game is saved" line.
   */
  const [pendingChallenge, setPendingChallenge] = useState<{
    route: ChallengeRoute;
    hasSavedRun: boolean;
  } | null>(null);

  /** Home's friend-challenge entry points, flag-gated like every other
   * challenge surface (PlayLoaded reads the same flag for its own). */
  const [friendChallengesOn, setFriendChallengesOn] = useState(false);
  useEffect(() => {
    let active = true;
    void loadFlags().then(() => {
      if (active) setFriendChallengesOn(isEnabled("friendChallenges"));
    });
    return () => {
      active = false;
    };
  }, []);

  /** A minted challenge waiting on its preview sheet (picker flow). */
  const [challengePreview, setChallengePreview] = useState<{
    creation: ChallengeCreation;
    edition: Edition;
    regionId: string;
  } | null>(null);
  const [challengePickError, setChallengePickError] = useState<string | null>(null);

  /**
   * Apply a runtime auto-switch: persist (Q3) + stamp crash reports +
   * update state. The only caller is the webglcontextlost tripwire (the
   * map is already gone, so the new mode applies immediately with the
   * remount Play performs). Boot-time qualification and the manual
   * toggle have their own paths — neither queues: the boot switch
   * happens before any map exists, and a manual switch ends the game
   * (force-home, below), so there is never a pending mode waiting for
   * a later place.
   *
   * It also retires the visible switched notice (re-vote round 3,
   * BLOCK-B): that notice asserts a mode for "your next game", and
   * this switch falsifies it — the reconciliation lives in these
   * GameApp-owned paths so no switch can bypass it. The finer points
   * of the reconciliation (what does NOT retire or speak, and why)
   * are recorded on applySessionMapMode below.
   */
  const applyMapMode = useCallback((mode: MapMode, source: Extract<MapModeSource, "contextlost">) => {
    writeStoredMapMode(mode, source);
    setReportMapMode(mode);
    setMapMode(mode);
    setMapSwitchedNote(null);
  }, []);

  /**
   * Apply a runtime SESSION-ONLY switch (the tile-fallback path in
   * Play): update state without persisting — nothing is stored, and a
   * reload returns to the stored mode. GameApp owns this callback so
   * the notice lifecycle is reconciled in exactly one place: Play
   * receives THIS, never the raw setMapMode (re-vote round 3,
   * BLOCK-B — the raw setter let a mid-run tile failure flip the mode
   * to Scout while Home still showed the stale "You switched to the
   * full map" notice from an earlier manual flip, the two
   * contradicting each other under an indicator reading Scout).
   *
   * The reconciliation, and its deliberate limits:
   * - The switched notice RETIRES (here and in applyMapMode): its
   *   text names the mode the next game uses, and this switch just
   *   changed that mode.
   * - The boot auto-switch note does NOT retire here: it can only be
   *   standing when this boot itself auto-switched to Scout, and in
   *   that state both runtime paths early-return (they fire only
   *   from full) — so it is never standing when a runtime switch
   *   runs. Its text would also remain TRUE after a switch to Scout.
   *   (Manual flips clear it for a different reason: the player's own
   *   choice supersedes the "picked for this device" framing.)
   * - Nothing is ANNOUNCED: device-driven switches are silent (owner
   *   ruling, 2026-10-20), the announcer's texts are manual-switch
   *   wording ("back home; your next game…") that would be false
   *   mid-run, and Play already shows its own deferred switch note
   *   at the next natural break for exactly these events.
   */
  const applySessionMapMode = useCallback((mode: MapMode) => {
    setMapMode(mode);
    setMapSwitchedNote(null);
  }, []);
  // GeoDetective mounts its own screen outside the endless-run state
  // machine; it persists under meridian.loop.v2 and never touches the
  // run/drop keys. The open flag (meridian.loop.open) restores the screen
  // after a reload so a mid-game refresh resumes the mystery, not the menu.
  const [loopOpen, setLoopOpen] = useState<boolean>(() => readLoopOpen());
  // Cold Trail (vertical slice): its own screen outside the run machine,
  // persisted under meridian.coldtrail.v2. The open flag
  // (meridian.coldtrail.open) restores the screen after a reload — PR
  // #203 panel: without it, the error boundary's reload-retry ("Your
  // game is safe") returned a Trail player home while a GeoDetective
  // player resumed. In-progress cases resume from the store.
  const [coldTrailOpen, setColdTrailOpen] = useState<boolean>(() => readColdTrailOpen());
  // Age profile (parent-set band). The profile object lives in state and
  // refreshes via the `ageprofile:changed` event — game screens never
  // touch the store directly. The settings screen (lazy) is the only
  // writer of parent-control mutations.
  const [ageProfile, setAgeProfile] = useState(() => loadProfile());
  useEffect(() => onAgeProfileChanged(() => setAgeProfile(loadProfile())), []);
  const ageBand: AgeBandId = resolveBand(ageProfile);
  const [ageSettingsOpen, setAgeSettingsOpen] = useState(false);
  const [ageToast, setAgeToast] = useState<string | null>(null);
  // Post-reload notice (chunk-recovery): set once at boot when the
  // previous page's reload left a notice flag. Deliberately NO
  // auto-dismiss timer (unlike ageToast above): a timed status can be
  // deleted before a screen reader reaches it. Close button only.
  const [chunkReloadNotice, setChunkReloadNotice] = useState(false);
  useEffect(() => {
    if (ageToast === null) return;
    const id = window.setTimeout(() => setAgeToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [ageToast]);
  // "Start over" reset (manifest 2026-10-28): the success toast reuses
  // the age-toast styling/lifetime, and historyResetEpoch is the
  // refresh pin (D14) — bumping it remounts <Choose> (re-reading the
  // mount-only home surfaces) and re-runs useDeckStatus in place.
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [historyResetEpoch, setHistoryResetEpoch] = useState(0);
  useEffect(() => {
    if (resetToast === null) return;
    const id = window.setTimeout(() => setResetToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [resetToast]);
  // Invoking control for the age settings (footer "For grown-ups" link or
  // locked-tile grown-up link) — focus returns here when the settings close.
  const ageTriggerRef = useRef<HTMLElement | null>(null);
  const openAgeSettings = useCallback((e?: ReactMouseEvent<HTMLElement>) => {
    // Remember the invoking control ("For grown-ups" footer link or the
    // locked-tile grown-up link) so focus can return to it on close.
    if (e) ageTriggerRef.current = e.currentTarget;
    setAgeSettingsOpen(true);
  }, []);
  const closeAgeSettings = useCallback(() => {
    const trigger = ageTriggerRef.current;
    ageTriggerRef.current = null;
    setAgeSettingsOpen(false);
    if (trigger && document.contains(trigger)) {
      // The settings unmount on the next paint — return focus after that,
      // without scrolling the home page.
      requestAnimationFrame(() => {
        if (document.contains(trigger)) trigger.focus({ preventScroll: true });
      });
    }
  }, []);
  // Cleared-mode celebration: set when a difficulty band's full cycle is  // celebrated (primary onContinue trigger or the run-start backstop). The
  // dialog renders over the current screen; dismissing returns the player
  // to exactly where they were.
  const [cleared, setCleared] = useState<ClearedInfo | null>(null);
  // Celebration overlay (spec §7.2): the parent owns the spec; dismiss →
  // null → unmount. Set by first-win (endless game), streak milestones via
  // sound only, and GeoDetective's 387 completion (via onCelebrate).
  // E2E seam: ?celebration=<variant> renders the overlay on boot,
  // mirroring ?loop-puzzle=.
  const [celebration, setCelebration] = useState<CelebrationSpec | null>(() =>
    typeof window === "undefined" ? null : celebrationSeamSpec(window.location.search),
  );
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const celebrationOverlay = celebration ? (
    <CelebrationOverlay
      variant={celebration.variant}
      character={celebration.character}
      title={celebration.title}
      body={celebration.body}
      onDismiss={dismissCelebration}
      // PBI-3: Scout Map disables motion — no confetti, same calm card.
      motionOff={mapMode === "scout"}
    />
  ) : null;
  // Celebration audio (spec §3): the cleared-mode dialog's opening beat.
  // Easy/Medium get the medium applause; Hard gets the grand fanfare
  // (coronation — the 60 s grand cooldown drops it to applause instead of
  // stacking). First clear only: the cleared mark is set before the dialog
  // opens, so the ref guard fires once per open — an Escape dismissal
  // still sounds, because the trigger is the open, never the close.
  const clearedSoundRef = useRef<ClearedInfo | null>(null);
  useEffect(() => {
    if (!cleared) {
      clearedSoundRef.current = null;
      return;
    }
    if (clearedSoundRef.current === cleared) return;
    clearedSoundRef.current = cleared;
    playCelebrationSound(cleared.choice === "hard" ? "grandFanfare" : "mediumApplause");
  }, [cleared]);
  // Difficulty picker: one choice applies across Globe → Country → State and
  // survives edition switches. Persisted so it survives reloads too.
  const [difficultyChoice, setDifficultyChoiceState] = useState<PickerDifficulty>(readDifficultyChoice);
  const setDifficultyChoice = useCallback((choice: PickerDifficulty) => {
    setDifficultyChoiceState(choice);
    writeDifficultyChoice(choice);
  }, []);
  /** Edition card press: the cartographer's tap, then open (SFX audio spec §2.6). */
  const withCardTap = useCallback(
    (edition: string, open: () => void) => (e: ReactMouseEvent) => {
      playCardTap();
      open();
    },
    [],
  );
  // Region-selection async boundary: the GeoNames chunk(s) for the chosen
  // region load here — whole-country runs fetch every subdivision chunk —
  // before any run exists. `starting` shows the loading
  // state; `startError` is fail-closed — the run is never started when the
  // chunk cannot be loaded, and the player stays on the menu. When the tab
  // is stale (a deploy replaced its hashed chunks), the notice becomes a
  // one-tap refresh prompt instead of a dead end.
  // `edition`/`regionId`/`regionName`/`choice` describe what the player asked
  // for, so the in-run notice (runStartNotice below) can name it.
  const [starting, setStarting] = useState<{
    edition: Edition;
    regionId: string;
    regionName: string;
    choice: PickerDifficulty;
  } | null>(null);
  const [startError, setStartError] = useState<{
    message: string;
    staleBuild: boolean;
    edition: Edition;
    regionId: string;
    regionName: string;
    choice: PickerDifficulty;
  } | null>(null);
  // Run-start generation (re-vote round 3, BLOCK-A): openRun is async —
  // the chunk load it awaits can outlive the start it belongs to. A
  // manual map-mode switch mid-load ends the game and lands the player
  // home, but the parked load used to resolve afterwards and commit
  // its run anyway: the discarded run resurrected, its record was
  // re-persisted (undoing the exit's deliberate removal), and Home
  // unmounted under the player's focus. This counter stamps each
  // start; the manual switch (and each new start) bumps it, and
  // openRun checks it after every await — a stale start bails
  // silently, in the commit path AND the startError catch (a stale
  // failure must not park an error on the Home the player chose
  // instead), and its finally must not clear a NEWER start's
  // loading state.
  const runStartGenRef = useRef(0);
  // Session score: survives edition switches until End game or the idle
  // timeout. The HUD and the summary read from here, never from the run.
  const { session, update: updateSession, replace: replaceSession, get: getSession } = useSessionState();
  // Idle UX: a non-blocking "still there?" warning, and a one-shot notice
  // on the home screen after the idle kill.
  const [idleWarn, setIdleWarn] = useState(false);
  const [idleEndedNote, setIdleEndedNote] = useState(false);
  // First-run tutorial: null when inactive, otherwise the current beat
  // (1 = aim coachmark, 2 = reveal feedback, 3 = completion hook). Owned
  // by GameApp so the menu invitation, the run, and the cleanup paths all
  // share one source of truth; Play/PlayLoaded only render from it.
  const [tutorial, setTutorial] = useState<TutorialBeat | null>(null);
  // The menu invitation is shown at most once per page load; the
  // localStorage seen-flag persists the decision across visits.
  const [inviteDismissed, setInviteDismissed] = useState(false);
  // E2E seam: ?idle-ms=<n> shortens the 2-minute timeout (see session.ts).
  const idleTimeoutMs = useMemo(
    () => (typeof window === "undefined" ? IDLE_TIMEOUT_MS : idleTimeoutFromSearch(window.location.search)),
    [],
  );
  const idleWarnMs = useMemo(() => idleWarnMsFor(idleTimeoutMs), [idleTimeoutMs]);

  const commit = useCallback((next: Run) => {
    writeRun(next);
    setRun(next);
  }, []);

  /**
   * The welcome card's Start tap — the moment a received mc2 challenge
   * commits (manifest C6). The run is built from the validated route
   * and persisted through commit/writeRun, which routes it to the mc2
   * key; the player's saved normal run under RUN_KEY is never touched,
   * so it survives underneath and is offered back when the challenge
   * ends. The challenge never banks into the session (ensureSession is
   * deliberately not called — the same isolation as mc1).
   */
  const startPendingChallenge = useCallback(() => {
    if (!pendingChallenge) return;
    const fields = challengeRunFields(pendingChallenge.route);
    clearDrop();
    // Cross-format displacement (manifest §3 persistence): if the
    // normal slot holds a saved CHALLENGE (an mc1 run), starting this
    // mc2 challenge displaces it — one challenge at a time, and the
    // displacement commits here, on Start, never on arrival. A saved
    // NORMAL run is not a challenge and is never touched: it survives
    // underneath and is offered back on Done.
    const savedNormal = readRun();
    if (savedNormal && savedNormal.regionId === CHALLENGE_REGION_ID) {
      sessionStorage.removeItem(RUN_KEY);
    }
    const run: Run = {
      ...startRun(
        {
          edition: fields.edition,
          regionId: fields.regionId,
          regionName: fields.regionName,
          dateKey: trailDate(),
          difficultyChoice,
        },
        pendingChallenge.route.ids,
        null,
      ),
      challengeRegionId: fields.challengeRegionId,
      challengeRadiusKm: fields.challengeRadiusKm,
      challengeOrigin: fields.challengeOrigin,
    };
    commit(run);
    setPendingChallenge(null);
    setMenu(null);
  }, [pendingChallenge, difficultyChoice, commit]);

  /**
   * Adopt the stored session when it is still live (same day, not ended),
   * otherwise start a fresh one. A fresh session seeded from a run that
   * already has results backfills exactly once: those places were never
   * banked into any live session.
   */
  const ensureSession = useCallback(
    (nextRun: Run | null) => {
      const now = Date.now();
      const dateKey = trailDate();
      updateSession((prev) => {
        if (isSessionLive(prev, dateKey) && !isIdleExpired(prev, now, idleTimeoutMs)) {
          return touchSession(prev, now);
        }
        let fresh = startSession(dateKey, now);
        if (nextRun && nextRun.results.length > 0) {
          fresh = seedSessionFromRun(fresh, nextRun);
        }
        return fresh;
      });
    },
    [updateSession, idleTimeoutMs],
  );

  /**
   * An mc2 challenge's Done tap (manifest §2, contract 6): the
   * challenge slot is cleared, and the normal run the challenge
   * displaced is offered back — resumed in place when it is still
   * resumable today. Nothing here touches the player's history: the
   * challenge never wrote any.
   */
  const handleChallengeDone = useCallback(() => {
    setStartError(null);
    clearDrop();
    clearMc2Run();
    setRun(null);
    setMenu(null);
    const saved = readRun();
    if (
      saved &&
      saved.regionId !== CHALLENGE_REGION_ID &&
      saved.regionId !== REVIEW_DECK_REGION_ID
    ) {
      const today = {
        edition: saved.edition,
        regionId: saved.regionId,
        regionName: saved.regionName,
        dateKey: trailDate(),
        difficultyChoice: saved.difficultyChoice,
      };
      if (isResumable(saved, today)) {
        const restored = resumeRun(saved, today);
        commit(restored);
        ensureSession(restored);
      }
    }
  }, [commit, ensureSession]);

  const challengeMenuHeadingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (menu?.kind === "challengeRegions") {
      challengeMenuHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [menu]);

  /** Picker flow, step 1: open the challenge region list. */
  const openChallengePicker = useCallback(() => {
    setChallengePickError(null);
    setMenu({ kind: "challengeRegions" });
  }, []);

  /**
   * Picker flow, step 2: deal a fresh 5 for the tapped region and show
   * the preview sheet. The catalog is the region's OWN places
   * (fail-closed dealing), widened inside the region only when the
   * band/seen steps run thin (buildCreationSources).
   */
  const pickChallengeRegion = useCallback(
    async (edition: Edition, regionId: string) => {
      setChallengePickError(null);
      try {
        const catalog = await placesFor(edition, regionId, undefined, false);
        const seenIds = new Set(seenStoreFor(edition, regionId, difficultyChoice).read());
        const sources = buildCreationSources({ catalog, choice: difficultyChoice, seenIds });
        const creation = createChallengeRoute({
          edition,
          regionId,
          scoringVersion: SCORING_VERSION,
          mode: "fresh",
          sources,
          dealSeed: mintSeed(),
        });
        if (!creation) {
          setChallengePickError("Not enough places there yet — pick another region.");
          return;
        }
        setChallengePreview({ creation, edition, regionId });
      } catch {
        setChallengePickError("That region could not load — check your connection and try again.");
      }
    },
    [difficultyChoice],
  );

  /** Idle kill: end the session and return the player to the home screen. */
  const killIdleSession = useCallback(() => {
    setStartError(null);
    clearDrop();
    try {
      sessionStorage.removeItem(RUN_KEY);
      clearMc2Run();
    } catch {
      // Storage blocked; the in-memory run is dropped below regardless.
    }
    setRun(null);
    setMenu(null);
    setTutorial(null);
    replaceSession(null);
    setIdleWarn(false);
    setIdleEndedNote(true);
    // #188: session end retires the switched notice too — the same
    // lifecycle logic Block B applied to mode flips. Left standing, a
    // "You switched to … Your score is kept." notice would sit beside
    // the idle-ended notice above and read stale (the score it says
    // was kept has just been dropped with the session).
    setMapSwitchedNote(null);
  }, [replaceSession]);

  useEffect(() => {
    // Observability boot — MUST run before the crash-loop breaker effect
    // below consumes the clean-exit state: initObservability() reads the
    // previous breadcrumb and, when isUncleanShutdown() is true, queues
    // exactly one suspected_crash event carrying that trail (see
    // src/lib/observability.ts — a jetsam kill cannot beacon during the
    // kill; detection is by asymmetry at next boot). Events queue in
    // memory until flags resolve and provide the endpoint (possibly
    // null = transport disabled), then flush. Never throws.
    initObservability();
    installGlobalErrorHandlers();
    // Stale-chunk auto-recovery: registered at boot, before any lazy
    // screen import can fire, so a deploy that lands mid-session
    // reloads the tab once onto the current build instead of stranding
    // the player on a chunk-404 error card (see src/lib/chunk-recovery.ts).
    installChunkLoadRecovery(undefined, {
      buildId: CURRENT_BUILD_ID,
      onRecoverySignal: (signal, facts) => noteRecoverySignal(signal, facts),
    });
    // If the previous page auto-reloaded (or the player tapped the
    // error card's "Try again"), explain the reload now that the new
    // page is up: consume the one-shot notice flag (chunk-recovery).
    if (consumeChunkReloadNotice()) setChunkReloadNotice(true);
    // Scout Map boot qualification: resolve the mode pre-mount — before
    // any map instance exists.
    // Write policy (Q3): a live stored assignment (manual forever, auto
    // inside its decay window, a legacy accepted answer forever) stands
    // WITHOUT a rewrite — rewriting per boot would refresh setAt and
    // silently defeat decay.
    // A fresh scout decision (prior-crash / probe / low-memory) applies
    // SILENTLY (owner ruling, 2026-10-20: "Auto-switch silently on weak
    // devices (my decision stands)"): the session starts in Scout and
    // the decision is persisted as an AUTO record — qualifying source
    // kept, never manual, never accepted — so the 7-day decay
    // re-qualifies the device on later boots, and a device that later
    // probes clean returns to full. (This replaced the boot choice
    // dialog; see planBootMapMode's docstring for the superseded
    // directive.)
    // There is deliberately NO test bypass here (issue #154 item 1):
    // the E2E harness used to set a window flag to suppress this
    // auto-switch on its SwiftShader VM, which reads as a weak device.
    // That flag shipped in production, where any page script could set
    // it. The harness now spoofs the device signals themselves
    // (tests/e2e/helpers.ts), so this boot path is the only one that
    // exists — in production and in tests alike.
    try {
      const stored = readStoredMapMode();
      if (stored) {
        setReportMapMode(stored.mode);
        setMapMode(stored.mode);
      } else {
        const plan = planBootMapMode(
          qualifyMapMode({
            priorMapCrash: wasMapAttributedCrash(),
            webglProbeOk: probeWebGL(),
            deviceMemoryGB: readDeviceMemoryGB(),
          }),
        );
        if (plan.mode === "scout") {
          if (plan.persistSource !== null) {
            writeStoredMapMode("scout", plan.persistSource);
          }
          setReportMapMode("scout");
          setMapMode("scout");
          // Block C: silent is not invisible — flag the one-time
          // non-blocking home note for this boot's auto-switch.
          setAutoScoutNote(true);
        } else {
          setReportMapMode("full");
        }
      }
    } catch {
      // Qualification never blocks boot — full mode is the default.
    }
    // Boot qualification has settled — the storyteller greeting may start.
    setBootQualified(true);
    void loadFlags().then(() => {
      setObservabilityEndpoint(getObservabilityEndpoint());
    });
  }, []);

  /**
   * Manual toggle (owner ruling, 2026-10-20: "Force home on manual
   * switch (my remedy)"). The map is built once per game with the mode
   * as a constructor input, so a new mode can only take effect in a new
   * game — the old "applies from the next place" queue flipped only the
   * labels while the map itself never changed. So: persist the manual
   * record, apply the mode immediately, and exit the run — the SESSION
   * (score, banked places) survives; the in-progress run is DISCARDED.
   * Discarding follows the endTutorial / killIdleSession pattern: the
   * persisted run record is removed too, so a later reload cannot
   * resurrect a game the popover just told the player "ends here"
   * (the Editions exit deliberately keeps its record — switching
   * editions pauses the run; switching the map ends it). Any tutorial
   * beat state belongs to the discarded run and goes with it. The next
   * game the player starts builds its map with the new mode.
   *
   * The exit also carries the accessibility landing (Block A): it
   * sets the hoisted announcement (the toggle's own region unmounts
   * with Play and could never speak) and flags focus to move to the
   * home heading once home renders (the switch that had focus is
   * destroyed by this very exit).
   *
   * And the exit must be the ONLY thing standing between the player
   * and Home (re-vote BLOCK-4 + BLOCK-1): it retires this boot's
   * auto-switch note (the switched notice below supersedes it — Home
   * must never show both, stacked and contradicting each other), and
   * it closes every other full-screen state, because the render
   * branches below run in precedence order and ANY lurking flag
   * would render its screen instead of Home. loopOpen is the sharp
   * case: it rehydrates from a persisted flag, and the Editions exit
   * keeps the run record, so a restored run can sit on top of a
   * persisted GeoDetective flag — without the clears, the flip would
   * drop the run and land on LoopScreen, stranding the focus landing
   * and hiding the notice.
   */
  const handleManualMapMode = useCallback((mode: MapMode) => {
    // BLOCK-A: cancel any in-flight run start. Bumping the generation
    // makes the parked openRun stale, so when its chunk load resolves
    // it bails instead of committing the run this exit just ended.
    runStartGenRef.current += 1;
    writeStoredMapMode(mode, "manual");
    setReportMapMode(mode);
    setMapMode(mode);
    setMapModeAnnouncement(
      mode === "scout" ? SCOUT_COPY.toggleAnnounceOn : SCOUT_COPY.toggleAnnounceOff,
    );
    // Block B: the visible landing notice (the announcement's sibling).
    setMapSwitchedNote(mode);
    landHomeFocusRef.current = true;
    setStartError(null);
    clearDrop();
    try {
      sessionStorage.removeItem(RUN_KEY);
    } catch {
      // Storage blocked; the in-memory run is dropped below regardless.
    }
    setRun(null);
    setTutorial(null);
    setMenu(null);
    // BLOCK-1: retire this boot's auto-switch note — the switched
    // notice set above supersedes it (see the docstring).
    setAutoScoutNote(false);
    // BLOCK-4: close every other full-screen state so the render
    // precedence below cannot hand the landing to a lurking flag
    // (see the docstring). writeLoopOpen mirrors LoopScreen's own
    // onLeave, which clears state and persisted flag together.
    writeLoopOpen(false);
    setLoopOpen(false);
    writeColdTrailOpen(false);
    setColdTrailOpen(false);
    setStarting(null);
  }, []);

  /**
   * The same toggle, hosted on Home (Block C cure): the player can
   * see the current mode and flip it WITHOUT starting a game. No run
   * exists here, so there is nothing to force home FROM and nothing
   * is discarded: write the manual record (a manual choice stands
   * forever, like any manual toggle), apply the mode immediately —
   * the next game builds its map with it — announce it on the hoisted
   * region (home wording: no "back home" clause), and retire the
   * boot auto-switch note, whose "picked for this device" framing the
   * player's own choice has superseded.
   *
   * It also retires the visible switched notice (re-vote BLOCK-2):
   * that notice describes the PREVIOUS in-game switch, and this flip
   * supersedes it — left standing, its "your next game uses the full
   * map" would outlive the flip back to Scout and resurface, stale,
   * on a later Home render.
   */
  const handleHomeMapMode = useCallback((mode: MapMode) => {
    writeStoredMapMode(mode, "manual");
    setReportMapMode(mode);
    setMapMode(mode);
    setMapModeAnnouncement(
      mode === "scout" ? SCOUT_COPY.homeAnnounceOn : SCOUT_COPY.homeAnnounceOff,
    );
    setAutoScoutNote(false);
    // BLOCK-2: this flip supersedes any earlier switched notice.
    setMapSwitchedNote(null);
  }, []);

  // Block A: land focus on the home heading after a manual switch's
  // forced exit. Runs after every commit while the flag is set — the
  // exit commit and the home commit are one and the same, but the
  // heading ref only exists once Choose has mounted, so the flag
  // clears only when the focus actually moves.
  useEffect(() => {
    if (!landHomeFocusRef.current) return;
    const heading = homeHeadingRef.current;
    if (!heading) return;
    landHomeFocusRef.current = false;
    heading.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (ready) recordMilestone("boot_ready");
    // Crash-watchdog ready signal: the inline watchdog in _shell.html
    // watches window.__meridian_ready and treats its absence after ~28s
    // as a boot failure. Set it via requestAnimationFrame so the flag
    // lands after first paint, not just after the state commit. Fires
    // exactly once; never throws (SSR/edge-safe).
    if (ready && !readySignaledRef.current) {
      readySignaledRef.current = true;
      try {
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            try {
              window.__meridian_ready = true;
            } catch {
              /* flag write is best-effort */
            }
          });
        } else if (typeof window !== "undefined") {
          window.__meridian_ready = true;
        }
      } catch {
        /* the watchdog simply treats a missing flag as not-ready */
      }
    }
  }, [ready]);

  useEffect(() => {
    // Crash-loop breaker: a normal unload (reload, tab close, navigation)
    // fires pagehide; a jetsam/WebKit process kill never does. The flag
    // this leaves behind tells the boot effect whether the saved run is
    // safe to auto-resume. handlePageHide takes no event, so it is wrapped
    // here rather than registered directly.
    const onPageHide = () => handlePageHide();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    // Crash-loop breaker: the previous page wrote a run but never unloaded
    // — the process was killed mid-game. Clear the stale run and land on
    // the menu instead of replaying the identical heavy path. A missing
    // flag (runs saved before this fix) counts as clean and resumes as
    // before.
    if (isUncleanShutdown()) {
      clearRunAfterUncleanShutdown(RUN_KEY);
      clearRunAfterUncleanShutdown(RUN_MC2_KEY);
      setReady(true);
      return;
    }
    // Friend-challenge links arrive as a `#c=…` URL fragment. The
    // fragment is stripped from the address bar FIRST, synchronously,
    // before anything async happens — a challenge link should never
    // sit in the URL where a screenshot or a share could leak it, and
    // stripping must not wait on the flag fetch below. What happens
    // next depends on the friendChallenges flag, but every failure exit
    // FALLS THROUGH to bootSavedRun() — the ordinary saved-run boot
    // defined below — instead of ending the boot itself: a player who
    // taps a friend's link (broken or not, feature on or off) must
    // never lose the run they already had in progress. With the flag
    // off this makes the `#c=` boot exactly the boot main would have
    // run if the link had never been tapped.
    const rawHash = window.location.hash;
    if (rawHash.startsWith("#c=") || rawHash === "#c") {
      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } catch {
        // History API blocked; proceed fail-closed.
      }
      void loadFlags().then(async () => {
        if (!isEnabled("friendChallenges")) {
          // Flag off: the feature does not exist for this player, so
          // the boot must be indistinguishable from main's — fall
          // through to the saved-run boot (which also clears a saved
          // CHALLENGE run, exactly as it does without a hash).
          bootSavedRun();
          return;
        }
        if (rawHash.startsWith("#c=mc2.")) {
          // mc2 links take their own receive path (welcome card, no
          // displacement until Start). Everything else in this branch
          // is the frozen mc1 path, byte-identical to the shipped one.
          void receiveMc2Challenge(rawHash);
          return;
        }
        const decoded = decodeChallenge(rawHash, SCORING_VERSION);
        if (!decoded.ok) {
          // Flag on, but the link is broken (corrupt, or made by a
          // different scoring version): tell the player on Home via
          // the boot notice, then fall through — a saved run, if one
          // exists, still resumes underneath the notice.
          setChallengeBootNotice("");
          bootSavedRun();
          return;
        }
        try {
          const [globePlaces] = await Promise.all([
            placesFor("globe", "globe", undefined, false),
            preloadTerritory(),
          ]);
          const validIds = new Set(globePlaces.map((p) => p.id));
          if (!decoded.ids.every((id) => validIds.has(id))) {
            // The link names a place this build's Globe catalog does
            // not have (an old link, or a hand-edited one). Same
            // child-facing failure as a corrupt link: notice + fall
            // through to the saved-run boot.
            setChallengeBootNotice("");
            bootSavedRun();
            return;
          }
          const orderedIds = playOrder(decoded);
          clearDrop();
          const challengeRun = startRun(
            {
              edition: "globe",
              regionId: CHALLENGE_REGION_ID,
              regionName: CHALLENGE_REGION_NAME,
              dateKey: trailDate(),
              difficultyChoice,
            },
            orderedIds,
            null,
          );
          commit(challengeRun);
          // The mc1 boot is its commit point: a saved mc2 challenge is
          // displaced now (a saved challenge is displaceable only on a
          // new challenge's start — manifest §3 persistence). The
          // normal slot now holds THIS challenge; nothing else is
          // touched.
          clearMc2Run();
          setMenu(null);
        } catch {
          // The Globe catalog could not load, so the challenge cannot
          // start. From the player's side this is the same failure as
          // a broken link — show the same notice and fall through to
          // the saved-run boot instead of stranding them on Home.
          setChallengeBootNotice("");
          bootSavedRun();
          return;
        }
        setReady(true);
      });
      return;
    }
    // The ordinary saved-run boot: everything a hash-less boot does —
    // challenge-run resume/clear, review and tutorial retirement,
    // idle-expiry, and the resumable-run restore. It is a named
    // function (declared here, hoisted within this effect) because the
    // `#c=` branch above falls through to it on every failure exit;
    // the hash-less path simply calls it directly. The body below is
    // the pre-challenge boot, unchanged — if you are changing resume
    // behaviour, change it here so BOTH entry points get it.
    function bootSavedRun() {
    // mc2 challenge saves live under their own key (RUN_MC2_KEY) and
    // take precedence over the normal slot: a player who left a
    // challenge mid-route comes back to the challenge. With the flag
    // off the challenge is cleared and the ordinary boot continues
    // underneath — a saved normal run is never collateral (manifest
    // C7's guard table). An mc2 save also shadows a stale mc1 save in
    // the normal slot until it completes or is cleared.
    const mc2Saved = readMc2Run();
    if (mc2Saved) {
      void loadFlags().then(async () => {
        if (!isEnabled("friendChallenges")) {
          clearMc2Run();
          bootSavedRunBody();
          return;
        }
        const today = {
          edition: mc2Saved.edition,
          regionId: mc2Saved.regionId,
          regionName: mc2Saved.regionName,
          dateKey: trailDate(),
          difficultyChoice: mc2Saved.difficultyChoice,
        };
        if (isResumable(mc2Saved, today)) {
          const restored = resumeRun(mc2Saved, today);
          await preloadTerritory();
          commit(restored);
          setReady(true);
          return;
        }
        clearMc2Run();
        bootSavedRunBody();
      });
      return;
    }
    bootSavedRunBody();
    }

    /**
     * The mc2 receive path (Package A): decode and bind the link, load
     * the named region's catalog, check membership — fail-closed at
     * every step with the manifest's three failure classes — and only
     * then show the welcome card. The saved run is NOT touched here:
     * displacement commits on the card's Start tap, never on arrival.
     */
    async function receiveMc2Challenge(hash: string) {
      const link = decodeChallengeLink(hash, SCORING_VERSION);
      if (!link.ok) {
        // Class 2 (region arm) when the region itself is unknown to
        // this build; class 1 for every other decode failure.
        setChallengeBootNotice(
          link.reason === "region" ? CHALLENGE_UNKNOWN_REGION_COPY : CHALLENGE_BROKEN_LINK_COPY,
        );
        bootSavedRun();
        return;
      }
      try {
        const [places] = await Promise.all([
          placesFor(link.route.edition, link.route.regionId, undefined, false),
          preloadTerritory(),
        ]);
        const resolved = resolveChallengeRoute(hash, SCORING_VERSION, places.map((p) => p.id));
        if (!resolved.ok) {
          // Class 2 (place arm): a named place is not in this build's
          // catalog for the named region.
          setChallengeBootNotice(CHALLENGE_UNKNOWN_CONTENT_COPY);
          bootSavedRun();
          return;
        }
        const saved = readRun();
        setPendingChallenge({
          route: resolved.route,
          hasSavedRun:
            !!saved &&
            saved.regionId !== CHALLENGE_REGION_ID &&
            saved.regionId !== REVIEW_DECK_REGION_ID,
        });
        setMenu(null);
        setReady(true);
      } catch {
        // Class 3: the link may be perfect, but the region chunk did
        // not load, so membership could not be checked.
        setChallengeBootNotice(CHALLENGE_LOAD_FAILURE_COPY);
        bootSavedRun();
      }
    }

    function bootSavedRunBody() {
    const saved = readRun();
    if (saved && saved.regionId === CHALLENGE_REGION_ID) {
      void loadFlags().then(async () => {
        if (!isEnabled("friendChallenges")) {
          clearDrop();
          try {
            sessionStorage.removeItem(RUN_KEY);
          } catch {
            // Storage blocked.
          }
          setReady(true);
          return;
        }
        const today = {
          edition: saved.edition,
          regionId: saved.regionId,
          regionName: saved.regionName,
          dateKey: trailDate(),
          difficultyChoice: saved.difficultyChoice,
        };
        if (isResumable(saved, today)) {
          const restored = resumeRun(saved, today);
          await preloadTerritory();
          commit(restored);
        }
        setReady(true);
      });
      return;
    }
    // Review sessions never resume across reloads: the deck (localStorage)
    // is the durable state; the session queue is rebuilt fresh on every
    // start. Fail closed to the edition picker.
    if (saved && saved.regionId === REVIEW_DECK_REGION_ID) {
      clearDrop();
      try {
        sessionStorage.removeItem(RUN_KEY);
      } catch {
        // Storage blocked; the in-memory run is dropped regardless.
      }
      setReady(true);
      return;
    }
    // A persisted tutorial practice round never resumes: the tour is a
    // single-place practice round, so resuming it would recycle the same
    // place forever with no tutorial UI (beat state is in-memory only).
    // Drop it and land on the menu — the invitation is already marked
    // seen, so the player simply starts a real game.
    let resumable = saved;
    if (resumable && isTutorialRunPool(resumable.poolIds)) {
      try {
        sessionStorage.removeItem(RUN_KEY);
      } catch {
        // Storage blocked; treating it as absent is enough.
      }
      resumable = null;
    }
    const now = Date.now();
    const dateKey = trailDate();
    const savedSession = readSession();
    // A session that idled out while the tab was closed counts as expired:
    // kill it (and the run it banked) instead of silently resuming.
    if (savedSession && isSessionLive(savedSession, dateKey) && isIdleExpired(savedSession, now, idleTimeoutMs)) {
      killIdleSession();
      setReady(true);
      return;
    }
    if (resumable) {
      const today = {
        edition: resumable.edition,
        regionId: resumable.regionId,
        regionName: resumable.regionName,
        dateKey,
        // A changed difficulty choice never resumes: switching bands starts
        // a fresh run instead.
        difficultyChoice,
      };
      // resumeRun mints a fresh run when the saved one is not resumable — a
      // page load must not auto-start a run, so only resumable sessions are
      // restored. (The old `restored === saved` check could never pass:
      // resumeRun always returns a new object, so reloads silently dropped
      // to the menu instead of resuming.)
      if (isResumable(resumable, today)) {
        const restored = resumeRun(resumable, today);
        if (restored.phase === "aim") {
          // Core F-2: an aim-phase restore resumes straight into
          // gameplay without crossing openRun's awaited territory
          // preload — so the commit waits for the preload here: the
          // first post-restore pin drop must score against the real
          // data, not the fail-closed default. preloadTerritory never
          // rejects (a failed load fails closed at the readers), so
          // deferring the commit on it cannot strand the boot; the
          // splash stays up until it lands, then ready is set.
          // (#209: the preload is timeout-bounded in territory.ts,
          // so this deferral always settles — a hung import can no
          // longer hold the splash up forever.)
          void preloadTerritory().then(() => {
            commit(restored);
            ensureSession(restored);
            setReady(true);
          });
          return;
        }
        // Non-aim restore (reveal phases): the pin already scored
        // before the reload, so no await is needed — the F2b
        // fire-and-forget start below stands, and the ResultCard's own
        // mount preload + re-render is the guarantee layer for its
        // pin-compare.
        void preloadTerritory();
        commit(restored);
        ensureSession(restored);
      }
    }
      setReady(true);
    }
    bootSavedRun();
  }, [commit, ensureSession, killIdleSession, idleTimeoutMs, difficultyChoice]);

  const refreshForNewBuild = useCallback(() => {
    try {
      sessionStorage.setItem(STALE_REFRESH_KEY, "1");
    } catch {
      // Storage unavailable — reload anyway; the prompt simply reappears.
    }
    window.location.reload();
  }, []);

  const openRun = useCallback(
    async (
      edition: Edition,
      regionId: string,
      regionName: string,
      choice: PickerDifficulty,
      // `fresh` forces a brand-new run instead of resuming the saved one.
      // The celebration's replay/promotion buttons always pass it: the
      // just-finished run (phase "done") is resumable, so resumeRun would
      // return it unchanged and the replay would never restart.
      // `tutorial` starts the isolated first-run practice round: a single
      // fixed famous place, no seen-history side effects, no cleared-mode
      // backstop — the tour is unscored practice, never a real run.
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
      // load below — not only later in writeRun/commit. Why it must
      // precede the load: a jetsam kill DURING the load (the Globe
      // 13.7 MB chunk window) previously left meridian.cleanExit
      // missing/"1" (writeRun had not run yet), so the next boot's
      // initObservability gate (cleanExit === "0") failed and no
      // suspected_crash was emitted — and the breadcrumb identifying
      // the kill was silently overwritten. Interplay:
      // (a) A kill during load leaves no saved run, so the boot
      //     crash-loop breaker clearing the (absent) run and landing
      //     on the menu is harmless and unchanged.
      // (b) A normal chunk-load ERROR caught by the catch below does
      //     NOT produce a spurious suspected_crash: any later normal
      //     unload/reload fires pagehide → handlePageHide stamps "1".
      // (c) Every openRun re-arms, so a repeat kill after the breaker
      //     re-armed the flag to "1" at boot is detectable again.
      // stampCleanExitDirty never throws (see clean-exit.ts).
      stampCleanExitDirty();
      try {
        // The region's chunk(s) load here — never eagerly, never partial.
        recordMilestone("data_chunk_load_start", { edition, regionId, chunkId: regionId });
        // The learning path and the globeTierSplit flag ride along so the Globe
        // fetches only the fame tiers it deals from (flag on) or all five (flag
        // off); dealingPoolFor below still decides the pool.
        const tierSplit = await globeTierSplitFor(edition, regionId);
        if (gen !== runStartGenRef.current) return; // stale (BLOCK-A)
        // F2b: the countries-50m territory data loads in parallel with
        // the places and is awaited before the run commits — scorePlace's
        // region bonus and the reveal pin-compare read it synchronously,
        // so a run must never start ahead of it. preloadTerritory never
        // rejects (a failed load fails closed at the readers), so this
        // await cannot fail the start.
        // #209: the pair is raced against CHUNK_LOAD_TIMEOUT_MS — a
        // HUNG places import never settles, and without the bound the
        // "Fetching this region's places…" state would spin forever.
        // A timeout lands in the catch below like any other load
        // failure: fail-closed, recoverable, stale-probed.
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
        // The picker's difficulty band narrows the catalog BEFORE the dealer
        // pool is built. Fail-closed: an empty band yields an empty pool,
        // never a widened one. The tutorial bypasses banding entirely: its
        // pool is the single fixed practice place, so the tour always asks
        // the same easy famous question regardless of picker choice — and
        // poolForRunStart is skipped so the tour never touches (or wipes)
        // the band's persistent no-repeat history.
        let poolIds: string[];
        let prevLastId: string | null;
        if (opts?.tutorial) {
          poolIds = [TUTORIAL_PLACE_ID];
          prevLastId = null;
        } else {
          // Easy also applies the famous-places curation (easy-curation.ts).
          const banded = dealingPoolFor(places, choice);
          const started = poolForRunStart(banded, edition, regionId, choice);
          poolIds = started.poolIds;
          prevLastId = started.prevLastId;
          // Cleared-mode backstop: a completed cycle at run start means the
          // band was fully played through. If it was already celebrated, the
          // new cycle begins silently (retire the mark); if not — a clear
          // from before this feature existed, or a crash before the
          // celebration — celebrate immediately instead of silently
          // repeating. One celebration per clear: the mark is set either way.
          if (started.cycleCompleted) {
            if (wasClearedCelebrated(edition, regionId, choice)) {
              clearClearedMark(edition, regionId, choice);
            } else {
              markClearedCelebrated(edition, regionId, choice);
              setCleared({ edition, regionId, regionName, choice });
            }
          }
        }
        // A celebration replay/promotion starts FRESH: at the onContinue
        // boundary the run is mid-run in reveal phase and resumable, so
        // resumeRun would return it unchanged and the replay would never
        // restart. Picker paths keep
        // resume semantics (leave-and-return mid-run restores the
        // in-progress run) — `fresh` is opt-in only, and isResumable's
        // semantics are deliberately unchanged (other flows depend on them).
        const today = { edition, regionId, regionName, dateKey, difficultyChoice: choice };
        // The tutorial practice round always starts fresh (it is never a
        // resumed run) and arms beat 1; any other run clears tutorial state
        // (e.g. a normal run started after an idle-killed tour).
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
          // The tour run started: the invitation has been handled, whether
          // or not the player finishes the tour.
          markTutorialSeen();
        }
        // Warm the admin-1 boundary cache during play so it's ready by reveal.
        // Deferred 10 s past run start: firing the ~2 MB JSON fetch during
        // map mount starves the tile requests (net::ERR_ABORTED) and flips
        // the tile-status to failed. The fixed delay moves it out of the
        // critical tile-loading window (requestIdleCallback proved racy —
        // "idle" fires while tiles are still in flight). resolvePin fails
        // closed to country-only until the cache populates. Fire-and-forget:
        // preloadAdmin1Boundaries is specified non-throwing.
        // Country editions with a vendored admin-1 chunk (EG/FR/DE/IT/JP/
        // MX/GB) warm just that chunk on the same tick — the reveal's
        // pin-compare line can then name departments/provinces instead of
        // falling back to the "near <city>" line. Null for other editions:
        // no fetch attempted.
        window.setTimeout(() => {
          void preloadAdmin1Boundaries();
          const chunkIso2 = admin1ChunkIso2ForRegion(regionId);
          if (chunkIso2) void preloadAdmin1ForCountry(chunkIso2);
        }, 10000);
      } catch (err) {
        // BLOCK-A: a stale start fails silently — the player already
        // cancelled it (map flip) or superseded it (a newer start).
        // Parking a start error on the screen they chose instead
        // would report a failure for a start they never made.
        if (gen !== runStartGenRef.current) return;
        // Fail closed: no chunk, no run. The player stays on the menu with
        // an explanation instead of starting with a partial/missing pool.
        // If the tab predates the current deploy (old hashed chunk URLs 404),
        // offer a refresh instead of the dead-end error. The session flag
        // stops a reload loop when the chunk is genuinely missing.
        const message = `Could not load places for ${regionName}: ${err instanceof Error ? err.message : String(err)}`;
        let staleBuild = false;
        try {
          staleBuild =
            sessionStorage.getItem(STALE_REFRESH_KEY) !== "1" &&
            (await isNewBuildDeployed());
        } catch {
          staleBuild = false;
        }
        // The switch can also land during the stale-build probe above.
        if (gen !== runStartGenRef.current) return;
        setStartError({
          message: staleBuild ? message : `We couldn't open ${regionId === "globe" ? "the Globe" : regionName} right now. Check that you're online, then tap Play again.`,
          staleBuild,
          edition,
          regionId,
          regionName,
          choice,
        });
        // Telemetry: region-chunk load failures never left this catch —
        // emit so they reach crash reporting like every other error class.
        emitEvent({
          type: "js_error",
          ts: Date.now(),
          buildId: "",
          error: sanitizeError(new Error(message)),
        });
      } finally {
        // Only the current start owns the loading state (BLOCK-A): a
        // stale start's finally must not clear a newer start's notice.
        if (gen === runStartGenRef.current) setStarting(null);
      }
    },
    [commit, ensureSession],
  );

  // "Try again" on the in-run start-failure box. A failed dynamic import() is
  // remembered by the browser for the lifetime of the document (Chromium does
  // not even request the URL again), so calling openRun again in THIS document
  // cannot recover once a tier file failed to load: reload instead. The picker
  // opens with the chosen band still selected (onPlayBand persisted it). Do NOT
  // reuse refreshForNewBuild: it sets STALE_REFRESH_KEY, which would disable
  // later stale-build detection.
  const retryLastOpen = useCallback(() => window.location.reload(), []);
  // "Keep playing": close the box and hand focus back to the game (the box had
  // it and is about to unmount). The result card's button is "Next place" in
  // the pinned bar and "Next place →" in the full card; neither has a ref or
  // test id, so find it by its label, as other code in this file does with
  // document.querySelector. requestAnimationFrame lets the
  // unmount finish first.
  const dismissStartError = useCallback(() => {
    setStartError(null);
    window.requestAnimationFrame(() => {
      const next = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => (b.textContent ?? "").trim().startsWith("Next place"),
      );
      next?.focus({ preventScroll: true });
    });
  }, []);
  // The in-run start notice clears when the player moves on: the next place
  // is dealt (run.index) or the run changes phase.
  useEffect(() => {
    setStartError(null);
  }, [run?.index, run?.phase]);

  // Review-deck status for the picker entry (flag-gated; re-read whenever
  // the app returns to the picker — see useDeckStatus).
  const deckStatus = useDeckStatus(run, historyResetEpoch);

  /**
   * The "Start over" reset flow (manifest 2026-10-28, D4/D6/D13/D15):
   * wipe the history stores via resetHistory(); only on a fully clean
   * result (failed empty) drop the in-memory session, notify listeners,
   * bump the epoch that remounts the home surfaces, and show the
   * success toast. The run/drop pair is already gone at that point —
   * resetHistory clears it from sessionStorage (D13), so a paused run
   * can never re-seed a session after the wipe. A partial failure
   * changes nothing on screen: the dialog stays open with its retry.
   */
  const handleResetHistory = useCallback((): ResetHistoryResult => {
    const result = resetHistory();
    if (result.failed.length === 0) {
      replaceSession(null);
      window.dispatchEvent(new CustomEvent("meridian:history-reset"));
      setHistoryResetEpoch((n) => n + 1);
      setResetToast(RESET_HISTORY_SUCCESS_TOAST);
    }
    return result;
  }, [replaceSession]);

  /**
   * Start a review session over the currently-due deck cards. The session is
   * a synthetic Run (regionId "review-deck") whose pool is the due queue in
   * due order. Deliberately no ensureSession: review answers never bank
   * into the session — review is practice, not scoring.
   */
  const startReview = useCallback(() => {
    const deck = readReviewDeck() ?? emptyReviewDeck();
    const due = dueEntries(deck, Date.now());
    // Fail closed: the entry points only render when due > 0, so this is
    // unreachable in practice — never start a run with an empty queue.
    if (due.length === 0) return;
    // F2b: review runs skip openRun (and its awaited territory preload);
    // start the load here — the ResultCard's own mount preload is the
    // guarantee layer for its pin-compare ledger.
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
  }, [commit, difficultyChoice]);

  /**
   * "Review my misses" from the end-game summary: the session already ended
   * there, so just leave the summary behind and start the review session.
   */
  const handleReviewDeck = useCallback(() => {
    clearDrop();
    setRun(null);
    setMenu(null);
    // #188: the review session replaces the ended one — retire the
    // switched notice here too, or it would resurface when the
    // review lands back on Home.
    setMapSwitchedNote(null);
    startReview();
  }, [startReview]);

  /**
   * First-run tutorial handlers. The invitation marks the tour seen whether
   * the player takes it or dismisses it — it is shown at most once ever.
   * endTutorial tears down a practice round and returns to the menu: the
   * tour run is removed from storage (it must never resume — see
   * isTutorialRunPool), and the player keeps a clean menu.
   */
  const onTakeTour = useCallback(() => {
    // The seen-flag is marked inside openRun once the tour run actually
    // starts: a failed chunk load leaves the invitation for next visit
    // instead of silently consuming it. inviteDismissed hides it for this
    // page load either way.
    setInviteDismissed(true);
    void openRun(TUTORIAL_EDITION, TUTORIAL_REGION_ID, TUTORIAL_REGION_NAME, difficultyChoice, {
      tutorial: true,
    });
  }, [openRun, difficultyChoice]);
  const onDismissInvite = useCallback(() => {
    markTutorialSeen();
    setInviteDismissed(true);
  }, []);
  // Mascot tap while the invite is up uses the same dismiss. The host
  // starts the greeting inside that click, so this must not start audio.
  useEffect(() => {
    const onFigureDismiss = () => onDismissInvite();
    window.addEventListener(TUTORIAL_INVITE_DISMISS_EVENT, onFigureDismiss);
    return () =>
      window.removeEventListener(TUTORIAL_INVITE_DISMISS_EVENT, onFigureDismiss);
  }, [onDismissInvite]);
  const endTutorial = useCallback(() => {
    setStartError(null);
    clearDrop();
    try {
      sessionStorage.removeItem(RUN_KEY);
    } catch {
      // Storage blocked; the in-memory run is dropped below regardless.
    }
    setRun(null);
    setTutorial(null);
    setMenu(null);
  }, []);

  // Bank one scored place into the session (exactly-once: called only from
  // the pin-commit path, which appends exactly one result per commit).
  const bankScoredPlace = useCallback(
    (input: { edition: Edition; score: number; hit: boolean; distanceKm: number; streakAfter: number; difficultyChoice: PickerDifficulty; regionId: string; regionName: string }) => {
      const dateKey = trailDate();
      const prevBest = getSession()?.bestStreak ?? 0;
      updateSession((prev) => {
        // Sessions are date-scoped like runs: a UTC-midnight rollover starts
        // a fresh session rather than silently dropping banks into a stale one.
        if (!prev || prev.ended) return prev;
        const base = prev.dateKey === dateKey ? prev : startSession(dateKey, Date.now());
        return bankPlace(base, input);
      });
      // Celebration audio (spec §3): streak milestones + first-ever win.
      // Only hits celebrate — a miss resets the streak, never a milestone.
      if (input.hit) {
        // Streak milestones 10/25/50: one small cheer per crossing of the
        // live streak, with the 5 s anti-annoyance spacing in the guard.
        const crossed = [10, 25, 50].find(
          (m) => input.streakAfter >= m && prevBest < m,
        );
        if (crossed !== undefined) playCelebrationSound("smallCheer");
        // First-ever win in any edition, once per lifetime: the Parade
        // overlay. The endless game plays its own playWin here (GeoDetective
        // already played its win on the solve — the mystery-solved variant
        // plays nothing more, so it never doubles).
        if (!hasCelebratedFirstWin()) {
          markFirstWinCelebrated();
          if (soundAudible()) safePlay(playWin);
          setCelebration(celebrationSpec("mystery-solved", "first-win"));
        }
      }
    },
    [updateSession, getSession],
  );

  // End game: the session's totals (not the run's) become the summary, and
  // the session ends — the next game starts a fresh one.
  const handleEndGame = useCallback((): SessionSummary | null => {
    const dateKey = trailDate();
    const now = Date.now();
    let summary: SessionSummary | null = null;
    updateSession((prev) => {
      const base =
        prev && isSessionLive(prev, dateKey) ? prev : startSession(dateKey, now);
      summary = summarizeSession(base);
      const ended = endSession(base);
      return ended;
    });
    return summary;
  }, [updateSession]);

  // Any interaction keeps the session alive; also dismisses the idle warning.
  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      const dateKey = trailDate();
      updateSession((prev) => {
        if (!isSessionLive(prev, dateKey)) return prev;
        // Throttle storage writes: interaction bursts don't need per-event persistence.
        if (now - prev.lastActivityAt < 2000) return prev;
        return touchSession(prev, now);
      });
      setIdleWarn(false);
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    return () => {
      for (const name of events) {
        window.removeEventListener(name, onActivity);
      }
    };
  }, [updateSession]);

  // Idle watchdog: warn shortly before the timeout, then kill the session
  // and return the player to the home screen. Wall-clock based — a tab left
  // open but untouched still expires.
  useEffect(() => {
    const check = () => {
      const s = getSession();
      const dateKey = trailDate();
      if (!isSessionLive(s, dateKey)) {
        setIdleWarn(false);
        return;
      }
      const now = Date.now();
      const idleMs = now - s.lastActivityAt;
      if (idleMs > idleTimeoutMs) {
        killIdleSession();
      } else if (idleMs > idleWarnMs) {
        setIdleWarn(true);
      }
    };
    const id = window.setInterval(check, 5000);
    // Check immediately when the tab becomes visible again: timers throttle
    // in background tabs, so the kill would otherwise lag the return.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getSession, killIdleSession, idleTimeoutMs, idleWarnMs]);

  // Reset success toast: rendered in the run branch (ReviewComplete is
  // a Play surface) and the home branch alike, like idleToast below.
  const resetToastEl = resetToast ? (
    <div className="agep-toast" role="status" data-testid="reset-history-toast">
      {resetToast}
    </div>
  ) : null;
  // Non-blocking idle warning. Rendered on EVERY screen where a session
  // can be live — in-game and the edition picker alike — so the 2-minute
  // kick never surprises. (The "Editions" button leaves the run while the
  // session stays alive, so picker-only rendering would miss it.)
  const idleToast = idleWarn ? (
    <div
      role="status"
      className="fixed inset-x-4 top-16 z-50 mx-auto max-w-md rounded-xl border border-line bg-surface p-4 text-center text-sm text-fg shadow-xl"
    >
      Still there? Your game ends after 2 minutes of no activity — do anything to keep playing.
    </div>
  ) : null;
  // Block A: the manual-switch live region. Rendered as the FIRST
  // child of every screen branch below, so React reconciles the same
  // DOM node across the Play → home branch switch and the node
  // survives holding the new text — a live region only announces when
  // an existing node's text changes. (A region inside the toggle
  // could never do this: it unmounted with Play in the very commit
  // that set its text.)
  const mapModeAnnouncer = (
    <p className="sr-only" role="status" data-testid="map-mode-announcer">
      {mapModeAnnouncement}
    </p>
  );
  // In-run run-start feedback. Only while a run is on screen: from the menu the
  // existing "Loading places" screen and loadNotice already cover it, and the
  // very first run (no run yet) never shows this. The status region inside is
  // always mounted while a run exists so announcements are reliable.
  const startTarget = starting ?? startError;
  const noticeTarget = run && startTarget ? startNoticeTarget(run, startTarget) : null;
  const runStartNotice = run ? (
    <RunStartNotice
      loadingLabel={starting && noticeTarget ? noticeTarget.label : null}
      error={
        !starting && startError && noticeTarget
          ? {
              label: noticeTarget.label,
              scope: noticeTarget.scope,
              staleBuild: startError.staleBuild,
              onTryAgain: retryLastOpen,
              onKeepPlaying: dismissStartError,
              onRefresh: refreshForNewBuild,
            }
          : null
      }
    />
  ) : null;

  if (!ready) {
    // The boot splash lives in boot-splash.tsx: the index route
    // paints the very same component as its served-HTML fallback
    // (the route is ssr:false — see src/routes/index.tsx), so the
    // markup here and the markup in the prerender can never drift
    // apart and trip a hydration mismatch.
    return <BootSplash />;
  }

  if (run) {
    return (
      <>
        {mapModeAnnouncer}
        <Play
          run={run}
          session={session}
          onRun={commit}
          onBankPlace={bankScoredPlace}
          onEndGame={handleEndGame}
          tutorial={tutorial}
          onTutorialAdvance={setTutorial}
          onTutorialEnd={endTutorial}
          onEditions={() => {
            // Back to the picker WITHOUT ending the game: the session (and
            // its score) stays alive across the edition switch.
            setStartError(null);
            clearDrop();
            setRun(null);
            setMenu(null);
          }}
          onChallengeDone={handleChallengeDone}
          onSummaryDone={() => {
            // End game already ended the session; drop it and go home.
            setStartError(null);
            clearDrop();
            setRun(null);
            setMenu(null);
            replaceSession(null);
            // #188: session end retires the switched notice (same
            // lifecycle rule as killIdleSession) — it must not carry
            // into the fresh session the player starts from Home.
            setMapSwitchedNote(null);
          }}
          onReplayed={() => {
            // Play again after End game: the old session ended with the
            // summary, so the replay starts a brand-new session.
            replaceSession(startSession(trailDate(), Date.now()));
            // #188: a fresh session never inherits the old session's
            // switched notice — same retirement as summary-done.
            setMapSwitchedNote(null);
          }}
          onReviewDeck={handleReviewDeck}
          onResetHistory={handleResetHistory}
          onCleared={(info) => setCleared(info)}
          mapMode={mapMode}
          onManualMapMode={handleManualMapMode}
          applyMapMode={applyMapMode}
          applySessionMapMode={applySessionMapMode}
          celebrationOpen={cleared !== null}
          ageBand={ageBand}
        />
        {cleared ? (
          <ClearedCelebrationDialog
            info={cleared}
            onDismiss={() => setCleared(null)}
            onPlayBand={(edition, regionId, regionName, choice) => {
              // The player's explicit band choice follows them: persist it
              // so the picker's highlighted button matches after a
              // promotion (the promoted band used to live on
              // run.difficultyChoice only, leaving the picker stale).
              setDifficultyChoice(choice);
              // Dismiss first: the new run replaces the screen (openRun's
              // loading state), and its own backstop decides whether the
              // fresh band deserves a celebration.
              setCleared(null);
              // Celebration buttons always start a FRESH run in the chosen
              // band — never resume the just-finished one.
              void openRun(edition, regionId, regionName, choice, { fresh: true });
            }}
            onBrowseEditions={() => {
              // Back to the edition picker WITHOUT ending the game: the
              // session (and its score) stays alive, like the Editions
              // button mid-run.
              setStartError(null);
              setCleared(null);
              clearDrop();
              setRun(null);
              setMenu(null);
            }}
          />
        ) : null}
        {celebrationOverlay}
        {runStartNotice}
        {resetToastEl}
        {idleToast}
      </>
    );
  }

  // GeoDetective lives outside the run machine: its own screen, its own
  // storage namespace, its own deck rhythm. An in-progress run takes
  // precedence (the player is mid-game); otherwise the open flag wins.
  if (loopOpen) {
    return (
      <>
        {mapModeAnnouncer}
        <MapErrorBoundary surface="GeoDetective">
          <Suspense fallback={<SessionLoadingFallback label="Loading GeoDetective…" />}>
            <LoopScreen
              onLeave={() => { writeLoopOpen(false); setLoopOpen(false); }}
              onCelebrate={(spec) => setCelebration(spec)}
            />
          </Suspense>
        </MapErrorBoundary>
        {celebrationOverlay}
        {idleToast}
      </>
    );
  }

  // Cold Trail lives next to the loop edition: its own screen, its own
  // storage namespace. A mid-case reload resumes from meridian.coldtrail.v2,
  // and the persisted open flag restores the screen itself (PR #203).
  if (coldTrailOpen) {
    return (
      <>
        {mapModeAnnouncer}
        <MapErrorBoundary surface="Cold Trail">
          <Suspense fallback={<SessionLoadingFallback label="Loading Cold Trail…" />}>
            <TrailScreen onLeave={() => { writeColdTrailOpen(false); setColdTrailOpen(false); }} />
          </Suspense>
        </MapErrorBoundary>
        {celebrationOverlay}
        {idleToast}
      </>
    );
  }

  // Chunk loading state: the region's places are being fetched. The menu is
  // replaced (no double-taps) until the load resolves or fails closed.
  if (starting) {
    return (
      <>
      {mapModeAnnouncer}
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
        <p className="text-sm tracking-wide text-muted uppercase">Loading places</p>
        <h1 className="mt-2 font-display text-4xl text-fg">{starting.regionName}</h1>
        <p className="mt-4 max-w-md text-lg text-muted" role="status">
          Fetching this region&rsquo;s places&hellip;
        </p>
      </main>
      {celebrationOverlay}
      {idleToast}
      </>
    );
  }

  const loadNotice = startError ? (
    startError.staleBuild ? (
      <div
        role="alert"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg"
      >
        <p>A new version of Meridian is available.</p>
        <Button type="button" onClick={refreshForNewBuild}>
          Refresh
        </Button>
      </div>
    ) : (
      <p role="alert" className="mb-4 rounded-xl border border-fg/30 bg-surface p-4 text-base text-fg">
        {startError.message}
      </p>
    )
  ) : null;

  // Shown once on the home screen after the idle kill.
  const idleNotice = idleEndedNote ? (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg"
    >
      <p>Your game ended after 2 minutes of inactivity. Pick an edition to start a new game.</p>
      <Button type="button" variant="secondary" onClick={() => setIdleEndedNote(false)}>
        Dismiss
      </Button>
    </div>
  ) : null;

  // Block B: shown on the home screen after a manual map switch lands
  // the player there — the deliberate switch gets at least the visible
  // acknowledgement the idle kill above already had. Same pattern and
  // slot as the idle notice; the text adds the fact the popover
  // warning could not carry: the score was kept.
  //
  // Deliberately NO role="status" here (re-vote BLOCK-3): the manual
  // handler sets the hoisted announcer's text in the same commit that
  // mounts this notice, so a second live region would announce the
  // same event twice on some screen readers. The announcer is the
  // sole speaker; this notice is the persistent visual record only.
  const mapSwitchedNotice = mapSwitchedNote ? (
    <div
      data-testid="map-switched-notice"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg"
    >
      <p>
        {mapSwitchedNote === "scout"
          ? SCOUT_COPY.switchedNoticeOn
          : SCOUT_COPY.switchedNoticeOff}
      </p>
      <Button type="button" variant="secondary" onClick={() => setMapSwitchedNote(null)}>
        Dismiss
      </Button>
    </div>
  ) : null;

  // Block C: shown on the home screen when THIS boot silently
  // auto-switched to Scout — non-blocking, dismissible, same slot.
  // No role="status" either (re-vote BLOCK-3): the hoisted announcer
  // is the screen's one speaking region for map-mode events.
  const autoScoutNotice = autoScoutNote ? (
    <div
      data-testid="scout-auto-notice"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg"
    >
      <p>{SCOUT_COPY.autoSwitchNote}</p>
      <Button type="button" variant="secondary" onClick={() => setAutoScoutNote(false)}>
        Dismiss
      </Button>
    </div>
  ) : null;

  // Friend-challenge boot notice: shown on Home when this boot followed
  // a tapped `#c=` link that could not be loaded with the flag on (see
  // challengeBootNotice above). role="status" makes it a live region, so
  // a screen reader announces it as Home appears; it stays for the whole
  // boot (no dismiss, no timer) because the link is already gone from
  // the URL — this notice is the only record the failure happened.
  const challengeBootNoticeEl = challengeBootNotice !== null ? (
    <div
      role="status"
      data-testid="challenge-boot-notice"
      className="mb-4 rounded-xl border border-line bg-surface p-4 text-base text-fg"
    >
      <p>{CHALLENGE_CHILD_COPY}</p>
      {challengeBootNotice ? <p className="mt-1">{challengeBootNotice}</p> : null}
    </div>
  ) : null;

  // The received-challenge welcome card: an overlay on Home, shown
  // only between a validated mc2 boot and the player's Start tap.
  const challengeWelcomeEl = pendingChallenge ? (
    <ChallengeWelcome
      route={pendingChallenge.route}
      hasSavedRun={pendingChallenge.hasSavedRun}
      onStart={startPendingChallenge}
      onDismiss={() => setPendingChallenge(null)}
    />
  ) : null;

  // The creation preview sheet: what the friend will get, stated before
  // anything is shared (the route is exact, so the sheet discloses it).
  const challengePreviewEl = challengePreview ? (() => {
    const { creation } = challengePreview;
    const url = `${window.location.origin}${window.location.pathname}${creation.fragment}`;
    const text = `Find ${creation.placeCount} places in ${creation.regionName}! Get inside the ${creation.radiusKm} km circle — closer is better! ${CHALLENGE_FAIRNESS_COPY} (Opens in the newest Meridian.)\n${url}`;
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
            <Button variant="secondary" onClick={() => setChallengePreview(null)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  })() : null;

  if (menu?.kind === "challengeRegions") {
    // The challenge region picker: every playable region with at least
    // CHALLENGE_MIN_PLACES catalog places, grouped by edition. A state
    // row deals THAT state; a country row deals THAT country — region
    // fidelity is the whole point of mc2.
    const globeCount = poolSizeFor("globe", "globe");
    const countries = COUNTRIES.filter((c) => poolSizeFor("country", c.id) >= CHALLENGE_MIN_PLACES);
    const states = STATES.filter((s) => poolSizeFor("state", s.id) >= CHALLENGE_MIN_PLACES);
    const rowClass =
      "flex min-h-11 items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left text-base text-fg";
    const regionRow = (edition: Edition, region: Region) => (
      <button
        key={`${edition}:${region.id}`}
        type="button"
        className={rowClass}
        onClick={withCardTap(region.id, () => void pickChallengeRegion(edition, region.id))}
      >
        <span>{region.name}</span>
        <span className="text-sm text-muted">{poolSizeFor(edition, region.id)} places</span>
      </button>
    );
    return (
      <>
        {mapModeAnnouncer}
        <main className="mx-auto w-full max-w-3xl px-5 py-8">
          <Button variant="secondary" onClick={() => setMenu(null)}>
            Back
          </Button>
          <h1
            ref={challengeMenuHeadingRef}
            tabIndex={-1}
            className="mt-4 font-display text-3xl text-fg"
          >
            Challenge a friend
          </h1>
          <p className="mt-2 text-base text-muted">
            Pick a region. We deal {CHALLENGE_MIN_PLACES} places from it, and your friend plays
            the same route.
          </p>
          {challengeBootNoticeEl}
          {challengePickError ? (
            <p role="status" className="mt-3 text-base text-fg">
              {challengePickError}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2">
            {globeCount >= CHALLENGE_MIN_PLACES
              ? regionRow("globe", { id: "globe", name: "Globe", bounds: [0, 0, 0, 0] })
              : null}
            <h2 className="mt-4 text-sm tracking-wide text-muted uppercase">Countries</h2>
            {countries.map((region) => regionRow("country", region))}
            <h2 className="mt-4 text-sm tracking-wide text-muted uppercase">US states</h2>
            {states.map((region) => regionRow("state", region))}
          </div>
        </main>
        {celebrationOverlay}
        {idleToast}
        {challengePreviewEl}
      </>
    );
  }

  if (menu?.kind === "countries") {
    // Only countries with a playable pool — never a dead end.
    const regions = COUNTRIES.filter((country) => poolSizeFor("country", country.id) > 0);
    return (
      <>
      {mapModeAnnouncer}
      <RegionList
        title="Country"
        subtitle="Play a country whole — or drill into its states where available."
        regions={regions}
        notice={<>{challengeBootNoticeEl}{loadNotice}</>}
        onBack={() => setMenu(null)}
        onChoose={(region) => {
          const subdivisions = ADMIN1_BY_COUNTRY[region.id] ?? [];
          if (subdivisions.length > 0) {
            setMenu({ kind: "admin1", countryId: region.id, countryName: region.name, from: "countries" });
          } else {
            openRun("country", region.id, region.name, difficultyChoice);
          }
        }}
      />
      {celebrationOverlay}
      {idleToast}
      </>
    );
  }

  if (menu?.kind === "states") {
    // Only countries with a playable pool AND states/provinces — never a dead end.
    // The poolSize half matches the Country list's invariant (line above): a country
    // whose admin-1 map lands before its question pool must not be listed, or every
    // state click would hit the fail-closed deal-time gate. Today that is just the
    // United States; more countries appear here as admin-1 pools land, with no USA
    // hardcoding in the picker itself.
    const regions = COUNTRIES.filter(
      (country) =>
        poolSizeFor("country", country.id) > 0 && (ADMIN1_BY_COUNTRY[country.id] ?? []).length > 0,
    );
    return (
      <>
      {mapModeAnnouncer}
      <RegionList
        title="State"
        subtitle="Choose a country, then one of its states."
        regions={regions}
        onBack={() => setMenu(null)}
        onChoose={(region) =>
          setMenu({ kind: "admin1", countryId: region.id, countryName: region.name, from: "states" })
        }
      />
      {celebrationOverlay}
      {idleToast}
      </>
    );
  }

  if (menu?.kind === "admin1") {
    const regions = ADMIN1_BY_COUNTRY[menu.countryId] ?? [];
    return (
      <>
      {mapModeAnnouncer}
      <RegionList
        title={menu.countryName}
        subtitle={`Play the whole ${menu.countryName}, or pick a state.`}
        regions={regions}
        notice={<>{challengeBootNoticeEl}{loadNotice}</>}
        headerAction={{
          label: `Play entire ${menu.countryName}`,
          onClick: () => openRun("country", menu.countryId, menu.countryName, difficultyChoice),
        }}
        onBack={() => setMenu({ kind: menu.from })}
        onChoose={(region) => openRun("state", region.id, region.name, difficultyChoice)}
      />
      {celebrationOverlay}
      {idleToast}
      </>
    );
  }

  // The first-run tutorial invitation: an inline banner on the top-level
  // menu only. It never blocks play — every edition button stays one tap
  // away — and it appears at most once ever (the seen-flag persists).
  const showTutorialInvite = !inviteDismissed && !hasSeenTutorial();
  return (
    <>
    {mapModeAnnouncer}
    {challengeWelcomeEl}
    {/* While the grown-up gate/picker is open it is a full-viewport overlay:
        the home page underneath (incl. Comet's banner and the footer link)
        is inert — non-interactive and removed from the tab order. */}
    <div inert={ageSettingsOpen || undefined}>
    <Choose
      key={historyResetEpoch}
      onState={withCardTap("State", () => setMenu({ kind: "states" }))}
      onCountry={withCardTap("Country", () => setMenu({ kind: "countries" }))}
      onGlobe={withCardTap("Globe", () => openRun("globe", "globe", "Globe", difficultyChoice))}
      onBegin={withCardTap("Globe", () => openRun("globe", "globe", "Globe", difficultyChoice))}
      onTakeTour={onTakeTour}
      onLoop={withCardTap("mystery", () => {
        // Locked for young bands (age-profile): the dossier renders the
        // locked variant instead, so this guard is belt-and-braces.
        if (isLoopLocked(ageBand, "geodetective")) return;
        // Storyteller home handoff (H1): the loop's locked send-off line
        // rides along ≤2.5s while the loop loads — navigation never waits
        // (copy G3). No locked line exists for Cold Trail, so none is sent.
        window.dispatchEvent(
          new CustomEvent("meridian:storyteller-sendoff", {
            detail: { loop: "geodetective" },
          }),
        );
        writeLoopOpen(true);
        setLoopOpen(true);
      })}
      onColdTrail={withCardTap("coldtrail", () => { writeColdTrailOpen(true); setColdTrailOpen(true); })}      onReview={startReview}
      challengeEnabled={friendChallengesOn}
      onChallenge={withCardTap("challenge", openChallengePicker)}
      onResetHistory={handleResetHistory}
      deck={deckStatus}
      difficultyChoice={difficultyChoice}
      onDifficultyChoice={setDifficultyChoice}
      tutorialInvite={
        showTutorialInvite ? (
          <TutorialInvite onTakeTour={onTakeTour} onDismiss={onDismissInvite} />
        ) : null
      }
      tutorialInviteVisible={showTutorialInvite}
      suppressGreeting={!bootQualified}
      ageBand={ageBand}
      onGrownUpOpen={openAgeSettings}
      headingRef={homeHeadingRef}
      mapModeControl={
        // Block C: the map-mode control lives on Home as a single unified
        // pill button showing both the Layers icon and current mode label.
        <MapModeToggle context="home" mapMode={mapMode} onSelect={handleHomeMapMode} />
      }
      notice={
        <>
          {challengeBootNoticeEl}
          {mapSwitchedNotice}
          {autoScoutNotice}
          {idleNotice}
          {loadNotice}
        </>
      }
      homeToast={
        chunkReloadNotice && !ageToast ? (
          <div
            role="status"
            data-testid="chunk-reload-notice"
            className="relative z-10 mt-3 mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-surface pl-4 pr-1 py-1 text-sm text-fg shadow-xl"
          >
            <span>{"Meridian had to reload. You're back! Keep playing!"}</span>
            <button
              type="button"
              aria-label="Close"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg"
              onClick={() => setChunkReloadNotice(false)}
            >
              ✕
            </button>
          </div>
        ) : null
      }
    />
    </div>
    {ageSettingsOpen ? (
      <Suspense fallback={null}>
        <AgeProfileSettings
          runInProgress={run !== null || loopOpen}
          onClose={closeAgeSettings}
          onToast={setAgeToast}
        />
      </Suspense>
    ) : null}
    {ageToast ? (
      <div className="agep-toast" role="status" data-testid="agep-toast">
        {ageToast}
      </div>
    ) : null}
    {resetToastEl}
    {celebrationOverlay}
    {idleToast}
    </>
  );
}

/** Display names of the learning paths, used by the in-run start notice. */
const BAND_LABELS: Record<PickerDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * What the in-run start notice calls the thing being loaded: the band name
 * when the player stays in the same place and only changes the learning path
 * (celebration "Try Medium"), otherwise the place name (Hard-clear "Try
 * <neighbor>", "Try <country>", "Play the Globe").
 */
function startNoticeTarget(
  run: Run,
  target: { edition: Edition; regionId: string; regionName: string; choice: PickerDifficulty },
): { label: string; scope: "band" | "region" } {
  return target.edition === run.edition && target.regionId === run.regionId
    ? { label: BAND_LABELS[target.choice], scope: "band" }
    : { label: target.regionId === "globe" ? "the Globe" : target.regionName, scope: "region" };
}

/** Kid-friendly hints for each learning path, shown under the picker. */
const DIFFICULTY_HINTS: Record<PickerDifficulty, string> = {
  easy: "Famous places — the spots every explorer starts with.",
  medium: "A little of everything — grow your map one discovery at a time.",
  hard: "Hidden corners of the world — for explorers ready to discover more.",
};

function Choose({
  onState,
  onCountry,
  onGlobe,
  onBegin,
  onTakeTour,
  onLoop,
  onColdTrail,
  onReview,
  onResetHistory,
  challengeEnabled,
  onChallenge,
  deck,
  notice,
  homeToast,
  difficultyChoice,
  onDifficultyChoice,
  tutorialInvite,
  tutorialInviteVisible,
  suppressGreeting,
  ageBand,
  onGrownUpOpen,
  headingRef,
  mapModeControl,
}: {
  onState: (e: ReactMouseEvent) => void;
  onCountry: (e: ReactMouseEvent) => void;
  onGlobe: (e: ReactMouseEvent) => void;
  /** Hero "Begin exploring": start a Globe round at the picked difficulty. */
  onBegin: (e: ReactMouseEvent) => void;
  /** Re-open the first-run tour (after "Not now" — finding P2-11). */
  onTakeTour: () => void;
  /** Open the GeoDetective edition (unlimited mysteries). */
  onLoop: (e: ReactMouseEvent) => void;
  /** Open the Cold Trail vertical slice (smuggler triangulation). */
  onColdTrail: (e: ReactMouseEvent) => void;
  /** Start a review session over the due deck cards. */
  onReview: () => void;
  /** Run the "Start over" history reset (GameApp owns the flow). */
  onResetHistory: () => ResetHistoryResult;
  /** Friend challenges on (flag): show the "Challenge a friend" entry. */
  challengeEnabled?: boolean;
  /** Open the challenge region picker. */
  onChallenge?: (e: ReactMouseEvent) => void;
  /** Deck entry status (flag-gated; see useDeckStatus). */
  deck: { enabled: boolean; due: number; total: number };
  notice?: ReactNode;
  homeToast?: ReactNode;
  difficultyChoice: PickerDifficulty;
  onDifficultyChoice: (choice: PickerDifficulty) => void;
  tutorialInvite?: ReactNode;
  /** True while the first-run tutorial invite is on screen — Comet's
      auto-greeting stays quiet until it's dismissed (no competing popups). */
  tutorialInviteVisible?: boolean;
  /** True while a blocking boot dialog is open or boot qualification hasn't
      settled — the storyteller greeting waits (UX review 2026-10-12). */
  suppressGreeting?: boolean;
  /** Effective age band (parent-set; "11-13" when unset). */
  ageBand: AgeBandId;
  /** Open the grown-up gate (footer link + locked-tile link). */
  onGrownUpOpen: () => void;
  /** Ref for the home h1 — GameApp moves focus to it when a manual
   * Scout Map switch lands the player home (Block A cure). */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** The map-mode toggle + current-mode indicator, hosted in the
   * hero's top row (Block C cure). GameApp owns the mode state and
   * the handlers; Choose only places the control. */
  mapModeControl?: ReactNode;}) {
  // GeoDetective progress for the edition card: the resume variant and the
  // streak line. Read on mount (the menu remounts when the loop screen
  // closes, so this is always fresh on return).
  const [loopProgress] = useState(() => peekLoopProgress());
  // Journal ("What the land remembers", docs/journal-spec.md §3/§5/§6):
  // the displayed set index is state, driven by the auto-switch rotation
  // (createJournalRotation in ./home-journal): a boundary timeout at the
  // next window start + a 30s safety interval recompute it, as do
  // visibilitychange (tab visible again) and focusin. A new index is
  // DEFERRED while focus is inside the home Journal card or inside the
  // inline journal section — content is never swapped under a reader
  // (§6, focus-only per owner ruling Q3). The footer countdown ticks on
  // its own 60s clock so it stays live without re-rendering the set.
  const [journalIndex, setJournalIndex] = useState(() => journalSetIndexAt(Date.now()));
  const [journalNowMs, setJournalNowMs] = useState(() => Date.now());
  const focusInsideJournalCard = useCallback(() => {
    const active = document.activeElement;
    const card = document.querySelector('[data-testid="journal-card"]');
    return !!active && !!card && card.contains(active);
  }, []);
  const focusInsideJournalSection = useCallback(() => {
    const active = document.activeElement;
    const section = document.getElementById("home-journal");
    return !!active && !!section && section.contains(active);
  }, []);
  const [journalRotation] = useState(() =>
    createJournalRotation({
      initialIndex: journalIndex,
      blockers: () => ({
        focusInsideCard: focusInsideJournalCard(),
        focusInsideSection: focusInsideJournalSection(),
      }),
      onApply: (index) => setJournalIndex(index),
    }),
  );
  useEffect(() => {
    journalRotation.start();
    const tick = window.setInterval(() => setJournalNowMs(Date.now()), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") journalRotation.recompute();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onFocusIn = () => {
      // A deferred set lands once focus has left the card and the
      // section — never while the reader is still in either place.
      // Recompute from the clock rather than applying a stored pending
      // index, so there is no stale-pending path: the pure deferral
      // check inside the rotation decides for this focus position.
      journalRotation.recompute();
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      journalRotation.stop();
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [journalRotation]);
  const journalEntry = journalSetByIndex(journalIndex) ?? journalSetAt(Date.now());
  const journalNotes = journalEntry?.notes ?? [];
  // Stagger order for the orchestrated entrance (110ms steps in CSS).
  // motionmaxxing M7: the atlas entrance cascade's stagger gaps, retuned
  // uneven (60–100ms) so the cards don't land on a metronome. Keyframes,
  // 0.8s duration, and softLand curve frozen in styles.css; the +380ms
  // stamp offset is frozen there too. --d is retired — this emits the
  // named --rise-delay custom property the CSS reads.
  const RISE_DELAY: Record<number, string> = {
    0: "0ms",
    2: "60ms",
    3: "135ms",
    4: "205ms",
    5: "290ms",
    6: "375ms",
    7: "450ms",
  };
  const rise = (d: number) => ({ "--rise-delay": RISE_DELAY[d] ?? "0ms" }) as CSSProperties;
  // v5 nav jumps: smooth-scroll to a home section (instant under
  // reduced-motion) AND move focus to it — a scroll-only jump strands
  // keyboard / screen-reader users at the top of the page (WCAG 2.4.3).
  // Targets carry tabIndex={-1}; preventScroll keeps our scroll as the
  // only movement. Missing targets are a no-op by construction.
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
    const next = `#${id}`;
    if (window.location.hash !== next) history.replaceState(null, "", next);
  };
  const scrollTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <>
    <main className="atlas-home home-v5 relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 py-8 md:px-9">
      <AtlasBackdrop />
      <svg className="hv5-sprig" viewBox="0 0 120 150" fill="none" stroke="#8FA382" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M14 148 C20 100 34 60 62 22" strokeOpacity=".7" />
        <g fill="#A9BCA0" stroke="none" opacity=".8">
          <ellipse cx="30" cy="118" rx="13" ry="6" transform="rotate(-48 30 118)" /><ellipse cx="42" cy="92" rx="13" ry="6" transform="rotate(-52 42 92)" />
          <ellipse cx="54" cy="66" rx="12" ry="5.5" transform="rotate(-55 54 66)" /><ellipse cx="66" cy="44" rx="11" ry="5" transform="rotate(-58 66 44)" />
          <ellipse cx="24" cy="104" rx="11" ry="5" transform="rotate(-16 24 104)" /><ellipse cx="36" cy="78" rx="11" ry="5" transform="rotate(-20 36 78)" />
          <ellipse cx="48" cy="54" rx="10" ry="4.6" transform="rotate(-24 48 54)" />
        </g>
      </svg>
      {notice}
      {tutorialInvite}
      {/* v5 top nav. ABOUT and JOURNAL jump to the sections at the bottom
          of the home page. Search has no surface yet. */}
      <header className="hv5-nav home-rise" style={rise(0)}>
        <span id="hv5-unmapped-note" className="sr-only">
          Not yet available
        </span>
        <button
          type="button"
          className="hv5-brand"
          aria-label="Meridian home"
          onClick={scrollTop}
        >
          <svg className="hv5-mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21.5" fill="none" stroke="#8A6D2F" strokeWidth="1.6" /><circle cx="24" cy="24" r="16.5" fill="none" stroke="#B8932F" strokeWidth=".8" strokeOpacity=".6" /><path d="M24 6 L27.2 20.8 L42 24 L27.2 27.2 L24 42 L20.8 27.2 L6 24 L20.8 20.8 Z" fill="#8A6D2F" /><circle cx="24" cy="24" r="3.4" fill="#F6F1E3" stroke="#8A6D2F" strokeWidth="1.2" /></svg>
          <span className="hv5-word">MERIDIAN</span>
        </button>
        <nav aria-label="Primary">
          <button type="button" onClick={() => scrollTo("home-editions")}>
            EXPEDITIONS
            <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
          </button>
          <button type="button" onClick={() => scrollTo("home-cases")}>
            CASES
            <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
          </button>
          <button type="button" onClick={() => scrollTo("home-about")}>ABOUT</button>
          <Link to="/contact" data-testid="nav-contact-link">CONTACT</Link>
          <button type="button" onClick={() => scrollTo("home-journal")}>JOURNAL</button>
          <button type="button" onClick={() => scrollTo("home-grownups")}>GET INVOLVED</button>
        </nav>
        <div className="hv5-actions">
          <button
            type="button"
            className="hv5-btn hv5-btn-brown"
            onClick={() => scrollTo("home-cases")}
          >
            JOIN THE JOURNEY
            <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" stroke="currentColor" fill="none" strokeWidth="1.7" /></svg>
          </button>
          <button type="button" className="hv5-icon-btn" aria-label="Search" aria-disabled="true" aria-describedby="hv5-unmapped-note">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#33302A" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>
      {homeToast}

      <div className="hv5-bento">
        <section className="hv5-hero home-rise" style={rise(2)} aria-label="Welcome to Meridian">
          {/* Eyebrow cluster preserved from the atlas home: eyebrow →
              Comet emblem → sound toggle (owner order — Liz's eyebrow
              call, 2026-10-07/08), with the v5 welcome pill leading
              the row. */}
          <div className="hv5-hero-top">
            <span className="hv5-pill">
              <span className="hv5-dot">
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#8A6D2F" /></svg>
              </span>
              WELCOME TO MERIDIAN
            </span>
            <p className="hv5-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Compass className="size-4" aria-hidden="true" />
              Field atlas · {trailDate()} UTC
            </p>
            <CometEmblem />
            <SoundToggle testId="sound-toggle" className="atlas-sound-toggle" />
            <HighContrastToggle testId="high-contrast-toggle" className="atlas-sound-toggle" />
            {mapModeControl}
            {/* Storyteller banner host (owner directive 2026-10-09): the
                figure sits in the hero beside the branding — always visible,
                mobile and desktop. The greeting rides in a popover below. */}
            <span className="hv5-storyteller">
              <StorytellerBannerBoundary>
                <Suspense fallback={<StorytellerBannerSkeleton />}>
                  <StorytellerHomeHost
                    tutorialInviteVisible={tutorialInviteVisible}
                    suppressGreeting={suppressGreeting}
                  />
                </Suspense>
              </StorytellerBannerBoundary>
            </span>
          </div>
          {/* The home h1 is a focus landing (tabIndex={-1}): a manual
              Scout Map switch destroys the switch that had focus when
              it sends the player home, so GameApp moves focus here via
              headingRef (Block A cure). It was originally the landing
              for the boot offer dialog's close; that dialog is gone
              (docs/scout-offer-policy.md). */}
          <h1 ref={headingRef} id="home-heading" className="hv5-h1" data-testid="home-heading" tabIndex={-1}>
            <span className="sr-only">Meridian — </span>
            Explore. Understand.
            <br />
            Make sense of what matters.
          </h1>
          <p className="hv5-sub">
            Pick the globe, a country, or a state. A place name, then one pin. Your score keeps
            adding up across editions until you choose to end the game, or if you&rsquo;re idle for
            2 minutes.
          </p>
          <div className="home-rise" style={rise(4)} data-testid="tour-stop-difficulty">
            <p id="difficulty-label" className="hv5-diff-cap">
              How do you want to grow your map today?
            </p>
            <div role="group" aria-labelledby="difficulty-label" className="hv5-diff">
              {(
                [
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                ] as const
              ).map((option) => {
                const selected = difficultyChoice === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      // SFX audio spec §2.6: the select chirps only on an
                      // actual change — re-tapping the active band stays silent.
                      if (option.value !== difficultyChoice) playDifficultySelect();
                      onDifficultyChoice(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="hv5-hint" aria-live="polite">
              {DIFFICULTY_HINTS[difficultyChoice]}
            </p>
          </div>
          <div className="hv5-cta-row">
            <button
              type="button"
              className="hv5-btn hv5-btn-brown"
              style={{ padding: "16px 28px" }}
              data-testid="begin-exploring"
              // Primary CTA STARTS PLAYING (review finding P1-5, 2026-10-21):
              // it used to only scroll to the Cases section, so a child who
              // pressed the biggest button on the page did not get a game.
              // It now opens a Globe expedition at the difficulty picked just
              // above it (Easy = famous places, see easy-curation.ts) — the
              // same path as the Globe edition card, sound and all. The nav's
              // EXPEDITIONS / CASES buttons still scroll for browsing.
              onClick={onBegin}
            >
              BEGIN EXPLORING
              <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" stroke="currentColor" fill="none" strokeWidth="1.7" /></svg>
            </button>
          </div>
          <img className="hv5-mountain" src={heroMountainUrl} alt="" aria-hidden="true" />
        </section>
        <div className="hv5-rail">
        <div className="hv5-globe-zone">
          <Suspense fallback={null}>
            <HomeGlobe />
          </Suspense>
        </div>
        {/* Choose Your Expedition — the design's dark anchor card hosts the
            three real edition actions (State / Country / Globe). */}
        <div
          className="hv5-card hv5-mapcard home-rise"
          style={rise(6)}
          data-testid="tour-stop-editions"
          id="home-editions"
          tabIndex={-1}
        >
          <div className="hv5-head">
            <span className="hv5-badge">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5 L13.2 13.2 L8.5 15.5 L10.8 10.8 Z" fill="currentColor" stroke="none" /></svg>
            </span>
            <span className="hv5-label">Choose your expedition</span>
          </div>
          <h2>Expeditions Map</h2>
          <p>Choose your expedition — a single US state, a whole country, or the entire globe.</p>
          <svg className="hv5-worldmap" viewBox="0 0 300 138" aria-hidden="true">
            <defs>
              <pattern id="hv5-dots" width="7" height="7" patternUnits="userSpaceOnUse">
                <circle cx="1.6" cy="1.6" r="1.6" fill="#C9D4BE" fillOpacity=".75" />
              </pattern>
            </defs>
            <g fill="url(#hv5-dots)">
              <path d="M18 38 L52 22 L84 26 L92 40 L74 52 L66 72 L48 64 L30 58 L16 50 Z" />
              <path d="M66 78 L84 74 L90 92 L80 122 L68 104 L62 88 Z" />
              <path d="M138 30 L168 22 L182 34 L172 48 L148 50 L134 42 Z" />
              <path d="M146 56 L172 52 L184 72 L172 104 L156 108 L144 80 Z" />
              <path d="M186 26 L238 16 L272 30 L268 52 L232 62 L206 54 L188 44 Z" />
              <path d="M216 66 L244 62 L256 76 L238 88 L220 80 Z" />
              <path d="M240 100 L272 96 L282 108 L262 120 L242 114 Z" />
            </g>
            <path d="M74 50 C130 84 190 84 248 104" fill="none" stroke="#EFEAD6" strokeWidth="1.3" strokeDasharray="1 5" strokeLinecap="round" />
            <circle cx="248" cy="104" r="7" fill="none" stroke="#EFEAD6" strokeWidth="1.2" />
            <path d="M248 97 C244 97 242 100 242 102.4 C242 106 248 110.6 248 110.6 C248 110.6 254 106 254 102.4 C254 100 252 97 248 97 Z" fill="#EFEAD6" />
          </svg>
          <div className="hv5-editions">
            <button type="button" className="hv5-edition" onClick={onState} onPointerEnter={prefetchTerritoryData} onPointerDown={prefetchTerritoryData} onFocus={prefetchTerritoryDataOnFocus}>
              <span className="hv5-idx">N° 01</span>
              <MapPin className="size-5" aria-hidden="true" />
              <span className="hv5-etitle">State</span>
              <span className="hv5-eaction">Choose a state</span>
            </button>
            <button type="button" className="hv5-edition" onClick={onCountry} onPointerEnter={prefetchTerritoryData} onPointerDown={prefetchTerritoryData} onFocus={prefetchTerritoryDataOnFocus}>
              <span className="hv5-idx">N° 02</span>
              <Flag className="size-5" aria-hidden="true" />
              <span className="hv5-etitle">Country</span>
              <span className="hv5-eaction">Choose a country</span>
            </button>
            <button type="button" className="hv5-edition" onClick={onGlobe} onPointerEnter={prefetchTerritoryData} onPointerDown={prefetchTerritoryData} onFocus={prefetchTerritoryDataOnFocus}>
              <span className="hv5-idx">N° 03</span>
              <Globe2 className="size-5" aria-hidden="true" />
              <span className="hv5-etitle">Globe</span>
              <span className="hv5-eaction">Play the globe</span>
            </button>
          </div>
          {challengeEnabled ? (
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={onChallenge}
              data-testid="challenge-a-friend"
            >
              Challenge a friend
            </Button>
          ) : null}
        </div>
        </div>

      <div className="hv5-grid2" id="home-cases" tabIndex={-1}>
        {/* GeoDetective leads: the flagship case file, unlimited mysteries.
            Age-profile: for bands where the loop is locked (5-7), the SAME
            footprint renders the locked variant in place. */}
        {isLoopLocked(ageBand, "geodetective") ? (
          <LockedLoop title="GeoDetective" onGrownUpOpen={onGrownUpOpen} />
        ) : (
        <article
          className="hv5-card hv5-split hv5-stack hv5-case home-rise"
          style={rise(5)}
          data-testid="tour-stop-geodetective"
          aria-labelledby="geodetective-title"
        >
          {/* Card-redesign Variant A: picture first in DOM order (not CSS
              order), so scanning, screen-reader, and tab order all start
              with the image. The card action is the stretched CTA below
              (Form S): the card itself cannot be the <button> because
              EarnedBadgeRow renders real badge <button>s inside it. */}
          <LazyHomeImage className="hv5-pic" src={desertRuinsUrl} alt="" ariaHidden />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M3 19 L9.5 7.5 L13 13 L15.5 9.5 L21 19 Z" /><circle cx="17.5" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
              </span>
              <span className="hv5-label">Case file · Unlimited</span>
            </div>
            <h2 id="geodetective-title">
              GeoDetective<span className="hv5-chip">Open</span>
            </h2>
            <p>
              Five guesses, one mystery place. Each guess unlocks a clue — solve as many cases as
              you can.
            </p>
            {loopProgress.streak > 0 ? (
              <p className="hv5-streak">🔥 Streak: {loopProgress.streak}</p>
            ) : null}
            {/* Owner 2026-10-09: earned badges show on the home page card —
                no separate Passport page. Clean Round is earned in this loop. */}
            <EarnedBadgeRow />
            <button
              type="button"
              className="hv5-go hv5-stretch"
              onClick={onLoop}
              onPointerEnter={prefetchTerritoryData}
              onPointerDown={prefetchTerritoryData}
              onFocus={prefetchTerritoryDataOnFocus}
              aria-label={loopProgress.inProgress ? "GeoDetective: Resume your case" : "GeoDetective: Solve a mystery"}
            >
              {loopProgress.inProgress ? (
                <><span aria-hidden="true">▶️</span>{" "}Resume your case</>
              ) : (
                <><span aria-hidden="true">🔎</span>{" "}Solve a mystery</>
              )}
            </button>
          </div>
        </article>
        )}
        {/* Cold Trail vertical slice: 3 sightings, 3 rings, one interception. */}
        <article
          className="hv5-card hv5-split hv5-stack hv5-dispatch home-rise"
          style={rise(5)}
          aria-labelledby="coldtrail-title"
        >
          {/* Variant A, same as GeoDetective: image first in DOM order;
              whole-card action via the stretched CTA (Form S, shared form
              so both game cards behave identically). */}
          <LazyHomeImage className="hv5-pic" src={patagoniaUrl} alt="" ariaHidden />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5 L13.2 13.2 L8.5 15.5 L10.8 10.8 Z" fill="currentColor" stroke="none" /></svg>
              </span>
              <span className="hv5-label">Case file · Triangulation</span>
            </div>
            <h2 id="coldtrail-title">
              Cold Trail<span className="hv5-chip">New</span>
            </h2>
            <p>
              A smuggler moves between cities. Three sightings, three rings — tap where
              they cross to make the interception.
            </p>
            <button
              type="button"
              className="hv5-go hv5-stretch"
              onClick={onColdTrail}
              onPointerEnter={prefetchTerritoryData}
              onPointerDown={prefetchTerritoryData}
              onFocus={prefetchTerritoryDataOnFocus}
              aria-label="Cold Trail: Start the trail"
            >
              <span aria-hidden="true">❄️</span>{" "}Start the trail
            </button>
          </div>
        </article>
      </div>
      </div>

      <div className="hv5-grid3">
        {deck.enabled ? (
          <section
            aria-labelledby="review-title"
            className={`hv5-card hv5-spot home-rise${deck.due > 0 ? " hv5-review-due" : " hv5-review-empty"}`}
            style={rise(7)}
            data-testid="tour-stop-review"
            id="home-review"
          >
            <div className="hv5-txt">
              <div className="hv5-head">
                <span className="hv5-badge">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5 C7 4 10 4 12 6 C14 4 17 4 20 5.5 V19 C17 17.6 14 17.6 12 19.4 C10 17.6 7 17.6 4 19 Z" /><path d="M12 6 V19.4" /></svg>
                </span>
                <span className="hv5-label">Cases</span>
              </div>
              <h2 id="review-title">{REVIEW_DECK_COPY.pickerTitle}</h2>
              {deck.due > 0 ? (
                <>
                  <p>{REVIEW_DECK_COPY.pickerDueLine}</p>
                  <p style={{ fontWeight: 700, color: "var(--hv5-ink)" }} data-testid="deck-due-count">
                    {deck.due} {deck.due === 1 ? "card" : "cards"} due
                  </p>
                  {/* "Start over" reset entry (manifest 2026-10-28 D10):
                      renders whenever the deck holds any card (due OR
                      caught-up). In-flow in the text column, under the
                      due line, with position:relative + z-index:3 (the
                      .hv5-involved p a precedent) so it stays tappable
                      above the CTA's whole-card stretch layer — and sits
                      in the text column, clear of the REVIEW cue's centre
                      click point (the cue is top-right since Part 2). */}
                  <ResetHistoryControl onReset={onResetHistory} />
                  {/* Whole-card action (Form S): the CTA stretches over
                      the card via .hv5-stretch; the REVIEW → pill is the
                      visible discoverability cue (aria-hidden, pointer-
                      events none — taps pass through to the CTA). */}
                  <button type="button" className="hv5-go hv5-stretch" onClick={onReview} aria-label="Review my misses: Start review">
                    {REVIEW_DECK_COPY.startReview}
                  </button>
                  <span className="hv5-review-cue" aria-hidden="true">REVIEW →</span>
                </>
              ) : deck.total > 0 ? (
                <>
                  <p>{REVIEW_DECK_COPY.pickerCaughtUp}</p>
                  {/* Same reset entry as the due state (D10): visibility
                      is deck total > 0, not due > 0. */}
                  <ResetHistoryControl onReset={onResetHistory} />
                </>
              ) : (
                <p>{REVIEW_DECK_COPY.pickerEmpty}</p>
              )}
            </div>
            <LazyHomeImage className="hv5-art" src={archiveToolsUrl} alt="" ariaHidden />
          </section>
        ) : (
          <div aria-hidden="true" />
        )}
        {/* Journal — the card names the currently-rotating set and
            jumps to the field notes below; the set rotates every 2 hours,
            deferred while focus is inside this card or the journal
            section (spec §6). */}
        <article className="hv5-card hv5-spot hv5-journal home-rise" style={rise(7)} data-testid="journal-card">
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 19 C5 10 11 4.5 20 4.5 C20 14 14.5 19.5 6.5 19.5" /><path d="M5 19 C8 14 11.5 10.5 16 8" /></svg>
              </span>
              <span className="hv5-label">Latest Journal Entry</span>
            </div>
            <h2>What the land remembers</h2>
            <p>Short field stories from the places on the map — the tales only landscapes keep.</p>
            {journalEntry ? (
              <p className="hv5-journal-now" data-testid="journal-now-showing">
                {journalEntry.mixed
                  ? "Now showing: Field Notes"
                  : `Now showing: ${journalEntry.geography} · ${journalEntry.notes.length} field notes`}
              </p>
            ) : null}
            <button type="button" className="hv5-go hv5-stretch" data-testid="journal-open" onClick={() => scrollTo("home-journal")}>
              READ THE ENTRY
            </button>
          </div>
          <LazyHomeImage className="hv5-art" src={journalTreeUrl} alt="" ariaHidden />
        </article>
        <article id="home-grownups" tabIndex={-1} className="hv5-card hv5-spot hv5-involved home-rise" style={rise(7)} data-testid="grownups-card">
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="8.5" cy="8" r="3.2" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M3.5 19.5 C3.5 15.8 5.7 14 8.5 14 C11.3 14 13.5 15.8 13.5 19.5 M14.8 14.6 C17.3 14.9 19 16.4 19 19.5" /></svg>
              </span>
              <span className="hv5-label">Get Involved</span>
            </div>
            <h2>For grown-ups</h2>
            <p>
              How Meridian works, safety notes, and the read-aloud companion for younger explorers.
              Read our <Link to="/privacy">privacy notice</Link> or{" "}
              <Link to="/contact">contact us</Link>.
            </p>
            <button type="button" className="hv5-btn hv5-btn-brown hv5-stretch" data-testid="grownups-card-open" onClick={onGrownUpOpen}>
              JOIN US
              <svg width="14" height="10" viewBox="0 0 15 11" aria-hidden="true"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" stroke="currentColor" fill="none" strokeWidth="1.7" /></svg>
            </button>
          </div>
          <LazyHomeImage className="hv5-art" src={binocularsHatUrl} alt="" ariaHidden />
        </article>
      </div>

      <div className="hv5-pages">
        <section id="home-about" tabIndex={-1} className="hv5-card hv5-page" aria-labelledby="about-title">
          <span className="hv5-label">About</span>
          <h2 id="about-title">How a round works</h2>
          <p>
            A place name, then one pin on an unlabeled map. Right or wrong, the round opens a short
            story about that place. Pick the globe, a country, or a state. Your score keeps adding
            up until you end the game, or after 2 minutes with nothing tapped.
          </p>
          <p>
            No account. The run stays in this browser. A coffee for Grandpa is optional and never
            locks a game.
          </p>
        </section>
        <section id="home-journal" tabIndex={-1} className="hv5-card hv5-page" aria-labelledby="journal-title" data-testid="journal-section">
          <span className="hv5-label">Journal</span>
          <h2 id="journal-title">What the land remembers</h2>
          {journalEntry ? (
            <p className="hv5-journal-geography" data-testid="journal-geography">{journalEntry.geography}</p>
          ) : null}
          {journalNotes.map((note) => (
            <article key={note.id} className="hv5-entry" data-testid="journal-note">
              {note.image && note.imageAlt && (
                <figure className="hv5-entry-art">
                  <LazyHomeImage src={journalImageUrl(note.image)} alt={note.imageAlt} />
                </figure>
              )}
              <h3>{note.place}</h3>
              <p className="hv5-label" style={{ marginTop: 4 }}>{note.where}</p>
              <p style={{ marginTop: 8 }}>{note.story}</p>
              <p style={{ marginTop: 8 }}>
                <a href={note.sourceHref} target="_blank" rel="noopener noreferrer">
                  {note.sourceLabel}
                </a>
                <span className="hv5-journal-confidence">{confidenceText(note)}</span>
              </p>
            </article>
          ))}
          {journalEntry ? (
            <p className="hv5-journal-footer" data-testid="journal-footer">
              Entry {journalEntry.index + 1} of {journalSetCount()} · Next entry in {nextEntryCountdown(journalNowMs)}
            </p>
          ) : null}
        </section>
      </div>

      {/* Age-profile footer entry (Phase 2 §1a): the COPPA-standard
          ParentZone placement — low-emphasis, after the review deck,
          before GrandpaCoffeeRun. One host per screen: the header hosts
          brand + sound, so the footer carries this. */}
      <footer className="agep-footer">
        {/* Kid-reachable read-aloud setting (owner 2026-10-09): the kid's
            Always / Sometimes / Never choice is changeable after the first
            tap. This sits NEXT TO the grown-ups gate — read-aloud is the
            kid's tool, never parent-gated. */}
        <ReadAloudPrefSettings />
        <button
          type="button"
          className="agep-footer-link"
          onClick={onGrownUpOpen}
          aria-label="For grown-ups: game settings"
          data-testid="grownups-link"
        >
          🔒 For grown-ups
        </button>
        {/* Tour re-entry (review finding P2-11): "Not now" on the first-run
            invite marks the tour seen forever, so without this a player who
            dismissed it could never get the 30-second tour back. Kid-
            reachable on purpose — it is help, not a setting. */}
        <button
          type="button"
          className="agep-footer-link"
          onClick={onTakeTour}
          data-testid="take-tour-link"
        >
          🗺️ Take the tour
        </button>
        {/* Grown-ups info pages (review finding P0-3). Contact is gated by
            the math question on its own page, so linking it here is safe. */}
        <Link to="/privacy" className="agep-footer-link" data-testid="privacy-link">
          Privacy
        </Link>
        <Link to="/contact" className="agep-footer-link" data-testid="contact-link">
          Contact us (grown-ups)
        </Link>
        <Link to="/credits" className="agep-footer-link" data-testid="credits-link">
          Credits
        </Link>
        {/* Kids-privacy promise (owner 2026-10-21). Deliberately FACTUAL
            statements, not a "COPPA compliant" badge: compliance is a legal
            determination nobody has certified, and an unqualified claim on a
            child-directed site is itself an FTC exposure. Every statement here
            must stay true — if analytics, ads, or accounts are ever added,
            update this line and /privacy in the same PR. Links to /privacy
            for the full detail. */}
        <p className="agep-footer-note" data-testid="kids-privacy-note">
          Made for kids: no accounts, no ads, no tracking cookies, and no
          personal information collected from players.{" "}
          <Link to="/privacy" data-testid="kids-privacy-note-link">
            How we protect privacy
          </Link>
        </p>
      </footer>
    </main>
    {/* Kid-set read-aloud preference (age-profile B3): asked once, never
        nags — the component renders nothing after the kid answers. */}
    <ReadAloudPrefPrompt />
    {/* Grandpa's Coffee Run — animated donation scene, home only.
        Veeresh 2026-10-07: replaces PR #91's static sign. The v5 nav's
        GET INVOLVED jumps here (the app's get-involved surface). */}
    <div id="home-involved" tabIndex={-1}>
      <GrandpaCoffeeRun />
    </div>
    {/* Comet now hosts from the banner (in the header above) — the fixed
        bottom-right wrapper is retired. */}
    </>
  );
}

/**
 * Full-viewport chart-room atmosphere behind the home screen: brass
 * graticule, topographic contour lines, vignette. Decorative only.
 */
function AtlasBackdrop() {
  return (
    <div className="atlas-bg" aria-hidden="true">
      <svg
        className="atlas-contours"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M-20,110 C140,80 260,150 420,120 S700,100 830,140" />
          <path d="M-20,150 C140,120 260,190 420,160 S700,140 830,180" />
          <path d="M-20,470 C160,440 300,510 470,480 S720,460 830,500" />
          <path d="M-20,510 C160,480 300,550 470,520 S720,500 830,540" />
          <path d="M120,300 c40,-55 130,-55 170,0 c40,55 -40,110 -85,80 c-45,-30 -110,-25 -85,-80 Z" />
          <path d="M150,300 c28,-38 92,-38 120,0 c28,38 -28,76 -60,56 c-32,-20 -78,-18 -60,-56 Z" />
          <path d="M620,380 c40,-55 130,-55 170,0 c40,55 -40,110 -85,80 c-45,-30 -110,-25 -85,-80 Z" />
          <path d="M650,380 c28,-38 92,-38 120,0 c28,38 -28,76 -60,56 c-32,-20 -78,-18 -60,-56 Z" />
          <path d="M540,180 c30,-42 100,-42 130,0 c30,42 -30,84 -65,62 c-35,-22 -85,-20 -65,-62 Z" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Locked player-facing copy for the "Start over" reset (manifest
 * 2026-10-28 §4 — byte-exact; do not paraphrase, punctuate, or
 * re-wrap in code or tests).
 */
const RESET_HISTORY_COPY = {
  opener: "Start over",
  title: "Start over?",
  sub: "This clears your misses to practise again, every place you have seen or cleared, your learning growth, your GeoDetective streaks and solved cases, your Cold Trail case and stars, any game you left in the middle, and your score for today. Your badges stay. Your grown-up choices stay. This cannot be undone.",
  confirm: "Yes, start over",
  cancel: "Keep my history",
  partial: "Some things could not be cleared. Try again.",
} as const;

/** The reset success toast (manifest 2026-10-28 §4, locked). */
const RESET_HISTORY_SUCCESS_TOAST = "All cleared. You are starting fresh.";

/**
 * The reset entry point shared by both surfaces (home Review card and
 * ReviewComplete): an opener button plus ONE role="alertdialog" confirm
 * mirroring AgeProfileSettings — focus moves into the dialog on open,
 * Esc means "no change", and focus returns to the opener on a
 * no-change close. Nothing is deleted before the confirm. A partial
 * failure keeps the dialog open with the locked partial line and the
 * danger button becomes the retry; on success the opener unmounts with
 * the wiped surface, so there is no focus return (the host shows the
 * success toast instead).
 */
function ResetHistoryControl({
  onReset,
}: {
  /** Run the reset; the result decides close-vs-retry. */
  onReset: () => ResetHistoryResult;
}) {
  const [open, setOpen] = useState(false);
  const [partial, setPartial] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Focus moves into the dialog when it opens (the AgeProfileSettings
  // pattern) — this is also what lets the dialog's Esc handler fire.
  useEffect(() => {
    if (open) dialogRef.current?.focus({ preventScroll: true });
  }, [open ]);

  const closeWithoutChange = useCallback(() => {
    setOpen(false);
    setPartial(false);
    const opener = openerRef.current;
    if (opener && document.contains(opener)) {
      // The dialog unmounts on the next paint — return focus after
      // that, without scrolling the page (closeAgeSettings pattern).
      requestAnimationFrame(() => {
        if (document.contains(opener)) opener.focus({ preventScroll: true });
      });
    }
  }, []);

  const confirm = useCallback(() => {
    const result = onReset();
    if (result.failed.length > 0) {
      // Honest partial failure (D4): stay open, name it, offer retry.
      setPartial(true);
      return;
    }
    setOpen(false);
    setPartial(false);
  }, [onReset]);

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        className="reset-history-open"
        data-testid="reset-history-open"
        onClick={() => setOpen(true)}
      >
        {RESET_HISTORY_COPY.opener}
      </button>
      {/* The dialog renders through a portal at the document root (the
          AgeProfileSettings placement): inside the review card, the
          text column is a flex item with z-index 1, which caps the
          dialog's own z-index below the sibling cards' stretch layers
          — their buttons would paint and hit-test over the dialog. */}
      {open
        ? createPortal(
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-history-title"
              className="agep-screen"
              data-testid="reset-history-confirm"
              ref={dialogRef}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeWithoutChange();
              }}
            >
              <h1 id="reset-history-title" className="agep-h1">
                {RESET_HISTORY_COPY.title}
              </h1>
              <p className="agep-sub">{RESET_HISTORY_COPY.sub}</p>
              {partial ? (
                <p className="agep-note" role="alert">
                  {RESET_HISTORY_COPY.partial}
                </p>
              ) : null}
              <div className="agep-actions">
                <button
                  type="button"
                  className="agep-danger"
                  data-testid="reset-history-confirm-clear"
                  onClick={confirm}
                >
                  {RESET_HISTORY_COPY.confirm}
                </button>
                <button
                  type="button"
                  className="agep-ghost"
                  data-testid="reset-history-cancel"
                  onClick={closeWithoutChange}
                >
                  {RESET_HISTORY_COPY.cancel}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * End of a review session: the due queue is exhausted. Bounded and
 * completable by design (ADHD-friendly). Cards answered correctly come
 * back later — further out every time; missed cards are due again right
 * away, so a quick retry is always one tap away from the picker.
 */
function ReviewComplete({
  results,
  total,
  onDone,
  onResetHistory,
}: {
  results: PlaceResult[];
  total: number;
  onDone: () => void;
  /** Present only when the deck still holds cards (fresh read, D16). */
  onResetHistory?: () => ResetHistoryResult;
}) {
  const remembered = results.filter((r) => r.hit).length;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
      <p className="text-sm tracking-wide text-muted uppercase">
        {REVIEW_DECK_COPY.pickerTitle}
      </p>
      <h1 className="mt-2 font-display text-4xl text-fg" data-testid="review-complete">
        {total === 0
          ? "Nothing to review."
          : `${REVIEW_DECK_COPY.completeTitle} You remembered ${remembered} of ${total}.`}
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        {total === 0
          ? REVIEW_DECK_COPY.pickerEmpty
          : remembered === total
            ? "Each card comes back later — further out every time you get it right."
            : "The ones you missed are due again right away. One more round locks them in."}
      </p>
      <div className="mt-6 flex flex-col items-start gap-3">
        <Button onClick={onDone}>{REVIEW_DECK_COPY.backToEditions}</Button>
        {onResetHistory ? <ResetHistoryControl onReset={onResetHistory} /> : null}
      </div>
    </main>
  );
}

/**
 * The mc2 welcome card (Package A): shown on Home after a challenge
 * link validates, BEFORE anything is displaced. It states the route
 * (places + region), the circle, the fairness line, and — when the
 * player has a game in progress — that their game is saved and waiting.
 * One action: Start. The displacement commits on that tap, never on
 * the link's arrival (manifest C6).
 */
function ChallengeWelcome({
  route,
  hasSavedRun,
  onStart,
  onDismiss,
}: {
  route: ChallengeRoute;
  hasSavedRun: boolean;
  onStart: () => void;
  /** Declining is free: nothing is committed, no save is touched — the
   * displacement bargain (C6) binds only the Start tap. */
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={CHALLENGE_WELCOME_TITLE}
      data-testid="challenge-welcome"
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 className="font-display text-2xl text-fg">{CHALLENGE_WELCOME_TITLE}</h2>
        <p className="mt-3 text-base text-fg">
          Find {route.ids.length} places in {route.regionName}. Get inside the{" "}
          {route.radiusKm} km circle — closer is better!
        </p>
        <p className="mt-2 text-base text-muted">{CHALLENGE_FAIRNESS_COPY}</p>
        {hasSavedRun ? (
          <p className="mt-2 text-base text-muted">
            Your game in progress is saved — it will be waiting when you finish.
          </p>
        ) : null}
        <Button className="mt-5 w-full" onClick={onStart} data-testid="challenge-start">
          Start
        </Button>
        <Button
          variant="secondary"
          className="mt-2 w-full"
          onClick={onDismiss}
          data-testid="challenge-not-now"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}

function ChallengeComplete({
  run,
  total,
  onDone,
  shareEnabled,
  regionCatalog,
}: {
  run: Run;
  total: number;
  onDone: () => void;
  /** The completion re-share renders only while the flag is on: a flag
   * flipped off mid-challenge drops the share, never the run (§4). */
  shareEnabled: boolean;
  /** The completed route's OWN region catalog (Package B, §1(f)): the
   * fresh secondary deals from the region, never from the route itself.
   * Null while the catalog has not loaded (or for mc1 runs, whose
   * completion surface is frozen and never shows the secondary). */
  regionCatalog?: readonly Starter[] | null;
}) {
  // Origin preservation (manifest §2, contract 3): a route re-shares in
  // the format it arrived in — an mc1 route stays mc1 byte for byte, an
  // mc2 route stays mc2 with its own region named. Never a downgrade.
  const isMc2 = run.challengeOrigin === "mc2";
  const mc2Creation = isMc2
    ? createChallengeRoute({
        edition: run.edition,
        regionId: run.challengeRegionId ?? "globe",
        scoringVersion: SCORING_VERSION,
        mode: "exact",
        exactIds: run.poolIds,
        // Origin preservation in full (manifest §2.3 + §6): the route
        // re-encodes in the format it ARRIVED in and at the radius it
        // was JUDGED at — an in-tolerance pinned circle (rad 90 vs the
        // computed 87) survives the re-share, never re-pins.
        originFormat: "mc2",
        radiusKmOverride: run.challengeRadiusKm,
      })
    : null;
  const challengeHash = isMc2
    ? (mc2Creation?.fragment ?? null)
    : run.poolIds.length >= CHALLENGE_MIN_PLACES && run.poolIds.length <= CHALLENGE_MAX_PLACES
      ? encodeChallenge(run.poolIds, SCORING_VERSION)
      : null;
  const challengeUrl =
    challengeHash && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${challengeHash}`
      : "";
  // The re-share text, built once so the button and its failure fallback
  // below can never drift apart. mc2 texts name the region and carry the
  // newest-Meridian suffix, because an old build cannot open them.
  const score = run.results.reduce((s, r) => s + r.score, 0).toLocaleString("en-US");
  const challengeText = isMc2
    ? // The pre-written reply text (manifest §1(f)): the receiver sends
      // the route back along the chain with their score on it.
      `I scored ${score} on your ${mc2Creation?.regionName ?? run.regionName} route — beat that! (Opens in the newest Meridian.)\n${challengeUrl}`
    : `Play the same ${total} places on the Globe! I scored ${score}.\n${challengeUrl}`;
  // The fresh secondary (manifest §1(f), Package B): a NEW route in the
  // completed route's region, dealt from the region catalog — the
  // sources are built with no runPoolIds on purpose, so the route just
  // played can never become its own deal source. mc2 completions only:
  // the mc1 completion surface is frozen (§2). Like the re-share, it is
  // creation, so it renders only while the flag is on (§4). The deal
  // seed is the run's own seed — deterministic for a given completion.
  const freshCreation =
    isMc2 && shareEnabled && regionCatalog
      ? createChallengeRoute({
          edition: run.edition,
          regionId: run.challengeRegionId ?? "globe",
          scoringVersion: SCORING_VERSION,
          mode: "fresh",
          sources: buildCreationSources({
            catalog: regionCatalog,
            choice: run.difficultyChoice,
          }),
          dealSeed: run.seed,
        })
      : null;
  const freshUrl =
    freshCreation && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${freshCreation.fragment}`
      : "";
  const freshText = freshCreation
    ? `Find ${freshCreation.placeCount} places in ${freshCreation.regionName}! Get inside the ${freshCreation.radiusKm} km circle — closer is better! ${CHALLENGE_FAIRNESS_COPY} (Opens in the newest Meridian.)\n${freshUrl}`
    : "";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
      <p className="text-sm tracking-wide text-muted uppercase">
        {isMc2 ? run.regionName : CHALLENGE_REGION_NAME}
      </p>
      <h1 className="mt-2 font-display text-4xl text-fg" data-testid="challenge-complete">
        Route complete! You scored {run.results.reduce((s, r) => s + r.score, 0).toLocaleString("en-US")} across {total} places.
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        You landed inside the {challengeRadiusOf(run)} km circle on {run.hits} of {total} stops.
      </p>
      <div className="mt-6 flex max-w-xs flex-col gap-3">
        {challengeUrl && shareEnabled ? (
          <div data-testid="challenge-share-container" data-challenge-url={challengeUrl}>
            <ShareButton
              title="Meridian friend challenge"
              text={challengeText}
              url={challengeUrl}
              label={isMc2 ? CHALLENGE_RESHARE_LABEL : CHALLENGE_SHARE_LABEL}
              className="w-full"
              failureFallback={
                // If the share sheet and the clipboard both fail, the
                // button says "Copy manually" — the link has to be
                // somewhere visible to copy, or that state is a dead
                // end. Same selectable-text block the GeoDetective
                // share uses on themed surfaces.
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                  {challengeText}
                </pre>
              }
            />
          </div>
        ) : null}
        {freshCreation && freshUrl ? (
          <div data-testid="challenge-fresh-share-container" data-challenge-url={freshUrl}>
            <ShareButton
              title="Meridian friend challenge"
              text={freshText}
              url={freshUrl}
              label={challengeFreshRouteLabel(freshCreation.regionName)}
              className="w-full"
              failureFallback={
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                  {freshText}
                </pre>
              }
            />
          </div>
        ) : null}
        <Button onClick={onDone} data-testid="challenge-done">
          {REVIEW_DECK_COPY.backToEditions}
        </Button>
      </div>
    </main>
  );
}

function RegionList({
  title,
  subtitle,
  regions,
  headerAction,
  notice,
  onBack,
  onChoose,
}: {
  title: string;
  subtitle?: string;
  regions: Region[];
  headerAction?: { label: string; onClick: () => void };
  notice?: ReactNode;
  onBack: () => void;
  onChoose: (region: Region) => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      {notice}
      <Button variant="ghost" className="self-start" onClick={onBack}>
        Editions
      </Button>
      <h1 className="mt-4 font-display text-4xl text-fg">{title}</h1>
      {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
      {headerAction ? (
        <Button variant="secondary" className="mt-6 w-full" onClick={headerAction.onClick}>
          {headerAction.label}
        </Button>
      ) : null}
      <ul className="mt-6 flex flex-col gap-2">
        {regions.map((region) => (
          <li key={region.id}>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => onChoose(region)}
            >
              {region.name}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * Async boundary for an in-progress run: the region's chunk loads here
 * (normally a cache hit from region selection; a fresh fetch after a page
 * reload). Shows a loading state while fetching and FAILS CLOSED on error —
 * the run never plays with a partial or missing pool.
 */
function Play({
  run,
  session,
  onRun,
  onBankPlace,
  onEndGame,
  onEditions,
  onChallengeDone,
  onSummaryDone,
  onReplayed,
  onReviewDeck,
  onResetHistory,
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
}: {
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
    return (
      <main className="mode-screen mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
        <p className="name-eyebrow">Couldn&rsquo;t load places</p>
        <h1 className="mode-title mt-2 text-4xl text-fg">{run.regionName}</h1>
        <p role="alert" className="mt-4 max-w-md text-lg text-fg">
          {poolError} The run was not started with a partial pool — pick the region again to retry.
        </p>
        <div className="mt-6">
          <Button onClick={onEditions}>Back to editions</Button>
        </div>
      </main>
    );
  }

  if (!places) {
    return (
      <main className="mode-screen mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
        <p className="name-eyebrow">Loading places</p>
        <h1 className="mode-title mt-2 text-4xl text-fg">{run.regionName}</h1>
        <p className="mt-4 max-w-md text-lg text-fg" role="status">
          Fetching this region&rsquo;s places&hellip;
        </p>
      </main>
    );
  }

  return (
    <PlayLoaded
      run={run}
      places={places}
      challengeCatalog={challengeCatalog}
      session={session}
      onRun={onRun}
      onBankPlace={onBankPlace}
      onEndGame={onEndGame}
      onEditions={onEditions}
      onChallengeDone={onChallengeDone}
      onSummaryDone={onSummaryDone}
      onReplayed={onReplayed}
      onReviewDeck={onReviewDeck}
      onResetHistory={onResetHistory}
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
    />
  );
}

function PlayLoaded({
  run,
  places,
  challengeCatalog,
  session,
  onRun,
  onBankPlace,
  onEndGame: requestEndGame,
  onEditions,
  onChallengeDone,
  onSummaryDone: finishSummary,
  onReplayed,
  onReviewDeck,
  onResetHistory,
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
}: {
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
  onSummaryDone: () => void;
  onReplayed: (run: Run) => void;
  /** A difficulty band was just cleared: show the celebration dialog. */
  onCleared: (info: ClearedInfo) => void;
  /** "Review my misses" from the end-game summary. */
  onReviewDeck: () => void;
  /** Run the "Start over" history reset (GameApp owns the flow). */
  onResetHistory: () => ResetHistoryResult;
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
  // reseed, and a persistent no-repeat history in localStorage. The dealer
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
        // player was dealt). Normal runs use the real localStorage
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
  // A11y (WCAG 4.1.3): the sr-only live region announces aim transitions so
  // screen-reader users get feedback for place/move/clear. Cleared whenever
  // the phase changes, at which point phase messaging takes over.
  const [aimAnnouncement, setAimAnnouncement] = useState<string | null>(null);
  // Pairing rule: every writeDrop/setDrop site must pair with clearDrop — see RUN_DROP_KEY.
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
  // Hints NEVER touch points. Per-place usage drives the 8-10 one-per-place
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
  // "done"/"story" restored from sessionStorage, but no card and no Next
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
    // Hint UI resets per place (8-10: one hint per place).
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
          : pinToleranceKm(run.bandConfig?.band ?? ageBand, run.edition, greaterSideKm(boundsFor(run))),
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
        : pinToleranceKm(run.bandConfig?.band ?? ageBand, run.edition, greaterSideKm(boundsFor(run)));
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
  // band snapshot (deal-time); the button state is per-place for 8-10.
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
   * one; its fragment is mc1, every other exact fragment is mc2.
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
    const exact =
      run.results.length >= CHALLENGE_MIN_PLACES
        ? createChallengeRoute({
            edition: run.edition,
            regionId: run.regionId,
            scoringVersion: SCORING_VERSION,
            mode: "exact",
            exactIds: playedIds,
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
          text: `Find ${fresh.placeCount} places in ${fresh.regionName}! Get inside the ${fresh.radiusKm} km circle — closer is better! ${CHALLENGE_FAIRNESS_COPY} (Opens in the newest Meridian.)\n${origin}${fresh.fragment}`,
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
            : `Play the same ${exact.placeCount} places ${regionPhrase}! I scored ${sessionTotal.toLocaleString("en-US")}. (Opens in the newest Meridian.)\n${origin}${exact.fragment}`,
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
  // run pool → region band, seen-INCLUDED → full region catalog, which
  // is buildCreationSources with NO seenIds (nothing is subtracted).
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
    if (creation) setRunChallengePreview(creation);
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
    const text = `Find ${creation.placeCount} places in ${creation.regionName}! Get inside the ${creation.radiusKm} km circle — closer is better! ${CHALLENGE_FAIRNESS_COPY} (Opens in the newest Meridian.)\n${url}`;
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
      <ReviewComplete
        results={run.results}
        total={pool.length}
        onDone={onEditions}
        onResetHistory={reviewDeckTotal > 0 ? onResetHistory : undefined}
      />
    );
  }
  if (challenge && (run.index >= pool.length || run.phase === "summary")) {
    return (
      <ChallengeComplete
        run={run}
        total={pool.length}
        onDone={run.challengeOrigin === "mc2" && onChallengeDone ? onChallengeDone : onEditions}
        shareEnabled={friendChallengesEnabled}
        regionCatalog={challengeCatalog}
      />
    );
  }

  return (
    <main className="relative h-dvh bg-bg">
      <div className="absolute inset-0">
        <MapErrorBoundary>
          <Suspense fallback={<MapLoadingFallback />}>
            <SatelliteMap
              key={`${mapKeyForCard}:${mapRemountNonce}`}
              tileRetriesUsed={tileRetriesUsed}
              onTileRetry={handleTileRetry}
              onTileFallback={handleTileFallback}
              mode={mode}
              mapMode={mapMode}
              initialView={scoutSwitchView}
              onWebglContextLost={handleWebglContextLost}
              edition={mapEdition}
              regionName={mapRegionName}
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
          </Suspense>
        </MapErrorBoundary>
        <div className="pointer-events-none absolute top-2 right-2.5 left-2.5 z-30 flex items-start justify-between gap-2 sm:top-3 sm:right-3 sm:left-3 sm:gap-3">
          <div className="flex items-start gap-1.5 sm:gap-2">
            <Button variant="secondary" className="pointer-events-auto" onClick={onEditions}>
              {review ? REVIEW_DECK_COPY.exitReview : "Editions"}
            </Button>
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
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface text-fg transition-colors"
            />
            {/* Scout Map settings toggle. The choice writes
                meridian:map-mode and sends the player home — the new
                mode takes effect in the next game, because the map is
                built once per game (owner ruling, 2026-10-20). */}
            <MapModeToggle mapMode={mapMode} onSelect={onManualMapMode} />
            {/* Package B (§1(b)): the run menu. Mid-run challenge
                creation lives HERE — one item in this overflow, in the
                header chrome cluster beside the other run controls —
                never as a new button on the aim surface, and physically
                separated from End game (which sits in the bottom dock /
                top-right score cluster). The button is not rendered at
                all when no route can be dealt or the flag is off:
                flag-off means the feature does not exist (§4). */}
            {runChallengeAvailable ? (
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
                    className="pointer-events-auto absolute top-full left-0 z-40 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl"
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
            <span className="sr-only" role="status">
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
              ? "Showing the answer."
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
    </main>
  );
}
