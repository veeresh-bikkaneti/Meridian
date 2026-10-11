import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  commitMiss,
} from "./helpers";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * BoundedText component-level tests (WRAPPING_SPEC §6a) — real Chromium,
 * never jsdom. A static fixture page (tests/fixtures/bounded-text.html)
 * renders every variant with the §9 worst-case strings, styled by the
 * BUILT app CSS (real shipped styles + real self-hosted Fraunces/Karla).
 * The fixture DOM is exactly what <BoundedText> emits — proven by
 * renderToString in src/components/bounded-text.test.ts.
 *
 * Viewport widths: 320/360/390 at 100%, plus 160/195 — the 200%-zoom
 * CSS-pixel equivalents of 320/390 (200% zoom halves CSS px).
 *
 * Per text node: scrollWidth AND scrollHeight ≤ client+1, rect inside the
 * card, computed white-space ≠ nowrap, headline line counts, no-orphan
 * last lines, WCAG 1.4.12 spacing stress. §10 open checks (slack,
 * keep-together, chip row) are measured here and decided in the report.
 */
test.setTimeout(180_000);
// Video at file level (Playwright forbids video in describe-level test.use).
test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const FIXTURE_URL = "http://127.0.0.1:4123/Meridian/__bounded-fixture.html";
const SKIP_ORPHAN = new Set([
  "fx-share", // pre/url: URL fragments break anywhere by design
  "fx-source", // a/url: same
  "fx-token-48", // unbreakable token: mid-word break by design
  "fx-token-30digit", // same
  // Eyebrows are "·"-separated token lists (metadata), not prose: a
  // short final token ("· Hard") is inherent to wrapping a token list
  // and reads fine at 11px. The no-orphan rule targets prose lines.
  "fx-eyebrow-1",
  "fx-eyebrow-2",
]);
// fx-keep-spans is the REJECTED §10.2 alternative, not the contract:
// its nowrap spans spill at 160px (measured in the §10.2 test — that
// spill is the evidence for balance-only). It is excluded from the
// contract battery; fx-keep-balance is the contract under test.
const SKIP_CONTRACT = new Set(["fx-keep-spans"]);
// The chip is the spec §4 DO NOT ADOPT exception: nowrap by design.
// Its own test (§10.3) asserts it keeps one line at every width.
const SKIP_WHITESPACE = new Set(["fx-row-chip"]);

const distDir = () => path.resolve(process.env.KOFI_E2E_DIST ?? "dist/client");

async function serveFixture(context: import("playwright/test").BrowserContext) {
  await serveBuiltArtifact(context);
  const cssFile = readdirSync(path.join(distDir(), "assets")).find((f) =>
    /^styles-[\w-]+\.css$/.test(f),
  );
  if (!cssFile) throw new Error(`no built styles-*.css in ${distDir()}/assets`);
  const html = readFileSync("tests/fixtures/bounded-text.html", "utf8").replace(
    "__APP_CSS__",
    `./assets/${cssFile}`,
  );
  // Registered after serveBuiltArtifact: last-registered route wins.
  await context.route("**/__bounded-fixture.html", (route) =>
    route.fulfill({
      status: 200,
      body: html,
      contentType: "text/html; charset=utf-8",
    }),
  );
}

interface FxMeasure {
  id: string;
  variant: string;
  scrollW: number;
  clientW: number;
  scrollH: number;
  clientH: number;
  whiteSpace: string;
  lines: number;
  firstLineW: number;
  lastLineW: number;
  contentW: number;
  insideCard: boolean;
}

async function measure(page: import("playwright/test").Page): Promise<FxMeasure[]> {
  return page.evaluate(() => {
    const card = document.getElementById("fx-card")!;
    const cardBox = card.getBoundingClientRect();
    const out: FxMeasure[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid^='fx-']"),
    )) {
      if (el.dataset.testid === "fx-verdict-row") continue; // container, not text
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects());
      const groups = new Map<number, DOMRect[]>();
      for (const rc of rects) {
        const t = Math.round(rc.top);
        const g = groups.get(t);
        if (g) g.push(rc);
        else groups.set(t, [rc]);
      }
      const tops = [...groups.keys()].sort((a, b) => a - b);
      const lineW = (t: number) => {
        const rs = groups.get(t)!;
        return Math.max(...rs.map((x) => x.right)) - Math.min(...rs.map((x) => x.left));
      };
      const contentW =
        el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      out.push({
        id: el.dataset.testid!,
        variant: el.dataset.variant ?? "",
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        whiteSpace: cs.whiteSpace,
        lines: tops.length,
        firstLineW: tops.length ? lineW(tops[0]) : 0,
        lastLineW: tops.length ? lineW(tops[tops.length - 1]) : 0,
        contentW,
        insideCard:
          r.left >= cardBox.left - 1 &&
          r.right <= cardBox.right + 1 &&
          r.width <= cardBox.width + 1,
      });
    }
    return out;
  });
}

