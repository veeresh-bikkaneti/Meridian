import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";

/**
 * Home-page lazy-image wrapper (loading-orbs build).
 *
 * Renders the existing `.meridian-spinner` (src/styles.css) centered over
 * the image until its load fires, then fades the overlay out with a CSS
 * opacity transition and unmounts it on transition end — one handler,
 * no timer chains (chained timers are banned in this repo).
 *
 * The wrapper carries the image's existing layout class (e.g. `hv5-pic`
 * / `hv5-art`), so the box the page lays out is unchanged; the inner
 * img fills it. The overlay is aria-hidden and pointer-events:none, so
 * it adds no focus stop and never blocks the card's stretched CTA once
 * faded or unmounted. On error the orb clears and the browser's current
 * behavior applies — no error-fallback UI is invented here (that design
 * ruling is still owed by the owner).
 *
 * Cached images: if the img is already complete with a real bitmap at
 * mount, the orb never lingers — it is skipped outright. A complete
 * image with no bitmap (cached failure) takes the error path (fade out)
 * so a dead load can never strand the spinner on screen.
 *
 * Smooth art motion (feat/smooth-cards): a wrapper carrying the
 * `.hv5-art` class (the Review, Journal, and Grown-ups spot
 * illustrations) also arms one calm pass of CSS motion on its img.
 * The governance mirrors CardFilm, because the request that created
 * this work asked for the film cards' treatment on these cards too:
 * the `hv5-art-live` class is added only when the wrapper nears the
 * viewport (IntersectionObserver, rootMargin 200px, the same margin
 * CardFilm uses), and it is never added when any film gate applies:
 * prefers-reduced-motion (the shared hook, so a mid-session OS flip
 * disarms it too), Save-Data, or deviceMemory at or below 2 (both
 * read once at mount, the way CardFilm reads them). The CSS pass
 * itself (home-v5.css) runs once and settles back onto the still,
 * so there is no loop and no pause control is needed. Wrappers
 * without `.hv5-art` (the journal entry figures) never observe and
 * never animate: they are content pictures, not card art.
 */

function artStaticGateAtMount(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  const mem = nav.deviceMemory;
  return typeof mem === "number" && mem > 0 && mem <= 2;
}
export function LazyHomeImage({
  className,
  src,
  alt,
  ariaHidden,
}: {
  className?: string;
  src: string;
  alt: string;
  ariaHidden?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<"loading" | "fading" | "done">("loading");

  const isArt = Boolean(className?.includes("hv5-art"));
  const reducedMotion = usePrefersReducedMotion();
  const [staticGate] = useState<boolean>(artStaticGateAtMount);
  const [near, setNear] = useState(false);
  const artLive = isArt && near && !reducedMotion && !staticGate;

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth > 0) setPhase("done");
    else setPhase("fading");
  }, []);

  useEffect(() => {
    if (!isArt || reducedMotion || staticGate || near) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setNear(true);
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [isArt, reducedMotion, staticGate, near]);

  return (
    <div ref={wrapRef} className={className ? `hv5-lazy-img ${className}` : "hv5-lazy-img"}>
      <img
        ref={imgRef}
        className={artLive ? "hv5-art-live" : undefined}
        src={src}
        alt={alt}
        aria-hidden={ariaHidden ? true : undefined}
        loading="lazy"
        decoding="async"
        onLoad={() => setPhase("fading")}
        onError={() => setPhase("fading")}
      />
      {phase !== "done" ? (
        <span
          aria-hidden="true"
          className={phase === "fading" ? "hv5-lazy-orb hv5-lazy-orb-fading" : "hv5-lazy-orb"}
          onTransitionEnd={(e) => {
            if (e.propertyName === "opacity") setPhase("done");
          }}
        >
          <span aria-hidden="true" className="meridian-spinner hv5-orb-spinner" />
        </span>
      ) : null}
    </div>
  );
}
