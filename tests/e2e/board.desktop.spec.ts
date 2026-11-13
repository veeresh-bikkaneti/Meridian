import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * /board — live scrum board + feature map (feat/live-scrum-board).
 *
 * Runs against the built Pages artifact. The GitHub API is mocked to
 * FAIL in every test here: the board must render all 8 lanes and all 46
 * stories from the snapshot alone, say it is showing the snapshot, and
 * never depend on the live fetch. The feature-request endpoint is
 * mocked too — the spec proves the form posts to /api/feature-request,
 * not that Discord received anything.
 */
test.setTimeout(180_000);

const BOARD_URL = "http://127.0.0.1:4123/Meridian/board?idle-ms=3600000";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // SPA fallback for the deep link (same pattern as the credits spec:
  // the static mirror has no deep-link server in this harness).
  const shell = readFileSync("dist/client/_shell.html");
  await context.route("**/Meridian/board*", async (route) => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ status: 200, body: shell, contentType: "text/html; charset=utf-8" });
    }
    return route.fallback();
  });
  // GitHub live data: fail it. The snapshot must carry the page.
  await context.route("https://api.github.com/**", async (route) => route.abort());
});

async function openBoard(page: import("playwright/test").Page) {
  await page.goto(BOARD_URL);
  await expect(page.getByTestId("board-page")).toBeVisible();
  await expect(page.getByTestId("board-live-line")).toContainText("snapshot");
}

test("board at 390px: list view renders all 8 lanes from the snapshot, no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);

  // Scrum columns carry the snapshot counts (18 done / 10 in progress /
  // 18 not started) even with GitHub unreachable.
  await expect(page.getByTestId("scrum-column-done").getByTestId("story-card")).toHaveCount(18);
  await expect(page.getByTestId("scrum-column-in-progress").getByTestId("story-card")).toHaveCount(10);
  await expect(page.getByTestId("scrum-column-not-started").getByTestId("story-card")).toHaveCount(18);

  await page.getByTestId("list-view-toggle").click();
  const list = page.getByTestId("board-list-view");
  await expect(list.getByTestId("board-lane")).toHaveCount(8);
  await expect(list.getByTestId("story-card")).toHaveCount(46);
  await expect(list).toContainText("Detective core");
  await expect(list).toContainText("Infra and process");

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("board at desktop: form posts to /api/feature-request (mocked)", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let postedUrl = "";
  let postedBody = "";
  await context.route("**/api/feature-request", async (route) => {
    postedUrl = route.request().url();
    postedBody = route.request().postData() ?? "";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, stored: true }),
    });
  });
  await openBoard(page);

  const form = page.getByTestId("feature-request-form");
  await form.locator("textarea").fill("A quiz about famous rivers, please");
  await form.locator("select").first().selectOption("7-10");
  await form.locator("select").nth(1).selectOption("Geography");
  await form.getByRole("button", { name: "Send idea" }).click();

  await expect(page.getByTestId("feature-request-sent")).toBeVisible();
  expect(postedUrl).toContain("/api/feature-request");
  const payload = JSON.parse(postedBody) as { idea: string; ageGroup: string; subject: string };
  expect(payload.idea).toBe("A quiz about famous rivers, please");
  expect(payload.ageGroup).toBe("7-10");
  expect(payload.subject).toBe("Geography");
  // No personal-data fields exist in the payload, by design.
  expect(Object.keys(payload).sort()).toEqual(["ageGroup", "idea", "subject", "turnstileToken", "website"]);
});

test("no Home or game screen links to /board", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  // Home renders the game shell; give it a moment to mount, then check
  // the whole DOM for any board link.
  await page.waitForTimeout(3000);
  const boardLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]")).filter((a) =>
      (a.getAttribute("href") ?? "").includes("/board"),
    ).length;
  });
  expect(boardLinks).toBe(0);
});
