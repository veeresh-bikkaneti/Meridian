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
  encodeChallenge,
  encodeChallenge2,
  decodeChallengeLink,
} from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc2 boot + persistence E2E (Package A, manifest 2026-10-28):
 * - An in-progress mc2 challenge resumes across a reload from its own
 *   storage key.
 * - Displacement is a Start-tap decision (C6): with a resumable normal
 *   run saved, the welcome card says the game is saved; leaving before
 *   Start resumes the normal run untouched; finishing the challenge
 *   and tapping Done offers the displaced run back.
 * - Flag flipped OFF with an mc2 save in storage: the save is cleared
 *   and the boot is the ordinary one (C7 guard table).
 * - The @old-build gate (a b09a5c3 build booting with an mc2 save
 *   present) cannot run in CI — old builds are not in the artifact
 *   pipeline — so it is a skipped placeholder here and a scripted-
 *   manual rehearsal recorded in the PR (manifest §6).
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const MC2_KEY = MC2_RUN_KEY;

const NEBRASKA_IDS = [
  "gn-5072006", // Lincoln
  "gn-5074472", // Omaha
  "gn-5063805", // Bellevue
  "gn-5068725", // Fremont
  "gn-5069297", // Grand Island
] as const;

// Real Globe catalog ids (the golden fixture's summary-A route), for
// building a genuine mc1 link in the cross-format test.
const GOLDEN_MC1_IDS = ["gn-1579635", "gn-13665104", "gn-2526780", "gn-3574116", "gn-160950"];

const NEBRASKA_HASH = encodeChallenge2(
  { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
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

async function waitForChallengeAim(page: Page, key: string = MC2_RUN_KEY): Promise<void> {
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

async function startNebraskaChallenge(page: Page): Promise<void> {
  // about:blank first: arriving with only a changed hash on the same
  // URL is a same-document navigation and the app would not reboot.
  await page.goto("about:blank");
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);
}

async function playOneMiss(page: Page): Promise<void> {
  await commitMiss(page, MC2_RUN_KEY);
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
  await clickNextPlace(page);
}

/** Capture a real resumable globe run's persisted bytes (the frozen spec's pattern). */
async function captureSavedRun(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await waitForChallengeAim(page, RUN_KEY);
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY);
  await page.close();
  expect(raw, "captured run must be persisted to sessionStorage").not.toBeNull();
  return raw as string;
}

async function seedSavedRun(context: BrowserContext, runJson: string): Promise<void> {
  await context.addInitScript(
    (json: string) => {
      sessionStorage.setItem("meridian.run", json);
      sessionStorage.setItem("meridian.cleanExit", "1");
    },
    runJson,
  );
}

test("an in-progress mc2 challenge resumes across a reload, from its own key", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await startNebraskaChallenge(page);
  await playOneMiss(page);
  await waitForChallengeAim(page);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 2 of 5");

  await page.reload();
  await waitForChallengeAim(page);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 2 of 5");
  expect(await readQuestion(page)).toContain("Omaha");
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), MC2_KEY);
  expect(saved.challengeRegionId).toBe("nebraska");
  expect(saved.results).toHaveLength(1);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
});

test("displacement: the saved run survives under the challenge and is offered back on Done", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  const savedRun = await captureSavedRun(context);
  await seedSavedRun(context, savedRun);

  // Arrive with the link: the card promises the game is saved, and
  // leaving WITHOUT tapping Start resumes the normal run untouched.
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  const welcome = page.getByTestId("challenge-welcome");
  await expect(welcome).toBeVisible({ timeout: 30_000 });
  await expect(welcome).toContainText("Your game in progress is saved");
  await page.reload();
  await waitForChallengeAim(page, RUN_KEY);
  // The globe run resumed (no challenge chrome), proving arrival alone
  // displaced nothing.
  await expect(page.getByTestId("challenge-progress")).toHaveCount(0);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  const stillSaved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), RUN_KEY);
  expect(stillSaved.regionId).toBe("globe");

  // Now take the challenge, finish it, and tap Done: the displaced run
  // is offered back (resumed in place).
  await startNebraskaChallenge(page);
  for (let i = 0; i < NEBRASKA_IDS.length; i++) {
    await commitMiss(page, MC2_RUN_KEY);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    await clickNextPlace(page);
  }
  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  // The eyebrow naming the route is the h1's sibling, not inside it.
  await expect(page.getByText("Nebraska challenge", { exact: true })).toBeVisible();
  await expect(page.getByText(/inside the 87 km circle/)).toBeVisible();
  // The completion re-share follows the origin rule (delta §3.3): an
  // mc2 route forward-upgrades to mc3, same route, same radius.
  const shareContainer = page.getByTestId("challenge-share-container");
  await expect(shareContainer).toBeVisible();
  const reshared = await shareContainer.getAttribute("data-challenge-url");
  expect(reshared).toContain("#c=mc3.");
  const resharedRoute = decodeChallengeLink(
    reshared!.slice(reshared!.indexOf("#")),
    SCORING_VERSION,
  );
  expect(resharedRoute.ok).toBe(true);
  if (resharedRoute.ok) {
    expect(resharedRoute.route.originFormat).toBe("mc3");
    expect(resharedRoute.route.ids).toEqual([...NEBRASKA_IDS]);
    expect(resharedRoute.route.radiusKm).toBe(87);
  }
  await page.getByTestId("challenge-done").click();

  await waitForChallengeAim(page, RUN_KEY);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  const restored = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), RUN_KEY);
  expect(restored.regionId).toBe("globe");
  expect(restored.edition).toBe("globe");
});

