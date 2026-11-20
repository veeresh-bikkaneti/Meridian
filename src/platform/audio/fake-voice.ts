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
  simulateError(): void;
  /** The play() call itself was refused. */
  simulatePlayRejection(): void;
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
      let gatesOpen = false;
      try {
        gatesOpen = soundEnabled() && audible();
      } catch {
        return null;
      }
      if (!gatesOpen) return null;

      let state: VoiceState = "idle";
      let currentTimeValue = 0;
      let claim: VoiceClaim | null = null;

      const fireEnded = (): void => {
        try {
          opts.onEnded?.();
        } catch {
          // A listener must never break the voice's own cleanup.
        }
      };
      const fireError = (): void => {
        try {
          opts.onError?.();
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
      const fireTimeUpdate = (seconds: number): void => {
        try {
          opts.onTimeUpdate?.(seconds);
        } catch {
          // A listener must never break playback.
        }
      };

      const runErrorPath = (): void => {
        if (isTerminal(state)) return;
        state = "error";
        claim?.release();
        fireError();
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

      claim = claimVoice(opts.owner, channelStop, {
        userInitiated: opts.userInitiated,
      });
      if (!claim) return null;

      const handle: FakeVoiceHandle = {
        src,
        playCalls: 0,
        stopCalls: 0,
        get state(): VoiceState {
          return state;
        },
        play(): void {
          if (state !== "idle" && state !== "ready") return;
          handle.playCalls++;
          state = "loading";
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
        },
        simulateTimeUpdate(t: number): void {
          if (isTerminal(state)) return;
          currentTimeValue = t;
          fireTimeUpdate(t);
        },
        simulateEnded(): void {
          runEndedPath();
        },
        simulateError(): void {
          runErrorPath();
        },
        simulatePlayRejection(): void {
          runErrorPath();
        },
      };
      handles.push(handle);
      return handle;
    },
  };

  return { port, handles };
}
