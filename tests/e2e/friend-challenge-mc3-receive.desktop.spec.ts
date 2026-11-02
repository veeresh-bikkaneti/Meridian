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
  MC3_RUN_KEY,
} from "./helpers";
import {
  encodeChallenge2,
  encodeChallenge3,
  decodeChallengeLink,
  CHALLENGE_CHILD_COPY,
  CHALLENGE_VERSION_COPY,
  CHALLENGE_BROKEN_LINK_COPY,
} from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc3 receive E2E (governing council manifest 2026-10-31, Package A).
 * The mc2 receive spec keeps covering stored mc2 fixture fragments
 * (decode-path); this spec mirrors its core cases for the new emitted
 * format and pins the manifest's save-slot law (§Q1-A4/A6):
 * - A valid Nebraska mc3 link lands on the welcome card; Start begins
 *   the route under its OWN key (meridian.run.mc3) with origin "mc3"
 *   snapshotted — meridian.run and meridian.run.mc2 are never written,
 *   so a rollback-shaped reader can never misread an mc3 save.
 * - A winner-carrying link receives the same way, and the decoded
 *   winner block is carried into the saved run losslessly (Package A
 *   carries the fields; the winner SURFACES are Package B).
 * - Failure classes (§Q1-A6): an unknown-version prefix AND an mc3
 *   body whose region index this build doesn't know both show the
 *   version heading ("This challenge needs the newest Meridian.") as
 *   the notice's TITLE, while an mc2 payload whose inner v is not 2
 *   keeps the child title + resend remedy — the version remedy is
 *   prefix-level only.
 * - Boot: when both an mc2 and an mc3 save exist, the mc3 save wins
 *   (read order mc3 → mc2 → mc1); an mc3 save whose winner fields are
 *   partial is discarded whole — never resumed.
 * - Completion of an mc3 route re-shares mc3 with the same ids and
 *   judged radius and — in Package A — no winner block.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const MC2_KEY = MC2_RUN_KEY;
const MC3_KEY = MC3_RUN_KEY;

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

const NEBRASKA_MC2_HASH = encodeChallenge2(
  { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
  SCORING_VERSION,
);

// Legal under the sequential bound (§Q2-B1): five hits in a row bound
// at 1,514 ≥ 955.
const WINNER_BLOCK = {
  senderMask: 0xf800,
  senderScore: 955,
  bestScore: 955,
  senderAttempts: 1,
} as const;

const NEBRASKA_HASH_W = encodeChallenge3(
  {
    edition: "state",
    regionId: "nebraska",
    radiusKm: 87,
    ids: NEBRASKA_IDS,
    winner: WINNER_BLOCK,
  },
  SCORING_VERSION,
);

/**
 * A hand-packed mc3 fragment naming country index 13 — one past the
 * end of this build's frozen registry (registry skew, §Q1-A6(ii)).
 * Packed locally from the manifest's byte layout; the production
 * encoder refuses unknown regions by construction, so only a foreign
 * (newer) build could mint this.
 */
function skewedRegionFragment(): string {
  const body: number[] = [1 << 6, SCORING_VERSION, 0xc8, 0x01, 13, 5];
  for (const n of [101, 102, 103, 104, 105]) body.push(0, 0, n);
  let h = 2166136261;
  for (const b of body) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  const seal = h >>> 0;
  const bytes = [
    ...body,
    (seal >> 24) & 0xff, (seal >> 16) & 0xff, (seal >> 8) & 0xff, seal & 0xff,
  ];
  return "#c=mc3." + Buffer.from(bytes).toString("base64url");
}

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

async function waitForChallengeAim(page: Page, key: string = MC3_KEY): Promise<void> {
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

async function startChallenge(page: Page, hash: string, key: string): Promise<void> {
  await page.goto(`${APP_URL}?idle-ms=3600000${hash}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page, key);
}

async function playOneMiss(page: Page, key: string): Promise<void> {
  await commitMiss(page, key);
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
  await clickNextPlace(page);
  await waitForChallengeAim(page, key);
}

test("flag ON: a valid Nebraska mc3 link shows the welcome card; Start begins the route under the mc3 key only", async ({
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
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC3_KEY)).toBeNull();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();

  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 1 of 5");
  expect(await readQuestion(page)).toContain("Lincoln");

  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), MC3_KEY);
  expect(saved.regionId).toBe("challenge");
  expect(saved.edition).toBe("state");
  expect(saved.regionName).toBe("Nebraska challenge");
  expect(saved.challengeRegionId).toBe("nebraska");
  expect(saved.challengeRadiusKm).toBe(87);
  expect(saved.challengeOrigin).toBe("mc3");
  expect(saved.poolIds).toEqual([...NEBRASKA_IDS]);
  // Slot isolation (§Q1-A4): the mc3 run lives ONLY under its own key.
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY)).toBeNull();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
});

test("flag ON: an mc3 link carrying a winner block receives, starts, and saves the block losslessly", async ({
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
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), MC3_KEY);
  expect(saved.challengeOrigin).toBe("mc3");
  expect(saved.poolIds).toEqual([...NEBRASKA_IDS]);
  expect(saved.challengeWinner).toEqual({ ...WINNER_BLOCK });
});

test("failure remedies: unknown-version prefix and mc3 registry skew get the newest-Meridian heading; an mc2 payload with v≠2 keeps the resend line", async ({
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

  // (i) Unknown version: a well-formed prefix this build has never
  // heard of. The version remedy is the notice's TITLE — a resend of
  // the same link would not help, so the child/resend copy is absent.
  let page = await freshPage();
  await page.goto(`${APP_URL}?idle-ms=3600000#c=mc9.AAAA`);
  let notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText(CHALLENGE_VERSION_COPY);
  await expect(notice).not.toContainText(CHALLENGE_CHILD_COPY);
  await expect(notice).not.toContainText(CHALLENGE_BROKEN_LINK_COPY);
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);

  // (ii) Registry skew: a valid mc3 body naming a region index this
  // build's frozen registry doesn't have yet — same version class.
  page = await freshPage();
  await page.goto(`${APP_URL}?idle-ms=3600000${skewedRegionFragment()}`);
  notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
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
  await expect(notice).toContainText(CHALLENGE_CHILD_COPY);
  await expect(notice).toContainText(CHALLENGE_BROKEN_LINK_COPY);
  await expect(notice).not.toContainText(CHALLENGE_VERSION_COPY);
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);
});

