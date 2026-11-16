/**
 * Shared shell (fix/ui-shared-shell): SiteHeader, SiteFooter,
 * PageColumn, Pill, Badge, ErrorScreen, FirstVisitQueue.
 *
 * The node harness cannot load .tsx, so the components are bundled
 * with esbuild and rendered with react-dom/server (the clue-scene
 * render test's pattern). Assertions pin the contract: slot order,
 * slots never in the menu panel, the 44px hit-box floor, the Badge
 * contrast ratios computed from the actual styles.css token values,
 * and the lint baseline's staleness (a cured file must leave
 * eslint/shell-ban-baseline.json).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

type ShellModule = {
  SiteHeader: (props: never) => ReactNode;
  SiteFooter: (props: never) => ReactNode;
  PageColumn: (props: never) => ReactNode;
  Pill: (props: never) => ReactNode;
  Badge: (props: never) => ReactNode;
  ErrorScreen: (props: never) => ReactNode;
  FirstVisitQueue: (props: never) => ReactNode;
  createElement: typeof createElement;
  renderToStaticMarkup: typeof renderToStaticMarkup;
};

let shellPromise: Promise<ShellModule> | undefined;
function loadShell(): Promise<ShellModule> {
  shellPromise ??= (async () => {
    // Everything React is bundled — components AND the renderer — so
    // a single React copy serves both sides (rendering bundled
    // components with this file's react-dom breaks hooks). The entry
    // re-exports createElement + renderToStaticMarkup from the bundle.
    const dir = mkdtempSync(join(tmpdir(), "shared-shell-test-"));
    const entry = join(dir, "entry.tsx");
    const names = ["site-header", "site-footer", "page-column", "pill", "badge", "error-screen", "first-visit-queue"];
    writeFileSync(
      entry,
      [
        ...names.map((n) => `export * from ${JSON.stringify(join(here, `${n}.tsx`))};`),
        'export { createElement } from "react";',
        'export { renderToStaticMarkup } from "react-dom/server";',
      ].join("\n"),
    );
    const outfile = join(dir, "bundle.mjs");
    buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      // react-dom/server is CJS and dynamically requires node
      // builtins; in an ESM bundle that needs a real require.
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      // The entry lives in /tmp, outside the repo's module tree, so
      // its bare "react" imports resolve through this file's own
      // resolution (which works in any install layout).
      alias: {
        react: dirname(req.resolve("react/package.json")),
        "react-dom": dirname(req.resolve("react-dom/package.json")),
      },
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    return (await import(pathToFileURL(outfile).href)) as ShellModule;
  })();
  return shellPromise;
}

const render = async (component: keyof ShellModule, props: Record<string, unknown>, children?: ReactNode) => {
  const shell = await loadShell();
  const C = shell[component] as (p: Record<string, unknown>) => ReactNode;
  return shell.renderToStaticMarkup(shell.createElement(C, props, children));
};

describe("SiteHeader", () => {
  const base = {
    onHome: () => {},
    navItems: [
      { label: "What's coming", onClick: () => {} },
      { label: "Get involved", onClick: () => {} },
    ],
    stars: createElement("span", { "data-testid": "stars" }, "12 ★"),
    mute: createElement("button", { type: "button", "data-testid": "mute" }, "Sound"),
    endGame: createElement("button", { type: "button", "data-testid": "end" }, "End game"),
  };

  it("renders brand, nav, stars, mute, end game in the fixed slot order", async () => {
    const html = await render("SiteHeader", base);
    const order = ["brand-home-button", "Get involved", "stars", "mute", "end"].map((needle) => html.indexOf(needle));
    assert.ok(order.every((i) => i >= 0), html);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /data-nav-mode="inline"/);
    assert.match(html, /aria-label="Meridian home"/);
  });

  it("menu button is a 44px-class control, collapsed, and the panel (with the slots outside it) is closed", async () => {
    const html = await render("SiteHeader", base);
    assert.match(html, /site-header-menu-button/);
    assert.match(html, /aria-expanded="false"/);
    assert.doesNotMatch(html, /site-header-panel/);
  });

  it("navMode=menu never renders the nav inline — it lives only behind Menu", async () => {
    const html = await render("SiteHeader", { ...base, navMode: "menu" });
    assert.match(html, /data-nav-mode="menu"/);
    assert.doesNotMatch(html, /site-header-nav"/);
    assert.doesNotMatch(html, /What's coming/);
    // Slots stay on the line even in menu mode.
    assert.match(html, /data-testid="end"/);
    assert.match(html, /data-testid="mute"/);
  });

  it("accepts explicit null slots (required-but-nullable): a silent, starless screen renders clean", async () => {
    const html = await render("SiteHeader", { onHome: () => {}, stars: null, mute: null });
    assert.match(html, /brand-home-button/);
    assert.doesNotMatch(html, /site-header-menu-button/);
  });
});

describe("SiteFooter", () => {
  it("carries the shipped home link set with its test ids and the kids-privacy note", () => {
    const src = read("src/components/ui/site-footer.tsx");
    for (const needle of [
      'data-testid="grownups-link"',
      "For grown-ups: game settings",
      'data-testid="take-tour-link"',
      'data-testid="privacy-link"',
      'data-testid="contact-link"',
      "Contact us (grown-ups)",
      'data-testid="credits-link"',
      'data-testid="board-link"',
      "kids-privacy-note",
      "no accounts, no ads, no tracking cookies",
    ]) {
      assert.ok(src.includes(needle), needle);
    }
    // The prompt's unshipped links must not be invented here.
    assert.doesNotMatch(src, />Help<|>About<|>Terms</);
  });
});

describe("PageColumn", () => {
  it("wide is max-w-7xl, read is max-w-3xl, both w-full with px-5 gutters", async () => {
    const wide = await render("PageColumn", {}, "x");
    assert.match(wide, /mx-auto w-full px-5 max-w-7xl/);
    const readCol = await render("PageColumn", { width: "read" }, "x");
    assert.match(readCol, /max-w-3xl/);
    assert.doesNotMatch(wide + readCol, /max-w-none|100vw/);
  });
});

describe("Pill and Badge", () => {
  it("Pill uses the one count format, singular included", async () => {
    assert.match(await render("Pill", { count: 12 }), />12 cases</);
    assert.match(await render("Pill", { count: 1 }), />1 case</);
    const html = await render("Pill", { count: 3 });
    assert.match(html, /site-pill/);
    assert.doesNotMatch(html, /cursor-pointer/);
  });

  it("Badge vocabulary is New / Done — Open is retired", async () => {
    assert.match(await render("Badge", { variant: "new" }), />New</);
    const done = await render("Badge", { variant: "done" });
    assert.match(done, />Done</);
    assert.match(done, /site-badge--done/);
  });
});

describe("ErrorScreen", () => {
  it("header on top, pinned blameless copy, exactly the Try again + Home exits", async () => {
    const html = await render("ErrorScreen", { onHome: () => {}, onRetry: () => {} });
    assert.match(html, /brand-home-button/);
    assert.match(html, /That page couldn&#x27;t load\./);
    assert.match(html, /it&#x27;s not your fault/);
    assert.match(html, />Try again</);
    assert.match(html, />Home</);
    assert.match(html, /mode-card/);
    assert.doesNotMatch(html, /error code|failed to load|exception/i);
  });
});

describe("FirstVisitQueue", () => {
  it("shows only the first unseen prompt", async () => {
    const html = await render("FirstVisitQueue", {
      seenKey: "test-seen",
      prompts: [
        { id: "a", node: createElement("p", null, "PROMPT-A") },
        { id: "b", node: createElement("p", null, "PROMPT-B") },
      ],
    });
    assert.match(html, /PROMPT-A/);
    assert.doesNotMatch(html, /PROMPT-B/);
    assert.match(html, /data-prompt-id="a"/);
  });
});

describe("44px hit-box floor (UX pin)", () => {
  it("header links and the menu button keep min-height 44px in CSS; footer links and Button keep theirs", () => {
    const css = read("src/styles.css");
    const block = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      assert.ok(start >= 0, selector);
      return css.slice(start, css.indexOf("}", start));
    };
    assert.match(block(".site-header-nav-link"), /min-height: 44px/);
    assert.match(block(".site-header-menu-button"), /min-height: 44px/);
    assert.match(read("src/components/age-profile/age-profile.css").match(/\.agep-footer-link \{[^}]*}/)?.[0] ?? "", /min-height: 44px/);
    assert.match(read("src/components/ui/button.tsx"), /min-h-11/);
    // Compact band shrinks type but must not restate a smaller hit box.
    const compact = css.slice(css.indexOf("Compact band"));
    assert.doesNotMatch(compact.slice(0, compact.indexOf("}", compact.indexOf(".site-header-nav-link"))), /min-height/);
  });
});

describe("Badge contrast, computed from the styles.css token values", () => {
  // The token values as shipped; the pins below fail if a token moves,
  // so this table is updated in the same PR as any token change.
  const themes = {
    dark: { brassTextSm: "#e8b64c", card: [16, 34, 42, 0.66] as const, bg: "#101211", fg: "#f3f4f2", surface2: "#212724" },
    light: { brassTextSm: "#6e4a0e", card: [255, 253, 246, 0.74] as const, bg: "#f4f1ea", fg: "#1c2420", surface2: "#e7e2d6" },
  };
  const rgb = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const lum = ([r, g, b]: readonly number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: readonly number[], b: readonly number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("the pinned values are the values styles.css ships", () => {
    const css = read("src/styles.css");
    for (const needle of [
      "--atlas-brass-text-sm: #e8b64c",
      "--atlas-brass-text-sm: #6e4a0e",
      "--atlas-card: rgba(16, 34, 42, 0.66)",
      "--atlas-card: rgba(255, 253, 246, 0.74)",
      "--bg: #101211",
      "--bg: #f4f1ea",
      "--fg: #f3f4f2",
      "--fg: #1c2420",
      "--surface-2: #212724",
      "--surface-2: #e7e2d6",
    ]) {
      assert.ok(css.includes(needle), needle);
    }
  });

  it("New (brass text on the card, composited over the page bg) and Done (fg on surface-2) are ≥4.5:1 on both themes", () => {
    for (const [name, t] of Object.entries(themes)) {
      const bgRgb = rgb(t.bg);
      const cardOverBg = t.card.map((v, i) => (i < 3 ? v * t.card[3] + bgRgb[i] * (1 - t.card[3]) : v)).slice(0, 3);
      assert.ok(ratio(rgb(t.brassTextSm), cardOverBg) >= 4.5, `${name} New`);
      assert.ok(ratio(rgb(t.fg), rgb(t.surface2)) >= 4.5, `${name} Done`);
    }
  });
});

describe("shell-ban baseline (KNOWN/STALE)", () => {
  const baseline = JSON.parse(read("eslint/shell-ban-baseline.json")) as Record<string, string[]>;
  const patterns: Record<string, RegExp> = {
    homeButtonImport: /import[^;]*\bHomeButton\b[^;]*home-button/,
    pageLocalHeaderFooter: /<(header|footer)[\s>]/,
    maxWNone: /max-w-none/,
  };

  it("lint:nav wires the shell bans in", () => {
    assert.match(read("eslint.nav.config.mjs"), /shellBanConfigs/);
  });

  it("every baselined file still violates — a cured file's entry is stale and must be removed", () => {
    for (const [kind, files] of Object.entries(baseline)) {
      if (kind === "comment") continue;
      for (const file of files) {
        assert.match(read(file), patterns[kind], `${file} no longer violates ${kind}: remove it from the baseline`);
      }
    }
  });

  it("the shared components themselves are never baselined", () => {
    const all = Object.values(baseline).flat();
    for (const own of ["site-header", "site-footer", "page-column", "pill", "badge", "error-screen", "first-visit-queue"]) {
      assert.ok(!all.some((f) => f.includes(own)), own);
    }
  });
});
