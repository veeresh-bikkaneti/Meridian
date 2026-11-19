/**
 * `npm run lint:nav`: only the guard rules, so CI can gate on them without
 * the rest of the ESLint backlog: the home label (eslint/home-label-rule.mjs),
 * one voice at a time (eslint/voice-channel-rule.mjs), and the shared-shell
 * bans (eslint/shell-ban-rule.mjs — no HomeButton-pill imports, no
 * page-local header/footer/nav/main, no max-w-none; today's violations baselined in
 * eslint/shell-ban-baseline.json), and the layering guard
 * (eslint/game-boundary-rule.mjs — src/game never imports src/subjects).
 * The home-label, voice and game-boundary blocks are also
 * part of eslint.config.mjs for editors.
 */
import tseslint from "typescript-eslint";
import { homeLabelConfig } from "./eslint/home-label-rule.mjs";
import { voiceChannelConfig } from "./eslint/voice-channel-rule.mjs";
import { shellBanConfigs } from "./eslint/shell-ban-rule.mjs";
import { gameBoundaryConfig } from "./eslint/game-boundary-rule.mjs";

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
  ...shellBanConfigs,
  // Layering: src/game never imports src/subjects (eslint/game-boundary-rule.mjs).
  gameBoundaryConfig,
];
