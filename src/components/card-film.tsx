import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";
import type { AgeBandId } from "@/game/age-profile";

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
 *   A video error gets ONE bounded retry (a single remount)
 *   before it latches to the still. Retry budget: exactly one
 *   retry per media+band scope — the retry and the latch are
 *   spent for that scope until the media or the band changes,
 *   so a band switch revives even a slot whose media is the
 *   same in every band, and one flaky load cannot park the
 *   slot on the still for the whole home session (owner
 *   commission, 2026-11-04; scope cured on the panel's
 *   re-vote round — most slots' media never changes, so a
 *   media-only reset left them latched). Leaving a scope
 *   clears its record entirely, so returning to an earlier
 *   band later in the same session also arrives fresh —
 *   revival is not used up by having visited a scope before
 *   (panel round-2 cure).
 * - Lazy: the video element (and with it the .mp4 request) only
 *   mounts when the slot nears the viewport — IntersectionObserver,
 *   rootMargin 200px, the globe's pattern. Before that, the poster
 *   (the film's own first frame) fills the slot, so nothing jumps
 *   when the film takes over. preload="none" says the quiet part
 *   out loud: no eager fetch even once mounted.
 * - It loops, muted and inline. A second IntersectionObserver
 *   (threshold 0) pauses the film when the slot leaves the screen
 *   and plays it again when the slot comes back, so five loops
 *   never decode off-screen. The observer resolves the CURRENT
 *   video element inside its callback, so a remount (the retry,
 *   a media swap) never leaves it play()/pause()-ing a detached
 *   element. play() rejections are caught and dropped, as before.
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
  band,
}: {
  className?: string;
  media: CardFilmMedia;
  testId?: string;
  /**
   * The current age band. Part of the retry/latch scope below:
   * a band switch revives a latched slot even when its media is
   * the same in every band (most slots) — the panel's B2 cure.
   */
  band?: AgeBandId;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // Save-Data / low-memory are read once at mount (the globe reads
  // them the same way); reduced motion stays live via the hook.
  const [staticGate] = useState<boolean>(staticGateAtMount);
  // The retry/latch scope: this film in this band. The two states
  // below only remember WHICH scope spent its retry / latched;
  // `attempt` and `failed` are DERIVED by comparing them to the
  // current scope, so a media or band change resets both in the
  // same render — no post-render reset effect, no first render at
  // the stale attempt, and no stale error charged to a new film.
  // A single flaky load must not park this slot on the still for
  // the whole home session (owner commission, 2026-11-04).
  const scope = `${band ?? ""}|${media.videoUrl}`;
  const [spentScope, setSpentScope] = useState<string | null>(null);
  const [failedScope, setFailedScope] = useState<string | null>(null);
  // Which load attempt the mounted video is on: 0 is the first
  // try, 1 is the one bounded retry (see handleError below).
  const attempt = spentScope === scope ? 1 : 0;
  const failed = failedScope === scope;
  // Leaving a scope clears its record (panel round-2, Office
  // Hours): derivation alone revives the slot only while a
  // DIFFERENT scope is showing — if the player latches in band A,
  // switches to B (revived), then switches back to A in the same
  // home session, the stored record still equals A's scope and
  // the slot renders latched on arrival. Clearing on the actual
  // transition makes every arrival at a scope start fresh. The
  // adjustment runs during render (React's adjust-state-when-a-
  // prop-changes pattern), so the arriving scope's first committed
  // render is already fresh — there is still no reset effect, and
  // the derivation above is untouched.
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) {
    setSeenScope(scope);
    setSpentScope(null);
    setFailedScope(null);
  }
  const [near, setNear] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const gated = reducedMotion || staticGate || failed;

  const handleError = () => {
    // One bounded retry before latching: remount the video once
    // (its key carries the attempt count). A second error on the
    // SAME scope latches to the still. No retry loop, no timers.
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

  // Off-screen pause: once the film is mounted, a second observer
  // plays it while the slot is on screen and pauses it when the
  // slot leaves, so looping films never decode off-screen. The
  // deps carry `attempt` and `media.videoUrl` on purpose (panel
  // round-2 BLOCK): the retry key — and every media swap —
  // replaces the video element, and if this effect does not
  // re-run for the new element, the observer's initial delivery
  // never reaches it; a slot that has not intersected yet gets no
  // threshold crossing either, so the remounted film would
  // autoplay and loop off-screen indefinitely. Re-running the
  // effect re-observes, and the new observer's initial delivery
  // pauses or plays the CURRENT element correctly.
  useEffect(() => {
    if (gated || !near) return;
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Resolve the CURRENT element at event time: the retry
        // key remounts the video node (and every media swap
        // does too), so an element captured when this effect ran
        // would be the detached old node — the mounted film would
        // autoplay and decode off-screen forever (panel B1).
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
  }, [gated, near, attempt, media.videoUrl]);

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
          key={`${media.videoUrl}#${attempt}`}
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
          onError={handleError}
        />
      ) : (
        <img src={media.posterUrl} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
