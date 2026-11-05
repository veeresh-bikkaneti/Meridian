import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion";
import { LOCKED_GEODETECTIVE_FILM } from "../../assets/home-v5/locked-tile-media";

/**
 * LockedTileFilm — the picture band on the locked GeoDetective
 * tile (Little Explorer, 5–7). The detective asleep on her map:
 * she breathes twice, slowly, and the film loops back to its
 * first frame (its first and last frames are the same picture,
 * so the loop has no seam).
 *
 * This is NOT CardFilm, but since the owner's ruling of
 * 2026-11-04 it carries CardFilm's exact playback governance:
 * the film loops, a second IntersectionObserver plays it while
 * the slot is on screen and pauses it off-screen, and play()
 * rejections are caught and dropped. That ruling supersedes the
 * original bounded-play design (R2: play once, ~10 s, then rest
 * on the still forever), which existed so the tile would need
 * no stop control.
 *
 * Ruling R1 still holds, unchanged: a locked tile must never
 * carry a play icon or any control that reads as "tap to start"
 * — no button, no toggle, no link, nothing focusable or
 * clickable. Looping adds no control, so R1 is not touched. The
 * stop story is CardFilm's: the gates below mean a player who
 * prefers reduced motion, or is saving data, or is on a
 * low-memory device never gets the film at all, only the still —
 * and off-screen the film pauses. (An earlier version of this
 * header claimed CardFilm "carries a play/pause toggle"; that
 * was already stale when written — CardFilm has had no toggle
 * since the owner's 2026-11-03 autoloop order.)
 *
 * The gates match CardFilm's, and each one lands on the resting
 * still with the video file never fetched: prefers-reduced-motion
 * (the shared hook, live mid-session), Save-Data, deviceMemory
 * ≤ 2, or a video error. A video error gets ONE bounded retry (a
 * single remount) before it latches to the still — the same
 * latch cure CardFilm carries (2026-11-04); this component's
 * media is a constant, so there is no media-change reset here.
 * The mount is lazy the same way too: IntersectionObserver with
 * a 200px margin, preload="none", the poster (the film's own
 * first frame) in the box until the film mounts. Only the 5–7
 * band ever renders this component — LockedLoop itself only
 * renders for that band — so no other band downloads the film.
 *
 * Zero layout shift: the wrapper carries the slot's box
 * (.agep-locked-pic in age-profile.css, fixed aspect-ratio), so
 * the box stands at final size before any media bytes arrive and
 * the media absolutely fills it.
 */

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

export function LockedTileFilm() {
  const reducedMotion = usePrefersReducedMotion();
  // Save-Data / low-memory are read once at mount, the same way
  // CardFilm and the home globe read them.
  const [staticGate] = useState<boolean>(staticGateAtMount);
  const [failed, setFailed] = useState(false);
  // Which load attempt the mounted video is on: 0 is the first
  // try, 1 is the one bounded retry (see handleError below).
  const [attempt, setAttempt] = useState(0);
  const [near, setNear] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const gated = reducedMotion || staticGate || failed;

  const handleError = () => {
    // One bounded retry before latching, parallel to CardFilm:
    // remount the video once (its key carries the attempt count).
    // A second error latches to the still. No loop, no timers.
    if (attempt === 0) setAttempt(1);
    else setFailed(true);
  };

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

  // Off-screen pause, CardFilm's exact governance: once the film
  // is mounted, a second observer plays it while the slot is on
  // screen and pauses it when the slot leaves, so the loop never
  // decodes off-screen.
  useEffect(() => {
    if (gated || !near) return;
    const root = rootRef.current;
    const film = videoRef.current;
    if (!root || !film) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            film.play().catch(() => {});
          } else {
            film.pause();
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [gated, near]);

  if (gated) {
    // The resting still IS the design here — no video element
    // exists in this branch, so the .mp4 is never requested.
    return (
      <div className="agep-locked-pic" data-testid="locked-tile-film">
        <img src={LOCKED_GEODETECTIVE_FILM.stillUrl} alt="" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="agep-locked-pic" data-testid="locked-tile-film">
      {near ? (
        <video
          key={`locked#${attempt}`}
          ref={videoRef}
          src={LOCKED_GEODETECTIVE_FILM.videoUrl}
          poster={LOCKED_GEODETECTIVE_FILM.posterUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onError={handleError}
        />
      ) : (
        <img src={LOCKED_GEODETECTIVE_FILM.posterUrl} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
