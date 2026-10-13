import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  APP_NO_IDLE,
  readPhase,
  dismissTileOverlayIfPresent,
  commitPin,
  clickNextPlace,
  nextPlaceButton,
  resultCard,
} from "./helpers";
import { answerMissRecorded, readDropPlaceId } from "./globe-band-helpers";

/**
 * Globe in-run start failure (WS-0, spec section 4.10). Covers the UX-REVIEWER
 * BLOCK: an "offline" Try Medium from the Easy celebration must give feedback
 * and a way forward.
 *
 * Flag forced true (flags.json routed). The Easy run loads tiers 1-2; the
 * Medium tier files (3 and 4) are then aborted for this page. P1: "Try again"
 * after the network is back reloads to the picker with Medium chosen and a
 * Medium run starts. P2: "Keep playing" keeps the cleared Easy state and the
 * result card. Every selector is a role or visible text.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await page.addInitScript(() => {
    try {
      (navigator.serviceWorker as unknown as Record<string, unknown>).register = () =>
        Promise.reject(new Error("service worker disabled for test"));
    } catch {
      /* no service worker support: nothing to disable */
    }
  });
});

const RUN_KEY = "meridian.run";
const EASY_KEY = "meridian:seen:v2:globe:globe:easy";
const MEDIUM_KEY = "meridian:seen:v2:globe:globe:medium";
const CLEARED_EASY_KEY = "meridian:cleared:v1:globe:globe:easy";

type Tier = 1 | 2 | 3 | 4 | 5;

/** Mirrors the app's asFameTier guard: integer 1-5, else 3. */
function asTier(value: unknown): Tier | 3 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : 3;
}

type TierPlace = { id: string; lon: number; lat: number; difficulty: unknown };

