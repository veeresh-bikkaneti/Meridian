/**
 * SiteHeader: the ONE header for every screen (Stream S contract,
 * fix/ui-shared-shell). Brand lockup left, the screen's nav, then the
 * action slots in a fixed order — stars, mute, end game — so a child
 * never relearns where things live between screens.
 *
 * - Brand: BrandHomeButton from home-button.ts, as-is. Router routes
 *   pass `to="/"` and get the same lockup as a router Link (the classes
 *   and markup mirror home-button.ts, which owns the lockup; PR 517
 *   adds the same union there, and this branch dedupes onto it when
 *   that lands).
 * - Slots never enter the menu panel: End game and mute stay on the
 *   line at every width, so no action can be menu-trapped.
 * - `stars` and `mute` are required-but-nullable on purpose (UX seat):
 *   a screen that earns no stars or plays no audio passes null and the
 *   omission is a visible choice in its adoption diff, not a forgotten
 *   optional prop. Stars render as numeral + glyph in body text at AA
 *   contrast — the host builds that node; this header only places it.
 * - Every control keeps a ≥44px hit box, links included; the compact
 *   band (1024–1279px) shrinks type, never the hit box.
 * - Visual values live in styles.css as .site-header … (shell dialect:
 *   theme + atlas tokens; the hv5 recipes are re-declared at identical
 *   values under .home-v5 because --hv5-* is home-scoped, light-only).
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandHomeButton, BRAND_HOME_LABEL } from "./home-button.ts";
import { cn } from "@/lib/cn";

export type SiteNavItem = {
  label: string;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
};

type SiteHeaderSlots = {
  /** "inline" (default): nav on the line from 1024px, behind Menu below
   *  that. "menu": nav behind Menu at every width — for narrow
   *  read-column screens that can never fit the full nav. */
  navMode?: "inline" | "menu";
  /** Explicit nav node; overrides navItems. */
  nav?: ReactNode;
  /** The default nav link row, built from data when `nav` is absent. */
  navItems?: readonly SiteNavItem[];
  /** Star readout where stars are earned, null where they are not. */
  stars: ReactNode | null;
  /** Sound toggle on screens that play audio, null on silent screens. */
  mute: ReactNode | null;
  /** The screen's one exit control (Button variant="secondary"); home
   *  passes its Join pill here. A screen renders exactly one exit
   *  control — this slot — and no second one at the bottom. */
  endGame?: ReactNode;
  className?: string;
};

export type SiteHeaderProps = SiteHeaderSlots &
  ({ onHome: () => void; to?: never } | { to: "/"; onHome?: never });

/* The brand lockup for the router-Link form. Classes and svg mirror
 * BrandHomeButton's BRAND_BASE + lockup in home-button.ts exactly; that
 * file owns the lockup and is not edited here (PR 517 in flight). */
const BRAND_LINK_BASE =
  "brand-home-button inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-md px-3 text-sm font-medium " +
  "transition-[transform,background-color,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] " +
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-current";

function BrandHomeLink({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn(BRAND_LINK_BASE, className)} aria-label={BRAND_HOME_LABEL} data-testid="home-button">
      <svg className="brand-home-mark" viewBox="0 0 48 48" aria-hidden={true} focusable="false">
        <circle cx="24" cy="24" r="21.5" fill="none" stroke="#8A6D2F" strokeWidth="1.6" />
        <circle cx="24" cy="24" r="16.5" fill="none" stroke="#B8932F" strokeWidth=".8" strokeOpacity=".6" />
        <path d="M24 6 L27.2 20.8 L42 24 L27.2 27.2 L24 42 L20.8 27.2 L6 24 L20.8 20.8 Z" fill="#8A6D2F" />
        <circle cx="24" cy="24" r="3.4" fill="#F6F1E3" stroke="#8A6D2F" strokeWidth="1.2" />
      </svg>
      <span className="brand-home-word">MERIDIAN</span>
    </Link>
  );
}

export function SiteHeader({
  navMode = "inline",
  nav,
  navItems,
  stars,
  mute,
  endGame,
  className,
  ...home
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navNode: ReactNode =
    nav ??
    (navItems ? (
      <>
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className="site-header-nav-link"
            onClick={item.onClick}
            data-testid={item.testId}
            aria-label={item.ariaLabel}
          >
            {item.label}
          </button>
        ))}
      </>
    ) : null);
  const hasNav = navNode !== null && navNode !== undefined;

  return (
    <header className={cn("site-header", className)} data-nav-mode={navMode}>
      <div className="site-header-row">
        {home.to ? <BrandHomeLink /> : <BrandHomeButton onHome={home.onHome} />}
        {navMode === "inline" && hasNav ? (
          <nav className="site-header-nav" aria-label="Site">
            {navNode}
          </nav>
        ) : null}
        <div className="site-header-actions">
          {stars}
          {mute}
          {endGame}
          {hasNav ? (
            <button
              type="button"
              className="site-header-menu-button"
              aria-expanded={menuOpen}
              data-open={menuOpen ? "true" : "false"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          ) : null}
        </div>
      </div>
      {hasNav && menuOpen ? (
        <nav className="site-header-nav site-header-panel" aria-label="Site" data-open="true">
          {navNode}
        </nav>
      ) : null}
    </header>
  );
}
