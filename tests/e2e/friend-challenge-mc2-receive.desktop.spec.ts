import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  commitPin,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  readPhase,
  readQuestion,
  resultCard,
  tapHitsMap,
  waitForSpotSettle,
  RUN_KEY,
  MC2_RUN_KEY,
} from "./helpers";
import {
  encodeChallenge2,
  decodeChallenge2,
  CHALLENGE_CHILD_COPY,
} from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc2 receive E2E (Package A, manifest 2026-10-28). The mc1 spec
 * (friend-challenge.desktop.spec.ts) is frozen and untouched; this spec
 * pins the NEW behaviour:
 * - A valid state-edition mc2 link lands on the welcome card (nothing
 *   is displaced yet), Start begins the route in the region's own
 *   edition, and the run persists under the NEW key meridian.run.mc2
 *   with its region + radius + origin snapshotted — meridian.run is
 *   never written.
 * - Judgement uses the link's pinned radius (87 km for Nebraska): a
 *   ~70 km pin hits, a ~110 km pin misses, read back from the game's
 *   own persisted results.
 * - The three failure classes render their own second lines under the
 *   shipped headline (class 1 broken link / class 2 unknown content /
 *   class 2 unknown region), always falling through to Home.
 * - Flag OFF: an mc2 link is invisible — no card, no notice, Home.
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
const TEXAS_ONLY_ID = "gn-4046274"; // Edna, Texas — exists, but not in Nebraska's pool.

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

function placeCoords(id: string): { lon: number; lat: number } {
  const chunk = JSON.parse(
    readFileSync(
      new URL("../../src/game/data/geonames/chunks/nebraska.json", import.meta.url),
      "utf8",
    ),
  ) as { places: { id: string; lon: number; lat: number }[] };
  const place = chunk.places.find((p) => p.id === id);
  if (!place) throw new Error(`place ${id} not in the Nebraska chunk`);
  return { lon: place.lon, lat: place.lat };
}

function destinationPoint(
  lon: number,
  lat: number,
  distKm: number,
  bearingDeg: number,
): { lon: number; lat: number } {
  const d = distKm / 6371;
  const br = (bearingDeg * Math.PI) / 180;
  const la1 = (lat * Math.PI) / 180;
  const lo1 = (lon * Math.PI) / 180;
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br),
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2),
    );
  return { lon: (lo2 * 180) / Math.PI, lat: (la2 * 180) / Math.PI };
}

async function projectToViewport(
  page: Page,
  lon: number,
  lat: number,
): Promise<{ x: number; y: number }> {
  const p = await page.locator(".satellite-map").evaluate(
    (el, [plon, plat]: [number, number]) => {
      const hook = (
        el as unknown as {
          __project?: (lo: number, la: number) => { x: number; y: number } | null;
        }
      ).__project;
      const s = hook?.(plon, plat) ?? null;
      if (!s) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
    },
    [lon, lat] as [number, number],
  );
  expect(p, "the __project seam must resolve the pin point").not.toBeNull();
  return p!;
}

/** Drop a pin ~distKm west of the current place; return the game's own judgement from the mc2 save. */
async function commitPinAtDistanceKm(
  page: Page,
  placeId: string,
  distKm: number,
): Promise<{ judgedKm: number; hit: boolean }> {
  const truth = placeCoords(placeId);
  const target = destinationPoint(truth.lon, truth.lat, distKm, 270);
  await waitForSpotSettle(page);
  await dismissTileOverlayIfPresent(page);
  const hide = page.getByRole("button", { name: "Hide question" });
  if (await hide.isVisible().catch(() => false)) {
    await hide.click();
  }
  const point = await projectToViewport(page, target.lon, target.lat);
  expect(
    await tapHitsMap(page, point.x, point.y),
    `pin point for ~${distKm} km must hit the map canvas, not chrome`,
  ).toBe(true);
  await commitPin(page, point.x, point.y, MC2_RUN_KEY);
  const run = await page.evaluate(
    (k) => JSON.parse(sessionStorage.getItem(k)!),
    MC2_KEY,
  );
  const result = run.results[run.results.length - 1];
  expect(result, "the committed pin must persist a result").toBeTruthy();
  console.log(
    `mc2 pin-pair: target ~${distKm} km from ${placeId} -> judged ${result.distanceKm} km, hit=${result.hit}`,
  );
  return { judgedKm: result.distanceKm as number, hit: result.hit as boolean };
}

