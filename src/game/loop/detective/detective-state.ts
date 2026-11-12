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
 *            `selection: true` marks a SELECTION read (the player picked a
 *            place but spent no guess): user-initiated audio, routed by
 *            the speech player to its depth-1 latest-wins slot.
 * - debrief: legacy single-ref form (the player resolves it to the
 *            debrief frame line). The machine no longer emits it: U8
 *            sequences DEBRIEF explicitly as fixed frame → name → fixed
 *            close, so each line is independently skippable. */
export type SpeakRef =
  | { kind: "clue"; clueIndex: number }
  | { kind: "fixed"; id: string }
  | { kind: "answer" }
  | { kind: "name"; placeId: string; selection?: true }
  | { kind: "debrief" };

/** Imperative effects emitted with a transition. Pose/placement are NOT
 * effects — they ride the view (see header). */
export type DetectiveEffect =
  | { type: "speak"; ref: SpeakRef }
  | { type: "dwell"; beatMs: number }
  /** Show clue card `clueIndex` (1-based) now: the deal opens its
   * starting clues ONE AT A TIME, each card appearing as Watson starts
   * reading it (owner, 2026-11-10: "clues should open 1 at a time and
   * watson should read it aloud"). The host reports it to the game,
   * which reveals cards up to the highest index presented. */
  | { type: "presentClue"; clueIndex: number }
  /** Cut whatever is playing and flush the queue (the player pinned
   * before Watson finished — the pin wins the voice). */
  | { type: "stopSpeech" }
  /** No clip was queued, but the ladder still needs its speechEnded
   * step (a confirm whose name and ack already played). The host
   * dispatches speechEnded on a microtask. */
  | { type: "continue" }
  /** A short speech bubble over one figure (moment lines). The text
   * always shows; the voice plays when the line's clip is rendered. */
  | { type: "caption"; who: "holmes" | "watson"; text: string; ms: number };

/** The ONLY inputs. Payloads are answer-blind by construction (header).
 * The two U8 exceptions are fenced: `freshDeal` says only whether this
 * deal is new (never anything about the case), and `answerPlaceId` —
 * the answer's id, known to the game only AFTER a solve — is stored
 * untouched and consumed solely by the DEBRIEF effect (see the state
 * field); it cannot influence any pre-solve transition. */
