/**
 * detective-audio.ts — the pair's sequential speech player (U5).
 *
 * One queue, one voice at a time: dialogue is strictly sequential by
 * design (council Q3 — the authored gap between speakers does the
 * interrupting; there is no overlap). The player resolves the state
 * machine's speak intents (SpeakRef) to pre-rendered clips through the
 * audio manifest and plays them in enqueue order.
 *
 * Coverage = manifest ENTRY PRESENCE. A ref with no entry is skipped
 * silently — a case without renders plays exactly as today's game
 * (BUILD-SCOPE §1.6 fallback law), and the queue NEVER stalls on a
 * missing or broken clip: a 404 / codec error resolves as skipped.
 *
 * Gates, checked at PLAY time (not enqueue time, so a toggle mid-queue
 * is honoured):
 * - the global sound toggle (isSoundEnabled, src/game/audio/sfx.ts) and
 *   the hidden-tab guard (soundAudible, src/game/audio/play-guards.ts);
 * - the player's read-aloud preference: auto-speech only when
 *   shouldAutoPlayReadAloud allows it for this surface. The detective
 *   loop is an autoplay surface by design (like the 5–7 story cards),
 *   so the host context passes bandAutoplay=true — the preference still
 *   vetoes: "never" and "sometimes" mean no auto speech, ever.
 * - first-gesture unlock: browsers refuse audio before a user gesture,
 *   so playback waits for the first pointerdown, following the
 *   storyteller's proven one-shot pattern (decideFirstGesture in
 *   storyteller-audio-guards.ts): a gesture that lands while sound is
 *   off does NOT consume the one-shot.
 *
 * Speech modes (U9, degradation matrix §2.5 — the mode itself is
 * decided by detective-degradation.ts and set by the host):
 * - "auto": the U5 behaviour above, unchanged — plus retention: the
 *   player ALSO remembers the most recent clue sequence (Unit A), so
 *   a tap on Watson can replay it (see "tap").
 * - "tap": an enqueued item resolves immediately as skipped — the
 *   ladder advances silently, exactly like a dropped item — BUT the
 *   player remembers the most recent clue sequence (the current
 *   clue's read + ack + decode chain). The host's Listen button and
 *   the tap-Watson control both call playHeldSequence() to play
 *   those held refs for real; the sound gate still applies at that
 *   play time, the read-aloud autoplay veto does NOT (a tap is the
 *   kid choosing to listen).
 * - "off": items resolve skipped and nothing is held.
 *
 * Retention happens at ENQUEUE time (Unit A), not play time: a clue
 * chain is enqueued as one synchronous burst while its first clip is
 * still playing, so play-time recording would hold only the clip in
 * flight and a mid-play replay could not restart the full chain.
 *
 * The manifest loads lazily, once, on first use (module-level promise);
 * a failed load degrades to empty coverage. It never blocks case play.
 *
 * Test seams: every environment touchpoint (manifest load, clip
 * playback, gates) is injectable, so the queue logic is node-testable
 * with no DOM and no real Audio element.
 */

// Relative imports with extensions, so this module loads under the
// repo's node --test runner (no bundler alias resolution) as well as Vite.
import { assetBase } from "../../../components/storyteller-lines.ts";
import { decideFirstGesture } from "../../../components/storyteller-audio-guards.ts";
import { isSoundEnabled } from "../../audio/sfx.ts";
import { soundAudible } from "../../audio/play-guards.ts";
import {
  getReadAloudPref,
  shouldAutoPlayReadAloud,
} from "../../age-profile/read-aloud-pref.ts";
import type { SpeakRef } from "./detective-state.ts";
import type { SpeechMode } from "./detective-degradation.ts";

export type { SpeechMode };

/* ------------------------------------------------------------------ */
/* Manifest shape (public/audio/detective/manifest.json, U1–U3)        */
/* ------------------------------------------------------------------ */

export interface DetectiveManifestEntry {
  file: string;
  voice: string;
}

export interface DetectiveManifest {
  v: number;
  voices: { holmes: string; watson: string };
  fixed: Record<string, DetectiveManifestEntry | undefined>;
  cases: Record<
    string,
    | {
        clues: Array<DetectiveManifestEntry | null | undefined>;
        answer: DetectiveManifestEntry | null;
      }
    | undefined
  >;
  names: Record<string, DetectiveManifestEntry | undefined>;
}

export type DetectiveSpeaker = "holmes" | "watson";

