import { useEffect, useRef, useState } from "react";
import { observeResize } from "../lib/observe-resize.ts";

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
import { BoundedText } from "./bounded-text";

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
    // clue expansion) — re-evaluate on resize of the region. rAF-coalesced
    // so the synchronous read/write loop can't trip the benign
    // "ResizeObserver loop" browser complaint. See src/lib/observe-resize.ts.
    const stopObserving = observeResize(el, update);
    return () => {
      el.removeEventListener("scroll", update);
      stopObserving();
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
      <BoundedText as="span" variant="body" className="scroll-cue-text">
        more below
      </BoundedText>
    </div>
  );
}
