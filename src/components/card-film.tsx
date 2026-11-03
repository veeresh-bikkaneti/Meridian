import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";

/**
 * CardFilm — the one shared picture slot for the five home cards
 * that carry a film: GeoDetective + Cold Trail (the `.hv5-pic`
 * slots) and Review, Journal, and Grown-ups (the `.hv5-art` slots,
 * added 2026-11-03 on the owner's ruling — one motion system for
 * every illustrated card). Each card used to show a still picture
 * here; now each shows a short film, and this component is the
 * governance. The media itself (film / poster / still per card)
 * lives in src/assets/home-v5/card-media.ts — this component
 * never names a file.
 *
 * Governance now is the owner's autoloop order (2026-11-03, his
 * words at 09:05 and 09:07 CST): "we dont need playbutton it
 * should be in autoloop" and "Remove playbutton set it on auto
 * loop." So the films loop, and no card film renders a play or
 * pause button. That order supersedes the play-once + toggle
 * governance this component shipped with under PR #295 and
 * PR #321, for card films only. The challenge verdict clip is a
 * different component and keeps its own stop; nothing here
 * changes it.
 *
 * The tradeoff, stated plainly: WCAG 2.2.2 asks for a stop on
 * moving content that lasts more than five seconds. These card
 * films are continuous looping decorative motion with no
 * per-card stop. The stops that remain are the gates below: a
 * player who prefers reduced motion, or is saving data, or is on
 * a low-memory device never gets a film at all, only the still.
 * The owner chose autoloop with those gates in place. Do not add
 * a button back without a new owner order.
 *
 * The rules that still hold, mirroring the home globe's gates
 * (home-globe.tsx):
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
 * - It loops, muted and inline. A second IntersectionObserver
 *   (threshold 0) pauses the film when the slot leaves the screen
 *   and plays it again when the slot comes back, so five loops
 *   never decode off-screen. play() rejections are caught and
 *   dropped, as before.
 * - The film is decoration: aria-hidden, never focusable. This
 *   component adds no interactive element to any card.
 * - Zero layout shift: the wrapper carries the slot's existing
 *   layout class (.hv5-pic or .hv5-art), whose box geometry does
 *   not change; the media absolutely fills that box (see
 *   home-v5.css).
 * - On the `.hv5-pic` slots the picture feathers into the text
 *   area: a mask on the media itself (home-v5.css) fades the
 *   scene's own alpha out over the box's last 7%, and no pigment
 *   is painted over the scene — the painted landing strip the
 *   rework first shipped was deleted on the owner's ruling
 *   (2026-11-03 10:25 CST; the ground reasoning is recorded in
 *   home-v5.css). Because the mask sits on the media elements,
 *   it covers every state the slot renders (film, poster,
 *   still) with no work here. The `.hv5-art` slots are
 *   full-bleed banners and carry no fade at all.
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

  // Off-screen pause: once the film is mounted, a second observer
  // plays it while the slot is on screen and pauses it when the
  // slot leaves, so looping films never decode off-screen.
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
          loop
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setFailed(true)}
        />
      ) : (
        <img src={media.posterUrl} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
