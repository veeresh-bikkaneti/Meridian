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
 * - During guessing phases Holmes renders through a portal INTO the
 *   map container ([data-testid="loop-map"], the stable element LoopMap
 *   already renders), on his own transform wrapper at the dock — the
 *   U6 waypoint companion walks that wrapper to a berth beside the
 *   player's thinking pause (companion.ts owns the pause detection,
 *   berth geometry, and auto-kill decisions). Watson does NOT join
 *   him on the map: he holds his clue-card station through the whole
 *   guessing stretch (owner ruling 2026-11-07 — an earlier view table
 *   parked him in a bottom-left dock cluster inside the map, which is
 *   the defect the owner photographed on 2026-11-08). The dock
 *   cluster markup below stays only as the host fallback for a view
 *   that still asks for it. Portal target missing → the map cluster
 *   is not rendered (never overlap blindly).
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
  createAutoKillTracker,
  createPauseDetector,
  type AutoKillTracker,
  type PauseDetector,
} from "./companion";
import {
  baseTierFor,
  createFollowTierMachine,
  dockPerch,
  followTravelMs,
  solveFollow,
  FOLLOW_CAMERA_IDLE_MS,
  FOLLOW_SOLVE_DISPLACEMENT_PX,
  FOLLOW_SOLVE_DWELL_MS,
  FOLLOW_SOLVE_MIN_INTERVAL_MS,
  FOLLOW_TELEGRAPH_MS,
  type FollowTier,
  type FollowTierMachine,
  type ForbiddenRect,
} from "./follow";
import {
  ANNOUNCEMENT_FIXED_ID,
  CASE_OPEN_WALK_MS,
  CASE_OPEN_WALK_START_OFFSET_PX,
  GUTTER_BELOW_FIGURE_PX,
  GUTTER_CARD_GAP_PX,
  GUTTER_CHIP_BELOW_LISTEN_PX,
  shouldAnnounce,
  stationChipOffsetPx,
  stationHolmesOffsetPx,
  watsonWalkDurationMs,
  WATSON_WALK_FALLBACK_GRACE_MS,
} from "./watson-walk";
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
/* The station cluster gap (4 px) and the speaker chip's clear air
 * (8 px) — two of the three look-alike gaps (the dock gap is the
 * third) that stay distinct by name (PR A re-derivation) — are
 * owned by watson-walk.ts since PR B (STATION_GAP_PX /
 * CHIP_CLEAR_PX there), where the station offset functions that
 * consume them live and are unit-pinned. */
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

