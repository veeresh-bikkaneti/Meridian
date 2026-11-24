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

  it("the home control is the brand lockup: named exactly Meridian home, no Home pill (owner ruling 2026-11-17, N1)", async () => {
    const html = await render("SiteHeader", base);
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /aria-label="Meridian home"/);
    assert.match(html, /brand-home-button/);
    assert.match(html, /brand-home-word/);
    // The retired pill: no visible "Home" text, no house icon.
    assert.doesNotMatch(html, />Home</);
    assert.doesNotMatch(html, /lucide-house|←/);
  });

  it("the header is the frozen bar and carries the N1 contracts in the shell CSS", () => {
    const css = read("src/styles.css");
    // Sticky on the shell's own rule, reclaimed on Home at the atlas
    // lift's own weight (Phase A mechanism 1).
    assert.match(css, /\.site-header \{\s[^}]*position: sticky;/);
    assert.match(css, /\.atlas-home > header\.site-header \{\s[^}]*position: sticky;/);
    // Same reclaim against the Why Learn drift lift, which also
    // forces position: relative on the header.
    assert.match(css, /\.why-learn-screen > header\.site-header \{\s+position: sticky;/);
    // Scroll-offset contract as a token (mechanism: no anchor
    // landing hides under the bar).
    assert.match(css, /scroll-padding-top: calc\(var\(--header-height\) \+ 12px\)/);
    // One current-section style: filled tile + underline cue.
    assert.match(css, /\.site-header-nav-link\[data-current="true"\] \{[^}]*background: #8a6d2f;[^}]*text-decoration: underline;/);
    // Mark-only lockup below 560px (Phase A mechanism 3).
    assert.match(css, /@media \(max-width: 560px\) \{\s+\.site-header \.brand-home-word \{\s+display: none;/);
    // Route headers: the body box grows with content when the
    // header is body's own child (Phase A mechanism 2).
    assert.match(css, /body:has\(> header\.site-header\) \{\s+height: auto;\s+min-height: 100%;/);
  });

  it("nav items carry their section id for the derived highlight, and the panel closes on a pick", () => {
    const src = read("src/components/ui/site-header.tsx");
    assert.match(src, /data-nav-section=\{item\.sectionId\}/);
    assert.match(src, /aria-current", "location"/);
    assert.match(src, /onPanelClick/);
    assert.match(src, /setMenuOpen\(false\)/);
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

  it("variant=map marks the header; the lockup home control is the same on both surfaces", async () => {
    const map = await render("SiteHeader", { ...base, variant: "map" });
    assert.match(map, /data-variant="map"/);
    assert.match(map, /aria-label="Meridian home"/);
    const cream = await render("SiteHeader", base);
    assert.match(cream, /data-variant="cream"/);
    assert.match(cream, /aria-label="Meridian home"/);
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

  it("embedded renders the panel alone, and the Home exit exists only when onHome is passed (PR 3 Step 3.9)", async () => {
    const withHome = await render("ErrorScreen", { embedded: true, onHome: () => {}, onRetry: () => {} });
    assert.doesNotMatch(withHome, /site-header|home-button/);
    assert.match(withHome, /mode-card/);
    assert.match(withHome, />Try again</);
    assert.match(withHome, />Home</);
    // No onHome: no Home exit anywhere — the mid-run case, where a
    // Home button would lie because the reload restores the run.
    const noHome = await render("ErrorScreen", { embedded: true, onRetry: () => {} });
    assert.doesNotMatch(noHome, />Home</);
    assert.doesNotMatch(noHome, /site-header|home-button/);
    assert.match(noHome, />Try again</);
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

  it("the boot splash sits on PageShell: narrow column, no page-local main", () => {
    const src = read("src/components/boot-splash.tsx");
    assert.match(src, /<PageShell header=\{\{ to: "\/", status: null, mute: null \}\} width="narrow">/);
    assert.doesNotMatch(src, /<main[\s>]/);
    assert.match(src, /Geography, math and science/);
    assert.match(read("src/components/boot-splash.css"), /\.boot-splash-mark/);
  });

  it("the grown-ups pages sit on PageShell (PR 3 Step 3.1): header Home + footer, no hand-built frame", () => {
    const src = read("src/components/grownups/info-page.tsx");
    assert.match(src, /<PageShell header=\{\{ to: "\/", status: null, mute: null \}\} width="narrow">/);
    assert.doesNotMatch(src, /gp-wrap/);
  });

  it("Review and Challenge complete sit on SiteHeader (PR 3 Step 3.7): the one Home at the top", () => {
    const src = read("src/components/game-app.tsx");
    assert.equal(
      src.split("<SiteHeader onHome={onDone} status={null} mute={null} />").length - 1,
      2,
      "both end-of-flow screens render the shared header",
    );
    assert.match(src, /data-testid="review-complete"/);
    assert.match(src, /testId="challenge-done"/);
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

  it("the pool error is the shared ErrorScreen (PR 3 Step 3.8): failure copy on its props, one recovery door", () => {
    const src = read("src/components/game-app.tsx");
    const branch = src.slice(src.indexOf("if (poolError)"), src.indexOf("if (!places)"));
    assert.match(branch, /<ErrorScreen/);
    assert.match(branch, /title="Couldn't load places\."/);
    assert.match(branch, /was not started with a partial pool/);
    assert.match(branch, /onHome=\{onEditions\}/);
    assert.match(branch, /onRetry=\{onEditions\}/);
    assert.doesNotMatch(branch, /<main/);
  });

  it("GeoDetective's header carries no className override (PR 3 Step 3.11): the shell's sticky prop instead", async () => {
    const src = read("src/game/loop/LoopScreen.tsx");
    assert.doesNotMatch(src, /screen-home-bar -mx-5 px-5/);
    const tag = src.slice(src.indexOf("<SiteHeader"), src.indexOf("status={", src.indexOf("<SiteHeader")));
    assert.match(tag, /sticky/);
    assert.doesNotMatch(tag, /className/);
    const header = read("src/components/ui/site-header.tsx");
    assert.match(header, /data-sticky=\{sticky \? "true" : undefined\}/);
    const css = read("src/styles.css");
    assert.match(css, /\.site-header\[data-sticky="true"\] \{\s+position: sticky;/);
    const html = await render("SiteHeader", { onHome: () => {}, status: null, mute: null, sticky: true });
    assert.match(html, /data-sticky="true"/);
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

describe("dead home header CSS (PR 3 Step 4)", () => {
  it("home-v5.css carries no .hv5-nav or .hv5-brand rules — Home renders SiteHeader, not the old lockup", () => {
    const css = read("src/components/home-v5.css");
    assert.doesNotMatch(css, /hv5-nav|hv5-brand/);
    // No production markup uses those classes either.
    for (const file of ["src/components/game-app.tsx", "src/components/ui/site-header.tsx"]) {
      assert.doesNotMatch(read(file), /hv5-nav|hv5-brand/, file);
    }
  });

  it("BrandHomeButton is kept, with the CSS it needs (.brand-home-* in styles.css)", () => {
    const css = read("src/styles.css");
    for (const rule of [".brand-home-button", ".brand-home-mark", ".brand-home-word"]) {
      assert.ok(css.includes(rule), rule);
    }
    assert.match(read("src/components/ui/home-button.ts"), /export function BrandHomeButton/);
  });
});

describe("page-width tokens (PR 3 Step 4)", () => {
  it("screen roots use the PageColumn tokens, not literal max-w-3xl / max-w-7xl", () => {
    for (const file of [
      "src/components/game-app.tsx",
      "src/game/loop/LoopScreen.tsx",
      "src/game/coldtrail/TrailScreen.tsx",
      "src/subjects/shared/SubjectCase.tsx",
      "src/subjects/shared/SubjectPicker.tsx",
    ]) {
      const src = read(file);
      assert.doesNotMatch(src, /max-w-3xl|max-w-7xl/, file);
      assert.match(src, /max-w-\(--page-(narrow|wide)\)/, file);
    }
    // Token values are the shipped sizes, so the swap changes nothing
    // on screen: --page-narrow is Tailwind's 3xl, --page-wide its 7xl.
    const css = read("src/styles.css");
    assert.match(css, /--page-narrow: 48rem;/);
    assert.match(css, /--page-wide: 80rem;/);
    // Left literal, with the reason on record: the RegionList column
    // is a deliberate 36rem list width with no token in the
    // narrow/wide family; widening it to 48rem would be a visual
    // change, not a refactor. Component-local caps (cards, overlays,
    // sheets) are not page widths and stay literal too.
    assert.match(read("src/components/game-app.tsx"), /max-w-xl flex-col/);
    // Same reason, Cold Trail's wide band: its healthy-path root
    // widens to 72rem at the large breakpoint (lg:max-w-6xl). No
    // token in the narrow/wide family holds 72rem, and converting
    // it to --page-wide (80rem) would move the layout, so the
    // literal stays — its base width is the token above.
    assert.match(read("src/game/coldtrail/TrailScreen.tsx"), /lg:max-w-6xl/);
  });
});

describe("shell-ban baseline (KNOWN/STALE)", () => {
  const baseline = JSON.parse(read("eslint/shell-ban-baseline.json")) as Record<string, string[]>;
  const patterns: Record<string, RegExp> = {
    homeButtonImport: /import[^;]*\b(?:Brand)?HomeButton\b[^;]*home-button/,
    pageLocalHeaderFooter: /<(header|footer)[\s>]/,
    pageLocalNav: /<nav[\s>]/,
    pageLocalMain: /<main[\s>]/,
    maxWNone: /max-w-none/,
  };

  it("lint:nav wires the shell bans in", () => {
    assert.match(read("eslint.nav.config.mjs"), /shellBanConfigs/);
  });

  // Frozen baselines (PR 3 Step 5 cure): the staleness check alone
  // cannot stop a baseline from GROWING — an entry added to cover a
  // genuinely-violating new file would still "still violate" and
  // pass. So every list is frozen exactly, the registry pattern:
  // adding or removing an entry fails here until a person edits
  // this record on purpose, in the same change that cures a file.
  const FROZEN_BASELINE: Record<string, string[]> = {
    homeButtonImport: ["src/components/game-app.tsx", "src/game/loop/LoopScreen.tsx", "src/subjects/shared/SubjectCase.tsx"],
    // Why Learn D1 (2026-11-18): SubjectPicker was cured — the
    // picker sits in the shared --page-wide container and its
    // lg:max-w-none is gone — so the maxWNone baseline is empty.
    maxWNone: [],
    pageLocalHeaderFooter: [],
    pageLocalNav: ["src/components/grownups/info-page.tsx", "src/routes/board.tsx"],
    pageLocalMain: [
      "src/components/game-app.tsx",
      "src/components/grownups/info-page.tsx",
      "src/game/coldtrail/TrailScreen.tsx",
      "src/game/loop/LoopScreen.tsx",
      "src/lib/error-component.tsx",
      "src/routes/board.tsx",
      "src/subjects/shared/SubjectCase.tsx",
      "src/subjects/shared/SubjectPicker.tsx",
    ],
  };

  it("every baseline list matches its frozen record exactly — growing a baseline goes red", () => {
    const kinds = Object.keys(baseline).filter((k) => k !== "comment").sort();
    assert.deepEqual(kinds, Object.keys(FROZEN_BASELINE).sort(), "a baseline kind was added or removed");
    for (const [kind, frozen] of Object.entries(FROZEN_BASELINE)) {
      assert.deepEqual(
        [...(baseline[kind] ?? [])].sort(),
        [...frozen].sort(),
        `${kind} baseline changed: shrink it only by curing a file and editing the frozen record in the same change`,
      );
    }
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
