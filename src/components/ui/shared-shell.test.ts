/**
 * Shared shell (fix/ui-shared-shell): SiteHeader, SiteFooter,
 * PageColumn, PageShell, Pill, ErrorScreen, FirstVisitQueue.
 *
 * The node harness cannot load .tsx, so the components are bundled
 * with esbuild and rendered with react-dom/server (the clue-scene
 * render test's pattern). Assertions pin the contract: slot order,
 * slots never in the menu panel, the 44px hit-box floor, the Pill
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
  PageShell: (props: never) => ReactNode;
  PageIntro: (props: never) => ReactNode;
  ErrorScreen: (props: never) => ReactNode;
  FirstVisitQueue: (props: never) => ReactNode;
  createElement: typeof createElement;
  renderToStaticMarkup: typeof renderToStaticMarkup;
  createTestRenderer: (node: ReactNode) => TestRenderer;
  act: (fn: () => void) => void;
  AdvanceProbe: () => ReactNode;
  capturedAdvance: () => (() => void) | undefined;
};

type TestRenderer = {
  root: {
    findByProps: (props: Record<string, unknown>) => unknown;
  };
  unmount: () => void;
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
    const names = ["site-header", "site-footer", "page-column", "page-shell", "pill", "error-screen", "first-visit-queue"];
    writeFileSync(
      entry,
      [
        ...names.map((n) => `export * from ${JSON.stringify(join(here, `${n}.tsx`))};`),
        'export { createElement } from "react";',
        'export { renderToStaticMarkup } from "react-dom/server";',
        // Interactive rendering for the FirstVisitQueue advance hook:
        // react-test-renderer shares the bundle's single React copy.
        'export { create as createTestRenderer, act } from "react-test-renderer";',
        `import { createElement as ce } from "react";`,
        `import { useFirstVisitAdvance } from ${JSON.stringify(join(here, "first-visit-queue.tsx"))};`,
        "let captured;",
        "export function AdvanceProbe() { captured = useFirstVisitAdvance(); return ce(\"span\", null, \"probe\"); }",
        "export function capturedAdvance() { return captured; }",
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
        "react-test-renderer": dirname(req.resolve("react-test-renderer/package.json")),
        scheduler: dirname(req.resolve("scheduler/package.json")),
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
    status: createElement("span", { "data-testid": "status" }, "12 ★"),
    mute: createElement("button", { type: "button", "data-testid": "mute" }, "Sound"),
    endGame: createElement("button", { type: "button", "data-testid": "end" }, "End game"),
  };

  it("renders the home control, nav, status, mute, end game in the fixed slot order", async () => {
    const html = await render("SiteHeader", base);
    const order = ["home-button", "Get involved", "status", "mute", "end"].map((needle) => html.indexOf(needle));
    assert.ok(order.every((i) => i >= 0), html);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /data-nav-mode="inline"/);
  });

  it("the home control is HomeButton: named exactly Home, no arrow, ghost by default (Round 2 rule 2)", async () => {
    const html = await render("SiteHeader", base);
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /Home<\/button>/);
    assert.doesNotMatch(html, /Meridian home|←/);
    // ghost variant classes on the control (transparent bg on cream).
    assert.match(html, /bg-transparent/);
  });

  it("homeVariant=secondary renders the over-map variant of the same control", async () => {
    const html = await render("SiteHeader", { ...base, homeVariant: "secondary" });
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /bg-surface-2/);
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

  it("the back slot renders between the home control and the nav (PR 3 Step 2)", async () => {
    const html = await render("SiteHeader", {
      ...base,
      back: createElement("button", { type: "button", "data-testid": "back" }, "Back"),
    });
    const order = ["home-button", 'data-testid="back"', "Get involved"].map((needle) => html.indexOf(needle));
    assert.ok(order.every((i) => i >= 0), html);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("variant=map marks the header and defaults the home control to secondary; cream stays ghost", async () => {
    const map = await render("SiteHeader", { ...base, variant: "map" });
    assert.match(map, /data-variant="map"/);
    assert.match(map, /bg-surface-2/);
    const cream = await render("SiteHeader", base);
    assert.match(cream, /data-variant="cream"/);
    assert.match(cream, /bg-transparent/);
  });

  it("an icon nav item renders its icon before the label, aria-hidden", async () => {
    const html = await render("SiteHeader", {
      onHome: () => {},
      status: null,
      mute: null,
      navItems: [{ label: "Atlas", onClick: () => {}, icon: createElement("svg", { "data-testid": "nav-icon" }) }],
    });
    const order = ["nav-icon", "Atlas"].map((needle) => html.indexOf(needle));
    assert.ok(order.every((i) => i >= 0), html);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /site-header-nav-icon" aria-hidden="true"/);
  });

  it("a link nav item renders through the router Link, an action item through a button", () => {
    // Source-level (the harness renders without a router, like the
    // SiteFooter test): the two item kinds share one data shape.
    const src = read("src/components/ui/site-header.tsx");
    assert.match(src, /item\.to \? \(/);
    assert.match(src, /<Link/);
    assert.match(src, /<button/);
  });

  it("accepts explicit null slots (required-but-nullable): a silent, starless screen renders clean", async () => {
    const html = await render("SiteHeader", { onHome: () => {}, status: null, mute: null });
    assert.match(html, /data-testid="home-button"/);
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
      "kids-privacy-note",
      "no accounts, no ads, no tracking cookies",
    ]) {
      assert.ok(src.includes(needle), needle);
    }
    // The prompt's unshipped links must not be invented here.
    assert.doesNotMatch(src, />Help<|>About<|>Terms</);
  });

  it("renders its route links from the ONE shared list (site-links.ts), the grown-ups doors' source too", () => {
    const footer = read("src/components/ui/site-footer.tsx");
    assert.match(footer, /FOOTER_ROUTE_LINKS/);
    for (const literal of ['data-testid="privacy-link"', 'data-testid="contact-link"', 'data-testid="credits-link"', 'data-testid="board-link"']) {
      assert.ok(!footer.includes(literal), literal);
    }
    const links = read("src/components/ui/site-links.ts");
    for (const needle of [
      'footerTestId: "privacy-link"',
      'footerTestId: "contact-link"',
      'footerTestId: "credits-link"',
      'footerTestId: "board-link"',
      "Contact us (grown-ups)",
      "What's coming (grown-ups)",
      "GROWNUP_DOORS",
    ]) {
      assert.ok(links.includes(needle), needle);
    }
    // The grown-ups doors nav renders the same list, not a copy.
    assert.match(read("src/components/grownups/info-page.tsx"), /GROWNUP_DOORS/);
  });
});

describe("PageColumn", () => {
  it("wide reads --page-wide, narrow reads --page-narrow, both w-full with px-5 gutters", async () => {
    const wide = await render("PageColumn", {}, "x");
    assert.match(wide, /mx-auto w-full px-5 max-w-\(--page-wide\)/);
    const narrow = await render("PageColumn", { width: "narrow" }, "x");
    assert.match(narrow, /max-w-\(--page-narrow\)/);
    assert.doesNotMatch(wide + narrow, /max-w-none|100vw/);
  });
});

describe("Pill", () => {
  it("Pill uses the one count format, singular included", async () => {
    assert.match(await render("Pill", { count: 12 }), />12 cases</);
    assert.match(await render("Pill", { count: 1 }), />1 case</);
    const html = await render("Pill", { count: 3 });
    assert.match(html, /site-pill/);
    assert.doesNotMatch(html, /cursor-pointer/);
  });
});

describe("ErrorScreen", () => {
  it("header on top, pinned blameless copy, exactly the Try again + Home exits", async () => {
    const html = await render("ErrorScreen", { onHome: () => {}, onRetry: () => {} });
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /That page couldn&#x27;t load\./);
    assert.match(html, /it&#x27;s not your fault/);
    assert.match(html, />Try again</);
    assert.match(html, />Home</);
    assert.match(html, /mode-card/);
    assert.doesNotMatch(html, /error code|failed to load|exception/i);
  });

  it("title, body and action labels are props; surface=plain drops the card (PR 3 Step 2)", async () => {
    const html = await render("ErrorScreen", {
      onHome: () => {},
      onRetry: () => {},
      title: "Custom title.",
      body: "Custom body.",
      actions: { retryLabel: "Try once more", homeLabel: "Go home" },
      surface: "plain",
    });
    assert.match(html, /Custom title\./);
    assert.match(html, /Custom body\./);
    assert.match(html, />Try once more</);
    assert.match(html, />Go home</);
    assert.doesNotMatch(html, /mode-card/);
    const card = await render("ErrorScreen", { onHome: () => {}, onRetry: () => {} });
    assert.match(card, /mode-card/);
  });
});

describe("PageShell and PageIntro (PR 3 Step 2)", () => {
  it("PageShell frames header, intro, content in order inside the column; footer=null omits the footer", async () => {
    const html = await render(
      "PageShell",
      {
        header: { onHome: () => {}, status: null, mute: null },
        intro: { eyebrow: "Case file", title: "A Title", sub: "A sub" },
        footer: null,
      },
      createElement("p", { "data-testid": "content" }, "CONTENT"),
    );
    const order = ["home-button", "Case file", "A Title", "A sub", "CONTENT"].map((needle) => html.indexOf(needle));
    assert.ok(order.every((i) => i >= 0), html);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /max-w-\(--page-narrow\)/);
    assert.doesNotMatch(html, /agep-footer/);
  });

  it("PageShell renders the shared SiteFooter by default (source: no hand-built footer)", () => {
    const src = read("src/components/ui/page-shell.tsx");
    assert.match(src, /<SiteHeader \{\.\.\.header\} \/>/);
    assert.match(src, /<SiteFooter \{\.\.\.footer\} \/>/);
    assert.doesNotMatch(src, /<footer|<header/);
  });

  it("the grown-ups pages sit on PageShell (PR 3 Step 3.1): header Home + footer, no hand-built frame", () => {
    const src = read("src/components/grownups/info-page.tsx");
    assert.match(src, /<PageShell header=\{\{ to: "\/", status: null, mute: null \}\} width="narrow">/);
    assert.doesNotMatch(src, /gp-wrap/);
  });

  it("the region lists sit on SiteHeader (PR 3 Step 3.6): Home everywhere, Back in the back slot", () => {
    const src = read("src/components/game-app.tsx");
    assert.doesNotMatch(src, /<ScreenShell/);
    assert.doesNotMatch(src, /from "@\/components\/ui\/screen-shell"/);
    assert.match(src, /<SiteHeader onHome=\{onBack\} status=\{null\} mute=\{null\} \/>/);
    assert.match(src, /data-testid="back-button"/);
    assert.match(src, /onHome=\{\(\) => setMenu\(null\)\}/);
  });

  it("Cold Trail sits on SiteHeader (PR 3 Step 3.5): stars in status, mute in mute, no px-2 Home override", () => {
    const src = read("src/game/coldtrail/TrailScreen.tsx");
    assert.match(src, /<SiteHeader\s+onHome=\{onLeave\}/);
    assert.match(src, /mute=\{<SoundToggle testId="sound-toggle-trail"/);
    assert.doesNotMatch(src, /<HomeButton/);
    assert.doesNotMatch(src, /from "@\/components\/ui\/home-button"/);
    assert.doesNotMatch(src, /className="px-2"/);
    assert.doesNotMatch(src, /<header>/);
  });

  it("PageIntro renders eyebrow, title and sub", async () => {
    const html = await render("PageIntro", { eyebrow: "Eyebrow", title: "Title", sub: "Sub" });
    assert.match(html, /Eyebrow/);
    assert.match(html, /<h1[^>]*>Title<\/h1>/);
    assert.match(html, /Sub/);
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

  it("useFirstVisitAdvance is wired: a prompt calling it advances the queue and persists the seen id", async () => {
    const shell = await loadShell();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    try {
      const Q = shell.FirstVisitQueue as (p: Record<string, unknown>) => ReactNode;
      const Probe = shell.AdvanceProbe as (p: Record<string, unknown>) => ReactNode;
      let renderer!: TestRenderer;
      shell.act(() => {
        renderer = shell.createTestRenderer(
          shell.createElement(Q, {
            seenKey: "hook-test",
            prompts: [
              { id: "a", node: shell.createElement(Probe, {}) },
              { id: "b", node: shell.createElement("p", null, "PROMPT-B") },
            ],
          }),
        );
      });
      assert.ok(renderer.root.findByProps({ "data-prompt-id": "a" }));
      const advance = shell.capturedAdvance();
      assert.equal(typeof advance, "function");
      shell.act(() => advance!());
      assert.ok(renderer.root.findByProps({ "data-prompt-id": "b" }));
      assert.deepEqual(JSON.parse(store.get("hook-test") ?? "[]"), ["a"]);
      renderer.unmount();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe("header fit (Round 2, A.2): the row can never wrap", () => {
  it("row, nav and actions are nowrap in CSS; nav links keep white-space: nowrap", () => {
    const css = read("src/styles.css");
    const block = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      assert.ok(start >= 0, selector);
      return css.slice(start, css.indexOf("}", start));
    };
    assert.match(block(".site-header-row"), /flex-wrap: nowrap/);
    assert.match(block(".site-header-nav"), /flex-wrap: nowrap/);
    assert.match(block(".site-header-actions"), /flex-wrap: nowrap/);
    assert.match(block(".site-header-nav-link"), /white-space: nowrap/);
    // PR 3 Step 2: one inline-flex line — buttons and router links
    // share a text line (measured 7px apart before) and a chevron
    // can no longer wrap under its label.
    assert.match(block(".site-header-nav-link"), /display: inline-flex/);
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

describe("Pill contrast, computed from the styles.css token values", () => {
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

  it("Pill text (brass on the card, composited over the page bg) is ≥4.5:1 on both themes", () => {
    for (const [name, t] of Object.entries(themes)) {
      const bgRgb = rgb(t.bg);
      const cardOverBg = t.card.map((v, i) => (i < 3 ? v * t.card[3] + bgRgb[i] * (1 - t.card[3]) : v)).slice(0, 3);
      assert.ok(ratio(rgb(t.brassTextSm), cardOverBg) >= 4.5, `${name} Pill`);
    }
  });
});

describe("shell-ban baseline (KNOWN/STALE)", () => {
  const baseline = JSON.parse(read("eslint/shell-ban-baseline.json")) as Record<string, string[]>;
  const patterns: Record<string, RegExp> = {
    homeButtonImport: /import[^;]*\b(?:Brand)?HomeButton\b[^;]*home-button/,
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
    for (const own of ["site-header", "site-footer", "page-column", "page-shell", "pill", "error-screen", "first-visit-queue"]) {
      assert.ok(!all.some((f) => f.includes(own)), own);
    }
  });
});
