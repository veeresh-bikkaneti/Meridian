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
    await waitForGesture();
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        currentStop = null;
        resolve();
      };
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

  return {
    enqueue(ref: SpeakRef): void {
      if (disposed) return;
      queue.push(ref);
      kick();
    },
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
      caseIndex = next;
    },
  };
}
