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
 * Today's violations are recorded per violation in
 * eslint/layer-baseline.json (KNOWN/STALE pattern, like
 * eslint/shell-ban-baseline.json): noUpwardImport entries are
 * "file|specifier" (the specifier exactly as written) and noRawIo
 * entries are "file|what" (the descriptor the rule reports, one
 * entry per call site, duplicates kept). The rules consume the
 * baseline as a multiset: a violation is suppressed only while an
 * entry with its exact key remains, so a NEW violation in an
 * already-baselined file still fails. scripts/layer-baseline.test.mjs
 * recomputes each baselined file's live key multiset with the
 * detectors exported below and fails on any difference — stale
 * entries (a cured call site) and unbaselined ones alike — so each
 * list can only shrink. Test files are exempt from both rules.
 *
 * Known blind spots, accepted: a same-descriptor delete+add swap
 * in one file nets out in the multiset, and identifier aliasing of
 * a covered global (const f = fetch; f()) is not tracked.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

/** The layer map, lowest first. One source of truth. */
export const LAYERS = [
  { id: "content", level: 1, owns: ["src/game/data/**", "src/subjects/**/items.ts", "src/subjects/**/answers.ts"] },
  { id: "domain", level: 2, owns: ["src/game/**/*.ts (not a screen)", "src/lib/** (pure helpers)"] },
  { id: "platform", level: 3, owns: ["src/platform/**"] },
  { id: "shared-ui", level: 4, owns: ["src/components/ui/**", "src/hooks/**"] },
  { id: "feature", level: 5, owns: ["src/components/** (rest)", "src/game/**/*.tsx", "src/subjects/**/*.tsx (non-content)", "src/board/**", "src/map/**", "src/scenes/**"] },
  { id: "shell", level: 6, owns: ["src/routes/**", "src/router.tsx"] },
];

const LEVEL = Object.fromEntries(LAYERS.map((l) => [l.id, l.level]));

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
  if (p.startsWith("src/routes/") || p === "src/router.tsx") return "shell";
  if (p.startsWith("src/components/ui/") || p.startsWith("src/hooks/")) return "shared-ui";
  if (p.startsWith("src/game/") && p.endsWith(".ts")) return "domain";
  if (p.startsWith("src/lib/") && p.endsWith(".ts")) return "domain";
  return "feature";
}

/**
 * The feature area a path belongs to (cross-area imports are
 * banned): the first folder under src/components, src/subjects or
 * src/game. Top-level files directly in one of those folders are
 * one shared area each — "components/root" (ARCHITECTURE.md),
 * "subjects/root", "game/root".
 */
