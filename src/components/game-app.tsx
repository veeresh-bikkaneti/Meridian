import { BRAND } from "@/game/brand";
import { distanceKm, formatDistance } from "@/game/geo";
import { isHit, radiusKm } from "@/game/radius";
import { placesFor, poolSizeFor } from "@/game/generated-places";
import { isNewBuildDeployed } from "@/game/build-staleness";
import { preloadAdmin1Boundaries, preloadAdmin1ForCountry, admin1ChunkIso2ForRegion } from "@/game/reverse-geocode";
import {
  clearRunAfterUncleanShutdown,
  handlePageHide,
  isUncleanShutdown,
  stampCleanExitDirty,
} from "@/game/clean-exit";
import type { Starter } from "@/game/starters";
import { ADMIN1_BY_COUNTRY, COUNTRIES, greaterSideKm, type Region, type RegionBounds } from "@/game/regions";
import { rewriteStory } from "@/game/rewrite";
import { shouldFireAiStory } from "@/game/story-ai";
import { backfillDifficultyChoice, continueRun, dropPin, endRun, isResumable, resumeRun, startRun, type Edition, type Run, type RunPhase, type PlaceResult } from "@/game/run";
import { filterByTier, isPickerDifficulty, type PickerDifficulty } from "@/game/tier-filter";
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
import { scorePlace, type ScoredPlace } from "@/game/scoring";
import { createDealer, poolForNewRun, seenStoreFor, mintSeed, wasClearedCelebrated, markClearedCelebrated, clearClearedMark, memorySeenStore, isBandCleared } from "@/game/trail";
import { resolveRunPool } from "@/game/pool";
import type { MapMark, MapVariation } from "@/map/satellite-map";
import { MapErrorBoundary } from "./map-error-boundary";
import { Compass, Flag, Globe2, MapPin } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { QuestionBubble, type BubbleViewState } from "./question-bubble";
import { ResultCard } from "./result-card";
import { RunSummaryCard } from "./run-summary";
import { ClearedCelebrationDialog, type ClearedInfo } from "./cleared-celebration";
import {
  buildCollisionCounts,
  buildQuestionLabel,
  hasNameCollision,
} from "@/game/question-label";
import {
  REVEAL_WATCHDOG_MS,
  shouldArmRevealWatchdog,
} from "./reveal-watchdog";
import { isEnabled, loadFlags } from "@/lib/flags";
import {
  TUTORIAL_EDITION,
  TUTORIAL_PLACE_ID,
  TUTORIAL_REGION_ID,
  TUTORIAL_REGION_NAME,
  hasSeenTutorial,
  isTutorialRunPool,
  markTutorialSeen,
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
import { LoopScreen } from "@/game/loop/LoopScreen";
import { readLoopOpen, writeLoopOpen, peekLoopProgress } from "@/game/loop/store";
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

/**
 * A review-deck session is a Run with this regionId (typed edition "globe")
 * so the PlayLoaded game loop is reused instead of forked. Every
 * review-specific branch keys off this predicate. Review runs never consult
 * the no-repeat history of real regions and never bank into the session —
 * review is practice, not scoring.
 */
function isReviewRun(run: Run): boolean {
  return run.regionId === REVIEW_DECK_REGION_ID;
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
const SatelliteMap = lazy(() => import("@/map/satellite-map"));

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

function readRun(): Run | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(RUN_KEY);
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
    };
  } catch {
    return null;
  }
}

function writeRun(run: Run) {
  try {
    sessionStorage.setItem(RUN_KEY, JSON.stringify(run));
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
 * Review-deck entry status for the edition picker. Gated on the
 * `learningOutcomes` flag like the other growth surfaces: flag off = no
 * deck entry at all (the deck only populates while the flag is on). Re-read
 * whenever the app returns to the picker (`run` → null): a review session
 * reschedules cards and a normal game adds misses, so a boot-time snapshot
 * would go stale — and a stale "N cards due" with an empty queue would make
 * "Start review" silently no-op.
 */
function useDeckStatus(run: Run | null): { enabled: boolean; due: number; total: number } {
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
  }, [onPicker]);
  return status;
}