type CompanionMode = "full" | "dock" | "killed" | "berth";

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
  /* Carry-in (f) cure: a RESUMED case's questions are already loaded,
   * so the bench beat must not flash — the stage starts at "standing"
   * whenever this mount is not a fresh deal, here and on case change
   * below. (Before this cure the stage initialised to "bench"
   * regardless of the resumed phase.) */
  const [stagingStage, setStagingStage] = useState<
    "bench" | "standing" | "entering" | "gone"
  >(() => (freshDeal ? "bench" : "standing"));
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

  /* -- Watson walks (PR B, watsonWalk flag; staging council Q3) -----
   * The WALKING state of the pair's host machine (PR A's stage
   * machine is the precedent for host-local states): when a clue
   * speak effect arrives, Watson WALKS the reserved gutter from the
   * previous card's centre to the new card's centre — a one-
   * dimensional vertical path, because every clue card shares the
   * column's left and width, so the gutter's x never changes. The
   * pure arithmetic (duration band, gutter derivation, announcement
   * gate) lives in watson-walk.ts; this block owns the environment:
   * the measured anchors, the cluster's transform transition, and
   * the arrival signals (transitionend + a timeout fallback).
   *
   * Speech gating: in auto speech mode the clue read is HELD
   * host-side and enqueued only on arrival — the machine stays in
   * READING until the read actually plays and drains, so the ladder
   * can never run ahead of the walker. In tap/off modes the read is
   * enqueued immediately (the shipped ladder timing is untouched)
   * and the walk is visual only. Reduced motion (walkMode "cut") or
   * a resource-constrained device (dock-only companion) never walks:
   * instant placement + immediate read, per the council's edge rule.
   *
   * This is a SECOND, parallel walker (carry-in a, named decision):
   * Holmes's walker above is 2-D map geometry — holmesXY, a walk
   * timer, and the berth solver's dock/berth/hide outcomes — while
   * Watson's is 1-D gutter travel between measured card anchors
   * whose arrival gates speech. Extracting a generic walker would
   * refactor Holmes's proven engine to share almost nothing.
   *
   * With watsonWalk off (the kill-switch) none of this runs: the
   * clue speak enqueues at reveal and Watson teleports with the
   * anchor — exactly the PR A behaviour. */
  const walkOn = stagingOn && isEnabled("watsonWalk");
  const walkOnRef = useRef(walkOn);
  walkOnRef.current = walkOn;
  const [watsonWalking, setWatsonWalking] = useState(false);
  const watsonWalkingRef = useRef(false);
  watsonWalkingRef.current = watsonWalking;
  /** True while the current walk holds its clue read host-side. */
  const [watsonWalkGated, setWatsonWalkGated] = useState(false);
  const [watsonWalkOffsetY, setWatsonWalkOffsetY] = useState(0);
  const [watsonWalkMs, setWatsonWalkMs] = useState(0);
  /** Generation counter: every walk start / arrival / cancel bumps
   * it, so a stale transitionend, timer, or rAF from a superseded
   * walk can never release (or re-release) a read. */
  const walkGenRef = useRef(0);
  const watsonWalkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkRafRef = useRef<number | null>(null);
  /** The clue read held until arrival (auto mode only). */
  const heldClueRef = useRef<{ kind: "clue"; clueIndex: number } | null>(null);
  /** The current walk's destination centre (viewport coords). */
  const walkTargetCentreRef = useRef<number | null>(null);
  /** The centre of the card Watson last arrived at (or was placed
   * at instantly) — the next walk starts from here. */
  const prevStationCentreRef = useRef<number | null>(null);
  /** The first clue walk of a case is the case-open walk (the only
   * walk the announcement may ride). Reset per case below. */
  const firstWalkOfCaseRef = useRef(true);
  /** Announcements spoken this session (host mount) — cap 2. */
  const announceCountRef = useRef(0);
  /** A held read was dropped by a sheet-open cancellation: when the
   * sheet closes, the ladder is advanced past the skipped read so
   * it can never stall waiting for a drain that will not come —
   * and the read itself never fires late. */
  const deferredDrainRef = useRef(false);
  /* Walk machinery entry points (defined with the speech player
   * below; runEffect and the transitionend handler reach them via
   * these refs, the dispatchRef pattern). */
  const walkBeginRef = useRef<
    (clueRef: { kind: "clue"; clueIndex: number }) => boolean
  >(() => false);
  const arriveWatsonRef = useRef<(gen: number) => void>(() => {});
  const cancelWatsonWalkRef = useRef<(deferDrain: boolean) => void>(
    () => {},
  );
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
  const speakingWhoRef = useRef<DetectiveSpeaker | null>(null);
  const playerRef = useRef<DetectiveSpeechPlayer | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // dispatch/runEffect are plain per-render closures over refs (the
  // machine, player, and timers all live in refs, so a fresh closure is
  // always current); effects and listeners reach them via dispatchRef.
  const runEffect = (effect: DetectiveEffect) => {
    if (effect.type === "speak") {
      // PR B: a clue read may be held by Watson's walk (arrival-
      // gated). beginWatsonWalk returns true only when it took the
      // read; every other speak — and every clue when the walk is
      // off, instant, or visual-only — enqueues exactly as shipped.
      if (
        effect.ref.kind === "clue" &&
        walkBeginRef.current(effect.ref)
      ) {
        return;
      }
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

  /* -- Watson walk machinery (PR B) -----------------------------------
   * beginWatsonWalk runs from runEffect (above, via walkBeginRef):
   * it returns TRUE when it took ownership of the clue read (auto
   * mode, animated, unconstrained) — the read is then enqueued by
   * arriveWatson and by nothing else. It returns FALSE for the
   * shipped path (flag off, instant placement, tap/off visual-only
   * walks): the caller enqueues immediately. */

  /** The active clue card's vertical centre, measured from the DOM
   * the same way the station anchor is measured (discrete events
   * only — walk starts are discrete). Null when no card is on the
   * page yet: the walk cannot start, so the read is never held. */
  const measureClueCentre = (clueIndex: number): number | null => {
    const card = document.querySelector(
      `article[aria-label^="Clue ${clueIndex}:"]`,
    );
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    return rect.top + rect.height / 2;
  };

  const arriveWatson = (gen: number) => {
    if (walkGenRef.current !== gen) return;
    walkGenRef.current += 1; // consume: transitionend vs timer, first wins
    if (watsonWalkTimerRef.current) {
      clearTimeout(watsonWalkTimerRef.current);
      watsonWalkTimerRef.current = null;
    }
    if (walkRafRef.current) {
      cancelAnimationFrame(walkRafRef.current);
      walkRafRef.current = null;
    }
    setWatsonWalking(false);
    setWatsonWalkGated(false);
    setWatsonWalkMs(0);
    setWatsonWalkOffsetY(0);
    prevStationCentreRef.current = walkTargetCentreRef.current;
    const held = heldClueRef.current;
    heldClueRef.current = null;
    // Arrival releases the held read — and ONLY arrival does. The
    // player's drain after this read is the ladder's real
    // speechEnded (the suppression in onSpeakingChange lifts with
    // heldClueRef now null).
    if (held) playerRef.current?.enqueue(held);
  };
  arriveWatsonRef.current = arriveWatson;

  /** Cancel the walk (sheet opened mid-walk; the case ended or
   * changed mid-walk). The figure's placement completes instantly —
   * he IS at the target card when the pair reappears — and a held
   * read is dropped, never fired late. `deferDrain` is the sheet
   * path only: the machine is still waiting in READING there, so
   * the sheet-close effect advances the ladder past the skipped
   * read; on a case ending the machine has already moved on and
   * no drain is owed. */
  const cancelWatsonWalk = (deferDrain: boolean) => {
    if (!watsonWalkingRef.current && !heldClueRef.current) return;
    walkGenRef.current += 1;
    if (watsonWalkTimerRef.current) {
      clearTimeout(watsonWalkTimerRef.current);
      watsonWalkTimerRef.current = null;
    }
    if (walkRafRef.current) {
      cancelAnimationFrame(walkRafRef.current);
      walkRafRef.current = null;
    }
    setWatsonWalking(false);
    setWatsonWalkGated(false);
    setWatsonWalkMs(0);
    setWatsonWalkOffsetY(0);
    prevStationCentreRef.current = walkTargetCentreRef.current;
    if (heldClueRef.current) {
      heldClueRef.current = null;
      if (deferDrain) deferredDrainRef.current = true;
    }
  };
  cancelWatsonWalkRef.current = cancelWatsonWalk;

  const beginWatsonWalk = (clueRef: { kind: "clue"; clueIndex: number }): boolean => {
    if (!walkOnRef.current) return false;
    const deg = degradationRef.current;
    const isCaseOpenWalk = firstWalkOfCaseRef.current;
    firstWalkOfCaseRef.current = false;
    const target = measureClueCentre(clueRef.clueIndex);
    const instant =
      deg.walkMode === "cut" || deg.companionMode === "dock-only";
    if (instant || target === null) {
      // Instant placement + immediate read (council edge rule), or
      // no card to walk to: the shipped timing, untouched.
      if (target !== null) prevStationCentreRef.current = target;
      return false;
    }
    const startCentre = prevStationCentreRef.current;
    const fromBench = isCaseOpenWalk || startCentre === null;
    const offsetY = fromBench
      ? -CASE_OPEN_WALK_START_OFFSET_PX
      : startCentre - target;
    const durationMs = fromBench
      ? CASE_OPEN_WALK_MS
      : watsonWalkDurationMs(offsetY);
    const gated = deg.speechMode === "auto";
    // The held read is installed BEFORE any stopAll below, so the
    // stop's drain signal is suppressed by onSpeakingChange's held
    // check — the ladder must not advance on a flush.
    heldClueRef.current = gated ? clueRef : null;
    walkTargetCentreRef.current = target;
    // Clue advance mid-read (or mid-walk): the current speech stops
    // and the queue flushes; the new read waits for arrival.
    if (speakingWhoRef.current) playerRef.current?.stopAll();
    if (watsonWalkTimerRef.current) clearTimeout(watsonWalkTimerRef.current);
    if (walkRafRef.current) cancelAnimationFrame(walkRafRef.current);
    const gen = ++walkGenRef.current;
    setWatsonWalkGated(gated);
    setWatsonWalkMs(0);
    setWatsonWalkOffsetY(offsetY);
    setWatsonWalking(true);
    // The announcement rides the CASE-OPEN walk only (cap 2 per
    // session; clue 2+ walks are silent). It is enqueued to the
    // player, so it plays DURING the walk; the held clue read is
    // host-side, so the announcement can never block it, and its
    // drain is suppressed while the read is held.
    if (
      shouldAnnounce({
        isCaseOpenWalk,
        announcedThisSession: announceCountRef.current,
        speechMode: deg.speechMode,
      })
    ) {
      announceCountRef.current += 1;
      playerRef.current?.enqueue({
        kind: "fixed",
        id: ANNOUNCEMENT_FIXED_ID,
      });
    }
    walkRafRef.current = requestAnimationFrame(() => {
      walkRafRef.current = null;
      if (walkGenRef.current !== gen) return;
      setWatsonWalkMs(durationMs);
      setWatsonWalkOffsetY(0);
    });
    watsonWalkTimerRef.current = setTimeout(
      () => arriveWatsonRef.current(gen),
      durationMs + WATSON_WALK_FALLBACK_GRACE_MS,
    );
    return gated;
  };
  walkBeginRef.current = beginWatsonWalk;

  useEffect(() => {
    const player = createDetectiveSpeech({
      caseIndex,
      onSpeakingChange: (who) => {
        setSpeakingWho(who);
        speakingWhoRef.current = who;
        if (who === null) {
          // PR B: while a clue read is held by the walk, a drain is
          // NOT the ladder's speechEnded — it is the announcement
          // finishing, or a stopAll flush (mute / mid-read advance).
          // The real drain comes after arrival releases the read.
          // The same holds while a drain is DEFERRED (sheet opened
          // mid-walk and dropped the held read): the cancel cleared
          // heldClueRef, so without this second guard the
          // announcement's own drain would advance the ladder during
          // the sheet and the ack would play behind it. The
          // sheet-close effect consumes deferredDrainRef and
          // dispatches the one real speechEnded itself.
          if (heldClueRef.current || deferredDrainRef.current) return;
          dispatchRef.current({ type: "speechEnded" });
        }
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
    setStagingStage(freshDeal ? "bench" : "standing");
    entryPendingRef.current = false;
    /* Carry-in (e): entry intent recorded during a previous case's
     * bench must not fire into this case — reset it with the other
     * per-case entry state. */
    entryIntentRef.current = false;
    /* PR B: the walk restarts per case (the announcement's
     * case-open walk is this case's first clue walk); the session
     * announcement count is NOT reset — the cap is per session. */
    walkGenRef.current += 1;
    if (watsonWalkTimerRef.current) {
      clearTimeout(watsonWalkTimerRef.current);
      watsonWalkTimerRef.current = null;
    }
    if (walkRafRef.current) {
      cancelAnimationFrame(walkRafRef.current);
      walkRafRef.current = null;
    }
    heldClueRef.current = null;
    deferredDrainRef.current = false;
    prevStationCentreRef.current = null;
    firstWalkOfCaseRef.current = true;
    setWatsonWalking(false);
    setWatsonWalkGated(false);
    setWatsonWalkMs(0);
    setWatsonWalkOffsetY(0);
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

  /* PR B: the sheet opening mid-walk cancels the walk (the council's
   * stale-read condition): a held read is dropped and must NEVER
   * fire late. When the sheet closes, the ladder is advanced past
   * the skipped read (deferredDrainRef, set by the cancel) so the
   * case continues — the ack/decode that follow the read play
   * normally in the open. The announcement count is untouched: a
   * cancelled case-open walk already spent its announcement. */
  useEffect(() => {
    if (sheetOpen) {
      cancelWatsonWalkRef.current(true);
      return;
    }
    if (deferredDrainRef.current) {
      deferredDrainRef.current = false;
      dispatchRef.current({ type: "speechEnded" });
    }
  }, [sheetOpen]);

  /* PR B: a case ending mid-walk cancels the walk with no drain
   * owed — the machine has left READING, and the ending's own lines
   * own the queue from here. */
  useEffect(() => {
    if (
      view.phase === "CELEBRATE" ||
      view.phase === "DEBRIEF" ||
      view.phase === "FAIL_READ" ||
      view.phase === "POUT"
    ) {
      cancelWatsonWalkRef.current(false);
    }
  }, [view.phase]);

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
   * the interaction handlers themselves are untouched.
   *
   * Cure D2 (PR #364 cure round 2): with holmesFollow ON, Holmes
   * enters automatically at "standing" — no map touch required.
   * The owner's PB-1 role model is explicit: bench + intro are
   * first-entry only, and once play starts the pair holds roles
   * (Watson at the clues, Holmes on the map following the pointer
   * across the whole page), so a follow-ON Holmes waiting at the
   * bench for a map interaction never takes his post. This uses
   * the same enterMap path as C2 intent (his first placement is
   * the entry dock; the follow machinery owns him from there).
   * With the flag OFF nothing changes: entry stays intent-only
   * (cure D). followFlagOn is the boot-time flag const declared
   * with the follow section below; it is read only inside the
   * effect body, which runs after render, so the declaration is
   * initialised by then — it cannot sit in this deps array. */
  useEffect(() => {
    if (stagingStage !== "standing") return;
    if (!entryIntentRef.current && !followFlagOn) return;
    entryIntentRef.current = false;
    enterMapRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
   * DEBRIEF and left the slot reserved through the endings.
   *
   * Close-berth cure (2026-11-07, defect 1): C3 as shipped fired
   * only in CELEBRATE / DEBRIEF / FAIL_READ / POUT — it omitted
   * SELECTION_READ, the phase the machine sits in while LoopScreen
   * already shows "Case closed" (the ending is stored as the
   * machine's pendingEnd until the selection-read speech drains).
   * On search-box play the bench therefore stood through the whole
   * closed window (DIAGNOSIS-bench-at-close.md). The cure drives
   * the forced entry from the game's own `status` prop as well:
   * status flips to won/lost in the same commit that renders
   * "Case closed", so entry fires at close, not when the speech
   * queue drains. The phase list stays for the paths where the
   * machine reaches an ending phase in step with the status. */
  useEffect(() => {
    if (!stagingOn) return;
    if (
      view.phase !== "CELEBRATE" &&
      view.phase !== "DEBRIEF" &&
      view.phase !== "FAIL_READ" &&
      view.phase !== "POUT" &&
      status !== "won" &&
      status !== "lost"
    )
      return;
    if (stagingStage !== "standing") return;
    enterMapRef.current();
  }, [stagingOn, view.phase, stagingStage, status]);

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

  /* -- proximity follow (Pair Behaviour PR 1) -------------------------
   * The waypoint berth engine is REMOVED — no dock home, no
   * exitToDock, no >320 px remote rule, no dual paths. Holmes lives
   * in a position:fixed portal overlay at the app root (rendered
   * below), positioned in VIEWPORT coordinates, and he follows the
   * pointer across the WHOLE PAGE: window-level Pointer Events write
   * only to refs (zero React state per move); solves run on >= 32 px
   * displacement or >= 150 ms dwell, at most one per 100 ms; the
   * pure solver (follow.ts) rings the pointer with 8 scored berths
   * against the cached ForbiddenRect[] and he STAYS where he lands —
   * holmesXYRef is positional memory that persists across cases,
   * phase exits, and bursts. Nothing in this section ever moves him
   * "home": phase exits and gesture resumes do not touch his
   * position at all.
   *
   * Suspension (he plants and waits, then solves again at the
   * pointer's LAST position): scroll/pinch (the pinch centroid is
   * never a target), any speech (position locked while a line
   * plays), and bursts — sheet open / rings / camera moves / pin
   * commits, all of which surface as a hidden view or a non-SEARCH
   * phase, plus a ~120 ms camera-idle tail after map gestures.
   *
   * Tiers (one solver): PAGE_FOLLOW solves on displacement/dwell;
   * PAUSE_BERTH solves only on a confirmed thinking pause (the
   * detector below) — page-wide, and it still stays; that is also
   * the holmesFollow-flag-OFF behaviour. DOCK_ONLY pins him to the
   * viewport perch (the degradation matrix's dock-only devices, and
   * the perf bottom tier). The follow latch is its OWN: the shared
   * auto-kill tracker feeds it, a kill steps the tier DOWN, and
   * re-qualification (a sustained healthy window, or the case-open
   * probe at case change — the #362 pattern) steps it back UP.
   * ZERO follow audio, by design. */
  const followFlagOn = isEnabled("holmesFollow");
  const detectorRef = useRef<PauseDetector | null>(null);
  if (!detectorRef.current) detectorRef.current = createPauseDetector();
  const killRef = useRef<AutoKillTracker | null>(null);
  if (!killRef.current) killRef.current = createAutoKillTracker();
  const tierMachineRef = useRef<FollowTierMachine | null>(null);
  if (!tierMachineRef.current) {
    tierMachineRef.current = createFollowTierMachine(
      baseTierFor({ followFlagOn, dockOnlyDevice: false }),
    );
  }
  const [followTier, setFollowTier] = useState<FollowTier>(
    () => tierMachineRef.current!.tier,
  );
  const followTierRef = useRef(followTier);
  followTierRef.current = followTier;
  /** data-companion compat: the U10 spec surface keeps its three
   * historical values mapped from the tier machine (a stepped-down
   * tier after a kill reads "killed" only while DOCK_ONLY-by-kill;
   * by-design dock-only reads "dock"). */
  const companionKilledRef = useRef(false);
  /* Cure B (PR #364 cure round): with holmesFollow OFF, data-companion
   * must keep main's three historical values — the tier remap below
   * reads "berth" for the flag-OFF base tier (PAUSE_BERTH from first
   * render), a value that never existed on main, breaking every
   * flag-OFF spec (kill-switch integrity). The legacy mirror state
   * re-derives main's state machine ("full" | "dock" | "killed") and
   * is engaged ONLY when the flag is off; it is updated at the three
   * transition points that map 1:1 onto main's three effects (base /
   * degradation, case change, auto-kill judge). The tier machine and
   * data-follow-tier are untouched. */
  const [legacyCompanionMode, setLegacyCompanionMode] = useState<
    "full" | "dock" | "killed"
  >("full");
  const legacyModeForDegradation = (): "full" | "dock" =>
    degradationRef.current.companionMode === "dock-only" ? "dock" : "full";
  const companionMode: CompanionMode = followFlagOn
    ? followTier === "PAGE_FOLLOW"
      ? "full"
      : followTier === "PAUSE_BERTH"
        ? "berth"
        : companionKilledRef.current
          ? "killed"
          : "dock"
    : legacyCompanionMode;
  /* Base tier follows the flag + the degradation matrix. */
  useEffect(() => {
    // Cure B, point 1: the mirror updates HERE so label + tier stay in
    // sync if the flags resolve late (suppressed while the kill latch
    // is set, exactly like main's degradation effect).
    if (!followFlagOn && !companionKilledRef.current) {
      setLegacyCompanionMode(legacyModeForDegradation());
    }
    const m = tierMachineRef.current!;
    setFollowTier(
      m.setBase(
        baseTierFor({
          followFlagOn,
          dockOnlyDevice: degradation.companionMode === "dock-only",
        }),
      ),
    );
  }, [degradation.companionMode, followFlagOn]);
  /* Case-open re-qualification probe (#362 pattern): a kill never
   * crosses a case boundary — the tracker resets and the tier steps
   * back up to base, so one bad case can never dock Holmes for a
   * whole run. His POSITION is untouched: positional memory. */
  const seenKillCaseRef = useRef(caseIndex);
  useEffect(() => {
    if (seenKillCaseRef.current === caseIndex) return;
    seenKillCaseRef.current = caseIndex;
    companionKilledRef.current = false;
    // Cure B, point 2: the latch reset above re-derives the mirror
    // (main's case-change effect) — flag-OFF only.
    if (!followFlagOn) setLegacyCompanionMode(legacyModeForDegradation());
    killRef.current?.reset();
    const m = tierMachineRef.current!;
    let t = m.tier;
    while (t !== m.baseTier) t = m.requalify();
    setFollowTier(t);
  }, [caseIndex]);
  /** Holmes's overlay position, VIEWPORT px (top-left). This state
   * is the positional memory: it is written by the entry walk, by
   * follow solves, and by the DOCK_ONLY perch — and by nothing else.
   * In particular no effect resets it on case or phase change. */
  const [holmesXY, setHolmesXY] = useState({ x: HOLMES_DOCK_X, y: 0 });
  const holmesXYRef = useRef(holmesXY);
  holmesXYRef.current = holmesXY;
  const [holmesTransition, setHolmesTransition] = useState({
    durationMs: 0,
    easing: EASE_OUT,
  });
  const [walking, setWalking] = useState(false);
  const [berthed, setBerthed] = useState(false);
  const berthedRef = useRef(false);
  /** Head-turn telegraph: his facing flips toward the target ~120 ms
   * before the walk starts (data-follow-telegraph on the wrapper). */
  const [followFacing, setFollowFacing] = useState<"left" | "right">("right");
  const [followTelegraph, setFollowTelegraph] = useState(false);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telegraphTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* C-precision (PR #364 cure): eviction-only machinery. evictionTimerRef
   * is the ONE deferred legality re-check (unmount-cleaned alongside
   * walkTimerRef/telegraphTimerRef); evictionArmRef keys that arm to
   * the judged holmesXY and marks whether its firing may ACT as the
   * confirming second measure; followTravelEndRef stamps the moment
   * the current glide lands (telegraph + travel), stamped in
   * applyFollowTarget where both values are computed. */
  const evictionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evictionArmRef = useRef<{
    x: number;
    y: number;
    confirm: boolean;
  } | null>(null);
  const followTravelEndRef = useRef(0);
  const followPlacedRef = useRef(false);

  /** The old dock spot, in viewport coordinates — now used ONLY as
   * his first placement (entry) and never as a return target. */
  const dockXY = () => {
    const r = mapRectRef.current;
    return r
      ? {
          x: r.left + HOLMES_DOCK_X,
          y: r.top + r.height - DOCK_INSET - HOLMES_BOX.h,
        }
      : {
          x: HOLMES_DOCK_X,
          y: window.innerHeight - DOCK_INSET - HOLMES_BOX.h,
        };
  };

  /* Cure C (PR #364 cure round) — placement legality helpers.
   * PR #364 moved Holmes to a position:fixed app-root portal with no
   * clipping ancestor, and no placement writer except solveFollow
   * ever checked the forbidden rects — so a stale or unchecked
   * landing paints him over clue text (the zero-overlap law is
   * PRODUCT LAW). These helpers measure the forbidden set FRESH
   * (the same DOM sources rebuildForbidden caches, written back to
   * the cache) and test Holmes's box against it. Geometry/refs only:
   * Holmes stays answer-blind. */
  const measureForbiddenRects = (): ForbiddenRect[] => {
    const out: ForbiddenRect[] = [];
    const push = (el: Element | null, pad = 0) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      out.push({
        x: r.left - pad,
        y: r.top - pad,
        w: r.width + pad * 2,
        h: r.height + pad * 2,
      });
    };
    document
      .querySelectorAll('article[aria-label^="Clue "]')
      .forEach((el) => push(el));
    push(document.querySelector('[data-testid="detective-station"]'));
    push(document.querySelector('[data-testid="detective-dock"]'));
    push(document.querySelector("header"));
    push(document.querySelector('[data-testid="loop-result-card"]'));
    push(document.querySelector('[data-testid="loop-reveal"]'));
    mapElRef.current
      ?.querySelectorAll(".maplibregl-marker")
      .forEach((el) => push(el, 48));
    return out;
  };
  const holmesBoxHitsForbidden = (
    target: { x: number; y: number },
    rects: ForbiddenRect[],
  ): boolean =>
    rects.some(
      (r) =>
        target.x < r.x + r.w &&
        target.x + HOLMES_BOX.w > r.x &&
        target.y < r.y + r.h &&
        target.y + HOLMES_BOX.h > r.y,
    );
  /** Gate for every non-solver placement writer: rebuild the
   * forbidden rects fresh (never the cache), then test the box. */
  const freshPlacementLegal = (target: { x: number; y: number }): boolean => {
    const rects = measureForbiddenRects();
    forbiddenRef.current = rects;
    return !holmesBoxHitsForbidden(target, rects);
  };
  /** Cure C, point 3 (defence-in-depth): the entry dock measured
   * from the LIVE map element at call time, not the mapRectRef
   * cache — the cache is taken at scroll 0 with the map below the
   * fold, which placed Holmes below the viewport in the C-1 traces. */
  const liveDockXY = () => {
    const node = document.querySelector('[data-testid="loop-map"]');
    if (!node) return dockXY();
    const r = node.getBoundingClientRect();
    return {
      x: r.left + HOLMES_DOCK_X,
      y: r.top + r.height - DOCK_INSET - HOLMES_BOX.h,
    };
  };

  /* Staging entry walk (PR A unit 4), retargeted to viewport
   * coordinates: the FIRST map interaction walks Holmes from below
   * the map to his first placement. After that the follow engine
   * owns his position; a berth confirmed during the entry supersedes
   * the entry target (entryPendingRef) — he simply walks on. */
  /* Cure D (PR #364 cure round): main bound the pointer listeners to
   * the MAP ELEMENT ONLY, so entry intent could only ever come from
   * the map. The follow wiring is window-level now (page-wide follow
   * stays), and an unconditional enterMap on every pointerdown armed
   * entryIntentRef for clicks ANYWHERE — e.g. the staging tests'
   * unlockSpeech clicks on the "GeoDetective" heading — so the C2
   * effect fired the instant the duet ended and the "standing" stage
   * was never observable. Callers now pass onMap: entry intent is
   * recorded ONLY for map-originated interactions. The default stays
   * true so the unconditional callers keep main's entry semantics:
   * onPauseConfirmed (a genuine page-wide pause still enters +
   * berths him — PB-1) and the internal C2/C3 effects. */
  const enterMap = (onMap = true) => {
    if (!stagingOn) return;
    if (stagingStageRef.current === "bench") {
      if (onMap) entryIntentRef.current = true;
      return;
    }
    if (
      stagingStageRef.current === "entering" ||
      stagingStageRef.current === "gone"
    )
      return;
    setStagingStage("entering");
    if (berthedRef.current) return; // already following: no entry walk
    const dock = liveDockXY();
    followPlacedRef.current = true;
    // Cure C, point 1: if the entry dock intersects a fresh forbidden
    // rect, do not land there — the stage still enters (the slot
    // collapses), and the eviction check / follow solves place him
    // legally instead of painting him over clue text.
    if (!freshPlacementLegal(dock)) return;
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
      // C-precision: stamp the entry walk's landing so the eviction
      // settled gate can wait it out (a ref write only — no landing
      // behaviour changes).
      followTravelEndRef.current = performance.now() + 700;
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

  /* Unmount cleanup for the entry + follow machinery. */
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
      if (telegraphTimerRef.current) {
        clearTimeout(telegraphTimerRef.current);
        telegraphTimerRef.current = null;
      }
      if (evictionTimerRef.current) {
        clearTimeout(evictionTimerRef.current);
        evictionTimerRef.current = null;
      }
      evictionArmRef.current = null;
      if (watsonWalkTimerRef.current) {
        clearTimeout(watsonWalkTimerRef.current);
        watsonWalkTimerRef.current = null;
      }
      if (walkRafRef.current) {
        cancelAnimationFrame(walkRafRef.current);
        walkRafRef.current = null;
      }
    };
  }, []);

  /* -- follow engine state (refs only — the hot path never renders) - */
  const followRef = useRef({
    lastPointer: null as { x: number; y: number; pointerType: string } | null,
    lastSolved: null as { x: number; y: number } | null,
    lastSolveT: 0,
    pointersDown: 0,
    lastMapActivityT: 0,
    scrollingUntil: 0,
    cameraBusyUntil: 0,
    dwellTimer: null as ReturnType<typeof setTimeout> | null,
    scrollTimer: null as ReturnType<typeof setTimeout> | null,
  });
  /** ForbiddenRect[] cache: rebuilt on resize / scroll-end / clue,
   * phase and case changes (the effect + wiring below) — never
   * measured in the pointer hot path. Sources are DOM geometry of
   * things already visible to the player: every clue article, the
   * station + dock clusters (Watson), the page header, the result
   * card, and the map's DOM markers (the pin; rings are GL layers
   * whose ground is the pin marker's own rect, padded below). */
  const forbiddenRef = useRef<ForbiddenRect[]>([]);
  const rebuildForbidden = () => {
    forbiddenRef.current = measureForbiddenRects();
  };
  const rebuildForbiddenRef = useRef(rebuildForbidden);
  rebuildForbiddenRef.current = rebuildForbidden;
  /* Cure C: the current-position eviction check (defined below,
   * after solveFollowAt) is reached through this ref from the
   * rebuild triggers that sit above its definition. */
  const checkHolmesLegalityRef = useRef<() => void>(() => {});
  useEffect(() => {
    rebuildForbiddenRef.current();
    // Cure C, point 2: after every forbidden rebuild, test Holmes's
    // CURRENT box against the fresh rects — host-caused layout
    // motion (reading scroll, bench-slot collapse, clue reveal) can
    // move clue text under a Holmes who never moved himself.
    checkHolmesLegalityRef.current();
  }, [phase, cluesRevealed, caseIndex, status]);

  const followSuspended = (): boolean => {
    const v = viewRef.current;
    if (v.hidden) return true;
    if (v.phase !== "SEARCH_IDLE" && v.phase !== "SEARCH_AREA") return true;
    if (speakingWhoRef.current) return true; // locked during speech
    const s = followRef.current;
    const now = performance.now();
    if (s.pointersDown >= 2) return true; // pinch: centroid never a target
    if (now < s.scrollingUntil) return true; // planted during scroll
    if (now < s.cameraBusyUntil) return true; // camera moving / settling
    return false;
  };
  const followSuspendedRef = useRef(followSuspended);
  followSuspendedRef.current = followSuspended;

  /** Travel to a solved berth: head-turn telegraph ~120 ms first,
   * then ONE translate3d transition (0.3–0.8 s, distance-capped).
   * Travelling is low-intensity (walk pose, no gestures); on arrival
   * the machine's own pose takes over at full idle life. */
  const applyFollowTarget = (target: { x: number; y: number }) => {
    const cur = holmesXYRef.current;
    const dist = Math.hypot(target.x - cur.x, target.y - cur.y);
    berthedRef.current = true;
    setBerthed(true);
    if (dist < 4) return;
    entryPendingRef.current = false; // a berth supersedes the entry walk
    // C-precision: stamp the landing moment (telegraph delay + travel
    // duration, both computed here) so eviction never judges mid-glide,
    // even if the walking/telegraph state flickers off early.
    followTravelEndRef.current =
      performance.now() +
      FOLLOW_TELEGRAPH_MS +
      (degradationRef.current.walkMode === "cut" ? 0 : followTravelMs(dist));
    setFollowFacing(target.x >= cur.x ? "right" : "left");
    setFollowTelegraph(true);
    if (telegraphTimerRef.current) clearTimeout(telegraphTimerRef.current);
    telegraphTimerRef.current = setTimeout(() => {
      telegraphTimerRef.current = null;
      setFollowTelegraph(false);
      if (followSuspendedRef.current()) {
        followTravelEndRef.current = 0; // no travel launched: no landing
        return; // conditions changed: stay
      }
      const durationMs =
        degradationRef.current.walkMode === "cut"
          ? 0
          : followTravelMs(dist);
      setHolmesTransition({ durationMs, easing: EASE_OUT });
      setHolmesXY(target);
      // C-precision: refine the landing stamp to the launched glide.
      followTravelEndRef.current = performance.now() + durationMs;
      if (durationMs > 0) {
        setWalking(true);
        if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
        walkTimerRef.current = setTimeout(() => {
          walkTimerRef.current = null;
          setWalking(false);
        }, durationMs);
      }
    }, FOLLOW_TELEGRAPH_MS);
  };
  const applyFollowTargetRef = useRef(applyFollowTarget);
  applyFollowTargetRef.current = applyFollowTarget;

  /** One solve at a pointer position. A null solve (nothing legal)
   * leaves Holmes exactly where he is — staying is always legal. */
  const solveFollowAt = (point: { x: number; y: number }, pointerType: string) => {
    if (followTierRef.current === "DOCK_ONLY") return;
    if (followSuspendedRef.current()) return;
    const berth = solveFollow({
      pointer: point,
      holmesBox: HOLMES_BOX,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      forbidden: forbiddenRef.current,
      pointerType,
      currentCentre: {
        x: holmesXYRef.current.x + HOLMES_BOX.w / 2,
        y: holmesXYRef.current.y + HOLMES_BOX.h / 2,
      },
    });
    followRef.current.lastSolved = { x: point.x, y: point.y };
    followRef.current.lastSolveT = performance.now();
    if (!berth) return;
    applyFollowTargetRef.current({ x: berth.x, y: berth.y });
  };
  const solveFollowAtRef = useRef(solveFollowAt);
  solveFollowAtRef.current = solveFollowAt;

  /* Cure C, point 2 — current-position eviction. holmesHidden is the
   * burst-hide state: while his current box is illegal AND a
   * suspension holds (speech above all — he must not travel
   * mid-speech; the follow spec's speech-lock gate pins that), he is
   * hidden with the existing .detective-host-holmes-hidden pattern
   * (80 ms) rather than painted over clue text, and re-solved when
   * the suspension lifts. When no suspension holds he re-solves at
   * the last pointer immediately, through the same pure solver. */
  const [holmesHidden, setHolmesHidden] = useState(false);
  const holmesHiddenRef = useRef(false);
  const setHolmesHiddenBoth = (hidden: boolean) => {
    holmesHiddenRef.current = hidden;
    setHolmesHidden(hidden);
  };
  /* F1 cure attempt 2 (PR #364): the sheet-close hold. Dismissing
   * the place-confirm sheet can scroll the page under Holmes's
   * stored berth (the sheet's button sits down-page, so the tap
   * scrolls the page to reach it and a clue card lands where his
   * berth was legal when solved). Attempt 1 re-judged legality on
   * the close but still PAINTED him at the unchecked berth while
   * its glide travelled. So from the close event he stays in
   * hide-withdraw until a legality check against FRESH rects —
   * measured after the scroll settles — has passed: the check
   * below reveals him at the stored berth when it is legal, or
   * places him straight onto a re-solved berth (no glide out of
   * the illegal spot) when it is not. The hold clears only when a
   * check passes or a teleport lands him legally. */
  const sheetCloseHoldRef = useRef(false);
  /** The first legal DOCK_ONLY perch: dockPerch's bottom-left first
   * (kept whenever legal — behaviour at 1280 unchanged), then the
   * other viewport corners in reading order. */
  const legalPerch = (
    rects: ForbiddenRect[],
  ): { x: number; y: number } | null => {
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const def = dockPerch(HOLMES_BOX, viewport);
    const spots = [
      def,
      { x: viewport.w - DOCK_INSET - HOLMES_BOX.w, y: def.y },
      { x: def.x, y: DOCK_INSET },
      { x: viewport.w - DOCK_INSET - HOLMES_BOX.w, y: DOCK_INSET },
    ];
    for (const spot of spots) {
      if (!holmesBoxHitsForbidden(spot, rects)) return spot;
    }
    return null;
  };
  const legalPerchRef = useRef(legalPerch);
  legalPerchRef.current = legalPerch;

  /* C-precision (PR #364 cure): the deferred eviction re-check. Arms
   * ONE timer (superseding any previous arm) keyed to the judged
   * position; on firing it rebuilds the forbidden rects FRESH and
   * re-enters the legality check, which re-judges the CURRENT
   * position by construction. */
  const scheduleEvictionCheck = (
    delayMs: number,
    confirm: boolean,
    cur: { x: number; y: number },
  ) => {
    if (evictionTimerRef.current) clearTimeout(evictionTimerRef.current);
    evictionArmRef.current = { x: cur.x, y: cur.y, confirm };
    evictionTimerRef.current = setTimeout(() => {
      evictionTimerRef.current = null;
      rebuildForbiddenRef.current();
      checkHolmesLegalityRef.current();
    }, Math.max(0, delayMs));
  };
  const clearEvictionCheck = () => {
    if (evictionTimerRef.current) {
      clearTimeout(evictionTimerRef.current);
      evictionTimerRef.current = null;
    }
    evictionArmRef.current = null;
  };

  const checkHolmesLegality = () => {
    const cur = holmesXYRef.current;
    /* C-precision settled gate: a mid-motion position is NEVER
     * judged. While any motion signal is active — walking, the
     * follow telegraph (state or its timer), an entry walk pending,
     * a stamped travel landing still ahead, page scroll, or a busy
     * camera — arm the one deferred re-check for the latest motion
     * horizon + ~30 ms and return. Geometry measured mid-scroll /
     * mid-glide is transient; the settled re-check judges the settled
     * box against settled rects. Bounded exposure: a genuinely
     * illegal settled overlap whose trigger coincides with motion
     * waits one defer/confirm cycle (~250-300 ms) before eviction;
     * the writer gates are untouched, so no NEW illegal landing can
     * be created in that window. */
    const now = performance.now();
    const fs = followRef.current;
    const motionUntil = Math.max(
      followTravelEndRef.current,
      fs.scrollingUntil,
      fs.cameraBusyUntil,
    );
    const moving =
      walking ||
      followTelegraph ||
      walkTimerRef.current !== null ||
      telegraphTimerRef.current !== null ||
      entryPendingRef.current ||
      now < motionUntil;
    if (moving) {
      scheduleEvictionCheck(
        motionUntil > now ? motionUntil - now + 30 : 250,
        false,
        cur,
      );
      return;
    }
    const rects = forbiddenRef.current;
    if (!holmesBoxHitsForbidden(cur, rects)) {
      clearEvictionCheck();
      // A legal verdict is the sheet-close hold's pass: reveal him
      // where he already stands — that IS the legal position.
      sheetCloseHoldRef.current = false;
      if (holmesHiddenRef.current) setHolmesHiddenBoth(false);
      return;
    }
    /* C-precision two-measure confirm: a settled illegal verdict
     * inside the ~250 ms window after the last motion horizon is a
     * first measure only — geometry may still be settling from the
     * scroll/glide that just ended. Defer ONCE to the end of that
     * window; the deferred re-check (arm.confirm, same position)
     * is the confirming second measure. Legal at confirm un-hides
     * via the branch above and never moves him; a position change
     * drops the arm (the holmesXY effect below), so a new position
     * always earns its own first measure. */
    const arm = evictionArmRef.current;
    const confirmed =
      arm !== null && arm.confirm && arm.x === cur.x && arm.y === cur.y;
    if (!confirmed && motionUntil > 0 && now < motionUntil + 250) {
      scheduleEvictionCheck(motionUntil + 250 - now + 30, true, cur);
      return;
    }
    clearEvictionCheck();
    if (followTierRef.current === "DOCK_ONLY") {
      // The tier never berths: move the pin itself to a legal corner,
      // or hide him when no corner is legal. This path already
      // places him in one step (no glide), so it satisfies the
      // sheet-close hold either way — revealed on a legal perch,
      // or still hidden with no legal corner.
      sheetCloseHoldRef.current = false;
      const perch = legalPerch(rects);
      if (!perch) {
        setHolmesHiddenBoth(true);
        return;
      }
      setHolmesHiddenBoth(false);
      berthedRef.current = false;
      setBerthed(false);
      setHolmesTransition({ durationMs: 0, easing: EASE_OUT });
      setHolmesXY(perch);
      return;
    }
    if (followSuspendedRef.current()) {
      setHolmesHiddenBoth(true);
      return;
    }
    const pt = followRef.current.lastPointer;
    if (!pt) {
      setHolmesHiddenBoth(true);
      return;
    }
    const berth = solveFollow({
      pointer: pt,
      holmesBox: HOLMES_BOX,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      forbidden: rects,
      pointerType: pt.pointerType,
      currentCentre: {
        x: cur.x + HOLMES_BOX.w / 2,
        y: cur.y + HOLMES_BOX.h / 2,
      },
    });
    followRef.current.lastSolved = { x: pt.x, y: pt.y };
    followRef.current.lastSolveT = performance.now();
    if (!berth) {
      // Nothing legal at the pointer either: staying painted over
      // text is the one outcome the law forbids — hide instead.
      setHolmesHiddenBoth(true);
      return;
    }
    if (sheetCloseHoldRef.current) {
      // F1 attempt 2: under the sheet-close hold he must be revealed
      // AT the legal position, never glide out of the unchecked
      // berth painted over the card that slid under him — so the
      // solved berth is placed in one step (the same instant-place
      // the DOCK_ONLY perch above uses) and only then un-hidden.
      sheetCloseHoldRef.current = false;
      berthedRef.current = true;
      setBerthed(true);
      setHolmesTransition({ durationMs: 0, easing: EASE_OUT });
      setHolmesXY({ x: berth.x, y: berth.y });
      setHolmesHiddenBoth(false);
      return;
    }
    setHolmesHiddenBoth(false);
    applyFollowTargetRef.current({ x: berth.x, y: berth.y });
  };
  checkHolmesLegalityRef.current = checkHolmesLegality;

  /* Suspension lift (speech end): the speech lock is the suspension
   * that must never leave him painted over text, so the moment a
   * line finishes the legality check runs again on fresh rects — a
   * hidden Holmes re-solves now, a legal one simply un-hides. */
  useEffect(() => {
    if (speakingWho) return;
    rebuildForbiddenRef.current();
    checkHolmesLegalityRef.current();
  }, [speakingWho]);

  /* F1 cure attempt 2: the sheet-close hold, armed on the close
   * transition itself. Declared after the sheet dispatch effect
   * (top of this file), so the machine has processed sheetClosed
   * when this runs. He is withdrawn BEFORE his first post-close
   * paint at the stored berth, and the settle check is armed for
   * after the dismiss scroll lands and goes quiet: the eviction
   * timer rebuilds the forbidden rects fresh when it fires, and
   * the legality check's own motion gate defers again if the page
   * is still moving then — so the verdict that reveals or
   * re-places him is always judged on settled, fresh geometry.
   * 300 ms covers the measured dismiss scroll (lands ~56 ms after
   * the tap, quiet ~180 ms later) with margin. */
  const prevSheetHoldRef = useRef(sheetOpen);
  useEffect(() => {
    const wasOpen = prevSheetHoldRef.current;
    prevSheetHoldRef.current = sheetOpen;
    if (!wasOpen || sheetOpen) return;
    sheetCloseHoldRef.current = true;
    setHolmesHiddenBoth(true);
    scheduleEvictionCheck(300, false, holmesXYRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  /* A legal landing un-hides him: any placement writer (entry,
   * perch, follow solve) that lands his box on legal ground clears
   * the burst-hide. Illegal landings are gated upstream, so this
   * only ever fires on a legal spot or not at all. */
  useEffect(() => {
    // F1 land backstop — reveal on arrival: attempt 2's probe found
    // him still hidden seconds after settling on a legal berth,
    // because a scroll-end glide changed his position and the
    // arm-cancel below threw away the pending settle re-check, and
    // no later trigger fired to reveal him. So a position change
    // under the sheet-close hold does not just cancel the old
    // check: it arms a fresh settle check for the NEW position.
    // The legality check's own motion gate defers that check until
    // the travel has actually landed, then it reveals him there if
    // legal or places him on a re-solved berth if not — either way
    // the hold cannot leave him hidden indefinitely.
    if (sheetCloseHoldRef.current && holmesHiddenRef.current) {
      scheduleEvictionCheck(300, false, holmesXY);
      return;
    }
    // C-precision: a new landing supersedes any eviction arm keyed
    // to the previous position — cancel it before it can confirm a
    // verdict against a position he no longer occupies.
    const arm = evictionArmRef.current;
    if (arm && (arm.x !== holmesXY.x || arm.y !== holmesXY.y)) {
      clearEvictionCheck();
    }
    if (!holmesHiddenRef.current) return;
    // F1 attempt 2: while the sheet-close hold stands, a landing
    // alone never reveals him — the settled fresh-rect check in
    // checkHolmesLegality owns the reveal, so a solve that lands
    // mid-hold cannot paint him before that check has passed.
    if (sheetCloseHoldRef.current) return;
    if (!holmesBoxHitsForbidden(holmesXY, measureForbiddenRects())) {
      setHolmesHiddenBoth(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holmesXY]);

  /* Round 7 (diagnosis Q2): recovery from a step-down that
   * interrupted a berth. The DOCK_ONLY pin below teleports XY to
   * the perch, but the berth claim (his own flag or the machine's
   * placement) survives, and the pause that earned the berth is
   * consumed \u2014 nothing ever re-solves, so he would sit at the
   * perch under a "berth" label forever. When the tier steps back
   * UP out of DOCK_ONLY and he is still exactly at the perch under
   * a live berth claim, re-solve once at the last pointer so the
   * berth is re-earned. By-design dock-only devices never leave
   * DOCK_ONLY, so this never fires for them. */
  const prevTierRef = useRef(followTier);
  useEffect(() => {
    const prev = prevTierRef.current;
    prevTierRef.current = followTier;
    if (prev !== "DOCK_ONLY" || followTier === "DOCK_ONLY") return;
    const claimed =
      berthedRef.current || viewRef.current.holmes.placement === "berth";
    if (!claimed) return;
    const perch = legalPerchRef.current(forbiddenRef.current);
    const cur = holmesXYRef.current;
    if (!perch || cur.x !== perch.x || cur.y !== perch.y) return;
    const p = followRef.current.lastPointer;
    if (p) solveFollowAtRef.current(p, p.pointerType);
  }, [followTier]);

  /** DOCK_ONLY: pin him to the viewport perch when the tier lands
   * there (by-design dock-only device, or the perf bottom tier after
   * two kill verdicts). This is a pin, not a return: the tier never
   * berths, so there is nothing to return FROM. */
  useEffect(() => {
    if (followTier !== "DOCK_ONLY") return;
    // Cure C, points 1+2 (the C-2 traces): the perch pin used to land
    // at bottom-left with NO forbidden check — after the reading
    // scroll, bottom-left IS the clue column at 390/768 (identical
    // 727.39 px2 over clue text in both). Rebuild fresh and scan the
    // corners for the first legal perch; if none is legal, keep the
    // previous position (hiding him if that spot is illegal too).
    rebuildForbiddenRef.current();
    const perch = legalPerchRef.current(forbiddenRef.current);
    if (!perch) {
      if (
        holmesBoxHitsForbidden(holmesXYRef.current, forbiddenRef.current)
      ) {
        setHolmesHiddenBoth(true);
      }
      return;
    }
    setHolmesHiddenBoth(false);
    berthedRef.current = false;
    setBerthed(false);
    setHolmesTransition({ durationMs: 0, easing: EASE_OUT });
    setHolmesXY(perch);
  }, [followTier]);

  /* Auto-kill feed: rAF deltas + long-task observer feed the pure
   * tracker, SEARCH phases only (the criterion guards the follow's
   * own compositing cost; page-load jank is not follow performance).
   * The verdict steps the FOLLOW tier down one notch — never a
   * dock-return: PAUSE_BERTH keeps him page-wide and staying. The
   * tracker keeps being fed while stepped down, which is how
   * re-qualification is judged: a sustained healthy window steps the
   * tier back up (exit b of the #362 cure, applied to the tier
   * machine). */
  useEffect(() => {
    if (phase !== "SEARCH_IDLE" && phase !== "SEARCH_AREA") return;
    if (followTierRef.current === "DOCK_ONLY" && !companionKilledRef.current) {
      return; // by-design dock-only: nothing to judge
    }
    let raf = 0;
    let last = performance.now();
    let stopped = false;
    const judge = () => {
      const m = tierMachineRef.current!;
      if (killRef.current?.killed) {
        if (!companionKilledRef.current) {
          companionKilledRef.current = true;
          // Cure B, point 3 (kill): mirror reads "killed" — flag-OFF only.
          if (!followFlagOn) setLegacyCompanionMode("killed");
          const next = m.stepDown();
          // eslint-disable-next-line no-console
          console.info(
            `[detective] follow auto-kill (${killRef.current?.killReason ?? "unknown"}) — tier steps down to ${next}`,
          );
          setFollowTier(next);
        }
      } else if (companionKilledRef.current) {
        companionKilledRef.current = false;
        // Cure B, point 3 (recovery): re-derive dock/full — flag-OFF only.
        if (!followFlagOn) setLegacyCompanionMode(legacyModeForDegradation());
        const next = m.requalify();
        // eslint-disable-next-line no-console
        console.info(
          `[detective] follow re-qualified — tier steps up to ${next}`,
        );
        setFollowTier(next);
      }
    };
    /* Cure rounds 5-6 (diagnosis D + F): the judge is not fed
     * during motion the follow itself causes or the player
     * causes, using the same motion signals the legality
     * eviction gate already trusts \u2014 a follow travel or berth
     * walk in flight (telegraph/walk timers, entry pending), the
     * stamped travel landing, page scroll, or a busy camera. His
     * own glides and the player's pans render at whatever the
     * map costs; billing those frames and long tasks to the
     * follow killed the tier mid-glide at 768 and mid-pan in
     * K3. The thresholds are unchanged (45 FPS kill / 55 FPS
     * re-qualify, companion.ts); sustained degradation at rest
     * \u2014 no motion signals active \u2014 still kills exactly as
     * before (the throttled kill/recovery gate is the pin). */
    const judgeBusy = (now: number) =>
      walkTimerRef.current !== null ||
      telegraphTimerRef.current !== null ||
      entryPendingRef.current ||
      now <
        Math.max(
          followTravelEndRef.current,
          followRef.current.scrollingUntil,
          followRef.current.cameraBusyUntil,
        );
    // Round 7 (diagnosis Q1/Q2): when feeding resumes after a
    // gated stretch, prune the tracker windows first \u2014 otherwise
    // the gated span dilutes the measured FPS and the kill trips
    // at motion landings on healthy devices.
    killRef.current?.noteGate(performance.now());
    let wasBusy = false;
    const tick = (now: number) => {
      if (stopped) return;
      const busy = judgeBusy(now);
      if (!busy && wasBusy) killRef.current?.noteGate(now);
      wasBusy = busy;
      if (!busy) {
        killRef.current?.feedFrame(now - last, now);
      }
      last = now;
      judge();
      if (stopped) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Same rounds 5-6 gating for long tasks, judged at
          // the task's START against the motion horizon: a task
          // that began inside a gesture can END after the
          // horizon lapses (it was itself blocking the main
          // thread), and the pan's own jank must not bill the
          // follow (diagnosis F; the end-based form let K3's
          // pan task through and docked him).
          if (
            entry.startTime <
            Math.max(
              followTravelEndRef.current,
              followRef.current.scrollingUntil,
              followRef.current.cameraBusyUntil,
            )
          )
            continue;
          killRef.current?.feedLongTask(
            entry.duration,
            entry.startTime + entry.duration,
          );
        }
        judge();
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
  }, [followTier, phase]);

  /* Pointer wiring: WINDOW-level (the follow is page-wide), passive,
   * samples land in refs. The map container is no longer special —
   * it is simply part of the page the pointer crosses. The pause
   * detector still runs (it drives the machine's pointerPaused view
   * and the PAUSE_BERTH tier's solves); map gestures still dispatch
   * gestureStarted to the machine in SEARCH_AREA. */
  useEffect(() => {
    const detector = detectorRef.current!;
    const cache = new Map<
      number,
      { x: number; y: number; downT: number; downX: number; downY: number }
    >();
    let gestureActive = false;
    let pausePoint: { x: number; y: number } | null = null;

    const clearPauseTimer = () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    };

    const onPauseConfirmed = (point: { x: number; y: number }) => {
      enterMapRef.current();
      pausePoint = point;
      dispatchRef.current({ type: "pointerPaused", point });
      // Both solving tiers take a pause as a target moment;
      // PAGE_FOLLOW also solves on displacement/dwell (below).
      solveFollowAtRef.current(
        point,
        followRef.current.lastPointer?.pointerType ?? "mouse",
      );
    };

    const attemptConfirm = (triesLeft: number) => {
      pauseTimerRef.current = null;
      if (viewRef.current.phase !== "SEARCH_IDLE") return;
      if (followTierRef.current === "DOCK_ONLY" && companionKilledRef.current) {
        return;
      }
      const now = performance.now();
      const point = detector.check(
        now,
        now - followRef.current.lastMapActivityT,
      );
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
      const delayMs =
        degradationRef.current.walkMode === "cut"
          ? REDUCED_MOTION_PAUSE_MS
          : 460;
      pauseTimerRef.current = setTimeout(() => attemptConfirm(12), delayMs);
    };

    const startGesture = (onMap = true) => {
      followRef.current.lastMapActivityT = performance.now();
      enterMapRef.current(onMap);
      if (!gestureActive) {
        gestureActive = true;
        detector.notifyGestureStart();
      }
      clearPauseTimer();
      followRef.current.cameraBusyUntil =
        performance.now() + FOLLOW_CAMERA_IDLE_MS;
      if (viewRef.current.phase === "SEARCH_AREA") {
        dispatchRef.current({ type: "gestureStarted" });
      }
      // NO position change: a gesture plants him where he is. The
      // deleted engine walked him home here — that was the bug.
    };
    const endGesture = () => {
      if (!gestureActive) return;
      gestureActive = false;
      detector.notifyGestureEnd(performance.now());
      followRef.current.cameraBusyUntil =
        performance.now() + FOLLOW_CAMERA_IDLE_MS;
      // After the camera settles he returns to the POINTER'S LAST
      // position (owner-approved 120 ms camera-idle deferral).
      const s = followRef.current;
      if (s.dwellTimer) clearTimeout(s.dwellTimer);
      s.dwellTimer = setTimeout(() => {
        s.dwellTimer = null;
        const p = followRef.current.lastPointer;
        if (p) solveFollowAtRef.current(p, p.pointerType);
      }, FOLLOW_CAMERA_IDLE_MS + 10);
    };

    const maybeSolveFromMove = (e: PointerEvent) => {
      if (followTierRef.current !== "PAGE_FOLLOW") return;
      const s = followRef.current;
      const now = performance.now();
      const last = s.lastSolved;
      const displaced =
        !last ||
        Math.hypot(e.clientX - last.x, e.clientY - last.y) >=
          FOLLOW_SOLVE_DISPLACEMENT_PX;
      if (displaced && now - s.lastSolveT >= FOLLOW_SOLVE_MIN_INTERVAL_MS) {
        solveFollowAtRef.current(
          { x: e.clientX, y: e.clientY },
          e.pointerType,
        );
        return;
      }
      // Dwell: the pointer settled — solve at its resting place.
      if (s.dwellTimer) clearTimeout(s.dwellTimer);
      s.dwellTimer = setTimeout(() => {
        s.dwellTimer = null;
        const p = followRef.current.lastPointer;
        if (p) solveFollowAtRef.current(p, p.pointerType);
      }, FOLLOW_SOLVE_DWELL_MS);
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const prev = cache.get(e.pointerId);
      if (prev) cache.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });
      // Round 7 (diagnosis Q4): while the confirm sheet is open
      // the follow's pointer memory is frozen \u2014 clicks inside
      // the sheet (the dismiss button above all) must not become
      // the position he rejoins at when the sheet closes.
      if (!seenSheetRef.current) {
        followRef.current.lastPointer = {
          x: e.clientX,
          y: e.clientY,
          pointerType: e.pointerType,
        };
      }
      followRef.current.pointersDown = cache.size;
      // Round 8: a held drag keeps the camera busy \u2014 re-stamp
      // the horizon on every move while a pointer is down.
      if (cache.size > 0) {
        followRef.current.cameraBusyUntil = now + FOLLOW_CAMERA_IDLE_MS;
      }
      const onMap =
        mapElRef.current?.contains(e.target as Node) ?? false;
      // A real move away from the pause point, on the map, is the
      // machine's gesture signal (SEARCH_AREA -> SEARCH_IDLE path).
      if (
        onMap &&
        pausePoint &&
        viewRef.current.phase === "SEARCH_AREA" &&
        Math.hypot(e.clientX - pausePoint.x, e.clientY - pausePoint.y) >
          GESTURE_CANCEL_PX
      ) {
        startGesture();
        if (cache.size === 0) endGesture();
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
      maybeSolveFromMove(e);
    };

    const onDown = (e: PointerEvent) => {
      // Cure D: a pointerdown off the map (e.g. on the heading) must
      // not arm bench entry intent; a map pointerdown still does.
      enterMapRef.current(
        mapElRef.current?.contains(e.target as Node) ?? false,
      );
      const now = performance.now();
      followRef.current.lastMapActivityT = now;
      // Round 8 (diagnosis #2 Q3): the camera-busy horizon must
      // cover a drag's whole duration, not just its end \u2014
      // startGesture never fires during a single-pointer pan in
      // SEARCH_IDLE, so without this stamp the FG-5 judge was fed
      // the pan's own long tasks and docked him mid-pan. Moves
      // while a pointer is down re-stamp it (onMove); endGesture
      // stamps the trailing idle as before.
      followRef.current.cameraBusyUntil = now + FOLLOW_CAMERA_IDLE_MS;
      cache.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        downT: now,
        downX: e.clientX,
        downY: e.clientY,
      });
      followRef.current.pointersDown = cache.size;
      // Round 7 (diagnosis Q4): sheet freeze, as in onMove.
      if (!seenSheetRef.current) {
        followRef.current.lastPointer = {
          x: e.clientX,
          y: e.clientY,
          pointerType: e.pointerType,
        };
      }
      // Cure D: the pinch branch threads the same containment as the
      // pointerdown itself, so an off-map pinch cannot re-arm intent.
      if (cache.size >= 2)
        startGesture(mapElRef.current?.contains(e.target as Node) ?? false);
      // A tap (<250 ms, <10 px) must NOT summon or move Holmes:
      // nothing happens on pointerdown.
    };

    const onUp = (e: PointerEvent) => {
      const rec = cache.get(e.pointerId);
      cache.delete(e.pointerId);
      followRef.current.pointersDown = cache.size;
      if (rec) {
        const travel = Math.hypot(e.clientX - rec.downX, e.clientY - rec.downY);
        const isTap = performance.now() - rec.downT < 250 && travel < 10;
        if (!isTap && travel > GESTURE_CANCEL_PX) {
          // Cure D: cache stores no target, so attribute the drag by
          // its DOWN point — the map rect is position:fixed geometry
          // in viewport coords, the same space as downX/downY.
          const mr = mapRectRef.current;
          const downOnMap =
            mr !== null &&
            rec.downX >= mr.left &&
            rec.downX <= mr.left + mr.width &&
            rec.downY >= mr.top &&
            rec.downY <= mr.top + mr.height;
          startGesture(downOnMap);
        }
      }
      if (cache.size === 0) endGesture();
    };

    const onWheel = () => {
      // Cure D: the window wheel listener cannot attribute the gesture
      // to the map, so it must not arm bench entry intent either.
      startGesture(false);
      endGesture(); // wheel is momentary: camera-idle runs from now
    };

    const onScroll = () => {
      // Planted during scroll: solves suspend until the scroll has
      // been quiet for a beat, then the forbidden cache is rebuilt
      // (the page moved under his fixed overlay) and he re-solves at
      // the pointer's last position so the clearance law still holds.
      const s = followRef.current;
      s.scrollingUntil = performance.now() + 180;
      if (s.scrollTimer) clearTimeout(s.scrollTimer);
      s.scrollTimer = setTimeout(() => {
        s.scrollTimer = null;
        rebuildForbiddenRef.current();
        // Cure C, point 2: eviction at the scroll-end trigger — the
        // scroll may have swept clue text through his fixed slice
        // while he never moved (the C-1 traces).
        checkHolmesLegalityRef.current();
        const p = followRef.current.lastPointer;
        if (p) solveFollowAtRef.current(p, p.pointerType);
      }, 200);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      clearPauseTimer();
      cache.clear();
    };
    // mapEl state mirrors mapElRef; listeners are window-level now
    // and never rebind, but the effect keys on mapEl as before so the
    // first bind happens once the map exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEl]);

  /* First placement: once the map is measured, place the wrapper at
   * his entry spot — ONCE. Later map measures never move him (that
   * was the dock snap; positional memory rules now). */
  useEffect(() => {
    if (mapEl && !followPlacedRef.current) {
      followPlacedRef.current = true;
      // Cure C, points 1+3: measure the map LIVE (the cached rect is
      // taken at scroll 0 with the map below the fold and placed him
      // below the viewport in the C-1 traces) and gate the landing on
      // fresh forbidden rects — an illegal dock is never landed on;
      // the eviction check and follow solves place him legally.
      const dock = liveDockXY();
      if (freshPlacementLegal(dock)) setHolmesXY(dock);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEl]);

  /* Phase exits: the detector resets so no stale pause candidate can
   * fire later — and NOTHING moves Holmes. Leaving the SEARCH phases
   * used to park him at the dock; he now stays where he was, and the
   * burst-return below re-solves at the pointer's last position when
   * play resumes. */
  useEffect(() => {
    if (phase !== "SEARCH_IDLE" && phase !== "SEARCH_AREA") {
      detectorRef.current?.reset();
    }
  }, [phase]);

  /* Burst return: when a burst (sheet / rings / camera / pin commit)
   * ends and a SEARCH phase resumes, he yields to the pointer's last
   * position — the solve is a no-op while any suspension still
   * holds, and the wiring's own timers cover the camera-idle tail. */
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    const wasSearch = prev === "SEARCH_IDLE" || prev === "SEARCH_AREA";
    const isSearch = phase === "SEARCH_IDLE" || phase === "SEARCH_AREA";
    if (!wasSearch && isSearch) {
      const p = followRef.current.lastPointer;
      if (p) {
        const t = setTimeout(() => {
          // Round 7 (diagnosis Q4): rebuild the forbidden set
          // fresh before the return solve \u2014 a just-closed
          // sheet's rect must not linger in the cache and push
          // his rejoin ring outward.
          rebuildForbiddenRef.current();
          solveFollowAtRef.current(p, p.pointerType);
        }, FOLLOW_CAMERA_IDLE_MS);
        return () => clearTimeout(t);
      }
    }
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
          pose={
            watsonWalking && view.watson.placement === "station"
              ? "walk"
              : view.watson.pose
          }
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

  /* Map-side rendering (U6): Holmes rides his own transform wrapper
   * so the companion can walk him between the dock and a berth
   * without touching Watson or the map. Watson's U5 dock cluster
   * below is now only a fallback — since the 2026-11-08 station cure
   * the machine's view holds Watson at his clue-card station through
   * the guessing phases, so in normal play Holmes docks alone and
   * `watsonOnMap` stays false. data-companion / data-holmes-placement
   * are the U10 spec surface. */
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
  const effectivePlacement =
    berthed && view.holmes.placement === "dock"
      ? "berth"
      : view.holmes.placement;
  /* Follow overlay (PR 1): Holmes renders in a position:fixed
   * portal at the app root — pointer-events none on the layer, auto
   * only on his own footprint (the mute alias button rides the same
   * geometry below) — layered below sheet/modal/celebration (CSS).
   * His coordinates are VIEWPORT px: the whole page is his ground. */
  const holmesMapEl = holmesOnMap ? (
    <div
      className={
        (walking
          ? "detective-host-holmes detective-follow-overlay detective-follow-travelling"
          : "detective-host-holmes detective-follow-overlay") +
        // Cure C: burst-hide while his current box is illegal under a
        // suspension — hidden, never painted over clue text.
        (holmesHidden ? " detective-host-holmes-hidden" : "")
      }
      data-testid="detective-holmes-wrapper"
      data-walk-mode={degradation.walkMode}
      data-follow-tier={followTier}
      data-follow-telegraph={followTelegraph ? "true" : undefined}
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
          facing={walking || followTelegraph ? followFacing : "right"}
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
   * gutter LoopScreen reserves beside the clue cards (118 px,
   * derived in watson-walk.ts: 6 card gap + 100 Watson figure +
   * 12 edge clear), vertically centred on the active card — never
   * over its text. */
  const gutterStation =
    stagingOn && !celebrating && anchor !== null && view.watson.placement === "station";
  const gutterLeft = anchor ? anchor.left + anchor.width + GUTTER_CARD_GAP_PX : 0;
  const gutterCentreTop = anchor ? anchor.top + anchor.height / 2 : 0;
  /* PR B: while Watson walks, the whole gutter cluster (figure,
   * replay, Listen, chip) travels together on the same transform —
   * their relative geometry, and every pairwise separation PR C
   * proved, is preserved mid-walk. The station/replay wrappers
   * centre on the card (translateY(-50%) base); the side controls
   * ride a plain translateY of the same offset. */
  const walkShiftPx = watsonWalking || watsonWalkOffsetY !== 0 ? watsonWalkOffsetY : 0;
  const gutterWalkTransform = `translateY(calc(-50% + ${walkShiftPx}px))`;
  const gutterSideTransform = `translateY(${walkShiftPx}px)`;
  const gutterWalkTransition =
    watsonWalkMs > 0
      ? `transform ${watsonWalkMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : undefined;
  const listenEl = showListen ? (
    <div
      className="detective-host-listen"
      data-testid="detective-listen"
      style={
        gutterStation
          ? {
              left: gutterLeft,
              top: gutterCentreTop + GUTTER_BELOW_FIGURE_PX,
              transform: gutterSideTransform,
              transition: gutterWalkTransition,
            }
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
  const showWatsonReplay =
    watsonReplayCueVisible({
      phase: view.phase,
      watsonPlacement: view.watson.placement,
      hidden: view.hidden,
      speechMode: degradation.speechMode,
    }) &&
    /* PR B: during a speech-gated walk the current clue has not
     * been read yet — the player's held sequence is still the
     * PREVIOUS clue's, so the replay cue hides until arrival. At
     * the station after arrival it is instant, with no re-walk
     * (council Q3 edge rule). Visual-only walks (tap mode) keep
     * the cue: their held sequence is already the current clue. */
    !(watsonWalking && watsonWalkGated);
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
            ? {
                left: gutterLeft,
                top: gutterCentreTop,
                transform: gutterWalkTransform,
                transition: gutterWalkTransition,
              }
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
  /* PR B (carry-in c): the offset arithmetic now lives in the pure
   * stationChipOffsetPx / stationHolmesOffsetPx (watson-walk.ts),
   * unit-pinned for every figure combination — including the
   * Holmes-alone branch (HOLMES_BOX.w + CHIP_CLEAR_PX = 78) that
   * PR A recorded as unreachable from viewForState. It stays
   * unreachable in PR B: WALKING moves Watson WITHIN the station
   * cluster and never puts Holmes alone at the station. */
  const holmesStationOffset = stationHolmesOffsetPx({
    celebrating,
    watsonAtStation,
  });
  const celebrateClusterW = Math.round(
    CELEBRATE_LAYOUT.watsonOffsetPx.x + WATSON_DOCK_W,
  );
  const chipStationOffset = stationChipOffsetPx({
    celebrating,
    celebrateClusterW,
    watsonAtStation,
    holmesAtStation,
  });
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
              top:
                gutterCentreTop +
                (showListen
                  ? GUTTER_CHIP_BELOW_LISTEN_PX
                  : GUTTER_BELOW_FIGURE_PX),
              transform: gutterSideTransform,
              transition: gutterWalkTransition,
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
  const mapHolmesMuteEl = holmesOnMap ? (
    <button
      type="button"
      className="detective-holmes-mute detective-holmes-mute-follow"
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
  /* Close-berth cure (2026-11-07, defect 1): the bench exists only
   * while the case is PLAYING. The gate as shipped keyed off the
   * staging stage alone, so any non-"gone" stage re-rendered the
   * furniture (board + both left-behind cups + standing Holmes) over
   * the already-closed state for as long as the selection read took
   * to drain — indefinitely if that speech stalled. With `status`
   * in the gate the closed state is structurally bench-free from
   * the same render that first shows "Case closed", whatever the
   * stage machine does; the status-driven C3 entry above still runs
   * so Holmes lands at his designed dock/station positions for the
   * endings instead of vanishing with the slot. Bench during
   * CASE_OPEN (status "playing") is exactly as shipped. */
  const benchEl =
    stagingOn && stagingStage !== "gone" && status === "playing" ? (
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
          data-follow-tier={followTier}
          data-staging={stagingOn ? stagingStage : "off"}
          data-watson-walk={
            walkOn ? (watsonWalking ? "walking" : "idle") : "off"
          }
          aria-hidden="true"
          onTransitionEnd={(e) => {
            // PR B arrival: the cluster's own transform transition
            // ending is the primary arrival signal (the fallback
            // timer in beginWatsonWalk covers its absence).
            if (
              e.propertyName === "transform" &&
              e.target === e.currentTarget
            ) {
              arriveWatsonRef.current(walkGenRef.current);
            }
          }}
          style={
            gutterStation
              ? {
                  left: gutterLeft,
                  top: gutterCentreTop,
                  transform: gutterWalkTransform,
                  transition: gutterWalkTransition,
                }
              : anchor
                ? { left: anchor.left, top: anchor.top }
                : { left: 12, bottom: 96, top: "auto", transform: "none" }
          }
        >
          {celebrateEl ?? stationFigures}
        </div>
      ) : null}
      {watsonOnMap && mapEl
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
                data-follow-tier={followTier}
                aria-hidden="true"
              >
                {watsonEl ? (
                  <div className="detective-host-dock" data-testid="detective-dock">
                    {watsonEl}
                  </div>
                ) : null}
              </div>
              {/* Unit A: the tap-Watson control rides the same portal
                  but OUTSIDE the aria-hidden map root, over Watson's
                  dock figure (see the station element above). */}
              {watsonReplayDockEl}
              {/* PR C: the pair's sound chip rides the same portal,
                  likewise OUTSIDE the aria-hidden map root — real
                  buttons must stay reachable. */}
              {mapSoundEl}
            </>,
            mapEl,
          )
        : null}
      {/* Follow overlay portal (PR 1): Holmes + his tap-to-mute alias
          at the APP ROOT, position:fixed — the whole page is his
          ground now, not just the map. Layered below sheet / modal /
          celebration surfaces (detective.css). */}
      {holmesOnMap
        ? createPortal(
            <>
              <div
                className="detective-follow-root"
                data-testid="detective-follow-root"
                data-companion={companionMode}
                data-holmes-placement={effectivePlacement}
                data-phase={view.phase}
                data-follow-tier={followTier}
                aria-hidden="true"
              >
                {holmesMapEl}
              </div>
              {mapHolmesMuteEl}
              {!watsonOnMap ? mapSoundEl : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