export function featureArea(p) {
  const seg = p.split("/");
  if (seg[1] === "components" || seg[1] === "subjects" || seg[1] === "game") {
    return seg.length <= 3 ? `${seg[1]}/root` : `${seg[1]}/${seg[2]}`;
  }
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

// The dependency edges the rule sees: import declarations
// (side-effect or with a from clause), re-exports (export ... from)
// and dynamic import() with a string-literal argument — the shapes
// the rule's visitors below see, resolved through importViolation.
const IMPORT_SPECIFIERS = /\bimport\s+(?:[^"'()]*?\bfrom\s+)?["']([^"']+)["']/g;
const EXPORT_SPECIFIERS = /\bexport\s+(?:\*[^"'()]*?|\{[^}]*\})\s+from\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT_SPECIFIERS = /\bimport\s*\(\s*["']([^"']+)["']/g;

/**
 * Detector for the baseline test and regeneration: the
 * "file|specifier" key of every import in a file's source that
 * violates layer/no-upward-import, specifiers exactly as written.
 */
export function importViolationKeys(file, sourceText) {
  const rel = relPath(file);
  const keys = [];
  for (const re of [IMPORT_SPECIFIERS, EXPORT_SPECIFIERS]) {
    for (const m of sourceText.matchAll(re)) {
      if (importViolation(rel, m[1])) keys.push(`${rel}|${m[1]}`);
    }
  }
  for (const m of sourceText.matchAll(DYNAMIC_IMPORT_SPECIFIERS)) {
    // typeof import("...") is a type query, not a runtime edge —
    // the rule does not fire on it, so the detector must not either.
    if (/typeof\s*$/.test(sourceText.slice(Math.max(0, m.index - 16), m.index))) continue;
    if (importViolation(rel, m[1])) keys.push(`${rel}|${m[1]}`);
  }
  return keys;
}

const STORAGE = new Set(["localStorage", "sessionStorage"]);
const GLOBAL_OBJECT = new Set(["window", "globalThis"]);
const FETCH = new Set(["fetch"]);
const AUDIO = new Set(["Audio"]);

let tsApi = null;
/** The TypeScript compiler API, loaded lazily (detector use only). */
function ts() {
  if (!tsApi) tsApi = createRequire(import.meta.url)("typescript");
  return tsApi;
}

/**
 * Detector for the baseline test and regeneration: the "file|what"
 * key of every raw-I/O touch in a file's source, walked over the
 * TypeScript AST with the same shapes and exclusions the ESLint
 * rule below reports — fetch(), window.fetch(), globalThis.fetch()
 * (dotted or bracket form), localStorage / sessionStorage access
 * (bare, dotted or bracket, through a global object or not), bare
 * storage references, new Audio().
 */
export function rawIoKeys(file, sourceText) {
  const rel = relPath(file);
  if (isTest(rel) || rel.startsWith("src/platform/")) return [];
  const t = ts();
  const sf = t.createSourceFile(
    rel,
    sourceText,
    t.ScriptTarget.Latest,
    true,
    rel.endsWith(".tsx") ? t.ScriptKind.TSX : t.ScriptKind.TS,
  );
  const whats = [];
  const isId = (n, names) => t.isIdentifier(n) && names.has(n.text);
  const visit = (node, parent) => {
    if (t.isCallExpression(node)) {
      const c = node.expression;
      if (isId(c, FETCH)) whats.push("fetch()");
      else if (t.isPropertyAccessExpression(c) && isId(c.expression, GLOBAL_OBJECT) && c.name.text === "fetch") {
        whats.push(`${c.expression.text}.fetch()`);
      } else if (
        t.isElementAccessExpression(c) &&
        isId(c.expression, GLOBAL_OBJECT) &&
        t.isStringLiteral(c.argumentExpression) &&
        c.argumentExpression.text === "fetch"
      ) {
        // Computed form of the dotted call above: same descriptor.
        whats.push(`${c.expression.text}.fetch()`);
      }
    } else if (t.isNewExpression(node)) {
      if (isId(node.expression, AUDIO)) whats.push("new Audio()");
    } else if (t.isPropertyAccessExpression(node)) {
      const o = node.expression;
      if (isId(o, STORAGE)) whats.push(`${o.text} access`);
      else if (isId(o, GLOBAL_OBJECT) && STORAGE.has(node.name.text)) whats.push(`${o.text}.${node.name.text} access`);
    } else if (t.isElementAccessExpression(node)) {
      const o = node.expression;
      if (isId(o, STORAGE)) whats.push(`${o.text} access`);
      else if (isId(o, GLOBAL_OBJECT) && t.isStringLiteral(node.argumentExpression) && STORAGE.has(node.argumentExpression.text)) {
        // Computed form of the dotted access above: same descriptor.
        whats.push(`${o.text}.${node.argumentExpression.text} access`);
      }
    } else if (t.isIdentifier(node) && STORAGE.has(node.text)) {
      // A bare reference hands the storage object itself around
      // (src/game/subject-progress-store-key.ts returns it) — the
      // same raw touch as a member access. The member-access shapes
      // above already counted their object, and a property name, an
      // object-literal key or a declaration name is not a touch:
      // the same exclusions as the ESLint rule's Identifier check.
      // A member expression of either shape (dotted or bracket)
      // excludes its identifiers the same way: the object is the
      // access shapes' business, and an identifier used as the
      // bracket key (x[localStorage]) is not itself a storage touch.
      const notATouch =
        (parent && (t.isPropertyAccessExpression(parent) || t.isElementAccessExpression(parent))) ||
        (parent && t.isPropertyAssignment(parent) && parent.name === node) ||
        (parent && t.isShorthandPropertyAssignment(parent)) ||
        (parent && t.isVariableDeclaration(parent) && parent.name === node);
      if (!notATouch) whats.push(`${node.text} reference`);
    }
    node.forEachChild((child) => visit(child, node));
  };
  visit(sf, null);
  return whats.map((w) => `${rel}|${w}`);
}

function loadBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(new URL("./layer-baseline.json", import.meta.url), "utf8"));
    return { noUpwardImport: parsed.noUpwardImport ?? [], noRawIo: parsed.noRawIo ?? [] };
  } catch {
    // No baseline yet (the run that generates it): nothing is exempt.
    return { noUpwardImport: [], noRawIo: [] };
  }
}

