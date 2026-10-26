/**
 * #188 — the Scout switched notice must retire when the session ends.
 *
 * A manual in-game map flip lands the player home with the visible
 * "You switched to … Your score is kept." notice (Block B, PR #186) —
 * correct at its landing. But session end (idle-kill, or End game →
 * summary → Done) drops the very session/score the notice talks about,
 * so a standing notice reads stale beside the idle-ended notice or
 * carries into a fresh session. Both paths must clear it.
 *
 * Pattern follows scout-toggle.desktop.spec.ts: start FULL via the
 * capable-device spoof so the in-game toggle is a real flip.
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  APP_NO_IDLE,
} from "./helpers";
import {
  flipMapModeToggle,
  spoofCapableDevice,
} from "./scout-helpers";

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await spoofCapableDevice(context);
});

/** Flip in game, land home, and prove the switched notice is standing. */
async function flipInGameAndExpectNotice(
  page: import("playwright/test").Page,
) {
  await flipMapModeToggle(page);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  const notice = page.getByTestId("map-switched-notice");
  await expect(notice).toBeVisible({ timeout: 10_000 });
  await expect(notice).toContainText("Your score is kept.");
  return notice;
}

test("End game → summary → Done retires the switched notice (#188)", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  await flipInGameAndExpectNotice(page);

  // The session (and its kept score) survives the flip: start again
  // from Home WITHOUT reloading (a reload would drop the in-memory
  // notice on its own and make this pin vacuous), then end this
  // session through the summary.
  await page.getByRole("button", { name: "Play the globe" }).click();
  // Wait on the aim phase + the End game control itself (what this leg
  // actually uses) — not the map element, whose chunk mount is the
  // slowest, most contention-sensitive part of the start.
  await expect.poll(() => readPhase(page), { timeout: 60_000 }).toBe("aim");
  await expect(page.getByRole("button", { name: "End game" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  // Home after session end: no stale switched notice.
  await expect(page.getByTestId("map-switched-notice")).toHaveCount(0);
});

test("idle-kill retires the switched notice (#188)", async ({ page }) => {
  // 20 s idle budget: long enough to start a run and flip on the slow
  // harness, short enough to watch the kill land without input.
  await startGlobeRun(page, 20_000);
  await flipInGameAndExpectNotice(page);

  // No further input: the watchdog kills the session (the flip was the
  // last activity). The idle-ended notice shows; the switched notice —
  // whose "score is kept" claim the kill just falsified — must not.
  await expect(
    page.getByText("Your game ended after 2 minutes of inactivity."),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("map-switched-notice")).toHaveCount(0);
  await expect
    .poll(() => readPhase(page).catch(() => null), { timeout: 5_000 })
    .not.toBe("aim");
});