/** The shipped Globe tier file (the same data the app fetches per tier). */
function tierPlaces(t: Tier): TierPlace[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/tiers/globe-t${t}.json`, "utf8"),
  ) as { places: TierPlace[] };
  return d.places.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, difficulty: p.difficulty }));
}

/** Curated starter ids + difficulties for one edition+region (starters.ts). */
function curatedDifficulties(
  edition: string,
  regionId: string,
): { id: string; difficulty: unknown }[] {
  const src = readFileSync("src/game/starters.ts", "utf8");
  const out: { id: string; difficulty: unknown }[] = [];
  // place(\n "edition",\n "region",\n "slug", ... \n difficulty,
  const re =
    /place\(\s*\n\s*"(\w+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"([a-z0-9-]+)",[\s\S]*?,\s*\n\s*(\d),/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) {
      out.push({ id: `${m[2]}-${m[3]}`, difficulty: Number(m[4]) });
    }
  }
  return out;
}

const curated = curatedDifficulties("globe", "globe");
const TIERS: Tier[] = [1, 2, 3, 4, 5];
const tierFiles = Object.fromEntries(TIERS.map((t) => [t, tierPlaces(t)])) as Record<
  Tier,
  TierPlace[]
>;

const tierById = new Map<string, number>();
for (const p of curated) tierById.set(p.id, asTier(p.difficulty));
for (const t of TIERS) for (const p of tierFiles[t]) tierById.set(p.id, asTier(p.difficulty));

/** Fame tier of a Globe place, as the app reads it (unknown reads as 3). */
function tierOf(id: string): number {
  const t = tierById.get(id);
  if (t === undefined) throw new Error(`unknown globe place id ${id}`);
  return t;
}

/** Every Easy-band id (tiers 1-2) of the Globe pool. */
const easyBandIds: string[] = [
  ...curated.filter((p) => asTier(p.difficulty) <= 2).map((p) => p.id),
  ...tierFiles[1].map((p) => p.id),
  ...tierFiles[2].map((p) => p.id),
];

/**
 * The kept Easy place: the first (by numeric id, ascending) tier 1-2 place in
 * Asia/Australia, far from the (500,400) tap at the globe's opening camera.
 * The guard in reachEasyCelebration catches a wrong estimate.
 */
const numericId = (id: string): number => Number(id.replace(/^gn-/, ""));
function findKeep(): TierPlace {
  const found = [...tierFiles[1], ...tierFiles[2]]
    .sort((a, b) => numericId(a.id) - numericId(b.id))
    .find((p) => p.lon >= 100 && p.lon <= 170 && p.lat >= -40 && p.lat <= 60);
  if (!found) throw new Error("no tier 1-2 keep place in 100..170E, -40..60N");
  return found;
}
const keep = findKeep();

const FAIL_TEXT =
  "Medium needs the internet to bring its new places. Get online, then try again!";

function difficultyGroup(page: Page) {
  return page.getByRole("group", { name: "How do you want to grow your map today?" });
}

async function pickDifficulty(page: Page, name: "Easy" | "Medium" | "Hard"): Promise<void> {
  await difficultyGroup(page).getByRole("button", { name }).click();
  await expect(difficultyGroup(page).getByRole("button", { name })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

type RunRecord = {
  phase: string;
  index: number;
  edition: string;
  regionId: string;
  difficultyChoice: string;
  poolIds: string[];
};

async function readRunFull(page: Page): Promise<RunRecord> {
  return page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "null"), RUN_KEY);
}

async function readStoreIds(page: Page, key: string): Promise<string[] | null> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), key);
  return raw === null ? null : (JSON.parse(raw) as string[]);
}

const celebration = (page: Page) => page.getByTestId("cleared-celebration");

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature. The aborted tier files log net::ERR_FAILED by design.
  const relevant = errors.filter(
    (e) => !e.includes("Minified React error #418") && !e.includes("net::ERR_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

/**
 * Shared prelude: flags.json forces globeTierSplit on, the Easy band is seeded
 * to all-but-keep, Easy "Play the globe" deals keep, a miss answers it, "Next
 * place" shows the Easy celebration. Then the Medium-only tier files (3, 4)
 * are aborted for this page, so the next Medium load fails.
 */
async function reachEasyCelebration(page: Page): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [EASY_KEY, easyBandIds.filter((id) => id !== keep.id)] as [string, string[]],
  );
  await pickDifficulty(page, "Easy");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);
  expect((await readRunFull(page)).poolIds).toEqual([keep.id]);

  const { phase } = await commitPin(page, 500, 400);
  if (phase !== "done") throw new Error("keep was hit; choose a farther keep");
  expect(await readDropPlaceId(page)).toBe(keep.id);
  await clickNextPlace(page);
  await expect(celebration(page)).toBeVisible({ timeout: 15_000 });

  // Break only the Medium-only tier files for this page. page.route takes
  // precedence over the context route from serveBuiltArtifact; tiers 1-2 are
  // already loaded by the Easy run.
  await page.route("**/assets/globe-t3-*.js", (route) => route.abort("failed"));
  await page.route("**/assets/globe-t4-*.js", (route) => route.abort("failed"));
}

test.describe("globe Medium promotion while offline (globeTierSplit on)", () => {
  test.beforeEach(async ({ context }) => {
    await context.route("**/flags.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ version: 1, flags: { globeTierSplit: true } }),
      }),
    );
  });

  test("P1: offline Try Medium shows a focused alert; Try again reloads and starts a Medium run", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const failBox = page
      .getByRole("alert")
      .filter({ hasText: FAIL_TEXT });

    // Precondition: the notice never shows on a normal load.
    await expect(page.getByRole("alert").filter({ hasText: "needs the internet" })).toHaveCount(0);

    await reachEasyCelebration(page);
    await celebration(page).getByRole("button", { name: "Try Medium" }).click();

    // Feedback: the failure box, focused, with two touch-sized buttons.
    await expect(failBox).toBeVisible({ timeout: 30_000 });
    await expect(failBox).toBeFocused();
    const tryAgain = page.getByRole("button", { name: "Try again" });
    const keepPlaying = page.getByRole("button", { name: "Keep playing" });
    const tryAgainBox = await tryAgain.boundingBox();
    const keepPlayingBox = await keepPlaying.boundingBox();
    expect(tryAgainBox?.height ?? 0, "Try again height").toBeGreaterThanOrEqual(44);
    expect(keepPlayingBox?.height ?? 0, "Keep playing height").toBeGreaterThanOrEqual(44);

    // The player is still on the answered Easy result.
    await expect(resultCard(page)).toBeVisible();
    await expect(nextPlaceButton(page)).toBeVisible();
    expect(await readStoreIds(page, MEDIUM_KEY)).toBeNull();

    // The network is back. "Try again" reloads to the picker with Medium chosen.
    await page.unroute("**/assets/globe-t3-*.js");
    await page.unroute("**/assets/globe-t4-*.js");
    await Promise.all([page.waitForEvent("load"), tryAgain.click()]);
    await expect(difficultyGroup(page).getByRole("button", { name: "Medium" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // "Play the globe" now lands on a Medium question.
    await page.getByRole("button", { name: "Play the globe" }).click();
    await expectAim(page);
    await expect(failBox).toBeHidden();

    const run = await readRunFull(page);
    expect(run.regionId).toBe("globe");
    expect(run.difficultyChoice).toBe("medium");
    expect(run.index).toBe(0);

    const answered = await answerMissRecorded(page);
    for (const id of answered) expect([2, 3, 4], `Medium place ${id} is tier 2-4`).toContain(tierOf(id));
    // No Easy-only place was recorded in the Medium store: exactly what was answered.
    expect(await readStoreIds(page, MEDIUM_KEY)).toEqual(answered);

    expectCleanConsole(errors);
  });

  test("P2: Keep playing keeps the cleared Easy state and the result card", async ({ page }) => {
    const failBox = page.getByRole("alert").filter({ hasText: FAIL_TEXT });

    await reachEasyCelebration(page);
    await celebration(page).getByRole("button", { name: "Try Medium" }).click();

    await expect(failBox).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Keep playing" }).click();

    await expect(failBox).toBeHidden();
    await expect(resultCard(page)).toBeVisible();
    await expect(nextPlaceButton(page)).toBeVisible();
    await expect(nextPlaceButton(page)).toBeFocused();

    expect(await readStoreIds(page, MEDIUM_KEY)).toBeNull();
    expect(
      await page.evaluate((k) => localStorage.getItem(k), CLEARED_EASY_KEY),
      "cleared Easy mark remains",
    ).not.toBeNull();
    await expect(page.getByText("Getting Medium ready…")).toBeHidden();
  });
});
