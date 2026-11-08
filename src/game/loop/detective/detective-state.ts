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
  "NOTE_MARK",
  "ASK_NEXT",
  "CELEBRATE",
  "FAIL_READ",
  "POUT",
  "DEBRIEF",
] as const;
export type DetectivePhase = (typeof DETECTIVE_PHASES)[number];

/** Where a character is rendered. "berth" is the waypoint companion's
 * placement (U6): emitted in SEARCH_AREA; the host's solver decides
 * the actual pixels (berth / remote-at-dock / hidden). */
export type HolmesPlacement = "station" | "dock" | "berth" | "hidden";
export type WatsonPlacement = "station" | "dock" | "hidden";

/** A speak intent for the speech player (detective-audio.ts).
 * - clue:    Watson reads clue `clueIndex` (1-based) of the current case.
 * - fixed:   a fixed line id from the manifest's `fixed` table.
 * - answer:  Holmes reads the current case's answer line (fail path only —
 *            the game itself has already revealed the answer on screen).
 * - name:    Holmes reads the player's OWN picked place name; `placeId`
 *            is the pick's id, echoed from the guessConfirmed event.
 *            In DEBRIEF the same kind carries the ANSWER's placeId — the
 *            one place the answer's id may appear (the case is solved;
 *            the game has already revealed it on screen).
 * - debrief: legacy single-ref form (the player resolves it to the
 *            debrief frame line). The machine no longer emits it: U8
 *            sequences DEBRIEF explicitly as fixed frame → name → fixed
 *            close, so each line is independently skippable. */
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

/** The ONLY inputs. Payloads are answer-blind by construction (header).
 * The two U8 exceptions are fenced: `freshDeal` says only whether this
 * deal is new (never anything about the case), and `answerPlaceId` —
 * the answer's id, known to the game only AFTER a solve — is stored
 * untouched and consumed solely by the DEBRIEF effect (see the state
 * field); it cannot influence any pre-solve transition. */
export type DetectiveEvent =
  | { type: "caseOpened"; freshDeal: boolean }
  | { type: "clueUnlocked"; clueIndex: number }
  | { type: "speechEnded" }
  | { type: "beatElapsed" }
  | { type: "pointerPaused"; point: { x: number; y: number } }
  | { type: "pointerMoved" }
  | { type: "gestureStarted" }
  | { type: "sheetOpened" }
  | { type: "sheetClosed" }
  | { type: "guessConfirmed"; placeId: string }
  | { type: "caseSolved"; answerPlaceId?: string | null }
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

/** CASE_OPEN's instruction duet (U8, council Q4): played on a FRESH deal
 * only, before clue 1. "awaiting" = the host has not yet reported
 * fresh-vs-resumed; "skipped" = resumed case (no instructions);
 * "done" = the duet drained and the ladder may proceed. */
export type InstructionsStep = "awaiting" | "holmes" | "watson" | "done" | "skipped";

/** CELEBRATE's choreography sub-steps (U8, council Q4): the phase stays
 * CELEBRATE; the view's poses follow the step. Dwell-chained by the
 * host's beatElapsed; the win lines run in parallel on the speech queue
 * and whichever finishes LAST gates DEBRIEF (see celebrateSpeechDone). */
export type CelebrateStep = "jump" | "high-five" | "clap" | "settle";

export interface DetectiveState {
  phase: DetectivePhase;
  /** Current clue, 1-based (0 = no clue yet). */
  clueIndex: number;
  readingStep: ReadingStep | null;
  instructionsStep: InstructionsStep;
  celebrateStep: CelebrateStep | null;
  /** The win lines have drained while the choreography still runs:
   * DEBRIEF then starts on the final beatElapsed instead of speechEnded. */
  celebrateSpeechDone: boolean;
  /** The ANSWER's placeId, carried ONLY from the caseSolved event to
   * the DEBRIEF effect that names it. Set nowhere else, read nowhere
   * else — pre-solve behaviour is provably independent of its value
   * (the pick-swap test's U8 extension pins this). Cleared on entry to
   * DEBRIEF, once the effect has captured it. */
  answerPlaceId: string | null;
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
  /** How many acknowledgements have actually played in this case. The
   * ack rotation is driven by THIS count, never by the clue index:
   * the Hook (clue 4) plays no ack, so an index-keyed rotation repeated
   * ack-1 on the Giveaway and never played ack-4 (cure pass, item 7). */
  acksPlayed: number;
}

