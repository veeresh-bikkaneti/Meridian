/**
 * HomeButton: the ONE control that takes a player back to the home page
 * (nav-home council, 2026-11-13, 3/3 approve; see
 * docs/reviews/2026-11-13-nav-home-council/).
 *
 * Before this, every screen hand-rolled its own home button and the
 * label drifted to eight names ("Editions", "← All games", "Back to
 * Home", "← Back to the game", …). Now:
 *
 * - Visible text and accessible name are exactly HOME_LABEL ("Home").
 *   The house icon is decoration (aria-hidden); there is no glyph in the
 *   string and no differing aria-label.
 * - In-app screens are early returns in GameApp, so going home is a
 *   callback: pass `onHome` and it renders <button type="button">.
 *   The real routes (/credits, /privacy, /contact) pass `to="/"` and it
 *   renders a router <Link>.
 * - 44×44 px floor (min-h-11 min-w-11) and a visible :focus-visible
 *   ring (the shared Button's `outline-none` would hide the global one).
 *
 * The classes mirror Button's ghost / secondary variants
 * (src/components/ui/button.tsx). This file is plain .ts with
 * createElement so the node unit harness can render it
 * (home-button.test.ts); it cannot import the .tsx Button.
 *
 * Do not write a home label by hand anywhere else: `npm run lint:nav`
 * fails on the old labels and names this file.
 */
import { createElement } from "react";
import { Link } from "@tanstack/react-router";
import { House } from "lucide-react";
import { cn } from "../../lib/cn.ts";

export const HOME_LABEL = "Home";
export const BRAND_HOME_LABEL = "Meridian home";

const BASE =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium " +
  "transition-[transform,background-color,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] " +
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-current";

const VARIANT = {
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  secondary: "bg-surface-2 text-fg border border-line hover:bg-surface",
  primary: "bg-fg text-bg hover:opacity-90",
} as const;

type Common = {
  /** ghost (default) on screens; secondary over the map HUD; primary at the end of a flow. */
  variant?: keyof typeof VARIANT;
  className?: string;
  /** Defaults to "home-button"; a second Home on one screen needs its own id. */
  testId?: string;
};

export type HomeButtonProps = Common &
  ({ onHome: () => void; to?: never } | { to: "/"; onHome?: never });

/**
 * BrandHomeButton: the header form of the home control — the
 * homepage's own brand lockup as a button (fix/header-logo-home,
 * Radhae 2026-11-16). The homepage header (game-app.tsx, .hv5-brand)
 * carries the compass + MERIDIAN wordmark on the left, clicking it
 * goes home, and there is no "Home" pill there; the shell screens
 * now match it.
 *
 * - Accessible name is exactly BRAND_HOME_LABEL ("Meridian home"),
 *   via aria-label, matching the homepage brand button. The lockup
 *   itself (svg + word) is visible content; the svg is aria-hidden.
 * - The svg is the homepage's exact lockup: two rings (outer
 *   r21.5 #8A6D2F w1.6, inner r16.5 #B8932F w.8 op.6), the star
 *   path, and the centre r3.4 fill #F6F1E3 — not the picker's old
 *   simplified one-ring wordmark.
 * - 44px floor (min-h-11) and the same focus-visible outline
 *   treatment as HomeButton's BASE classes.
 * - data-testid defaults to "home-button" so existing selectors
 *   for "the header home control" keep their meaning; the shell
 *   header never co-renders with another home-button testid on
 *   the same screen (home-button-end is distinct).
 * - Visual styling (mark size, word font/spacing/colour) lives in
 *   styles.css as .brand-home-button / .brand-home-mark /
 *   .brand-home-word, mirroring .home-v5 .hv5-brand values —
 *   home-v5.css is scoped to the home page and is not imported here.
 */
const BRAND_BASE =
  "brand-home-button inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-md px-3 text-sm font-medium " +
  "transition-[transform,background-color,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] " +
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-current";

export type BrandHomeButtonProps = {
  onHome: () => void;
  className?: string;
  /** Defaults to "home-button"; see the contract note above. */
  testId?: string;
};

export function BrandHomeButton({ onHome, className, testId = "home-button" }: BrandHomeButtonProps) {
  const cls = cn(BRAND_BASE, className);
  const mark = createElement(
    "svg",
    { className: "brand-home-mark", viewBox: "0 0 48 48", "aria-hidden": true, focusable: "false" },
    createElement("circle", { cx: "24", cy: "24", r: "21.5", fill: "none", stroke: "#8A6D2F", strokeWidth: "1.6" }),
    createElement("circle", {
      cx: "24",
      cy: "24",
      r: "16.5",
      fill: "none",
      stroke: "#B8932F",
      strokeWidth: ".8",
      strokeOpacity: ".6",
    }),
    createElement("path", {
      d: "M24 6 L27.2 20.8 L42 24 L27.2 27.2 L24 42 L20.8 27.2 L6 24 L20.8 20.8 Z",
      fill: "#8A6D2F",
    }),
    createElement("circle", { cx: "24", cy: "24", r: "3.4", fill: "#F6F1E3", stroke: "#8A6D2F", strokeWidth: "1.2" }),
  );
  const word = createElement("span", { className: "brand-home-word" }, "MERIDIAN");
  return createElement(
    "button",
    { type: "button", className: cls, "data-testid": testId, "aria-label": BRAND_HOME_LABEL, onClick: onHome },
    mark,
    word,
  );
}

export function HomeButton({ variant = "ghost", className, testId = "home-button", ...rest }: HomeButtonProps) {
  const cls = cn(BASE, VARIANT[variant], className);
  const icon = createElement(House, { "aria-hidden": true, focusable: "false", className: "size-4" });
  if ("to" in rest && rest.to) {
    // Link's prop types omit data-* attributes; it forwards them to the <a>.
    const linkProps = { to: rest.to, className: cls, "data-testid": testId } as { to: "/"; className: string };
    return createElement(Link, linkProps, icon, HOME_LABEL);
  }
  return createElement(
    "button",
    { type: "button", className: cls, "data-testid": testId, onClick: rest.onHome },
    icon,
    HOME_LABEL,
  );
}
