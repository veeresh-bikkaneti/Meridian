/**
 * #210 — the chunk-failure card tells the truth about what failed.
 *
 * MapErrorBoundary wraps GeoDetective and Cold Trail as well as the
 * map, but its card always said "Couldn't load the map." It also had
 * no idea whether the tab was simply stale: a deploy-rotted chunk got
 * the generic card instead of the approved new-version prompt.
 *
 * Both legs drive the REAL failure: the lazy LoopScreen chunk request
 * is aborted at the network layer, so the import rejects for real and
 * the boundary — not a test double — renders the card.
 *
 * Note on chunk-recovery (#245): a real chunk failure may also fire
 * the one-shot auto-reload. Both legs are written reload-tolerant:
 * after a reload the entry rule (owner, 2026-11-08) lands the player
 * on Home, so the helper re-opens GeoDetective from its Home card,
 * the chunk fails again, and the same card reappears (the recovery
 * latch blocks further reloads). Assertions poll for the settled
 * state, never a first paint.
 */
import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

test.setTimeout(240_000);

async function abortLoopChunk(
  context: import("playwright/test").BrowserContext,
) {
  await context.route("**/assets/LoopScreen-*", (route) => route.abort());
}

async function openGeoDetective(
  page: import("playwright/test").Page,
) {
  await page.goto(APP_NO_IDLE);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
}

/**
 * Poll for the boundary card, re-opening GeoDetective from Home
 * whenever the chunk-recovery auto-reload has landed the player there
 * (entry rule, owner 2026-11-08: a reload lands on Home, never back
 * inside the edition). Returns once the card is visible; the final
 * expect in each test still makes the assertion that fails the spec.
 */
async function expectBoundaryCard(
  page: import("playwright/test").Page,
  cardText: string,
) {
  const card = page.getByRole("alert").filter({ hasText: cardText });
  const entry = page.getByRole("button", {
    name: /GeoDetective: (Solve a mystery|Resume your case)/,
  });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await card.isVisible().catch(() => false)) return card;
    if (await entry.isVisible().catch(() => false)) {
      await entry.click().catch(() => {});
      await page.waitForTimeout(2_000);
    } else {
      await page.waitForTimeout(1_000);
    }
  }
  return card;
}

test("a GeoDetective chunk failure names GeoDetective, not the map (#210)", async ({
  context,
  page,
}) => {
  await serveBuiltArtifact(context);
  await abortLoopChunk(context);
  await openGeoDetective(page);

  const card = await expectBoundaryCard(page, "Couldn’t load GeoDetective.");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card).toContainText("Your game is safe");
  await expect(
    card.getByRole("button", { name: "Try again" }),
  ).toBeVisible();
  // The old copy's false claim must not appear anywhere on the card.
  await expect(page.getByText("Couldn’t load the map.")).toHaveCount(0);
});

test("a stale tab's chunk failure becomes the new-version prompt (#210)", async ({
  context,
  page,
}) => {
  await serveBuiltArtifact(context);
  await abortLoopChunk(context);
  // The stale-deploy recipe (cf. chunk-recovery 6-E): the server's
  // build-meta names a different build than this tab's bundle.
  await context.route("**/build-meta.json", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ buildId: "e2e-different-build" }),
    });
  });
  await openGeoDetective(page);

  const card = await expectBoundaryCard(page, "A new version of Meridian is available.");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(
    card.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  await expect(card).toContainText("Your game is safe");
});
