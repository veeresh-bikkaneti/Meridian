/**
 * EndOfFlowHome: the sanctioned end-of-flow / HUD Home control (TD-05.4).
 *
 * Screens no longer import HomeButton from home-button to hand-roll an
 * end-of-flow or HUD Home — that import is what the shared-shell
 * no-home-button-import ban flags, and this file is the second owner in
 * the rule (SiteHeader owns the header control, BrandHomeButton). The
 * end-of-flow and HUD surfaces it serves are not headers: the loop
 * reveal CTA block, the subject win/lose result card, and game-app's
 * menu, review/challenge completion and map HUD.
 *
 * Plain .ts with createElement for the same reason as home-button.ts:
 * the node unit harness renders it (end-of-flow-home.test.ts), and it
 * cannot import a .tsx component.
 *
 * It forwards exactly the props a screen already passed to HomeButton
 * (onHome, variant, className, testId), so the rendered HTML is
 * byte-identical to rendering HomeButton there — no visual change, no
 * behavior change, same testids. It does NOT re-export HomeButton or
 * BrandHomeButton: a screen that wants one of those is a new violation,
 * not something this file launders.
 */
import { createElement } from "react";
import { HomeButton, type HomeButtonProps } from "./home-button.ts";

export type EndOfFlowHomeProps = Pick<HomeButtonProps, "variant" | "className" | "testId"> & {
  onHome: () => void;
};

export function EndOfFlowHome(props: EndOfFlowHomeProps) {
  return createElement(HomeButton, props);
}
