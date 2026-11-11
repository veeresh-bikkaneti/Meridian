import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective End game E2E (owner ruling, 2026-11-07).
 *
 * The header's End game button opens a choice dialog mid-case: END
 * OUTRIGHT discards the in-flight case (not counted, not resumable)
 * or PAUSE preserves it exactly (Home offers resume; it counts once
 * when it later closes). Both paths — and ending from a reveal, where
 * no case is in flight and the dialog is a single confirm — land on
 * the session summary, which counts closed cases only.
 *
 * Harness mirrors geodetective.spec.ts: the `?loop-puzzle=<index>`
 * seam pins the deal (218 -> Ankara), guesses go through the map
 * (jump camera + center tap for an Open Water guess; search + sheet
 * confirm for a named guess), and the built Pages artifact is served
 * from disk (see helpers.ts).
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    } catch {
      /* navigator.share stays */
    }
  });
  await serveBuiltArtifact(context);
});

/** Open the GeoDetective; `puzzle` pins the deal via the ?loop-puzzle= seam. */
async function openLoop(page: import("playwright/test").Page, puzzle?: string) {
  await page.goto(puzzle ? `${BASE}?loop-puzzle=${puzzle}` : BASE);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** The v2 store blob from the page's localStorage. */
async function loopStore(page: import("playwright/test").Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("meridian.loop.v2")!));
}

async function guessCount(page: import("playwright/test").Page): Promise<number> {
  return page.getByRole("region", { name: "Your guesses" }).getByRole("listitem").count().catch(() => 0);
}

/** Drive the map camera deterministically through the E2E seam. */
async function jumpCamera(
  page: import("playwright/test").Page,
  lon: number,
  lat: number,
  zoom: number,
) {
  await page.evaluate(
    ([lo, la, z]) => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap: { jumpTo(o: unknown): void };
      };
      el.__loopMap.jumpTo({ center: [lo, la], zoom: z });
    },
    [lon, lat, zoom],
  );
}

/**
 * One Open Water guess: fly to an ocean spot, tap the canvas center,
 * confirm the sheet. Each spot is a different ~11 m cell, so repeat
 * spots never dedupe — distinct spots exhaust a case for the loss
 * path. (The ocean-tap pattern from geodetective.spec.ts.)
 */
async function guessOpenWater(page: import("playwright/test").Page, lon: number, lat: number) {
  await jumpCamera(page, lon, lat, 3);
  await page.locator('[data-testid="loop-map"] canvas').click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** Jump-search to a place, then confirm the sheet (mirrors geodetective.spec.ts). */
async function guessViaMap(page: import("playwright/test").Page, query: string) {
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

test("end game button is present mid-case at phone, tablet, desktop and wide widths", async ({ page }) => {
  await openLoop(page, "218");
  for (const viewport of WIDTHS) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("end-game-button")).toBeVisible();
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const) {
  test(`pause path at ${viewport.width}px: summary excludes the open case, resume restores it exactly`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openLoop(page, "218");
    await guessOpenWater(page, -30, 30);
    await expect(page.getByText("Guess 2 of 5")).toBeVisible();
    expect(await guessCount(page)).toBe(1);

    await page.getByTestId("end-game-button").click();
    const dialog = page.getByTestId("end-game-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("end-game-outright")).toBeVisible();
    await expect(page.getByTestId("end-game-pause")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`end-game-dialog-${viewport.width}.png`) });

    await page.getByTestId("end-game-pause").click();
    const summary = page.getByTestId("loop-session-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("data-fate", "pause");
    await expect(summary.getByText("No cases closed yet.")).toBeVisible();
    await expect(
      summary.getByText("Your open case is waiting — you can resume it from Home."),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`loop-session-summary-${viewport.width}.png`) });

    // Done leaves to Home, which offers resume for the preserved case.
    await summary.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "GeoDetective: Resume your case" }).click();
    await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
    // The Open Water guess is still on the board — the case was
    // preserved exactly, not re-dealt.
    await expect(page.getByText("Guess 2 of 5")).toBeVisible();
    expect(await guessCount(page)).toBe(1);
    await expect(
      page.getByRole("region", { name: "Your guesses" }).getByText("Open Water"),
    ).toBeVisible();
    const store = await loopStore(page);
    expect(store.current.status).toBe("playing");
    expect(store.current.guesses).toHaveLength(1);
    expect(store.totals).toEqual({ solved: 0, lost: 0 });
  });

  test(`outright path at ${viewport.width}px: the case is gone and a fresh case deals`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openLoop(page, "218");
    await guessOpenWater(page, -30, 30);
    await expect(page.getByText("Guess 2 of 5")).toBeVisible();

    await page.getByTestId("end-game-button").click();
    await expect(page.getByTestId("end-game-dialog")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`end-game-dialog-outright-${viewport.width}.png`) });
    await page.getByTestId("end-game-outright").click();

    const summary = page.getByTestId("loop-session-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("data-fate", "outright");
    await expect(summary.getByText("No cases closed yet.")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`loop-session-summary-outright-${viewport.width}.png`) });

    // The discard is not a loss and does not touch the totals.
    const store = await loopStore(page);
    expect(store.current).toBeNull();
    expect(store.totals).toEqual({ solved: 0, lost: 0 });
    expect(store.streak).toBe(0);

    // Done → Home: NO resume variant — the case cannot come back.
    await summary.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "GeoDetective: Resume your case" })).toHaveCount(0);
    await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
    await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Guess 1 of 5")).toBeVisible();
    expect(await guessCount(page)).toBe(0);
  });
}

