/**
 * detective-state.ts — the Holmes & Watson state machine (U5).
 *
 * Architecture (Senior Mechanics Engineer pattern): a PURE state machine —
 * no React, no timers, no I/O, no DOM. The host component (DetectiveHost)
 * is the observer/signal wiring around it: it feeds events in, renders the
 * returned view, and executes the returned effects (speech via
 * detective-audio.ts, dwell timers it owns). Keeping every decision here
 * means the full clue ladder is unit-testable in node with scripted events,
 * and per-frame work in the host is zero — transitions happen only on
 * discrete game/pointer/speech events.
 *
 * Answer-blindness is STRUCTURAL (BUILD-SCOPE §2.3, council Q4 anti-leak
 * law): the event payloads carry only { clueIndex, pointer point, the
 * placeId of the PLAYER'S OWN pick at guessConfirmed }. The machine never
 * receives a target, an evaluation, a distance, a correctness flag, or any
 * puzzle state — so no behaviour of the pair can depend on them.
 *
 * The view IS the pose/placement intent surface (declarative: the host
 * renders exactly what the view says). The effects array is the imperative
 * surface: speak intents for the speech player and dwell requests the
 * host times before firing `beatElapsed`. Absence triggers (sheet open,
 * external speech, ring animation) are state INPUTS, never timers inside
 * the machine (council: "tested, not timed").
 *
 * The quiet register's name is "hushed" everywhere in this feature.
 */

import type { HolmesPose, WatsonPose } from "./DetectivePair.tsx";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

export const DETECTIVE_PHASES = [
  "OFF",
  "CASE_OPEN",
  "READING",
  "THINKING_BEAT",
  "SEARCH_IDLE",
  "SEARCH_AREA",
  "SELECTION_READ",
  "ASK_NEXT",
  "CELEBRATE",
  "FAIL_READ",
  "POUT",
  "DEBRIEF",
] as const;
export type DetectivePhase = (typeof DETECTIVE_PHASES)[number];

/** Where a character is rendered. "berth" is U6 vocabulary (waypoint
 * companion); U5 never emits it — Holmes sits at the dock in SEARCH. */
export type HolmesPlacement = "station" | "dock" | "berth" | "hidden";
export type WatsonPlacement = "station" | "dock" | "hidden";

/** A speak intent for the speech player (detective-audio.ts).
 * - clue:    Watson reads clue `clueIndex` (1-based) of the current case.
 * - fixed:   a fixed line id from the manifest's `fixed` table.
 * - answer:  Holmes reads the current case's answer line (fail path only —
 *            the game itself has already revealed the answer on screen).
 * - name:    Holmes reads the player's OWN picked place name; `placeId`
 *            is the pick's id, echoed from the guessConfirmed event.
 * - debrief: Holmes's post-solve deduction speech (U8 fills the content). */
export type SpeakRef =
  | { kind: "clue"; clueIndex: number }
  | { kind: "fixed"; id: string }
  | { kind: "answer" }
  | { kind: "name"; placeId: string }
  | { kind: "debrief" };

/** Imperative effects emitted with a transition. Pose/placement are NOT
 * effects — they ride the view (see header). */
export type DetectiveEffect =
  | { type: "speak"; ref: SpeakRef }
  | { type: "dwell"; beatMs: number };

/** The ONLY inputs. Payloads are answer-blind by construction (header). */
export type DetectiveEvent =
  | { type: "clueUnlocked"; clueIndex: number }
  | { type: "speechEnded" }
  | { type: "beatElapsed" }
  | { type: "pointerPaused"; point: { x: number; y: number } }
  | { type: "pointerMoved" }
  | { type: "gestureStarted" }
  | { type: "sheetOpened" }
  | { type: "sheetClosed" }
  | { type: "guessConfirmed"; placeId: string }
  | { type: "caseSolved" }
  | { type: "caseFailed" }
  | { type: "externalSpeechStarted" }
  | { type: "externalSpeechEnded" }
  | { type: "ringAnimationEnded" };

export interface CharacterView<Pose, Placement> {
  pose: Pose;
  placement: Placement;
  speaking: boolean;
}

