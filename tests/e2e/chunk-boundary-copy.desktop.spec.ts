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
 * after a reload the persisted loop-open flag restores GeoDetective,
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

test("a GeoDetective chunk failure names GeoDetective, not the map (#210)", async ({
  context,
  page,
}) => {
  await serveBuiltArtifact(context);
  await abortLoopChunk(context);
  await openGeoDetective(page);

  const card = page.getByRole("alert").filter({
    hasText: "Couldn’t load GeoDetective.",
  });
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

  const card = page.getByRole("alert").filter({
    hasText: "A new version of Meridian is available.",
  });
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(
    card.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  await expect(card).toContainText("Your game is safe");
});