export type DetectiveEvent =
  | {
      type: "caseOpened";
      freshDeal: boolean;
      /** Play the instruction duet. Defaults to `freshDeal`; the host
       * passes false after the session's first case (the duet and
       * bench intro are first entry only — plan of record §2). */
      intro?: boolean;
      /** The deal's starting clue count: the opening reads clues
       * 1..openTarget one after another (fresh deal only). */
      openTarget?: number;
    }
  | { type: "clueUnlocked"; clueIndex: number }
  | { type: "speechEnded" }
  | { type: "beatElapsed" }
  | { type: "pointerPaused"; point: { x: number; y: number } }
  | { type: "pointerMoved" }
  | { type: "gestureStarted" }
  | { type: "sheetOpened" }
  | { type: "sheetClosed" }
  | { type: "guessConfirmed"; placeId: string }
  /** The player picked a place (search pick or a named map tap) and has
   * NOT spent a guess. Payload = the player's own pick only. */
  | { type: "selectionNamed"; placeId: string }
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
export type ReadingStep = "announce" | "watson-read" | "ack-decode" | "cut";

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
  /** A clue the game unlocked while a GUESS read was in flight; the
   * ladder visits it via ASK_NEXT once the guess read drains. (An
   * unlock that lands while a PICK read is in flight is remembered
   * here too, with the deferred-guess marker set beside it — see
   * pendingGuessConfirm: the marker/payload pair marks the clue as
   * the deferred guess's bridge payload.) */
  pendingClue: number | null;
  /** A case ending that arrived mid-selection-read; applied when the
   * read drains so Holmes never talks over his own selection line. */
  pendingEnd: "solved" | "failed" | null;
  /** A guess whose clue unlocked while the PICK read was still
   * audibly in flight. Set TOGETHER with pendingClue (the pair):
   * pendingClue is the bridge payload, this marker records that
   * the payload belongs to a guess confirmed during the pick read.
   * In the shipped player the pick clip and the guess read queue
   * back-to-back and drain as ONE queue event, so the single drain
   * runs the ordinary bridge (miss beat → ask-next → clue) off
   * pendingClue; the marker's own jobs are to start the clue from
   * the ASK_NEXT drain without a second ask, to be cleared by a
   * case ending or by the clue starting, and to let a sheetClosed
   * that somehow finds it standing alone reopen the bridge. The
   * guess read's suspicion is spoken exactly once — by
   * guessConfirmed, into that same queue — and the bridge never
   * speaks it again. */
  pendingGuessConfirm: number | null;
  /** Which read the ladder last armed: false while the read that
   * drains next is a PICK read (armed via speakSelection) with a
   * guess read queued behind it in the player; true while a GUESS
   * read (armed via guessConfirmed) owns the voice, and whenever no
   * read is pending. clueUnlocked consults it — together with
   * selectionReadDone's arming-marker job — to mark an unlock that
   * lands mid-selection-read as a deferred guess's payload (the
   * pendingGuessConfirm pair) rather than a plain pending clue.
   * A PICK read's own drain restores it to true (speechEnded at
   * rest, follow-up cure 2) — the exit instant is part of the read's
   * lifecycle, and a guess confirmed there still defers.
   * CAVEAT: guards suppress drained-while-held signals (e.g. the
   * deferred-drain consumption on sheet close), so a read can
   * drain without a speechEnded the ladder sees; hosts only ever
   * emit clueUnlocked/guess events off audible queue drains, so in
   * play the flag tracks the audible state faithfully. */
  selectionReadInFlight: boolean;
  /** How the CURRENT SELECTION_READ was armed (follow-up cure 2):
   * "direct" = a guess read armed at rest or mid clue chain (the
   * shipped kind); "post-pick" = a guess read armed while a PICK
   * read was playing ahead of it, or directly on a PICK read's
   * exit drain; null = no selection read stands. Two writers:
   * guessConfirmed, and the speechEnded pre-check in the SEARCH
   * phases — the pre-check is the only transition that knows a
   * pick read just drained at rest, so it leaves "post-pick"
   * standing as the arming trace and guessConfirmed preserves it.
   * The selection-read exit and every phase entry that clears the
   * read clear it. clueUnlocked reads it (never selectionReadDone,
   * whose resting meaning is the sheetClosed ASK_NEXT trigger) to
   * route a post-pick guess read's unlock to the deferred-guess
   * branch. */
  selectionReadKind: "direct" | "post-pick" | null;
  /** Ask-next was already spoken for the pending unlock (sheetClosed
   * path), so the arriving clueUnlocked goes straight to READING. */
  askNextSpoken: boolean;
  /** A guess read has completed this clue (its drain ran the
   * selection-read exit) and the ladder waits in SEARCH_IDLE: a
   * sheetClosed here is the task's ASK_NEXT trigger. Cleared by the
   * next guess, clue, or ending so a stray sheet cycle during
   * ordinary searching can never fire ask-next. ONE writer of true:
   * afterSelectionRead, on a guess read's exit. A PICK read's drain
   * never reaches that exit (a pick read never enters
   * SELECTION_READ; its at-rest drain is the speechEnded pre-check
   * in the SEARCH phases) and never sets it. The post-name arming
   * information lives in selectionReadKind instead — never overload
   * this flag with it again. */
  selectionReadDone: boolean;
  // Absence flags — state inputs, set/cleared only by their events.
  sheetOpen: boolean;
  externalSpeech: boolean;
  ringAnimating: boolean;
  /** Last pointer-pause point (kinematics only — U6's berth solver input). */
  lastPausePoint: { x: number; y: number } | null;
  /** How many acknowledgements have actually played in this case.
   * The count is bookkeeping only — it never picks the line: the ack
   * is a random draw from the pool minus this case's played-set
   * (acksUsed below; drawAckId), so no line repeats inside a case
   * and the draw takes no clue or game state as input. (The retired
   * count rotation keyed the line to this count and repeated lines;
   * the Hook, clue 4, plays no ack at all.) */
  acksPlayed: number;
  /** The pool line ids already played this case — the played-set the
   * random ack draw excludes (never a repeat inside a case). */
  acksUsed: readonly string[];
  /** Guesses the machine has seen confirmed (counted from its OWN
   * guessConfirmed events — an internal dedup key, never a picker input). */
  guessesConfirmed: number;
  /** The last selection name actually emitted, keyed by (placeId,
   * guessesConfirmed, clueIndex). Re-naming the same place in the same
   * clue cycle is a no-op; confirming it as a guess skips the name. */
  lastNamed: { placeId: string; guesses: number; clue: number } | null;
  /** A selection read held back because a clue chain is live (depth-1,
   * latest-wins). Flushed when the ladder rests in SEARCH_IDLE; discarded
   * by a guess confirmation, a clue unlock, or a case ending. */
  pendingSelection: string | null;
  /** The opening sequence's last clue: while clueIndex < openTarget
   * the ladder reads the next starting clue as soon as Holmes's ack
   * for the current one drains, with no ask in between. 0 = no
   * opening sequence (a resumed case, or one clue dealt). A pin
   * during the opening ends the sequence. */
  openTarget: number;
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
    pendingGuessConfirm: null,
    selectionReadInFlight: false,
    selectionReadKind: null,
    askNextSpoken: false,
    selectionReadDone: false,
    sheetOpen: false,
    externalSpeech: false,
    ringAnimating: false,
    lastPausePoint: null,
    acksPlayed: 0,
    acksUsed: [],
    guessesConfirmed: 0,
    lastNamed: null,
    pendingSelection: null,
    openTarget: 0,
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

