/**
 * One voice at a time for one screen.
 *
 * The controller holds the screen's current voice: a new play()
 * stops the old voice first, stop() and dispose() tear it down,
 * and currentTime() reads the live voice's position. The hook
 * builds one controller per screen and disposes it on unmount.
 *
 * Building a controller touches no DOM and makes no sound, so it
 * is safe on the server and during render. Only play() can make
 * an audio element, through the port.
 */

import { useEffect, useRef } from "react";

import { createBrowserVoicePort } from "./browser-voice.ts";
import type { CreateVoiceOptions, VoiceHandle, VoicePort } from "./voice.ts";

/** The controller a screen holds for its one voice. */
export interface VoiceController {
  /** Play a line, stopping the current voice first. Returns
   * false when the port refuses the line, such as sound off. */
  play(src: string, opts: CreateVoiceOptions): boolean;
  /** Stop the current voice. Safe when there is none. */
  stop(): void;
  /** Playback position of the current voice, or 0 with none. */
  currentTime(): number;
  /** Stop the current voice and close the controller. */
  dispose(): void;
}

/** Make a controller over any voice port. */
export function createVoiceController(port: VoicePort): VoiceController {
  let current: VoiceHandle | null = null;
  let disposed = false;

  const stopCurrent = (): void => {
    const handle = current;
    current = null;
    if (handle) {
      try {
        handle.stop();
      } catch {
        // Stopping a voice must never throw into the screen.
      }
    }
  };

  return {
    play(src: string, opts: CreateVoiceOptions): boolean {
      if (disposed) return false;
      stopCurrent();
      const handle = port.createVoice(src, opts);
      if (!handle) return false;
      current = handle;
      handle.play();
      return true;
    },
    stop(): void {
      stopCurrent();
    },
    currentTime(): number {
      return current ? current.currentTime() : 0;
    },
    dispose(): void {
      stopCurrent();
      disposed = true;
    },
  };
}

/** The screen's one voice, on the browser port. */
export function useVoice(): VoiceController {
  const ref = useRef<VoiceController | null>(null);
  if (ref.current === null) {
    ref.current = createVoiceController(createBrowserVoicePort());
  }
  const controller = ref.current;
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);
  return controller;
}
