/**
 * SiteHeader: the ONE header for every screen (Stream S contract,
 * fix/ui-shared-shell). The shared home control left, an optional
 * back slot, the screen's nav, then the action slots in a fixed
 * order — status, mute, end game — so a child never relearns where
 * things live between screens.
 *
 * - Home control: BrandHomeButton from home-button.ts — the brand
 *   lockup (compass + MERIDIAN word), named exactly "Meridian home",
 *   top-left, ≥44px (owner ruling 2026-11-17, PR 529 Part 2 / N1;
 *   this supersedes the Round 2 "Home" pill in the header).
 *   In-app screens pass `onHome` and get the lockup as a button;
 *   router routes pass `to="/"` and get the same lockup as a real
 *   router Link to "/". HomeButton (the "Home" pill) never renders
 *   in a header; it still serves end-of-flow and HUD surfaces.
 * - `variant` is the surface the header sits on, a prop not a fork
 *   (PR 3 Step 2): "cream" (default) is the page header; "map" is
 *   the over-map chrome (game-chrome surface in styles.css).
 * - Slots never enter the menu panel: End game and mute stay on the
 *   line at every width, so no action can be menu-trapped. The one
 *   exception is a screen that opts into `exitInMenuOnSmallScreens`
 *   (Home's Join pill): below the small breakpoint its exit renders
 *   in the panel because the row physically cannot fit it.
 * - `status` and `mute` are required-but-nullable on purpose (UX
 *   seat): a screen that earns no status readout or plays no audio
 *   passes null and the omission is a visible choice in its
 *   adoption diff, not a forgotten optional prop. Status renders as
 *   a readout the host builds (GeoDetective puts "Case #N" there);
 *   this header only places it. (The slot was named `stars` until
 *   PR 3 Step 2 — it carries any status readout, not just stars.)
 * - Nav items come in two kinds from one data shape: action items
 *   (`onClick` buttons) and link items (`to` router links), either
 *   with an optional decorative `icon` before the label. A screen
 *   whose nav mixes both with bespoke markup still uses the `nav`
 *   node slot (Home does) with the shared .site-header-nav-link
 *   class — one line geometry for buttons and links alike.
 * - Every control keeps a ≥44px hit box, links included; the compact
 *   band (1024–1279px) shrinks type, never the hit box.
 * - Visual values live in styles.css as .site-header … (shell
 *   dialect: theme + atlas tokens only — the header never reads the
 *   home-scoped --hv5-* tokens).
 */
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandHomeButton } from "./home-button.ts";
import { cn } from "@/lib/cn";

export type SiteNavItem = {
  label: string;
  testId?: string;
  ariaLabel?: string;
  /** Decorative glyph rendered before the label (aria-hidden). */
  icon?: ReactNode;
  /** Home-section id this item jumps to (N1 derived highlight): the
   *  item renders data-nav-section and is marked current —
   *  aria-current="location" + the filled-tile style — while the
   *  location hash names this section. */
  sectionId?: string;
} & ({ onClick: () => void; to?: never } | { to: string; onClick?: never });

type SiteHeaderSlots = {
  /** "inline" (default): nav on the line from 1024px, behind Menu below
   *  that. "menu": nav behind Menu at every width — for narrow
   *  read-column screens that can never fit the full nav. */
  navMode?: "inline" | "menu";
  /** Explicit nav node; overrides navItems. */
  nav?: ReactNode;
  /** The default nav link row, built from data when `nav` is absent. */
  navItems?: readonly SiteNavItem[];
  /** Optional back control, placed between Home and the nav. The
   *  host builds it (its label and behaviour are the screen's); the
   *  header only reserves the slot so back lives in one place. */
  back?: ReactNode;
  /** Status readout where the screen has one (GeoDetective: "Case
   *  #N"; star counts elsewhere), null where it does not. */
  status: ReactNode | null;
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
  /** The surface the header sits on: "cream" (default) or "map"
   *  (over-map chrome). In the map variant the home control defaults
   *  to its secondary variant unless homeVariant says otherwise. */
  variant?: "cream" | "map";
  /** Sticky bar (PR 3 Step 3.11): the header pins to the top of the
   *  viewport while the screen scrolls under it, on the shell's own
   *  treatment (styles.css, data-sticky) — GeoDetective's case screen
   *  is the user; it previously hand-rolled this with a className
   *  override (screen-home-bar + a negative-margin bleed). The shell
   *  carries the layout now: the row's geometry is the header's, the
   *  page gutter is the column's. Since Part 2 (N1) every shell
   *  header is sticky (the frozen bar); this prop now only adds the
   *  data-sticky bar background treatment. */
  sticky?: boolean;
  className?: string;
  style?: CSSProperties;
};

