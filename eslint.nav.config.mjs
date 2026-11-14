/**
 * `npm run lint:nav`: only the guard rules, so CI can gate on them without
 * the rest of the ESLint backlog: the home label (eslint/home-label-rule.mjs)
 * and one voice at a time (eslint/voice-channel-rule.mjs). The same blocks
 * are also part of eslint.config.mjs for editors.
 */
import tseslint from "typescript-eslint";
import { homeLabelConfig } from "./eslint/home-label-rule.mjs";
import { voiceChannelConfig } from "./eslint/voice-channel-rule.mjs";

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
];
