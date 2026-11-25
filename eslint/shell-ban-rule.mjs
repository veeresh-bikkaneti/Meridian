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
 * 1. Importing a home control (HomeButton or BrandHomeButton) to
 *    hand-roll a header — screens take the home control from
 *    SiteHeader, which owns it. Since PR 529 Part 2 (owner ruling
 *    2026-11-17) the header control is BrandHomeButton: the brand
 *    lockup named exactly "Meridian home", top-left, on every
 *    adopted screen — one home control per screen, and it is the
 *    lockup. The controls themselves are NOT deleted: HomeButton
 *    ("Home") still serves end-of-flow and HUD surfaces, which are
 *    not headers. No screen imports either control to hand-roll a
 *    header. Those uses are baselined or owner-exempt below; this
 *    rule bans new imports everywhere else.
 * 2. Page-local <header> / <footer> elements outside the shared
 *    components.
 * 3. `max-w-none` in a class string — screens sit in PageColumn's two
 *    named widths; lifting the cap is what stretched the Why Learn
 *    picker (item 11).
 * 4. Page-local <nav> / <main> elements (PR 3 Step 5): the header's
 *    nav lives in SiteHeader, and a screen's <main> root is part of
 *    its shell adoption record (shell-registry.ts). Today's <main>
 *    hosts are baselined, shrink-only. Content navs (the grown-ups
 *    doors, the board's view switcher) render through ContentNav
 *    (src/components/ui/content-nav.tsx) since TD-05.3; a new file
 *    that hand-builds either element fails here.
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
              if (
                spec.type === "ImportSpecifier" &&
                (spec.imported.name === "HomeButton" || spec.imported.name === "BrandHomeButton")
              ) {
                context.report({
                  node: spec,
                  message: `Screens take the home control from SiteHeader, never by importing it. Fix: ${FIX_HEADER}. End-of-flow/HUD uses are baselined in eslint/shell-ban-baseline.json.`,
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
    "no-page-local-nav": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === "nav") {
              context.report({ node, message: `Page-local <nav>. Fix: ${FIX_HEADER} (its nav slot). Content navs are baselined in eslint/shell-ban-baseline.json.` });
            }
          },
        };
      },
    },
    "no-page-local-main": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === "main") {
              context.report({
                node,
                message:
                  "Page-local <main> in a file with no shell-registry entry. Fix: adopt PageShell/SiteHeader and register the screen in src/components/ui/shell-registry.ts. Existing hosts are baselined in eslint/shell-ban-baseline.json (shrink-only).",
              });
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

/** SiteHeader owns the only sanctioned header <nav>; ContentNav
 *  (TD-05.3) owns the only sanctioned content <nav> (the grown-ups
 *  doors, the board's view switcher). */
const NAV_OWNERS = ["src/components/ui/site-header.tsx", "src/components/ui/content-nav.tsx"];

/** The sanctioned host of the home control itself: SiteHeader
 *  (every adopted screen's header). ScreenShell, the other host,
 *  was deleted in PR 3 Step 4. */
const HOME_CONTROL_OWNERS = ["src/components/ui/site-header.tsx"];

function block(kind, ruleName, extraIgnores = []) {
  return {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", ...extraIgnores, ...(baseline[kind] ?? [])],
    plugins: { shell: shellPlugin },
    rules: { [`shell/${ruleName}`]: "error" },
  };
}

export const shellBanConfigs = [
  block("homeButtonImport", "no-home-button-import", HOME_CONTROL_OWNERS),
  block("pageLocalHeaderFooter", "no-page-local-header-footer", HEADER_FOOTER_OWNERS),
  block("pageLocalNav", "no-page-local-nav", NAV_OWNERS),
  block("pageLocalMain", "no-page-local-main"),
  block("maxWNone", "no-max-w-none"),
];
