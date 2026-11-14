/**
 * subject-pair-voice.ts — the subject pair's line player, on the shared
 * one-voice channel (src/game/audio/voice-channel.ts). Owner's rule: "if
 * one speak the other needs to shut up".
 *
 * Every line claims the channel before it makes a sound and releases it
 * when it ends, errors, is paused or is stopped:
 *  - the case-open line is automatic, so it waits its turn: if anyone
 *    else is speaking (the storyteller, a journal film, …) it stays
 *    silent rather than talk over them, and is never queued;
 *  - the win line answers the player's own tap, so it takes the
 *    channel, and the channel stops whoever held it (Watson's case-open
 *    line included). Only one voice is ever active.
 *
 * iOS: a user-gesture play() is lost if it happens after an awaited
 * fetch. The case-open path preloads the manifest and primes one audio
 * element; a tap then calls play() in the same turn, before any await.
 * unlockFromUserGesture() is also safe to call from a real pointerdown
 * so the same element stays unlocked when React's effect then speaks.
 *
 * Gates (the summary-celebration-line pattern): the global sound toggle,
 * the hidden-tab guard and the read-aloud verdict (detectiveCanAutoPlay),
 * checked before the manifest load and again after it. The sound toggle
 * going off stops the line through the channel (stopAllVoices).
 *
 * Only `fixed` clips from the detective manifest; a missing clip is
 * silence. Every environment touchpoint is injectable, so the player is
 * node-testable with no DOM (subject-pair-voice.test.ts).
 */
import {
  detectiveCanAutoPlay,
  loadDetectiveManifest,
  resolveDetectiveClip,
  type DetectiveManifest,
} from "../../game/loop/detective/detective-audio.ts";
import { soundAudible } from "../../game/audio/play-guards.ts";
import { isSoundEnabled } from "../../game/audio/sfx.ts";
import { claimVoice, type VoiceClaim } from "../../game/audio/voice-channel.ts";
import type { SubjectPairLine } from "./subject-pair.ts";

/** The slice of HTMLAudioElement the player touches. */
export interface PairAudioElement {
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void;
  /** Reused primed element: the player sets this before play(). */
  src?: string;
  muted?: boolean;
}

export interface SubjectPairVoiceDeps {
  loadManifest?: () => Promise<DetectiveManifest | null>;
  createAudio?: (url: string) => PairAudioElement;
  gateOpen?: () => boolean;
}

export interface SubjectPairVoice {
  /** Speak one line. Resolves when it ends, is stopped, or is gated off. */
  say(
    line: SubjectPairLine,
    opts: { userInitiated: boolean },
    onSpeaking: (who: SubjectPairLine["who"] | null) => void,
  ): Promise<void>;
  /**
   * Start the manifest fetch and create the audio element. Call when
   * the case opens so a later tap can play() without waiting on fetch.
   */
  preload(): Promise<void>;
  /**
   * play() on the primed element, inside a real user gesture (iOS).
   * Safe to call when nothing is speaking; a no-op during a line.
   */
  unlockFromUserGesture(): void;
  /** Stop the pair's line (if any) and give the channel back. Idempotent. */
  dispose(): void;
}

/** The channel owner name the pair claims under. */
export const SUBJECT_PAIR_VOICE_OWNER = "subject-pair";

