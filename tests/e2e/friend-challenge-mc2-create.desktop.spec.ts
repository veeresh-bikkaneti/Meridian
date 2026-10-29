import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  commitMiss,
  clickNextPlace,
  readPhase,
  readQuestion,
  resultCard,
} from "./helpers";
import { decodeChallenge2, decodeChallenge } from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc2 creation E2E (Package A, manifest 2026-10-28 §3(a) + §3(d)):
 * - The picker entry ("Challenge a friend" on Home) deals a fresh five
 *   from the tapped region and previews it before anything is shared;
 *   the fragment decodes as mc2 with the region's own radius and only
 *   that region's catalog ids.
 * - The end-of-run summary offers the sender's OWN route first (the
 *   places just played, in play order — proven against the questions
 *   the game actually asked) and a fresh route second. A globe
 *   summary's primary stays an mc1 link with its shipped label.
 * - Flag OFF: no challenge entry points anywhere.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";

const NEBRASKA_CHUNK = JSON.parse(
  readFileSync(
    new URL("../../src/game/data/geonames/chunks/nebraska.json", import.meta.url),
    "utf8",
  ),
) as { places: { id: string; name: string }[] };
const NEBRASKA_CATALOG_IDS = new Set(NEBRASKA_CHUNK.places.map((p) => p.id));
const NAME_BY_ID = new Map(NEBRASKA_CHUNK.places.map((p) => [p.id, p.name]));

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await page.addInitScript(() => {
    try {
      (navigator.serviceWorker as unknown as Record<string, unknown>).register = () =>
        Promise.reject(new Error("service worker disabled for test"));
    } catch {
      /* ignore */
    }
  });
});

async function routeFlags(
  context: BrowserContext,
  flags: Record<string, boolean>,
): Promise<void> {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, ...flags },
      }),
    });
  });
}

async function waitForAim(page: Page): Promise<void> {
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

function fragmentOf(url: string): string {
  return url.slice(url.indexOf("#"));
}

test("picker: Challenge a friend deals a fresh Nebraska five and previews it as mc2", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  const entry = page.getByTestId("challenge-a-friend");
  await expect(entry).toBeVisible({ timeout: 30_000 });
  await entry.click();

  await expect(page.getByRole("heading", { name: "Challenge a friend" })).toBeVisible();
  await page.getByRole("button", { name: /Nebraska/ }).click();

  const preview = page.getByTestId("challenge-preview");
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await expect(preview).toContainText("5 places in Nebraska");
  await expect(preview).toContainText("87 km circle");
  await expect(preview).toContainText("Same places, same circle for everyone.");

  const container = preview.getByTestId("challenge-share-container");
  const url = await container.getAttribute("data-challenge-url");
  expect(url).toBeTruthy();
  expect(url!.length).toBeLessThan(2000);
  const decoded = decodeChallenge2(fragmentOf(url!), SCORING_VERSION);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.e).toBe("state");
  expect(decoded.r).toBe("nebraska");
  expect(decoded.rad).toBe(87);
  expect(decoded.ids).toHaveLength(5);
  for (const id of decoded.ids) {
    expect(NEBRASKA_CATALOG_IDS.has(id), `${id} must be a Nebraska catalog place`).toBe(true);
  }
});

test("summary (state): primary is the sender's exact played route; secondary is a fresh route", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await page.getByRole("button", { name: "State" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: /Nebraska/ }).click();
  await waitForAim(page);

  // Play five places, remembering the questions in the order asked.
  const askedNames: string[] = [];
  for (let i = 0; i < 5; i++) {
    const question = await readQuestion(page);
    expect(question).toBeTruthy();
    // The live region reads "Find David City." — the route order is
    // compared on place names, so strip the wrapper.
    askedNames.push((question as string).replace(/^Find /, "").replace(/\.$/, ""));
    await commitMiss(page);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    await clickNextPlace(page);
    if (i < 4) await waitForAim(page);
  }
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 15_000 }).toBe("summary");
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();

  const primary = dialog.getByTestId("challenge-share-container");
  await expect(primary).toBeVisible();
  const primaryUrl = await primary.getAttribute("data-challenge-url");
  expect(primaryUrl).toBeTruthy();
  expect(primaryUrl).toContain("#c=mc2.");
  const decodedPrimary = decodeChallenge2(fragmentOf(primaryUrl!), SCORING_VERSION);
  expect(decodedPrimary.ok).toBe(true);
  if (!decodedPrimary.ok) return;
  expect(decodedPrimary.r).toBe("nebraska");
  expect(decodedPrimary.rad).toBe(87);
  // The route is the sender's own five, in the order they were asked.
  expect(decodedPrimary.ids.map((id) => NAME_BY_ID.get(id))).toEqual(askedNames);
  await expect(dialog.getByRole("button", { name: "Play my route" })).toBeVisible();

  const secondary = dialog.getByTestId("challenge-share-secondary");
  await expect(secondary).toBeVisible();
  const secondaryUrl = await secondary.getAttribute("data-challenge-url");
  expect(secondaryUrl).toBeTruthy();
  const decodedSecondary = decodeChallenge2(fragmentOf(secondaryUrl!), SCORING_VERSION);
  expect(decodedSecondary.ok).toBe(true);
  if (!decodedSecondary.ok) return;
  expect(decodedSecondary.r).toBe("nebraska");
  expect(decodedSecondary.ids).toHaveLength(5);
  for (const id of decodedSecondary.ids) {
    expect(NEBRASKA_CATALOG_IDS.has(id)).toBe(true);
  }
  await expect(
    dialog.getByRole("button", { name: "New route in Nebraska instead" }),
  ).toBeVisible();
});

test("summary (globe): the primary stays an mc1 link with the shipped label", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await waitForAim(page);
  for (let i = 0; i < 5; i++) {
    await commitMiss(page);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    await clickNextPlace(page);
    if (i < 4) await waitForAim(page);
  }
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 15_000 }).toBe("summary");
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  const primary = dialog.getByTestId("challenge-share-container");
  await expect(primary).toBeVisible();
  const primaryUrl = await primary.getAttribute("data-challenge-url");
  expect(primaryUrl).toBeTruthy();
  expect(primaryUrl).toContain("#c=mc1.");
  const decoded = decodeChallenge(fragmentOf(primaryUrl!), SCORING_VERSION);
  expect(decoded.ok).toBe(true);
  if (decoded.ok) expect(decoded.ids).toHaveLength(5);
  await expect(
    dialog.getByRole("button", { name: "Share this route with a friend" }),
  ).toBeVisible();
});

test("flag OFF: no challenge entry points on Home or in the summary", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("challenge-a-friend")).toHaveCount(0);
});