test("boot: an mc3 save with partial winner fields is discarded whole — never resumed, slot removed", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await startChallenge(page, NEBRASKA_HASH_W, MC3_KEY);
  await playOneMiss(page, MC3_KEY);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 2 of 5");

  const raw = await page.evaluate((k) => sessionStorage.getItem(k), MC3_KEY);
  expect(raw).not.toBeNull();
  const tampered = JSON.parse(raw as string) as Record<string, unknown>;
  expect(tampered.challengeWinner).toBeTruthy();
  // A partial winner block: one field lost. The save must fail closed.
  const winner = { ...(tampered.challengeWinner as Record<string, unknown>) };
  delete winner.bestScore;
  tampered.challengeWinner = winner;

  await context.addInitScript((json: string) => {
    sessionStorage.setItem("meridian.run.mc3", json);
    sessionStorage.setItem("meridian.cleanExit", "1");
  }, JSON.stringify(tampered));
  await page.reload();

  // Home, not a resumed challenge — and the poisoned slot is gone.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("challenge-progress")).toHaveCount(0);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), MC3_KEY)).toBeNull();
});

test("boot: with both an mc2 and an mc3 save present, the mc3 save resumes (read order mc3 → mc2)", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });

  // Capture an mc2 save at Place 3 (two misses played).
  await startChallenge(page, NEBRASKA_MC2_HASH, MC2_KEY);
  await playOneMiss(page, MC2_KEY);
  await playOneMiss(page, MC2_KEY);
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 3 of 5");
  const mc2Raw = await page.evaluate((k) => sessionStorage.getItem(k), MC2_KEY);
  expect(mc2Raw).not.toBeNull();

  // Capture an mc3 save at Place 2 (one miss played), in a fresh page
  // so the mc2 save above is not in this page's storage.
  const page2 = await context.newPage();
  await startChallenge(page2, NEBRASKA_HASH, MC3_KEY);
  await playOneMiss(page2, MC3_KEY);
  await expect(page2.getByTestId("challenge-progress")).toContainText("Place 2 of 5");
  const mc3Raw = await page2.evaluate((k) => sessionStorage.getItem(k), MC3_KEY);
  expect(mc3Raw).not.toBeNull();
  await page2.close();

  await context.addInitScript(
    (saves: { mc2: string; mc3: string }) => {
      sessionStorage.setItem("meridian.run.mc2", saves.mc2);
      sessionStorage.setItem("meridian.run.mc3", saves.mc3);
      sessionStorage.setItem("meridian.cleanExit", "1");
    },
    { mc2: mc2Raw as string, mc3: mc3Raw as string },
  );
  const page3 = await context.newPage();
  await page3.goto(`${APP_URL}?idle-ms=3600000`);
  await waitForChallengeAim(page3, MC3_KEY);
  // The mc3 save (Place 2) wins over the mc2 save (Place 3).
  await expect(page3.getByTestId("challenge-progress")).toContainText("Place 2 of 5");
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
    await commitMiss(page, MC3_KEY);
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
  expect(decoded.route.winner).toBeNull();
});
