/**
 * summary-celebration-line.ts — the summary celebration's spoken line
 * player (Unit B), extracted from summary-detective-celebration.tsx
 * as the testable seam for the PR C cure round (panel round 1, Game
 * Audio MAJOR: "the summary celebration ignores mute").
 *
 * The player owns exactly one thing: Holmes's one fixed celebration
 * line ("score-celebration"). It holds the line's Audio element while
 * it plays and subscribes to the sound channel (onSoundChanged, the
 * canonical instant channel in sfx.ts) for its whole lifetime:
 *
 * - Gates, checked at play time AND re-checked after the manifest
 *   await: the global sound toggle + hidden-tab guard + the player's
 *   read-aloud preference (detectiveCanAutoPlay / soundAudible — the
 *   same gates the loop player applies, decision 6). A mute that
 *   lands while the manifest loads must not be honoured only at the
 *   start.
 * - A sound-off event mid-line pauses the held element; the pause
 *   settles the play promise (a muted line is finished), so the
 *   component's choreography driver completes sanely instead of
 *   waiting out a silenced clip.
 * - dispose() unsubscribes AND pauses the held element through that
 *   same pause→settle path — the component calls it on unmount, and
 *   a detached Audio element would otherwise keep playing over
 *   whatever screen replaces the summary.
 *
 * Resolves when the clip ends, errors, is paused by a mute, or is
 * gated off — a silent celebration is a valid celebration. Mirrors
 * detective-audio's default clip player (ended/error both settle),
 * minus the first-gesture wait: the summary only exists because the
 * player tapped "End game", so the document already has its gesture.
 *
 * Test seams: every environment touchpoint (manifest load, Audio
 * construction, gates, the sound subscription) is injectable, so the
 * player is node-testable with no DOM (summary-celebration-line.test.ts).
 */

// Relative imports with extensions, so this module loads under the
// repo's node --test runner (no bundler alias resolution) as well as
// Vite — the detective-audio.ts pattern.
import {
  detectiveCanAutoPlay,
  loadDetectiveManifest,
  resolveDetectiveClip,
  type DetectiveManifest,
} from "../game/loop/detective/detective-audio.ts";
import { soundAudible } from "../game/audio/play-guards.ts";
import { isSoundEnabled, onSoundChanged } from "../game/audio/sfx.ts";

/** The slice of HTMLAudioElement the player touches. */
export interface CelebrationAudioElement {
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(
    type: string,
    listener: () => void,
    options?: { once?: boolean },
  ): void;
}

export interface CelebrationLineDeps {
  loadManifest?: () => Promise<DetectiveManifest | null>;
  createAudio?: (url: string) => CelebrationAudioElement;
  canAutoPlay?: () => boolean;
  audible?: () => boolean;
  soundEnabled?: () => boolean;
  subscribeSound?: (
    listener: (on: boolean) => void,
  ) => () => void;
}

export interface CelebrationLinePlayer {
  /** Play the line once. `isCancelled` is the caller's unmount /
   * supersede flag, polled after the manifest await. */
  play(
    isCancelled: () => boolean,
    onSpeaking: (speaking: boolean) => void,
  ): Promise<void>;
  /** Unsubscribe from the sound channel and pause any line still
   * playing (component unmount). Idempotent. */
  dispose(): void;
}

export function createCelebrationLinePlayer(
  deps: CelebrationLineDeps = {},
): CelebrationLinePlayer {
  const loadManifest = deps.loadManifest ?? (() => loadDetectiveManifest());
  const createAudio =
    deps.createAudio ??
    ((url: string) => new Audio(url) as unknown as CelebrationAudioElement);
  const canAutoPlay = deps.canAutoPlay ?? detectiveCanAutoPlay;
  const audible = deps.audible ?? soundAudible;
  /* The master toggle, read DIRECTLY (the loop player's isSoundOn
   * idiom): detectiveCanAutoPlay alone has a hole — with the
   * read-aloud preference unset it returns the band's autoplay
   * verdict and never consults the toggle, so a preset-off summary
   * would still speak. The file's own header promises the toggle
   * gates this line; this read is what keeps that promise. */
  const soundEnabled = deps.soundEnabled ?? isSoundEnabled;
  const subscribeSound = deps.subscribeSound ?? onSoundChanged;
  const gateOpen = () => canAutoPlay() && audible() && soundEnabled();

  /* The line's Audio element, held for exactly the line's lifetime:
   * set when the element is created, cleared when it settles. The
   * sound subscription pauses through this holder — a mid-line mute
   * stops THIS line in the same event, like every other surface. */
  let currentAudio: CelebrationAudioElement | null = null;
  let disposed = false;

  const unsubscribe = subscribeSound((on) => {
    if (on) return;
    const audio = currentAudio;
    if (audio) {
      try {
        audio.pause();
      } catch {
        /* element already gone — the line settles via its own path */
      }
    }
  });

  return {
    async play(isCancelled, onSpeaking) {
      if (disposed) return;
      if (!gateOpen()) return;
      const manifest = await loadManifest();
      if (isCancelled() || disposed) return;
      // Gate re-check after the await: sound flipped off (or the
      // tab hid, or the read-aloud verdict changed) while the
      // manifest was loading — the line must not start.
      if (!gateOpen()) return;
      const clip = resolveDetectiveClip(
        manifest,
        { kind: "fixed", id: "score-celebration" },
        0,
      );
      if (!clip) return; // uncovered → silent, by the fallback law
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          currentAudio = null;
          onSpeaking(false);
          resolve();
        };
        try {
          const audio = createAudio(clip.url);
          currentAudio = audio;
          audio.addEventListener("ended", done, { once: true });
          audio.addEventListener("error", done, { once: true });
          // A pause settles the line too: the only pause this
          // element ever gets is the sound subscription's mid-line
          // mute, and a muted line is finished — the choreography
          // must complete, not wait out a clip that will never end.
          audio.addEventListener("pause", done, { once: true });
          onSpeaking(true);
          const playPromise = audio.play();
          if (playPromise) playPromise.catch(done);
        } catch {
          done();
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      const audio = currentAudio;
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* element already gone — the line settles via its own path */
        }
      }
    },
  };
}
