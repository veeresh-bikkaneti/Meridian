import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  APP_NO_IDLE,
  readPhase,
  dismissTileOverlayIfPresent,
  commitPin,
  clickNextPlace,
} from "./helpers";
import { answerMissRecorded, readDropPlaceId } from "./globe-band-helpers";

/**
 * Globe band switch (WS-0, spec section 4.7). Regression for the stale-catalog
 * bug: after a Globe learning-path promotion (Easy -> "Try Medium"), the
 * Medium no-repeat store must hold exactly the places the player was dealt,
 * never a place dealt from the previous band's catalog.
 *
 * Driven like cleared-mode.spec.ts, on the Globe. Runs twice: with
 * globeTierSplit forced true and false (flags.json routed), both must pass.
 * Player-visible actions only: picker, "Play the globe", pin drops, "Next
 * place", the celebration buttons. The seen store and run record are read
 * from storage the way the other specs do.
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

type Band = "easy" | "medium" | "hard";
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
 * Asia/Australia, far from the (500,400) tap at the globe's opening camera
 * (see the 4.7 geometry note: the tap is near Panama, about 175 degrees of
 * longitude from this band). The guard below catches a wrong estimate.
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
  // feature (same filter as the difficulty-picker and cleared-mode specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

for (const split of [true, false]) {
  test(`globe band switch (globeTierSplit=${split}): Medium seen store holds exactly what was dealt`, async ({
    page,
    context,
  }) => {
    await context.route("**/flags.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ version: 1, flags: { globeTierSplit: split } }),
      }),
    );
    const errors = collectErrors(page);

    // 1. Seed the Easy band to all-but-keep, so the Easy run deals keep first.
    await page.goto(APP_NO_IDLE);
    await page.evaluate(
      ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
      [EASY_KEY, easyBandIds.filter((id) => id !== keep.id)] as [string, string[]],
    );
    expect(await readStoreIds(page, MEDIUM_KEY)).toBeNull();

    // 2. Easy, "Play the globe", aim.
    await pickDifficulty(page, "Easy");
    await page.getByRole("button", { name: "Play the globe" }).click();
    await expectAim(page);

    // 3. Cross-check: the Easy run pool is exactly the kept place.
    expect((await readRunFull(page)).poolIds).toEqual([keep.id]);

    // 4. Answer keep with a tap that should miss. A hit would hide the
    //    celebration behind a story card, so fail loudly instead.
    const { phase } = await commitPin(page, 500, 400);
    if (phase !== "done") throw new Error("keep was hit; choose a farther keep");
    expect(await readDropPlaceId(page)).toBe(keep.id);
    await clickNextPlace(page);
    await expect(celebration(page)).toBeVisible({ timeout: 15_000 });

    // 5. Promotion has not written the Medium store yet.
    expect(await readStoreIds(page, MEDIUM_KEY)).toBeNull();

    // 6. "Try Medium" starts a fresh Medium Globe run.
    await celebration(page).getByRole("button", { name: "Try Medium" }).click();
    await expectAim(page);
    const run = await readRunFull(page);
    expect(run.difficultyChoice).toBe("medium");
    expect(run.index).toBe(0);
    expect(run.regionId).toBe("globe");

    // 7. The first Medium answer(s): every id answered is a legitimately dealt
    //    Medium place (a rare hit on the tap advances, and is recorded too).
    const answered1 = await answerMissRecorded(page);
    const d1 = answered1[answered1.length - 1] as string;
    for (const id of answered1) expect([2, 3, 4], `Medium place ${id} is tier 2-4`).toContain(tierOf(id));

    // 8. The Medium seen store holds exactly the answered places: no
    //    stale-catalog place from the Easy band was recorded.
    const seen1 = await readStoreIds(page, MEDIUM_KEY);
    expect(seen1).toEqual(answered1);
    const mediumRun = await readRunFull(page);
    for (const id of seen1 ?? []) expect(mediumRun.poolIds).toContain(id);

    // 9. The next Medium answer extends the store by exactly that place.
    await clickNextPlace(page);
    await expectAim(page);
    const answered2 = await answerMissRecorded(page);
    const d2 = answered2[answered2.length - 1] as string;
    expect(d2).not.toBe(d1);
    expect(await readStoreIds(page, MEDIUM_KEY)).toEqual([...answered1, ...answered2]);

    // 10. No page errors or console errors along the way.
    expectCleanConsole(errors);
  });
}