/** The ack pool: Holmes's acknowledgement lines in the manifest's
 * `fixed` table. Agent VOICE's renders bring this to 10 entries. */
export const ACK_POOL_SIZE = 10;
export const ACK_POOL_IDS: readonly string[] = Array.from(
  { length: ACK_POOL_SIZE },
  (_, i) => `ack-${i + 1}`,
);

/** The lines still on offer: the pool minus what already played this
 * case. Takes the played-set and NOTHING else — no guesses, no
 * correctness, no clue index — which is what keeps the draw
 * answer-blind. Pool exhausted → every line except the one just said
 * (played's last entry), so a wrap is never back-to-back. An empty
 * played-set is the full pool. */
export function ackCandidates(played: readonly string[]): readonly string[] {
  const left = ACK_POOL_IDS.filter((id) => !played.includes(id));
  if (left.length > 0) return left;
  const last = played[played.length - 1];
  if (last === undefined) return ACK_POOL_IDS;
  const wrapped = ACK_POOL_IDS.filter((id) => id !== last);
  return wrapped.length > 0 ? wrapped : ACK_POOL_IDS;
}

/** Random draw from the candidates. `rng` is injectable (0 ≤ r < 1). */
export function drawAckId(
  played: readonly string[],
  rng: () => number = Math.random,
): string {
  const pool = ackCandidates(played);
  const r = rng();
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(r * pool.length)));
  return pool[i]!;
}

export function decodeIdForClue(clueIndex: number): string {
  return `decode-${CLUE_TYPE_BY_INDEX[clueIndex] ?? "geography"}`;
}

/* ------------------------------------------------------------------ */
/* View — a pure derivation from state                                 */
/* ------------------------------------------------------------------ */

/** Moment lines (owner, 2026-11-10). Each shows as a bubble at once;
 * its voice plays once the clip is rendered with the pinned voice
 * (an id the manifest lacks is skipped silently by the player — the
 * fallback law), so the bubble alone carries the line until then.
 * DRAFT wording: owner review. The player is Holmes's partner here —
 * "player is the holmes" — so Watson speaks to the player. */
export const MOMENT_LINES = Object.freeze({
  beatMe: { id: "beat-me", who: "watson", text: "You beat me to it!" },
  together: { id: "win-together", who: "holmes", text: "We did it together!" },
  truce: {
    id: "truce-watson",
    who: "watson",
    text: "Good try! We'll crack the next one together.",
  },
} as const);
export type MomentLineKey = keyof typeof MOMENT_LINES;
export const MOMENT_CAPTION_MS = 2600;

const momentEffects = (key: MomentLineKey): DetectiveEffect[] => {
  const line = MOMENT_LINES[key];
  return [
    { type: "caption", who: line.who, text: line.text, ms: MOMENT_CAPTION_MS },
    { type: "speak", ref: { kind: "fixed", id: line.id } },
  ];
};

