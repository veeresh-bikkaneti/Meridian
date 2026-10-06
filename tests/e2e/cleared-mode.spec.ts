import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitMiss,
  clickNextPlace,
} from "./helpers";
import { installSfxStub, oscRecords } from "./sfx-stub";
import type { Page } from "playwright/test";

/**
 * Cleared mode (feat/cleared-mode-promotion):
 * - when the last fresh place of a difficulty band is answered, tapping
 *   "Next place" celebrates the clear INSTEAD of advancing (primary
 *   trigger in onContinue);
 * - the celebration promotes the player: Easy -> [Try Medium][Try Hard],
 *   Medium -> [Try Hard], Hard -> neighbor states / country / Globe, plus
 *   a quiet "Replay <band>" option on every clear;
 * - one celebration per clear (the `meridian:cleared:v1:*` mark); the
 *   dialog is dismissible (Escape / close button) and the player returns
 *   to the answered reveal;
 * - the run-start backstop celebrates a completed cycle that was never
 *   celebrated (pre-feature clears, crash before the celebration).
 *
 * Determinism: the band-scoped no-repeat store (localStorage
 * `meridian:seen:v2:state:<regionId>:<choice>`) is pre-seeded with every
 * band id EXCEPT one, so the run deals exactly that place. Band ids and
 * tiers come from the same shipped sources the app uses (chunk JSON +
 * curated starters.ts), and every test cross-checks the run's poolIds
 * against the computed band — so a divergence between the test's band
 * computation and the app's filterByTier(pool) fails loudly instead of
 * silently seeding wrong.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const CLEARED_PREFIX = "meridian:cleared:v1:";
const RUN_KEY = "meridian.run";
const DROP_KEY = "meridian.drop";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

type Band = "easy" | "medium" | "hard";

function chunkPlaces(regionId: string): { id: string; difficulty: unknown }[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/chunks/${regionId}.json`, "utf8"),
  ) as { places: { id: string; difficulty?: unknown }[] };
  return d.places.map((p) => ({ id: p.id, difficulty: p.difficulty }));
}

/** Curated starter ids + difficulties for one edition+region. */
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

/** Mirrors the app's TIER_BANDS + asFameTier guard (tier-filter.ts). */
function bandCatalogIds(regionId: string, choice: Band): string[] {
  const lo = choice === "easy" ? 1 : choice === "medium" ? 2 : 4;
  const hi = choice === "easy" ? 2 : choice === "medium" ? 4 : 5;
  const all = [...curatedDifficulties("state", regionId), ...chunkPlaces(regionId)];
  const tierOf = (d: unknown): number =>
    d === 1 || d === 2 || d === 3 || d === 4 || d === 5 ? d : 3;
  return all
    .filter((p) => {
      const t = tierOf(p.difficulty);
      return t >= lo && t <= hi;
    })
    .map((p) => p.id);
}

function tierOfPlace(regionId: string): Map<string, unknown> {
  const all = [...curatedDifficulties("state", regionId), ...chunkPlaces(regionId)];
  return new Map(all.map((p) => [p.id, p.difficulty]));
}

/** Mark every band place seen except the kept ids, so those are dealt first. */
async function seedSeenExcept(
  page: Page,
  regionId: string,
  keepIds: string[],
  allIds: string[],
  choice: Band,
): Promise<void> {
  const key = `${SEEN_PREFIX}state:${regionId}:${choice}`;
  const seen = allIds.filter((id) => !keepIds.includes(id));
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  for (const k of keepIds) {
    expect(allIds, `kept id ${k} must be in the band`).toContain(k);
  }
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [key, seen] as [string, string[]],
  );
}

function difficultyGroup(page: Page) {
  return page.getByRole("group", { name: "How do you want to grow your map today?" });
}

async function pickDifficulty(page: Page, name: "Easy" | "Medium" | "Hard"): Promise<void> {
  await difficultyGroup(page).getByRole("button", { name }).click();
  await expect(
    difficultyGroup(page).getByRole("button", { name }),
  ).toHaveAttribute("aria-pressed", "true");
}

