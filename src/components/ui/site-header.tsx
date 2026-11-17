/**
 * SiteHeader: the ONE header for every screen (Stream S contract,
 * fix/ui-shared-shell). The shared home control left, an optional
 * back slot, the screen's nav, then the action slots in a fixed
 * order — status, mute, end game — so a child never relearns where
 * things live between screens.
 *
 * - Home control: HomeButton from home-button.ts (Round 2 review,
 *   rule 2) — the one control named exactly "Home", top-left, ≥44px,
 *   no arrow in its name. `homeVariant` picks the prop variant:
 *   ghost (default, on cream) or secondary (over the map). Router
 *   routes pass `to="/"` and get the same control as a router Link.
 *   The old BrandHomeButton lockup is retired from the header: its
 *   "Meridian home" name and per-screen positions were the drift
 *   the review measured (Home x differing on every screen).
 * - `variant` is the surface the header sits on, a prop not a fork
 *   (PR 3 Step 2): "cream" (default) is the page header; "map" is
 *   the over-map chrome (game-chrome surface in styles.css) and
 *   defaults the home control to its secondary variant.
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
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HomeButton } from "./home-button.ts";
import { cn } from "@/lib/cn";

export type SiteNavItem = {
  label: string;
  testId?: string;
  ariaLabel?: string;
  /** Decorative glyph rendered before the label (aria-hidden). */
  icon?: ReactNode;
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
   *  page gutter is the column's. */
  sticky?: boolean;
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
  back,
  status,
  mute,
  endGame,
  exitInMenuOnSmallScreens = false,
  variant = "cream",
  sticky = false,
  homeVariant,
  className,
  style,
  ...home
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const resolvedHomeVariant = homeVariant ?? (variant === "map" ? "secondary" : "ghost");
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
      className={cn("site-header", className)}
      style={style}
      data-variant={variant}
      data-sticky={sticky ? "true" : undefined}
      data-nav-mode={navMode}
      data-menu-open={menuOpen ? "true" : "false"}
      data-exit-menu={exitInMenuOnSmallScreens ? "sm" : undefined}
    >
      <div className="site-header-row">
        {home.to ? (
          <HomeButton to="/" variant={resolvedHomeVariant} />
        ) : (
          <HomeButton onHome={home.onHome} variant={resolvedHomeVariant} />
        )}
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