test("flag flipped OFF with an mc2 save in storage: the save is cleared, the boot is ordinary", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await startNebraskaChallenge(page);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).not.toBeNull();

  // Re-route the flag off (routes stack: clear and re-add) and reload.
  await context.unroute(FLAGS_PATTERN);
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);
});

// The old-build gate cannot run in CI: the b09a5c3 artifact is not part
// of the test pipeline. It is rehearsed scripted-manually once per the
// manifest and recorded in the PR; this skip keeps the obligation
// visible in the suite instead of silently absent.
test.skip("@old-build: a b09a5c3 build boots clean with an mc2 save present (scripted-manual gate)", async () => {});

const NEBRASKA_HASH_90 = encodeChallenge2(
  { edition: "state", regionId: "nebraska", radiusKm: 90, ids: NEBRASKA_IDS },
  SCORING_VERSION,
);

test("completion re-share preserves an off-golden pinned radius (rad 90, not the computed 87)", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto("about:blank");
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH_90}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  // The card names the pinned circle, not the computed one.
  await expect(page.getByTestId("challenge-welcome")).toContainText("90 km circle");
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);
  for (let i = 0; i < 5; i++) {
    await playOneMiss(page);
  }
  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/inside the 90 km circle/)).toBeVisible();
  const container = page.getByTestId("challenge-share-container");
  const url = await container.getAttribute("data-challenge-url");
  expect(url).toBeTruthy();
  expect(url).toContain("#c=mc3.");
  const decoded = decodeChallengeLink(url!.slice(url!.indexOf("#")), SCORING_VERSION);
  expect(decoded.ok).toBe(true);
  if (decoded.ok) {
    // The sharpest freeze test (manifest §6): the re-share carries the
    // SAME circle the route was judged at — now on mc3, per the
    // delta's forward-upgrade rule (§3.3).
    expect(decoded.route.radiusKm).toBe(90);
    expect(decoded.route.originFormat).toBe("mc3");
    expect(decoded.route.ids).toEqual([...NEBRASKA_IDS]);
  }
});

test("cross-format displacement: a new challenge's start clears the other format's saved challenge", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  // Capture a real saved mc1 challenge (an mc1 boot commits at once).
  const mc1 = encodeChallenge(GOLDEN_MC1_IDS, SCORING_VERSION);
  const capPage = await context.newPage();
  await capPage.goto(`${APP_URL}?idle-ms=3600000${mc1}`);
  await waitForChallengeAim(capPage, RUN_KEY);
  const mc1Save = await capPage.evaluate((k) => sessionStorage.getItem(k), RUN_KEY);
  expect(mc1Save).toBeTruthy();
  await capPage.close();
  // Seed it, then receive an mc2 link and tap Start: the mc1 challenge
  // is displaced (one challenge at a time); the mc2 run owns its slot.
  await context.addInitScript((json: string) => {
    sessionStorage.setItem("meridian.run", json);
    sessionStorage.setItem("meridian.cleanExit", "1");
  }, mc1Save as string);
  await startNebraskaChallenge(page);
  const after = await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY);
  expect(after).toBeNull();
  const mc2Save = await page.evaluate((k) => sessionStorage.getItem(k), MC2_RUN_KEY);
  expect(mc2Save).toBeTruthy();
});
