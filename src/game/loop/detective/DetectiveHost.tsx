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
import { isEnabled } from "@/lib/flags";
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
/** Station cluster gap: the clear air between Watson and Holmes when
 * they stand together at the clue card. NOT the dock gap and NOT the
 * chip clear below — three gaps that share values by coincidence and
 * stay distinct by name (PR A re-derivation, Senior Architect). */
const STATION_GAP_PX = 4;
/** The speaker chip's clear air from whatever stands to its left in
 * the station cluster (8 px — a different 8 from DOCK_GAP). */
const CHIP_CLEAR_PX = 8;
/** Reading-scroll clearance (#358): the station's figure height plus
 * a breath of air above the clue card — derived from HOLMES_BOX.h,
 * the same figure height every station offset below derives from. */
const STATION_CLEARANCE_PX = HOLMES_BOX.h + 12;
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
  width: number;
  height: number;
}

export default function DetectiveHost(props: DetectiveHostProps): ReactElement | null {
  const { caseIndex, cluesRevealed, status, sheetOpen, lastGuessPlaceId, freshDeal, answerPlaceId } = props;

  /* -- machine instance: ref-held state, React state only for the view */
  const machineRef = useRef<DetectiveState>(initialDetectiveState());
  const [view, setView] = useState<DetectiveView>(() => viewForState(machineRef.current));

  /* -- staging rework (PR A, hostsStaging flag) ----------------------
   * Stage machine, host-local and monotonic per case:
   * bench (both seated, coffee + watch, during CASE_OPEN — before the
   * case's questions load) -> standing (bench board faded, Watson at
   * his station, Holmes standing in the slot) -> entering (first map
   * interaction: Holmes walks onto the map, the slot collapses) ->
   * gone (slot unmounted, zero height — no reserved strip remains).
   * With the flag off none of this renders and every placement below
   * is exactly the shipped behaviour. Staging reads ONLY the flag,
   * the machine's view, and the degradation matrix — no new props,
   * so the answer-blindness whitelist is untouched. */
  const stagingOn = isEnabled("hostsStaging");
  const [stagingStage, setStagingStage] = useState<
    "bench" | "standing" | "entering" | "gone"
  >("bench");
  const stagingStageRef = useRef(stagingStage);
  stagingStageRef.current = stagingStage;
  const entryPendingRef = useRef(false);
  /* Cure C2: a map interaction during "bench" records entry intent
   * here instead of jumping bench -> entering mid-duet; the entry
   * proceeds when the stage reaches "standing". */
  const entryIntentRef = useRef(false);
  /* Cure C9: the entry walk's rAF handle, cancelled on unmount. */
  const entryRafRef = useRef<number | null>(null);
  const holmesEntered =
    !stagingOn || stagingStage === "entering" || stagingStage === "gone";
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
    setStagingStage("bench");
    entryPendingRef.current = false;
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

  /* Staging: the bench holds only while the case opens. The moment
   * the machine leaves CASE_OPEN (the case's questions loading),
   * the pair rise: Watson goes to his station,
   * Holmes stands in the slot until the first map interaction. */
  useEffect(() => {
    if (!stagingOn) return;
    if (stagingStage === "bench" && view.phase !== "CASE_OPEN") {
      setStagingStage("standing");
    }
  }, [stagingOn, stagingStage, view.phase]);

  /* Staging: once Holmes enters the map, the bench slot finishes
   * collapsing and unmounts — zero height, nothing reserved. */
  useEffect(() => {
    if (stagingStage !== "entering") return;
    const t = setTimeout(
      () => setStagingStage("gone"),
      reducedMotion ? 60 : 750,
    );
    return () => clearTimeout(t);
  }, [stagingStage, reducedMotion]);

  /* Cure C2: entry intent recorded during "bench" fires the moment
   * the stage reaches "standing" — the duet is never cut short, and
   * the interaction handlers themselves are untouched. */
  useEffect(() => {
    if (stagingStage !== "standing" || !entryIntentRef.current) return;
    entryIntentRef.current = false;
    enterMapRef.current();
  }, [stagingStage]);

  /* Cure C3: a case that ends with Holmes never entered (no map
   * interaction ever happened — stage still "standing") forces his
   * entry at case end. This is the structurally cleaner cure: the
   * one existing entry mechanism runs, the bench slot collapses
   * empty, CELEBRATE's station cluster is then the only Holmes on
   * the page (his map wrapper does not render while celebrating),
   * and DEBRIEF keeps its Holmes at the map dock via the existing
   * station-phase dock fallback. Gating the bench figure out per
   * phase instead would have needed a second Holmes source for
   * DEBRIEF and left the slot reserved through the endings. */
  useEffect(() => {
    if (!stagingOn) return;
    if (
      view.phase !== "CELEBRATE" &&
      view.phase !== "DEBRIEF" &&
      view.phase !== "FAIL_READ" &&
      view.phase !== "POUT"
    )
      return;
    if (stagingStage !== "standing") return;
    enterMapRef.current();
  }, [stagingOn, view.phase, stagingStage]);

  /* -- station anchoring: measure on discrete changes, never per frame  */
  const [anchor, setAnchor] = useState<StationAnchor | null>(null);
  /** Whether the first anchor measure has completed. Under staging
   * the station surfaces wait for it: the pre-measure fallback frame
   * can paint the cluster over below-fold card text while the
   * screen entrance transform is live (measured in the staging
   * E2E sampling audit) - a one-frame overlap the zero-overlap
   * law does not forgive. A measure that finds NO card still counts
   * (that is the genuine anchor-null fallback, rendered as before). */
  const [anchorMeasured, setAnchorMeasured] = useState(false);
  /* Cure C6: the pre-measure suppression must cover TRANSITIONS,
   * not only mount — a clue/case change leaves the previous card's
   * anchor in place, and a case change with the same clue count did
   * not even re-run the measure effect. Reset during render (the
   * React adjust-state pattern: the re-render happens before any
   * paint) whenever the case or clue changes; the measure effect
   * below then re-measures the new card and re-arms the station. */
  const [anchorResetKey, setAnchorResetKey] = useState({
    caseIndex,
    cluesRevealed,
  });
  if (
    anchorResetKey.caseIndex !== caseIndex ||
    anchorResetKey.cluesRevealed !== cluesRevealed
  ) {
    setAnchorResetKey({ caseIndex, cluesRevealed });
    setAnchorMeasured(false);
  }
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
        setAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      } else {
        setAnchor(null);
      }
      setAnchorMeasured(true);
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
  }, [cluesRevealed, phase, status, caseIndex]);

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

  /* Staging entry walk (PR A unit 4): the FIRST map interaction
   * walks Holmes from the bench slot onto the map. The bench
   * figure leaves in the same beat (the slot collapses empty —
   * see the bench render for the zero-overlap reason) while his
   * map wrapper starts offset from the dock — down and to the
   * side, as if stepping up from the bench below the map — and
   * walks to the dock with the walk pose over 700 ms. Not a teleport: the
   * wrapper's transform transition is the walk, and the staging E2E
   * samples it mid-flight. Reduced motion (walkMode "cut") places
   * him at the dock instantly. A berth confirmed during the entry
   * supersedes the dock target (entryPendingRef) — he simply walks
   * on to the berth instead. */
  const enterMap = () => {
    if (!stagingOn) return;
    /* Cure C2: during "bench" the interaction only records intent —
     * the stage must not jump bench -> entering mid-duet. The
     * standing effect above fires the entry when the duet ends. */
    if (stagingStageRef.current === "bench") {
      entryIntentRef.current = true;
      return;
    }
    if (
      stagingStageRef.current === "entering" ||
      stagingStageRef.current === "gone"
    )
      return;
    setStagingStage("entering");
    const dock = dockXY();
    if (degradationRef.current.walkMode === "cut") {
      setHolmesTransition({ durationMs: 0, easing: EASE_OUT });
      setHolmesXY(dock);
      return;
    }
    entryPendingRef.current = true;
    setHolmesTransition({ durationMs: 0, easing: EASE_OUT });
    setHolmesXY({ x: dock.x + 90, y: dock.y + 34 });
    entryRafRef.current = requestAnimationFrame(() => {
      entryRafRef.current = null;
      if (!entryPendingRef.current) return;
      entryPendingRef.current = false;
      setHolmesTransition({ durationMs: 700, easing: EASE_OUT });
      setHolmesXY(dock);
      setWalking(true);
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      walkTimerRef.current = setTimeout(() => {
        walkTimerRef.current = null;
        setWalking(false);
      }, 700);
    });
  };
  const enterMapRef = useRef(enterMap);
  enterMapRef.current = enterMap;

  /* Cure C9: unmount cleanup for the entry machinery — cancel the
   * entry rAF and the walk timer so neither can fire into an
   * unmounted host (the dwell/ring timers already die above). */
  useEffect(() => {
    return () => {
      if (entryRafRef.current !== null) {
        cancelAnimationFrame(entryRafRef.current);
        entryRafRef.current = null;
      }
      if (walkTimerRef.current) {
        clearTimeout(walkTimerRef.current);
        walkTimerRef.current = null;
      }
    };
  }, []);

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
      // A desktop hover-pause is a first map interaction too: Holmes
      // enters (his entry walk's dock target is then superseded by
      // the berth below — he walks on to the berth instead).
      enterMapRef.current();
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
      /* Cure C4 (entry supersession ownership): entryPendingRef is
       * cleared exactly when another path assumes ownership of
       * holmesXY — only a berth does (it sets the target below).
       * `hide` and `remote` return WITHOUT clearing, so a queued
       * entry walk completes to the dock: a routine desktop far
       * hover-pause as the first interaction used to clear it and
       * strand Holmes at the entry offset dock+(90,34), feet past
       * the map's bottom edge. For `hide`, completing the entry
       * under the hidden wrapper is harmless and uniform. */
      if (result.kind === "hide") {
        setBerthHidden(true);
        return;
      }
      if (result.kind === "remote") return; // thinks at the dock (view pose); the entry walk delivers him there
      entryPendingRef.current = false; // a berth supersedes the entry walk's dock target
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
      enterMapRef.current();
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
      enterMapRef.current();
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
      /* Cure C4 (Sr Dev nit 3): the snap moves holmesXY, so it owns
       * it — consume any queued entry walk, or the entry rAF would
       * fire after the snap and walk him in place with the walk
       * pose (the tap-first-interaction case). */
      entryPendingRef.current = false;
      setHolmesXY(dockXY());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* -- render ---------------------------------------------------------- */
  if (view.hidden || view.phase === "OFF") return null;

  /* Cure C1 (panel round, PR #361): while the bench stage holds,
   * the pair exist ONLY on the bench — Watson's station cluster is
   * suppressed whole (figure, replay, Listen, sound chip) so the
   * page never carries two Watsons, and the bench rigs speak the
   * CASE_OPEN duet (see benchEl). Holmes's station suppression
   * below already had this shape; Watson's is now symmetric. */
  const benchStage = stagingOn && stagingStage === "bench";
  const holmesEl =
    view.holmes.placement !== "hidden" ? (
      <div className="detective-host-figure" data-detective="holmes">
        <HolmesRig
          pose={view.holmes.pose}
          facing="right"
          speaking={speakingWho === "holmes"}
          halo={stagingOn}
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
          halo={stagingOn}
        />
      </div>
    ) : null;

  const celebratingEarly =
    view.phase === "CELEBRATE" &&
    view.holmes.placement === "station" &&
    view.watson.placement === "station" &&
    holmesEl !== null &&
    watsonEl !== null;
  const stationFigures: ReactElement[] = [];
  /* Cure C1: during the bench stage Watson's station figure is
   * suppressed with the rest of his cluster — the bench Watson is
   * the only Watson on the page. */
  if (view.watson.placement === "station" && watsonEl && !benchStage) stationFigures.push(<span key="w">{watsonEl}</span>);
  /* Staging (PR A): Holmes NEVER joins the station cluster — that is
   * what keeps the zero-overlap law: Watson alone stands in the
   * gutter beside the card, Holmes waits in the bench slot (before
   * entry) or lives on the map (after entry). The one exception is
   * the shipped CELEBRATE cluster, which keeps its choreography. */
  if (view.holmes.placement === "station" && holmesEl && (!stagingOn || celebratingEarly)) stationFigures.push(<span key="h">{holmesEl}</span>);

  /* CELEBRATE layout (U8): the pair stands side-by-side in a fixed
   * cluster — Holmes at the origin, Watson offset by exactly
   * CELEBRATE_LAYOUT.watsonOffsetPx, so in the high-five step the two
   * HIGH_FIVE_CONTACT anchors coincide (palm meets palm; the rig test
   * pins the arithmetic). The positions never change between steps —
   * only the poses do — so the choreography reads as one held frame.
   * The spark sits ABOVE the contact point (its box ends 8 px over the
   * hands): it crowns the contact, it never masks it. */
  const celebrating = celebratingEarly;
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
  /* Staging: before entry Holmes is in the bench slot, NOT on the
   * map — his map figure (and its mute alias) render only once he
   * has entered. After entry, a station phase finds him at his map
   * dock instead of the station cluster (see stationFigures). */
  const holmesDockFallback =
    stagingOn &&
    holmesEntered &&
    view.holmes.placement === "station" &&
    !celebrating;
  const holmesOnMap =
    (view.holmes.placement === "dock" ||
      view.holmes.placement === "berth" ||
      holmesDockFallback) &&
    (!stagingOn || holmesEntered);
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
          halo={stagingOn}
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
  const stationReady = !stagingOn || anchorMeasured;
  const showListen =
    degradation.speechMode === "tap" &&
    !view.hidden &&
    !benchStage &&
    /* Cure C7: the Listen element waits for the first anchor
     * measure like its sibling station surfaces (stationReady) —
     * an unmeasured Listen could paint over the card it serves. */
    stationReady &&
    LISTEN_PHASES.has(view.phase);
  /* Gutter station (staging): the station cluster stands IN the
   * 118 px gutter LoopScreen reserves beside the clue cards,
   * vertically centred on the active card — never over its text. */
  const gutterStation =
    stagingOn && !celebrating && anchor !== null && view.watson.placement === "station";
  const gutterLeft = anchor ? anchor.left + anchor.width + 6 : 0;
  const gutterCentreTop = anchor ? anchor.top + anchor.height / 2 : 0;
  const listenEl = showListen ? (
    <div
      className="detective-host-listen"
      data-testid="detective-listen"
      style={
        gutterStation
          ? { left: gutterLeft, top: gutterCentreTop + 62, transform: "none" }
          : anchor
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
    showWatsonReplay && view.watson.placement === "station" && stationReady && !benchStage ? (
      <div
        className={
          gutterStation
            ? "detective-host-watson-replay detective-host-watson-replay-gutter"
            : "detective-host-watson-replay"
        }
        style={
          gutterStation
            ? { left: gutterLeft, top: gutterCentreTop }
            : anchor
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
   *    one rides his transform wrapper's exact geometry), wired to
   *    the same toggle. PR C narrowed the dock alias to a 44 px strip
   *    because the staging of the day painted Holmes over Watson's
   *    replay box; PR #358 moved his dock beside Watson (the boxes
   *    are disjoint: [12,112] vs [120,190]), so PR A restored the
   *    full 70 px dock alias — the narrowing was voluntary the
   *    moment the overlap died. Watson's replay
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
  // Station geometry (rendered boxes at 104 px tall): Watson
  // WATSON_DOCK_W wide, Holmes HOLMES_BOX wide, STATION_GAP_PX of
  // clear air in the plain station cluster; in the celebrate cluster
  // Holmes is at the origin (CELEBRATE_LAYOUT).
  // PR A re-derivation: every offset below is arithmetic on the
  // constants of record — WATSON_DOCK_W (100), HOLMES_BOX (70x104),
  // STATION_GAP_PX (4), CHIP_CLEAR_PX (8), CELEBRATE_LAYOUT — never a
  // bare literal and never a third Watson-width constant.
  // - holmesStationOffset = Watson's width + the station gap.
  // - chipStationOffset = whatever stands left of the chip + the
  //   chip clear: celebrate cluster (Watson's celebrate offset +
  //   his width) / Watson + Holmes / Watson alone / Holmes alone.
  const holmesStationOffset = celebrating
    ? 0
    : watsonAtStation
      ? WATSON_DOCK_W + STATION_GAP_PX
      : 0;
  const celebrateClusterW = Math.round(
    CELEBRATE_LAYOUT.watsonOffsetPx.x + WATSON_DOCK_W,
  );
  const chipStationOffset = celebrating
    ? celebrateClusterW + CHIP_CLEAR_PX
    : watsonAtStation && holmesAtStation
      ? WATSON_DOCK_W + STATION_GAP_PX + HOLMES_BOX.w + CHIP_CLEAR_PX
      : watsonAtStation
        ? WATSON_DOCK_W + CHIP_CLEAR_PX
        : HOLMES_BOX.w + CHIP_CLEAR_PX;
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
  const stationSoundShown =
    stationReady && (stationFigures.length > 0 || celebrateEl != null);
  const stationSoundEl = stationSoundShown ? (
    <div
      className={
        gutterStation
          ? "detective-host-sound detective-host-sound-gutter"
          : "detective-host-sound"
      }
      style={
        gutterStation
          ? {
              left: gutterLeft,
              top: gutterCentreTop + (showListen ? 118 : 62),
              transform: "none",
            }
          : anchor
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
  const stationHolmesMuteEl = holmesAtStation && (!stagingOn || celebrating) ? (
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
        className="detective-holmes-mute detective-holmes-mute-map"
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

  /* The bench (staging): in-flow, rendered where LoopScreen mounts
   * the host — directly under the map. Seated stage: both figures
   * behind the bench board (it paints over their legs), a coffee
   * cup in each hand, Holmes's watch glance running (CSS). Standing
   * stage: the board has faded, the cups rest ON the bench (they
   * stay behind — never in play), Watson is at his station, Holmes
   * stands in the slot. Entering: the slot collapses to zero height
   * behind his step onto the map; then this element unmounts. */
  const cupSvg = (cls: string, testId: string) => (
    <svg className={cls} data-testid={testId} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7,3 q1.5,2 0,4 M12,3 q1.5,2 0,4 M17,3 q1.5,2 0,4" stroke="#b9c4cc" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M4,10 h15 v5 a5,5 0 0 1 -5,5 h-5 a5,5 0 0 1 -5,-5 Z" fill="#fffdf6" stroke="#171310" strokeWidth="1.7" />
      <path d="M19,11 h1.5 a2.8,2.8 0 0 1 0,5.6 H19" fill="none" stroke="#171310" strokeWidth="1.7" />
      <ellipse cx="11.5" cy="10.2" rx="7" ry="1.1" fill="#6b4423" />
    </svg>
  );
  const benchEl =
    stagingOn && stagingStage !== "gone" ? (
      <div
        className={
          stagingStage === "entering"
            ? "detective-bench detective-bench-collapsing"
            : "detective-bench"
        }
        data-testid="detective-bench"
        data-staging-stage={stagingStage}
        aria-hidden="true"
      >
        {/* Cure C1 (iii): while muted, the pair's muted badge
            latches on the bench slot — the badge only; the sound
            chip stays suppressed with Watson's station cluster, so
            PR C's exactly-one-chip invariant holds in this state
            too (zero chips on the bench, one badge). */}
        {benchStage && mutedBadge ? (
          <div className="detective-bench-muted">{mutedBadge}</div>
        ) : null}
        <div className="detective-bench-figures">
          {stagingStage === "bench" ? (
            <>
              {/* Cure C1 (ii): the bench rigs speak the CASE_OPEN
                  duet — speaking follows speakingWho, so Holmes's
                  instruction line is visibly spoken by bench Holmes
                  and Watson's by bench Watson. Their poses stay the
                  seated bench poses; only the mouth flap follows
                  the speaker. */}
              <div className="detective-bench-figure" data-bench="watson" data-detective="watson">
                <WatsonRig pose="station-idle" facing="left" speaking={speakingWho === "watson"} halo={stagingOn} />
              </div>
              <div className="detective-bench-figure" data-bench="holmes" data-detective="holmes">
                <HolmesRig pose="dock" facing="right" speaking={speakingWho === "holmes"} halo={stagingOn} />
              </div>
            </>
          ) : stagingStage === "standing" ? (
            <div className="detective-bench-figure" data-bench="holmes" data-detective="holmes">
              <HolmesRig pose="dock" facing="right" speaking={false} halo={stagingOn} />
            </div>
          ) : null}
          {/* Entering: NO bench figure. Holmes leaves WITH the
              map-side entry walk (same beat); the slot collapses
              empty. A lingering bench figure — even fading — could
              paint over the first clue card: on a sheet dismiss the
              card scrolls up inside its own scroller by the full
              slot height while the slot is still mid-collapse
              (staging E2E entry window measured the overlap). The
              zero-overlap law outranks the bench-exit fade. */}
        </div>
        {stagingStage === "bench" ? (
          <>
            {cupSvg("detective-bench-cup detective-bench-cup-watson", "detective-coffee-watson")}
            {cupSvg("detective-bench-cup detective-bench-cup-holmes", "detective-coffee-holmes")}
          </>
        ) : (
          <>
            {cupSvg("detective-bench-cup-left detective-bench-cup-left-watson", "detective-coffee-left-watson")}
            {cupSvg("detective-bench-cup-left detective-bench-cup-left-holmes", "detective-coffee-left-holmes")}
          </>
        )}
        <svg
          className={
            stagingStage === "bench"
              ? "detective-bench-board"
              : "detective-bench-board detective-bench-board-faded"
          }
          data-testid="detective-bench-board"
          viewBox="0 0 340 62"
          aria-hidden="true"
        >
          <rect x="6" y="6" width="328" height="13" rx="4" fill="#8a5a33" stroke="#171310" strokeWidth="2" />
          <rect x="6" y="24" width="328" height="22" rx="4" fill="#a06a3a" stroke="#171310" strokeWidth="2" />
          <rect x="22" y="46" width="12" height="14" fill="#8a5a33" stroke="#171310" strokeWidth="2" />
          <rect x="306" y="46" width="12" height="14" fill="#8a5a33" stroke="#171310" strokeWidth="2" />
        </svg>
      </div>
    ) : null;
  return (
    <>
      {benchEl}
      {listenEl}
      {watsonReplayStationEl}
      {stationSoundEl}
      {stationHolmesMuteEl}
      {stationReady && (stationFigures.length > 0 || celebrateEl) ? (
        <div
          className={
            gutterStation
              ? "detective-host-station detective-host-station-gutter"
              : "detective-host-station"
          }
          data-testid="detective-station"
          data-companion={companionMode}
          data-holmes-placement={effectivePlacement}
          data-phase={view.phase}
          data-degradation={degradationAttr}
          data-walk-mode={degradation.walkMode}
          data-speech-mode={degradation.speechMode}
          data-staging={stagingOn ? stagingStage : "off"}
          aria-hidden="true"
          style={
            gutterStation
              ? { left: gutterLeft, top: gutterCentreTop }
              : anchor
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
