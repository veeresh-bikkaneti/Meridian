/**
 * High-contrast view E2E (Council manifest 2026-10-27-high-contrast-view,
 * Councilor B's contracts; built Pages artifact via serveBuiltArtifact).
 *
 * The feature: a settings toggle (home `high-contrast-toggle`, in-game
 * `high-contrast-toggle-game`) persisted under localStorage
 * `meridian.palette` ("high-contrast" / "standard" — selectPalette's
 * token language), applied as `data-palette="high-contrast"` on the
 * root element, whose styles.css block overrides the five --map-*
 * tokens with the HIGH_CONTRAST palette.
 *
 * Assertions are feature-level, never label-only (the 2026-10-20 Scout
 * lesson): the COMPUTED --map-land / --map-water values must actually
 * change to the HIGH_CONTRAST hexes, persistence must survive a real
 * reload, a mid-run swap must not navigate or lose the round, and a
 * corrupt stored value must fail closed to standard with the app
 * still booting and playing. No canvas pixel sampling (software
 * rendering varies across machines).
 */
import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, readPhase, APP_NO_IDLE } from "./helpers";

test.setTimeout(180_000);

const PALETTE_KEY = "meridian.palette";
const HC_LAND = "#f6f3ea";
const HC_WATER = "#0b0d10";

async function dataPalette(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute("data-palette"));
}

async function mapVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

async function storedPalette(page: Page): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), PALETTE_KEY);
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("toggle on applies high contrast without navigation, toggle off restores standard", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const urlBefore = page.url();
  const landBefore = await mapVar(page, "--map-land");
  expect(landBefore).not.toBe(HC_LAND);
  expect(await dataPalette(page)).toBeNull();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await dataPalette(page)).toBe("high-contrast");
  expect(await mapVar(page, "--map-land")).toBe(HC_LAND);
  expect(await mapVar(page, "--map-water")).toBe(HC_WATER);
  expect(await storedPalette(page)).toBe("high-contrast");
  expect(page.url()).toBe(urlBefore);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await dataPalette(page)).toBeNull();
  expect(await mapVar(page, "--map-land")).toBe(landBefore);
  expect(await storedPalette(page)).toBe("standard");
  expect(page.url()).toBe(urlBefore);
});

test("toggle pressed state is visible: computed background differs on and off", async ({ page }) => {
  // Panel BLOCK 3 (UX Designer): aria-pressed alone is invisible to the
  // sighted low-vision users this feature serves. The pressed treatment
  // (brass fill, the .atlas-seg pattern) must change the toggle's
  // COMPUTED background-color between states on the home placement.
  await page.goto(APP_NO_IDLE);
  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const bgOff = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  const colorOff = await toggle.evaluate((el) => getComputedStyle(el).color);
  // Chromium serializes the standard rgba(0,0,0,0.38) dot as #00000061;
  // capture the initial computed value and compare against it, not the
  // authored spelling.
  const dotBefore = await mapVar(page, "--map-pin-dot");
  expect(["rgba(0,0,0,0.38)", "#00000061"]).toContain(dotBefore);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const bgOn = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  const colorOn = await toggle.evaluate((el) => getComputedStyle(el).color);
  expect(bgOn).not.toBe(bgOff);
  expect(colorOn).not.toBe(colorOff);
  // The pin centre-dot seam (D9 condition (f)): standard dot is the
  // translucent value; under high contrast the computed var goes solid.
  expect(await mapVar(page, "--map-pin-dot")).toBe("#f6f3ea");
  expect(await mapVar(page, "--map-pin")).toBe("#b04a9e");
  expect(await mapVar(page, "--map-answer")).toBe("#a86c00");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const bgBack = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgBack).toBe(bgOff);
  expect(await mapVar(page, "--map-pin-dot")).toBe(dotBefore);
});

test("high contrast persists across reload", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("high-contrast-toggle").click();
  expect(await storedPalette(page)).toBe("high-contrast");

  await page.reload();
  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await dataPalette(page)).toBe("high-contrast");
  expect(await mapVar(page, "--map-land")).toBe(HC_LAND);
});

test("live swap in a run does not navigate or lose the round", async ({ page }) => {
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");
  const urlBefore = page.url();

  const toggle = page.getByTestId("high-contrast-toggle-game");
  await expect(toggle).toBeVisible();
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await dataPalette(page)).toBe("high-contrast");
  expect(await mapVar(page, "--map-land")).toBe(HC_LAND);
  expect(await storedPalette(page)).toBe("high-contrast");
  // Still in the same run: no navigation home, aim phase intact.
  expect(page.url()).toBe(urlBefore);
  expect(await readPhase(page)).toBe("aim");
  await expect(page.locator(".satellite-map")).toBeVisible();
});

