import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  commitPin,
  dismissTileOverlayIfPresent,
} from "./helpers";
import {
  fulfillFlagsOff,
  fulfillFlagsOn,
  installDetectiveRecorder,
  collectAudioRequests,
  detectivePlays,
  watchdogSeeks,
} from "./detective-u10";

/**
 * Unit B — the game-end celebration in EVERY edition.
 *
 * Ending a run (State and Globe here) with the detectivePair flag on
 * mounts Holmes & Watson ON the run-summary card: the shipped
 * celebration (jump → high-five → clap → settle) plays, Holmes speaks
 * the one fixed celebration line (Path 2 — the spoken score was
 * measured broken; the number lives in the frame as text), and the
 * frame carries the same total + per-edition split the card renders.
 * Flag off: no pair DOM at all, the summary is exactly today's.
 *
 * Composition pin: the GeoDetective loop pair (detective-host /
 * detective-station / detective-celebrate) is NEVER on the summary
 * surface — the per-case celebration stays inside LoopScreen
 * (detective-endings.spec.ts pins it there), and this mount is the
 * single game-end firing: exactly one frame, exactly one spoken line.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Play one place by map click (the shared commitPin pattern: it
 * waits out the intro beat before clicking — a raw click during the
 * camera dive places no pin, which the first run of this spec
 * measured on the State path). */
async function playOnePlace(page: Page): Promise<void> {
  await commitPin(page, 500, 400);
  await page.getByRole("button", { name: "Next place" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

/** Start a Nebraska run in the State edition (the drilldown path). */
async function startStateRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(
    page.getByRole("heading", { name: "United States" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

async function endRunToSummary(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  await expect(
    page.getByRole("dialog", { name: "Game summary" }),
  ).toBeVisible();
}

/** The card's own big total (the frame's is text-4xl; the card's is
 * text-5xl — distinct by design of the shipped card). */
async function cardTotal(page: Page): Promise<string> {
  const el = page
    .getByRole("dialog", { name: "Game summary" })
    .locator("p.text-5xl");
  await expect(el).toBeVisible();
  return (await el.textContent())?.trim() ?? "";
}

/** Sample the celebration's step attribute until it settles and the
 * yield releases (data-celebration removed). Returns the observed
 * step sequence in order, deduplicated. */
async function observeSteps(page: Page): Promise<string[]> {
  const frame = page.getByTestId("summary-detective-celebration");
  const seen: string[] = [];
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const step = await frame.getAttribute("data-step");
    if (step && seen[seen.length - 1] !== step) seen.push(step);
    const yielding = await frame.getAttribute("data-celebration");
    if (step === "settle" && yielding === null) break;
    await page.waitForTimeout(100);
  }
  return seen;
}

async function expectCelebration(
  page: Page,
  audioRequests: string[],
  editionLabel: string,
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  const frame = page.getByTestId("summary-detective-celebration");
  await expect(frame).toBeVisible({ timeout: 20_000 });
  await expect(frame).toHaveAttribute("data-mode", "animated");

  // Exactly one game-end firing, and the loop pair is NOT here.
  await expect(page.getByTestId("summary-detective-celebration")).toHaveCount(1);
  await expect(page.getByTestId("detective-host")).toHaveCount(0);
  await expect(page.getByTestId("detective-station")).toHaveCount(0);
  await expect(page.getByTestId("detective-celebrate")).toHaveCount(0);
  await expect(frame.locator("[data-detective]")).toHaveCount(2);

  // The choreography walks the shipped dwell chain in order.
  const steps = await observeSteps(page);
  const order = ["jump", "high-five", "clap", "settle"];
  const indices = ["high-five", "clap", "settle"].map((s) => steps.indexOf(s));
  expect(indices.every((i) => i >= 0)).toBe(true);
  expect(indices).toEqual([...indices].sort((a, b) => a - b));
  expect(steps[steps.length - 1]).toBe("settle");
  expect(order).toContain(steps[0]);

  // The frame's total IS the card's total, and the per-edition split
  // for the played edition is in the frame too.
  const frameTotal = (
    await page.getByTestId("celebration-total").textContent()
  )?.trim();
  expect(frameTotal).toBe(await cardTotal(page));
  await expect(frame).toContainText(editionLabel);
  await expect(dialog.getByTestId("summary-edition-breakdown")).toContainText(
    editionLabel,
  );

  // Path 2 speech: exactly one request for the fixed celebration
  // line, and it played (the recorder saw it).
  await expect
    .poll(
      () =>
        audioRequests.filter((u) => u.includes("fixed/score-celebration.mp3"))
          .length,
      { timeout: 20_000 },
    )
    .toBe(1);
  const plays = await detectivePlays(page);
  expect(
    plays.filter((u) => u.includes("fixed/score-celebration.mp3")).length,
  ).toBe(1);
  expect(await watchdogSeeks(page)).toBe(0);
}

test("Unit B: ending a State run celebrates on the summary with the final score (flag on)", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  await installDetectiveRecorder(context);
  const audioRequests = collectAudioRequests(page);
  await startStateRun(page);
  await playOnePlace(page);
  await endRunToSummary(page);
  await expectCelebration(page, audioRequests, "State");
});

test("Unit B: ending a Globe run celebrates on the summary with the final score (flag on)", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  await installDetectiveRecorder(context);
  const audioRequests = collectAudioRequests(page);
  await startGlobeRun(page);
  await playOnePlace(page);
  await endRunToSummary(page);
  await expectCelebration(page, audioRequests, "Globe");
});

test("Unit B: flag off — the summary is exactly today's, no pair anywhere", async ({
  page,
  context,
}) => {
  // The flag state is set EXPLICITLY by interception. (This test
  // used to rely on the committed flags.json being false; the
  // owner's flip in PR #356 made it true, and the test has failed
  // on unmodified main ever since — the detective specs are not in
  // CI's e2e subset, so nothing caught it. Repaired 2026-11-06 in
  // the prod-pair visibility PR: same assertions, honest setup.)
  await fulfillFlagsOff(context);
  await startStateRun(page);
  await playOnePlace(page);
  await endRunToSummary(page);
  // Give a (hypothetical) lazy mount every chance to appear.
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("summary-detective-celebration")).toHaveCount(0);
  await expect(page.locator("[data-detective]")).toHaveCount(0);
  // The summary itself is intact: total + edition breakdown render.
  expect(await cardTotal(page)).not.toBe("");
  await expect(
    page
      .getByRole("dialog", { name: "Game summary" })
      .getByTestId("summary-edition-breakdown"),
  ).toContainText("State");
});
