/**
 * `npm run lint:nav`: only the home-label rule (eslint/home-label-rule.mjs),
 * so CI can gate on it without the rest of the ESLint backlog. The same
 * block is also part of eslint.config.mjs for editors.
 */
import tseslint from "typescript-eslint";
import { homeLabelConfig } from "./eslint/home-label-rule.mjs";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  homeLabelConfig,
];
