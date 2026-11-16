/**
 * Shared-shell lint (Stream S, fix/ui-shared-shell; `npm run lint:nav`).
 *
 * The mistake class is the same one the home-label rule guards: each
 * new screen copies the nearest example, so headers, footers, width
 * caps and the home control drift apart again. The architecture fix
 * is the shared shell (src/components/ui/site-header.tsx,
 * site-footer.tsx, page-column.tsx); these bans stop the copy path
 * from coming back:
 *
 * 1. Importing the old HomeButton pill — new screens use SiteHeader
 *    (BrandHomeButton lockup). HomeButton itself is NOT deleted yet:
 *    it still serves end-of-flow and HUD surfaces until their streams
 *    adopt the shell. This rule bans new imports.
 * 2. Page-local <header> / <footer> elements outside the shared
 *    components.
 * 3. `max-w-none` in a class string — screens sit in PageColumn's two
 *    named widths; lifting the cap is what stretched the Why Learn
 *    picker (item 11).
 *
 * The bans are three rules of one local plugin, not three
 * no-restricted-syntax blocks: flat-config blocks that set the same
 * rule name shadow each other (last match wins), which would silently
 * switch two of the three bans off.
 *
 * Files that violate today are recorded in
 * eslint/shell-ban-baseline.json (KNOWN/STALE pattern, like
 * scripts/lint-subject-leads-baseline.json): each ban skips exactly
 * its baselined files, so the lint passes on today's main and each
 * list can only shrink. shared-shell.test.ts fails on a stale entry —
 * a baselined file that no longer violates — so cured files leave the
 * baseline in the same PR that cures them.
 */
import { readFileSync } from "node:fs";

const baseline = JSON.parse(readFileSync(new URL("./shell-ban-baseline.json", import.meta.url), "utf8"));

const FIX_HEADER = "use <SiteHeader> from src/components/ui/site-header.tsx";
const FIX_FOOTER = "use <SiteFooter> from src/components/ui/site-footer.tsx";
const FIX_COLUMN = "sit in <PageColumn> (src/components/ui/page-column.tsx), width wide or read";

const shellPlugin = {
  rules: {
    "no-home-button-import": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          ImportDeclaration(node) {
            if (!/home-button/.test(node.source.value)) return;
            for (const spec of node.specifiers) {
              if (spec.type === "ImportSpecifier" && spec.imported.name === "HomeButton") {
                context.report({
                  node: spec,
                  message: `The HomeButton pill is retired for screens. Fix: ${FIX_HEADER} (BrandHomeButton lockup). End-of-flow/HUD uses are baselined in eslint/shell-ban-baseline.json.`,
                });
              }
            }
          },
        };
      },
    },
    "no-page-local-header-footer": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === "header") {
              context.report({ node, message: `Page-local <header>. Fix: ${FIX_HEADER}.` });
            } else if (node.name.name === "footer") {
              context.report({ node, message: `Page-local <footer>. Fix: ${FIX_FOOTER}.` });
            }
          },
        };
      },
    },
    "no-max-w-none": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const check = (node, value) => {
          if (typeof value === "string" && value.includes("max-w-none")) {
            context.report({ node, message: `max-w-none lifts the page width cap. Fix: ${FIX_COLUMN}.` });
          }
        };
        return {
          Literal(node) {
            check(node, node.value);
          },
          TemplateElement(node) {
            check(node, node.value.raw);
          },
          JSXText(node) {
            check(node, node.value);
          },
        };
      },
    },
  },
};

/** The shared components own the only sanctioned <header>/<footer>. */
const HEADER_FOOTER_OWNERS = ["src/components/ui/site-header.tsx", "src/components/ui/site-footer.tsx"];

function block(kind, ruleName, extraIgnores = []) {
  return {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", ...extraIgnores, ...(baseline[kind] ?? [])],
    plugins: { shell: shellPlugin },
    rules: { [`shell/${ruleName}`]: "error" },
  };
}

export const shellBanConfigs = [
  block("homeButtonImport", "no-home-button-import"),
  block("pageLocalHeaderFooter", "no-page-local-header-footer", HEADER_FOOTER_OWNERS),
  block("maxWNone", "no-max-w-none"),
];
