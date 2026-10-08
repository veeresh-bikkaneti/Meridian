/**
 * Scout Map FALSE-DEMOTION golden (P0, PBI-9b).
 *
 * A capable device — spoofed discrete-GPU renderer, 8 GB deviceMemory,
 * DPR 2 — must NEVER land in scout mode, on ANY boot path:
 *   1. cold boot
 *   2. crash-resume-to-menu (previous kill state, lands on menu)
 *   3. idle-kill return (session killed, new run from home)
 *
 * Goldens: no scout-boot-offer modal without the crash flag, no scout
 * mode on the map, satellite tiles ARE requested (scout loads none),
 * maxZoom stays 8 (data-max-zoom contract).
 *
 * The capable spoof is required because this VM's real Chromium reports
 * a SwiftShader renderer (it would — correctly — qualify scout).
 */
import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  APP_NO_IDLE,
} from "./helpers";
import {
  spoofCapableDevice,
  offerModal,
  readMapMode,
  mapWrapper,
} from "./scout-helpers";

// 1x1 transparent PNG (same stub the shared helpers serve for tiles).
const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64",
);

test.setTimeout(180_000);
// Capable phone: DPR 2, touch.
test.use({ deviceScaleFactor: 2, viewport: { width: 390, height: 844 }, hasTouch: true });

/** serveBuiltArtifact + a satellite-tile request counter (registered after,
 *  so it wins for the tile host per Playwright's reverse route order). */
async function serveWithTileCounter(
  context: import("playwright/test").BrowserContext,
): Promise<{ tileRequests: () => number }> {
  let n = 0;
  await serveBuiltArtifact(context);
  await context.route("https://server.arcgisonline.com/**", async (route) => {
    n += 1;
    await route.fulfill({
      status: 200,
      body: TILE_STUB,
      contentType: "image/png",
    });
  });
  return { tileRequests: () => n };
}

async function expectFullMode(page: Page, tileRequests: () => number): Promise<void> {
  // No offer without the crash flag (settle: the offer fires at boot).
  await page.waitForTimeout(5_000);
  await expect(offerModal(page)).toBeHidden();

  // Map mounts in full mode.
  await expect(mapWrapper(page)).toBeVisible({ timeout: 60_000 });
  expect(await readMapMode(page)).not.toBe("scout");

  // Full mode loads satellite tiles; scout loads none.
  await expect
    .poll(() => tileRequests(), { timeout: 60_000 })
    .toBeGreaterThan(0);

  // maxZoom stays 8 on capable devices (data-max-zoom contract).
  const maxZoom = await mapWrapper(page).getAttribute("data-max-zoom");
  if (maxZoom !== null) {
    expect(maxZoom).toBe("8");
  }
}

test("cold boot: capable device never demotes", async ({ context }) => {
  await spoofCapableDevice(context);
  const { tileRequests } = await serveWithTileCounter(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await startGlobeRun(page);
  await expectFullMode(page, tileRequests);
  expect(await readPhase(page)).toBe("aim");
  await page.close();
});

test("crash-resume-to-menu: capable device never demotes", async ({
  context,
}) => {
  await spoofCapableDevice(context);
  // Mirror observability.spec.ts: a previous kill's state — cleanExit "0"
  // plus a breadcrumb — makes the next boot land on the menu.
  await context.addInitScript(() => {
    sessionStorage.setItem("meridian.cleanExit", "0");
    sessionStorage.setItem(
      "meridian.breadcrumb",
      JSON.stringify({
        lastMilestone: "data_chunk_load_start",
        sessionId: "qa-crash-resume",
      }),
    );
  });
  const { tileRequests } = await serveWithTileCounter(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  // Lands on the menu (crash-loop breaker intact), never in a run.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(offerModal(page)).toBeHidden();

  // Start a run from the menu: still full, still no offer.
  await startGlobeRun(page);
  await expectFullMode(page, tileRequests);
  await page.close();
});

test("idle-kill return: capable device never demotes", async ({ context }) => {
  await spoofCapableDevice(context);
  const { tileRequests } = await serveWithTileCounter(context);
  const page = await context.newPage();

  // Short idle timeout: the session is killed and the app returns home.
  await page.goto("http://127.0.0.1:4123/Meridian/?idle-ms=4000");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText("Your game ended after 2 minutes of inactivity."),
  ).toBeVisible();

  // Return: new run from home after the idle kill — no offer, no demotion.
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect.poll(() => readPhase(page), { timeout: 60_000 }).toBe("aim");
  await expectFullMode(page, tileRequests);
  await page.close();
});
