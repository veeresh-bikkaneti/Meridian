import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "playwright/test";
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
  encodeChallenge3,
  decodeChallengeLink,
  CHALLENGE_CHILD_COPY,
  CHALLENGE_VERSION_COPY,
  CHALLENGE_BROKEN_LINK_COPY,
} from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc3 receive E2E (delta 2026-10-31, Package A). The mc2 receive spec
 * keeps covering stored mc2 fixture fragments (decode-path); this spec
 * mirrors its core cases for the new emitted format:
 * - A valid Nebraska mc3 link lands on the welcome card, Start begins
 *   the route under the all-editions challenge key with origin "mc3"
 *   snapshotted — meridian.run is never written. A winner-carrying
 *   link receives the same way (Package A decodes the block; the
 *   winner SURFACES are Package B).
 * - An unknown-version prefix (#c=mc9.) shows class 1's headline with
 *   the NEW remedy ("This challenge needs the newest Meridian."),
 *   while an mc2 payload whose inner v is not 2 keeps the resend
 *   remedy — the version remedy is prefix-level only (delta §3.6).
 * - Completion of an mc3 route re-shares mc3 with the same ids and
 *   judged radius and — in Package A — no winner block.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const MC2_KEY = MC2_RUN_KEY;

// Real Nebraska catalog places (src/game/data/geonames/chunks/nebraska.json).
const NEBRASKA_IDS = [
  "gn-5072006", // Lincoln
  "gn-5074472", // Omaha
  "gn-5063805", // Bellevue
  "gn-5068725", // Fremont
  "gn-5069297", // Grand Island
] as const;

const NEBRASKA_HASH = encodeChallenge3(
  { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
  SCORING_VERSION,
);

const NEBRASKA_HASH_W = encodeChallenge3(
  {
    edition: "state",
    regionId: "nebraska",
    radiusKm: 87,
    ids: NEBRASKA_IDS,
    winner: { mask: 0xf800, sender: 955, best: 955, attempts: 1 },
  },
  SCORING_VERSION,
);

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

async function waitForChallengeAim(page: Page): Promise<void> {
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page, MC2_RUN_KEY), { timeout: 30_000 }).toBe("aim");
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

test("flag ON: a valid Nebraska mc3 link shows the welcome card; Start begins the route under the challenge key as mc3", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);

  const welcome = page.getByTestId("challenge-welcome");
  await expect(welcome).toBeVisible({ timeout: 30_000 });
  await expect(welcome).toContainText("A challenge from a friend!");
  await expect(welcome).toContainText("Find 5 places in Nebraska.");
  await expect(welcome).toContainText("Get inside the 87 km circle");
  await expect(welcome).toContainText("Same places, same circle for everyone.");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();

  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 1 of 5");
  expect(await readQuestion(page)).toContain("Lincoln");

  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), MC2_KEY);
  expect(saved.regionId).toBe("challenge");
  expect(saved.edition).toBe("state");
  expect(saved.regionName).toBe("Nebraska challenge");
  expect(saved.challengeRegionId).toBe("nebraska");
  expect(saved.challengeRadiusKm).toBe(87);
  expect(saved.challengeOrigin).toBe("mc3");
  expect(saved.poolIds).toEqual([...NEBRASKA_IDS]);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
});

test("flag ON: an mc3 link carrying a winner block receives and starts the same way", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH_W}`);
  const welcome = page.getByTestId("challenge-welcome");
  await expect(welcome).toBeVisible({ timeout: 30_000 });
  await expect(welcome).toContainText("Find 5 places in Nebraska.");
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), MC2_KEY);
  expect(saved.challengeOrigin).toBe("mc3");
  expect(saved.poolIds).toEqual([...NEBRASKA_IDS]);
});

test("failure remedies: unknown-version prefix gets the newest-Meridian line; an mc2 payload with v≠2 keeps the resend line", async ({
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  const freshPage = async (): Promise<Page> => {
    const p = await context.newPage();
    await p.addInitScript(() => {
      try {
        (navigator.serviceWorker as unknown as Record<string, unknown>).register = () =>
          Promise.reject(new Error("service worker disabled for test"));
      } catch {
        /* ignore */
      }
    });
    return p;
  };

  // Unknown version: a well-formed prefix this build has never heard
  // of. Class 1's headline, the NEW remedy — a resend would not help.
  let page = await freshPage();
  await page.goto(`${APP_URL}?idle-ms=3600000#c=mc9.AAAA`);
  let notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText(CHALLENGE_CHILD_COPY);
  await expect(notice).toContainText(CHALLENGE_VERSION_COPY);
  await expect(notice).not.toContainText(CHALLENGE_BROKEN_LINK_COPY);
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);

  // Prefix-level only: an mc2-framed payload whose inner version is
  // wrong is a broken KNOWN-format link, so the resend remedy stands.
  const mc2PayloadV3 =
    "#c=mc2." +
    Buffer.from(
      JSON.stringify({
        v: 3, e: "state", r: "nebraska", rad: 87, s: SCORING_VERSION,
        ids: [...NEBRASKA_IDS], seed: 1,
      }),
      "utf8",
    ).toString("base64url");
  page = await freshPage();
  await page.goto(`${APP_URL}?idle-ms=3600000${mc2PayloadV3}`);
  notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText(CHALLENGE_BROKEN_LINK_COPY);
  await expect(notice).not.toContainText(CHALLENGE_VERSION_COPY);
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);
});

test("completion: an mc3 route re-shares as mc3 — same ids, same radius, no winner block in Package A", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);

  for (let i = 0; i < 5; i++) {
    await commitMiss(page, MC2_RUN_KEY);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    await clickNextPlace(page);
  }

  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  const primary = page.getByTestId("challenge-share-container");
  const primaryUrl = await primary.getAttribute("data-challenge-url");
  expect(primaryUrl).toBeTruthy();
  expect(primaryUrl).toContain("#c=mc3.");
  const decoded = decodeChallengeLink(
    primaryUrl!.slice(primaryUrl!.indexOf("#")),
    SCORING_VERSION,
  );
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.route.originFormat).toBe("mc3");
  expect(decoded.route.ids).toEqual([...NEBRASKA_IDS]);
  expect(decoded.route.radiusKm).toBe(87);
  expect(decoded.route.winner).toBeUndefined();
});
