/**
 * The browser voice port — the one real implementation of the
 * audio port, backed by a browser audio element.
 *
 * It wraps the one-voice channel; it does not replace it. Every
 * voice claims the channel before it makes an element, and gives
 * the claim back when it ends, fails, is interrupted or is
 * stopped, so one voice at a time still holds across the app.
 *
 * Two rules shape this file:
 *
 * - A tapped line calls play() before anything else can pause
 *   the flow, or the browser may refuse the sound. So play()
 *   calls the element's play() straight away, in the same call,
 *   and this file waits for nothing before it.
 * - Sound is enhancement only: no path here throws into the
 *   caller. Element calls that can fail sit in try/catch, a
 *   failed element build gives the claim back and returns null,
 *   and with no Audio constructor at all (such as on the server)
 *   createVoice simply returns null.
 */

import { soundAudible } from "../../game/audio/play-guards.ts";
import { isSoundEnabled } from "../../game/audio/sfx.ts";
import {
  claimVoice,
  type VoiceClaim,
} from "../../game/audio/voice-channel.ts";
import type {
  CreateVoiceOptions,
  VoiceAudioElement,
  VoiceHandle,
  VoicePort,
  VoicePortDeps,
  VoiceState,
} from "./voice.ts";

function isTerminal(state: VoiceState): boolean {
  return (
    state === "ended" ||
    state === "error" ||
    state === "interrupted" ||
    state === "aborted"
  );
}

/** Make the browser voice port. Seams in deps are for tests. */
export function createBrowserVoicePort(deps: VoicePortDeps = {}): VoicePort {
  const createAudio =
    deps.createAudio ??
    ((src: string) => new Audio(src) as unknown as VoiceAudioElement);
  const soundEnabled = deps.soundEnabled ?? isSoundEnabled;
  const audible = deps.audible ?? soundAudible;

  return {
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
      let element: VoiceAudioElement | null = null;
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

      const teardownElement = (): void => {
        if (!element) return;
        try {
          element.pause();
        } catch {
          // Element already gone — teardown carries on.
        }
        try {
          element.removeAttribute("src");
        } catch {
          // Element already gone — teardown carries on.
        }
      };

      const onCanPlay = (): void => {
        if (state === "idle" || state === "loading") state = "ready";
      };
      const onPlaying = (): void => {
        if (isTerminal(state)) return;
        state = "playing";
      };
      const onTimeUpdate = (): void => {
        if (isTerminal(state) || !element) return;
        fireTimeUpdate(element.currentTime);
      };
      const onEnded = (): void => {
        if (isTerminal(state)) return;
        state = "ended";
        removeListeners();
        claim?.release();
        fireEnded();
      };
      const runErrorPath = (): void => {
        if (isTerminal(state)) return;
        state = "error";
        removeListeners();
        teardownElement();
        claim?.release();
        fireError();
      };
      const onErrorEvent = (): void => {
        runErrorPath();
      };
      const removeListeners = (): void => {
        if (!element) return;
        try {
          element.removeEventListener("canplay", onCanPlay);
        } catch {
          // Element already gone — removal carries on.
        }
        try {
          element.removeEventListener("playing", onPlaying);
        } catch {
          // Element already gone — removal carries on.
        }
        try {
          element.removeEventListener("timeupdate", onTimeUpdate);
        } catch {
          // Element already gone — removal carries on.
        }
        try {
          element.removeEventListener("ended", onEnded);
        } catch {
          // Element already gone — removal carries on.
        }
        try {
          element.removeEventListener("error", onErrorEvent);
        } catch {
          // Element already gone — removal carries on.
        }
      };

      // The channel calls this when another voice takes over, or
      // when every voice is stopped at once. The channel has
      // already let go of this claim by then, so this step does
      // not lean on release() to do its work.
      const channelStop = (): void => {
        if (isTerminal(state)) return;
        state = "interrupted";
        removeListeners();
        teardownElement();
        fireInterrupted();
      };

      claim = claimVoice(opts.owner, channelStop, {
        userInitiated: opts.userInitiated,
      });
      if (!claim) return null;

      try {
        element = createAudio(src);
      } catch {
        claim.release();
        return null;
      }
      if (!element) {
        claim.release();
        return null;
      }

      try {
        element.addEventListener("canplay", onCanPlay);
        element.addEventListener("playing", onPlaying);
        element.addEventListener("timeupdate", onTimeUpdate);
        element.addEventListener("ended", onEnded);
        element.addEventListener("error", onErrorEvent);
      } catch {
        claim.release();
        return null;
      }

      const handle: VoiceHandle = {
        get state(): VoiceState {
          return state;
        },
        play(): void {
          if (state !== "idle" && state !== "ready") return;
          if (!element) return;
          state = "loading";
          let result: Promise<void> | void;
          try {
            result = element.play();
          } catch {
            runErrorPath();
            return;
          }
          if (
            result &&
            typeof (result as Promise<void>).catch === "function"
          ) {
            (result as Promise<void>).catch(() => {
              runErrorPath();
            });
          }
        },
        stop(): void {
          if (isTerminal(state)) return;
          state = "aborted";
          removeListeners();
          teardownElement();
          claim?.release();
        },
        currentTime(): number {
          return element ? element.currentTime : 0;
        },
      };
      return handle;
    },
  };
}

const defaultPort = createBrowserVoicePort();

/** Make one voice on the shared browser port. */
export function createVoice(
  src: string,
  opts: CreateVoiceOptions,
): VoiceHandle | null {
  return defaultPort.createVoice(src, opts);
}
