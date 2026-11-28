import { distanceKm } from "@/game/geo";
import { placesFor, poolSizeFor, storyForBand } from "@/game/generated-places";
import { CURRENT_BUILD_ID, isNewBuildDeployed, staleRefreshRecentlyUsed } from "@/game/build-staleness";
import {
  handlePageHide,
  stampCleanExitDirty,
} from "@/game/clean-exit";
import type { Starter } from "@/game/starters";
import { ADMIN1_BY_COUNTRY, COUNTRIES, findRegion, STATES, greaterSideKm } from "@/game/regions";
import { rewriteStory } from "@/game/rewrite";
import { shouldFireAiStory } from "@/game/story-ai";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase } from "@/game/run";
import { type PickerDifficulty } from "@/game/tier-filter";
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
export { isChallengeRun } from "@/game/shell-helpers";
export type { Drop } from "@/game/shell-helpers";
import { createDealer, poolForNewRun, seenStoreFor, mintSeed, wasClearedCelebrated, markClearedCelebrated, clearClearedMark, memorySeenStore, isBandCleared } from "@/game/trail";
import { MapErrorBoundary } from "./map-error-boundary";
import { Play } from "./play";
import { Choose } from "./choose";
import { AtlasBackdrop, HeroTrailOverlay, HeroTrekkerOverlay } from "./hero-overlays";
// Home media slots (TD-06.16): the composer owns the @/assets/** and
// passport imports (layer-baseline covers game-app.tsx) and passes them
// to <Choose> as props — choose.tsx may not import them directly.
import heroMountainUrl from "@/assets/home-v5/hero-mountain.webp";
import { GEODETECTIVE_FILM, GROWNUPS_FILM, JOURNAL_FILM, coldtrailMediaForBand, reviewMediaForBand, whyLearnMediaForBand } from "@/assets/home-v5/card-media";
import { EarnedBadgeRow } from "./passport/EarnedBadgeRow";
import { SatelliteMapHost } from "@/map/satellite-map-host";
import { BootSplash } from "./boot-splash";
import "./home-v5.css";
import {
  VERDICT_GRANDPA_POSTER_URL,
  VERDICT_GRANDPA_VIDEO_URL,
} from "@/assets/verdict/grandpa-media";
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
import type { StorageKeyDef } from "../platform/storage/storage.ts";
import {
  initAudio,
  playCardTap,
  playWin,
} from "@/game/audio/sfx";
import { playCelebrationSound, safePlay, soundAudible } from "@/game/audio/play-guards";
import { applyPalettePreference } from "@/game/palette-preference";
import { Suspense, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { EndOfFlowHome } from "@/components/ui/end-of-flow-home";
import { RunStartNotice } from "@/components/run-start-notice";
import { directionalHint } from "./hint-logic";
import { canUseHint } from "@/game/age-profile/run-config.ts";
import { RunSummaryCard } from "./run-summary";
import { RegionList, StartingView } from "./region-list";
import { ChallengeMenu } from "./challenge-menu";
import { ChallengeWelcome } from "./challenge-welcome";
import { ClearedCelebrationDialog, type ClearedInfo } from "./cleared-celebration";
import {
  journalSetAt,
  journalSetByIndex,
  journalSetCount,
  journalSetIndexAt,
} from "./home-journal";
import {
  isJournalPrefetchAllowedNow,
  resolveJournalPrefetchEntries,
  startJournalPrefetch,
  type JournalPrefetchHandle,
} from "./journal-prefetch";
// Storyteller banner host (owner directive 2026-10-09): the Storyteller
// sits IN THE BANNER beside the Meridian branding — always visible, mobile
// and desktop. React.lazy — the host (and its copy chunk) never lands in
// the initial bundle. The shell (skeleton + error boundary) is a light
// module bundled with the main chunk; the boundary fails closed to a static
// figure so the banner never breaks home. Comet is retired as a host: a
// silent ~30px emblem stays in the eyebrow row (aria-hidden, decorative,
// never speaks).
// Age-profile system: the parent-set group (7-10 / 10-18 / 18+). Game
// screens use ONLY this facade — the store is never imported directly.
// The settings screen is React.lazy: zero initial-bundle cost.
import { FirstVisitQueue, type FirstVisitPrompt } from "./ui/first-visit-queue";
import {
  getAgeGroup,
  isLoopLocked,
} from "@/game/age-profile";
import { useAgeProfileHost } from "./age-profile/use-age-profile-host";
import { SubjectsHost } from "@/subjects/shared/SubjectsHost";
import { useShellSession } from "./use-shell-session";
import { useOverlayQueue } from "./use-overlay-queue";
import { useRunController } from "./use-run-controller";
import { useShellRouter } from "./use-shell-router";
import { useChallengeSurface } from "./use-challenge-surface";

import {
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
} from "./celebration-overlay";
import {
  REVEAL_WATCHDOG_MS,
  shouldArmRevealWatchdog,
} from "./reveal-watchdog";
import { isEnabled, loadFlags, getObservabilityEndpoint } from "@/lib/flags";
import {
  installChunkLoadRecovery,
  isChunkLoadError,
  shouldReportChunkFailure,
} from "@/lib/chunk-recovery";
import { consumeRetryScreen } from "@/lib/persisted-screen";
import { resolveGlobeTierSplit } from "@/lib/globe-tier-split";
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
import { useMapMode } from "@/map/use-map-mode";
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
  writeLoopOpen,
  peekLoopProgress,
} from "@/game/loop/store";
import { writeColdTrailOpen } from "@/game/coldtrail/store";
import { ColdTrailHost } from "@/game/coldtrail/ColdTrailHost";
import { GeoDetectiveHost } from "@/game/loop/GeoDetectiveHost";
// F2 bundle split: GeoDetective (Loop) and Cold Trail are play-intent
// screens — they render only when the player opens them (B7: never on
// boot from a saved loopOpen flag — tap-in only). Both screens statically
// import LoopMap, which value-imports maplibre-gl (~1.1 MB) and its
// stylesheet, so a static import here pulled the whole map library into
// the preloaded route chunk. They are React.lazy instead — the
// SatelliteMap pattern below — so MapLibre loads on demand, behind
// Suspense + MapErrorBoundary at the render sites. The screens have no
// default export, so the lazy factories adapt their named exports (the
// HomeGlobe idiom above).
import { resetHistory, type ResetHistoryResult } from "@/game/reset-history";
import { useDifficultyChoice } from "./use-difficulty-choice";
import { useDeckStatus } from "./use-deck-status";
import { useChunkReloadNotice } from "./use-chunk-reload-notice";
import { useResetHistoryToast } from "./use-reset-history-toast";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 py-8">
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