test("a case closed after a pause-end counts once, and ending from a reveal counts the just-closed case", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLoop(page, "218"); // Ankara
  await guessViaMap(page, "ankara");
  await expect(page.getByText("🎯 You found it!")).toBeVisible();

  // Panel round-2 pin (Game player BLOCK cure): the first-ever solve
  // raises the App-level first-discovery celebration overlay over the
  // whole screen. Wait for it to be up, then click End game WITHOUT
  // dismissing it — the overlay root is pointer-events-none outside
  // its own card, so the click must still reach the button below.
  // Pre-cure the overlay root intercepted the click and the
  // single-confirm dialog below never appeared.
  await expect(page.getByTestId("celebration-overlay")).toBeVisible({ timeout: 30_000 });

  // Ending from the reveal: no case in flight, so the dialog is the
  // single-confirm variant — and the summary counts the just-closed
  // case.
  await page.getByTestId("end-game-button").click();
  await expect(page.getByTestId("end-game-dialog")).toBeVisible();
  await expect(page.getByTestId("end-game-confirm")).toBeVisible();
  await expect(page.getByTestId("end-game-outright")).toHaveCount(0);
  await expect(page.getByTestId("end-game-pause")).toHaveCount(0);
  await page.getByTestId("end-game-confirm").click();
  let summary = page.getByTestId("loop-session-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute("data-fate", "none");
  await expect(page.getByTestId("loop-summary-cases-closed")).toHaveText("1");
  await expect(summary).toContainText("Solved: 1");

  // Done → Home → reopen: the finished case's reveal is still there;
  // Next mystery deals a new case from the deck.
  await summary.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "🔎 Next mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Guess 1 of 5")).toBeVisible();
  const dealt = await loopStore(page);
  expect(dealt.current.index).not.toBe(218);
  expect(dealt.current.status).toBe("playing");

  // One guess, then pause-end: the summary still counts only the one
  // closed case — the open case is not counted early.
  await guessOpenWater(page, -30, 30);
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();

  // The first-ever solve raises the App-level "Your first discovery!"
  // celebration overlay (pre-existing wiring, dismiss-only — there is
  // no auto-timer). A real player taps it away before carrying on;
  // dismiss it the same way so it cannot sit over the End game click.
  const celebration = page.getByTestId("celebration-overlay");
  await celebration.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  if ((await celebration.count()) > 0) {
    await celebration.getByRole("button", { name: "Close celebration" }).click();
    await expect(celebration).toHaveCount(0);
  }

  await page.getByTestId("end-game-button").click();
  await page.getByTestId("end-game-pause").click();
  summary = page.getByTestId("loop-session-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute("data-fate", "pause");
  await expect(page.getByTestId("loop-summary-cases-closed")).toHaveText("1");

  // Done → resume the preserved case and lose it with Open Water
  // taps (one guess already made; four distinct ocean spots remain).
  await summary.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "GeoDetective: Resume your case" }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible({ timeout: 30_000 });
  for (const [lon, lat] of [
    [-20, -25],
    [80, -50],
    [-140, -20],
    [0, -55],
  ] as const) {
    await guessOpenWater(page, lon, lat);
  }
  await expect(page.getByText("Out of guesses")).toBeVisible({ timeout: 30_000 });

  // Ending from this reveal counts the loss — the resumed case has
  // now counted exactly once, at its close: 2 closed, 1 solved,
  // 1 lost.
  await page.getByTestId("end-game-button").click();
  await expect(page.getByTestId("end-game-confirm")).toBeVisible();
  await page.getByTestId("end-game-confirm").click();
  summary = page.getByTestId("loop-session-summary");
  await expect(summary).toBeVisible();
  await expect(page.getByTestId("loop-summary-cases-closed")).toHaveText("2");
  await expect(summary).toContainText("Lost: 1");
  const store = await loopStore(page);
  expect(store.totals).toEqual({ solved: 1, lost: 1 });
});

test("Esc and Keep playing leave the case untouched", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLoop(page, "218");

  await page.getByTestId("end-game-button").click();
  await expect(page.getByTestId("end-game-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("end-game-dialog")).toHaveCount(0);
  await expect(page.getByTestId("loop-session-summary")).toHaveCount(0);

  await page.getByTestId("end-game-button").click();
  await expect(page.getByTestId("end-game-dialog")).toBeVisible();
  await page.getByTestId("end-game-keep-playing").click();
  await expect(page.getByTestId("end-game-dialog")).toHaveCount(0);
  await expect(page.getByTestId("loop-session-summary")).toHaveCount(0);

  // Still playable, nothing consumed: the first guess still lands.
  await guessOpenWater(page, -30, 30);
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  const store = await loopStore(page);
  expect(store.current.status).toBe("playing");
  expect(store.current.guesses).toHaveLength(1);
  expect(store.totals).toEqual({ solved: 0, lost: 0 });
});
