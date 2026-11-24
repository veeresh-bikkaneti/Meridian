import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homeLabelConfig } from "./eslint/home-label-rule.mjs";
import { voiceChannelConfig } from "./eslint/voice-channel-rule.mjs";
import { layerArchConfigs } from "./eslint/layer-rule.mjs";
import { shellBanConfigs } from "./eslint/shell-ban-rule.mjs";
import { GAUGE_RULES, gaugeCountsFrom, hardAtZero } from "./eslint/hard-at-zero.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)));
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

/**
 * One hard-at-zero rule for every architecture gauge. A baseline
 * count of 0 is an error (CI fails). Any count still above zero
 * only warns (CI does not fail). Do not set a gauge's severity by
 * hand: when that baseline reaches 0, this map flips it.
 */
export const gaugeCounts = gaugeCountsFrom(
  readJson("eslint/layer-baseline.json"),
  readJson("eslint/shell-ban-baseline.json"),
);

export const gaugeSeverity = Object.fromEntries(
  Object.entries(GAUGE_RULES).flatMap(([gauge, ruleIds]) =>
    ruleIds.map((ruleId) => [ruleId, hardAtZero(gaugeCounts[gauge])]),
  ),
);

/** Replace a gauge rule's severity. Other rules are left untouched. */
export function applyHardAtZero(configs, severities = gaugeSeverity) {
  return configs.map((cfg) => {
    if (!cfg.rules) return cfg;
    let rules = null;
    for (const ruleId of Object.keys(cfg.rules)) {
      if (!(ruleId in severities)) continue;
      if (!rules) rules = { ...cfg.rules };
      const current = rules[ruleId];
      rules[ruleId] = Array.isArray(current) ? [severities[ruleId], ...current.slice(1)] : severities[ruleId];
    }
    return rules ? { ...cfg, rules } : cfg;
  });
}

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
  // Architecture gauges. Severity is gaugeSeverity above (hard at
  // zero), not a hand-set string per rule. See eslint/layer-rule.mjs
  // and eslint/shell-ban-rule.mjs. CI runs the same map via
  // `npm run lint:arch` and `npm run lint:nav`.
  ...applyHardAtZero(layerArchConfigs),
  ...applyHardAtZero(shellBanConfigs),
  // Disable rules that conflict with Prettier formatting.
  prettier,
);
