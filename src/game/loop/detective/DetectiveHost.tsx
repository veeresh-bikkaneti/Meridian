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
 * - During guessing phases both placements read "dock": the pair renders
 *   through a portal INTO the map container ([data-testid="loop-map"],
 *   the stable element LoopMap already renders) at the bottom-left dock,
 *   12 px inset, clear of the sheet safe area. Portal target missing →
 *   the dock cluster is not rendered (Holmes hidden — never overlap
 *   blindly).
 * - When the machine's view says hidden (sheet open / external speech /
 *   ring animation / OFF), nothing renders at all.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { HolmesRig, WatsonRig } from "./DetectivePair";
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
  type DetectiveSpeaker,
  type DetectiveSpeechPlayer,
} from "./detective-audio";
import { isSoundEnabled } from "@/game/audio/sfx";
import type { DetectiveHostProps } from "./detective-host-props";
import "./detective.css";

export type { DetectiveHostProps };

/** Pause kinematics (council Q2, desktop numbers): still for 350 ms. */
const POINTER_PAUSE_MS = 350;
/** Ring absence: the ring reveal plus its 1 s tail (council Q2 §8) —
 * the host times it; the machine only holds the flag. */
const RING_ABSENCE_MS = 2000;

interface StationAnchor {
  left: number;
  top: number;
}

export default function DetectiveHost(props: DetectiveHostProps): ReactElement | null {
  const { caseIndex, cluesRevealed, status, sheetOpen, lastGuessPlaceId } = props;

  /* -- machine instance: ref-held state, React state only for the view */
  const machineRef = useRef<DetectiveState>(initialDetectiveState());
  const [view, setView] = useState<DetectiveView>(() => viewForState(machineRef.current));
  const viewRef = useRef(view);
  viewRef.current = view;

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

  // Sound toggle-off stops speech immediately (spec: the toggle cancels
  // speech). Polled cheaply at 1 Hz — there is no sound-change event bus
  // in the codebase, and 1 Hz is not per-frame work.
  useEffect(() => {
    let wasOn = isSoundEnabled();
    const id = setInterval(() => {
      const on = isSoundEnabled();
      if (wasOn && !on) playerRef.current?.stopAll();
      wasOn = on;
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
    if (cluesRevealed >= 1) {
      dispatch({ type: "clueUnlocked", clueIndex: cluesRevealed });
    }
    // cluesRevealed at case-open time is the starting rung; later
    // increments arrive through the clue effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIndex]);

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
    if (status === "won") dispatch({ type: "caseSolved" });
    else if (status === "lost") dispatch({ type: "caseFailed" });
  }, [status, dispatch]);

  // Bottom sheet overlay flag.
  const seenSheetRef = useRef(sheetOpen);
  useEffect(() => {
    if (seenSheetRef.current === sheetOpen) return;
    seenSheetRef.current = sheetOpen;
    dispatch({ type: sheetOpen ? "sheetOpened" : "sheetClosed" });
  }, [sheetOpen, dispatch]);

  /* -- pointer kinematics (U5 minimal; berth logic is U6) ------------- */
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    const clearPause = () => {
      if (pauseTimer) clearTimeout(pauseTimer);
      pauseTimer = null;
    };
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      // Movement cancels a berth/pause state (machine no-ops otherwise).
      if (viewRef.current.phase === "SEARCH_AREA") {
        dispatchRef.current({ type: "pointerMoved" });
      }
      clearPause();
      pauseTimer = setTimeout(() => {
        pauseTimer = null;
        const p = pointerRef.current;
        if (p && viewRef.current.phase === "SEARCH_IDLE") {
          dispatchRef.current({ type: "pointerPaused", point: { x: p.x, y: p.y } });
        }
      }, POINTER_PAUSE_MS);
    };
    const onGesture = () => {
      clearPause();
      if (viewRef.current.phase === "SEARCH_AREA") {
        dispatchRef.current({ type: "gestureStarted" });
      }
    };
    const onWheel = () => onGesture();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      clearPause();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  /* -- station anchoring: measure on discrete changes, never per frame  */
  const [anchor, setAnchor] = useState<StationAnchor | null>(null);
  const [mapEl, setMapEl] = useState<Element | null>(null);
  const phase = view.phase;
  useEffect(() => {
    const measure = () => {
      setMapEl(document.querySelector('[data-testid="loop-map"]'));
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
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [cluesRevealed, phase, status]);

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
  const dockFigures: ReactElement[] = [];
  if (view.holmes.placement === "dock" && holmesEl) dockFigures.push(<span key="h">{holmesEl}</span>);
  if (view.watson.placement === "dock" && watsonEl) dockFigures.push(<span key="w">{watsonEl}</span>);

  return (
    <>
      {stationFigures.length > 0 ? (
        <div
          className="detective-host-station"
          data-testid="detective-station"
          aria-hidden="true"
          style={
            anchor
              ? { left: anchor.left, top: anchor.top }
              : { left: 12, bottom: 96, top: "auto", transform: "none" }
          }
        >
          {stationFigures}
        </div>
      ) : null}
      {dockFigures.length > 0 && mapEl
        ? createPortal(
            <div
              className="detective-host-dock"
              data-testid="detective-dock"
              aria-hidden="true"
            >
              {dockFigures}
            </div>,
            mapEl,
          )
        : null}
    </>
  );
}
