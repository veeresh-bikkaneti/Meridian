import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Q2 hero-film cap (Round 2, owner's Variant B pick): on desktop the
 * Why Learn hero film is capped by viewport height so the first
 * subject-card row just peeks into view (~50px) instead of sitting
 * below the fold. Behaviour assertions only: the film keeps 16/9 and
 * the first card row's visible slice lands in the 35–65px band at
 * both 1280×800 and 1920×1080.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    (key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: "10-18",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    PROFILE_KEY,
  );
}

async function openPicker(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]) {
  test(`hero film capped, first card row peeks at ${viewport.width}x${viewport.height}`, async ({
    page,
    context,
  }) => {
    await setup(context);
    await page.setViewportSize(viewport);
    await openPicker(page);

    const film = page.locator(".why-learn-hero").first();
    await expect(film).toBeVisible();
    const filmBox = await film.boundingBox();
    expect(filmBox).not.toBeNull();

    // The row slot (the grid <li>), not the card button inside it:
    // the button carries the home-rise entrance animation, so its
    // box sits lower until the rise settles. The row's layout
    // position is what the cap promises.
    await expect(page.locator('[data-testid^="subject-row-"]').first()).toBeVisible();
    const firstCard = page.locator('[data-testid="subject-cards"] li').first();
    const cardBox = await firstCard.boundingBox();
    expect(cardBox).not.toBeNull();

    // The film keeps its 16/9 frame (within 2%).
    const ratio = filmBox!.width / filmBox!.height;
    expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.04);

    // The first card row's top is inside the viewport and only a
    // ~50px slice of the row shows (the rest stays below the fold).
    const visiblePx = viewport.height - cardBox!.y;
    expect(cardBox!.y).toBeLessThan(viewport.height);
    expect(visiblePx).toBeGreaterThanOrEqual(35);
    expect(visiblePx).toBeLessThanOrEqual(65);
    expect(visiblePx).toBeLessThan(cardBox!.height);
  });
}