/**
 * Measured surface contrasts on the game screen (Review Round 2, bug
 * 11): ratios computed from real computed styles — the game-chrome
 * panel's border and text, a probe carrying the shared --line border
 * and the secondary text tokens on --surface. Colours are normalized
 * through a 1x1 canvas because Chromium serializes color-mix() results
 * in 0..1 component form, which regex parsing misreads.
 */
async function surfaceContrasts(page: Page) {
  return page.evaluate(() => {
    type RGBA = { r: number; g: number; b: number; a: number };
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = 1;
    const ctx = cvs.getContext("2d", { willReadFrequently: true })!;
    const parse = (s: string): RGBA => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const over = (fg: RGBA, bg: RGBA): RGBA => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c: RGBA): number => {
      const f = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a: RGBA, b: RGBA): number => {
      const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const base = (() => {
      const p = document.createElement("div");
      p.style.background = "var(--bg)";
      document.body.appendChild(p);
      const v = parse(getComputedStyle(p).backgroundColor);
      p.remove();
      return v;
    })();
    const effBg = (el: Element): RGBA => {
      const layers: RGBA[] = [];
      let node: Element | null = el;
      while (node && node !== document.documentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg.a > 0) layers.push(bg);
        node = node.parentElement;
      }
      let acc = base;
      for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
      return acc;
    };
    const out: Record<string, number> = {};
    const chrome = document.querySelector(".game-chrome")!;
    const chromeBg = effBg(chrome);
    const chromeCs = getComputedStyle(chrome);
    out.chromeBorder = ratio(over(parse(chromeCs.borderTopColor), chromeBg), chromeBg);
    out.chromeText = ratio(parse(chromeCs.color), chromeBg);
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;top:0;background:var(--surface);border:1px solid var(--line);color:var(--muted)";
    probe.innerHTML =
      '<span id="pz-sub" style="color:var(--subtle)">s</span><span id="pz-faint" style="color:var(--atlas-faint)">f</span>';
    document.body.appendChild(probe);
    const pBg = effBg(probe);
    const pCs = getComputedStyle(probe);
    out.lineBorder = ratio(over(parse(pCs.borderTopColor), pBg), pBg);
    out.mutedText = ratio(parse(pCs.color), pBg);
    out.subtleText = ratio(parse(getComputedStyle(probe.querySelector("#pz-sub")!).color), pBg);
    out.atlasFaintText = ratio(parse(getComputedStyle(probe.querySelector("#pz-faint")!).color), pBg);
    probe.remove();
    return out;
  });
}

test("high contrast is visibly obvious: measured surface ratios clear WCAG bars only when on", async ({
  page,
}) => {
  // Bug 11: item 37 strengthened only --line (2.77:1 on) and never
  // touched the game chrome's border token, which measured 1.47:1 with
  // the toggle OFF *and* ON — the flip was still invisible where the
  // player actually looks. WCAG bars: 3:1 non-text (1.4.11), 4.5:1
  // text (1.4.3). On main (no chrome block at all) every ON assertion
  // below fails.
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");
  const off = await surfaceContrasts(page);
  expect(off.chromeBorder).toBeLessThan(3);
  expect(off.lineBorder).toBeLessThan(3);

  const toggle = page.getByTestId("high-contrast-toggle-game");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const on = await surfaceContrasts(page);
  expect(on.chromeBorder).toBeGreaterThanOrEqual(3);
  expect(on.lineBorder).toBeGreaterThanOrEqual(3);
  expect(on.chromeText).toBeGreaterThanOrEqual(4.5);
  expect(on.mutedText).toBeGreaterThanOrEqual(4.5);
  expect(on.subtleText).toBeGreaterThanOrEqual(4.5);
  expect(on.atlasFaintText).toBeGreaterThanOrEqual(4.5);
  // The flip must move the needle, not just relabel it.
  expect(on.chromeBorder).toBeGreaterThan(off.chromeBorder + 1);
  expect(on.lineBorder).toBeGreaterThan(off.lineBorder + 1);
});

test("corrupt stored value falls back to standard and the app still boots and plays", async ({
  page,
}) => {
  await page.addInitScript((k) => {
    try {
      localStorage.setItem(k, "banana");
    } catch {
      // Storage seeding is best-effort; the assertions below are the test.
    }
  }, PALETTE_KEY);
  await page.goto(APP_NO_IDLE);

  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await dataPalette(page)).toBeNull();
  expect(await mapVar(page, "--map-land")).not.toBe(HC_LAND);

  // The game still starts and reaches the aim phase on the fallback.
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");
  expect(await dataPalette(page)).toBeNull();
});
