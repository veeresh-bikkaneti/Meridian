/**
 * `npm run lint:arch`: only the architecture guardrails, so CI can gate
 * on them without the rest of the ESLint backlog: imports point down
 * only (layer/no-upward-import, which also carries the folded-in
 * src/game -> src/subjects ban) and no raw browser I/O outside the
 * platform ports (platform/no-raw-io). See eslint/layer-rule.mjs;
 * today's violations are baselined in eslint/layer-baseline.json
 * (shrink-only).
 *
 * Severity is the one hard-at-zero map in eslint.config.mjs. A gauge
 * at baseline 0 is an error. A gauge still above zero only warns.
 * This file does not set either gauge by hand.
 */
import tseslint from "typescript-eslint";
import { applyHardAtZero, gaugeSeverity } from "./eslint.config.mjs";
import { layerArchConfigs } from "./eslint/layer-rule.mjs";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  ...applyHardAtZero(layerArchConfigs, gaugeSeverity),
];
