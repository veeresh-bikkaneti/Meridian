/**
 * The in-memory fake voice port, for tests.
 *
 * It follows the same contract as the browser port — same gates,
 * same statechart, same callbacks firing at most once — and it
 * claims the real voice channel, so channel ownership in a test
 * means the same thing it means in the game. There is no element:
 * the handle keeps its own playback position, and the test drives
 * the element's moments by hand with the simulate calls.
 */

import { soundAudible } from "../../game/audio/play-guards.ts";
import { isSoundEnabled } from "../../game/audio/sfx.ts";
import {
  claimVoice,
  type VoiceClaim,
} from "../../game/audio/voice-channel.ts";
import type {
  CreateVoiceOptions,
  VoiceHandle,
  VoicePort,
  VoiceState,
} from "./voice.ts";

/** A fake voice handle: the port handle plus the test's controls. */
export interface FakeVoiceHandle extends VoiceHandle {
  /** The line this voice was made for. */
  readonly src: string;
  /** How many times play() reached the line. */
  playCalls: number;
  /** How many times pause() paused a live voice. */
  pauseCalls: number;
  /** How many times stop() ended a live voice. */
  stopCalls: number;
  /** The element can play now: idle/loading moves to ready. */
  simulateReady(): void;
  /** Sound is coming out: the voice moves to playing. */
  simulatePlaying(): void;
  /** Playback moved to t seconds; fires the time callback. */
  simulateTimeUpdate(t: number): void;
  /** The clip played to its end. */
  simulateEnded(): void;
  /** The clip failed. */
  simulateError(cause?: unknown): void;
  /** The play() call itself was refused. */
  simulatePlayRejection(cause?: unknown): void;
  /** Clip length in seconds; NaN until the metadata loads. */
  duration(): number;
  /** Pretend the metadata loaded with this clip length. */
  simulateDuration(seconds: number): void;
}

function isTerminal(state: VoiceState): boolean {
  return (
    state === "ended" ||
    state === "error" ||
    state === "interrupted" ||
    state === "aborted"
  );
}

/** Make a fake port plus every handle it creates, in order. */
export function createFakeVoicePort(deps?: {
  soundEnabled?: () => boolean;
  audible?: () => boolean;
}): { port: VoicePort; handles: FakeVoiceHandle[] } {
  const soundEnabled = deps?.soundEnabled ?? isSoundEnabled;
  const audible = deps?.audible ?? soundAudible;
  const handles: FakeVoiceHandle[] = [];

  const port: VoicePort = {
    createVoice(src: string, opts: CreateVoiceOptions): VoiceHandle | null {
      // Gates first: a gated line claims nothing, builds nothing.
      // A bypassed line skips the sound toggle only; the
      // hidden-tab guard still applies.
      let gatesOpen = false;
      try {
        gatesOpen =
          (opts.bypassSoundGate === true ? true : soundEnabled()) &&
          audible();
      } catch {
        return null;
      }
      if (!gatesOpen) return null;

      let state: VoiceState = "idle";
      let currentTimeValue = 0;
      let durationValue = NaN;
      let claim: VoiceClaim | null = null;
      let started = false;

      const fireEnded = (): void => {
        try {
          opts.onEnded?.();
        } catch {
          // A listener must never break the voice's own cleanup.
        }
      };
      const fireError = (cause?: unknown): void => {
        try {
          opts.onError?.(cause);
        } catch {
          // A listener must never break the voice's own cleanup.
        }
      };
      const fireInterrupted = (): void => {
        try {
          opts.onInterrupted?.();
        } catch {
          // A listener must never break the voice's own cleanup.
        }
      };
      const firePlaying = (): void => {
        try {
          opts.onPlaying?.();
        } catch {
          // A listener must never break playback.
        }
      };
      const fireTimeUpdate = (seconds: number): void => {
        try {
          opts.onTimeUpdate?.(seconds);
        } catch {
          // A listener must never break playback.
        }
      };

      const runErrorPath = (cause?: unknown): void => {
        if (isTerminal(state)) return;
        state = "error";
        claim?.release();
        fireError(cause);
      };
      const runEndedPath = (): void => {
        if (isTerminal(state)) return;
        state = "ended";
        claim?.release();
        fireEnded();
      };

      // The channel calls this when another voice takes over, or
      // when every voice is stopped at once. The channel has
      // already let go of this claim by then, so this step does
      // not lean on release() to do its work.
      const channelStop = (): void => {
        if (isTerminal(state)) return;
        state = "interrupted";
        fireInterrupted();
      };

      // Adopted claims mirror the browser port: an adopted claim
      // arrives already holding the channel, so claiming again
      // would stop its owner. Every release path below treats an
      // adopted claim exactly like an owned one.
      claim =
        opts.claim ??
        claimVoice(opts.owner, channelStop, {
          userInitiated: opts.userInitiated,
        });
      if (!claim) return null;

      const handle: FakeVoiceHandle = {
        src,
        playCalls: 0,
        pauseCalls: 0,
        stopCalls: 0,
        get state(): VoiceState {
          return state;
        },
        play(): void {
          if (state !== "idle" && state !== "ready") return;
          // The start position applies to the first play only; a
          // resume after pause() keeps the kept position.
          if (!started) {
            started = true;
            if (opts.startAtSeconds !== undefined) {
              currentTimeValue = opts.startAtSeconds;
            }
          }
          handle.playCalls++;
          state = "loading";
        },
        pause(): void {
          if (state !== "loading" && state !== "playing") return;
          handle.pauseCalls++;
          state = "ready";
        },
        stop(): void {
          if (isTerminal(state)) return;
          state = "aborted";
          handle.stopCalls++;
          claim?.release();
        },
        currentTime(): number {
          return currentTimeValue;
        },
        simulateReady(): void {
          if (state === "idle" || state === "loading") state = "ready";
        },
        simulatePlaying(): void {
          if (isTerminal(state)) return;
          state = "playing";
          firePlaying();
        },
        simulateTimeUpdate(t: number): void {
          if (isTerminal(state)) return;
          currentTimeValue = t;
          fireTimeUpdate(t);
        },
        simulateEnded(): void {
          runEndedPath();
        },
        simulateError(cause?: unknown): void {
          runErrorPath(cause);
        },
        simulatePlayRejection(cause?: unknown): void {
          runErrorPath(cause);
        },
        duration(): number {
          return durationValue;
        },
        simulateDuration(seconds: number): void {
          durationValue = seconds;
        },
      };
      handles.push(handle);
      return handle;
    },
  };

  return { port, handles };
}
