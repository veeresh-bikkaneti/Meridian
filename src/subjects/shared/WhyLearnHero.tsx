/**
 * WhyLearnHero — the montage film in the picker's hero slot
 * (2026-11-13 brief, feat/why-learn-montage).
 *
 * The film replaces the hero still at the top of the "Why Do We
 * Learn This?" card — that strip only. It autoplays muted and
 * loops; the three small controls under its corner are the whole
 * interface: pause/play, replay, and the song (sound) toggle.
 * This is a picker hero, not a home card film, so CardFilm's
 * autoloop governance does not apply here — the brief for this
 * slot orders the controls.
 *
 * Gates, mirroring the house rules for moving pictures:
 * - prefers-reduced-motion (the shared hook, live on OS flips):
 *   no film at all — the montage poster (its frame at 5 s) shows
 *   as a still with alt text, and no controls render.
 * - The play window (feat/why-learn-living-atlas): the shipped
 *   film's first and last beats are a picture of the page itself
 *   and a collage card, not scenes, so the player starts at the
 *   window's start and loops back to it at its end (the constants
 *   and the full note live in why-learn-art.ts). Replay restarts
 *   at the window's start for the same reason. The window is a
 *   player setting, separable from the film file.
 * - A film that fails to load latches to the same poster still.
 * - Sound starts OFF (muted): browsers block audible autoplay,
 *   and a reading page should not burst into song. The toggle
 *   flips the element's muted property — the one switch for the
 *   song, independent of the app's SFX sound gate.
 * - The film itself is decoration for the controls' purposes:
 *   aria-hidden, never focusable; the buttons carry the labels.
 * - No words from the song are rendered anywhere: the lyrics are
 *   the audio track only (brief: the song is heard, not read).
 *
 * Media paths and provenance: src/assets/why-learn/why-learn-art.ts.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { assetBase } from "@/components/storyteller-lines";
import {
  WHY_LEARN_MONTAGE_ALT,
  WHY_LEARN_MONTAGE_LOOP_END_S,
  WHY_LEARN_MONTAGE_LOOP_START_S,
  WHY_LEARN_MONTAGE_PATH,
  WHY_LEARN_MONTAGE_POSTER_PATH,
} from "@/assets/why-learn/why-learn-art";

export function WhyLearnHero() {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [soundOn, setSoundOn] = useState(false);

  const posterUrl = `${assetBase()}${WHY_LEARN_MONTAGE_POSTER_PATH}`;
  const videoUrl = `${assetBase()}${WHY_LEARN_MONTAGE_PATH}`;

  // The muted property is the switch (the React muted attribute
  // alone does not re-apply after mount), driven by the toggle.
  useEffect(() => {
    const film = videoRef.current;
    if (film) film.muted = !soundOn;
  }, [soundOn]);

  if (reducedMotion || failed) {
    // The poster IS the design here — no video element exists in
    // this branch, so the .mp4 is never requested.
    return (
      <img
        className="why-learn-hero"
        src={posterUrl}
        alt={WHY_LEARN_MONTAGE_ALT}
        width={608}
        height={1280}
        loading="eager"
        decoding="async"
      />
    );
  }

  const togglePlay = () => {
    const film = videoRef.current;
    if (!film) return;
    if (film.paused) {
      film.play().catch(() => {});
    } else {
      film.pause();
    }
  };

  // The play window: land inside it as soon as the film can seek,
  // and fold the playhead back to its start when it reaches the
  // end, so the loop never shows the defective beats. The native
  // `loop` stays on as the backstop for the file's own end.
  const enterWindow = () => {
    const film = videoRef.current;
    if (film && film.currentTime < WHY_LEARN_MONTAGE_LOOP_START_S) {
      film.currentTime = WHY_LEARN_MONTAGE_LOOP_START_S;
    }
  };

  const keepInWindow = () => {
    const film = videoRef.current;
    if (film && film.currentTime >= WHY_LEARN_MONTAGE_LOOP_END_S) {
      film.currentTime = WHY_LEARN_MONTAGE_LOOP_START_S;
    }
  };

  const replay = () => {
    const film = videoRef.current;
    if (!film) return;
    film.currentTime = WHY_LEARN_MONTAGE_LOOP_START_S;
    film.play().catch(() => {});
  };

  return (
    <div className="why-learn-hero-wrap">
      <video
        ref={videoRef}
        className="why-learn-hero"
        data-testid="why-learn-hero-video"
        src={videoUrl}
        poster={posterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={enterWindow}
        onTimeUpdate={keepInWindow}
        onError={() => setFailed(true)}
      />
      <div className="why-learn-hero-controls">
        <button
          type="button"
          data-testid="why-learn-hero-playpause"
          aria-label={playing ? "Pause montage" : "Play montage"}
          onClick={togglePlay}
        >
          {playing ? (
            <Pause className="size-5" aria-hidden="true" />
          ) : (
            <Play className="size-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          data-testid="why-learn-hero-replay"
          aria-label="Replay montage"
          onClick={replay}
        >
          <RotateCcw className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="why-learn-hero-sound"
          aria-label={soundOn ? "Turn montage sound off" : "Turn montage sound on"}
          aria-pressed={soundOn}
          onClick={() => setSoundOn((on) => !on)}
        >
          {soundOn ? (
            <Volume2 className="size-5" aria-hidden="true" />
          ) : (
            <VolumeX className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
