import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  ACK_POOL,
  BASE,
  assertSubsequence,
  detectivePlays,
  fulfillFlagsWalk,
  installDetectiveRecorder,
} from "./detective-u10";

/**
 * The owner's Holmes & Watson spec, as he restated it on 2026-11-10:
 *
 * - Clues open ONE AT A TIME and Watson reads each aloud; Holmes acks
 *   every clue. (The 8-10 band deals 3 starting clues: card 2 stays
 *   locked until Watson is done with card 1, and so on.)
 * - No speaker by the pair: no Listen chip, no pair sound chip, no
 *   storyteller speaker on the Hook. Tapping a figure repeats the line.
 *   The one mute sits top-left beside the screen's other two buttons.
 * - A pin before Watson finishes a clue: "You beat me to it!".
 * - No loops: each clue is read once per case unless the player asks
 *   for a repeat, and the instruction duet plays on the session's first
 *   case only.
 *
 * Runs on the built artifact like the other detective specs (local
 * only; CI runs the non-detective e2e set).
 */

test.setTimeout(240_000);

async function seedBand(context: BrowserContext, band: "8-10" | "11-13") {
  await context.addInitScript((b: string) => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: b,
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 1,
      }),
    );
  }, band);
}

async function openCase(page: Page, index: number) {
  await page.goto(`${BASE}?loop-puzzle=${index}`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /^Clue 1: [^(]*$/ })).toBeVisible({
    timeout: 30_000,
  });
  // First gesture for the speech unlock (the U5/U9 pattern).
  const heading = page.getByRole("heading", { name: "GeoDetective" });
  for (let i = 0; i < 8; i++) {
    await heading.click();
    const any = (await detectivePlays(page)).some((u) => u.includes("/audio/detective/"));
    if (any) return;
    await page.waitForTimeout(1_000);
  }
}

const clipNames = async (page: Page) =>
  (await detectivePlays(page))
    .filter((u) => u.includes("/audio/detective/"))
    .map((u) => u.split("/audio/detective/")[1]!);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsWalk(context);
});

test("8-10 deal: cards open one at a time, Watson reads 1 → 2 → 3, Holmes acks each, no repeats", async ({
  page,
  context,
}) => {
  await seedBand(context, "8-10");
  await openCase(page, 218);

  // At the start only card 1 is open: 2 and 3 wait for Watson.
  await expect(page.getByRole("article", { name: "Clue 2: Climate (locked)" })).toBeVisible();

  // Card 2 opens only after clue 1 has been read and acked.
  await expect(page.getByRole("article", { name: /^Clue 2: Climate$/ })).toBeVisible({
    timeout: 90_000,
  });
  let names = await clipNames(page);
  assertSubsequence(names, ["case-218/clue-1.mp3", ACK_POOL]);
  expect(names.some((n) => n === "case-218/clue-2.mp3")).toBe(false);

  await expect(page.getByRole("article", { name: /^Clue 3: History$/ })).toBeVisible({
    timeout: 90_000,
  });
  // Wait for the third ack, then check the whole opening.
  await expect
    .poll(async () => (await clipNames(page)).filter((n) => ACK_POOL.test(n)).length, {
      timeout: 90_000,
    })
    .toBeGreaterThanOrEqual(3);
  names = await clipNames(page);
  assertSubsequence(names, [
    "case-218/clue-1.mp3",
    ACK_POOL,
    "case-218/clue-2.mp3",
    ACK_POOL,
    "case-218/clue-3.mp3",
    ACK_POOL,
  ]);
  // No loops: each clue read once, the duet once.
  for (const n of [1, 2, 3]) {
    expect(names.filter((x) => x === `case-218/clue-${n}.mp3`)).toHaveLength(1);
  }
  expect(names.filter((x) => x === "fixed/instructions-holmes.mp3").length).toBeLessThanOrEqual(1);
  // Card 4 is still locked: it opens with the first wrong guess.
  await expect(page.getByRole("article", { name: "Clue 4: The Hook (locked)" })).toBeVisible();
});

test("no speaker by the pair; the one mute is top-left beside the other two buttons", async ({
  page,
  context,
}) => {
  await seedBand(context, "8-10");
  await openCase(page, 218);
  await expect(page.getByTestId("detective-station")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("detective-listen")).toHaveCount(0);
  await expect(page.getByTestId("detective-sound-chip")).toHaveCount(0);

  const mute = await page.getByTestId("sound-toggle-loop").boundingBox();
  const editions = await page.getByRole("button", { name: "Home", exact: true }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(mute).not.toBeNull();
  expect(editions).not.toBeNull();
  // Same row as Home, in the left-hand button group: right of
  // Home and left of the "Case #" label on the right.
  const caseLabel = await page.getByText(/^Case #\d+$/).first().boundingBox();
  expect(caseLabel).not.toBeNull();
  expect(Math.abs(mute!.y - editions!.y)).toBeLessThan(24);
  expect(mute!.x).toBeGreaterThan(editions!.x);
  expect(mute!.x + mute!.width).toBeLessThanOrEqual(caseLabel!.x);
  void viewport;
});

test("pinning before Watson finishes: 'You beat me to it!' and Holmes reads the pick", async ({
  page,
  context,
}) => {
  await seedBand(context, "11-13");
  await openCase(page, 218);
  // Watson is still on clue 1: pin straight away.
  await expect
    .poll(async () => (await clipNames(page)).includes("case-218/clue-1.mp3"), { timeout: 60_000 })
    .toBe(true);
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill("Paris");
  await page.locator('li[role="option"]').first().click();
  await expect(page.getByTestId("detective-bubble").first()).toHaveText(/beat me to it/i, {
    timeout: 10_000,
  });
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect
    .poll(async () => {
      const names = await clipNames(page);
      const nameAt = names.findIndex((n) => n.startsWith("names/"));
      if (nameAt < 0) return false;
      return ACK_POOL.test(names[nameAt + 1] ?? "");
    }, { timeout: 30_000 })
    .toBe(true);
});