const baseline = loadBaseline();

/** Group one baseline list into per-file key -> entry-count maps. */
function countsByFile(entries) {
  const byFile = new Map();
  for (const entry of entries) {
    const file = entry.slice(0, entry.indexOf("|"));
    if (!byFile.has(file)) byFile.set(file, new Map());
    const counts = byFile.get(file);
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }
  return byFile;
}

const UPWARD_COUNTS = countsByFile(baseline.noUpwardImport);
const RAW_IO_COUNTS = countsByFile(baseline.noRawIo);

/**
 * A consumable copy of one file's baselined key counts. A rule
 * suppresses a violation only while its key's count remains, then
 * decrements it; anything past the baselined count is reported.
 */
function allowance(byFile, file) {
  return new Map(byFile.get(file) ?? []);
}

/**
 * The name a member expression selects: dotted (a.b) or computed
 * with a string-literal key (a["b"]). Same name either way, so the
 * descriptor the raw-I/O rule reports is the same too and baseline
 * keys stay stable across the two spellings.
 */
const propName = (node) =>
  node.computed
    ? node.property.type === "Literal" && typeof node.property.value === "string"
      ? node.property.value
      : null
    : node.property.name;

const layerPlugin = {
  rules: {
    "no-upward-import": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const file = relPath(context.filename);
        if (isTest(file)) return {};
        const allowed = allowance(UPWARD_COUNTS, file);
        // One code path for every dependency edge — static imports,
        // re-exports and dynamic import() all resolve and consume
        // the baseline the same way.
        const check = (node, specifier) => {
          const message = importViolation(context.filename, specifier);
          if (!message) return;
          const key = `${file}|${specifier}`;
          const left = allowed.get(key) ?? 0;
          if (left > 0) {
            allowed.set(key, left - 1);
            return;
          }
          context.report({ node, message });
        };
        const fromSource = (node) => {
          if (node.source) check(node, node.source.value);
        };
        return {
          ImportDeclaration: fromSource,
          ExportAllDeclaration: fromSource,
          ExportNamedDeclaration: fromSource,
          ImportExpression(node) {
            if (node.source.type === "Literal" && typeof node.source.value === "string") {
              check(node, node.source.value);
            }
          },
          CallExpression(node) {
            // Parsers that shape import("...") as a call on an
            // Import callee land here instead of ImportExpression.
            const arg = node.arguments[0];
            if (node.callee.type === "Import" && arg?.type === "Literal" && typeof arg.value === "string") {
              check(node, arg.value);
            }
          },
        };
      },
    },
    "no-raw-io": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const file = relPath(context.filename);
        if (isTest(file) || file.startsWith("src/platform/")) return {};
        const allowed = allowance(RAW_IO_COUNTS, file);
        const report = (node, what) => {
          const key = `${file}|${what}`;
          const left = allowed.get(key) ?? 0;
          if (left > 0) {
            allowed.set(key, left - 1);
            return;
          }
          context.report({
            node,
            message: `Raw ${what} outside src/platform — browser I/O goes through a platform port (src/platform/**). Existing violations are baselined in eslint/layer-baseline.json.`,
          });
        };
        return {
          CallExpression(node) {
            const c = node.callee;
            if (c.type === "Identifier" && c.name === "fetch") report(node, "fetch()");
            else if (
              c.type === "MemberExpression" &&
              c.object.type === "Identifier" &&
              (c.object.name === "window" || c.object.name === "globalThis") &&
              propName(c) === "fetch"
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
              (propName(node) === "localStorage" || propName(node) === "sessionStorage")
            ) {
              report(node, `${o.name}.${propName(node)} access`);
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

export const layerArchConfigs = [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    plugins: { layer: layerPlugin },
    rules: { "layer/no-upward-import": "error" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    plugins: { platform: layerPlugin },
    rules: { "platform/no-raw-io": "error" },
  },
];