export function viewForState(state: DetectiveState): DetectiveView {
  // The pair stays on screen while the guess sheet is open and while
  // the ring plays (plan of record §2: they never vanish mid-case —
  // the zero-overlap layout keeps them off the clue text instead).
  // Only another surface's own speech still clears the stage.
  const hidden = state.phase === "OFF" || state.externalSpeech;
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
      // The truce (plan of record §5): no pout — Holmes nods, Watson
      // cheers the player on (his line rides the POUT entry).
      return {
        ...base,
        holmes: { pose: "ack", placement: "station", speaking: false },
        watson: { pose: "station-idle", placement: "station", speaking: false },
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

function takeAck(
  state: DetectiveState,
  rng: () => number,
): { ackId: string; acksPlayed: number; acksUsed: readonly string[] } {
  const ackId = drawAckId(state.acksUsed, rng);
  return {
    ackId,
    acksPlayed: state.acksPlayed + 1,
    acksUsed: [...state.acksUsed, ackId],
  };
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
function startClue(
  state: DetectiveState,
  clueIndex: number,
  selectionReadInFlight = true,
): Step & { view: DetectiveView } {
  const next: DetectiveState = {
    ...state,
    clueIndex,
    pendingClue: null,
    pendingGuessConfirm: null,
    selectionReadInFlight,
    selectionReadKind: null,
    askNextSpoken: false,
    selectionReadDone: false,
    pendingSelection: null, // a clue unlock discards a pending read
    celebrateStep: null,
    celebrateSpeechDone: false,
  };
  const present: DetectiveEffect = { type: "presentClue", clueIndex };
  if (clueIndex === 4) {
    return result(
      { ...next, phase: "THINKING_BEAT", readingStep: "announce" },
      [present, dwell(HOOK_BEAT_MS)],
    );
  }
  return result(
    { ...next, phase: "READING", readingStep: "watson-read" },
    [present, speak({ kind: "clue", clueIndex })],
  );
}

function enterCelebrate(
  state: DetectiveState,
  selectionReadInFlight = true,
): Step & { view: DetectiveView } {
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
      pendingGuessConfirm: null,
      selectionReadInFlight,
      selectionReadKind: null,
      pendingSelection: null,
      selectionReadDone: false,
      celebrateStep: "jump",
      celebrateSpeechDone: false,
      openTarget: 0,
    },
    [
      speak({ kind: "fixed", id: "win-holmes" }),
      ...momentEffects("together"),
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
function enterNoteMark(
  state: DetectiveState,
  selectionReadInFlight = true,
): Step & { view: DetectiveView } {
  return result(
    {
      ...state,
      phase: "NOTE_MARK",
      selectionReadDone: false,
      selectionReadKind: null,
      selectionReadInFlight,
    },
    [dwell(NOTE_MARK_MS)],
  );
}

function enterFailRead(
  state: DetectiveState,
  selectionReadInFlight = true,
): Step & { view: DetectiveView } {
  return result(
    {
      ...state,
      phase: "FAIL_READ",
      readingStep: null,
      pendingEnd: null,
      pendingClue: null,
      pendingGuessConfirm: null,
      selectionReadInFlight,
      selectionReadKind: null,
      pendingSelection: null,
      selectionReadDone: false,
      openTarget: 0,
    },
    [speak({ kind: "answer" })],
  );
}

/** After a selection read drains: a pending ending wins, then a pending
 * clue goes through ASK_NEXT, otherwise back to searching. */
function afterSelectionRead(state: DetectiveState): Step & { view: DetectiveView } {
  if (state.pendingEnd === "solved") return enterCelebrate(state, state.selectionReadInFlight);
  if (state.pendingEnd === "failed") return enterFailRead(state, state.selectionReadInFlight);
  if (state.pendingClue !== null && state.pendingClue > state.clueIndex) {
    // A next clue is pending: the voiceless miss beat comes first,
    // then ASK_NEXT bridges to it (NOTE_MARK's beatElapsed handler).
    // A deferred-guess pair (marker standing beside pendingClue)
    // takes this same bridge: in the shipped player the pick clip
    // and the guess read drain as ONE queue event — there is no
    // second drain to wait for, and the confirm's sheet cycle has
    // already closed — so settling at rest here would strand the
    // clue with no trigger left to start it.
    return enterNoteMark(state, state.selectionReadInFlight);
  }
  if (state.openTarget > state.clueIndex && state.clueIndex >= 1) {
    return startClue(state, state.clueIndex + 1, state.selectionReadInFlight);
  }
  return result({
    ...state,
    phase: "SEARCH_IDLE",
    // Every exit through here is a GUESS read's exit: SELECTION_READ
    // is entered only by guessConfirmed (a PICK read never changes
    // the phase — its at-rest drain is the speechEnded pre-check in
    // the SEARCH phases, which never touches this flag). So the
    // completion flag is set unconditionally, exactly as shipped:
    // resting with it true is the sheetClosed ASK_NEXT trigger.
    // The arming kind is always cleared here: no selection read
    // stands once its exit has run.
    selectionReadDone: true,
    selectionReadKind: null,
    selectionReadInFlight: true,
  });
}

/** Emit a selection read: the place name, then one ack from the pool
 * (never the single "it could be it" line). Stays in the current phase
 * when the ladder is at rest: it spends no guess, so it never arms the
 * miss beat / ASK_NEXT path and never touches ringAnimating. */
function speakSelection(
  state: DetectiveState,
  placeId: string,
  rng: () => number,
): Step & { view: DetectiveView } {
  const ack = takeAck(state, rng);
  return result(
    {
      ...state,
      pendingSelection: null,
      selectionReadInFlight: false,
      lastNamed: { placeId, guesses: state.guessesConfirmed, clue: state.clueIndex },
      acksPlayed: ack.acksPlayed,
      acksUsed: ack.acksUsed,
    },
    [
      speak({ kind: "name", placeId, selection: true }),
      speak({ kind: "fixed", id: ack.ackId }),
    ],
  );
}

/** Watson is mid-question. The pick wins the voice: his read stops,
 * Holmes names the place and acknowledges. The next opening clue waits
 * until this pin is confirmed, or until the sheet is dismissed and this
 * line has drained — never while the sheet is still open, or the
 * confirm would cut the new clue and say beat-me a second time. */
function cutWatsonRead(
  state: DetectiveState,
  placeId: string,
  rng: () => number,
): Step & { view: DetectiveView } {
  const ack = takeAck(state, rng);
  return result(
    {
      ...state,
      phase: "SEARCH_IDLE",
      readingStep: "cut",
      pendingSelection: null,
      pendingClue: null,
      pendingGuessConfirm: null,
      selectionReadInFlight: false,
      selectionReadKind: null,
      askNextSpoken: false,
      lastNamed: { placeId, guesses: state.guessesConfirmed, clue: state.clueIndex },
      acksPlayed: ack.acksPlayed,
      acksUsed: ack.acksUsed,
    },
    [
      { type: "stopSpeech" },
      ...momentEffects("beatMe"),
      speak({ kind: "name", placeId, selection: true }),
      speak({ kind: "fixed", id: ack.ackId }),
    ],
  );
}

/** The ladder just came to rest: a read held back during the clue chain
 * fires now. With nothing pending this is just `result(state)`. */
function restingResult(
  state: DetectiveState,
  rng: () => number,
): Step & { view: DetectiveView } {
  if (state.pendingSelection === null) {
    return result({ ...state, selectionReadInFlight: true });
  }
  return speakSelection(state, state.pendingSelection, rng);
}

/** Phases where a clue chain (or the opening duet) still owns the
 * voice. A pin here used to be dropped on the floor (the guess read
 * never played); now the pin wins: speech stops, Watson says "You beat
 * me to it!" if he was still on a clue, and Holmes reads the pick. */
const INTERRUPTIBLE_PHASES: ReadonlySet<DetectivePhase> = new Set([
  "CASE_OPEN",
  "READING",
  "THINKING_BEAT",
  "NOTE_MARK",
  "ASK_NEXT",
]);

function interruptWithGuess(
  state: DetectiveState,
  placeId: string,
  rng: () => number,
): Step & { view: DetectiveView } {
  if (state.phase === "CASE_OPEN" && state.instructionsStep === "awaiting") {
    return noOp(state);
  }
  const midClue =
    state.phase === "READING" ||
    state.phase === "THINKING_BEAT" ||
    state.openTarget > state.clueIndex;
  const ack = takeAck(state, rng);
  return result(
    {
      ...state,
      phase: "SELECTION_READ",
      instructionsStep:
        state.instructionsStep === "holmes" || state.instructionsStep === "watson"
          ? "done"
          : state.instructionsStep,
      readingStep: null,
      openTarget: 0,
      pendingClue: null,
      pendingGuessConfirm: null,
      ringAnimating: true,
      lastPausePoint: null,
      pendingSelection: null,
      selectionReadInFlight: true,
      selectionReadDone: false,
      selectionReadKind: "direct",
      askNextSpoken: false,
      lastNamed: null,
      guessesConfirmed: state.guessesConfirmed + 1,
      acksPlayed: ack.acksPlayed,
      acksUsed: ack.acksUsed,
    },
    [
      { type: "stopSpeech" },
      ...(midClue ? momentEffects("beatMe") : []),
      speak({ kind: "name", placeId }),
      speak({ kind: "fixed", id: ack.ackId }),
    ],
  );
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
  rng: () => number = Math.random,
): Step & { view: DetectiveView } {
  // Absence flags are phase-independent state inputs.
  switch (event.type) {
    case "sheetOpened":
      // The guess sheet is the player's focus now: a thinking pause
      // that was confirmed on the map ends here, so Holmes is back at
      // the dock while the sheet is up (the pair stays visible under
      // the sheet since 2026-11-10, so a berth would show).
      if (state.phase === "SEARCH_AREA") {
        return result({ ...state, sheetOpen: true, phase: "SEARCH_IDLE", lastPausePoint: null });
      }
      return result({ ...state, sheetOpen: true });
    case "sheetClosed": {
      const closed = { ...state, sheetOpen: false };
      // Safety net: a deferred-guess marker somehow standing alone
      // at rest (its clue unlocked while the pick read was playing;
      // the guess read has since played from the queue) — a sheet
      // cycle reopens its bridge from the marker: the miss beat
      // first, then the plain ask (the suspicion already played).
      // The marker remembers which clue waits behind the guess read.
      if (
        closed.phase === "SEARCH_IDLE" &&
        closed.pendingGuessConfirm !== null &&
        closed.pendingEnd === null
      ) {
        return enterNoteMark(
          { ...closed, pendingClue: closed.pendingGuessConfirm },
          false,
        );
      }
      // Task flow: sheetClosed → if more clues, ASK_NEXT (Holmes asks for
      // the next question; the game then fires clueUnlocked). Only after
      // a completed selection read (selectionReadDone), only when a next
      // clue can exist, and only once — a sheet cycle during ordinary
      // searching (e.g. a cancelled pick) never fires it.
      // A pick cut the opening and the sheet is going away without a
      // guess. The line has already drained (readingStep is no longer
      // "cut"); continue with the next starting card. While the line
      // is still playing, speechEnded does this once the sheet is shut.
      if (
        (closed.phase === "SEARCH_IDLE" || closed.phase === "SEARCH_AREA") &&
        closed.readingStep !== "cut" &&
        closed.selectionReadKind === "post-pick" &&
        closed.openTarget > closed.clueIndex &&
        closed.clueIndex >= 1 &&
        closed.pendingClue === null &&
        closed.pendingGuessConfirm === null &&
        closed.pendingEnd === null
      ) {
        return startClue(closed, closed.clueIndex + 1, true);
      }
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
        return enterNoteMark(closed, false);
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
        // as U5 whenever its clue arrives (the current clue only).
        return restingResult({ ...base, instructionsStep: "skipped", openTarget: 0 }, rng);
      }
      const target =
        typeof event.openTarget === "number" &&
        Number.isInteger(event.openTarget) &&
        event.openTarget > 1
          ? Math.min(5, event.openTarget)
          : 0;
      const opened: DetectiveState = { ...base, openTarget: target };
      if (event.intro === false) {
        // Case 2+ of the session: no duet (first entry only).
        return restingResult({ ...opened, instructionsStep: "done" }, rng);
      }
      // Fresh deal: Holmes's instruction line first (Q4 case open).
      return result({ ...opened, instructionsStep: "holmes" }, [
        speak({ kind: "fixed", id: "instructions-holmes" }),
      ]);
    }

    case "clueUnlocked": {
      const n = event.clueIndex;
      if (!Number.isInteger(n) || n < 1 || n > 5) return noOp(state);
      // A clue unlock supersedes and discards a pending selection read.
      if (state.pendingSelection !== null) {
        return transition({ ...state, pendingSelection: null }, event, rng);
      }
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
        if (!state.selectionReadInFlight || state.selectionReadKind === "post-pick") {
          // The deferred-guess branch: EITHER a PICK read owns the
          // voice and the guess read is queued behind it in the
          // player (selectionReadInFlight = false), OR the confirm
          // landed just AFTER the pick read drained (follow-up
          // cure 2): the pick read's exit drain already restored
          // the kind flag to true, but selectionReadKind marks this
          // SELECTION_READ as the guess read armed on top of a
          // completed pick read — the kind field is the only thing
          // distinguishing it from a shipped guess-read-in-flight
          // (selectionReadDone cannot be: its resting meaning is
          // the sheetClosed ASK_NEXT trigger, and overloading it
          // broke the shipped sheet-flow pins).
          // Remember the unlock as the deferred guess's bridge
          // payload — pendingClue carries the clue, the marker
          // beside it records whose it is. The clips drain as one
          // queue event and that drain runs the ordinary bridge off
          // pendingClue (afterSelectionRead).
          return result({ ...state, pendingGuessConfirm: n, pendingClue: n });
        }
        return result({ ...state, pendingClue: n });
      }
      // From ASK_NEXT the ask was already spoken (sheetClosed path or
      // the pending path) — go straight to the clue.
      return startClue(state, n, state.selectionReadInFlight);
    }

    case "guessConfirmed": {
      if (INTERRUPTIBLE_PHASES.has(state.phase)) {
        return interruptWithGuess(state, event.placeId, rng);
      }
      if (state.phase !== "SEARCH_IDLE" && state.phase !== "SEARCH_AREA") {
        return noOp(state);
      }
      // Dedup: the pick was just named in this clue cycle -> do not
      // say the name again. If that name+ack is still queued, add
      // nothing (its drain is the bridge). If it already drained, ask
      // the host to take the speechEnded step with no second line.
      // Never the fixed "it could be it" line.
      const alreadyNamed =
        state.lastNamed !== null &&
        state.lastNamed.placeId === event.placeId &&
        state.lastNamed.guesses === state.guessesConfirmed &&
        state.lastNamed.clue === state.clueIndex;
      const ack = alreadyNamed ? null : takeAck(state, rng);
      const lines: DetectiveEffect[] = alreadyNamed
        ? state.selectionReadInFlight
          ? [{ type: "continue" }]
          : []
        : [
            speak({ kind: "name", placeId: event.placeId }),
            speak({ kind: "fixed", id: ack!.ackId }),
          ];
      return result(
        {
          ...state,
          phase: "SELECTION_READ",
          // A non-interrupting guess leaves the opening in place.
          readingStep: null,
          ringAnimating: true,
          lastPausePoint: null,
          pendingSelection: null,
          selectionReadInFlight: state.selectionReadInFlight,
          selectionReadDone: false,
          selectionReadKind:
            state.selectionReadKind === "post-pick" || !state.selectionReadInFlight
              ? "post-pick"
              : "direct",
          lastNamed: null,
          guessesConfirmed: state.guessesConfirmed + 1,
          acksPlayed: ack ? ack.acksPlayed : state.acksPlayed,
          acksUsed: ack ? ack.acksUsed : state.acksUsed,
        },
        lines,
      );
    }

    case "selectionNamed": {
      if (typeof event.placeId !== "string" || event.placeId.length === 0) {
        return noOp(state);
      }
      const named = state.lastNamed;
      if (
        named !== null &&
        named.placeId === event.placeId &&
        named.guesses === state.guessesConfirmed &&
        named.clue === state.clueIndex
      ) {
        return noOp(state); // same place, same clue cycle
      }
      switch (state.phase) {
        case "SEARCH_IDLE":
        case "SEARCH_AREA":
          return speakSelection(
            { ...state, selectionReadInFlight: false },
            event.placeId,
            rng,
          );
        case "CASE_OPEN":
          // Instructions may still be playing / not yet decided.
          if (state.instructionsStep === "done" || state.instructionsStep === "skipped") {
            return speakSelection(
              { ...state, selectionReadInFlight: false },
              event.placeId,
              rng,
            );
          }
          return result({
            ...state,
            pendingSelection: event.placeId,
            selectionReadInFlight: true,
          });
        case "READING":
          if (state.readingStep === "watson-read") {
            return cutWatsonRead(state, event.placeId, rng);
          }
          if (state.pendingSelection === event.placeId) return noOp(state);
          return result({ ...state, pendingSelection: event.placeId });
        case "THINKING_BEAT":
        case "NOTE_MARK":
        case "ASK_NEXT":
          // A clue chain is live: wait (depth-1, latest wins).
          if (state.pendingSelection === event.placeId) return noOp(state);
          return result({ ...state, pendingSelection: event.placeId });
        default:
          // SELECTION_READ (a guess owns the voice), CELEBRATE, FAIL_READ,
          // POUT, DEBRIEF: nothing to name.
          return noOp(state);
      }
    }

    case "caseSolved": {
      // The answer's id rides along, stored verbatim for DEBRIEF and
      // read by nothing else (see the state field's fence).
      const withAnswer: DetectiveState = {
        ...state,
        answerPlaceId: event.answerPlaceId ?? null,
      };
      if (state.phase === "SELECTION_READ") {
        return result({ ...withAnswer, pendingEnd: "solved", pendingSelection: null });
      }
      if (state.phase === "CELEBRATE" || state.phase === "DEBRIEF") return noOp(state);
      return enterCelebrate(withAnswer, state.selectionReadInFlight);
    }

    case "caseFailed":
      if (state.phase === "SELECTION_READ") {
        return result({ ...state, pendingEnd: "failed", pendingSelection: null });
      }
      if (state.phase === "FAIL_READ" || state.phase === "POUT") return noOp(state);
      return enterFailRead(state, state.selectionReadInFlight);

    case "speechEnded": {
      // Follow-up cure 2 — a PICK read drains while the machine
      // rests in a SEARCH phase (speakSelection never changes the
      // phase): that drain is the read's exit instant, and the
      // ladder must mark the kind restored — no GUESS read pending —
      // so a guessConfirmed landing right after it keeps the
      // shipped deferral behaviour (its clue unlock is stored as
      // the deferred guess's payload, not as a plain pending clue
      // behind a stale completion flag whose sheet cycle already
      // closed at the spend). The drain itself advances nothing.
      if (
        (state.phase === "SEARCH_IDLE" || state.phase === "SEARCH_AREA") &&
        !state.selectionReadInFlight &&
        state.pendingSelection === null
      ) {
        // Watson's question was cut for this pick. The next starting
        // card opens only once the sheet is gone. While it is open the
        // confirm of this same pin must not land in READING, or it
        // would say beat-me, the name, and an ack again.
        if (
          state.readingStep === "cut" &&
          !state.sheetOpen &&
          state.openTarget > state.clueIndex &&
          state.clueIndex >= 1
        ) {
          return startClue({ ...state, readingStep: null }, state.clueIndex + 1, true);
        }
        return result({
          ...state,
          readingStep: null,
          selectionReadInFlight: true,
          selectionReadKind: "post-pick",
        });
      }
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
          // The opening sequence: the next starting clue follows
          // Holmes's ack straight away — no ask in between.
          if (state.openTarget > state.clueIndex && state.clueIndex >= 1) {
            return startClue(state, state.clueIndex + 1, state.selectionReadInFlight);
          }
          // ack-decode drained → guessing phase, Holmes to the dock.
          return restingResult({
            ...state,
            phase: "SEARCH_IDLE",
            readingStep: null,
          }, rng);
        case "SELECTION_READ":
          return afterSelectionRead(state);
        case "ASK_NEXT": {
          if (state.pendingGuessConfirm !== null) {
            // The guess bridge's ASK_NEXT just spoke (suspicion):
            // its clue starts now — no second ask.
            return startClue(
              { ...state, askNextSpoken: true },
              state.pendingGuessConfirm,
              state.selectionReadInFlight,
            );
          }
          if (state.pendingClue !== null) {
            return startClue(state, state.pendingClue, state.selectionReadInFlight);
          }
          // Ask spoken via the sheetClosed path; the game's clueUnlocked
          // is still coming. Wait in SEARCH_IDLE (askNextSpoken marks
          // that the next clueUnlocked needs no second ask).
          return restingResult({ ...state, phase: "SEARCH_IDLE", askNextSpoken: true }, rng);
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
            return restingResult(done, rng);
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
          // The truce (plan of record §5): after the answer, Watson
          // cheers the player up — no pout. POUT stays the sticky rest
          // phase (its view is the kind truce pose); exits are only a
          // new case (caseOpened / clueUnlocked / the host's reset).
          return result({ ...state, phase: "POUT" }, momentEffects("truce"));
        default:
          return noOp(state);
      }
    }

    case "beatElapsed": {
      if (state.phase === "NOTE_MARK") {
        // Miss beat over → Holmes asks for the next question. A pending
        // clue then starts on the ask's speechEnded; without one the
        // ASK_NEXT handler waits in SEARCH_IDLE (sheetClosed path).
        // A deferred-guess pair takes the plain ask too: the guess
        // read's suspicion was already spoken by guessConfirmed into
        // the same queue drain that opened this beat, so speaking it
        // here would play the reaction twice.
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
        // Thinking beat over → Holmes acknowledges (a random draw
        // from the ack pool minus the lines already played this
        // case — drawAckId; the draw sees only the played-set) and
        // delivers the clue-type decode; both queue sequentially.
        // The count advances here, at the one place an ack is
        // actually spoken.
        const ackId = drawAckId(state.acksUsed, rng);
        return result(
          {
            ...state,
            phase: "READING",
            acksPlayed: state.acksPlayed + 1,
            acksUsed: [...state.acksUsed, ackId],
          },
          [
            speak({ kind: "fixed", id: ackId }),
            speak({ kind: "fixed", id: decodeIdForClue(state.clueIndex) }),
          ],
        );
      }
      // POUT has no beatElapsed exit (sticky, U8) — it falls through
      // to the no-op like every other phase without a dwell.
      return noOp(state);
    }

    case "pointerPaused":
      // A pointer resting on the map while the guess sheet is up is
      // not a thinking pause: the player is answering the sheet.
      if (state.phase === "SEARCH_IDLE" && !state.sheetOpen) {
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