export function createSubjectPairVoice(deps: SubjectPairVoiceDeps = {}): SubjectPairVoice {
  const loadManifest = deps.loadManifest ?? (() => loadDetectiveManifest());
  const createAudio =
    deps.createAudio ??
    ((url: string) => {
      const el = new Audio();
      if (url) el.src = url;
      return el as unknown as PairAudioElement;
    });
  const gateOpen =
    deps.gateOpen ?? (() => detectiveCanAutoPlay() && soundAudible() && isSoundEnabled());

  let current: PairAudioElement | null = null;
  let seq = 0;
  let disposed = false;
  let manifest: DetectiveManifest | null | undefined;
  let loadInFlight: Promise<DetectiveManifest | null> | null = null;
  let primed: PairAudioElement | null = null;

  const pauseCurrent = () => {
    try {
      current?.pause();
    } catch {
      /* element already gone — the line settles via its own path */
    }
  };

  const ensurePrimed = (): PairAudioElement | null => {
    if (disposed) return null;
    if (!primed) primed = createAudio("");
    return primed;
  };

  const startLoad = (): Promise<DetectiveManifest | null> => {
    if (!loadInFlight) {
      loadInFlight = loadManifest().then((m) => {
        manifest = m;
        return m;
      });
    }
    return loadInFlight;
  };

  const unlockFromUserGesture = (): void => {
    // A tap must call play() on the primed element inside the gesture
    // (iOS). Never start a leftover clip: mute, play, pause, unmute.
    if (disposed || current) return;
    const audio = ensurePrimed();
    if (!audio) return;
    const wasMuted = Boolean(audio.muted);
    try {
      audio.muted = true;
      const p = audio.play();
      if (p) p.catch(() => {});
      audio.pause();
    } catch {
      /* empty src or autoplay reject — the element is still the one we play later */
    } finally {
      audio.muted = wasMuted;
    }
  };

  const speak = (
    loaded: DetectiveManifest | null,
    line: SubjectPairLine,
    opts: { userInitiated: boolean },
    onSpeaking: (who: SubjectPairLine["who"] | null) => void,
    mine: number,
  ): Promise<void> => {
    if (disposed || mine !== seq || !gateOpen()) return Promise.resolve();
    const clip = resolveDetectiveClip(loaded, { kind: "fixed", id: line.id }, 0);
    if (!clip) return Promise.resolve(); // uncovered → silent
    // The channel decides: a tap takes it (stopping whoever speaks,
    // through their stop callback), an automatic line waits its turn.
    const claim: VoiceClaim | null = claimVoice(SUBJECT_PAIR_VOICE_OWNER, pauseCurrent, {
      userInitiated: opts.userInitiated,
    });
    if (!claim) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      const primedEl = ensurePrimed();
      let playingEl: PairAudioElement | null = primedEl;
      const done = () => {
        if (settled) return;
        settled = true;
        // Stale release is a no-op if a newer claim already holds the
        // channel; dispose still needs this to give the channel back.
        claim.release();
        // A stale listener from a stopped line must not clear the
        // next line (the primed element is reused).
        if (mine !== seq) {
          resolve();
          return;
        }
        // Only the newest line clears the speaker: a line stopped by
        // the next one must not blank the next one's mouth.
        if (current === playingEl) {
          current = null;
          onSpeaking(null);
        }
        resolve();
      };
      if (!primedEl) {
        done();
        return;
      }
      try {
        // Tap path: reuse the primed element (already unlocked in the
        // gesture). Automatic lines get a fresh element, so a leftover
        // src on the primed one cannot replay or block autoplay.
        if (!opts.userInitiated) {
          const fresh = createAudio(clip.url);
          playingEl = fresh;
          current = fresh;
          fresh.addEventListener("ended", done, { once: true });
          fresh.addEventListener("error", done, { once: true });
          fresh.addEventListener("pause", done, { once: true });
          onSpeaking(line.who);
          const p = fresh.play();
          if (p) p.catch(done);
          return;
        }
        primedEl.src = clip.url;
        current = primedEl;
        primedEl.addEventListener("ended", done, { once: true });
        primedEl.addEventListener("error", done, { once: true });
        // The only pauses are a stop (the channel, dispose): a stopped
        // line is finished.
        primedEl.addEventListener("pause", done, { once: true });
        onSpeaking(line.who);
        const p = primedEl.play();
        if (p) p.catch(done);
      } catch {
        done();
      }
    });
  };

  return {
    async say(line, opts, onSpeaking) {
      const mine = ++seq;
      if (disposed || !gateOpen()) return;
      if (manifest === undefined) {
        const pending = startLoad();
        // Tap path: play() before any await, so iOS keeps the gesture.
        if (opts.userInitiated) unlockFromUserGesture();
        const loaded = await pending;
        if (disposed || mine !== seq || !gateOpen()) return;
        await speak(loaded, line, opts, onSpeaking, mine);
        return;
      }
      await speak(manifest, line, opts, onSpeaking, mine);
    },
    preload() {
      ensurePrimed();
      return startLoad().then(() => undefined);
    },
    unlockFromUserGesture,
    dispose() {
      if (disposed) return;
      disposed = true;
      seq += 1;
      pauseCurrent();
    },
  };
}
