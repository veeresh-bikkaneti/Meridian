import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion";
import { LOCKED_GEODETECTIVE_FILM } from "../../assets/home-v5/locked-tile-media";

/**
 * LockedTileFilm — the picture band on the locked GeoDetective
 * tile (Little Explorer, 5–7). The detective asleep on her map:
 * she breathes twice, then the picture rests on the resting still.
 *
 * This is NOT CardFilm, and the difference is the point. CardFilm
 * carries a play/pause toggle (its WCAG 2.2.2 stop); a locked tile
 * must never carry a play icon or any control that reads as "tap
 * to start" (design ruling R1). So this variant has no toggle, no
 * button, no link — the picture is aria-hidden decoration,
 * pointer-events: none, never focusable. The film can do without
 * a stop control because it is bounded: it plays once, runs about
 * ten seconds, and settles on a still picture. An endless loop
 * would need a stop; a stop would break R1; so the motion ends.
 *
 * The gates match CardFilm's, and each one lands on the resting
 * still with the video file never fetched: prefers-reduced-motion
 * (the shared hook, live mid-session), Save-Data, deviceMemory
 * ≤ 2, or a video error. The mount is lazy the same way too:
 * IntersectionObserver with a 200px margin, preload="none", the
 * poster (the film's own first frame) in the box until the film
 * mounts. Only the 5–7 band ever renders this component —
 * LockedLoop itself only renders for that band — so no other band
 * downloads the film.
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
  const [near, setNear] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
          src={LOCKED_GEODETECTIVE_FILM.videoUrl}
          poster={LOCKED_GEODETECTIVE_FILM.posterUrl}
          autoPlay
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setFailed(true)}
        />
      ) : (
        <img src={LOCKED_GEODETECTIVE_FILM.posterUrl} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
