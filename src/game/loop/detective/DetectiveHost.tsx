/**
 * DetectiveHost.tsx — the signal/observer wiring around the pure
 * detective state machine (U5). Senior Mechanics Engineer pattern: the
 * machine (detective-state.ts) owns every decision; this host owns only
 * the environment — the speech player, dwell timers, pointer listeners,
 * DOM anchoring — and renders exactly the machine's view.
 *
 * Data discipline: the host receives ONLY the whitelisted props
 * (detective-host-props.ts) and translates prop CHANGES into machine
 * events. It never sees the puzzle, the clue file, a target, or an
 * evaluation — answer-blindness holds here by construction.
 *
 * Performance discipline: no per-frame work. Pointermove writes to a
 * ref; the pause check is a single timeout, not a rAF loop. Station
 * anchoring measures the clue card's rect on discrete changes (clue,
 * phase, resize, scroll) — never per frame. All animation is the rigs'
 * CSS (transform/opacity only).
 *
 * Stations:
 * - Watson's station is beside the ACTIVE clue card: the host anchors a
 *   fixed cluster to that card element's measured rect (the card whose
 *   aria-label names the latest revealed clue).
 * - Holmes's station is beside Watson during clue phases (same cluster).
 * - During guessing phases the pair renders through a portal INTO the
 *   map container ([data-testid="loop-map"], the stable element LoopMap
 *   already renders): Watson in the bottom-left dock cluster (12 px
 *   inset, clear of the sheet safe area), Holmes on his own transform
 *   wrapper at the dock — the U6 waypoint companion walks that wrapper
 *   to a berth beside the player's thinking pause (companion.ts owns
 *   the pause detection, berth geometry, and auto-kill decisions).
 *   Portal target missing → the map cluster is not rendered (never
 *   overlap blindly).
 * - When the machine's view says hidden (sheet open / external speech /
 *   ring animation / OFF), nothing renders at all — absence is an
 *   unmount, so it lands in 0 ms, under the 100 ms ceiling.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { CELEBRATE_LAYOUT, HolmesRig, WatsonRig } from "./DetectivePair";
import {
  initialDetectiveState,
  transition,
  viewForState,
  type DetectiveEffect,
  type DetectiveEvent,
  type DetectiveState,
  type DetectiveView,
} from "./detective-state";
import {
  createDetectiveSpeech,
  detectiveCanAutoPlay,
  type DetectiveSpeaker,
  type DetectiveSpeechPlayer,
} from "./detective-audio";
import {
  formatDegradation,
  readBatterySaver,
  readConnectionSignals,
  resolveDetectiveDegradation,
  watsonReplayCueVisible,
  REDUCED_MOTION_PAUSE_MS,
  type DetectiveDegradation,
} from "./detective-degradation";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { VolumeX } from "lucide-react";
import { SoundToggle } from "@/components/SoundToggle";
import {
  isSoundEnabled,
  onSoundChanged,
  setSoundEnabled,
} from "@/game/audio/sfx";
import type { DetectiveHostProps } from "./detective-host-props";
import {
  berthFor,
  createAutoKillTracker,
  createPauseDetector,
  type AutoKillTracker,
  type PauseDetector,
} from "./companion";
import "./detective.css";

export type { DetectiveHostProps };

/** Ring absence: the ring reveal plus its 1 s tail (council Q2 §8) —
 * the host times it; the machine only holds the flag. */
const RING_ABSENCE_MS = 2000;

/* -- waypoint companion constants (council Q2; logic in companion.ts) - */
/** Holmes's rendered box: the rig is 120×178 viewBox at 104 px tall. */
const HOLMES_BOX = { w: 70, h: 104 };
/** Dock inset from the map's bottom-left corner (Q2 §9). */
const DOCK_INSET = 12;
/** Watson's rendered box width at the shared 104 px figure height:
 * his rig is 134×140 viewBox, so 104 · 134/140 ≈ 99.5 — the
 * tap-Watson replay button is sized 100 px wide over his figure for
 * the same reason (detective.css). */
const WATSON_DOCK_W = 100;
/** Clear air between the two figures at the dock. */
const DOCK_GAP = 8;
/** Holmes's dock spot: BESIDE Watson, never behind him. The two used
 * to share one origin (both at DOCK_INSET), and Watson's wider box —
 * painted above Holmes's wrapper (dock z-index 5 vs auto) — hid
 * Holmes completely in every dock phase: the 2026-11-06 prod defect
 * ("Holmes and Watson is not in prod"). The berth solver receives
 * this same spot as its dock reference, so remote distances and
 * dock returns stay honest. */
const HOLMES_DOCK_X = DOCK_INSET + WATSON_DOCK_W + DOCK_GAP;
/** Walk speed: ~260 px/s, duration clamped 240–700 ms (Q2 §3). */
const WALK_PX_PER_S = 260;
const WALK_MIN_MS = 240;
const WALK_MAX_MS = 700;
/** Gesture exit to the dock: ~180 ms, accelerating ease-in (Q2 §6). */
const EXIT_MS = 180;
const EASE_OUT = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const EASE_IN = "cubic-bezier(0.55, 0.06, 0.68, 0.19)";
/** A move further than this from the pause point cancels a berth. */
const GESTURE_CANCEL_PX = 12;

type CompanionMode = "full" | "dock" | "killed";

/** Phases where the Listen button may show in tap speech mode (U9):
 * the clue phases (Watson reading / the thinking beat) and the
 * guessing phases that follow them. Endings, the case-open duet, and
 * the selection read itself never carry it. */
const LISTEN_PHASES: ReadonlySet<string> = new Set([
  "READING",
  "THINKING_BEAT",
  "SEARCH_IDLE",
  "SEARCH_AREA",
]);

interface StationAnchor {
  left: number;
  top: number;
}

