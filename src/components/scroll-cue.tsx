import { useEffect, useRef, useState } from "react";

/**
 * Cartographer's Plate PR3 — "more below" scroll cue (spec §5/§8.1).
 *
 * The fade-mask + `⋯` + "more below" pattern: the single honest signal
 * that a scroll region holds more content. Purely decorative —
 * `aria-hidden`, `pointer-events: none` — and HIDDEN when the content
 * fits or the region is scrolled to the bottom (spec §8.1).
 *
 * `useMoreBelow` returns a ref to attach to the scroll region and whether
 * the cue should show. The scroll region itself keeps `tabindex="0"` +
 * `role="region"` + an accessible name so keyboard users can reach and
 * scroll it (spec §8.1); the cue is only the visual hint.
 */
export function useMoreBelow<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  moreBelow: boolean;
} {
  const ref = useRef<T | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // >2px slop for sub-pixel rounding on zoomed viewports.
      setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Content can change height without scrolling (fonts, tier shifts,
    // clue expansion) — re-evaluate on resize of the region.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return { ref, moreBelow };
}

/**
 * The visual cue: brass fade + `⋯` + "more below" pinned to the bottom
 * edge of a scroll region. Render it as a sibling overlay inside a
 * `position: relative` wrapper around the scroll region (class
 * `scroll-cue-wrap`), never inside the region itself.
 */
export function ScrollCue({ visible }: { visible: boolean }): React.JSX.Element | null {
  if (!visible) return null;
  return (
    <div className="scroll-cue" aria-hidden="true">
      <span className="scroll-cue-dots">⋯</span>
      <span className="scroll-cue-text">more below</span>
    </div>
  );
}
