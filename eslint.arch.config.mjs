/**
 * `npm run lint:arch`: only the architecture guardrails, so CI can gate
 * on them without the rest of the ESLint backlog: imports point down
 * only (layer/no-upward-import, which also carries the folded-in
 * src/game -> src/subjects ban) and no raw browser I/O outside the
 * platform ports (platform/no-raw-io). See eslint/layer-rule.mjs;
 * today's violations are baselined in eslint/layer-baseline.json
 * (shrink-only).
 */
import tseslint from "typescript-eslint";
import { layerArchConfigs } from "./eslint/layer-rule.mjs";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  ...layerArchConfigs,
];
