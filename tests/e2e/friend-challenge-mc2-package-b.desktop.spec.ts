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
  RUN_KEY,
  MC2_RUN_KEY,
} from "./helpers";
import {
  decodeChallenge,
  decodeChallenge2,
  encodeChallenge2,
} from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * Package B E2E (manifest 2026-10-28 §1(b), §1(c), §1(f)):
 * - (b) mid-run: the run menu's single item deals a fresh in-region
 *   five into the preview sheet; creating it is a pure read — the live
 *   run, its phase and its question do not move.
 * - (c) reveal: the result-card footer carries the challenge text link
 *   plus the unlock hint; the link deals the same fresh five.
 * - (f) challenge-complete: the pass-along preserves the ORIGIN format
 *   and pinned radius for both mc2 and mc1 routes; mc2 completions add
 *   a fresh-route secondary dealt from the region catalog, while the
 *   mc1 completion surface stays frozen (no secondary).
 * - Flag OFF: none of the Package B surfaces exist.
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

const NEBRASKA_IDS = [
  "gn-5072006", // Lincoln
  "gn-5074472", // Omaha
  "gn-5063805", // Bellevue
  "gn-5068725", // Fremont
  "gn-5069297", // Grand Island
] as const;
const NEBRASKA_HASH = encodeChallenge2(
  { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
  SCORING_VERSION,
);

const MC1_FIXTURE = JSON.parse(
  readFileSync(
    new URL("../../src/game/__fixtures__/mc1-captured-links.json", import.meta.url),
    "utf8",
  ),
) as { links: { fragment: string; ids: string[] }[] };
const MC1_LINK = MC1_FIXTURE.links[0]!;

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

async function waitForAimAt(page: Page, key: string): Promise<void> {
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page, key), { timeout: 30_000 }).toBe("aim");
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

// Two elements carry data-testid="challenge-preview" during a run:
// the Home-level sheet (hidden while a run is active) and the run's own
// Package B sheet. The visible one is the surface under test.
const visiblePreview = (page: Page) =>
  page.locator('[data-testid="challenge-preview"]:visible');

function fragmentOf(url: string): string {
  return url.slice(url.indexOf("#"));
}

async function startNebraskaRun(page: Page): Promise<void> {
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await page.getByRole("button", { name: "State" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: /Nebraska/ }).click();
  await waitForAimAt(page, RUN_KEY);
}

function expectFreshNebraskaFive(url: string | null): void {
  expect(url).toBeTruthy();
  expect(url).toContain("#c=mc2.");
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
}

test("(b) mid-run: the run menu deals a fresh in-region five; the live run does not move", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await startNebraskaRun(page);
  const questionBefore = await readQuestion(page);

  const menuButton = page.getByTestId("run-menu-button");
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  const item = page.getByTestId("run-menu-challenge");
  await expect(item).toBeVisible();
  await expect(item).toHaveText("Challenge a friend — new route in Nebraska");
  await item.click();

  const preview = visiblePreview(page);
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await expect(preview).toContainText("5 places in Nebraska");
  await expect(preview).toContainText("87 km circle");
  await expect(preview).toContainText("Same places, same circle for everyone.");
  expectFreshNebraskaFive(
    await preview.getByTestId("challenge-share-container").getAttribute("data-challenge-url"),
  );

  // Pure read: closing the sheet returns to the same run, same phase,
  // same question — nothing was dealt away or displaced.
  await preview.getByRole("button", { name: "Back" }).click();
  await expect(preview).toHaveCount(0);
  expect(await readPhase(page)).toBe("aim");
  expect(await readQuestion(page)).toBe(questionBefore);
});

test("(c) reveal: the footer link and unlock hint deal the same fresh five", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await startNebraskaRun(page);

  await commitMiss(page);
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });

  const link = page.getByTestId("reveal-challenge-link");
  await expect(link).toBeVisible();
  await expect(link).toHaveText("Challenge a friend in Nebraska");
  await expect(resultCard(page)).toContainText("Your route unlocks when you finish 🏁");
  await link.click();

  const preview = visiblePreview(page);
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await expect(preview).toContainText("5 places in Nebraska");
  expectFreshNebraskaFive(
    await preview.getByTestId("challenge-share-container").getAttribute("data-challenge-url"),
  );
});

test("(f) mc2 completion: pass-along keeps format + pinned radius; fresh secondary deals in-region", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("challenge-start").click();
  await waitForAimAt(page, MC2_RUN_KEY);

  // Challenge runs never grow the Package B creation entries.
  await expect(page.getByTestId("run-menu-button")).toHaveCount(0);

  for (let i = 0; i < 5; i++) {
    await commitMiss(page, MC2_RUN_KEY);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    if (i === 0) {
      await expect(page.getByTestId("reveal-challenge-link")).toHaveCount(0);
    }
    await clickNextPlace(page);
  }

  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });

  // Primary: the exact route, still mc2, still pinned at 87 km.
  const primary = page.getByTestId("challenge-share-container");
  const primaryUrl = await primary.getAttribute("data-challenge-url");
  expect(primaryUrl).toBeTruthy();
  expect(primaryUrl).toContain("#c=mc2.");
  const decodedPrimary = decodeChallenge2(fragmentOf(primaryUrl!), SCORING_VERSION);
  expect(decodedPrimary.ok).toBe(true);
  if (!decodedPrimary.ok) return;
  expect([...decodedPrimary.ids]).toEqual([...NEBRASKA_IDS]);
  expect(decodedPrimary.rad).toBe(87);
  await expect(
    complete.getByRole("button", { name: "Pass this challenge to a friend" }),
  ).toBeVisible();

  // Secondary: a fresh route in the completed route's region.
  const fresh = page.getByTestId("challenge-fresh-share-container");
  await expect(fresh).toBeVisible();
  await expect(
    complete.getByRole("button", { name: "Or send a new Nebraska route" }),
  ).toBeVisible();
  expectFreshNebraskaFive(await fresh.getAttribute("data-challenge-url"));
});

test("(f) mc1 completion: pass-along stays mc1 byte-for-byte; the frozen surface grows no secondary", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000${MC1_LINK.fragment}`);
  await waitForAimAt(page, RUN_KEY);

  for (let i = 0; i < 5; i++) {
    await commitMiss(page);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    await clickNextPlace(page);
  }

  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });

  const primary = page.getByTestId("challenge-share-container");
  const primaryUrl = await primary.getAttribute("data-challenge-url");
  expect(primaryUrl).toBeTruthy();
  expect(primaryUrl).toContain(MC1_LINK.fragment);
  const decoded = decodeChallenge(fragmentOf(primaryUrl!), SCORING_VERSION);
  expect(decoded.ok).toBe(true);
  if (decoded.ok) expect([...decoded.ids]).toEqual(MC1_LINK.ids);

  // The mc1 completion surface is frozen (manifest §2): Package B adds
  // its fresh secondary to mc2 completions only.
  await expect(page.getByTestId("challenge-fresh-share-container")).toHaveCount(0);
});

test("flag OFF: no run menu in the run, no challenge link on the reveal", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });
  await startNebraskaRun(page);

  await expect(page.getByTestId("run-menu-button")).toHaveCount(0);
  await commitMiss(page);
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("reveal-challenge-link")).toHaveCount(0);
  await expect(resultCard(page)).not.toContainText("Your route unlocks when you finish");
});