export interface ResolvedClip {
  /** URL path under the app base, e.g. "audio/detective/case-387/clue-1.mp3". */
  url: string;
  who: DetectiveSpeaker;
}

/**
 * Pure ref → clip resolution. Returns null when the manifest has no
 * entry for the ref (uncovered = silent, by the fallback law).
 * `caseIndex` is the case the player is bound to (clue/answer refs are
 * per-case; fixed and name refs are global).
 */
export function resolveDetectiveClip(
  manifest: DetectiveManifest | null,
  ref: SpeakRef,
  caseIndex: number,
  base: string = assetBase(),
): ResolvedClip | null {
  if (!manifest) return null;
  let entry: DetectiveManifestEntry | null | undefined;
  switch (ref.kind) {
    case "clue":
      entry = manifest.cases[String(caseIndex)]?.clues[ref.clueIndex - 1];
      break;
    case "answer":
      entry = manifest.cases[String(caseIndex)]?.answer;
      break;
    case "fixed":
      entry = manifest.fixed[ref.id];
      break;
    case "name": {
      // Picks carry GeoNames ids ("geonames:323786"); the manifest's
      // names table is keyed by the bare numeric id.
      const key = ref.placeId.startsWith("geonames:")
        ? ref.placeId.slice("geonames:".length)
        : ref.placeId;
      entry = manifest.names[key];
      break;
    }
    case "debrief":
      // U5: the debrief ref resolves to the frame line; U8 sequences the
      // full debrief (frame → name → close) as separate fixed refs.
      entry = manifest.fixed["debrief-frame"];
      break;
  }
  if (!entry || typeof entry.file !== "string" || entry.file.length === 0) {
    return null;
  }
  const who: DetectiveSpeaker =
    entry.voice === manifest.voices?.watson
      ? "watson"
      : entry.voice === manifest.voices?.holmes
        ? "holmes"
        : ref.kind === "clue"
          ? "watson"
          : "holmes";
  return { url: `${base}audio/detective/${entry.file}`, who };
}

/* ------------------------------------------------------------------ */
/* Lazy one-time manifest load (module-level promise)                  */
/* ------------------------------------------------------------------ */

let manifestPromise: Promise<DetectiveManifest | null> | null = null;

export function loadDetectiveManifest(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<DetectiveManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetchImpl(`${assetBase()}audio/detective/manifest.json`);
        if (!res.ok) return null;
        const parsed: unknown = await res.json();
        if (!parsed || typeof parsed !== "object") return null;
        const m = parsed as Partial<DetectiveManifest>;
        if (m.v !== 1) return null;
        return {
          v: 1,
          voices: m.voices ?? { holmes: "", watson: "" },
          fixed: m.fixed ?? {},
          cases: m.cases ?? {},
          names: m.names ?? {},
        };
      } catch {
        return null; // silent degradation: empty coverage
      }
    })();
  }
  return manifestPromise;
}

/** Test seam: drop the cached manifest promise. */
export function __resetDetectiveManifestCache(): void {
  manifestPromise = null;
}

/* ------------------------------------------------------------------ */
/* The player                                                          */
/* ------------------------------------------------------------------ */

export interface DetectiveSpeechOptions {
  /** Fires when a clip starts (with its speaker) and once with null
   * when the queue fully drains. The host maps the null drain to the
   * machine's speechEnded event. */
  onSpeakingChange?: (who: DetectiveSpeaker | null) => void;
  /** Case the clue/answer refs resolve against. */
  caseIndex?: number;
  /** Initial speech mode (U9); the host updates it via setSpeechMode
   * as the degradation signals change. Defaults to "auto" (U5). */
  speechMode?: SpeechMode;
  /* Test seams (defaults wire the real environment). */
  loadManifest?: () => Promise<DetectiveManifest | null>;
  playClip?: (clip: ResolvedClip) => Promise<void>;
  isSoundOn?: () => boolean;
  canAutoPlay?: () => boolean;
}

