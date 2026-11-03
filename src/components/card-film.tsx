import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";

/**
 * CardFilm — the one shared picture slot for the two home game
 * cards (GeoDetective + Cold Trail). Both cards used to show a
 * still photo here; now each shows a short governed film, and this
 * component is the governance. The media itself (film / poster /
 * still per card) lives in src/assets/home-v5/card-media.ts — this
 * component never names a file.
 *
 * The rules, mirroring the home globe's gates (home-globe.tsx) and
 * the verdict clip's stop semantics (PR #295):
 *
 * - The film is an enhancement, never the default. Any of these
 *   gates lands on the STILL, and the video file is never fetched:
 *   prefers-reduced-motion, Save-Data, deviceMemory ≤ 2, or a
 *   video error. Reduced motion is read through the shared hook,
 *   so an OS setting flipped mid-session swaps to the still too.
 * - Lazy: the video element (and with it the .mp4 request) only
 *   mounts when the slot nears the viewport — IntersectionObserver,
 *   rootMargin 200px, the globe's pattern. Before that, the poster
 *   (the film's own first frame) fills the slot, so nothing jumps
 *   when the film takes over. preload="none" says the quiet part
 *   out loud: no eager fetch even once mounted.
 * - It plays ONCE, muted, inline, no loop. When it ends it holds
 *   its last frame — for both cards the settled composition the
 *   still also shows. It never auto-replays.
 * - WCAG 2.2.2: moving content needs a stop that is always
 *   available. The corner toggle (44×44, above the card's
 *   stretched CTA the same way the badge buttons sit above it)
 *   pauses/plays at any moment; its label is driven by the video
 *   element's own play/pause events, so it always matches what the
 *   film is doing. After the film ends, the toggle replays it —
 *   replay happens by that gesture only, never by hover or timer.
 * - The film itself is decoration: aria-hidden, never focusable.
 *   The toggle is the only interactive element this component adds.
 * - Zero layout shift: the wrapper carries the slot's existing
 *   layout class (.hv5-pic), whose box geometry does not change;
 *   the media absolutely fills that box (see home-v5.css).
 */
export type CardFilmMedia = {
  videoUrl: string;
  posterUrl: string;
  stillUrl: string;
};

function staticGateAtMount(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  const mem = nav.deviceMemory;
  return typeof mem === "number" && mem > 0 && mem <= 2;
}

export function CardFilm({
  className,
  media,
  testId,
}: {
  className?: string;
  media: CardFilmMedia;
  testId?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // Save-Data / low-memory are read once at mount (the globe reads
  // them the same way); reduced motion stays live via the hook.
  const [staticGate] = useState<boolean>(staticGateAtMount);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(false);
  // Driven by the video's own play/pause events (see onPlay/onPause
  // below), never set optimistically — the #295 lesson: the label
  // must describe what the film is doing, not what we asked it to do.
  const [paused, setPaused] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const gated = reducedMotion || staticGate || failed;

  useEffect(() => {
    if (gated || near) return;
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setNear(true);
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [gated, near]);

  const toggle = () => {
    const film = videoRef.current;
    if (!film) {
      // The film has not mounted yet (slot still off-screen): the
      // press itself is the gesture that brings it in — mounting
      // autoplays it once, like scrolling it into view would.
      setNear(true);
      return;
    }
    if (film.paused) {
      // After the film has ended, a press replays it from the top;
      // mid-film, a press simply resumes. Rejected play() (autoplay
      // policy, interrupted load) must not surface as an unhandled
      // rejection — the film stays paused and the label says so.
      if (film.ended) film.currentTime = 0;
      film.play().catch(() => {});
    } else {
      film.pause();
    }
  };

  const boxClass = className ? `hv5-card-film ${className}` : "hv5-card-film";

  if (gated) {
    // The still IS the design here — no video element exists in
    // this branch, so the .mp4 is never requested.
    return (
      <div className={boxClass} data-testid={testId}>
        <img src={media.stillUrl} alt="" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={boxClass} data-testid={testId}>
      {near ? (
        <video
          ref={videoRef}
          src={media.videoUrl}
          poster={media.posterUrl}
          autoPlay
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onEnded={() => setPaused(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <img src={media.posterUrl} alt="" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        aria-label={paused ? "Play the cartoon" : "Pause the cartoon"}
        data-testid={testId ? `${testId}-toggle` : undefined}
        className="hv5-card-film-toggle"
      >
        {paused ? (
          <span aria-hidden="true" className="hv5-film-icon-play" />
        ) : (
          <span aria-hidden="true" className="hv5-film-icon-pause">
            <span />
            <span />
          </span>
        )}
      </button>
    </div>
  );
}
