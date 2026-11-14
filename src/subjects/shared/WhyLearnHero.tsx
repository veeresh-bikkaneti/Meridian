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
 * Presentation (fix/why-learn-fill-viewport): the film is
 * portrait (608×1280) and the slot is a wide strip whose ratio
 * grows with viewport height (styles.css). The film sits in a
 * box of its own ratio, object-fit: contain, centred over a
 * blurred, dimmed copy of its poster — the WHOLE frame shows on
 * every screen; under the old cover fit only the middle slice
 * (13–21% of the frame) was visible. The controls ride the film
 * box's own bottom-right corner.
 *
 * Gates, mirroring the house rules for moving pictures:
 * - prefers-reduced-motion (the shared hook, live on OS flips):
 *   no film at all — the montage poster (its frame at 1 s) shows
 *   as a still with alt text, in the same film box over the same
 *   fill, and no controls render.
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
    // this branch, so the .mp4 is never requested. It fills the
    // same film box over the same blurred fill as the film does,
    // so the still and the film present the frame identically.
    return (
      <div className="why-learn-hero-wrap">
        <img className="why-learn-hero-fill" src={posterUrl} alt="" aria-hidden="true" />
        <div className="why-learn-hero-film">
          <img
            className="why-learn-hero"
            src={posterUrl}
            alt={WHY_LEARN_MONTAGE_ALT}
            width={608}
            height={1280}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
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

  const replay = () => {
    const film = videoRef.current;
    if (!film) return;
    film.currentTime = 0;
    film.play().catch(() => {});
  };

  return (
    <div className="why-learn-hero-wrap">
      <img className="why-learn-hero-fill" src={posterUrl} alt="" aria-hidden="true" />
      <div className="why-learn-hero-film">
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
    </div>
  );
}