export interface DetectiveSpeechPlayer {
  enqueue(ref: SpeakRef): void;
  stopAll(): void;
  dispose(): void;
  setCaseIndex(caseIndex: number): void;
  /** U9: set the speech mode ("auto" | "tap" | "off"). Entering
   * "off" drops the held sequence (in "off" nothing is held);
   * switching between "auto" and "tap" keeps it — both modes retain
   * the current clue's chain for replay (Unit A). */
  setSpeechMode(mode: SpeechMode): void;
  getSpeechMode(): SpeechMode;
  /** The held clue sequence (read + ack + decode of the most recent
   * clue), oldest first, retained in "auto" and "tap" modes. Empty
   * in "off" mode. */
  heldRefs(): readonly SpeakRef[];
  /** Play the held sequence for real (the Listen button in tap mode;
   * the tap-Watson control in auto and tap modes). Sound gates still
   * apply at play time; a no-op in "off" mode or when nothing is
   * held. Calling it while speech is playing RESTARTS the held
   * sequence from its first item (Unit A: an explicit repeat request
   * interrupts whatever is in flight). */
  playHeldSequence(): Promise<void>;
}

/** Is this ref part of a clue sequence — the chain the tap-mode hold
 * keeps (a clue's read + its ack + its decode)? Selection reads,
 * ask-next, instructions, endings and the debrief are NOT held: the
 * Listen button replays the current clue, not the whole case. */
function isClueSequenceRef(ref: SpeakRef): boolean {
  if (ref.kind === "clue") return true;
  if (ref.kind === "fixed") {
    return ref.id.startsWith("ack-") || ref.id.startsWith("decode-");
  }
  return false;
}

/** Default autoplay gate for the detective loop surface: the surface
 * requests autoplay (bandAutoplay=true — see the header for why), the
 * kid's read-aloud preference and the sound toggle decide. */
export function detectiveCanAutoPlay(): boolean {
  const soundOn = isSoundEnabled();
  return shouldAutoPlayReadAloud(getReadAloudPref(), true, soundOn);
}

