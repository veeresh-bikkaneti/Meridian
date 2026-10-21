/**
 * Scout Map settings-toggle E2E (PBI-7 + the owner's 2026-10-20 rulings).
 *
 * Contract: data-testid="map-mode-button" lives in the Play top bar
 * (NOT inside .satellite-map). Flipping the switch writes the manual
 * record to localStorage `meridian:map-mode` immediately AND sends the
 * player home — the map is built once per game with the mode as a
 * constructor input, so a new mode can only take effect in a new game
 * (owner ruling: "Force home on manual switch (my remedy)").
 *
 * HISTORY: until 2026-10-20 the toggle queued the choice for the "next
 * place mount". An investigation proved that promise false for every map
 * feature — the next place flipped only the data-map-mode label while
 * tiles/starfield/DPR/zoom caps never changed (the old spec here asserted
 * exactly that label, which is how the bug shipped green). These specs
 * therefore assert FEATURE-level truth on the new run's first mount —
 * starfield presence and satellite tile requests — never the label alone.
 *
 * The Block A pins extend that to the switch's accessibility landing:
 * the announcement must sit in the GameApp-level live region that
 * SURVIVES the Play unmount (data-testid="map-mode-announcer"), and
 * focus must land on the home heading — pre-cure, the only region
 * lived inside the toggle and died in the commit that set its text,
 * and the destroyed switch stranded focus on <body>.
 */
import { test, expect, type BrowserContext } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  clickNextPlace,
  readPhase,
  readRun,
  APP_NO_IDLE,
} from "./helpers";
import {
  mapModeButton,
  mapWrapper,
  starfield,
  readMapMode,
  readStoredMapMode,
  seedManualMode,
  spoofCapableDevice,
  flipMapModeToggle,
  mapModeSwitch,
} from "./scout-helpers";

test.setTimeout(180_000);

// 1x1 transparent PNG (same stub the shared helpers serve for tiles).
const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Count satellite tile requests from now on. Registered after
 * serveBuiltArtifact, so it wins for the tile host (Playwright routes
 * match in reverse registration order) while still serving the stub.
 */
async function countTileRequests(context: BrowserContext): Promise<{ count: () => number; reset: () => void }> {
  let n = 0;
  await context.route("https://server.arcgisonline.com/**", async (route) => {
    n += 1;
    await route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" });
  });
  return { count: () => n, reset: () => { n = 0; } };
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Start FULL: the VM's SwiftShader Chromium would otherwise qualify
  // scout at boot and the switch/toggle paths become no-ops.
  await spoofCapableDevice(context);
});

test("toggle lives in the Play top bar, outside the map", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  const btn = mapModeButton(page);
  await expect(btn).toBeVisible({ timeout: 15_000 });

  // NOT inside satellite-map.tsx's wrapper.
  const insideMap = await btn.evaluate(
    (el) => el.closest(".satellite-map") !== null,
  );
  expect(insideMap).toBe(false);
});

test("toggle during the FIRST place sends the player home; the new run's first place is scout at feature level", async ({
  page,
  context,
}) => {
  const tiles = await countTileRequests(context);
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  // We are on the run's first place (index 0) — the corner where the old
  // queue could land the flip one place late in the NEXT run.
  expect((await readRun(page)).index).toBe(0);
  expect(await readPhase(page)).toBe("aim");
  // Feature-level full mode: the starfield is mounted and tiles flow.
  await expect(starfield(page)).toHaveCount(1);
  expect(await readMapMode(page)).toBe("full");
  expect(await readStoredMapMode(page)).toBeNull();

  // The popover warns BEFORE the tap that switching goes home.
  await mapModeButton(page).click();
  await expect(
    page.getByText("Switching sends you back home — this game ends here."),
  ).toBeVisible({ timeout: 10_000 });
  await mapModeSwitch(page).click();

  // The player lands home: the run (and its map) is gone, the picker is up.
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(mapWrapper(page)).toHaveCount(0);
  // The manual record was written immediately.
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "scout",
    source: "manual",
  });

  // The run is DISCARDED, not paused: a reload cannot resurrect it —
  // the player stays home (the persisted run record went with the run).
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".satellite-map")).toHaveCount(0);

  // A new run's FIRST place already carries the new mode — at feature
  // level, not just the label: no starfield is mounted and the scout map
  // requests zero satellite tiles.
  tiles.reset();
  await startGlobeRun(page);
  expect((await readRun(page)).index).toBe(0);
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");
  await expect(starfield(page)).toHaveCount(0);
  await page.waitForTimeout(3_000);
  expect(tiles.count()).toBe(0);
});