async function playState(page: Page, stateName: string): Promise<void> {
  await page.getByRole("button", { name: "Choose a state" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: stateName }).click();
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

/** The id of the place the last committed pin answered. */
async function readDropPlaceId(page: Page): Promise<string | null> {
  return page.evaluate((k) => {
    const raw = sessionStorage.getItem(k);
    const drop = raw ? JSON.parse(raw) : null;
    return typeof drop?.placeId === "string" ? (drop.placeId as string) : null;
  }, DROP_KEY);
}

async function readClearedMark(
  page: Page,
  regionId: string,
  choice: Band,
): Promise<string | null> {
  return page.evaluate(
    (k) => localStorage.getItem(k),
    `${CLEARED_PREFIX}state:${regionId}:${choice}`,
  );
}

const celebration = (page: Page) => page.getByTestId("cleared-celebration");

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/**
 * Shared setup: seed the band to all-but-one, start the run, answer the
 * one remaining fresh place, tap "Next place" — the celebration shows.
 * Returns the kept (answered) place id.
 */
async function driveBandClear(page: Page, regionId: string, choice: Band): Promise<string> {
  const catalog = bandCatalogIds(regionId, choice);
  expect(catalog.length, `${regionId} needs a real ${choice} band`).toBeGreaterThan(1);
  const keep = [catalog[catalog.length - 1] as string];
  await page.goto(APP);
  await seedSeenExcept(page, regionId, keep, catalog, choice);
  await pickDifficulty(page, choice === "easy" ? "Easy" : choice === "medium" ? "Medium" : "Hard");
  await playState(page, regionId === "vermont" ? "Vermont" : "Rhode Island");
  await expectAim(page);
  // Cross-check: the app's run pool is exactly the kept place — proves the
  // test's band computation matches the app's filterByTier(pool).
  expect((await readRunFull(page)).poolIds).toEqual(keep);
  // Answer the one remaining fresh place (a miss is deterministic).
  await commitMiss(page);
  expect(await readDropPlaceId(page)).toBe(keep[0]);
  // "Next place" celebrates INSTEAD of advancing.
  await clickNextPlace(page);
  await expect(celebration(page)).toBeVisible({ timeout: 15_000 });
  return keep[0] as string;
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
  // feature (same filter as the difficulty-picker spec).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("answering the last fresh Easy place celebrates the clear", async ({ page }) => {
  const errors = collectErrors(page);
  await driveBandClear(page, "vermont", "easy");

  const dlg = celebration(page);
  await expect(dlg.getByRole("heading")).toContainText(/cleared Easy mode/i);
  await expect(dlg.getByText("Vermont · Easy")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Try Medium" })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Try Hard" })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Replay Easy" })).toBeVisible();
  // One celebration per clear: the mark is set.
  expect(await readClearedMark(page, "vermont", "easy")).not.toBeNull();

  expectCleanConsole(errors);
});

test("Easy celebration promotes to a fresh Medium run", async ({ page }) => {
  const errors = collectErrors(page);
  const tiers = tierOfPlace("vermont");
  await driveBandClear(page, "vermont", "easy");

  await celebration(page).getByRole("button", { name: "Try Medium" }).click();
  await expectAim(page);

  // A FRESH run in the Medium band: index restarts, the run carries the
  // medium choice, the celebration is gone.
  const run = await readRunFull(page);
  expect(run.regionId).toBe("vermont");
  expect(run.edition).toBe("state");
  expect(run.difficultyChoice).toBe("medium");
  expect(run.index).toBe(0);
  await expect(celebration(page)).toBeHidden();

  // The promoted run deals from the Medium band (tier 2–4).
  await commitMiss(page);
  const placeId = await readDropPlaceId(page);
  const tier = tiers.get(placeId);
  expect([2, 3, 4], `promoted Medium run deals tier 2–4 (got ${placeId} tier ${tier})`).toContain(
    tier,
  );

  expectCleanConsole(errors);
});

