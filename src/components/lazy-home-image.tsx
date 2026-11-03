import { useEffect, useRef, useState } from "react";

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
 */
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
  const [phase, setPhase] = useState<"loading" | "fading" | "done">("loading");

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth > 0) setPhase("done");
    else setPhase("fading");
  }, []);

  return (
    <div className={className ? `hv5-lazy-img ${className}` : "hv5-lazy-img"}>
      <img
        ref={imgRef}
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