test("manual switch announces on the hoisted live region and lands focus on the home heading", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  await flipMapModeToggle(page);

  // Home is on screen: the picker is up and the run's map is gone.
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(mapWrapper(page)).toHaveCount(0);

  // (a) The announcement text sits in GameApp's hoisted live region,
  // which survived the Play unmount. Pre-cure this element did not
  // exist anywhere — the only region lived inside the toggle and was
  // destroyed in the same commit that set its text (Block A).
  await expect(page.getByTestId("map-mode-announcer")).toHaveText(
    "Scout Map on — back home; your next game uses Scout Map",
  );

  // (b) Focus landed on the home heading instead of being stranded
  // when the activated switch was destroyed (pre-cure: activeElement
  // fell back to <body> and nothing ever moved it).
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.activeElement?.getAttribute("data-testid") ?? null,
        ),
      { timeout: 10_000 },
    )
    .toBe("home-heading");
});

test("toggle back to full: the new run restores the full map's features", async ({
  page,
  context,
}) => {
  const tiles = await countTileRequests(context);
  // Start in Scout via a seeded manual record (a settled user choice).
  await seedManualMode(context, "scout");
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");
  await expect(starfield(page)).toHaveCount(0);

  await flipMapModeToggle(page);

  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "full",
    source: "manual",
  });

  // The next game builds the FULL map again: starfield mounted, tiles flow.
  tiles.reset();
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("full");
  await expect(starfield(page)).toHaveCount(1);
  await expect.poll(() => tiles.count(), { timeout: 30_000 }).toBeGreaterThan(0);
});

test("the session survives the trip home (banked places keep their score)", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  // Bank the first place and move on to the second, then read the
  // session record — the toggle is flipped mid-run, with progress in it.
  await commitMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  const before = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("meridian.session") ?? "null"),
  );
  expect(before).not.toBeNull();
  expect(before.placesPlayed).toBeGreaterThanOrEqual(1);

  await flipMapModeToggle(page);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  // Same session, untouched: the toggle discards the RUN, never the
  // session — identical semantics to the Editions exit.
  const after = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("meridian.session") ?? "null"),
  );
  expect(after).not.toBeNull();
  expect(after.id).toBe(before.id);
  expect(after.placesPlayed).toBe(before.placesPlayed);
  expect(after.totalScore).toBe(before.totalScore);
  expect(after.ended).toBe(false);
});

test("popover: the game-ending warning prints ABOVE the switch (Block B)", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  await mapModeButton(page).click();
  const warning = page.getByTestId("map-mode-warning");
  await expect(warning).toBeVisible({ timeout: 10_000 });
  await expect(warning).toHaveText(
    "Switching sends you back home — this game ends here. Your next game uses the new map.",
  );

  // DOM order is the contract: the consequence precedes the control
  // that ends the game (pre-cure the warning sat BELOW the switch in
  // 11px/50% fine print). DOCUMENT_POSITION_FOLLOWING (4) set on the
  // switch means the switch comes after the warning in the document.
  const switchFollowsWarning = await warning.evaluate((el) => {
    const sw = document.querySelector('[role="switch"]');
    if (!sw) return false;
    return (el.compareDocumentPosition(sw) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(switchFollowsWarning).toBe(true);
});

test("after an in-game switch, home shows the switched notice naming the kept score (Block B)", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  await flipMapModeToggle(page);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  // The deliberate switch gets a visible record on Home — mode
  // switched, next game on the new map, and the score was KEPT (the
  // session survives; pre-cure the landing showed nothing at all).
  const notice = page.getByTestId("map-switched-notice");
  await expect(notice).toBeVisible({ timeout: 10_000 });
  await expect(notice).toContainText("You switched to Scout Map");
  await expect(notice).toContainText("Your score is kept.");

  // Dismissible, like the idle notice whose pattern it reuses.
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toHaveCount(0);
});

test("manual toggle beats the weak-device probe (no demotion on override)", async ({
  context,
}) => {
  // This VM's Chromium reports a SwiftShader renderer, so the boot probe
  // would qualify scout — the seeded manual "full" must win anyway.
  await seedManualMode(context, "full");
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  expect(await readMapMode(page)).not.toBe("scout");
  await page.close();
});