export interface DetectiveView {
  phase: DetectivePhase;
  holmes: CharacterView<HolmesPose, HolmesPlacement>;
  watson: CharacterView<WatsonPose, WatsonPlacement>;
  /** True while the sheet is open, external speech plays, or the ring
   * animation runs — the pair is absent (SHEET is an overlay flag on the
   * view, never a phase). */
  hidden: boolean;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/** Which step inside READING the ladder is on (the phase alone cannot
 * distinguish Watson's read from Holmes's ack+decode). */
export type ReadingStep = "announce" | "watson-read" | "ack-decode";

export interface DetectiveState {
  phase: DetectivePhase;
  /** Current clue, 1-based (0 = no clue yet). */
  clueIndex: number;
  readingStep: ReadingStep | null;
  /** A clue the game unlocked while a selection read was in flight; the
   * ladder visits it via ASK_NEXT once the read drains. */
  pendingClue: number | null;
  /** A case ending that arrived mid-selection-read; applied when the
   * read drains so Holmes never talks over his own selection line. */
  pendingEnd: "solved" | "failed" | null;
  /** Ask-next was already spoken for the pending unlock (sheetClosed
   * path), so the arriving clueUnlocked goes straight to READING. */
  askNextSpoken: boolean;
  /** A selection read has completed this clue and the ladder is waiting
   * in SEARCH_IDLE: a sheetClosed here is the task's ASK_NEXT trigger.
   * Cleared by the next guess, clue, or ending so a stray sheet cycle
   * during ordinary searching can never fire ask-next. */
  selectionReadDone: boolean;
  // Absence flags — state inputs, set/cleared only by their events.
  sheetOpen: boolean;
  externalSpeech: boolean;
  ringAnimating: boolean;
  /** Last pointer-pause point (kinematics only — U6's berth solver input). */
  lastPausePoint: { x: number; y: number } | null;
}

export function initialDetectiveState(
  opts: { enabled?: boolean } = {},
): DetectiveState {
  return {
    phase: opts.enabled === false ? "OFF" : "CASE_OPEN",
    clueIndex: 0,
    readingStep: null,
    pendingClue: null,
    pendingEnd: null,
    askNextSpoken: false,
    selectionReadDone: false,
    sheetOpen: false,
    externalSpeech: false,
    ringAnimating: false,
    lastPausePoint: null,
  };
}

/* ------------------------------------------------------------------ */
/* Ladder constants (council Q4 beat sheet)                            */
/* ------------------------------------------------------------------ */

/** Silent thinking beat between a read and its decode. */
export const THINKING_BEAT_MS = 600;
/** The Hook's pre-announcement silence: 800–1200 ms (Q4) — mid value. */
export const HOOK_BEAT_MS = 1000;
/** How long the pout holds before the pair settles back to idle. */
export const POUT_BEAT_MS = 1500;

/** Clue types by position (1-based): the decode template per clue. */
export const CLUE_TYPE_BY_INDEX: Record<number, string> = {
  1: "geography",
  2: "climate",
  3: "history",
  4: "hook",
  5: "giveaway",
};

/** Holmes's rotating acknowledgement for clue n: ack-1..ack-4. */
export function ackIdForClue(clueIndex: number): string {
  return `ack-${(((clueIndex - 1) % 4) + 4) % 4 + 1}`;
}

export function decodeIdForClue(clueIndex: number): string {
  return `decode-${CLUE_TYPE_BY_INDEX[clueIndex] ?? "geography"}`;
}

/* ------------------------------------------------------------------ */
/* View — a pure derivation from state                                 */
/* ------------------------------------------------------------------ */

export function viewForState(state: DetectiveState): DetectiveView {
  const hidden =
    state.phase === "OFF" ||
    state.sheetOpen ||
    state.externalSpeech ||
    state.ringAnimating;
  const base = { phase: state.phase, hidden };
  switch (state.phase) {
    case "OFF":
      return {
        ...base,
        holmes: { pose: "dock", placement: "hidden", speaking: false },
        watson: { pose: "station-idle", placement: "hidden", speaking: false },
      };
    case "CASE_OPEN":
      return {
        ...base,
        holmes: { pose: "dock", placement: "station", speaking: false },
        watson: { pose: "station-idle", placement: "station", speaking: false },
      };
    case "READING":
      if (state.readingStep === "announce") {
        // Hook announcement: Holmes solo, hushed; Watson's reaction is
        // visible only (the gasp pose) — one speaker spends the emphasis.
        return {
          ...base,
          holmes: { pose: "announce", placement: "station", speaking: true },
          watson: { pose: "gasp", placement: "station", speaking: false },
        };
      }
      if (state.readingStep === "ack-decode") {
        return {
          ...base,
          holmes: { pose: "ack", placement: "station", speaking: true },
          watson: { pose: "think", placement: "station", speaking: false },
        };
      }
      // watson-read (default)
      return {
        ...base,
        holmes: { pose: "dock", placement: "station", speaking: false },
        watson: { pose: "read", placement: "station", speaking: true },
      };
    case "THINKING_BEAT":
      return {
        ...base,
        holmes: { pose: "berth-think", placement: "station", speaking: false },
        watson: { pose: "think", placement: "station", speaking: false },
      };
    case "SEARCH_IDLE":
      // U5: Holmes sits at the map dock in the search pose (the pose
      // alternation with dock idle is render-side CSS, not state).
      // U6 replaces placement logic with the waypoint companion.
      return {
        ...base,
        holmes: { pose: "search", placement: "dock", speaking: false },
        watson: { pose: "station-idle", placement: "dock", speaking: false },
      };
    case "SEARCH_AREA":
      // Player paused over an area. U5 keeps Holmes docked (companion
      // berthing is U6); the thinking pose marks the pause.
      return {
        ...base,
        holmes: { pose: "berth-think", placement: "dock", speaking: false },
        watson: { pose: "station-idle", placement: "dock", speaking: false },
      };
    case "SELECTION_READ":
      return {
        ...base,
        holmes: { pose: "ack", placement: "dock", speaking: true },
        watson: { pose: "notebook-mark", placement: "dock", speaking: false },
      };
    case "ASK_NEXT":
      return {
        ...base,
        holmes: { pose: "ack", placement: "dock", speaking: true },
        watson: { pose: "station-idle", placement: "dock", speaking: false },
      };
    case "CELEBRATE":
      return {
        ...base,
        holmes: { pose: "celebrate-jump", placement: "station", speaking: true },
        watson: { pose: "celebrate-jump", placement: "station", speaking: false },
      };
    case "FAIL_READ":
      return {
        ...base,
        holmes: { pose: "ack", placement: "station", speaking: true },
        watson: { pose: "think", placement: "station", speaking: false },
      };
    case "POUT":
      return {
        ...base,
        holmes: { pose: "pout", placement: "station", speaking: false },
        watson: { pose: "pout", placement: "station", speaking: false },
      };
    case "DEBRIEF":
      // TODO(U8): debrief choreography (glass hand-off aftermath, the
      // deduction speech effects: debrief-frame → name → debrief-close)
      // lands with the endings unit. U5 keeps the poses only.
      return {
        ...base,
        holmes: { pose: "ack", placement: "station", speaking: false },
        watson: { pose: "station-idle", placement: "station", speaking: false },
      };
  }
}

/* ------------------------------------------------------------------ */
/* Transition helpers                                                  */
/* ------------------------------------------------------------------ */

const speak = (ref: SpeakRef): DetectiveEffect => ({ type: "speak", ref });
const dwell = (beatMs: number): DetectiveEffect => ({ type: "dwell", beatMs });

interface Step {
  state: DetectiveState;
  effects: DetectiveEffect[];
}

function result(state: DetectiveState, effects: DetectiveEffect[] = []): Step & { view: DetectiveView } {
  return { state, effects, view: viewForState(state) };
}

function noOp(state: DetectiveState): Step & { view: DetectiveView } {
  return result(state);
}

/** Begin the ladder for clue n (shared by clueUnlocked and the ASK_NEXT
 * drain path). The Hook (n=4) opens with its long silence + Holmes's
 * announcement BEFORE Watson reads; every other clue starts with the read. */
function startClue(state: DetectiveState, clueIndex: number): Step & { view: DetectiveView } {
  const next: DetectiveState = {
    ...state,
    clueIndex,
    pendingClue: null,
    askNextSpoken: false,
    selectionReadDone: false,
  };
  if (clueIndex === 4) {
    return result(
      { ...next, phase: "THINKING_BEAT", readingStep: "announce" },
      [dwell(HOOK_BEAT_MS)],
    );
  }
  return result(
    { ...next, phase: "READING", readingStep: "watson-read" },
    [speak({ kind: "clue", clueIndex })],
  );
}

function enterCelebrate(state: DetectiveState): Step & { view: DetectiveView } {
  return result(
    { ...state, phase: "CELEBRATE", readingStep: null, pendingEnd: null, pendingClue: null, selectionReadDone: false },
    [speak({ kind: "fixed", id: "win-holmes" }), speak({ kind: "fixed", id: "win-watson" })],
  );
}

function enterFailRead(state: DetectiveState): Step & { view: DetectiveView } {
  return result(
    { ...state, phase: "FAIL_READ", readingStep: null, pendingEnd: null, pendingClue: null, selectionReadDone: false },
    [speak({ kind: "answer" })],
  );
}

/** After a selection read drains: a pending ending wins, then a pending
 * clue goes through ASK_NEXT, otherwise back to searching. */
function afterSelectionRead(state: DetectiveState): Step & { view: DetectiveView } {
  if (state.pendingEnd === "solved") return enterCelebrate(state);
  if (state.pendingEnd === "failed") return enterFailRead(state);
  if (state.pendingClue !== null && state.pendingClue > state.clueIndex) {
    return result(
      { ...state, phase: "ASK_NEXT", selectionReadDone: false },
      [speak({ kind: "fixed", id: "ask-next" })],
    );
  }
  return result({ ...state, phase: "SEARCH_IDLE", selectionReadDone: true });
}

/* ------------------------------------------------------------------ */
/* The machine                                                         */
/* ------------------------------------------------------------------ */

/**
 * Pure transition: (state, event) → { state, view, effects }.
 * Unlisted (phase, event) pairs are no-ops — the host may fire events
 * liberally (pointer, sheet, speech) without policing the phase first.
 */
export function transition(
  state: DetectiveState,
  event: DetectiveEvent,
): Step & { view: DetectiveView } {
  // Absence flags are phase-independent state inputs.
  switch (event.type) {
    case "sheetOpened":
      return result({ ...state, sheetOpen: true });
    case "sheetClosed": {
      const closed = { ...state, sheetOpen: false };
      // Task flow: sheetClosed → if more clues, ASK_NEXT (Holmes asks for
      // the next question; the game then fires clueUnlocked). Only after
      // a completed selection read (selectionReadDone), only when a next
      // clue can exist, and only once — a sheet cycle during ordinary
      // searching (e.g. a cancelled pick) never fires it.
      if (
        closed.phase === "SEARCH_IDLE" &&
        closed.selectionReadDone &&
        closed.clueIndex >= 1 &&
        closed.clueIndex < 5 &&
        closed.pendingClue === null &&
        closed.pendingEnd === null
      ) {
        return result(
          { ...closed, phase: "ASK_NEXT", selectionReadDone: false },
          [speak({ kind: "fixed", id: "ask-next" })],
        );
      }
      return result(closed);
    }
    case "externalSpeechStarted":
      return result({ ...state, externalSpeech: true });
    case "externalSpeechEnded":
      return result({ ...state, externalSpeech: false });
    case "ringAnimationEnded":
      return result({ ...state, ringAnimating: false });
    default:
      break;
  }

  if (state.phase === "OFF") return noOp(state);

  switch (event.type) {
    case "clueUnlocked": {
      const n = event.clueIndex;
      if (!Number.isInteger(n) || n < 1 || n > 5) return noOp(state);
      // Mid-selection-read unlocks are remembered, not acted on: Holmes
      // finishes the selection line, then ASK_NEXT bridges to the clue.
      if (state.phase === "SELECTION_READ") {
        return result({ ...state, pendingClue: n });
      }
      // From ASK_NEXT the ask was already spoken (sheetClosed path or
      // the pending path) — go straight to the clue.
      return startClue(state, n);
    }

    case "guessConfirmed": {
      if (state.phase !== "SEARCH_IDLE" && state.phase !== "SEARCH_AREA") {
        return noOp(state);
      }
      // The ring animation owns the screen next; the pair is absent for
      // it (ringAnimating) until the host fires ringAnimationEnded.
      return result(
        {
          ...state,
          phase: "SELECTION_READ",
          ringAnimating: true,
          lastPausePoint: null,
          selectionReadDone: false,
        },
        [
          speak({ kind: "name", placeId: event.placeId }),
          speak({ kind: "fixed", id: "suspicion" }),
        ],
      );
    }

    case "caseSolved":
      if (state.phase === "SELECTION_READ") {
        return result({ ...state, pendingEnd: "solved" });
      }
      if (state.phase === "CELEBRATE" || state.phase === "DEBRIEF") return noOp(state);
      return enterCelebrate(state);

    case "caseFailed":
      if (state.phase === "SELECTION_READ") {
        return result({ ...state, pendingEnd: "failed" });
      }
      if (state.phase === "FAIL_READ" || state.phase === "POUT") return noOp(state);
      return enterFailRead(state);

    case "speechEnded": {
      switch (state.phase) {
        case "READING":
          if (state.readingStep === "announce") {
            // Announcement done → Watson reads the Hook clue.
            return result(
              { ...state, readingStep: "watson-read" },
              [speak({ kind: "clue", clueIndex: state.clueIndex })],
            );
          }
          if (state.readingStep === "watson-read") {
            if (state.clueIndex === 4) {
              // Hook: the decode follows the read directly (the long
              // silence already happened before the announcement), then
              // Watson's one amazement fragment. No ack on the Hook —
              // the announcement spent that beat.
              return result(
                { ...state, readingStep: "ack-decode" },
                [
                  speak({ kind: "fixed", id: decodeIdForClue(4) }),
                  speak({ kind: "fixed", id: "amazement" }),
                ],
              );
            }
            // Every other clue: the 0.6 s silent thinking beat sits
            // between the read and Holmes's decode.
            return result(
              { ...state, phase: "THINKING_BEAT", readingStep: "ack-decode" },
              [dwell(THINKING_BEAT_MS)],
            );
          }
          // ack-decode drained → guessing phase, Holmes to the dock.
          return result({
            ...state,
            phase: "SEARCH_IDLE",
            readingStep: null,
          });
        case "SELECTION_READ":
          return afterSelectionRead(state);
        case "ASK_NEXT": {
          if (state.pendingClue !== null) {
            return startClue(state, state.pendingClue);
          }
          // Ask spoken via the sheetClosed path; the game's clueUnlocked
          // is still coming. Wait in SEARCH_IDLE (askNextSpoken marks
          // that the next clueUnlocked needs no second ask).
          return result({ ...state, phase: "SEARCH_IDLE", askNextSpoken: true });
        }
        case "CELEBRATE":
          // Win lines drained → DEBRIEF (poses only in U5; U8 fills its
          // speech effects — see the TODO in viewForState).
          return result({ ...state, phase: "DEBRIEF" });
        case "FAIL_READ":
          return result({ ...state, phase: "POUT" }, [dwell(POUT_BEAT_MS)]);
        default:
          return noOp(state);
      }
    }

    case "beatElapsed": {
      if (state.phase === "THINKING_BEAT") {
        if (state.readingStep === "announce") {
          // Hook silence over → Holmes announces, solo and hushed.
          return result(
            { ...state, phase: "READING" },
            [speak({ kind: "fixed", id: "hook-announcement" })],
          );
        }
        // Thinking beat over → Holmes acknowledges (rotating ack) and
        // delivers the clue-type decode; both queue sequentially.
        return result(
          { ...state, phase: "READING" },
          [
            speak({ kind: "fixed", id: ackIdForClue(state.clueIndex) }),
            speak({ kind: "fixed", id: decodeIdForClue(state.clueIndex) }),
          ],
        );
      }
      if (state.phase === "POUT") {
        // Pout held → settle back to the case-open idle.
        return result({ ...state, phase: "CASE_OPEN" });
      }
      return noOp(state);
    }

    case "pointerPaused":
      if (state.phase === "SEARCH_IDLE") {
        return result({
          ...state,
          phase: "SEARCH_AREA",
          lastPausePoint: { x: event.point.x, y: event.point.y },
        });
      }
      return noOp(state);

    case "pointerMoved":
      if (state.phase === "SEARCH_AREA") {
        return result({ ...state, phase: "SEARCH_IDLE", lastPausePoint: null });
      }
      return noOp(state);

    case "gestureStarted":
      // Pan/zoom/pinch wins instantly: any berth/pause state cancels.
      if (state.phase === "SEARCH_AREA") {
        return result({ ...state, phase: "SEARCH_IDLE", lastPausePoint: null });
      }
      return noOp(state);

    default:
      return noOp(state);
  }
}
