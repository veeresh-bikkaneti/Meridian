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
      let element: VoiceAudioElement | null = null;
      let claim: VoiceClaim | null = null;
      let started = false;
      // A pause issued while play() is still pending owns the
      // outcome: the play promise rejects with an abort, and
      // that rejection is the pause working, not a failure.
      let pausedWhileLoading = false;

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
        firePlaying();
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
      const runErrorPath = (cause?: unknown): void => {
        if (isTerminal(state)) return;
        state = "error";
        removeListeners();
        teardownElement();
        claim?.release();
        fireError(cause);
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

      // An adopted claim arrives already holding the channel:
      // claiming again would stop its owner — the caller — so
      // adopt it. Only a claim this call took itself is released
      // on the failure paths below, where no handle is returned
      // and the claim stays with the caller; once a handle is
      // returned, every release path treats an adopted claim
      // exactly like an owned one.
      let ownsClaim = false;
      claim = opts.claim ?? null;
      if (!claim) {
        claim = claimVoice(opts.owner, channelStop, {
          userInitiated: opts.userInitiated,
        });
        if (!claim) return null;
        ownsClaim = true;
      }

      try {
        element = createAudio(src);
      } catch {
        if (ownsClaim) claim.release();
        return null;
      }
      if (!element) {
        if (ownsClaim) claim.release();
        return null;
      }

      try {
        element.addEventListener("canplay", onCanPlay);
        element.addEventListener("playing", onPlaying);
        element.addEventListener("timeupdate", onTimeUpdate);
        element.addEventListener("ended", onEnded);
        element.addEventListener("error", onErrorEvent);
      } catch {
        if (ownsClaim) claim.release();
        return null;
      }

      const handle: VoiceHandle = {
        get state(): VoiceState {
          return state;
        },
        play(): void {
          if (state !== "idle" && state !== "ready") return;
          if (!element) return;
          // The start position applies to the first play only; a
          // resume after pause() keeps the kept position.
          if (!started) {
            started = true;
            if (opts.startAtSeconds !== undefined) {
              try {
                element.currentTime = opts.startAtSeconds;
              } catch {
                // Positioning failed; play from the start.
              }
            }
          }
          state = "loading";
          let result: Promise<void> | void;
          try {
            result = element.play();
          } catch (err) {
            runErrorPath(err);
            return;
          }
          if (
            result &&
            typeof (result as Promise<void>).catch === "function"
          ) {
            (result as Promise<void>).catch((reason: unknown) => {
              // A rejection that arrives after an explicit pause
              // is the pause working, not a failure: stay ready
              // and fire nothing, so the line stays resumable.
              if (pausedWhileLoading) {
                pausedWhileLoading = false;
                return;
              }
              runErrorPath(reason);
            });
          }
        },
        pause(): void {
          // Only a live voice pauses: a voice already ready,
          // idle or terminal is untouched, so calling pause()
          // twice is a no-op. The channel and the listeners
          // stay, and the position is kept for the resume.
          if (state !== "loading" && state !== "playing") return;
          if (state === "loading") pausedWhileLoading = true;
          if (!element) return;
          try {
            element.pause();
          } catch {
            // Pausing a gone element changes nothing.
          }
          state = "ready";
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
        duration(): number {
          return element ? element.duration : 0;
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