test("Medium celebration promotes to a fresh Hard run", async ({ page }) => {
  const errors = collectErrors(page);
  const tiers = tierOfPlace("vermont");
  await driveBandClear(page, "vermont", "medium");

  const dlg = celebration(page);
  await expect(dlg.getByRole("heading")).toContainText(/cleared Medium/i);
  await expect(dlg.getByRole("button", { name: "Try Hard" })).toBeVisible();
  await dlg.getByRole("button", { name: "Try Hard" }).click();
  await expectAim(page);

  const run = await readRunFull(page);
  expect(run.regionId).toBe("vermont");
  expect(run.difficultyChoice).toBe("hard");
  expect(run.index).toBe(0);
  await expect(celebration(page)).toBeHidden();

  // The promoted run deals from the Hard band (tier 4–5).
  await commitMiss(page);
  const placeId = await readDropPlaceId(page);
  const tier = tiers.get(placeId);
  expect([4, 5], `promoted Hard run deals tier 4–5 (got ${placeId} tier ${tier})`).toContain(tier);

  expectCleanConsole(errors);
});

test("replay restarts the cleared band with no second celebration", async ({ page }) => {
  const errors = collectErrors(page);
  await driveBandClear(page, "vermont", "easy");

  // The quiet replay option: same band, fresh run.
  await celebration(page).getByRole("button", { name: "Replay Easy" }).click();
  await expectAim(page);

  const run = await readRunFull(page);
  expect(run.regionId).toBe("vermont");
  expect(run.difficultyChoice).toBe("easy");
  expect(run.index).toBe(0);
  // One celebration per clear: the backstop must NOT re-fire on the replay.
  await expect(celebration(page)).toBeHidden({ timeout: 5_000 });

  // And playing on after the replay never re-triggers either: answering one
  // question and tapping "Next place" advances normally (the new cycle has
  // barely started, so the band cannot be cleared again).
  await commitMiss(page);
  await clickNextPlace(page);
  await expectAim(page);
  await expect(celebration(page)).toBeHidden();

  expectCleanConsole(errors);
});

test("dismissing the celebration returns to the reveal; Next place advances normally", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await driveBandClear(page, "vermont", "easy");

  // Escape dismisses; the player stays on the answered reveal.
  await page.keyboard.press("Escape");
  await expect(celebration(page)).toBeHidden();
  await expect(page.getByRole("region", { name: "Result" })).toBeVisible();
  expect(await readPhase(page)).toBe("done");

  // Tapping "Next place" again advances normally — no re-trigger, because
  // the mark was already set when the celebration first showed.
  await clickNextPlace(page);
  await expectAim(page);
  await expect(celebration(page)).toBeHidden();

  expectCleanConsole(errors);
});

test("backstop: a pre-feature full clear celebrates at run start", async ({ page }) => {
  const errors = collectErrors(page);
  const catalog = bandCatalogIds("vermont", "easy");
  expect(catalog.length, "Vermont needs a real Easy band").toBeGreaterThan(1);

  await page.goto(APP);
  // Simulate a band cleared before this feature existed: the full band
  // covered by the no-repeat history, and NO cleared mark set.
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [`${SEEN_PREFIX}state:vermont:easy`, catalog] as [string, string[]],
  );
  expect(await readClearedMark(page, "vermont", "easy")).toBeNull();

  await pickDifficulty(page, "Easy");
  await playState(page, "Vermont");

  // The celebration appears at run start — before any question is answered.
  const dlg = celebration(page);
  await expect(dlg).toBeVisible({ timeout: 30_000 });
  await expect(dlg.getByRole("heading")).toContainText(/cleared Easy mode/i);
  // The mark is set: this was a one-time backstop, not a loop.
  expect(await readClearedMark(page, "vermont", "easy")).not.toBeNull();

  // Dismissing leaves a playable run behind (the new cycle deals the full band).
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expectAim(page);

  expectCleanConsole(errors);
});

