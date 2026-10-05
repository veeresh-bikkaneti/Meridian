import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  commitPin,
  readPhase,
  dismissTileOverlayIfPresent,
  spotViewportPoint,
  NO_IDLE,
} from "./helpers";

/**
 * First-run tutorial E2E (feat/first-run-tutorial).
 *
 * Covers the spec's non-negotiables:
 * - the invitation appears on first run and never blocks play
 *   (edition buttons stay one tap away);
 * - dismissing persists (second visit skips the invitation);
 * - the 3-beat tour completes: beat 1 (aim coachmark) → pin commit →
 *   beat 2 (reveal feedback) → beat 3 (closing hook) → menu;
 * - the tour is skippable at any beat and a reload mid-tour lands on
 *   the menu (the practice run never resumes);
 * - after the tour the game is fully playable.
 *
 * The tour asks one fixed famous question (Eiffel Tower, France), so no
 * date/seed freezing is needed. The pin is committed at the true spot's
 * live screen point (the app's own projection), which lands a hit and
 * exercises the story-phase path.
 */
test.setTimeout(240_000);

const APP = `http://127.0.0.1:4123/Meridian/?idle-ms=${NO_IDLE}`;

async function gotoMenu(page: Page): Promise<void> {
  await page.goto(APP);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
}

const invite = (page: Page) => page.getByTestId("tutorial-invite");
const beat1 = (page: Page) => page.getByTestId("tutorial-beat-1");
const beat2 = (page: Page) => page.getByTestId("tutorial-beat-2");
const beat3 = (page: Page) => page.getByTestId("tutorial-beat-3");

/** Take the tour and wait for the beat-1 aim screen (map + coachmark). */
async function startTour(page: Page): Promise<void> {
  await gotoMenu(page);
  await expect(invite(page)).toBeVisible();
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await expect(beat1(page)).toBeVisible();
}

/** Commit a pin exactly on the practice place (Eiffel Tower). */
async function commitPracticePin(page: Page): Promise<void> {
  const map = page.locator(".satellite-map");
  // Tile-health with retries (mirrors commitPin's loop): the VM's tile
  // network is flaky and the 15 s watchdog can fire spuriously; retry the
  // load the way a user would before treating it as a real failure.
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    try {
      await expect
        .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
        .toBe("ready");
      break;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  // Settle the intro camera (same stabilization pattern as startGlobeRun):
  // sampling the spot mid-dive would stale the point before the click lands.
  // Under the spec's reduced-motion setting the dive is an instant jump-to,
  // so this passes immediately once the camera is placed.
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
  const spot = await spotViewportPoint(page);
  expect(spot).not.toBeNull();
  // No tapHitsMap gate: the beat-1 banner and question bubble are
  // pointer-transparent, so a real tap passes through them to the map even
  // where elementFromPoint reports chrome. The France framing keeps the
  // Eiffel Tower clear of every pointer-active control on all runs.
  const { phase } = await commitPin(page, spot!.x, spot!.y);
  expect(phase).toBe("story");
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("invitation shows on first run; dismissing persists across visits", async ({
  page,
}) => {
  await gotoMenu(page);
  // The invitation is inline: every edition button stays usable beneath it.
  await expect(invite(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible();
  await expect(
    page.getByText("Take a 30-second tour", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(invite(page)).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(invite(page)).toBeHidden();
});

test("full tour: three beats, then the menu — game stays playable", async ({
  page,
}) => {
  await startTour(page);
  // Beat 1 teaches the core verb before any guess.
  await expect(beat1(page).getByText("Tap the map", { exact: false })).toBeVisible();
  await expect(beat1(page).getByText("Eiffel Tower", { exact: false })).toBeVisible();

  await commitPracticePin(page);

  // Beat 2: reveal feedback (hit path — the exact spot was tapped).
  await expect(beat2(page)).toBeVisible({ timeout: 30_000 });
  await expect(beat2(page).getByText("Bullseye", { exact: false })).toBeVisible();
  await expect(
    beat2(page).getByText("every place tells its story", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Got it" }).click();

  // Beat 3: ends on a hook.
  await expect(beat3(page)).toBeVisible();
  await expect(
    beat3(page).getByText("That’s the whole game", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start exploring" }).click();

  // Back on the menu; the invitation does not reappear; no tour residue.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await expect(invite(page)).toBeHidden();
  await expect(beat3(page)).toBeHidden();
  expect(await readPhase(page)).toBeNull();

  // The game itself is untouched: a normal run starts and plays.
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await expect(beat1(page)).toBeHidden();
  await expect(beat2(page)).toBeHidden();
});

test("skip tour from beat 1 returns to the menu", async ({ page }) => {
  await startTour(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await expect(beat1(page)).toBeHidden();
  expect(await readPhase(page)).toBeNull();
});

test("reload mid-tour lands on the menu (practice run never resumes)", async ({
  page,
}) => {
  await startTour(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  // No tutorial UI without the in-memory beat state; no persisted run.
  await expect(beat1(page)).toBeHidden();
  await expect(beat2(page)).toBeHidden();
  await expect(beat3(page)).toBeHidden();
  expect(await readPhase(page)).toBeNull();
});
