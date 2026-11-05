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
 * The tradeoff, stated plainly (mirroring CardFilm's header):
 * WCAG 2.2.2 asks for a stop on moving content that lasts more
 * than five seconds. This film is continuous looping decorative
 * motion and carries no stop of its own, so the stop story
 * above must not be read as 2.2.2 compliance — the owner
 * accepted the gates below in place of a stop (2026-11-04
 * ruling). Do not add a control back without a new owner order.
 *
 * The gates match CardFilm's, and each one lands on the resting
 * still with the video file never fetched: prefers-reduced-motion
 * (the shared hook, live mid-session), Save-Data, deviceMemory
 * ≤ 2, or a video error. A video error gets ONE bounded retry (a
 * single remount) before it latches to the still — the same
 * latch cure CardFilm carries (2026-11-04); this component's
 * media is a constant, so its retry/latch scope is just the
 * film's URL and there is no media-change reset here. Like
 * CardFilm, the off-screen observer resolves the CURRENT video
 * element inside its callback, so the retry remount never
 * leaves it driving a detached element.
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
  // The retry/latch scope, parallel to CardFilm: this component's
  // media is a constant, so the scope is just the film's URL. The
  // states only remember WHICH scope spent its retry / latched;
  // `attempt` and `failed` are DERIVED by comparing them to the
  // current scope (no effect reset, no stale charge).
  // No scope-transition clearing is needed here (CardFilm carries
  // one, panel round-2): this scope can never change while the
  // component is mounted, and leaving the 5–7 band unmounts it —
  // LockedLoop renders only for that band — so no stored record
  // can survive a band round trip.
  const scope = LOCKED_GEODETECTIVE_FILM.videoUrl;
  const [spentScope, setSpentScope] = useState<string | null>(null);
  const [failedScope, setFailedScope] = useState<string | null>(null);
  // Which load attempt the mounted video is on: 0 is the first
  // try, 1 is the one bounded retry (see handleError below).
  const attempt = spentScope === scope ? 1 : 0;
  const failed = failedScope === scope;
  const [near, setNear] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const gated = reducedMotion || staticGate || failed;

  const handleError = () => {
    // One bounded retry before latching, parallel to CardFilm:
    // remount the video once (its key carries the attempt count).
    // A second error on the SAME scope latches to the still.
    // No loop, no timers.
    if (spentScope !== scope) setSpentScope(scope);
    else setFailedScope(scope);
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
  // decodes off-screen. The deps carry `attempt` for the same
  // reason CardFilm's do (panel round-2 BLOCK): the retry key
  // replaces the video element, so the effect must re-run and
  // re-observe for the new element — otherwise a remount that
  // happens before the slot first intersects is never paused
  // and loops off-screen indefinitely.
  useEffect(() => {
    if (gated || !near) return;
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Resolve the CURRENT element at event time, as in
        // CardFilm: the retry key remounts the video node, so
        // an element captured when this effect ran would be the
        // detached old node (panel B1).
        const film = videoRef.current;
        if (!film) return;
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
  }, [gated, near, attempt]);

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
