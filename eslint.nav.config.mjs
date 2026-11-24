/**
 * `npm run lint:nav`: only the guard rules, so CI can gate on them without
 * the rest of the ESLint backlog: the home label (eslint/home-label-rule.mjs),
 * one voice at a time (eslint/voice-channel-rule.mjs), and the shared-shell
 * bans (eslint/shell-ban-rule.mjs — no HomeButton-pill imports, no
 * page-local header/footer/nav/main, no max-w-none; today's violations baselined in
 * eslint/shell-ban-baseline.json). The layering guard that used to
 * live here (src/game never imports src/subjects) folded into the
 * architecture rules in Phase 0 PR 0.2: layer/no-upward-import in
 * eslint/layer-rule.mjs, gated by `npm run lint:arch`.
 * The home-label and voice blocks are also
 * part of eslint.config.mjs for editors.
 *
 * Shell-ban severity is the one hard-at-zero map in eslint.config.mjs
 * (one gauge for every ban). This file does not set it by hand.
 */
import tseslint from "typescript-eslint";
import { homeLabelConfig } from "./eslint/home-label-rule.mjs";
import { voiceChannelConfig } from "./eslint/voice-channel-rule.mjs";
import { shellBanConfigs } from "./eslint/shell-ban-rule.mjs";
import { applyHardAtZero, gaugeSeverity } from "./eslint.config.mjs";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  homeLabelConfig,
  voiceChannelConfig,
  ...applyHardAtZero(shellBanConfigs, gaugeSeverity),
];