export type SiteHeaderProps = SiteHeaderSlots &
  ({ onHome: () => void; to?: never } | { to: "/"; onHome?: never });

export function SiteHeader({
  navMode = "inline",
  nav,
  navItems,
  back,
  status,
  mute,
  endGame,
  exitInMenuOnSmallScreens = false,
  variant = "cream",
  sticky = false,
  className,
  style,
  ...home
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  /* Derived current-section highlight (N1, as staged in Phase A):
   * the host writes the section id into the hash with replaceState
   * (GameApp's scrollTo), which fires no event — so this mirrors the
   * hash onto the nav items that carry data-nav-section on mount, on
   * hashchange, and after any click (a nav click is what changes
   * it). ~0 JS: no scroll-spy, no router change. Exactly the item
   * whose section matches carries aria-current="location" and the
   * data-current hook the filled-tile style keys on. */
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => {
      const root = headerRef.current;
      if (!root || !window.location) return;
      const hash = window.location.hash.replace(/^#/, "");
      root.querySelectorAll<HTMLElement>("[data-nav-section]").forEach((el) => {
        const on = hash !== "" && el.dataset.navSection === hash;
        el.dataset.current = on ? "true" : "false";
        if (on) el.setAttribute("aria-current", "location");
        else el.removeAttribute("aria-current");
      });
    };
    update();
    const onClick = () => requestAnimationFrame(update);
    window.addEventListener("hashchange", update);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("click", onClick);
    };
  }, []);
  /* The menu panel closes after a section pick (N1): a click on a
   * nav item inside the panel is a pick, so the panel closes. The
   * inline nav row is not inside the panel and is untouched. */
  const onPanelClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(".site-header-nav-link")) setMenuOpen(false);
  };
  const navNode: ReactNode =
    nav ??
    (navItems ? (
      <>
        {navItems.map((item) => {
          const inner = (
            <>
              {item.icon ? (
                <span className="site-header-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </>
          );
          return item.to ? (
            <Link
              key={item.label}
              to={item.to}
              className="site-header-nav-link"
              data-testid={item.testId}
              aria-label={item.ariaLabel}
              data-nav-section={item.sectionId}
            >
              {inner}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              className="site-header-nav-link"
              onClick={item.onClick}
              data-testid={item.testId}
              aria-label={item.ariaLabel}
              data-nav-section={item.sectionId}
            >
              {inner}
            </button>
          );
        })}
      </>
    ) : null);
  const hasNav = navNode !== null && navNode !== undefined;

  return (
    <header
      ref={headerRef}
      className={cn("site-header", className)}
      style={style}
      data-variant={variant}
      data-sticky={sticky ? "true" : undefined}
      data-nav-mode={navMode}
      data-menu-open={menuOpen ? "true" : "false"}
      data-exit-menu={exitInMenuOnSmallScreens ? "sm" : undefined}
    >
      <div className="site-header-row">
        {home.to ? <BrandHomeButton to="/" /> : <BrandHomeButton onHome={home.onHome} />}
        {back}
        {navMode === "inline" && hasNav ? (
          <nav className="site-header-nav" aria-label="Site">
            {navNode}
          </nav>
        ) : null}
        <div className="site-header-actions">
          {status}
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
        <nav className="site-header-nav site-header-panel" aria-label="Site" data-open="true" onClick={onPanelClick}>
          {navNode}
          {exitInMenuOnSmallScreens && endGame ? (
            <div className="site-header-panel-exit">{endGame}</div>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