export default function DetectiveHost(props: DetectiveHostProps): ReactElement | null {
  const { caseIndex, cluesRevealed, status, sheetOpen, lastGuessPlaceId, freshDeal, answerPlaceId } = props;

  /* -- machine instance: ref-held state, React state only for the view */
  const machineRef = useRef<DetectiveState>(initialDetectiveState());
  const [view, setView] = useState<DetectiveView>(() => viewForState(machineRef.current));
  const viewRef = useRef(view);
  viewRef.current = view;

  /* -- degradation (U9, §2.5): signals in, pure matrix decides --------
   * Reduced motion comes from the shared hook; Save-Data / memory are
   * probed once in the card-film pattern; the battery verdict arrives
   * async where getBattery exists (null = no signal); sound and the
   * player's autoplay verdict are re-read as they change (the 1 Hz
   * sound poll below keeps soundOn current). The matrix itself is
   * detective-degradation.ts — this block only gathers its inputs. */
  const reducedMotion = usePrefersReducedMotion();
  const [connSignals] = useState(readConnectionSignals);
  const [batterySaver, setBatterySaver] = useState<boolean | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  useEffect(() => {
    let live = true;
    void readBatterySaver((saver) => {
      if (live) setBatterySaver(saver);
    }).then((saver) => {
      if (live) setBatterySaver(saver);
    });
    return () => {
      live = false;
    };
  }, []);
  const degradation: DetectiveDegradation = resolveDetectiveDegradation({
    reducedMotion,
    saveData: connSignals.saveData,
    deviceMemory: connSignals.deviceMemory,
    batterySaver,
    soundOn,
    autoSpeechAllowed: detectiveCanAutoPlay(),
  });
  const degradationRef = useRef(degradation);
  degradationRef.current = degradation;
  const degradationAttr = formatDegradation(degradation);

  /* -- speech player -------------------------------------------------- */
  const [speakingWho, setSpeakingWho] = useState<DetectiveSpeaker | null>(null);
  const playerRef = useRef<DetectiveSpeechPlayer | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // dispatch/runEffect are plain per-render closures over refs (the
  // machine, player, and timers all live in refs, so a fresh closure is
  // always current); effects and listeners reach them via dispatchRef.
  const runEffect = (effect: DetectiveEffect) => {
    if (effect.type === "speak") {
      playerRef.current?.enqueue(effect.ref);
      return;
    }
    // dwell: the host owns the timer; the machine stays timer-free.
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null;
      dispatchRef.current({ type: "beatElapsed" });
    }, effect.beatMs);
  };
  const dispatch = (event: DetectiveEvent) => {
    const { state, view: nextView, effects } = transition(machineRef.current, event);
    machineRef.current = state;
    viewRef.current = nextView;
    setView(nextView);
    for (const effect of effects) runEffect(effect);
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  useEffect(() => {
    const player = createDetectiveSpeech({
      caseIndex,
      onSpeakingChange: (who) => {
        setSpeakingWho(who);
        if (who === null) dispatchRef.current({ type: "speechEnded" });
      },
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // Created once per host mount; case changes go through setCaseIndex.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sound toggle-off stops speech immediately (PR C, council Q6): the
  // host SUBSCRIBES to the sound module's change listeners —
  // setSoundEnabled notifies synchronously, so a mute from any surface
  // (the screen's SoundToggle, the pair chip below, or a tap on
  // Holmes) stops the current clip and flushes the queued pair lines
  // in the SAME event, through the player's stopAll (its currentStop
  // path). This replaces the old 1 Hz poll, which leaked up to a
  // second of speech after a mute tap. Unmute never resumes a stopped
  // line: stopAll cleared the queue and nothing re-enqueues it. The
  // same subscription keeps the degradation's soundOn input current
  // (U9) and drives the muted badge below.
  useEffect(() => {
    setSoundOn(isSoundEnabled());
    return onSoundChanged((on) => {
      setSoundOn(on);
      if (!on) playerRef.current?.stopAll();
    });
  }, []);

  // The player's speech mode follows the degradation (U9): in "tap"
  // mode its queue drains silently while holding the clue sequence;
  // in "off" it holds nothing; "auto" is the U5 behaviour.
  useEffect(() => {
    playerRef.current?.setSpeechMode(degradation.speechMode);
  }, [degradation.speechMode]);

  // Unmount: timers die with the host.
  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    };
  }, []);

  /* -- prop changes → machine events (the observer wiring) ------------ */

  // Case open / case change: reset the ladder and read the latest clue.
  const seenCaseRef = useRef<number | null>(null);
  useEffect(() => {
    if (seenCaseRef.current === caseIndex) return;
    seenCaseRef.current = caseIndex;
    // A new case restarts every prop-diff tracker, so an identical
    // first guess / status / clue count in the new case still fires.
    seenCluesRef.current = cluesRevealed;
    seenGuessRef.current = lastGuessPlaceId;
    seenStatusRef.current = status;
    seenSheetRef.current = sheetOpen;
    machineRef.current = initialDetectiveState();
    const fresh = viewForState(machineRef.current);
    viewRef.current = fresh;
    setView(fresh);
    playerRef.current?.stopAll();
    playerRef.current?.setCaseIndex(caseIndex);
    // Case open FIRST (U8): on a fresh deal the machine starts the
    // instruction duet; the clue below then pends behind it (the
    // machine's pending pattern) instead of racing it. A resumed case
    // skips the duet. freshDeal flips false after the first guess, but
    // the seenCase guard above makes this effect once-per-case, so the
    // value read here is the one from the case's first render.
    dispatch({ type: "caseOpened", freshDeal });
    if (cluesRevealed >= 1) {
      dispatch({ type: "clueUnlocked", clueIndex: cluesRevealed });
    }
    // cluesRevealed at case-open time is the starting rung; later
    // increments arrive through the clue effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIndex, freshDeal]);

  // The player's own latest pick → selection read. Ring absence timed
  // here. ORDER MATTERS: a guess commit changes lastGuessPlaceId and
  // cluesRevealed in the SAME render, and effects run in declaration
  // order — the guess must reach the machine FIRST, while it is still
  // in a SEARCH phase. The clue effect below then lands its
  // clueUnlocked inside SELECTION_READ, where the machine stores it as
  // the pending clue and bridges via ASK_NEXT. (Reversed, the clue
  // would start READING and the selection read would be swallowed.)
  const seenGuessRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastGuessPlaceId || lastGuessPlaceId === seenGuessRef.current) return;
    seenGuessRef.current = lastGuessPlaceId;
    dispatch({ type: "guessConfirmed", placeId: lastGuessPlaceId });
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    ringTimerRef.current = setTimeout(() => {
      ringTimerRef.current = null;
      dispatchRef.current({ type: "ringAnimationEnded" });
    }, RING_ABSENCE_MS);
  }, [lastGuessPlaceId, dispatch]);

  // New clue revealed mid-case (after a guess): remember it — the
  // machine bridges through the selection read + ASK_NEXT itself.
  const seenCluesRef = useRef(cluesRevealed);
  useEffect(() => {
    if (seenCluesRef.current === cluesRevealed) return;
    seenCluesRef.current = cluesRevealed;
    if (seenCaseRef.current !== caseIndex) return; // case effect owns it
    dispatch({ type: "clueUnlocked", clueIndex: cluesRevealed });
  }, [cluesRevealed, caseIndex, dispatch]);

  // Case endings, from the game's own status.
  const seenStatusRef = useRef(status);
  useEffect(() => {
    if (seenStatusRef.current === status) return;
    seenStatusRef.current = status;
    // The answer's id (U8) crosses only here, on the solve, and only
    // because the props builder already gated it to the post-solve
    // reveal (it is null unless status is "won" — the same commit that
    // flips status supplies it). The machine stores it for DEBRIEF
    // and reads it nowhere else.
    if (status === "won") dispatch({ type: "caseSolved", answerPlaceId });
    else if (status === "lost") dispatch({ type: "caseFailed" });
  }, [status, dispatch, answerPlaceId]);

  // Bottom sheet overlay flag.
  const seenSheetRef = useRef(sheetOpen);
  useEffect(() => {
    if (seenSheetRef.current === sheetOpen) return;
    seenSheetRef.current = sheetOpen;
    dispatch({ type: sheetOpen ? "sheetOpened" : "sheetClosed" });
  }, [sheetOpen, dispatch]);

  /* -- station anchoring: measure on discrete changes, never per frame  */
  const [anchor, setAnchor] = useState<StationAnchor | null>(null);
  const [mapEl, setMapEl] = useState<Element | null>(null);
  const mapElRef = useRef<Element | null>(null);
  /** Cached map container rect (client coords): measured HERE, on
   * resize / phase / clue changes only — the companion reads the
   * cache, never the layout, while the pointer moves (U6). */
  const mapRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const phase = view.phase;
  useEffect(() => {
    const measure = () => {
      const mapNode = document.querySelector('[data-testid="loop-map"]');
      setMapEl(mapNode);
      mapElRef.current = mapNode;
      if (mapNode) {
        const mr = mapNode.getBoundingClientRect();
        mapRectRef.current = { left: mr.left, top: mr.top, width: mr.width, height: mr.height };
      } else {
        mapRectRef.current = null;
      }
      // The ACTIVE clue card: the article whose aria-label names the
      // latest revealed clue ("Clue 4: The Hook").
      const card = document.querySelector(
        `article[aria-label^="Clue ${cluesRevealed}:"]`,
      );
      if (card) {
        const rect = card.getBoundingClientRect();
        setAnchor({ left: rect.left, top: rect.top });
      } else {
        setAnchor(null);
      }
    };
    measure();
    /* NOTE (prod-pair fix): a deferred +350 ms re-measure for slow-
     * load anchor staleness (diagnosis RC3) was tried here and
     * REMOVED before merge. Early bisection against the companion
     * E2E (K3 pan-cancels-a-berth) implicated the extra pass. Both
     * builds fail K3-pan in loaded batches, but with different
     * signatures, and the cured build's failure cause is unproven
     * (a mid-pause auto-kill and confirm-chain starvation cannot be
     * separated in the surviving logs) — so the re-measure's guilt
     * is unproven too. A defect cure does not ship an unproven
     * third change: RC3 is self-healing in play (scroll, resize,
     * and the next phase change all re-measure) and ships as a
     * documented follow-up. See BRANCH_STATUS.md. */
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [cluesRevealed, phase, status]);

  /* -- the reading moment comes to the player (prod-pair fix, RC2) --
   * On the shipped layout the clue cards render BELOW the map, past a
   * tall header: at phone and desktop widths alike, the station (and
   * the dock) start below the viewport fold, so the case-open duet
   * and every clue read played off-screen — the pair read as "not in
   * prod" until the player happened to scroll. On entering a clue
   * phase (case open, and each clue's read) bring the ACTIVE card
   * into view once: the station is glued above it, so the pair comes
   * on screen together with the words being read. One scroll per
   * phase entry (keyed, so re-renders never repeat it); search
   * phases never scroll — the map is the player's own ground there. */
  const readingScrollKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "CASE_OPEN" && phase !== "READING") return;
    const key = `${caseIndex}:${cluesRevealed}:${phase}`;
    if (readingScrollKeyRef.current === key) return;
    readingScrollKeyRef.current = key;
    const card = document.querySelector(
      `article[aria-label^="Clue ${cluesRevealed}:"]`,
    );
    if (!card) return;
    /* Scroll the minimum so the card AND the station above it are in
     * view. The distance is computed by hand instead of
     * scrollIntoView({ block: "nearest" }): engines without the
     * options dictionary (Safari ≤15.3 — the dictionary shipped in
     * 15.4) coerce the object to the boolean align-to-top form,
     * which would park the card at the viewport top and the station,
     * glued above it, off-screen again — the very defect being
     * cured, on exactly the older tablets kids use. The numeric
     * scrollBy form works everywhere; smoothness is layered on only
     * where the engine advertises it. */
    const rect = card.getBoundingClientRect();
    /** The station's 104 px + a breath of air above the card. */
    const STATION_CLEARANCE_PX = 116;
    let dy = 0;
    if (rect.top < STATION_CLEARANCE_PX) {
      dy = rect.top - STATION_CLEARANCE_PX;
    } else if (rect.bottom > window.innerHeight) {
      dy = rect.bottom - window.innerHeight + 8;
    }
    if (dy === 0) return;
    const smooth =
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      "scrollBehavior" in document.documentElement.style;
    if (smooth) window.scrollBy({ top: dy, behavior: "smooth" });
    else window.scrollBy(0, dy);
  }, [phase, cluesRevealed, caseIndex]);

  /* -- waypoint companion (U6) -----------------------------------------
   * Performance shape (council Q2 §10): ONE passive listener set on
   * the map container; samples land in refs; the pause check is a
   * timeout chain (a still pointer emits no events to react to), never
   * a rAF loop and never React state per pointermove. The map rect is
   * cached by the measure effect (resize / phase change only) — no
   * per-frame getBoundingClientRect. Holmes moves by translate3d on
   * his portal wrapper, transition-driven: zero per-frame writes.
   * All decisions live in companion.ts (pure); this section is only
   * the environment wiring around it. */
  const detectorRef = useRef<PauseDetector | null>(null);
  if (!detectorRef.current) detectorRef.current = createPauseDetector();
  const killRef = useRef<AutoKillTracker | null>(null);
  if (!killRef.current) killRef.current = createAutoKillTracker();
  const [companionMode, setCompanionMode] = useState<CompanionMode>("full");
  const companionModeRef = useRef(companionMode);
  companionModeRef.current = companionMode;
  /** Auto-kill is latched for the session: once killed, a degradation
   * change must never resurrect the companion (U6). */
  const companionKilledRef = useRef(false);
  /* Degradation → companion (U9): dock-only means berth resolutions
   * are ignored and Holmes stays at the dock in SEARCH phases (the
   * berth path below already gates on companionModeRef). A resource
   * signal clearing returns him to full — unless the auto-kill
   * latched. */
  useEffect(() => {
    if (companionKilledRef.current) return;
    setCompanionMode(
      degradation.companionMode === "dock-only" ? "dock" : "full",
    );
  }, [degradation.companionMode]);
  /** Holmes's wrapper position, map-relative px (top-left). */
  const [holmesXY, setHolmesXY] = useState({ x: HOLMES_DOCK_X, y: 0 });
  const holmesXYRef = useRef(holmesXY);
  holmesXYRef.current = holmesXY;
  const [holmesTransition, setHolmesTransition] = useState({
    durationMs: 0,
    easing: EASE_OUT,
  });
  const [walking, setWalking] = useState(false);
  const [berthed, setBerthed] = useState(false);
  const [berthHidden, setBerthHidden] = useState(false);
  const berthedRef = useRef(false);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dockXY = () => {
    const r = mapRectRef.current;
    return {
      x: HOLMES_DOCK_X,
      y: r ? r.height - DOCK_INSET - HOLMES_BOX.h : 0,
    };
  };

  /** Send Holmes back to the dock (gesture cancel / phase exit). */
  const exitToDock = (instant: boolean) => {
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkTimerRef.current = null;
    setWalking(false);
    berthedRef.current = false;
    setBerthed(false);
    setBerthHidden(false);
    setHolmesTransition({
      durationMs: instant ? 0 : EXIT_MS,
      easing: EASE_IN,
    });
    setHolmesXY(dockXY());
  };
  const exitToDockRef = useRef(exitToDock);
  exitToDockRef.current = exitToDock;

  /* Auto-kill: rAF deltas + long-task observer feed the pure tracker;
   * on kill the companion is off for the session (Holmes dock-only).
   * The feed runs only while the companion is LIVE (the SEARCH
   * phases): the kill criterion guards the companion's own operation
   * (council Q2 §10; K4 measures it during pan+companion), and page-
   * load jank — tile loads, the 11 MB name index — is not companion
   * performance. Measured on the U6 smoke rig: load runs 3–34 FPS for
   * ~7 s, then a clean 60 FPS; feeding load frames would kill a
   * companion that would have run perfectly. The rAF loop does
   * nothing per frame but push one timestamp into the tracker. */
  useEffect(() => {
    if (companionMode !== "full") return;
    if (phase !== "SEARCH_IDLE" && phase !== "SEARCH_AREA") return;
    let raf = 0;
    let last = performance.now();
    let stopped = false;
    const onKill = () => {
      if (stopped) return;
      stopped = true;
      companionKilledRef.current = true;
      cancelAnimationFrame(raf);
      // eslint-disable-next-line no-console
      console.info(
        `[detective] waypoint companion auto-killed (${killRef.current?.killReason ?? "unknown"}) — Holmes stays docked for this session`,
      );
      setCompanionMode("killed");
      exitToDockRef.current(true);
    };
    const tick = (now: number) => {
      if (stopped) return;
      killRef.current?.feedFrame(now - last, now);
      last = now;
      if (killRef.current?.killed) {
        onKill();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          killRef.current?.feedLongTask(
            entry.duration,
            entry.startTime + entry.duration,
          );
        }
        if (killRef.current?.killed) onKill();
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      observer = null; // longtask unsupported — FPS kill still guards
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [companionMode, phase]);

  /* Pointer wiring: attached to the map container element itself. */
  useEffect(() => {
    const el = mapElRef.current as HTMLElement | null;
    if (!el) return;
    const detector = detectorRef.current!;
    const cache = new Map<
      number,
      { x: number; y: number; downT: number; downX: number; downY: number }
    >();
    let lastX = 0;
    let lastY = 0;
    let lastPointerType = "mouse";
    let lastMapActivity = 0; // last time the MAP may have moved
    let gestureActive = false;
    let pausePoint: { x: number; y: number } | null = null;

    const clearPauseTimer = () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    };

    /** Exclusions: screen geometry of things ALREADY VISIBLE to the
     * player — the MapLibre DOM markers inside the map container
     * (measured once, at pause-confirm time; never per frame). The
     * guess rings and ✕ marks are MapLibre GL canvas layers with no
     * DOM geometry, so they cannot be exclusion sources here — see
     * the U6 report. No game data ever enters the solver. */
    const measureExclusions = () => {
      const out: { x: number; y: number; r: number }[] = [];
      el.querySelectorAll(".maplibregl-marker").forEach((m) => {
        const rect = (m as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        out.push({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          r: Math.max(rect.width, rect.height) / 2,
        });
      });
      return out;
    };

    const onPauseConfirmed = (point: { x: number; y: number }) => {
      pausePoint = point;
      dispatchRef.current({ type: "pointerPaused", point });
      if (companionModeRef.current !== "full") return; // dock-only/killed: he thinks at the dock
      const rect = mapRectRef.current;
      if (!rect) return;
      const result = berthFor({
        pausePoint: point,
        holmesBox: HOLMES_BOX,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        dock: {
          x: rect.left + HOLMES_DOCK_X,
          y: rect.top + rect.height - DOCK_INSET - HOLMES_BOX.h,
        },
        exclusions: measureExclusions(),
        pointerType: lastPointerType,
        handSide: point.x >= window.innerWidth / 2 ? "right" : "left",
      });
      if (result.kind === "hide") {
        setBerthHidden(true);
        return;
      }
      if (result.kind === "remote") return; // thinks at the dock (view pose)
      const target = {
        x: result.x - rect.left,
        y: result.y - rect.top,
      };
      const dist = Math.hypot(
        target.x - holmesXYRef.current.x,
        target.y - holmesXYRef.current.y,
      );
      // Walk mode (U9): "cut" (reduced motion) applies the placement
      // with NO walk transition — an instant cut in the think pose
      // (Q2 §11); "animated" walks at the U6 speed/clamps.
      const durationMs =
        degradationRef.current.walkMode === "cut"
          ? 0
          : Math.min(
            WALK_MAX_MS,
            Math.max(WALK_MIN_MS, (dist / WALK_PX_PER_S) * 1000),
          );
      berthedRef.current = true;
      setBerthed(true);
      setHolmesTransition({ durationMs, easing: EASE_OUT });
      setHolmesXY(target);
      if (durationMs > 0) {
        setWalking(true);
        if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
        walkTimerRef.current = setTimeout(() => {
          walkTimerRef.current = null;
          setWalking(false); // arrival: view pose (berth-think) takes over
        }, durationMs);
      }
    };

    const attemptConfirm = (triesLeft: number) => {
      pauseTimerRef.current = null;
      if (viewRef.current.phase !== "SEARCH_IDLE") return;
      if (companionModeRef.current === "killed") return;
      const now = performance.now();
      const point = detector.check(now, now - lastMapActivity);
      if (point) {
        onPauseConfirmed(point);
        return;
      }
      if (triesLeft > 0) {
        pauseTimerRef.current = setTimeout(
          () => attemptConfirm(triesLeft - 1),
          120,
        );
      }
    };
    const scheduleConfirm = () => {
      clearPauseTimer();
      // Pause-confirm threshold (U9): 460 ms in animated mode (the
      // detector's own 350/450 ms rule confirms inside the retries);
      // 600 ms when walks are cut — reduced-motion berthing happens
      // after a 600 ms pause, same offsets (council Q2 §11).
      const delayMs =
        degradationRef.current.walkMode === "cut"
          ? REDUCED_MOTION_PAUSE_MS
          : 460;
      pauseTimerRef.current = setTimeout(() => attemptConfirm(12), delayMs);
    };

    const startGesture = () => {
      if (!gestureActive) {
        gestureActive = true;
        detector.notifyGestureStart();
      }
      clearPauseTimer();
      if (viewRef.current.phase === "SEARCH_AREA") {
        dispatchRef.current({ type: "gestureStarted" });
      }
      if (berthedRef.current || walking) exitToDockRef.current(false);
      if (berthHidden) setBerthHidden(false);
    };
    const endGesture = () => {
      if (!gestureActive) return;
      gestureActive = false;
      detector.notifyGestureEnd(performance.now());
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      lastPointerType = e.pointerType;
      const prev = cache.get(e.pointerId);
      if (prev) cache.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });
      const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      if ((e.pointerType === "touch" || e.buttons > 0) && moved > 2) {
        lastMapActivity = now;
      }
      // Berth cancel: a real move away from the pause point.
      if (
        pausePoint &&
        viewRef.current.phase === "SEARCH_AREA" &&
        Math.hypot(e.clientX - pausePoint.x, e.clientY - pausePoint.y) >
          GESTURE_CANCEL_PX
      ) {
        startGesture();
        if (cache.size === 0) endGesture(); // hover move: gesture is over
        return;
      }
      detector.feed({
        x: e.clientX,
        y: e.clientY,
        t: now,
        pointerType: e.pointerType,
        pointersDown:
          e.pointerType === "touch" ? cache.size : e.buttons > 0 ? 1 : 0,
      });
      if (viewRef.current.phase === "SEARCH_IDLE") scheduleConfirm();
    };

    const onDown = (e: PointerEvent) => {
      const now = performance.now();
      lastPointerType = e.pointerType;
      lastMapActivity = now;
      cache.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        downT: now,
        downX: e.clientX,
        downY: e.clientY,
      });
      if (cache.size >= 2) startGesture(); // pinch: pan/zoom wins instantly
      // A tap (<250 ms, <10 px) must NOT summon or move Holmes: nothing
      // happens on pointerdown. If he is already berthed he freezes.
    };

    const onUp = (e: PointerEvent) => {
      const rec = cache.get(e.pointerId);
      cache.delete(e.pointerId);
      if (rec) {
        const travel = Math.hypot(e.clientX - rec.downX, e.clientY - rec.downY);
        const isTap = performance.now() - rec.downT < 250 && travel < 10;
        if (!isTap && travel > GESTURE_CANCEL_PX && berthedRef.current) {
          startGesture();
        }
      }
      if (cache.size === 0) endGesture();
    };

    const onWheel = () => {
      lastMapActivity = performance.now();
      startGesture();
      endGesture(); // wheel is momentary: the 500 ms re-arm runs from now
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      clearPauseTimer();
      cache.clear();
    };
    // mapEl state mirrors mapElRef; the effect re-runs when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEl]);

  /* Once the map is measured, park the wrapper at the dock. */
  useEffect(() => {
    if (mapEl && !berthedRef.current) setHolmesXY(dockXY());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEl]);

  /* Phase exits: leaving the SEARCH phases parks Holmes at the dock
   * and resets the detector, so no stale candidate can fire later. */
  useEffect(() => {
    if (phase !== "SEARCH_IDLE" && phase !== "SEARCH_AREA") {
      detectorRef.current?.reset();
      if (berthedRef.current || walking || berthHidden) {
        exitToDockRef.current(true);
      }
      // Snap the wrapper home even when he never berthed (cheap no-op
      // when already docked) so SELECTION_READ renders him at the dock.
      setHolmesXY(dockXY());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* -- render ---------------------------------------------------------- */
  if (view.hidden || view.phase === "OFF") return null;

  const holmesEl =
    view.holmes.placement !== "hidden" ? (
      <div className="detective-host-figure" data-detective="holmes">
        <HolmesRig
          pose={view.holmes.pose}
          facing="right"
          speaking={speakingWho === "holmes"}
        />
      </div>
    ) : null;
  const watsonEl =
    view.watson.placement !== "hidden" ? (
      <div className="detective-host-figure" data-detective="watson">
        <WatsonRig
          pose={view.watson.pose}
          facing="left"
          speaking={speakingWho === "watson"}
        />
      </div>
    ) : null;

  const stationFigures: ReactElement[] = [];
  if (view.watson.placement === "station" && watsonEl) stationFigures.push(<span key="w">{watsonEl}</span>);
  if (view.holmes.placement === "station" && holmesEl) stationFigures.push(<span key="h">{holmesEl}</span>);

  /* CELEBRATE layout (U8): the pair stands side-by-side in a fixed
   * cluster — Holmes at the origin, Watson offset by exactly
   * CELEBRATE_LAYOUT.watsonOffsetPx, so in the high-five step the two
   * HIGH_FIVE_CONTACT anchors coincide (palm meets palm; the rig test
   * pins the arithmetic). The positions never change between steps —
   * only the poses do — so the choreography reads as one held frame.
   * The spark sits ABOVE the contact point (its box ends 8 px over the
   * hands): it crowns the contact, it never masks it. */
  const celebrating =
    view.phase === "CELEBRATE" &&
    view.holmes.placement === "station" &&
    view.watson.placement === "station" &&
    holmesEl !== null &&
    watsonEl !== null;
  const celebrateEl = celebrating ? (
    <div
      className="detective-host-celebrate"
      data-testid="detective-celebrate"
      data-celebrate-step={view.holmes.pose}
    >
      <div className="detective-celebrate-holmes">{holmesEl}</div>
      <div
        className="detective-celebrate-watson"
        style={{
          transform: `translate(${CELEBRATE_LAYOUT.watsonOffsetPx.x}px, ${CELEBRATE_LAYOUT.watsonOffsetPx.y}px)`,
        }}
      >
        {watsonEl}
      </div>
      {view.holmes.pose === "high-five" ? (
        <span
          className="detective-celebrate-spark"
          data-testid="detective-spark"
          style={{
            left: CELEBRATE_LAYOUT.holmesContactPx.x,
            top: CELEBRATE_LAYOUT.holmesContactPx.y,
          }}
          aria-hidden="true"
        >
          ✦
        </span>
      ) : null}
    </div>
  ) : null;

  /* Map-side rendering (U6): Watson keeps the U5 dock cluster; Holmes
   * rides his own transform wrapper so the companion can walk him
   * between the dock and a berth without touching Watson or the map.
   * data-companion / data-holmes-placement are the U10 spec surface. */
  const holmesOnMap =
    view.holmes.placement === "dock" || view.holmes.placement === "berth";
  const watsonOnMap = view.watson.placement === "dock";
  const effectivePlacement = berthHidden
    ? "hidden"
    : view.holmes.placement === "berth"
      ? "berth"
      : view.holmes.placement;
  const holmesMapEl = holmesOnMap ? (
    <div
      className={
        berthHidden
          ? "detective-host-holmes detective-host-holmes-hidden"
          : "detective-host-holmes"
      }
      data-testid="detective-holmes-wrapper"
      data-walk-mode={degradation.walkMode}
      style={{
        transform: `translate3d(${holmesXY.x}px, ${holmesXY.y}px, 0)`,
        transition:
          holmesTransition.durationMs > 0
            ? `transform ${holmesTransition.durationMs}ms ${holmesTransition.easing}`
            : "none",
      }}
    >
      <div className="detective-host-figure" data-detective="holmes">
        <HolmesRig
          pose={walking ? "walk" : view.holmes.pose}
          facing="right"
          speaking={speakingWho === "holmes"}
        />
      </div>
    </div>
  ) : null;

  /* Listen button (U9): tap speech mode only, clue/guessing phases
   * only. It lives OUTSIDE the aria-hidden station cluster — a button
   * inside aria-hidden could never be reached — but is positioned in
   * the cluster, beside the pair at the active clue card. Tapping it
   * replays the player's held clue sequence; the sound gate is
   * re-checked inside the player at play time. */
  const showListen =
    degradation.speechMode === "tap" &&
    !view.hidden &&
    LISTEN_PHASES.has(view.phase);
  const listenEl = showListen ? (
    <div
      className="detective-host-listen"
      data-testid="detective-listen"
      style={
        anchor
          ? { left: anchor.left + 152, top: anchor.top }
          : { left: 164, bottom: 96, top: "auto", transform: "none" }
      }
    >
      <button
        type="button"
        className="detective-listen-button"
        aria-label="Listen to this clue"
        onClick={() => {
          void playerRef.current?.playHeldSequence();
        }}
      >
        <span aria-hidden="true">🔊</span> Listen
      </button>
    </div>
  ) : null;

  /* Tap-Watson replay (Unit A): tapping Watson himself asks him to
   * repeat the current clue. The control is a REAL button sized over
   * Watson's figure (≥44×44 px, keyboard-operable), rendered OUTSIDE
   * the aria-hidden station/map clusters — same placement pattern as
   * the Listen button — in whichever spot Watson currently occupies:
   * fixed over his figure at the clue-card station, or absolute over
   * his figure at the map dock. It carries the discoverability cue
   * (the ↻ badge; detective.css pulses it gently, static under
   * reduced motion). Visibility is the pure U9-matrix rule
   * (watsonReplayCueVisible): clue/guessing phases only, Watson
   * present, pair not absent, speech mode "auto" or "tap" — in
   * "off" mode nothing is held, so no cue is offered. Absence law is
   * untouched: while the sheet / rings own the screen the view is
   * hidden and, like Watson himself, the control is simply not there.
   * Pointer tap and keyboard activation run the same path: the
   * player's replay, which restarts the held sequence from item 1
   * and re-checks the sound gate at play time. */
  const showWatsonReplay = watsonReplayCueVisible({
    phase: view.phase,
    watsonPlacement: view.watson.placement,
    hidden: view.hidden,
    speechMode: degradation.speechMode,
  });
  const onWatsonReplay = () => {
    void playerRef.current?.playHeldSequence();
  };
  const watsonReplayBadge = (
    <span className="detective-watson-replay-badge" aria-hidden="true">
      ↻
    </span>
  );
  const watsonReplayStationEl =
    showWatsonReplay && view.watson.placement === "station" ? (
      <div
        className="detective-host-watson-replay"
        style={
          anchor
            ? { left: anchor.left, top: anchor.top }
            : { left: 12, bottom: 96, top: "auto", transform: "none" }
        }
      >
        <button
          type="button"
          className="detective-watson-replay detective-watson-replay-station"
          data-testid="detective-watson-replay"
          aria-label="Ask Watson to repeat this clue"
          onClick={onWatsonReplay}
        >
          {watsonReplayBadge}
        </button>
      </div>
    ) : null;
  const watsonReplayDockEl =
    showWatsonReplay && view.watson.placement === "dock" ? (
      <button
        type="button"
        className="detective-watson-replay detective-watson-replay-dock"
        data-testid="detective-watson-replay"
        aria-label="Ask Watson to repeat this clue"
        onClick={onWatsonReplay}
      >
        {watsonReplayBadge}
      </button>
    ) : null;

  /* Sound Everywhere (PR C, council Q6) — three surfaces, ONE action:
   * every one of them flips the same persisted master toggle
   * (meridian.sound via setSoundEnabled / SoundToggle); there is no
   * second key and no pair-only mute.
   *
   * 1. The speaker CHIP: a real SoundToggle instance (≥44 px) riding
   *    the pair cluster — beside the figures at the clue-card station,
   *    above the dock cluster on the map. Its Volume2/VolumeX icon is
   *    the toggle's own muted display.
   * 2. The muted BADGE: a slashed-speaker disc latched on the cluster
   *    while muted, so the state reads at a glance. The figures
   *    themselves are never greyed or altered (Brand ruling, Q6).
   * 3. Tap-HOLMES alias: Holmes's figure body is a transparent button
   *    over his rendered box (station, celebrate, and berth — the map
   *    one rides his transform wrapper's exact geometry; at the dock,
   *    where the shipped staging paints him over Watson's left side,
   *    it narrows to a 44 px strip so the two centres stay separate —
   *    see detective.css), wired to the same toggle. Watson's replay
   *    button is a separate element over a separate figure; both
   *    handlers stop propagation, so a Holmes tap can never fire a
   *    replay and a Watson tap can never mute. Muting stops the
   *    speaking clip in the same event via the onSoundChanged
   *    subscription above. */
  const toggleSoundFromHolmes = (e: { stopPropagation(): void }) => {
    e.stopPropagation();
    try {
      // Derive from the host's SUBSCRIBED soundOn state, never from a
      // fresh storage read (cure, Senior Developer): where setItem
      // throws (private mode) storage can disagree with the live
      // state, and an alias reading storage could mute but never
      // unmute. soundOn is kept current by the onSoundChanged
      // subscription above, so the alias always flips the truth the
      // player sees.
      setSoundEnabled(!soundOn);
    } catch {
      // Sound is enhancement-only; the alias never throws into play.
    }
  };
  const mutedBadge = !soundOn ? (
    <span
      className="detective-muted-badge"
      data-testid="detective-muted-badge"
      aria-hidden="true"
    >
      <VolumeX className="size-4" aria-hidden="true" />
    </span>
  ) : null;
  const soundChip = (
    <SoundToggle testId="detective-sound-chip" className="detective-sound-chip" />
  );
  const watsonAtStation = view.watson.placement === "station";
  const holmesAtStation = view.holmes.placement === "station";
  // Station geometry (rendered boxes at 104 px tall): Watson ≈100 px
  // wide, Holmes 70 px, cluster gap 4 px. Holmes stands right of
  // Watson in the plain station cluster; in the celebrate cluster he
  // is at the origin (CELEBRATE_LAYOUT) and the cluster is 147 px wide.
  // holmesStationOffset 104 = Watson's 100 px width + the 4 px gap.
  //
  // chipStationOffset — every literal mapped to its layout terms
  // (DevEx cure): the chip starts 8 px clear of whatever stands to
  // its left in the cluster.
  // - 155 (celebrate): the celebrate cluster is 147 px wide
  //   (CELEBRATE_LAYOUT: Watson's 46.7 px offset + his ≈100 px
  //   rendered width) + 8 px clear = 155.
  // - 182 (Watson + Holmes at the station): Watson 100 px + 4 px gap
  //   + Holmes 70 px + 8 px clear = 182.
  // - 108 (Watson alone): Watson 100 px + 8 px clear = 108.
  // - 78 (Holmes alone): Holmes 70 px + 8 px clear = 78.
  const holmesStationOffset = celebrating ? 0 : watsonAtStation ? 104 : 0;
  const chipStationOffset = celebrating
    ? 155
    : watsonAtStation && holmesAtStation
      ? 182
      : watsonAtStation
        ? 108
        : 78;
  /* Listen clearance (cure, panel round 1 BLOCK): in tap speech mode
   * the Listen button sits at anchor.left + 152, ≈108 px wide →
   * [+152, +260], in the same z-31 band as the chip and the station
   * Holmes-mute — the chip's [+182, +226] box sat ON Listen's centre
   * and the mute's [+104, +174] box ate its left edge, leaving Listen
   * a ≈32 px hittable strip (< the 44 px floor) whose mis-taps muted
   * (muting flips speech off, which unmounts Listen itself). While
   * Listen shows, the three controls are separated geometrically:
   * - the chip row LIFTS one row up (LISTEN_CLEARANCE_PX above the
   *   anchor line): the Listen button is at most 48 px tall, so the
   *   lifted chip's bottom edge clears Listen's top edge by ≥ 8 px
   *   at any horizontal position;
   * - the station Holmes-mute NARROWS to a 44 px strip (the
   *   accessibility floor, detective.css) at [+104, +148], 4 px
   *   clear of Listen's left edge at +152.
   * The anchor-null fallback (Listen at left 164, right edge ≈272)
   * fits the same rules inside 390 px: chip at 12 + 182 = 194 lifted
   * to bottom 96 + 56 = 152, mute strip [116, 160] vs Listen from
   * 164. Pairwise separation is proven in
   * tests/e2e/detective-sound.spec.ts (tap-mode station proof). */
  const LISTEN_CLEARANCE_PX = 56;
  const stationSoundShown = stationFigures.length > 0 || celebrateEl != null;
  const stationSoundEl = stationSoundShown ? (
    <div
      className="detective-host-sound"
      style={
        anchor
          ? {
              left: anchor.left + chipStationOffset,
              top: showListen
                ? anchor.top - LISTEN_CLEARANCE_PX
                : anchor.top,
            }
          : {
              left: 12 + chipStationOffset,
              bottom: showListen ? 96 + LISTEN_CLEARANCE_PX : 96,
              top: "auto",
              transform: "none",
            }
      }
    >
      {soundChip}
      {mutedBadge}
    </div>
  ) : null;
  const stationHolmesMuteEl = holmesAtStation ? (
    <div
      className="detective-host-holmes-mute"
      style={
        anchor
          ? { left: anchor.left + holmesStationOffset, top: anchor.top }
          : {
              left: 12 + holmesStationOffset,
              bottom: 96,
              top: "auto",
              transform: "none",
            }
      }
    >
      <button
        type="button"
        className={
          showListen && holmesStationOffset > 0
            ? "detective-holmes-mute detective-holmes-mute-listen"
            : "detective-holmes-mute"
        }
        data-testid="detective-holmes-mute"
        aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
        aria-pressed={soundOn}
        onClick={toggleSoundFromHolmes}
      />
    </div>
  ) : null;
  /* Exactly ONE chip + badge in every state (cure, Game Developer):
   * the guards are mutually exclusive — the station cluster wins
   * whenever it renders, the map cluster only when it does not.
   * During NOTE_MARK the placement splits (Watson at the station,
   * Holmes at the dock), so the old independent guards BOTH fired
   * and painted two chips + two badges with duplicate testids. */
  const mapSoundEl =
    !stationSoundShown && (holmesOnMap || watsonOnMap) ? (
      <div className="detective-host-sound-map">
        {soundChip}
        {mutedBadge}
      </div>
    ) : null;
  const mapHolmesMuteEl =
    holmesOnMap && !berthHidden ? (
      <button
        type="button"
        className={
          berthed
            ? "detective-holmes-mute detective-holmes-mute-map"
            : "detective-holmes-mute detective-holmes-mute-map detective-holmes-mute-dock"
        }
        data-testid="detective-holmes-mute"
        aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
        aria-pressed={soundOn}
        onClick={toggleSoundFromHolmes}
        style={{
          transform: `translate3d(${holmesXY.x}px, ${holmesXY.y}px, 0)`,
          transition:
            holmesTransition.durationMs > 0
              ? `transform ${holmesTransition.durationMs}ms ${holmesTransition.easing}`
              : "none",
        }}
      />
    ) : null;

  return (
    <>
      {listenEl}
      {watsonReplayStationEl}
      {stationSoundEl}
      {stationHolmesMuteEl}
      {stationFigures.length > 0 || celebrateEl ? (
        <div
          className="detective-host-station"
          data-testid="detective-station"
          data-companion={companionMode}
          data-holmes-placement={effectivePlacement}
          data-phase={view.phase}
          data-degradation={degradationAttr}
          data-walk-mode={degradation.walkMode}
          data-speech-mode={degradation.speechMode}
          aria-hidden="true"
          style={
            anchor
              ? { left: anchor.left, top: anchor.top }
              : { left: 12, bottom: 96, top: "auto", transform: "none" }
          }
        >
          {celebrateEl ?? stationFigures}
        </div>
      ) : null}
      {(holmesOnMap || watsonOnMap) && mapEl
        ? createPortal(
            <>
              <div
                className="detective-host-map"
                data-testid="detective-host"
                data-companion={companionMode}
                data-holmes-placement={effectivePlacement}
                data-phase={view.phase}
                data-degradation={degradationAttr}
                data-walk-mode={degradation.walkMode}
                data-speech-mode={degradation.speechMode}
                aria-hidden="true"
              >
                {watsonOnMap && watsonEl ? (
                  <div className="detective-host-dock" data-testid="detective-dock">
                    {watsonEl}
                  </div>
                ) : null}
                {holmesMapEl}
              </div>
              {/* Unit A: the tap-Watson control rides the same portal
                  but OUTSIDE the aria-hidden map root, over Watson's
                  dock figure (see the station element above). */}
              {watsonReplayDockEl}
              {/* PR C: the pair's sound chip + tap-Holmes alias ride
                  the same portal, likewise OUTSIDE the aria-hidden
                  map root — real buttons must stay reachable. */}
              {mapSoundEl}
              {mapHolmesMuteEl}
            </>,
            mapEl,
          )
        : null}
    </>
  );
}