export function initialDetectiveState(
  opts: { enabled?: boolean } = {},
): DetectiveState {
  return {
    phase: opts.enabled === false ? "OFF" : "CASE_OPEN",
    clueIndex: 0,
    readingStep: null,
    instructionsStep: "awaiting",
    celebrateStep: null,
    celebrateSpeechDone: false,
    answerPlaceId: null,
    pendingClue: null,
    pendingEnd: null,
    askNextSpoken: false,
    selectionReadDone: false,
    sheetOpen: false,
    externalSpeech: false,
    ringAnimating: false,
    lastPausePoint: null,
    acksPlayed: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Ladder constants (council Q4 beat sheet)                            */
/* ------------------------------------------------------------------ */

/** Silent thinking beat between a read and its decode. */
export const THINKING_BEAT_MS = 600;
/** The Hook's pre-announcement silence: 800–1200 ms (Q4) — mid value. */
export const HOOK_BEAT_MS = 1000;
/** The miss beat (U8, council Q4): Watson marks his notebook, Holmes
 * watches the map — voiceless, ~900 ms, before Holmes asks for the
 * next question. */
export const NOTE_MARK_MS = 900;
/** CELEBRATE choreography dwells (U8): the jump matches the rigs' CSS
 * jump (1.15 s); the high-five is held so the hand contact reads; the
 * clap hold is the Q4 sheet's ~0.8 s. */
export const CELEBRATE_JUMP_MS = 1150;
export const HIGH_FIVE_HOLD_MS = 900;
export const CLAP_HOLD_MS = 800;

/** Clue types by position (1-based): the decode template per clue. */
export const CLUE_TYPE_BY_INDEX: Record<number, string> = {
  1: "geography",
  2: "climate",
  3: "history",
  4: "hook",
  5: "giveaway",
};

/** Holmes's rotating acknowledgement, by ACK COUNT (acks actually
 * played so far in the case, 0-based): the first ack of a case is
 * ack-1, then ack-2, ack-3, ack-4, then the rotation wraps to ack-1.
 * Keying by count — not clue index — is what guarantees no repeat
 * before all four have played even though the Hook plays no ack. */
export function ackIdForAckCount(acksPlayed: number): string {
  return `ack-${(((acksPlayed % 4) + 4) % 4) + 1}`;
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
      // The fresh-deal instruction duet (U8): Holmes speaks his line in
      // the "ack" pose at the station, then Watson speaks his.
      if (state.instructionsStep === "holmes") {
        return {
          ...base,
          holmes: { pose: "ack", placement: "station", speaking: true },
          watson: { pose: "station-idle", placement: "station", speaking: false },
        };
      }
      if (state.instructionsStep === "watson") {
        return {
          ...base,
          holmes: { pose: "dock", placement: "station", speaking: false },
          watson: { pose: "read", placement: "station", speaking: true },
        };
      }
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
      // Holmes sits at the map dock in the search pose (the pose
      // alternation with dock idle is render-side CSS, not state).
      // A confirmed pause moves him to SEARCH_AREA's berth (U6).
      // Watson holds his station beside the active clue card for
      // the whole case once play starts (owner ruling 2026-11-07):
      // only Holmes uses the map dock during the guessing phases.
      return {
        ...base,
        holmes: { pose: "search", placement: "dock", speaking: false },
        watson: { pose: "station-idle", placement: "station", speaking: false },
      };
    case "SEARCH_AREA":
      // Player paused over an area (U6): the machine says "berth" and
      // the thinking pose; the HOST resolves the berth solver against
      // the real pause point — the rendered outcome may be a berth
      // beside the point, "remote" thinking at the dock, or hidden,
      // and the walk itself is host-side CSS. The machine stays free
      // of geometry: its placement is intent, not pixels.
      // Watson stays at his clue-card station here too (owner ruling
      // 2026-11-07) — the pause is Holmes's moment on the map, not a
      // reason to move Watson off the clues.
      return {
        ...base,
        holmes: { pose: "berth-think", placement: "berth", speaking: false },
        watson: { pose: "station-idle", placement: "station", speaking: false },
      };
    case "SELECTION_READ":
      // Holmes reads the pick from the map dock; Watson marks his
      // notebook at his clue-card station (owner ruling 2026-11-07
      // — he holds the station through the whole guessing stretch).
      return {
        ...base,
        holmes: { pose: "ack", placement: "dock", speaking: true },
        watson: { pose: "notebook-mark", placement: "station", speaking: false },
      };
    case "NOTE_MARK":
      // The miss beat (U8): Watson marks his notebook AT THE STATION
      // (beside the clue card), Holmes stays at the map dock in the
      // search pose, facing the map. Nobody speaks.
      return {
        ...base,
        holmes: { pose: "search", placement: "dock", speaking: false },
        watson: { pose: "notebook-mark", placement: "station", speaking: false },
      };
    case "ASK_NEXT":
      // Holmes asks for the next question from the map dock; Watson
      // waits at his clue-card station, where the next clue will
      // land (owner ruling 2026-11-07).
      return {
        ...base,
        holmes: { pose: "ack", placement: "dock", speaking: true },
        watson: { pose: "station-idle", placement: "station", speaking: false },
      };
    case "CELEBRATE": {
      // Choreography poses follow celebrateStep (U8); the host lays the
      // pair side-by-side so the HIGH_FIVE_CONTACT anchors coincide in
      // the high-five step. Speech (win lines) runs in parallel — the
      // speaking flags follow Holmes until the settle.
      const step = state.celebrateStep ?? "jump";
      if (step === "high-five") {
        return {
          ...base,
          holmes: { pose: "high-five", placement: "station", speaking: false },
          watson: { pose: "high-five", placement: "station", speaking: false },
        };
      }
      if (step === "clap") {
        return {
          ...base,
          holmes: { pose: "clap", placement: "station", speaking: false },
          watson: { pose: "clap", placement: "station", speaking: false },
        };
      }
      if (step === "settle") {
        return {
          ...base,
          holmes: { pose: "dock", placement: "station", speaking: false },
          watson: { pose: "station-idle", placement: "station", speaking: false },
        };
      }
      return {
        ...base,
        holmes: { pose: "celebrate-jump", placement: "station", speaking: true },
        watson: { pose: "celebrate-jump", placement: "station", speaking: false },
      };
    }
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
      // Holmes delivers the deduction (frame → the answer's name →
      // close — the effects are emitted on entry, see enterDebrief);
      // Watson listens at the station.
      return {
        ...base,
        holmes: { pose: "ack", placement: "station", speaking: true },
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
    celebrateStep: null,
    celebrateSpeechDone: false,
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
  // The win lines queue on the speech player while the choreography
  // dwell chain runs in parallel (jump first); DEBRIEF waits for BOTH
  // to finish — see the CELEBRATE speechEnded / beatElapsed handlers.
  return result(
    {
      ...state,
      phase: "CELEBRATE",
      readingStep: null,
      pendingEnd: null,
      pendingClue: null,
      selectionReadDone: false,
      celebrateStep: "jump",
      celebrateSpeechDone: false,
    },
    [
      speak({ kind: "fixed", id: "win-holmes" }),
      speak({ kind: "fixed", id: "win-watson" }),
      dwell(CELEBRATE_JUMP_MS),
    ],
  );
}

/** The post-solve debrief (U8, owner decision 4): the ONE place
 * synthesis lives. Holmes speaks the fixed frame, then the ANSWER's
 * name read, then the fixed close. The answer's id is consumed here
 * and only here; a missing id (or a name entry the manifest lacks —
 * the player skips it silently) still leaves a coherent frame → close. */
function enterDebrief(state: DetectiveState): Step & { view: DetectiveView } {
  const effects: DetectiveEffect[] = [speak({ kind: "fixed", id: "debrief-frame" })];
  if (state.answerPlaceId) {
    effects.push(speak({ kind: "name", placeId: state.answerPlaceId }));
  }
  effects.push(speak({ kind: "fixed", id: "debrief-close" }));
  return result(
    {
      ...state,
      phase: "DEBRIEF",
      celebrateStep: null,
      celebrateSpeechDone: false,
      answerPlaceId: null, // consumed — never carried past the debrief
    },
    effects,
  );
}

/** The miss beat (U8): a silent dwell before ASK_NEXT, entered from
 * both ask-next paths so the beat can never be skipped by one of them. */
function enterNoteMark(state: DetectiveState): Step & { view: DetectiveView } {
  return result(
    { ...state, phase: "NOTE_MARK", selectionReadDone: false },
    [dwell(NOTE_MARK_MS)],
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
    // A next clue is pending: the voiceless miss beat comes first,
    // then ASK_NEXT bridges to it (NOTE_MARK's beatElapsed handler).
    return enterNoteMark(state);
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
        // The miss beat first (U8), then ASK_NEXT — same bridge as the
        // pending-clue path, so the beat exists on every non-final miss.
        return enterNoteMark(closed);
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
    case "caseOpened": {
      // A new case while POUTing is one of POUT's only exits (U8): the
      // lost case is over — reset to a fresh case-open, then let the
      // fresh/resumed decision below run on the clean state.
      const base =
        state.phase === "POUT"
          ? { ...initialDetectiveState(), sheetOpen: state.sheetOpen }
          : state;
      if (base.phase !== "CASE_OPEN" || base.instructionsStep !== "awaiting") {
        return base === state ? noOp(state) : result(base);
      }
      if (!event.freshDeal) {
        // Resumed case: instructions are skipped, the ladder proceeds
        // as U5 whenever its clue arrives.
        return result({ ...base, instructionsStep: "skipped" });
      }
      // Fresh deal: Holmes's instruction line first (Q4 case open).
      return result({ ...base, instructionsStep: "holmes" }, [
        speak({ kind: "fixed", id: "instructions-holmes" }),
      ]);
    }

    case "clueUnlocked": {
      const n = event.clueIndex;
      if (!Number.isInteger(n) || n < 1 || n > 5) return noOp(state);
      // An unlock that lands while the case-open instructions are still
      // playing is remembered, not acted on (the pending pattern, same
      // as the selection read below): the duet finishes, then the
      // ladder starts this clue.
      if (
        state.phase === "CASE_OPEN" &&
        (state.instructionsStep === "holmes" || state.instructionsStep === "watson")
      ) {
        return result({ ...state, pendingClue: n });
      }
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

    case "caseSolved": {
      // The answer's id rides along, stored verbatim for DEBRIEF and
      // read by nothing else (see the state field's fence).
      const withAnswer: DetectiveState = {
        ...state,
        answerPlaceId: event.answerPlaceId ?? null,
      };
      if (state.phase === "SELECTION_READ") {
        return result({ ...withAnswer, pendingEnd: "solved" });
      }
      if (state.phase === "CELEBRATE" || state.phase === "DEBRIEF") return noOp(state);
      return enterCelebrate(withAnswer);
    }

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
              // silence already happened before the announcement).
              // No ack on the Hook — the announcement spent that beat.
              // (The amazement fragment that once followed the decode
              // was CUT in the cure pass: it measured 49 wpm against
              // the ≥165 wpm breathless spec and could not reach the
              // floor even at the renderer's maximum speed — see
              // BRANCH_STATUS's cure-pass entry.)
              return result(
                { ...state, readingStep: "ack-decode" },
                [speak({ kind: "fixed", id: decodeIdForClue(4) })],
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
        case "CASE_OPEN":
          // The instruction duet drains one line at a time (U8).
          if (state.instructionsStep === "holmes") {
            return result({ ...state, instructionsStep: "watson" }, [
              speak({ kind: "fixed", id: "instructions-watson" }),
            ]);
          }
          if (state.instructionsStep === "watson") {
            const done: DetectiveState = { ...state, instructionsStep: "done" };
            // A clue that unlocked mid-duet starts now (pending pattern).
            if (done.pendingClue !== null) return startClue(done, done.pendingClue);
            return result(done);
          }
          return noOp(state);
        case "CELEBRATE":
          // Win lines drained. If the choreography already settled,
          // DEBRIEF starts now; otherwise remember the drain and let
          // the final beatElapsed open it — DEBRIEF waits for both.
          if (state.celebrateStep === "settle") return enterDebrief(state);
          return result({ ...state, celebrateSpeechDone: true });
        case "DEBRIEF":
          // The deduction drained → settle back to the station idle
          // (the host resets the machine wholesale on the next case).
          return result({ ...state, phase: "CASE_OPEN", instructionsStep: "done" });
        case "FAIL_READ":
          // POUT is sticky (U8): no dwell, no auto-advance — the pair
          // stays pouting while the case stays lost. Exits are only a
          // new case (caseOpened / clueUnlocked / the host's reset).
          return result({ ...state, phase: "POUT" });
        default:
          return noOp(state);
      }
    }

    case "beatElapsed": {
      if (state.phase === "NOTE_MARK") {
        // Miss beat over → Holmes asks for the next question. A pending
        // clue then starts on the ask's speechEnded; without one the
        // ASK_NEXT handler waits in SEARCH_IDLE (sheetClosed path).
        return result({ ...state, phase: "ASK_NEXT" }, [
          speak({ kind: "fixed", id: "ask-next" }),
        ]);
      }
      if (state.phase === "CELEBRATE") {
        // The choreography chain: jump → high-five (held) → clap
        // (held ~0.8 s) → settle. DEBRIEF opens from the settle only
        // if the win lines already drained (see speechEnded).
        switch (state.celebrateStep) {
          case "jump":
            return result({ ...state, celebrateStep: "high-five" }, [
              dwell(HIGH_FIVE_HOLD_MS),
            ]);
          case "high-five":
            return result({ ...state, celebrateStep: "clap" }, [dwell(CLAP_HOLD_MS)]);
          case "clap": {
            const settled: DetectiveState = { ...state, celebrateStep: "settle" };
            if (state.celebrateSpeechDone) return enterDebrief(settled);
            return result(settled);
          }
          default:
            return noOp(state);
        }
      }
      if (state.phase === "THINKING_BEAT") {
        if (state.readingStep === "announce") {
          // Hook silence over → Holmes announces, solo and hushed.
          return result(
            { ...state, phase: "READING" },
            [speak({ kind: "fixed", id: "hook-announcement" })],
          );
        }
        // Thinking beat over → Holmes acknowledges (next ack in the
        // count rotation) and delivers the clue-type decode; both
        // queue sequentially. The count advances here, at the one
        // place an ack is actually spoken.
        return result(
          { ...state, phase: "READING", acksPlayed: state.acksPlayed + 1 },
          [
            speak({ kind: "fixed", id: ackIdForAckCount(state.acksPlayed) }),
            speak({ kind: "fixed", id: decodeIdForClue(state.clueIndex) }),
          ],
        );
      }
      // POUT has no beatElapsed exit (sticky, U8) — it falls through
      // to the no-op like every other phase without a dwell.
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