export function GameApp() {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  // GeoDetective mounts its own screen outside the endless-run state
  // machine; it persists under meridian.loop.v2 and never touches the
  // run/drop keys. The open flag (meridian.loop.open) restores the screen
  // after a reload so a mid-game refresh resumes the mystery, not the menu.
  const [loopOpen, setLoopOpen] = useState<boolean>(() => readLoopOpen());
  // Cleared-mode celebration: set when a difficulty band's full cycle is
  // celebrated (primary onContinue trigger or the run-start backstop). The
  // dialog renders over the current screen; dismissing returns the player
  // to exactly where they were.
  const [cleared, setCleared] = useState<ClearedInfo | null>(null);
  // Difficulty picker: one choice applies across Globe → Country → State and
  // survives edition switches. Persisted so it survives reloads too.
  const [difficultyChoice, setDifficultyChoiceState] = useState<PickerDifficulty>(readDifficultyChoice);
  const setDifficultyChoice = useCallback((choice: PickerDifficulty) => {
    setDifficultyChoiceState(choice);
    writeDifficultyChoice(choice);
  }, []);
  // Region-selection async boundary: the GeoNames chunk(s) for the chosen
  // region load here — whole-country runs fetch every subdivision chunk —
  // before any run exists. `starting` shows the loading
  // state; `startError` is fail-closed — the run is never started when the
  // chunk cannot be loaded, and the player stays on the menu. When the tab
  // is stale (a deploy replaced its hashed chunks), the notice becomes a
  // one-tap refresh prompt instead of a dead end.
  const [starting, setStarting] = useState<{ regionName: string } | null>(null);
  const [startError, setStartError] = useState<{ message: string; staleBuild: boolean } | null>(null);
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

  /** Idle kill: end the session and return the player to the home screen. */
  const killIdleSession = useCallback(() => {
    clearDrop();
    try {
      sessionStorage.removeItem(RUN_KEY);
    } catch {
      // Storage blocked; the in-memory run is dropped below regardless.
    }
    setRun(null);
    setMenu(null);
    setTutorial(null);
    replaceSession(null);
    setIdleWarn(false);
    setIdleEndedNote(true);
  }, [replaceSession]);

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
      setReady(true);
      return;
    }
    const saved = readRun();
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
        commit(restored);
        ensureSession(restored);
      }
    }
    setReady(true);
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
      setStarting({ regionName });
      setStartError(null);
      try {
        // The region's chunk(s) load here — never eagerly, never partial.
        const places = await placesFor(edition, regionId);
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
          const banded = filterByTier(places, choice);
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
        setStartError({ message, staleBuild });
      } finally {
        setStarting(null);
      }
    },
    [commit, ensureSession],
  );

  // Review-deck status for the picker entry (flag-gated; re-read whenever
  // the app returns to the picker — see useDeckStatus).
  const deckStatus = useDeckStatus(run);

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
  const endTutorial = useCallback(() => {
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
      updateSession((prev) => {
        // Sessions are date-scoped like runs: a UTC-midnight rollover starts
        // a fresh session rather than silently dropping banks into a stale one.
        if (!prev || prev.ended) return prev;
        const base = prev.dateKey === dateKey ? prev : startSession(dateKey, Date.now());
        return bankPlace(base, input);
      });
    },
    [updateSession],
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

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-end px-5 py-10">
        <p className="text-sm tracking-wide text-muted uppercase">Daily geography</p>
        <h1 className="mt-2 font-display text-5xl text-fg">{BRAND.name}</h1>
      </main>
    );
  }

  if (run) {
    return (
      <>
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
            clearDrop();
            setRun(null);
            setMenu(null);
          }}
          onSummaryDone={() => {
            // End game already ended the session; drop it and go home.
            clearDrop();
            setRun(null);
            setMenu(null);
            replaceSession(null);
          }}
          onReplayed={() => {
            // Play again after End game: the old session ended with the
            // summary, so the replay starts a brand-new session.
            replaceSession(startSession(trailDate(), Date.now()));
          }}
          onReviewDeck={handleReviewDeck}
          onCleared={(info) => setCleared(info)}
          celebrationOpen={cleared !== null}
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
              setCleared(null);
              clearDrop();
              setRun(null);
              setMenu(null);
            }}
          />
        ) : null}
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
        <LoopScreen onLeave={() => { writeLoopOpen(false); setLoopOpen(false); }} />
        {idleToast}
      </>
    );
  }

  // Chunk loading state: the region's places are being fetched. The menu is
  // replaced (no double-taps) until the load resolves or fails closed.
  if (starting) {
    return (
      <>
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
        <p className="text-sm tracking-wide text-muted uppercase">Loading places</p>
        <h1 className="mt-2 font-display text-4xl text-fg">{starting.regionName}</h1>
        <p className="mt-4 max-w-md text-lg text-muted" role="status">
          Fetching this region&rsquo;s places&hellip;
        </p>
      </main>
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
      <p role="alert" className="mb-4 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
        {startError.message} Please try again.
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

  if (menu?.kind === "countries") {
    // Only countries with a playable pool — never a dead end.
    const regions = COUNTRIES.filter((country) => poolSizeFor("country", country.id) > 0);
    return (
      <>
      <RegionList
        title="Country"
        subtitle="Play a country whole — or drill into its states where available."
        regions={regions}
        notice={loadNotice}
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
      <RegionList
        title="State"
        subtitle="Choose a country, then one of its states."
        regions={regions}
        onBack={() => setMenu(null)}
        onChoose={(region) =>
          setMenu({ kind: "admin1", countryId: region.id, countryName: region.name, from: "states" })
        }
      />
      {idleToast}
      </>
    );
  }

  if (menu?.kind === "admin1") {
    const regions = ADMIN1_BY_COUNTRY[menu.countryId] ?? [];
    return (
      <>
      <RegionList
        title={menu.countryName}
        subtitle={`Play the whole ${menu.countryName}, or pick a state.`}
        regions={regions}
        notice={loadNotice}
        headerAction={{
          label: `Play entire ${menu.countryName}`,
          onClick: () => openRun("country", menu.countryId, menu.countryName, difficultyChoice),
        }}
        onBack={() => setMenu({ kind: menu.from })}
        onChoose={(region) => openRun("state", region.id, region.name, difficultyChoice)}
      />
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
    <Choose
      onState={() => setMenu({ kind: "states" })}
      onCountry={() => setMenu({ kind: "countries" })}
      onGlobe={() => openRun("globe", "globe", "Globe", difficultyChoice)}
      onLoop={() => { writeLoopOpen(true); setLoopOpen(true); }}
      onReview={startReview}
      deck={deckStatus}
      difficultyChoice={difficultyChoice}
      onDifficultyChoice={setDifficultyChoice}
      tutorialInvite={
        showTutorialInvite ? (
          <TutorialInvite onTakeTour={onTakeTour} onDismiss={onDismissInvite} />
        ) : null
      }
      notice={
        <>
          {idleNotice}
          {loadNotice}
        </>
      }
    />
    {idleToast}
    </>
  );
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
  onLoop,
  onReview,
  deck,
  notice,
  difficultyChoice,
  onDifficultyChoice,
  tutorialInvite,
}: {
  onState: () => void;
  onCountry: () => void;
  onGlobe: () => void;
  /** Open the GeoDetective edition (unlimited mysteries). */
  onLoop: () => void;
  /** Start a review session over the due deck cards. */
  onReview: () => void;
  /** Deck entry status (flag-gated; see useDeckStatus). */
  deck: { enabled: boolean; due: number; total: number };
  notice?: ReactNode;
  difficultyChoice: PickerDifficulty;
  onDifficultyChoice: (choice: PickerDifficulty) => void;
  tutorialInvite?: ReactNode;
}) {
  // GeoDetective progress for the edition card: the resume variant and the
  // streak line. Read on mount (the menu remounts when the loop screen
  // closes, so this is always fresh on return).
  const [loopProgress] = useState(() => peekLoopProgress());
  // Stagger order for the orchestrated entrance (110ms steps in CSS).
  const rise = (d: number) => ({ "--d": d }) as CSSProperties;
  return (
    <main className="atlas-home mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 py-8">
      <AtlasBackdrop />
      {notice}
      {tutorialInvite}
      <header>
        <p className="atlas-eyebrow home-rise" style={rise(0)}>
          <Compass className="size-4" aria-hidden="true" />
          Field atlas · {trailDate()} UTC
        </p>
        <h1 className="atlas-title home-rise mt-4" style={rise(1)}>
          {BRAND.name}
        </h1>
        <p className="atlas-tagline home-rise mt-4" style={rise(2)}>
          Pick the globe, a country, or a state. A place name, then one pin. Your score keeps
          adding up across editions until you choose to end the game, or if you&rsquo;re idle for
          2 minutes.
        </p>
        <div className="home-rise mt-7" style={rise(3)}>
          <p id="difficulty-label" className="atlas-difficulty-label">
            How do you want to grow your map today?
          </p>
          <div role="group" aria-labelledby="difficulty-label" className="atlas-seg mt-3">
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
                  onClick={() => onDifficultyChoice(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="atlas-hint" aria-live="polite">
            {DIFFICULTY_HINTS[difficultyChoice]}
          </p>
        </div>
        <div className="atlas-rule home-rise" style={rise(3)} aria-hidden="true" />
      </header>
      {/* GeoDetective leads: the flagship case file, unlimited mysteries. */}
      <section
        aria-labelledby="geodetective-title"
        className="atlas-dossier home-rise mt-8"
        style={rise(4)}
      >
        <span className="atlas-stamp" style={rise(4)} aria-hidden="true">
          Open
        </span>
        <p className="atlas-eyebrow">Case file · Unlimited</p>
        <h2 id="geodetective-title" className="atlas-dossier-title">
          GeoDetective
        </h2>
        <p className="atlas-dossier-detail">
          Five guesses, one mystery place. Each guess unlocks a clue — solve as many cases as
          you can.
        </p>
        {loopProgress.streak > 0 ? (
          <p className="atlas-streak">🔥 Streak: {loopProgress.streak}</p>
        ) : null}
        <button
          type="button"
          className="atlas-btn atlas-btn-brass mt-5"
          onClick={onLoop}
        >
          {loopProgress.inProgress ? "▶️ Resume your case" : "🔎 Solve a mystery"}
        </button>
      </section>
      <div className="home-rise mt-10" style={rise(5)}>
        <p className="atlas-eyebrow">Choose your expedition</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <EditionCard
            index="01"
            icon={<MapPin className="size-6" aria-hidden="true" />}
            title="State"
            detail="Pick a country, then one of its states. Each state is its own run."
            action="Choose a state"
            onClick={onState}
          />
          <EditionCard
            index="02"
            icon={<Flag className="size-6" aria-hidden="true" />}
            title="Country"
            detail="Play a country whole, or drill into its states where available."
            action="Choose a country"
            onClick={onCountry}
          />
          <EditionCard
            index="03"
            icon={<Globe2 className="size-6" aria-hidden="true" />}
            title="Globe"
            detail="The whole earth. Continent outlines at a distance, countries as you close in."
            action="Play the globe"
            onClick={onGlobe}
          />
        </div>
      </div>
      {deck.enabled ? (
        <section
          aria-label={REVIEW_DECK_COPY.pickerTitle}
          className="atlas-fieldnotes home-rise mt-8"
          style={rise(6)}
        >
          <h2 className="atlas-fieldnotes-title">{REVIEW_DECK_COPY.pickerTitle}</h2>
          {deck.due > 0 ? (
            <>
              <p className="mt-2 text-sm">{REVIEW_DECK_COPY.pickerDueLine}</p>
              <p className="mt-1 text-sm font-medium" data-testid="deck-due-count">
                {deck.due} {deck.due === 1 ? "card" : "cards"} due
              </p>
              <button
                type="button"
                className="atlas-btn atlas-btn-line mt-4"
                onClick={onReview}
              >
                {REVIEW_DECK_COPY.startReview}
              </button>
            </>
          ) : deck.total > 0 ? (
            <p className="mt-2 text-sm">{REVIEW_DECK_COPY.pickerCaughtUp}</p>
          ) : (
            <p className="mt-2 text-sm">{REVIEW_DECK_COPY.pickerEmpty}</p>
          )}
        </section>
      ) : null}
    </main>
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

function EditionCard({
  index,
  icon,
  title,
  detail,
  action,
  onClick,
}: {
  /** Mono expedition number, e.g. "01". */
  index: string;
  /** Brass line icon. */
  icon: ReactNode;
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="atlas-card">
      <p className="atlas-card-index">N° {index}</p>
      <div className="atlas-card-icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="atlas-card-title">{title}</h2>
      <p className="atlas-card-detail">{detail}</p>
      <button type="button" className="atlas-btn atlas-btn-line mt-4 w-full" onClick={onClick}>
        {action}
      </button>
    </article>
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
}: {
  results: PlaceResult[];
  total: number;
  onDone: () => void;
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
      <div className="mt-6">
        <Button onClick={onDone}>{REVIEW_DECK_COPY.backToEditions}</Button>
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
  onSummaryDone,
  onReplayed,
  onReviewDeck,
  onCleared,
  celebrationOpen,
  tutorial,
  onTutorialAdvance,
  onTutorialEnd,
}: {
  run: Run;
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
  /** Ends the session and returns its summary (null when there is no session). */
  onEndGame: () => SessionSummary | null;
  /** Back to the edition picker mid-run; the session stays alive. */
  onEditions: () => void;
  /** Summary dismissed after End game; the session is already ended. */
  onSummaryDone: () => void;
  /** A fresh run started via Play again; starts a fresh session. */
  onReplayed: (run: Run) => void;
  /** "Review my misses" from the end-game summary. */
  onReviewDeck: () => void;
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
}) {
  const [places, setPlaces] = useState<Starter[] | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  // Review sessions: the due deck entries in session order (the poolIds
  // order). Null for normal runs.
  const [reviewEntries, setReviewEntries] = useState<DeckEntry[] | null>(null);
  const review = isReviewRun(run);

  useEffect(() => {
    let cancelled = false;
    setPlaces(null);
    setPoolError(null);
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
          setPlaces(entries.map(deckStarter));
        }
      } catch {
        if (!cancelled) setPoolError("Could not load your review deck.");
      }
      return () => {
        cancelled = true;
      };
    }
    placesFor(run.edition, run.regionId).then(
      (loaded) => {
        if (!cancelled) setPlaces(loaded);
      },
      (err: unknown) => {
        if (!cancelled) {
          setPoolError(err instanceof Error ? err.message : String(err));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [run.edition, run.regionId]);

  if (poolError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
        <p className="text-sm tracking-wide text-muted uppercase">Couldn&rsquo;t load places</p>
        <h1 className="mt-2 font-display text-4xl text-fg">{run.regionName}</h1>
        <p role="alert" className="mt-4 max-w-md text-lg text-muted">
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
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-8">
        <p className="text-sm tracking-wide text-muted uppercase">Loading places</p>
        <h1 className="mt-2 font-display text-4xl text-fg">{run.regionName}</h1>
        <p className="mt-4 max-w-md text-lg text-muted" role="status">
          Fetching this region&rsquo;s places&hellip;
        </p>
      </main>
    );
  }

  return (
    <PlayLoaded
      run={run}
      places={places}
      session={session}
      onRun={onRun}
      onBankPlace={onBankPlace}
      onEndGame={onEndGame}
      onEditions={onEditions}
      onSummaryDone={onSummaryDone}
      onReplayed={onReplayed}
      onReviewDeck={onReviewDeck}
      onCleared={onCleared}
      celebrationOpen={celebrationOpen}
      reviewEntries={reviewEntries}
      tutorial={tutorial}
      onTutorialAdvance={onTutorialAdvance}
      onTutorialEnd={onTutorialEnd}
    />
  );
}

function PlayLoaded({
  run,
  places,
  session,
  onRun,
  onBankPlace,
  onEndGame: requestEndGame,
  onEditions,
  onSummaryDone: finishSummary,
  onReplayed,
  onReviewDeck,
  onCleared,
  celebrationOpen,
  reviewEntries,
  tutorial,
  onTutorialAdvance,
  onTutorialEnd,
}: {
  run: Run;
  places: Starter[];
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
  onSummaryDone: () => void;
  onReplayed: (run: Run) => void;
  /** A difficulty band was just cleared: show the celebration dialog. */
  onCleared: (info: ClearedInfo) => void;
  /** "Review my misses" from the end-game summary. */
  onReviewDeck: () => void;
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
}) {
  // Review-deck session: a synthetic Run reusing this game loop. The deck
  // queue (due order) is the pool; review answers never bank into the
  // session and the cleared-mode celebration never fires here.
  const review = isReviewRun(run);
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
        seenStoreFor(run.edition, run.regionId, run.difficultyChoice),
        run.index,
        run.prevLastId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, run.seed, run.dateKey, run.edition, run.regionId, run.difficultyChoice, run.prevLastId],
  );
  const place = review ? pool[run.index] : dealer.at(run.index);
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
    if (review || tutorial) return;
    dealer.markDealtThrough(run.index);
  }, [dealer, review, run.index, tutorial]);
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
  const [story, setStory] = useState<string | null>(null);
  const [bubble, setBubble] = useState<BubbleViewState>("open");
  const [cardDismissed, setCardDismissed] = useState(false);
  // Gap-view reveal: the result card stays hidden until the map's reveal
  // reaches its end state (`reveal-done` → onRevealComplete). Reset per place.
  const [revealDone, setRevealDone] = useState(false);
  // Z3/Z4 zoom-space: replay remounts the map (fresh intro + fresh
  // controller). Replaying the same region must not reuse the old map
  // instance — its controller is terminal (revealDone) and its highlight
  // belongs to the previous run.
  const [mapKey, setMapKey] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  // Learning outcomes (flag-gated, observational). The store is read once
  // at boot after the shared flags load resolves; the boot-time flag value
  // is authoritative for the session (no mid-game surprises). Flag off =
  // no reads, no writes, no traces — dealing/scoring/session byte-identical.
  const [learningEnabled, setLearningEnabled] = useState(false);
  const [learningStore, setLearningStore] = useState<LearningStore | null>(null);
  useEffect(() => {
    let active = true;
    // Kill-switch-style track (writes persistent data): await the shared
    // load so a remote decision wins the boot-time race deterministically.
    loadFlags().then(() => {
      if (!active) return;
      const on = isEnabled("learningOutcomes");
      setLearningEnabled(on);
      if (on) setLearningStore(readLearningStore() ?? emptyLearningStore());
    });
    return () => {
      active = false;
    };
  }, []);
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
    setBubble("open");
    setCardDismissed(false);
  }, [place?.id]);

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
      setBubble((view) =>
        view === "dismissed" ? view : view === "collapsed" ? "open" : "collapsed",
      );
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [run.phase, aim, celebrationOpen]);

  useEffect(() => {
    // Review sessions: an exhausted queue (place undefined) renders the
    // review-complete screen — never the run "done" phase.
    if (review) return;
    if (place || run.phase === "done" || run.phase === "summary") return;
    onRun({ ...run, phase: "done" });
  }, [onRun, place, review, run]);

  useEffect(() => {
    if (run.phase !== "story" || !place) {
      setStory(null);
      return;
    }
    let cancel = false;
    const placeId = place.id;
    const authored = place.story;
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
      radiusKm: review
        ? (reviewEntry?.place.radiusKm ?? radiusKm("globe", 0))
        : run.edition === "globe"
          ? radiusKm("globe", 0)
          : radiusKm(run.edition, greaterSideKm(boundsFor(run))),
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
    const radius = review
      ? (reviewEntry?.place.radiusKm ?? radiusKm("globe", 0))
      : run.edition === "globe"
        ? radiusKm("globe", 0)
        : radiusKm(run.edition, greaterSideKm(boundsFor(run)));
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
    // totals and streaks.
    if (!tutorial && nextRun.results.length > bankedBefore) {
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
    if (!review && justAnswered && !wasClearedCelebrated(run.edition, run.regionId, run.difficultyChoice)) {
      // The band catalog is the unfiltered region catalog narrowed by the
      // run's difficulty band — the same filter the replay path uses.
      const bandCatalogIds = filterByTier(places, run.difficultyChoice).map(
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
  }

  function onEndGame() {
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
    onReplay();
  }

  // Play-again replay: the same resumeRun chain as openRun. A finished run
  // (phase "summary") always restarts via startRun with a fresh dealing seed,
  // so the replayed run opens on a different first question. Local state is
  // reset explicitly because the [place?.id] effect below only fires when the
  // dealt place actually changes.
  function onReplay() {
    setAim(null);
    setAimAnnouncement(null);
    setDrop(null);
    clearDrop();
    setBubble("open");
    setCardDismissed(false);
    setRevealDone(false);
    // Fresh map instance for the replayed run (see mapKey above).
    setMapKey((k) => k + 1);
    const replayDateKey = trailDate();
    // Play again replays under the SAME difficulty band the run started with:
    // the pool is re-filtered from run.difficultyChoice — never silently
    // widened back to the full catalog.
    const { poolIds: replayPoolIds, prevLastId: replayPrevLastId, cycleCompleted: replayCycleCompleted } = poolForRunStart(
      filterByTier(places ?? [], run.difficultyChoice),
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
    onRun(freshRun);
    // Play again after End game: the old session ended with the summary, so
    // the replay starts a brand-new session.
    onReplayed(freshRun);
  }

  // Review sessions replay each card's original question context: the map
  // reframes per card (the satellite-map effect remounts on edition/region/
  // bounds change, exactly like an edition switch in normal play).
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

  // Review session complete: the due queue is exhausted. A bounded,
  // completable session — ADHD-friendly — never the endless run.
  if (review && run.index >= pool.length) {
    return (
      <ReviewComplete results={run.results} total={pool.length} onDone={onEditions} />
    );
  }

  return (
    <main className="relative h-dvh bg-bg">
      <div className="absolute inset-0">
        <MapErrorBoundary>
          <Suspense fallback={<MapLoadingFallback />}>
            <SatelliteMap
              key={mapKey}
              mode={mode}
              edition={mapEdition}
              regionName={mapRegionName}
              bounds={bounds}
              onAim={onAim}
              onConfirm={onConfirm}
              onClearAim={onClearAim}
              marks={marks}
              variation={variation}
              spot={place ? { lon: place.lon, lat: place.lat } : null}
              onRevealComplete={() => setRevealDone(true)}
            />
          </Suspense>
        </MapErrorBoundary>
        <div className="pointer-events-none absolute top-3 right-3 left-3 z-30 flex items-start justify-between gap-3">
          <Button variant="secondary" className="pointer-events-auto" onClick={onEditions}>
            {review ? REVIEW_DECK_COPY.exitReview : "Editions"}
          </Button>
          {review ? (
            <p
              data-testid="review-progress"
              className="pointer-events-auto rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-fg"
            >
              {REVIEW_DECK_COPY.progressOf} {Math.min(run.index + 1, pool.length)} of{" "}
              {pool.length}
            </p>
          ) : (
          <div className="flex flex-col items-end gap-2">
            <div className="relative">
              <button
                type="button"
                data-testid="score-total"
                aria-expanded={showBreakdown}
                aria-controls="session-score-breakdown"
                aria-label={`Session score ${sessionTotal.toLocaleString("en-US")}. Toggle score breakdown by edition and difficulty.`}
                onClick={() => setShowBreakdown((v) => !v)}
                className="pointer-events-auto rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold tabular-nums text-fg"
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
            {run.streak >= 2 ? (
              // The flame celebrates the LIVE streak in this run (each
              // edition is a fresh run with its own combo); the summary's
              // "best streak" is session-wide and may come from another
              // edition. Both labels are honest about what they measure.
              <p
                data-testid="streak-flame"
                className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm tabular-nums text-fg"
              >
                <span role="img" aria-label={`${run.streak}-place streak`}>
                  🔥
                </span>{" "}
                {run.streak}
              </p>
            ) : null}
            <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg">
              {/* Session-scoped places (not this run's): switching editions
                  no longer drops the counter back to 0. */}
              {session?.hits ?? run.hits} placed
            </p>
            {run.phase !== "summary" ? (
              <button
                type="button"
                onClick={onEndGame}
                className="pointer-events-auto rounded-md border border-white/10 bg-[rgba(10,12,16,0.72)] px-3 py-1.5 text-xs text-white/70 backdrop-blur-[14px] transition-colors hover:text-white"
              >
                End game
              </button>
            ) : null}
          </div>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {run.phase === "aim"
          ? (aimAnnouncement ?? (place ? `Find ${questionLabel}.` : null))
          : run.phase === "story" && place && revealDone
            ? `Pin dropped. ${drop ? formatDistance(drop.distanceKm) : "Hit"}. ${questionLabel}.${drop?.breakdown ? ` +${drop.breakdown.score} points.` : ""}`
            : run.phase === "story" && place
              ? "Showing the answer."
              : run.phase === "summary" && summary
                ? `Game over. ${summary.placesPlayed} places, ${summary.hits} hits, total score ${summary.totalScore.toLocaleString("en-US")} — ${summary.byEdition
                    .map((b) => `${EDITION_LABELS[b.edition]} ${b.score.toLocaleString("en-US")}`)
                    .join(", ")}. Average ${summary.averagePerPlace} per place, best streak ${summary.bestStreak}.`
                : place
                  ? `Pin dropped.${drop ? ` ${formatDistance(drop.distanceKm)}.` : ""} ${questionLabel} missed.`
                  : `${run.regionName} finished.`}
      </p>
      {run.phase === "aim" && place ? (
        <QuestionBubble
          edition={mapEdition}
          regionName={mapRegionName}
          placeName={questionLabel}
          difficulty={place.difficulty}
          hasPin={aim !== null}
          view={bubble}
          onViewChange={setBubble}
        />
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
          onContinue={tutorial ? onTutorialCardAdvance : onContinue}
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
        />
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
        />
      ) : null}
    </main>
  );
}