test("flag ON: a valid Nebraska mc2 link shows the welcome card; Start begins the route under the mc2 key", async ({
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
  // No saved run exists in this context, so no saved-game line.
  await expect(welcome).not.toContainText("Your game in progress is saved");
  // Nothing is displaced or started before Start: no run anywhere yet.
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();

  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 1 of 5");
  expect(await readQuestion(page)).toContain("Lincoln");

  // The run persisted under the NEW key with its snapshots; the shipped
  // key was never written (an old build would see no run at all).
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), MC2_KEY);
  expect(saved.regionId).toBe("challenge");
  expect(saved.edition).toBe("state");
  expect(saved.regionName).toBe("Nebraska challenge");
  expect(saved.challengeRegionId).toBe("nebraska");
  expect(saved.challengeRadiusKm).toBe(87);
  expect(saved.challengeOrigin).toBe("mc2");
  expect(saved.poolIds).toEqual([...NEBRASKA_IDS]);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
});

test("flag ON: pins are judged at the pinned 87 km radius (~70 hits, ~110 misses)", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);

  const hit = await commitPinAtDistanceKm(page, NEBRASKA_IDS[0], 70);
  expect(hit.hit).toBe(true);
  expect(hit.judgedKm).toBeLessThan(87);
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
  await clickNextPlace(page);
  await waitForChallengeAim(page);
  expect(await readQuestion(page)).toContain("Omaha");

  const miss = await commitPinAtDistanceKm(page, NEBRASKA_IDS[1], 110);
  expect(miss.hit).toBe(false);
  expect(miss.judgedKm).toBeGreaterThan(87);
});

test("flag ON: the three failure classes show their own second lines and fall through to Home", async ({
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  // One fresh page per case: re-navigating to the same URL with only a
  // different #c= hash is a same-document navigation — the app would
  // (correctly) not reboot, and the case would read the previous
  // case's notice.
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
  let page = await freshPage();

  // Class 1: a tampered link (an id swapped after minting; the seal no
  // longer matches). Built by decoding a valid link, swapping an id,
  // and re-encoding WITHOUT resealing.
  const valid = decodeChallenge2(NEBRASKA_HASH, SCORING_VERSION);
  expect(valid.ok).toBe(true);
  if (!valid.ok) return;
  const tamperedPayload = {
    v: 2, e: "state", r: "nebraska", rad: 87, s: SCORING_VERSION,
    ids: ["gn-5062769", ...NEBRASKA_IDS.slice(1)], seed: valid.seed,
  };
  const tampered =
    "#c=mc2." + Buffer.from(JSON.stringify(tamperedPayload), "utf8").toString("base64url");
  await page.goto(`${APP_URL}?idle-ms=3600000${tampered}`);
  let notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText(CHALLENGE_CHILD_COPY);
  await expect(notice).toContainText("Ask your friend to send the link again.");
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);

  // Class 2, place arm: a Nebraska link naming a Texas place (sealed
  // correctly — the failure is membership, not the seal).
  const sharpHash = encodeChallenge2(
    {
      edition: "state",
      regionId: "nebraska",
      radiusKm: 87,
      ids: [...NEBRASKA_IDS.slice(0, 4), TEXAS_ONLY_ID],
    },
    SCORING_VERSION,
  );
  page = await freshPage();
  await page.goto(`${APP_URL}?idle-ms=3600000${sharpHash}`);
  notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText(
    "This route visits a place this version of Meridian doesn't know yet.",
  );
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);

  // Class 2, region arm: a sealed link for a region this build does not
  // have. The encoder refuses unknown regions, so the payload is sealed
  // by hand here (FNV-1a over the codec's canonical string).
  const canonical = `mc2|2|state|atlantis|100|${SCORING_VERSION}|${NEBRASKA_IDS.join(",")}`;
  let h = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unknownRegion =
    "#c=mc2." +
    Buffer.from(
      JSON.stringify({
        v: 2, e: "state", r: "atlantis", rad: 100, s: SCORING_VERSION,
        ids: [...NEBRASKA_IDS], seed: h >>> 0,
      }),
      "utf8",
    ).toString("base64url");
  page = await freshPage();
  await page.goto(`${APP_URL}?idle-ms=3600000${unknownRegion}`);
  notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText(
    "This challenge is for a part of the world this version of Meridian doesn't have yet.",
  );
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);
});

test("flag OFF: an mc2 link is invisible — no card, no notice, clean Home", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });
  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);
  await expect(page.getByTestId("challenge-boot-notice")).toHaveCount(0);
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
});