test("Hard-cleared shows neighbor buttons; a neighbor starts a Hard run", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await driveBandClear(page, "rhode-island", "hard");

  const dlg = celebration(page);
  await expect(dlg.getByRole("heading")).toContainText(/True Rhode Island explorer/i);
  // Rhode Island's neighbor data offers Connecticut.
  const neighborButton = dlg.getByRole("button", { name: "Try Connecticut" });
  await expect(neighborButton).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Replay Hard" })).toBeVisible();

  await neighborButton.click();
  await expectAim(page);

  // The neighbor starts a fresh Hard run in that state.
  const run = await readRunFull(page);
  expect(run.edition).toBe("state");
  expect(run.regionId).toBe("connecticut");
  expect(run.difficultyChoice).toBe("hard");
  expect(run.index).toBe(0);
  await expect(celebration(page)).toBeHidden();

  expectCleanConsole(errors);
});

/**
 * Celebration audio on the cleared dialog (spec §3): the dialog's opening
 * beat plays the medium applause for Easy/Medium and the grand fanfare for
 * Hard. Driven through the run-start backstop (full band pre-seeded, no
 * cleared mark) so no pin commit is needed — the dialog opens on real
 * gestures, which also satisfy the audio autoplay gate.
 */

async function driveBackstopClear(
  page: Page,
  regionId: string,
  stateName: string,
  choice: Band,
): Promise<void> {
  const catalog = bandCatalogIds(regionId, choice);
  expect(catalog.length, `${regionId} needs a real ${choice} band`).toBeGreaterThan(1);

  // Simulate a band cleared before celebration existed: the full band
  // covered by the no-repeat history, and NO cleared mark set.
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [`${SEEN_PREFIX}state:${regionId}:${choice}`, catalog] as [string, string[]],
  );
  expect(await readClearedMark(page, regionId, choice)).toBeNull();

  await pickDifficulty(page, choice === "easy" ? "Easy" : choice === "medium" ? "Medium" : "Hard");
  await playState(page, stateName);

  // The celebration appears at run start — before any question is answered.
  await expect(celebration(page)).toBeVisible({ timeout: 30_000 });
}

async function expectTriad(
  page: Page,
  before: number,
  freqs: number[],
): Promise<void> {
  await expect
    .poll(
      async () => {
        const fresh = (await oscRecords(page)).slice(before).map((o) => o.freq);
        return freqs.every((f) => fresh.includes(f));
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

test("cleared dialog plays the medium applause on open (Easy)", async ({
  page,
  context,
}) => {
  await installSfxStub(context);
  await page.goto(APP);
  const before = await oscRecords(page);

  await driveBackstopClear(page, "vermont", "Vermont", "easy");

  // Medium applause: the deterministic G-major triad 392/493.88/587.33
  // under the 8 hand-claps. Nothing else on this path voices those three
  // together (card taps sit at ~587 Hz, the difficulty chirp glides).
  await expectTriad(page, before, [392, 493.88, 587.33]);
});

test("cleared dialog plays the grand fanfare on open (Hard)", async ({
  page,
  context,
}) => {
  await installSfxStub(context);
  await page.goto(APP);
  const before = await oscRecords(page);

  await driveBackstopClear(page, "rhode-island", "Rhode Island", "hard");

  const dlg = celebration(page);
  await expect(dlg.getByRole("heading")).toContainText(/True Rhode Island explorer/i);

  // Grand fanfare: G4 392 → C5 523.25 → E5 659.25 → G5 783.99 + the 1568 Hz
  // shimmer on the final note.
  await expectTriad(page, before, [392, 523.25, 659.25, 783.99, 1568]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("cleared-dialog applause still fires under reduced motion (spec §4.6)", async ({
    page,
    context,
  }) => {
    // Sounds are never gated on reduced motion — the sound toggle is the
    // sound control. The applause must voice even with the reduce setting.
    await installSfxStub(context);
    await page.goto(APP);
    const before = await oscRecords(page);

    await driveBackstopClear(page, "vermont", "Vermont", "easy");

    await expectTriad(page, before, [392, 493.88, 587.33]);
  });
});
