/**
 * SiteHeader: the ONE header for every screen (Stream S contract,
 * fix/ui-shared-shell). The shared home control left, the screen's
 * nav, then the action slots in a fixed order — stars, mute, end
 * game — so a child never relearns where things live between screens.
 *
 * - Home control: HomeButton from home-button.ts (Round 2 review,
 *   rule 2) — the one control named exactly "Home", top-left, ≥44px,
 *   no arrow in its name. `homeVariant` picks the prop variant:
 *   ghost (default, on cream) or secondary (over the map). Router
 *   routes pass `to="/"` and get the same control as a router Link.
 *   The old BrandHomeButton lockup is retired from the header: its
 *   "Meridian home" name and per-screen positions were the drift
 *   the review measured (Home x differing on every screen).
 * - Slots never enter the menu panel: End game and mute stay on the
 *   line at every width, so no action can be menu-trapped. The one
 *   exception is a screen that opts into `exitInMenuOnSmallScreens`
 *   (Home's Join pill): below the small breakpoint its exit renders
 *   in the panel because the row physically cannot fit it.
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
import { useState, type CSSProperties, type ReactNode } from "react";
import { HomeButton } from "./home-button.ts";
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
  /** Opt-in (fix/mobile-header-overflow): below the small breakpoint
   *  the actions row cannot fit the exit pill beside the Menu button
   *  (the row overflowed the page and pushed Menu off-screen), so
   *  the exit moves into the menu panel at phone widths. Home opts
   *  in — its exit is the Join pill. Game screens leave this off:
   *  their End game stays on the line at every width and is never
   *  menu-trapped. The move is CSS (styles.css, data-exit-menu);
   *  this prop only renders the panel copy and sets the attribute. */
  exitInMenuOnSmallScreens?: boolean;
  /** HomeButton variant: ghost on cream (default), secondary over
   *  the map. A prop, not a fork (Round 2 review, rules 2–3). */
  homeVariant?: "ghost" | "secondary";
  className?: string;
  style?: CSSProperties;
};

export type SiteHeaderProps = SiteHeaderSlots &
  ({ onHome: () => void; to?: never } | { to: "/"; onHome?: never });

export function SiteHeader({
  navMode = "inline",
  nav,
  navItems,
  stars,
  mute,
  endGame,
  exitInMenuOnSmallScreens = false,
  homeVariant = "ghost",
  className,
  style,
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
    <header
      className={cn("site-header", className)}
      style={style}
      data-nav-mode={navMode}
      data-menu-open={menuOpen ? "true" : "false"}
      data-exit-menu={exitInMenuOnSmallScreens ? "sm" : undefined}
    >
      <div className="site-header-row">
        {home.to ? (
          <HomeButton to="/" variant={homeVariant} />
        ) : (
          <HomeButton onHome={home.onHome} variant={homeVariant} />
        )}
        {navMode === "inline" && hasNav ? (
          <nav className="site-header-nav" aria-label="Site">
            {navNode}
          </nav>
        ) : null}
        <div className="site-header-actions">
          {stars}
          {mute}
          {endGame ? <span className="site-header-exit">{endGame}</span> : null}
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
          {exitInMenuOnSmallScreens && endGame ? (
            <div className="site-header-panel-exit">{endGame}</div>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