export function createDetectiveSpeech(
  opts: DetectiveSpeechOptions = {},
): DetectiveSpeechPlayer {
  const onSpeakingChange = opts.onSpeakingChange ?? (() => {});
  const loadManifest = opts.loadManifest ?? (() => loadDetectiveManifest());
  const isSoundOn = opts.isSoundOn ?? (() => isSoundEnabled() && soundAudible());
  const canAutoPlay = opts.canAutoPlay ?? detectiveCanAutoPlay;

  let caseIndex = opts.caseIndex ?? 0;
  let queue: SpeakRef[] = [];
  let processing = false;
  /* -- U9 speech mode + clue-sequence hold (Unit A: auto too) ------- */
  let speechMode: SpeechMode = opts.speechMode ?? "auto";
  /** The most recent clue sequence, remembered in "tap" and "auto"
   * modes (in "tap" while its items resolve as skipped; in "auto"
   * while they play). A new clue read starts a new hold; its ack +
   * decode append. Cleared on entering "off" and on a new case
   * (setCaseIndex to a different case). */
  let held: SpeakRef[] = [];
  /** Replay generation (Unit A): every playHeldSequence() call bumps
   * this, so a superseded replay loop — one a second tap replaced —
   * abandons ship without clearing the new loop's state or firing a
   * second drain signal. */
  let heldPlaySeq = 0;

  function recordHeld(ref: SpeakRef): void {
    if (!isClueSequenceRef(ref)) return;
    if (ref.kind === "clue") {
      held = [ref];
      return;
    }
    // ack/decode with no read held (e.g. the mode flipped mid-chain):
    // a chain without its read is not a clue sequence — hold nothing.
    if (!held.some((r) => r.kind === "clue")) return;
    if (
      ref.kind === "fixed" &&
      held.some((r) => r.kind === "fixed" && r.id === ref.id)
    ) {
      return; // already in this chain
    }
    held = [...held, ref];
  }
  /** Bumped by stopAll/dispose: an in-flight loop from an older
   * generation abandons ship without signalling a drain. */
  let generation = 0;
  let disposed = false;

  /* -- first-gesture unlock (default clip player only) --------------- */
  let gestureUnlocked = false;
  let gestureWaiters: Array<() => void> = [];
  let gestureListenerArmed = false;
  function armGestureListener(): void {
    if (gestureListenerArmed || gestureUnlocked) return;
    if (typeof window === "undefined") {
      gestureUnlocked = true;
      return;
    }
    gestureListenerArmed = true;
    const onGesture = () => {
      // Storyteller pattern: don't consume the one-shot while sound is
      // off — stay armed so a later gesture (or unmute + gesture) works.
      const decision = decideFirstGesture({
        alreadyDone: gestureUnlocked,
        dismissed: false,
        celebrationActive: false,
        soundOn: isSoundEnabled(),
      });
      if (decision !== "consume") return;
      gestureUnlocked = true;
      window.removeEventListener("pointerdown", onGesture);
      const waiters = gestureWaiters;
      gestureWaiters = [];
      for (const wake of waiters) wake();
    };
    window.addEventListener("pointerdown", onGesture);
  }
  function waitForGesture(): Promise<void> {
    if (gestureUnlocked) return Promise.resolve();
    armGestureListener();
    if (gestureUnlocked) return Promise.resolve();
    return new Promise((resolve) => gestureWaiters.push(resolve));
  }

  /* -- default clip playback: one HTMLAudioElement chain ------------- */
  let currentStop: (() => void) | null = null;
  async function defaultPlayClip(clip: ResolvedClip): Promise<void> {
    // Gesture-wait resurrection guard (cure, panel round 1): the
    // stop handle is registered BEFORE the first-gesture wait, not
    // after it. Previously currentStop only existed once the Audio
    // element did — after the wait — so a stopAll landing while the
    // clip was parked (a mute, a case change, a replay interrupting)
    // could not reach it, and the parked clip played on the next tap
    // even though it had been stopped; a mute/unmute cycle in that
    // window was invisible to it because the sound gate read ON
    // again by wake time. Now stopAll settles a parked clip exactly
    // like a playing one (it resolves as skipped — the queue's
    // existing stopped-item path, drain accounting untouched), and
    // the sound gate is re-checked at wake for a gate that closed
    // without a stopAll.
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        currentStop = null;
        resolve();
      };
      // Parked-clip stopper: settling now abandons the clip — the
      // gesture wake below sees `settled` and never creates Audio.
      currentStop = done;
      void waitForGesture().then(() => {
        if (settled || disposed) return;
        if (!isSoundOn()) {
          done();
          return;
        }
        try {
          const audio = new Audio(clip.url);
          currentStop = () => {
            try {
              audio.pause();
            } catch {
              /* element already gone — nothing to stop */
            }
            done();
          };
          audio.addEventListener("ended", done, { once: true });
          // An erroring clip (404 / codec) resolves as SKIPPED — the
          // queue must never stall (fallback law).
          audio.addEventListener("error", done, { once: true });
          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch(() => {
              // Autoplay refusal after the gesture wait (or a raced
              // pause from stopAll): treat as skipped, never a stall.
              done();
            });
          }
        } catch {
          done();
        }
      });
    });
  }
  const playClip = opts.playClip ?? defaultPlayClip;

  /* -- queue processor ------------------------------------------------ */
  async function processQueue(gen: number): Promise<void> {
    if (processing) return;
    processing = true;
    let hadItems = false;
    try {
      while (queue.length > 0) {
        if (gen !== generation || disposed) return;
        hadItems = true;
        const ref = queue.shift()!;
        // U9 speech modes: in "tap" mode the item resolves as skipped
        // (the ladder advances silently, exactly like a dropped item);
        // in "off" mode it resolves skipped and nothing is held. The
        // clue-sequence hold itself is recorded at enqueue time (see
        // enqueue below) — recordHeld here is the idempotent backstop
        // for a mode that flipped to "tap" mid-burst.
        if (speechMode !== "auto") {
          if (speechMode === "tap") recordHeld(ref);
          continue;
        }
        // Gates at play time: sound off or the read-aloud preference
        // vetoes autoplay → the item is dropped, the queue moves on.
        if (!isSoundOn() || !canAutoPlay()) continue;
        const manifest = await loadManifest();
        if (gen !== generation || disposed) return;
        const clip = resolveDetectiveClip(manifest, ref, caseIndex);
        if (!clip) continue; // uncovered → silent skip
        onSpeakingChange(clip.who);
        try {
          await playClip(clip);
        } catch {
          // A failing clip is a skipped clip — never stall the queue.
        }
      }
    } finally {
      processing = false;
      // One drain signal per emptied queue. It fires even when every
      // item was dropped or skipped (sound off, uncovered case): the
      // ladder must advance silently rather than stall — the visual
      // game is identical with or without audio (fallback law).
      // stopAll bumps the generation, so a stopped queue never drains.
      if (gen === generation && !disposed && hadItems) {
        onSpeakingChange(null);
      }
      // Items enqueued while this loop was finishing (e.g. a drain
      // callback that immediately enqueued the next line) restart it.
      if (gen === generation && !disposed && queue.length > 0) {
        void processQueue(gen);
      }
    }
  }

  /* Processing starts on a microtask, not synchronously: a transition
   * often emits several speak effects at once (ack + decode, name +
   * suspicion) and the host enqueues them in one synchronous burst.
   * Starting immediately would let a fully-synchronous batch (e.g.
   * every item dropped by the sound gate, which never awaits) drain
   * after the FIRST item and fire a premature speechEnded. */
  let startScheduled = false;
  function kick(): void {
    if (processing || startScheduled || disposed) return;
    startScheduled = true;
    queueMicrotask(() => {
      startScheduled = false;
      void processQueue(generation);
    });
  }

  /* -- held-sequence replay (Listen button / tap-Watson, Unit A) -----
   * Plays the held refs through the same manifest/clip pipeline, in
   * order. The autoplay verdict is NOT consulted — a tap is the kid
   * choosing to listen, and "never"/"sometimes" keep the control
   * tappable by design — but the sound gate IS: sound off at play
   * time means silence. Available in "auto" and "tap" modes; in
   * "off" mode nothing is held and this is a no-op.
   *
   * RESTART semantics (Unit A): a replay request is explicit, so it
   * interrupts whatever is in flight — the normal queue or an
   * earlier replay — and starts the held sequence again from item 1.
   * Interruption = a generation bump (in-flight loops abandon ship
   * without a drain signal) + clearing the pending queue + stopping
   * the current clip. A stopAll (generation bump) likewise abandons
   * a replay between clips. The drain signal fires only when at
   * least one clip actually played, clearing the host's speaking
   * indicator — and only from the LATEST replay: a superseded loop
   * never drains, so the ladder advances exactly once. */
  async function playHeldSequence(): Promise<void> {
    if (disposed || speechMode === "off") return;
    const refs = [...held];
    if (refs.length === 0) return;
    const mySeq = ++heldPlaySeq;
    generation += 1;
    const gen = generation;
    queue = [];
    if (currentStop) {
      try {
        currentStop();
      } catch {
        /* stopping must never throw into game flow */
      }
      currentStop = null;
    }
    let playedAny = false;
    try {
      for (const ref of refs) {
        if (mySeq !== heldPlaySeq || gen !== generation || disposed) return;
        if (!isSoundOn()) break;
        const manifest = await loadManifest();
        if (mySeq !== heldPlaySeq || gen !== generation || disposed) return;
        const clip = resolveDetectiveClip(manifest, ref, caseIndex);
        if (!clip) continue; // uncovered → silent skip, as ever
        onSpeakingChange(clip.who);
        playedAny = true;
        try {
          await playClip(clip);
        } catch {
          // A failing clip is a skipped clip — never stall the replay.
        }
      }
    } finally {
      // Only the latest replay owns the drain: a loop a newer tap
      // superseded leaves it to its replacement.
      if (mySeq === heldPlaySeq && playedAny && gen === generation && !disposed) {
        onSpeakingChange(null);
      }
    }
  }

  return {
    enqueue(ref: SpeakRef): void {
      if (disposed) return;
      // Retention at enqueue time (Unit A — see the header): the full
      // burst is held before its first clip starts, so a mid-play
      // replay restarts the complete chain, not just the clip in
      // flight. "off" mode holds nothing.
      if (speechMode !== "off") recordHeld(ref);
      queue.push(ref);
      kick();
    },
    setSpeechMode(mode: SpeechMode): void {
      if (mode === speechMode) return;
      speechMode = mode;
      if (mode === "off") held = [];
    },
    getSpeechMode(): SpeechMode {
      return speechMode;
    },
    heldRefs(): readonly SpeakRef[] {
      return [...held];
    },
    playHeldSequence,
    stopAll(): void {
      generation += 1;
      queue = [];
      if (currentStop) {
        try {
          currentStop();
        } catch {
          /* stopping must never throw into game flow */
        }
        currentStop = null;
      }
      onSpeakingChange(null);
    },
    dispose(): void {
      disposed = true;
      generation += 1;
      queue = [];
      if (currentStop) {
        try {
          currentStop();
        } catch {
          /* as above */
        }
        currentStop = null;
      }
      gestureWaiters = [];
    },
    setCaseIndex(next: number): void {
      if (next !== caseIndex) held = []; // a new case, a new clue chain
      caseIndex = next;
    },
  };
}
