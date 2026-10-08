/**
 * Scout Map switch-note E2E (PBI-5 + Phase A UX contract).
 *
 * Contract: after the webglcontextlost switch, a note with role="status"
 * renders ONLY in the story phase after reveal — never in aim. It is a
 * sibling of the ResultCard, positioned "fixed inset-x-4 top-16", and must
 * not overlap the question bubble (aim: bubble visible / note hidden;
 * story: note visible / bubble hidden).
 *
 * PBI-5 dependency: fails until the dev implements the switch + note.
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  clickNextPlace,
  readPhase,
  resultCard,
  APP_NO_IDLE,
} from "./helpers";
import {
  switchNote,
  mapWrapper,
  readMapMode,
  readStoredMapMode,
  rectsDisjoint,
} from "./scout-helpers";

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Drive the app into a round, then fire a synthetic webglcontextlost on
 *  the live map canvas (the dev's switch hooks the existing listener path).
 *  Returns once the wrapper reports scout mode. */
async function switchToScout(page: import("playwright/test").Page): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");

  await page.evaluate(() => {
    (window as unknown as { __qaBoot?: number }).__qaBoot = 1;
  });
  await page
    .locator(".maplibregl-canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost")),
    );

  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");
  // No page reload: the in-memory boot marker survives.
  expect(
    await page.evaluate(
      () => (window as unknown as { __qaBoot?: number }).__qaBoot,
    ),
  ).toBe(1);
  expect(await readPhase(page)).toBe("aim");
}

test("note is hidden in aim phase, shown in story phase after reveal", async ({
  page,
}) => {
  await switchToScout(page);
  const note = switchNote(page);

  // Aim phase: the question bubble shows, the note must not.
  await expect(page.locator(".bubble-shell")).toBeVisible();
  await expect(note).toBeHidden();

  // Commit → story phase: bubble hides, note appears at the break.
  await commitMiss(page);
  expect(await readPhase(page)).toBe("done");
  await expect(page.locator(".bubble-shell")).toBeHidden();
  await expect(note).toBeVisible({ timeout: 10_000 });
});

test("note is a sibling of the ResultCard with the contract positioning", async ({
  page,
}) => {
  await switchToScout(page);
  await commitMiss(page);
  const note = switchNote(page);
  await expect(note).toBeVisible({ timeout: 10_000 });

  // Positioning contract: fixed inset-x-4 top-16.
  const cls = (await note.getAttribute("class")) ?? "";
  for (const token of ["fixed", "inset-x-4", "top-16"]) {
    expect(cls.split(/\s+/), `note class must include "${token}"`).toContain(token);
  }

  // Sibling of the ResultCard: same parent element.
  const siblings = await note.evaluate((el) => {
    const card = document.querySelector('[aria-label="Result"]');
    return card !== null && card.parentElement === el.parentElement;
  });
  expect(siblings).toBe(true);
  await expect(resultCard(page)).toBeVisible();
});

test("note does not overlap the question bubble", async ({ page }) => {
  await switchToScout(page);
  const note = switchNote(page);
  const bubble = page.locator(".bubble-shell");

  // Aim phase: bubble visible, note hidden — no overlap possible.
  await expect(bubble).toBeVisible();
  await expect(note).toBeHidden();

  await commitMiss(page);
  await expect(note).toBeVisible({ timeout: 10_000 });
  await expect(bubble).toBeHidden();

  // Belt-and-braces: even if both were visible, their boxes are disjoint.
  const noteBox = await note.boundingBox();
  expect(noteBox).not.toBeNull();
});

test("note spans the width at 360px (inset-x-4 → 16px margins)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
  });
  await serveBuiltArtifact(context);
  const page = await context.newPage();

  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  await page
    .locator(".maplibregl-canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost")),
    );
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");

  await commitCenterMiss(page);
  const note = switchNote(page);
  await expect(note).toBeVisible({ timeout: 10_000 });

  const box = await note.boundingBox();
  expect(box).not.toBeNull();
  // inset-x-4 → 16px left/right margins at 360px width.
  expect(Math.abs(box!.x - 16)).toBeLessThanOrEqual(2);
  expect(Math.abs(box!.x + box!.width - (360 - 16))).toBeLessThanOrEqual(2);
  await context.close();
});

test("switch persists meridian:map-mode to localStorage", async ({ page }) => {
  await switchToScout(page);
  const stored = await readStoredMapMode(page);
  expect(stored?.mode).toBe("scout");
});

test("map wrapper is reachable and single after the switch", async ({
  page,
}) => {
  await switchToScout(page);
  expect(await mapWrapper(page).count()).toBe(1);
  expect(await page.locator(".maplibregl-canvas").count()).toBe(1);
});

/** Commit a pin at the viewport center (for narrow viewports where the
 *  shared (500,400) miss point is off-screen). */
async function commitCenterMiss(page: import("playwright/test").Page): Promise<void> {
  const box = await mapWrapper(page).boundingBox();
  if (!box) throw new Error("commitCenterMiss: no map wrapper box");
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.mouse.click(x, y);
  const drop = page.getByRole("button", { name: "Drop pin and lock in your guess" });
  await expect(drop).toBeEnabled({ timeout: 15_000 });
  await drop.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toMatch(/^(story|done)$/);
}