function assertContainment(ms: FxMeasure[]) {
  for (const m of ms) {
    expect(m.scrollW, `${m.id}: horizontal spill (scrollWidth > clientWidth)`).toBeLessThanOrEqual(
      m.clientW + 1,
    );
    expect(m.scrollH, `${m.id}: vertical clip (scrollHeight > clientHeight)`).toBeLessThanOrEqual(
      m.clientH + 1,
    );
    expect(m.insideCard, `${m.id}: rect spills past the card edge`).toBe(true);
    if (!SKIP_WHITESPACE.has(m.id)) {
      expect(m.whiteSpace, `${m.id}: computed white-space is nowrap`).not.toBe("nowrap");
    }
  }
}

function assertReadability(ms: FxMeasure[], width: number) {
  const byId = new Map(ms.map((m) => [m.id, m]));
  // Line budget: ≤2 at 390/360/320, ≤3 at 195 (390@200%). Below 195
  // CSS px (320@200%) the 24px floor (spec §3) is hard and geometry
  // rules — the synthetic max needs 5 lines at 160px. That is wrap,
  // not clip: containment still holds, which is the guarantee. No line
  // budget is asserted below 195px.
  if (width >= 195) {
    const maxLines = width >= 320 ? 2 : 3;
    for (const id of ["fx-headline-1", "fx-headline-2", "fx-headline-3", "fx-headline-4"]) {
      const m = byId.get(id)!;
      expect(m.lines, `${id}: headline wraps past ${maxLines} lines`).toBeLessThanOrEqual(maxLines);
    }
  }
  for (const m of ms) {
    if (SKIP_ORPHAN.has(m.id) || m.lines <= 1) continue;
    const ratio = m.lastLineW / m.contentW;
    expect(ratio, `${m.id}: orphaned final line (${m.lastLineW.toFixed(0)}px of ${m.contentW.toFixed(0)}px)`).toBeGreaterThan(0.25);
  }
}

const WIDTHS = [
  { width: 390, label: "390@100%" },
  { width: 360, label: "360@100%" },
  { width: 320, label: "320@100%" },
  { width: 195, label: "390@200%" },
  { width: 160, label: "320@200%" },
];

