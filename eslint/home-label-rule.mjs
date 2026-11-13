/**
 * Home-label lint (nav-home council, 2026-11-13; `AGENTS.md` rule table).
 *
 * Mistake class M1 (docs/reviews/2026-11-13-nav-home-council/pack.md §5):
 * each new screen copied the nearest example and hand-rolled its own home
 * button, so the label drifted to eight names. The architecture fix is the
 * one HomeButton (src/components/ui/home-button.ts); this rule stops the
 * copy-the-nearest-example path from coming back. It bans the old home
 * labels as JSX text or string literals anywhere in src/.
 *
 * Not banned (they are not home): "Back" (one step back), "Exit review"
 * (ends a review), "Close" (dismisses a sheet or player).
 */
const FIX = "use <HomeButton> (HOME_LABEL = \"Home\") from src/components/ui/home-button.ts";

const EXACT = "^\\s*(←\\s*)?(Editions|← Back)\\s*$";
const ANYWHERE = "(Back to editions|Back to Home|All games|Back to the game)";

export const homeLabelSelectors = [
  { selector: `JSXText[value=/${EXACT}/]`, message: `Hand-written home label. Fix: ${FIX}.` },
  { selector: `JSXText[value=/${ANYWHERE}/]`, message: `Hand-written home label. Fix: ${FIX}.` },
  { selector: `Literal[value=/${EXACT}/]`, message: `Hand-written home label string. Fix: ${FIX}.` },
  { selector: `Literal[value=/^\\s*(←\\s*)?${ANYWHERE}\\s*$/]`, message: `Hand-written home label string. Fix: ${FIX}.` },
];

/** Flat-config block: applies to app source, not to unit tests that assert the old names are gone. */
export const homeLabelConfig = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/**/*.test.ts"],
  rules: { "no-restricted-syntax": ["error", ...homeLabelSelectors] },
};