type ModelAvailability = "available" | "downloadable" | "downloading" | "unavailable";

type NanoSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

type LanguageModelGlobal = {
  availability: () => Promise<string>;
  create: () => Promise<NanoSession>;
};

function readRunFrom(def: StorageKeyDef<unknown>): Run | null {
  try {
    const parsed: unknown = getSessionStorageItem(def);
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
    // Range-check the restored numbers: a tampered saved index
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
    // The winner block at the save boundary (governing manifest
    // §Q1-A4): on an mc3 save it is either ABSENT (an open route) or
    // COMPLETE and plausible for the saved route. A partial or
    // implausible block discards the whole save — the block is never
    // silently dropped while the run resumes underneath it.
    if (
      record.challengeOrigin === "mc3" &&
      record.challengeWinner !== undefined &&
      !isLegalWinnerBlock(
        record.challengeWinner,
        Array.isArray(record.poolIds) ? record.poolIds.length : 0,
      )
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
      ...(record.challengeOrigin === "mc1" ||
      record.challengeOrigin === "mc2" ||
      record.challengeOrigin === "mc3"
        ? { challengeOrigin: record.challengeOrigin }
        : {}),
      // The winner block, carried only off an mc3 save whose block
      // the pre-check above already validated complete-or-discard.
      ...(record.challengeOrigin === "mc3" &&
      record.challengeWinner !== undefined
        ? { challengeWinner: record.challengeWinner as ChallengeWinner }
        : {}),
    };
  } catch {
    return null;
  }
}

function readRun(): Run | null {
  return readRunFrom(STORAGE_KEYS.pausedRun);
}

/** The saved mc2 challenge run, if one is in progress. Saved mc2 runs
 * live under their OWN key (manifest C8): a build from before mc2
 * existed never reads this key, so an mc2 save can never be
 * reinterpreted as a globe run by an old build — it is simply
 * invisible to it. mc1 challenge saves keep using the shipped slot,
 * exactly as the shipped build wrote them. */
function readMc2Run(): Run | null {
  return readRunFrom(STORAGE_KEYS.pausedRunMc2);
}

function clearMc2Run() {
  try {
    removeSessionStorageItem(STORAGE_KEYS.pausedRunMc2);
  } catch {
    // Storage blocked; the in-memory state is dropped regardless.
  }
}

/** The saved mc3 challenge run, if one is in progress. Saved mc3 runs
 * live under their OWN key again (governing manifest §Q1-A4): a build
 * from before mc3 existed never reads this key, so an mc3 save —
 * winner block included — can never be picked up by an mc2-era build
 * and silently re-shared with the winner block dropped. mc3 builds
 * read mc3 → mc2 → mc1 slots, in order.
 * A save whose winner block read as partial or implausible was already
 * discarded by readRunFrom (§Q1-A4); the slot itself is removed here
 * when its contents name an mc3 save that no longer validates, so
 * the discarded save is never re-read on the next boot. */
function readMc3Run(): Run | null {
  const run = readRunFrom(STORAGE_KEYS.pausedRunMc3);
  if (run) return run;
  try {
    const parsed: unknown = getSessionStorageItem(STORAGE_KEYS.pausedRunMc3);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (
        record.challengeOrigin === "mc3" &&
        record.challengeWinner !== undefined &&
        !isLegalWinnerBlock(
          record.challengeWinner,
          Array.isArray(record.poolIds) ? record.poolIds.length : 0,
        )
      ) {
        removeSessionStorageItem(STORAGE_KEYS.pausedRunMc3);
      }
    }
  } catch {
    // Unreadable slot: boot falls through; the stale save is inert.
  }
  return null;
}

function clearMc3Run() {
  try {
    removeSessionStorageItem(STORAGE_KEYS.pausedRunMc3);
  } catch {
    // Storage blocked; the in-memory state is dropped regardless.
  }
}

