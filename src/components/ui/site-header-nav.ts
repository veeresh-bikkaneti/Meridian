/**
 * SiteHeaderNav: the header's inline nav row with the responsive
 * "More" split (TD-06.16, commit 2). In the 768–1023px band the row
 * shows the full nav only if it fits on one line; otherwise the
 * first MORE_VISIBLE_COUNT links stay inline and the rest move
 * behind a "More" button (ChevronDown) that opens the shared drawer
 * panel. At ≥1024px the full row always shows; below 768px the
 * whole row is hidden by CSS and the Menu button owns the nav.
 *
 * The fit is a real overflow check, not a width guess: the row
 * renders full, a layout effect compares scrollWidth to clientWidth
 * (the row is min-width: 0 so it can shrink to the space the header
 * gives it), and only then splits. A resize or a font load re-probes
 * by rendering full again first — the layout effect decides before
 * paint, so the full row never flashes.
 *
 * Plain .ts with createElement (like home-button.ts) so the node
 * unit harness can render it.
 */
import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown } from "lucide-react";
import { SiteHeaderDrawer } from "./site-header-drawer.ts";

/** Links kept inline when the row splits. This is the STARTING
 * count, not a promise: where the header gives the nav little room
 * the row still overflows with four links, and the nav shrinks the
 * count until the row fits. */
export const MORE_VISIBLE_COUNT = 4;
/** The band where the More split applies. */
export const MORE_BAND = "(min-width: 768px) and (max-width: 1023.5px)";

export function splitNavItems(items: ReactNode[], visibleCount: number = MORE_VISIBLE_COUNT) {
  return { visible: items.slice(0, visibleCount), rest: items.slice(visibleCount) };
}

export type SiteHeaderNavRowProps = {
  items: ReactNode[];
  mode: "full" | "more";
  moreOpen: boolean;
  onMoreToggle: (open: boolean) => void;
  navRef: RefObject<HTMLElement | null>;
  /** Links kept inline in "more" mode (the adaptive count). */
  visibleCount: number;
};

/** The row itself, mode-driven so the node harness can render both. */
export function SiteHeaderNavRow({ items, mode, moreOpen, onMoreToggle, navRef, visibleCount }: SiteHeaderNavRowProps) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const { visible, rest } =
    mode === "more"
      ? splitNavItems(items, visibleCount)
      : { visible: items, rest: [] as ReactNode[] };
  const showMore = rest.length > 0;
  const closeMore = () => {
    onMoreToggle(false);
    moreButtonRef.current?.focus();
  };
  return createElement(
    Fragment,
    null,
    createElement(
      "nav",
      { ref: navRef, className: "site-header-nav", "aria-label": "Site" },
      ...visible,
      showMore
        ? createElement(
            "button",
            {
              ref: moreButtonRef,
              type: "button",
              className: "site-header-nav-link site-header-more-button",
              "aria-expanded": moreOpen,
              "aria-haspopup": true,
              onClick: () => onMoreToggle(!moreOpen),
            },
            "More",
            createElement(ChevronDown, { className: "site-header-more-chevron size-4", "aria-hidden": true }),
          )
        : null,
    ),
    createElement(
      SiteHeaderDrawer,
      { open: moreOpen, onClose: closeMore, className: "site-header-more-panel" },
      ...rest,
    ),
  );
}

export function SiteHeaderNav({ navNode }: { navNode: ReactNode }) {
  /* Unwrap a top-level fragment: Home (and the navItems-built node)
   * pass the nav as <>…</>, and Children.toArray of a fragment
   * element returns the fragment itself, not its items — the split
   * would see one item and never fire. */
  const frag =
    isValidElement<{ children?: ReactNode }>(navNode) && navNode.type === Fragment ? navNode : null;
  const inner = frag ? frag.props.children : navNode;
  const items = Children.toArray(inner);
  const navRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<"full" | "more">("full");
  const [moreOpen, setMoreOpen] = useState(false);
  /* Visible links while in "more" mode. Starts at MORE_VISIBLE_COUNT
   * and only ever shrinks (see the layout effect below). */
  const [visibleCount, setVisibleCount] = useState(MORE_VISIBLE_COUNT);
  const [probe, setProbe] = useState(0);

  // Measure only the full row: in "more" mode the row is short by
  // construction, so its scrollWidth says nothing about the full row.
  // Then, in "more" mode, measure the shortened row too: four links
  // + More is 382px at the compact gap and the nav only has ~306px
  // at 820px, so the More button would land under the Join pill and
  // never be clickable. Shrink the count until the row fits; the
  // count only ever decreases here, so this converges.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    if (!window.matchMedia(MORE_BAND).matches) return;
    if (mode === "full") {
      if (el.scrollWidth > el.clientWidth + 1) {
        setMode("more");
        setVisibleCount(MORE_VISIBLE_COUNT);
      }
      return;
    }
    if (el.scrollWidth > el.clientWidth + 1 && visibleCount > 1) {
      setVisibleCount((c) => Math.max(1, c - 1));
    }
  }, [mode, probe, visibleCount]);

  // A resize or a font load re-probes: render full first, then the
  // layout effect above decides. setMode("full") is a no-op when
  // already full; the probe bump still re-runs the measurement.
  useEffect(() => {
    const recheck = () => {
      setMode("full");
      setProbe((p) => p + 1);
    };
    window.addEventListener("resize", recheck);
    document.fonts?.ready.then(recheck).catch(() => {});
    return () => window.removeEventListener("resize", recheck);
  }, []);

  return createElement(SiteHeaderNavRow, {
    items,
    mode,
    moreOpen,
    onMoreToggle: setMoreOpen,
    navRef,
    visibleCount,
  });
}
