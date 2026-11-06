import { test, expect, type BrowserContext } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Detective flag wiring (U9): the Holmes & Watson pair ships dark
 * behind the `detectivePair` flag.
 *
 * - Served with the artifact's flags.json AS COMMITTED (the flag key
 *   present, value false) → no detective host exists in the DOM on a
 *   GeoDetective case: the game is byte-identical to today.
 * - Served with a route-intercepted flags.json flipping the flag true
 *   → the host mounts on the case.
 *
 * The interception follows the feature-flags.spec.ts pattern: the
 * route is registered AFTER serveBuiltArtifact, so it wins for the
 * flags.json request.
 */

const APP = "http://127.0.0.1:4123/Meridian/?loop-puzzle=137";
const FLAGS_PATTERN = "**/flags.json";

async function fulfillFlags(
  context: BrowserContext,
  detectivePair: boolean,
) {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair,
        },
      }),
    });
  });
}

async function openCase(page: import("playwright/test").Page) {
  await page.goto(APP);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("heading", { name: "GeoDetective" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("flag off (committed flags.json): no detective host in the DOM", async ({
  page,
}) => {
  // No interception: the built artifact serves public/flags.json as
  // committed, where detectivePair is present and false.
  await openCase(page);
  // Give a (hypothetical) host every chance to mount, then assert the
  // pair's DOM simply does not exist.
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("detective-station")).toHaveCount(0);
  await expect(page.getByTestId("detective-host")).toHaveCount(0);
  await expect(page.locator("[data-detective]")).toHaveCount(0);
});

test("flag on (intercepted flags.json): the host mounts on the case", async ({
  page,
  context,
}) => {
  await fulfillFlags(context, true);
  await openCase(page);
  const station = page.getByTestId("detective-station");
  await expect(station).toBeVisible({ timeout: 20_000 });
  // The U9 degradation summary rides the host root.
  await expect
    .poll(() => station.getAttribute("data-degradation"), {
      timeout: 10_000,
    })
    .toMatch(/^companion:(full|dock-only),walk:(animated|cut),speech:(auto|tap|off)$/);
});