for (const { width, label } of WIDTHS) {
  test.describe(`bounded-text fixture @ ${label}`, () => {
    test.use({ viewport: { width, height: 844 } });

    test.beforeEach(async ({ context }) => {
      await serveFixture(context);
    });

    test("containment + readability", async ({ page }) => {
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => document.fonts.ready.then(() => {}));
      await page.waitForTimeout(300);
      const ms = (await measure(page)).filter((m) => !SKIP_CONTRACT.has(m.id));
      expect(ms.length).toBeGreaterThan(15);
      assertContainment(ms);
      assertReadability(ms, width);
    });

    test("§10.1: 10px slack on the worst-case headline first line", async ({ page }) => {
      test.skip(width !== 390, "acceptance width is 390px");
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => document.fonts.ready.then(() => {}));
      const ms = await measure(page);
      const m = ms.find((x) => x.id === "fx-headline-4")!; // longest §9 headline
      const slack = m.contentW - m.firstLineW;
      expect(
        slack,
        `worst-case first line needs ≥10px slack (got ${slack.toFixed(1)}px)`,
      ).toBeGreaterThanOrEqual(10);
    });

    test("§10.2: keep-together measurement (balance-only vs spans)", async ({ page }) => {
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => document.fonts.ready.then(() => {}));
      const ms = await measure(page);
      const rows = ["fx-keep-balance", "fx-keep-spans"].map((id) => {
        const m = ms.find((x) => x.id === id)!;
        return {
          id,
          lines: m.lines,
          orphanRatio: m.lastLineW / m.contentW,
          spills: m.scrollW > m.clientW + 1,
        };
      });
      // Measurement only — the decision is documented in SPEC_CHECKLIST.md.
      // eslint-disable-next-line no-console
      console.log(`[keep-together @ ${label}]`, JSON.stringify(rows));
      // The balance-only variant is the contract: it must keep the budget
      // at every width. The spans variant is the rejected alternative —
      // at 160px its nowrap spans SPILL (the containment battery catches
      // it), which is why §10.2 resolves to balance-only.
      const balance = rows[0];
      if (width >= 195) {
        const maxLines = width >= 320 ? 2 : 3;
        expect(balance.lines, `balance-only: line count`).toBeLessThanOrEqual(maxLines);
      }
      expect(balance.spills, "balance-only: must never spill").toBe(false);
    });

    test("§10.3: chip row — wrapped headline takes the full row width", async ({ page }) => {
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => document.fonts.ready.then(() => {}));
      const headline = page.locator('[data-testid="fx-row-headline"]');
      const row = page.locator('[data-testid="fx-verdict-row"]');
      const chip = page.locator('[data-testid="fx-row-chip"]');
      const lines = await headline.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const tops = new Set(
          Array.from(range.getClientRects()).map((r) => Math.round(r.top)),
        );
        return tops.size;
      });
      expect(lines, "row headline must wrap (the chip must not steal its width)").toBeGreaterThanOrEqual(2);
      const [rowBox, hBox] = await Promise.all([row.boundingBox(), headline.boundingBox()]);
      expect(rowBox && hBox, "row + headline boxes").toBeTruthy();
      if (rowBox && hBox) {
        expect(
          hBox.width / rowBox.width,
          "wrapped headline must take the full row width",
        ).toBeGreaterThanOrEqual(0.85);
      }
      // The chip keeps one line (spec §4 DO NOT ADOPT).
      const chipLines = await chip.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
      });
      expect(chipLines, "chip must stay one line").toBe(1);
    });
  });
}

test.describe("bounded-text fixture: stress passes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ context }) => {
    await serveFixture(context);
  });

  test("WCAG 1.4.12 text-spacing stress: no clipping", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    await page.addStyleTag({
      content:
        "#fx-card * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }",
    });
    await page.waitForTimeout(300);
    const ms = await measure(page);
    assertContainment(ms);
  });

  test("red-team: font load failure (fallback serif) — no clipping", async ({
    page,
    context,
  }) => {
    await context.route(/\.woff2$/, (route) => route.abort());
    await page.goto(FIXTURE_URL);
    await page.waitForTimeout(500);
    const ms = await measure(page);
    assertContainment(ms);
  });
});

/**
 * Dev-only tripwire (§6a): runs ONLY against a development build
 * (import.meta.env.DEV is false in the prod artifact, so the tripwire
 * compiles out there). Run:
 *   GITHUB_PAGES=1 node scripts/with-app-env.mjs vite build --mode development
 *   BOUNDED_TRIPWIRE=1 KOFI_E2E_DIST=dist/client npx playwright test bounded-text.mobile.spec.ts -g "tripwire"
 * then rebuild prod with npm run build:pages.
 */
test.describe("tripwire (dev build only)", () => {
  test.skip(
    process.env.BOUNDED_TRIPWIRE !== "1",
    "requires a development build (BOUNDED_TRIPWIRE=1)",
  );
  test.use({ viewport: { width: 390, height: 844 } });

  test("clean card trips nothing; forced overflow trips the wire", async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await serveBuiltArtifact(context);
    await startGlobeRun(page);
    await dismissTileOverlayIfPresent(page);
    await commitMiss(page);
    await expect(page.locator(".result-card")).toBeVisible();

    // Clean card: the guarantee holds, the wire stays quiet.
    expect(
      await page.locator('[data-overflow="true"]').count(),
      "clean card must trip zero overflow markers",
    ).toBe(0);

    // Forced overflow: shrink the headline box to 10px. The
    // ResizeObserver must mark it and log the [BoundedText] error.
    await page
      .locator(".verdict-headline")
      .evaluate((el) => ((el as HTMLElement).style.width = "10px"));
    await expect(
      page.locator('.verdict-headline[data-overflow="true"]'),
    ).toBeAttached({ timeout: 10_000 });
    expect(
      errors.some((e) => e.includes("[BoundedText]")),
      `expected a [BoundedText] console.error, got: ${JSON.stringify(errors.slice(0, 3))}`,
    ).toBe(true);
  });
});
