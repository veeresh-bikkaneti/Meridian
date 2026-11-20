/**
 * Architecture guardrails (Phase 0, PR 0.2; `npm run lint:arch`).
 *
 * Two bans, one local plugin (the shell-ban design: flat-config
 * blocks that set the same rule name shadow each other, so the bans
 * are rules of one plugin, not repeated core-rule blocks):
 *
 * 1. layer/no-upward-import — imports point down only. LAYERS below
 *    is the one source of truth for the layer map (ARCHITECTURE.md
 *    links here). A file may import its own layer or a lower one,
 *    never a higher one; a feature screen may not import another
 *    feature area at all (shared code moves down a layer instead).
 *    The PR 533 ban (src/game never imports src/subjects) folds in
 *    here and the old eslint/game-boundary-rule.mjs is deleted: it
 *    falls out of the map, because src/subjects' non-content code
 *    sits in the feature layer, above game's domain layer — so a
 *    game -> subjects import is an upward import, while the legal
 *    reverse (subjects depending on game) points down.
 * 2. platform/no-raw-io — fetch, Web Storage and Audio are touched
 *    only through the platform ports (src/platform/**, Phase 1).
 *    Everywhere else in src, a raw fetch( / window.fetch( /
 *    localStorage / sessionStorage access / new Audio( fails.
 *
 * Files that violate today are recorded in
 * eslint/layer-baseline.json (KNOWN/STALE pattern, like
 * eslint/shell-ban-baseline.json): each rule's config block ignores
 * exactly its baselined files, so the lint passes on today's main
 * and each list can only shrink. scripts/layer-baseline.test.mjs
 * fails on a stale entry — a baselined file that no longer
 * violates — so cured files leave the baseline in the same PR that
 * cures them. Test files are exempt from both rules.
 */
import { existsSync, readFileSync } from "node:fs";

/** The layer map, lowest first. One source of truth. */
export const LAYERS = [
  { id: "content", level: 0, owns: ["src/game/data/**", "src/subjects/**/items.ts", "src/subjects/**/answers.ts"] },
  { id: "domain", level: 1, owns: ["src/game/**/*.ts (non-screen)", "src/lib/**/*.ts (pure helpers)"] },
  { id: "platform", level: 2, owns: ["src/platform/**"] },
  { id: "shared-ui", level: 3, owns: ["src/components/ui/**", "src/hooks/**"] },
  { id: "feature", level: 4, owns: ["src/components/** (rest)", "src/game/**/*.tsx", "src/subjects/** (non-content)", "src/board/**", "src/map/**", "src/scenes/**"] },
  { id: "shell", level: 5, owns: ["src/routes/**", "src/router.tsx", "src/components/ui/ shell parts (site-header, site-footer, page-column, page-shell, shell-registry)"] },
];

const LEVEL = Object.fromEntries(LAYERS.map((l) => [l.id, l.level]));

/** Shell parts living inside the shared-UI folder (layer 5, not 3). */
const SHELL_UI_PARTS = new Set(["site-header", "site-footer", "page-column", "page-shell", "shell-registry"]);

/** Server entry points: out of scope until Phase 5. */
const OUT_OF_SCOPE = new Set(["src/server.ts", "src/start.ts", "src/routeTree.gen.ts"]);

const baseName = (p) => p.split("/").pop().replace(/\.(ts|tsx|mts|cts)$/, "");
const isTest = (p) => /\.test\.(ts|tsx)$/.test(p);

/** Repo-relative POSIX path for an ESLint filename, or the raw value. */
export function relPath(filename) {
  const p = String(filename).replace(/\\/g, "/");
  const i = p.indexOf("src/");
  return i >= 0 ? p.slice(i) : p;
}

/** The layer a repo-relative path sits in, or null when out of scope. */
export function classify(p) {
  if (!p.startsWith("src/") || OUT_OF_SCOPE.has(p) || isTest(p)) return null;
  if (p.startsWith("src/game/data/")) return "content";
  if (p.startsWith("src/subjects/") && (baseName(p) === "items" || baseName(p) === "answers")) return "content";
  if (p.startsWith("src/platform/")) return "platform";
  if (p.startsWith("src/routes/") || p === "src/router.tsx" || p === "src/router.ts") return "shell";
  if (p.startsWith("src/components/ui/") && SHELL_UI_PARTS.has(baseName(p))) return "shell";
  if (p.startsWith("src/components/ui/") || p.startsWith("src/hooks/")) return "shared-ui";
  if (p.startsWith("src/game/") && p.endsWith(".ts")) return "domain";
  if (p.startsWith("src/lib/") && p.endsWith(".ts")) return "domain";
  return "feature";
}

/** The feature area a path belongs to (cross-area imports are banned). */
export function featureArea(p) {
  const seg = p.split("/");
  if (seg[1] === "components") return `components/${seg[2] ?? ""}`;
  if (seg[1] === "subjects") return `subjects/${seg[2] ?? ""}`;
  return seg[1] ?? "src";
}

