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

export function HomeButton({ variant = "ghost", className, testId = "home-button", ...rest }: HomeButtonProps) {
  const cls = cn(BASE, VARIANT[variant], className);
  const icon = createElement(House, { "aria-hidden": true, focusable: "false", className: "size-4" });
  if ("to" in rest && rest.to) {
    return createElement(Link, { to: rest.to, className: cls, "data-testid": testId }, icon, HOME_LABEL);
  }
  return createElement(
    "button",
    { type: "button", className: cls, "data-testid": testId, onClick: rest.onHome },
    icon,
    HOME_LABEL,
  );
}
