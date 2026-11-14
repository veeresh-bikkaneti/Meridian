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
  /** Stop the pair's line (if any) and give the channel back. Idempotent. */
  dispose(): void;
}

/** The channel owner name the pair claims under. */
export const SUBJECT_PAIR_VOICE_OWNER = "subject-pair";

export function createSubjectPairVoice(deps: SubjectPairVoiceDeps = {}): SubjectPairVoice {
  const loadManifest = deps.loadManifest ?? (() => loadDetectiveManifest());
  const createAudio =
    deps.createAudio ?? ((url: string) => new Audio(url) as unknown as PairAudioElement);
  const gateOpen =
    deps.gateOpen ?? (() => detectiveCanAutoPlay() && soundAudible() && isSoundEnabled());

  let current: PairAudioElement | null = null;
  let seq = 0;
  let disposed = false;

  const pauseCurrent = () => {
    try {
      current?.pause();
    } catch {
      /* element already gone — the line settles via its own path */
    }
  };

  return {
    async say(line, opts, onSpeaking) {
      const mine = ++seq;
      if (disposed || !gateOpen()) return;
      const manifest = await loadManifest();
      if (disposed || mine !== seq || !gateOpen()) return;
      const clip = resolveDetectiveClip(manifest, { kind: "fixed", id: line.id }, 0);
      if (!clip) return; // uncovered → silent
      // The channel decides: a tap takes it (stopping whoever speaks,
      // through their stop callback), an automatic line waits its turn.
      const claim: VoiceClaim | null = claimVoice(SUBJECT_PAIR_VOICE_OWNER, pauseCurrent, {
        userInitiated: opts.userInitiated,
      });
      if (!claim) return;
      await new Promise<void>((resolve) => {
        let settled = false;
        let audio: PairAudioElement | null = null;
        const done = () => {
          if (settled) return;
          settled = true;
          claim.release(); // a stale release (already stopped) is a no-op
          // Only the newest line clears the speaker: a line stopped by
          // the next one must not blank the next one's mouth.
          if (current === audio) {
            current = null;
            onSpeaking(null);
          }
          resolve();
        };
        try {
          audio = createAudio(clip.url);
          current = audio;
          audio.addEventListener("ended", done, { once: true });
          audio.addEventListener("error", done, { once: true });
          // The only pauses are a stop (the channel, dispose): a stopped
          // line is finished.
          audio.addEventListener("pause", done, { once: true });
          onSpeaking(line.who);
          const p = audio.play();
          if (p) p.catch(done);
        } catch {
          done();
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      seq += 1;
      pauseCurrent();
    },
  };
}