function resolveSpecifier(importer, source) {
  if (source.startsWith("@/")) return `src/${source.slice(2)}`;
  if (!source.startsWith(".")) return null; // package import: ignored
  const parts = importer.split("/").slice(0, -1);
  for (const s of source.split("/")) {
    if (s === "..") parts.pop();
    else if (s !== "." && s !== "") parts.push(s);
  }
  return parts.join("/");
}

/** Classify a resolved target, probing the tree for extensionless imports. */
function classifyTarget(target) {
  const direct = classify(target);
  if (/\.(ts|tsx)$/.test(target) || direct !== "feature") return direct;
  // Extensionless: src/game and src/lib split domain (.ts) from
  // feature (.tsx), so ask the tree which file actually exists.
  for (const cand of [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`]) {
    if (existsSync(cand)) return classify(cand);
  }
  return direct;
}

/**
 * The violation message for one import, or null when the import is
 * legal. Shared by the ESLint rule and the baseline staleness test,
 * so the two can never disagree about what a violation is.
 */
export function importViolation(importerFile, source) {
  const importer = relPath(importerFile);
  const target = resolveSpecifier(importer, source.split(/[?#]/)[0]);
  if (!target || !target.startsWith("src/")) return null;
  const from = classify(importer);
  const to = classifyTarget(target);
  if (!from || !to) return null;
  if (LEVEL[to] > LEVEL[from]) {
    if (importer.startsWith("src/game/") && target.startsWith("src/subjects/")) {
      return "src/game must not import from src/subjects — subjects depend on game, never the reverse. Move the shared code under src/game (see src/game/subject-progress-store-key.ts).";
    }
    return `Upward import: ${from} (layer ${LEVEL[from]}) must not import ${to} (layer ${LEVEL[to]}). Imports point down only — move the shared code down a layer (see ARCHITECTURE.md).`;
  }
  if (from === "feature" && to === "feature" && featureArea(importer) !== featureArea(target)) {
    return `Feature screen importing another feature area (${featureArea(importer)} -> ${featureArea(target)}). Shared code moves down a layer instead (see ARCHITECTURE.md).`;
  }
  return null;
}

const layerPlugin = {
  rules: {
    "no-upward-import": {
      meta: { type: "problem", schema: [] },
      create(context) {
        if (isTest(relPath(context.filename))) return {};
        return {
          ImportDeclaration(node) {
            const message = importViolation(context.filename, node.source.value);
            if (message) context.report({ node, message });
          },
        };
      },
    },
    "no-raw-io": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const file = relPath(context.filename);
        if (isTest(file) || file.startsWith("src/platform/")) return {};
        const report = (node, what) =>
          context.report({
            node,
            message: `Raw ${what} outside src/platform — browser I/O goes through a platform port (src/platform/**). Existing violations are baselined in eslint/layer-baseline.json.`,
          });
        return {
          CallExpression(node) {
            const c = node.callee;
            if (c.type === "Identifier" && c.name === "fetch") report(node, "fetch()");
            else if (
              c.type === "MemberExpression" &&
              c.object.type === "Identifier" &&
              (c.object.name === "window" || c.object.name === "globalThis") &&
              c.property.name === "fetch"
            ) {
              report(node, `${c.object.name}.fetch()`);
            }
          },
          MemberExpression(node) {
            const o = node.object;
            if (o.type === "Identifier" && (o.name === "localStorage" || o.name === "sessionStorage")) {
              report(node, `${o.name} access`);
            } else if (
              o.type === "Identifier" &&
              (o.name === "window" || o.name === "globalThis") &&
              (node.property.name === "localStorage" || node.property.name === "sessionStorage")
            ) {
              report(node, `${o.name}.${node.property.name} access`);
            }
          },
          Identifier(node) {
            // A bare reference hands the storage object itself around
            // (src/game/subject-progress-store-key.ts returns it) —
            // the same raw touch as a member access. Member uses are
            // the MemberExpression check's, above, so skip those.
            if (node.name !== "localStorage" && node.name !== "sessionStorage") return;
            const p = node.parent;
            if (!p || p.type === "MemberExpression") return;
            if (p.type === "Property" && p.key === node && !p.computed) return;
            if (p.type === "VariableDeclarator" && p.id === node) return;
            report(node, `${node.name} reference`);
          },
          NewExpression(node) {
            if (node.callee.type === "Identifier" && node.callee.name === "Audio") report(node, "new Audio()");
          },
        };
      },
    },
  },
};

let baseline = { noUpwardImport: [], noRawIo: [] };
try {
  baseline = { ...baseline, ...JSON.parse(readFileSync(new URL("./layer-baseline.json", import.meta.url), "utf8")) };
} catch {
  // No baseline yet (the run that generates it): nothing is exempt.
}

export const layerArchConfigs = [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx", ...(baseline.noUpwardImport ?? [])],
    plugins: { layer: layerPlugin },
    rules: { "layer/no-upward-import": "error" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx", ...(baseline.noRawIo ?? [])],
    plugins: { platform: layerPlugin },
    rules: { "platform/no-raw-io": "error" },
  },
];
