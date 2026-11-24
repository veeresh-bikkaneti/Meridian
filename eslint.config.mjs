import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import { homeLabelConfig } from "./eslint/home-label-rule.mjs";
import { voiceChannelConfig } from "./eslint/voice-channel-rule.mjs";

/** Flat ESLint config for the TanStack Start app-builder template. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".vercel/**",
      ".nitro/**",
      "node_modules/**",
      "src/routeTree.gen.ts",
      "raw/**",
      "wiki/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // One home label everywhere: see eslint/home-label-rule.mjs.
  homeLabelConfig,
  // One voice at a time: see eslint/voice-channel-rule.mjs.
  voiceChannelConfig,
  // Layering (src/game never imports src/subjects) folded into the
  // architecture rules in Phase 0 PR 0.2: see eslint/layer-rule.mjs,
  // gated by `npm run lint:arch` (not part of this editor config).
  // Disable rules that conflict with Prettier formatting.
  prettier,
);
