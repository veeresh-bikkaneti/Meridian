import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  tapHitsMap,
  commitPin,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * Place-card collapse redesign E2E (owner order 2026-10-11) — black-box
 * journey on the built app at 390×844 (mobile project).
 *
 * The owner's phone showed the question card filling most of the viewport,
 * with "Hide place name" hiding only the text (the footprint stayed) and
 * the "End game" pill overlapping the card's X. The redesign: the card is
 * COMPACT by default (name + meta band + toggle), the name never folds
 * away, only the instructions expand/collapse, and End game docks
 * bottom-right — clear of everything.
 *
 *  - card compact on load: the shell's footprint stays under 40% of the
 *    viewport height; the name is visible; the instructions are folded.
 *  - expand shows details: "Show instructions" → hint text appears,
 *    aria-expanded flips to true.
 *  - collapse frees the map: the shell shrinks, and a point the expanded
 *    card covered now hits the map canvas (elementFromPoint).
 *  - X clear of End game: getBoundingClientRect geometry — 0px² overlap,
 *    both targets ≥44px.
 *  - drop pin still works: tap the freed map point → Drop pin enables →
 *    commit → the round leaves the aim phase.
 *
 * Runs in the "mobile" project (viewport 390x844, touch).
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Suppress Grandpa's tour and the tutorial invite so the game chrome is bare. */
async function seedQuiet(page: Page): Promise<void> {
  await page.context().addInitScript(
    (seeds: Record<string, string>) => {
      try {
        for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
      } catch {
        /* private mode — ignore */
      }
    },
    {
      "meridian.grandpaTour.lastDate": todayKey(),
      "meridian.tutorialSeen": "1",
    },
  );
}

const shell = (page: Page) => page.locator(".bubble-shell").first();
const showInstructions = (page: Page) =>
  page.getByRole("button", { name: "Show instructions" });
const hideInstructions = (page: Page) =>
  page.getByRole("button", { name: "Hide instructions" });
const dismissX = (page: Page) =>
  page.getByRole("button", { name: "Hide question" });
const endGame = (page: Page) => page.getByRole("button", { name: "End game" });

async function shellBox(page: Page) {
  const box = await shell(page).boundingBox();
  if (!box) throw new Error("question card shell has no bounding box");
  return box;
}

function overlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ix = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const iy = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return ix * iy;
}

test("card is compact on load: footprint under 40% of the 844px viewport", async ({
  page,
}) => {
  await seedQuiet(page);
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);

  // Compact by default on mobile: the toggle offers to SHOW instructions.
  await expect(showInstructions(page)).toBeVisible({ timeout: 15_000 });
  // The name (the question) is visible even in the compact card.
  await expect(page.locator(".bubble-scroll h2.place-name")).toBeVisible();
  // The instructions are folded: no hint text in the DOM.
  await expect(page.locator(".bubble-hint")).toBeHidden();

  const box = await shellBox(page);
  const vp = page.viewportSize() ?? { width: 390, height: 844 };
  console.log(
    `compact shell=(${box.x.toFixed(0)},${box.y.toFixed(0)},${box.width.toFixed(0)}x${box.height.toFixed(0)}) viewport=${vp.width}x${vp.height}`,
  );
  expect(
    box.height,
    "compact card must never take the whole screen (<40% of viewport height)",
  ).toBeLessThan(vp.height * 0.4);
});

test("expand shows the instructions; the toggle names its state", async ({
  page,
}) => {
  await seedQuiet(page);
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);

  await showInstructions(page).click();
  const hide = hideInstructions(page);
  await expect(hide).toBeVisible({ timeout: 10_000 });
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  // The instructions unfold: the gesture hint is on screen.
  const hint = page.locator(".bubble-hint");
  await expect(hint).toBeVisible({ timeout: 10_000 });
  await expect(hint).toContainText("Tap the map");
  // The name is still there — expanding adds, never swaps.
  await expect(page.locator(".bubble-scroll h2.place-name")).toBeVisible();
});

test("collapse frees the map: a point the open card covered now hits canvas", async ({
  page,
}) => {
  await seedQuiet(page);
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);

  // Open the card to its full footprint, then collapse it.
  await showInstructions(page).click();
  await expect(hideInstructions(page)).toBeVisible({ timeout: 10_000 });
  const openBox = await shellBox(page);
  await hideInstructions(page).click();
  await expect(showInstructions(page)).toBeVisible({ timeout: 10_000 });
  const shutBox = await shellBox(page);
  console.log(
    `open h=${openBox.height.toFixed(0)} → collapsed h=${shutBox.height.toFixed(0)}`,
  );
  expect(
    shutBox.height,
    "collapsing must shrink the card's footprint",
  ).toBeLessThan(openBox.height);

  // A point the OPEN card covered but the collapsed card leaves bare.
  const px = 195;
  const py = Math.round(shutBox.y + shutBox.height + 40);
  expect(py, "probe point must sit below the collapsed card").toBeGreaterThan(
    shutBox.y + shutBox.height,
  );
  expect(py, "probe point must have been under the open card").toBeLessThan(
    openBox.y + openBox.height,
  );
  expect(
    await tapHitsMap(page, px, py),
    `tap at (${px},${py}) must reach the map canvas once the card collapses`,
  ).toBe(true);
});

test("dismiss X is fully tappable and clear of the End game pill", async ({
  page,
}) => {
  await seedQuiet(page);
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);

  const x = dismissX(page);
  const end = endGame(page);
  await expect(x).toBeVisible({ timeout: 15_000 });
  await expect(end).toBeVisible({ timeout: 15_000 });
  const xb = await x.boundingBox();
  const eb = await end.boundingBox();
  if (!xb || !eb) throw new Error("missing button box");
  console.log(
    `X=(${xb.x.toFixed(1)},${xb.y.toFixed(1)},${xb.width.toFixed(1)}x${xb.height.toFixed(1)}) ` +
      `EndGame=(${eb.x.toFixed(1)},${eb.y.toFixed(1)},${eb.width.toFixed(1)}x${eb.height.toFixed(1)}) ` +
      `overlap=${overlapArea(xb, eb).toFixed(1)}px²`,
  );
  expect(xb.width, "X tap target width").toBeGreaterThanOrEqual(44);
  expect(xb.height, "X tap target height").toBeGreaterThanOrEqual(44);
  expect(eb.height, "End game tap target height").toBeGreaterThanOrEqual(44);
  expect(overlapArea(xb, eb), "X × End game must not overlap").toBe(0);
});

test("drop pin still works after the redesign", async ({ page }) => {
  await seedQuiet(page);
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);

  // Collapse the card, then drop a pin on the freed map area: the full
  // pin-drop flow (tap → Drop pin enables → commit → reveal) is intact.
  await showInstructions(page).click();
  await expect(hideInstructions(page)).toBeVisible({ timeout: 10_000 });
  const openBox = await shellBox(page);
  await hideInstructions(page).click();
  await expect(showInstructions(page)).toBeVisible({ timeout: 10_000 });
  const shutBox = await shellBox(page);
  const px = 195;
  const py = Math.round(shutBox.y + shutBox.height + 40);
  expect(py).toBeLessThan(openBox.y + openBox.height);
  expect(await tapHitsMap(page, px, py)).toBe(true);

  const { phase } = await commitPin(page, px, py);
  expect(phase, "committing the pin must leave the aim phase").toMatch(
    /^(story|done)$/,
  );
});
