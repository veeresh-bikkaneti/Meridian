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
 *   no film at all — the montage poster (a gravity-scene frame) shows
 *   as a still with alt text, and no controls render.
 * - The whole film plays (feat/why-learn-landscape-layout): the
 *   shipped film is the landscape re-cut — scenes end to end,
 *   no page pictures — so there is no play window: the native
 *   loop carries the entire 0–10 s and replay restarts at 0.
 *   (The portrait cut this replaced needed a 2.8–8.6 s window
 *   around its defective head and tail; that workaround is gone
 *   with the file it worked around. The full note lives in
 *   why-learn-art.ts.)
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
  const [posterFailed, setPosterFailed] = useState(false);
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

  // A media failure is not latched for the whole session: when the
  // network comes back or the page becomes visible again, clear the
  // latches and let the film/poster retry. (QA/UI-UX council,
  // 2026-11-16: the hero media were the one picker asset class with
  // no service-worker protection, so one transient failure at mount
  // used to empty the slot until a manual reload.)
  useEffect(() => {
    if (!failed && !posterFailed) return;
    const retry = () => {
      setFailed(false);
      setPosterFailed(false);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [failed, posterFailed]);

  if (reducedMotion || failed) {
    // The poster IS the design here — no video element exists in
    // this branch, so the .mp4 is never requested.
    if (posterFailed) {
      // Even the poster could not load: the slot still stands as a
      // labelled panel carrying the poster's description, never an
      // empty hole in the hero card. (QA/UI-UX council, 2026-11-16.)
      return (
        <div
          className="why-learn-hero why-learn-hero-still"
          role="img"
          aria-label={WHY_LEARN_MONTAGE_ALT}
        >
          <span>{WHY_LEARN_MONTAGE_ALT}</span>
        </div>
      );
    }
    return (
      <img
        className="why-learn-hero"
        src={posterUrl}
        alt={WHY_LEARN_MONTAGE_ALT}
        width={1280}
        height={720}
        loading="eager"
        decoding="async"
        onError={() => setPosterFailed(true)}
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

  // No play window: the landscape film is scenes end to end, so
  // replay restarts at the true start and the native `loop`
  // carries the whole 0–10 s.
  const replay = () => {
    const film = videoRef.current;
    if (!film) return;
    film.currentTime = 0;
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
