/**
 * SiteHeaderDrawer: the header's drop-down panel, shared by
 * SiteHeader's Menu button (<768px) and SiteHeaderNav's More button
 * (768–1023px). One panel, two placements: as a direct child of the
 * header (the menu, in-flow) or inside the nav row (the More panel,
 * absolutely positioned below the header via .site-header-more-panel).
 *
 * Behaviour (the first-visit-queue pattern, lightened for a menu —
 * this is a disclosure, not a modal, so there is no scroll lock and
 * no focus pull-back; focus is free outside the panel):
 * - Opens with focus on its first link.
 * - Escape closes and returns focus to the toggle that opened it
 *   (the caller does the refocus inside onClose).
 * - Tab cycles within the panel while focus is inside it.
 * - A click on a nav link inside closes it (a pick is a close).
 *
 * Plain .ts with createElement (like home-button.ts) so the node
 * unit harness can render it.
 */
import { createElement, useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn.ts";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusablesIn(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

export type PanelKeyEvent = {
  key: string;
  shiftKey?: boolean;
  preventDefault: () => void;
  stopPropagation?: () => void;
};

/**
 * The panel's key handling as a pure function, so the node harness
 * (no DOM) can test it: Escape closes; Tab cycles within the panel
 * while focus is inside it. `activeElement` is passed in so the
 * function never reads document itself.
 */
export function handlePanelKeyDown(
  event: PanelKeyEvent,
  panel: HTMLElement | null,
  activeElement: Element | null,
  onClose: () => void,
): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation?.();
    onClose();
    return;
  }
  if (event.key !== "Tab" || !panel) return;
  const items = focusablesIn(panel);
  if (items.length === 0) return;
  if (!panel.contains(activeElement)) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Wires handlePanelKeyDown to the document while the panel is open. */
export function usePanelTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    focusablesIn(panel)[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) =>
      handlePanelKeyDown(event, panel, document.activeElement, () => onCloseRef.current());
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, panelRef]);
}

export type SiteHeaderDrawerProps = {
  open: boolean;
  onClose: () => void;
  className?: string;
  children?: ReactNode;
};

export function SiteHeaderDrawer({ open, onClose, className, children }: SiteHeaderDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  usePanelTrap(open, panelRef, onClose);
  if (!open) return null;
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(".site-header-nav-link")) onClose();
  };
  return createElement(
    "nav",
    {
      ref: panelRef,
      className: cn("site-header-nav site-header-panel", className),
      "aria-label": "Site",
      onClick,
    },
    children,
  );
}