function clearDrop() {
  try {
    removeSessionStorageItem(STORAGE_KEYS.pausedDrop);
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

function readCachedStory(placeId: string): string | null {
  // The port's story def reads missing, unreadable or blocked as
  // null — a miss, so the story is built, as before.
  const cached = getStorageItem(storyKeyDef(placeId));
  if (cached === null || cached.trim() === "") return null;
  return cached;
}

function writeCachedStory(placeId: string, text: string) {
  // A private window can refuse the cache; the port swallows that.
  // The story still shows once.
  setStorageItem(storyKeyDef(placeId), text);
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
  // Exactly-once guard for the crash-watchdog ready signal below.
  const readySignaledRef = useRef(false);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  // Map-mode cluster (game-app-map step 8): the hook in src/map
  // owns the mode state, its notices and announcement, the boot
  // qualification and the apply paths. GameApp threads the values
  // down as props; the manual toggles' handlers stay in this file
  // because they force-home the run and land focus (shell business).
  const {
    mapMode,
    bootQualified,
    mapModeAnnouncement,
    mapSwitchedNote,
    autoScoutNote,
    scoutUpgradeEligible,
    welcomeMapPick,
    setMapMode,
    setMapModeAnnouncement,
    setMapSwitchedNote,
    setAutoScoutNote,
    setScoutUpgradeEligible,
    setWelcomeMapPick,
    applyMapMode,
    applySessionMapMode,
    applyScoutUpgrade,
    handleWelcomeMapMode,
    qualifyBootMapMode,
    readStoredMapMode,
    writeStoredMapMode,
  } = useMapMode();

  /**
   * Focus landing for the manual switch's forced exit: the switch
   * that had focus is destroyed with Play, so on landing home focus
   * moves to the home h1 (WCAG 2.4.3). handleManualMapMode sets the
   * flag; the effect below fires once Choose has mounted and
   * attached the ref.
   */
  const homeHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const landHomeFocusRef = useRef(false);

  /** "Why Do We Learn This?" Home card: live for everyone since the
   * subjects launch (owner rule, Nov 13: release progressively). It
   * used to be flag-gated behind scalePlay / ?scale=1; the card no
   * longer reads that flag. */

  // GeoDetective mounts its own screen outside the endless-run state
  // machine; it persists under meridian.loop.v2 and never touches the
  // run/drop keys. B7 (owner ruling, 2026-11-09): a new session always
  // lands on Home — the loop NEVER auto-opens from the persisted open
  // flag (meridian.loop.open). The flag is still written on tap-in /
  // leave, and the saved loop (deck/progress/streak in meridian.loop.v2)
  // stays intact, so tapping in resumes the saved mystery where it left
  // off; only the boot auto-open is gone.
  // The 368 rule (owner condition, Stream N Phase 2): the one
  // exception to the bare-visit rule above is the error screen's
  // Try again — its reload carries a one-shot session marker, and
  // boot restores exactly that screen, exactly once. The marker is
  // consumed here, before either open state initialises, so both
  // screens read the one answer.
  const bootRetryRef = useRef<string | null | undefined>(undefined);
  if (bootRetryRef.current === undefined) {
    bootRetryRef.current = consumeRetryScreen();
  }
  const [loopOpen, setLoopOpen] = useState<boolean>(() => bootRetryRef.current === "GeoDetective");
  // Subject picker: session-only open state, set by the why-learn
  // card tap. Never persisted — a reload lands on Home, like the
  // loop's tap-in rule.
  const [subjectsOpen, setSubjectsOpen] = useState<boolean>(false);
  // Age-profile state and overlays (game-app-map step 4): the host
  // hook in ./age-profile owns the profile state, the ask-first
  // hold, the settings wiring and the toast — GameApp only passes
  // the values and slots on to the screens and Home.
  const {
    ageBand,
    ageAsk,
    clearAgeAsk,
    askAgeFirst,
    ageAskGate,
    ageSettingsOpen,
    openAgeSettings,
    ageSettings,
    ageToast,
    ageToastNode,
    lockedLoop,
    readAloudPrefSettings,
    readAloudPrefEntry,
  } = useAgeProfileHost();

  // A page restored from the browser's back/forward cache keeps its
  // frozen React state, so a tap-in screen left open when the page
  // was frozen (a subject case, the GeoDetective loop) resurrects on
  // what feels like a fresh load — the owner-reported "the game
  // loads with a clue open". These screens are session-only by rule
  // (B7: a new session always lands on Home; the picker comment
  // above says the same), and a cache restore is a new arrival, so
  // close them and land on Home. Cold Trail is deliberately not
  // closed here: its open state is persisted on purpose
  // (readColdTrailOpen in @/game/coldtrail/store).
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setSubjectsOpen(false);
      clearAgeAsk();
      writeLoopOpen(false);
      setLoopOpen(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  // Journal prefetch (lazy-load scenario 2): while a round is active,
  // warm the current entry's movie and the next window's (B8: one entry
  // per 30-minute window, so "the next 1–2 in the current set" is the
  // current window + the next window) in the background so a later tap
  // plays instantly. Tap-to-load is unchanged — this only pre-warms the
  // plain HTTP cache (CORS fetch + drain; see journal-prefetch.ts for
  // the real-server probe that proved zero additional transfers on the
  // tap). Warmed ids are tracked per window so an entry is never warmed
  // twice; a failed warm means the tap fetches cold, as today.
  //
  // Placement matters: the effect MUST live here in GameApp, not in
  // Choose (home). GameApp returns early with <Play>/<LoopScreen>
  // while a round is active, so Choose — which owns the journal state
  // — is unmounted during gameplay and no effect inside it could ever
  // run while playing. The entry here is therefore derived from the wall
  // clock (the same derivation Choose initialises from), not read from
  // Choose's state; it matches the displayed entry except at a window
  // boundary where Choose deferred a rotation for focus — then the
  // warm simply misses and the tap fetches cold, as today. No player
  // can be open during a run (Choose is unmounted), so there is no
  // playing entry to skip.
  //
  // The effect keys on the round-active boolean, not on `run` itself:
  // `run` is a new object on every pin drop / phase change, so keying
  // on it would abort and restart the warm mid-round. The trigger is
  // the brief's — `run !== null || loopOpen` first becoming true.
  // Warmed ids, keyed by journal window index: a rotation gets a fresh
  // window (no re-warm of the old window, no skip of the new one), and
  // a later round in the same window never re-warms what is already
  // cached. The next window's note was possibly warmed as "next"
  // during the previous window, so the previous window's warmed ids
  // also count as warmed — no entry is ever warmed twice.
  const warmedJournalIdsRef = useRef<Map<number, Set<string>>>(new Map());
  const roundActive = run !== null || loopOpen;
  useEffect(() => {
    if (!roundActive) return;
    if (!isJournalPrefetchAllowedNow()) return;
    // A round that starts in an already-hidden tab must not warm: the
    // visibilitychange listener below only fires on a transition.
    if (document.visibilityState === "hidden") return;
    const windowIndex = journalSetIndexAt(Date.now());
    const currentNotes =
      journalSetByIndex(windowIndex) ?? journalSetAt(Date.now());
    // B8: the current window's entry plus the next window's — the
    // selection limit (2) caps this at two warms.
    const nextNotes = journalSetByIndex(windowIndex + 1);
    const noteIds = [
      ...(currentNotes?.notes ?? []),
      ...(nextNotes?.notes ?? []),
    ].map((note) => note.id);
    const warmedIds =
      warmedJournalIdsRef.current.get(windowIndex) ?? new Set<string>();
    warmedJournalIdsRef.current.set(windowIndex, warmedIds);
    // A note warmed as "next" in the previous window must not warm
    // again as "current" now (B8 singletons: every note is the next
    // window's note once before it is the current one).
    const prevIndex =
      (windowIndex - 1 + journalSetCount()) % journalSetCount();
    const prevWarmed = warmedJournalIdsRef.current.get(prevIndex);
    const skipIds = prevWarmed
      ? new Set([...warmedIds, ...prevWarmed])
      : warmedIds;
    let cancelled = false;
    let handle: JournalPrefetchHandle | null = null;
    const abortController = new AbortController();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelled = true;
        handle?.abort();
        abortController.abort();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    void resolveJournalPrefetchEntries(noteIds, {
      playingJournalId: null,
      warmedIds: skipIds,
    }).then((entries) => {
      if (cancelled || entries.length === 0) return;
      const idByUrl = new Map(entries.map((entry) => [entry.url, entry.noteId]));
      handle = startJournalPrefetch(
        entries.map((entry) => entry.url),
        {
          signal: abortController.signal,
          onWarmed: (url, warmed) => {
            if (!warmed) return;
            const id = idByUrl.get(url);
            if (id) warmedIds.add(id);
          },
        },
      );
    });
    return () => {
      // Abort landmark: this cleanup runs when roundActive flips false —
      // at summary Done, not at End game (run stays non-null while the
      // summary is up, so warms keep progressing during the summary
      // and only abort at Done).
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      handle?.abort();
      abortController.abort();
    };
    // Deps are intentionally [roundActive]: `run` churns identity
    // mid-round (see above); the set is derived from the clock at
    // trigger time, and a mid-round window crossing simply leaves the
    // older set warmed — the tap after the round recomputes from the
    // clock, so a stale warm can only miss, never mislead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundActive]);
  // Cold Trail (vertical slice): its own screen outside the run machine,
  // persisted under meridian.coldtrail.v2. The open flag
  // (meridian.coldtrail.open) used to restore the screen after a
  // reload (PR #203 panel). The 368 rule supersedes that for boot:
  // a bare visit always lands on Home, and the only boot restore is
  // the error screen's Try-again retry (the session marker consumed
  // above, next to loopOpen). The flag is still written on tap-in /
  // leave; in-progress cases resume from the store when the player
  // taps in.
  const [coldTrailOpen, setColdTrailOpen] = useState<boolean>(() => bootRetryRef.current === "Cold Trail");
  // Post-reload notice (chunk-recovery): set once at boot when the
  // previous page's reload left a notice flag. Deliberately NO
  // auto-dismiss timer (unlike the age toast): a timed status can be
  // deleted before a screen reader reaches it. Close button only.
  const { chunkReloadNotice, consumeChunkReloadNoticeOnce, dismissChunkReloadNotice } =
    useChunkReloadNotice();
  // "Start over" reset (manifest 2026-10-28): the success toast reuses
  // the age-toast styling/lifetime, and historyResetEpoch is the
  // refresh pin (D14) — bumping it remounts <Choose> (re-reading the
  // mount-only home surfaces) and re-runs useDeckStatus in place.
  const { resetToast, historyResetEpoch, showResetSuccess } = useResetHistoryToast();
  // The ask-first gate overlay: the gate element is the age-profile
  // host's; the Suspense + error boundary stay with the composer
  // (the boundary is a components/root module — see the host file).
  const ageAskOverlay = ageAskGate ? (
    <Suspense fallback={null}>
      <MapErrorBoundary surface="Age picker">
      {ageAskGate}
      </MapErrorBoundary>
    </Suspense>
  ) : null;
  // Step 6 — overlay queue: first-visit, tutorial / invite, celebration / cleared.
  const {
    cleared,
    setCleared,
    celebration,
    setCelebration,
    dismissCelebration,
    celebrationOverlay,
    tutorial,
    setTutorial,
    inviteDismissed,
    setInviteDismissed,
    bumpPromptQueue,
    firstVisitModalOpen,
    setFirstVisitModalOpen,
  } = useOverlayQueue(mapMode);

  // Difficulty picker: one choice applies across Globe → Country → State and
  // survives edition switches. Persisted so it survives reloads too.
  const [difficultyChoice, setDifficultyChoice] = useDifficultyChoice();
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
  // Step 5 — session, idle watchdog, discarded notice (use-shell-session).
  const {
    session,
    updateSession,
    replaceSession,
    getSession,
    ensureSession,
    killIdleSession,
    idleWarn,
    idleEndedNote,
    discardedNotice,
    discardedNoticeAnnouncement,
    idleTimeoutMs,
    idleWarnMs,
    setDiscardedNotice,
    setIdleWarn,
    setIdleEndedNote,
  } = useShellSession({
    setRun,
    setMenu,
    setTutorial,
    setStartError,
    setMapSwitchedNote,
    clearDrop,
    readRun,
    readMc2Run,
    clearMc2Run,
    clearMc3Run,
  });

  // Step 7 — run controller: commit, openRun, startReview (use-run-controller).
  const { commit, openRun, startReview } = useRunController({
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
  });

  // Step 9 (TD-06.9): the challenge receive/preview surface owns the
  // pending + preview state the router hook writes into, and the
  // commit-on-action callbacks. The composer keeps the render sites.
  const {
    challengeBootNotice,
    setChallengeBootNotice,
    pendingChallenge,
    setPendingChallenge,
    friendChallengesOn,
    challengePreview,
    setChallengePreview,
    challengePickError,
    setChallengePickError,
    startPendingChallenge,
    handleChallengeDone,
    openChallengePicker,
    pickChallengeRegion,
    handleReviewChallenge,
  } = useChallengeSurface({
    commit,
    ensureSession,
    difficultyChoice,
    welcomeMapPick,
    setWelcomeMapPick,
    mapMode,
    handleWelcomeMapMode,
    setMenu,
    setRun,
    setStartError,
    readRun,
    clearMc2Run,
    clearMc3Run,
    clearDrop,
  });

  // Step 10 (TD-06.7): the shell router + boot live in use-shell-router.ts.
  // It owns `ready`, the derived `inAppScreen`, the hash / history writer
  // and listeners, and the boot effect that restores a saved run.
  const { ready, inAppScreen } = useShellRouter({
    commit,
    ensureSession,
    killIdleSession,
    idleTimeoutMs,
    difficultyChoice,
    replaceSession,
    setDiscardedNotice,
    setChallengeBootNotice,
    setMenu,
    setPendingChallenge,
    clearDrop,
    bootRetryRef,
    readRun,
    readMc2Run,
    readMc3Run,
    clearMc2Run,
    clearMc3Run,
    run,
    loopOpen,
    coldTrailOpen,
    subjectsOpen,
    starting,
    menu,
    setLoopOpen,
    setColdTrailOpen,
    setSubjectsOpen,
  });

  /**
   * Adopt the stored session when it is still live (same day, not ended),
   * otherwise start a fresh one. A fresh session seeded from a run that
   * already has results backfills exactly once: those places were never
   * banked into any live session.
   */

  /** Idle kill: end the session and return the player to the home screen.
   * skipNotice (fix round M1) suppresses ONLY the inactivity notice set:
   * the kill, the session clear, and the shadow clear always run. The
   * body boot passes it when an mc2 notice is preserved. */
  useEffect(() => {
    // Observability boots in the router (use-shell-router.ts) at the
    // start of the boot effect, before the crash-loop breaker reads the
    // clean-exit state — see there. This effect installs the global
    // error handlers and the stale-chunk recovery hook.
    installGlobalErrorHandlers();
    // Stale-chunk auto-recovery: registered at boot, before any lazy
    // screen import can fire, so a deploy that lands mid-session
    // reloads the tab once onto the current build instead of stranding
    // the player on a chunk-404 error card (see src/lib/chunk-recovery.ts).
    installChunkLoadRecovery(undefined, {
      buildId: CURRENT_BUILD_ID,
      onRecoverySignal: (signal, facts) => noteRecoverySignal(signal, facts),
    });
    // Scout Map boot qualification (step 8): the map-mode hook
    // resolves the mode pre-mount — before any map instance exists —
    // and settles bootQualified. See src/map/use-map-mode.ts for the
    // write policy (Q3) and the silent auto-switch rules.
    qualifyBootMapMode();
    void loadFlags().then(() => {
      setObservabilityEndpoint(getObservabilityEndpoint());
    });
  }, [qualifyBootMapMode]);

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
   * case: it can only be true in-session now (B7 — tap-in sets it,
   * boot never restores it), and the Editions exit keeps the run
   * record, so a restored run can sit on top of an in-session
   * GeoDetective flag — without the clears, the flip would drop
   * the run and land on LoopScreen, stranding the focus landing
   * and hiding the notice.
   */
  const handleManualMapMode = useCallback((mode: MapMode) => {
    // A challenge run is NEVER ended by the map switch (owner ruling,
    // 2026-10-29): the force-home below would kill the challenge AND
    // delete the player's preserved normal run (STORAGE_KEYS.pausedRun) — the run
    // the challenge promised to keep safe underneath. A challenge's
    // map is picked at challenge open (the welcome card), and the
    // in-challenge toggle renders its challenge context with no switch
    // at all; this guard is the choke-point backstop so no present or
    // future caller can force-home out of a challenge either.
    if (run && isChallengeRun(run)) return;
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
      removeSessionStorageItem(STORAGE_KEYS.pausedRun);
    } catch {
      // Storage blocked; the in-memory run is dropped below regardless.
    }
    setRun(null);
    setTutorial(null);
    setMenu(null);
    // BLOCK-1: retire this boot's auto-switch note — the switched
    // notice set above supersedes it (see the docstring).
    setAutoScoutNote(false);
    // #330 cure: an explicit manual choice disarms any pending trial
    // upgrade — the upgrade must never override the player's pick.
    setScoutUpgradeEligible(false);
    // BLOCK-4: close every other full-screen state so the render
    // precedence below cannot hand the landing to a lurking flag
    // (see the docstring). writeLoopOpen mirrors LoopScreen's own
    // onLeave, which clears state and persisted flag together.
    writeLoopOpen(false);
    setLoopOpen(false);
    writeColdTrailOpen(false);
    setColdTrailOpen(false);
    setStarting(null);
  }, [run]);

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
    // #330 cure: an explicit manual choice disarms any pending trial
    // upgrade — the upgrade must never override the player's pick.
    setScoutUpgradeEligible(false);
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
      // F7d: the post-reload notice is consumed HERE, at the point
      // readiness is signalled — not in the mount effect. A page that
      // mounts then stalls before ready must still hold its notice
      // at the crash watchdog's 28 s check, where a surviving fresh
      // notice is the recovery evidence that stands the watchdog's
      // boot_failure report down.
      consumeChunkReloadNoticeOnce();
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
  }, [ready, consumeChunkReloadNoticeOnce]);

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

  const refreshForNewBuild = useCallback(() => {
    try {
      // F6: a timestamp, not "1" — readers honour the mark only
      // inside the freshness window (staleRefreshRecentlyUsed).
      // The stamp also prevents a refresh loop when a chunk is
      // genuinely missing rather than merely outdated. The port
      // stores the number as JSON text — the same digit bytes
      // String(Date.now()) wrote here before the port.
      setSessionStorageItem(STORAGE_KEYS.staleRefresh, Date.now());
    } catch {
      // Storage unavailable — reload anyway; the prompt simply reappears.
    }
    window.location.reload();
  }, []);

  // "Try again" on the in-run start-failure box. A failed dynamic import() is
  // remembered by the browser for the lifetime of the document (Chromium does
  // not even request the URL again), so calling openRun again in THIS document
  // cannot recover once a tier file failed to load: reload instead. The picker
  // opens with the chosen band still selected (onPlayBand persisted it). Do NOT
  // reuse refreshForNewBuild: it arms the stale-refresh stamp, which would disable
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
   * resetHistory clears it from session storage (D13), so a paused run
   * can never re-seed a session after the wipe. A partial failure
   * changes nothing on screen: the dialog stays open with its retry.
   */
  const handleResetHistory = useCallback((): ResetHistoryResult => {
    const result = resetHistory();
    if (result.failed.length === 0) {
      replaceSession(null);
      window.dispatchEvent(new CustomEvent("meridian:history-reset"));
      showResetSuccess();
    }
    return result;
  }, [replaceSession, showResetSuccess]);

  /**
   * Start a review session over the currently-due deck cards. The session is
   * a synthetic Run (regionId "review-deck") whose pool is the due queue in
   * due order. Deliberately no ensureSession: review answers never bank
   * into the session — review is practice, not scoring.
   */
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
      removeSessionStorageItem(STORAGE_KEYS.pausedRun);
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

  // GeoDetective tap-in, shared by Home's GeoDetective card and the
  // Why Learn resume control (fix/case-navigation amendment, owner
  // decision 2026-11-14): opening is all either surface does — the
  // loop screen resumes-or-deals from the saved loop store, so a
  // mystery mid-play comes back exactly where it left off. Locked
  // bands never open it (Home renders the locked card instead, and
  // the resume control is absent for them too). Returns whether it
  // opened, so a caller leaving another screen can stay put when
  // the guard refuses.
  const openGeoDetective = useCallback((): boolean => {
    // Locked for young bands (age-profile): the dossier renders the
    // locked variant instead, so this guard is belt-and-braces.
    if (isLoopLocked(ageBand, "geodetective")) return false;
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
    return true;
  }, [ageBand]);

  // End game: the session's totals (not the run's) become the summary, and
  // the session ends — the next game starts a fresh one.
  const handleEndGame = useCallback((): SessionSummary | null => {
    // Wave 1 P0 Item 1: a deliberate end never leaves a discarded-game
    // record — the ended session is finished, not lost. (The ended
    // write below clears the shadow too; this is belt-and-braces.)
    clearDiscardedShadow();
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
        <main>
        <Play
          mapHost={SatelliteMapHost}
          globeTierSplitFor={globeTierSplitFor}
          revealStory={revealStory}
          verdictGrandpaPosterUrl={VERDICT_GRANDPA_POSTER_URL}
          verdictGrandpaVideoUrl={VERDICT_GRANDPA_VIDEO_URL}
          clearDrop={clearDrop}
          poolForRunStart={poolForRunStart}
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
          onChallengeRetry={(route) => startPendingChallenge(route)}
          onSummaryDone={() => {
            // End game already ended the session; drop it and go home.
            // 3C focus return rides the landHomeFocusRef effect: the flag
            // below arms it, and the effect retries after every commit,
            // clearing only once the home heading actually takes focus —
            // so the return survives Choose mounting after this commit.
            landHomeFocusRef.current = true;
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
          onReviewChallenge={handleReviewChallenge}
          onCleared={(info) => setCleared(info)}
          mapMode={mapMode}
          onManualMapMode={handleManualMapMode}
          applyMapMode={applyMapMode}
          applySessionMapMode={applySessionMapMode}
          scoutUpgradeEligible={scoutUpgradeEligible}
          onScoutUpgrade={applyScoutUpgrade}
          readStoredMapMode={readStoredMapMode}
          celebrationOpen={cleared !== null}
          ageBand={ageBand}
        />
        </main>
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
            <GeoDetectiveHost
              onLeave={() => setLoopOpen(false)}
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
            <ColdTrailHost onLeave={() => setColdTrailOpen(false)} />
          </Suspense>
        </MapErrorBoundary>
        {celebrationOverlay}
        {idleToast}
      </>
    );
  }

  // Subject picker lives beside the loop screens: its own early
  // return, reached from the why-learn card. The picker lists the
  // released subjects and opens the tapped subject's case itself.
  if (subjectsOpen) {
    return (
      <>
        {mapModeAnnouncer}
        <div inert={ageSettingsOpen || ageAsk !== null || undefined}>
          <MapErrorBoundary surface="Subjects">
            <Suspense fallback={<SessionLoadingFallback label="Loading subjects…" />}>
              <SubjectsHost
                group={getAgeGroup()}
                tier="full"
                onExit={() => setSubjectsOpen(false)}
                onCelebrate={(spec) => setCelebration(spec)}
                onEndGame={() => {
                  handleEndGame();
                  setSubjectsOpen(false);
                }}
                onResetHistory={() => {
                  const result = handleResetHistory();
                  if (result.failed.length === 0) setSubjectsOpen(false);
                  return result;
                }}
                loopInProgress={
                  peekLoopProgress().inProgress &&
                  !isLoopLocked(ageBand, "geodetective")
                }
                onResumeCase={() => {
                  // Home's GeoDetective tap-in, shared verbatim: the
                  // saved mystery resumes from the loop store. The
                  // subjects close behind it, so the loop's own
                  // leave lands on Home exactly as it does from the
                  // card. Nothing in the subject case is carried
                  // over or discarded specially — leaving a case is
                  // the Home button's own path. Ask-first (owner
                  // decision, 2026-11-14): with no band set the age
                  // picker answers first and the resume runs off
                  // the pick, so a mystery never resumes under a
                  // silently defaulted band.
                  askAgeFirst(() => {
                    if (openGeoDetective()) setSubjectsOpen(false);
                  });
                }}
                // Item 17: only a live subject round defers the
                // picker's band-change event. A GeoDetective case
                // left open (loopOpen) is not a round on this page —
                // counting it deferred the event to a boundary the
                // picker never hits, so its counts never re-dealt.
                // The settings mounts keep `|| loopOpen`: leaving a
                // case IS a run in progress for their confirm flow.
                bandChangeRunInProgress={run !== null}
                onOpenAgeSettings={openAgeSettings}
              />
            </Suspense>
          </MapErrorBoundary>
        </div>
        {ageSettingsOpen ? (
          <Suspense fallback={null}>
            <MapErrorBoundary surface="Age settings">
              {ageSettings(run !== null || loopOpen)}
            </MapErrorBoundary>
          </Suspense>
        ) : null}
        {ageAskOverlay}
        {ageToastNode}
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
      <main className="mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col justify-center px-5 py-8">
        <StartingView regionName={starting.regionName} />
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
      <div
        role="alert"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-fg/30 bg-surface p-4 text-base text-fg"
      >
        <p>{startError.message}</p>
        {/* F8: never a button-less soft-strand — mirror the in-run
            start notice's Try again (a plain reload). */}
        <Button type="button" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    )
  ) : null;

  // Wave 1 P0 Item 1: the one shared discarded-run notice. When it is
  // present it IS the idle card too (the inactivity copy keeps the old
  // sentence verbatim, plus the played summary), so the old card is
  // suppressed while it stands — home shows one notice, never two.
  const discardedNoticeEl = discardedNotice ? (
    <div
      data-testid="discarded-notice"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg"
    >
      <p>{discardedNoticeText(discardedNotice)}</p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setDiscardedNotice(null);
          setIdleEndedNote(false);
          // Fix round L1: dismissing the discarded notice lands focus
          // on the home heading (the landHomeFocusRef target), not
          // <body>. The idle notice's own Dismiss is untouched.
          landHomeFocusRef.current = true;
        }}
      >
        Dismiss
      </Button>
    </div>
  ) : null;

  // Fix round L2: the discarded notice's sole live region. Always
  // rendered on home (never conditional on the notice), mirroring the
  // map-mode announcer: the effect near the discardedNotice state
  // fills it after mount and clears it on dismiss, so each notice is
  // a real text change. The visible notice carries no live role, so
  // this text is announced exactly once per notice, never twice.
  const discardedNoticeAnnouncer = (
    <p className="sr-only" role="status" data-testid="discarded-notice-announcer">
      {discardedNoticeAnnouncement}
    </p>
  );

  // Shown once on the home screen after the idle kill.
  const idleNotice = idleEndedNote && !discardedNotice ? (
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
      <p>{challengeBootNotice.title}</p>
      {challengeBootNotice.detail ? (
        <p className="mt-1">{challengeBootNotice.detail}</p>
      ) : null}
    </div>
  ) : null;

  // The received-challenge welcome card: an overlay on Home, shown
  // only between a validated mc2 boot and the player's Start tap.
  const challengeWelcomeEl = pendingChallenge ? (
    <ChallengeWelcome
      route={pendingChallenge.route}
      hasSavedRun={pendingChallenge.hasSavedRun}
      mapMode={welcomeMapPick ?? mapMode}
      onMapModeSelect={setWelcomeMapPick}
      onStart={() => startPendingChallenge()}
      onDismiss={() => {
        setWelcomeMapPick(null);
        setPendingChallenge(null);
      }}
    />
  ) : null;

  if (menu?.kind === "challengeRegions") {
    return (
      <>
        {mapModeAnnouncer}
        <main className="mx-auto w-full max-w-(--page-narrow) px-5 py-8">
          <EndOfFlowHome onHome={() => setMenu(null)} variant="secondary" />
          <ChallengeMenu
            notice={challengeBootNoticeEl}
            pickError={challengePickError}
            preview={challengePreview}
            onDismissPreview={() => setChallengePreview(null)}
            onPickRegion={(edition, regionId) => {
              playCardTap();
              void pickChallengeRegion(edition, regionId);
            }}
          />
        </main>
        {celebrationOverlay}
        {idleToast}
      </>
    );
  }

  if (menu?.kind === "countries") {
    // Only countries with a playable pool — never a dead end.
    const regions = COUNTRIES.filter((country) => poolSizeFor("country", country.id) > 0);
    return (
      <>
      {mapModeAnnouncer}
      <main className="mode-screen mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-2 pb-8">
        <RegionList
          title="Country"
          subtitle="Play a country whole — or drill into its states where available."
          regions={regions}
          notice={<>{challengeBootNoticeEl}{loadNotice}</>}
          kind="home"
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
      </main>
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
      <main className="mode-screen mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-2 pb-8">
        <RegionList
          title="State"
          subtitle="Choose a country, then one of its states."
          regions={regions}
          kind="home"
          onBack={() => setMenu(null)}
          onChoose={(region) =>
            setMenu({ kind: "admin1", countryId: region.id, countryName: region.name, from: "states" })
          }
        />
      </main>
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
      <main className="mode-screen mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-2 pb-8">
        <RegionList
          title={menu.countryName}
          subtitle={`Play the whole ${menu.countryName}, or pick a state.`}
          regions={regions}
          notice={<>{challengeBootNoticeEl}{loadNotice}</>}
          headerAction={{
            label: `Play entire ${menu.countryName}`,
            onClick: () => openRun("country", menu.countryId, menu.countryName, difficultyChoice),
          }}
          kind="back"
          onBack={() => setMenu({ kind: menu.from })}
          onHome={() => setMenu(null)}
          onChoose={(region) => openRun("state", region.id, region.name, difficultyChoice)}
        />
      </main>
      {celebrationOverlay}
      {idleToast}
      </>
    );
  }

  // The first-run tutorial invitation: an inline banner on the top-level
  // menu only. It never blocks play — every edition button stays one tap
  // away — and it appears at most once ever (the seen-flag persists).
  const showTutorialInvite = !inviteDismissed && !hasSeenTutorial();

  // Item 9 (INV4): the first-visit prompts share one queue — Scout Map
  // notice → tour banner → read-aloud sheet — so at most one is visible
  // at any moment. Each prompt keeps its own seen-store and dismiss
  // path; the queue only sequences visibility: this list holds the
  // prompts that currently want to show, in queue order, and
  // FirstVisitQueue renders the first of them. The fourth prompt, the
  // storyteller greeting bubble, keeps its own slot in the hero and is
  // held by tutorialInviteVisible below until this queue drains.
  const firstVisitPrompts: FirstVisitPrompt[] = [];
  if (autoScoutNotice) firstVisitPrompts.push({ id: "scout-notice", node: autoScoutNotice });
  if (showTutorialInvite) {
    firstVisitPrompts.push({
      id: "tour-invite",
      node: <TutorialInvite onTakeTour={onTakeTour} onDismiss={onDismissInvite} />,
    });
  }
  // The read-aloud sheet entry is the age-profile host's (it owns the
  // prompt); the queue order here is unchanged — scout, tour, sheet.
  const readAloudEntry = readAloudPrefEntry(() => bumpPromptQueue((n) => n + 1));
  if (readAloudEntry) firstVisitPrompts.push(readAloudEntry);

  return (
    <>
    {mapModeAnnouncer}
    {challengeWelcomeEl}
    {/* While the grown-up gate/picker is open it is a full-viewport overlay:
        the home page underneath (incl. Comet's banner and the footer link)
        is inert — non-interactive and removed from the tab order. The
        ask-first age picker is the same class of overlay, so it makes
        the page inert the same way while it is up. The first-visit
        arrival modal (the read-aloud sheet) holds the page the same
        way; its layer renders through the queue's portal, outside
        this subtree, so going inert never traps the sheet itself. */}
    <div inert={ageSettingsOpen || ageAsk !== null || firstVisitModalOpen || undefined}>
    <main>
    <Choose
      key={historyResetEpoch}
      onState={withCardTap("State", () => setMenu({ kind: "states" }))}
      onCountry={withCardTap("Country", () => setMenu({ kind: "countries" }))}
      onGlobe={withCardTap("Globe", () => openRun("globe", "globe", "Globe", difficultyChoice))}
      onBegin={withCardTap("Globe", () => openRun("globe", "globe", "Globe", difficultyChoice))}
      onTakeTour={onTakeTour}
      onLoop={withCardTap("mystery", () => {
        // Ask-first (owner decision, 2026-11-14): the card is the
        // resume offer while a mystery is mid-play, and a resume is
        // a case start — with no band set the age picker answers
        // first and the tap-in runs off the pick. A fresh deal (no
        // mystery in progress) is a main-game loop start, the class
        // the store's no-profile default was decided for, and is
        // not gated here.
        if (peekLoopProgress().inProgress) {
          askAgeFirst(() => {
            openGeoDetective();
          });
        } else {
          openGeoDetective();
        }
      })}
      onColdTrail={withCardTap("coldtrail", () => { writeColdTrailOpen(true); setColdTrailOpen(true); })}      onReview={startReview}
      challengeEnabled={friendChallengesOn}
      whyLearnEnabled
      onWhyLearn={withCardTap("why-learn", () => {
        // Ask-first (owner decision, 2026-11-14), contained in the
        // Why Learn workflow (Radhae, voice call 2026-11-15): the
        // picker opens directly — its page carries the band ask
        // itself (AgeBandControl's pills while no band is set),
        // and no case can start from that page until a band is
        // picked. The modal ask above still guards the paths that
        // bypass the page ("Resume your case").
        setSubjectsOpen(true);
      })}
      onChallenge={withCardTap("challenge", openChallengePicker)}
      onResetHistory={handleResetHistory}
      deck={deckStatus}
      difficultyChoice={difficultyChoice}
      onDifficultyChoice={setDifficultyChoice}
      tutorialInvite={
        firstVisitPrompts.length > 0 ? (
          // Round 2 (Q1, owner-ruled): prompts overlay below the
          // header instead of rendering in-flow above it, where
          // they pushed the header down the page. placement="flow"
          // restores the old in-flow render in one line.
          <FirstVisitQueue prompts={firstVisitPrompts} seenKey={FIRST_VISIT_QUEUE_KEY} placement="overlay" onModalChange={setFirstVisitModalOpen} />
        ) : null
      }
      tutorialInviteVisible={firstVisitPrompts.length > 0}
      suppressGreeting={!bootQualified}
      ageBand={ageBand}
      onGrownUpOpen={openAgeSettings}
      headingRef={homeHeadingRef}
      mapModeControl={
        // Block C: the map-mode control lives on Home as a single unified
        // pill button showing both the Layers icon and current mode label.
        <MapModeToggle context="home" mapMode={mapMode} onSelect={handleHomeMapMode} />
      }
      lockedLoop={lockedLoop}
      footerLead={readAloudPrefSettings}
      heroMountainUrl={heroMountainUrl}
      cardMedia={{
        geodetectiveFilm: GEODETECTIVE_FILM,
        grownupsFilm: GROWNUPS_FILM,
        journalFilm: JOURNAL_FILM,
        coldtrailMediaForBand,
        reviewMediaForBand,
        whyLearnMediaForBand,
      }}
      earnedBadgeRow={<EarnedBadgeRow />}
      notice={
        <>
          {challengeBootNoticeEl}
          {mapSwitchedNotice}
          {discardedNoticeAnnouncer}
          {discardedNoticeEl}
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
              onClick={dismissChunkReloadNotice}
            >
              ✕
            </button>
          </div>
        ) : null
      }
    />
    </main>
    </div>
    {ageSettingsOpen ? (
      <Suspense fallback={null}>
        <MapErrorBoundary surface="Age settings">
          {ageSettings(run !== null || loopOpen)}
        </MapErrorBoundary>
      </Suspense>
    ) : null}
    {ageAskOverlay}
    {ageToastNode}
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

/**
 * End of a review session: the due queue is exhausted. Bounded and
 * completable by design (ADHD-friendly). Cards answered correctly come
 * back later — further out every time; missed cards are due again right
 * away, so a quick retry is always one tap away from the picker.
 */
/**
 * The mc2 welcome card (Package A): shown on Home after a challenge
 * link validates, BEFORE anything is displaced. It states the route
 * (places + region), the circle, the fairness line, and — when the
 * player has a game in progress — that their game is saved and waiting.
 * One action: Start. The displacement commits on that tap, never on
 * the link's arrival (manifest C6).
 */

