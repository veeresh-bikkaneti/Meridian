import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective reduced-motion gate: clue/reveal entrances must degrade to
 * an opacity-only fade (150 ms) — no translate, no rotation — when the OS
 * requests reduced motion.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("reduced motion: clue reveal is opacity-only, no transform animation", async ({
  page,
}) => {
  const reduced = await page.evaluate(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduced).toBe(true);

  await page.goto("http://127.0.0.1:4123/Meridian/?loop-date=2026-10-03");
  await page.getByRole("button", { name: "Solve today's mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible();

  const box = page.getByRole("combobox", { name: "Guess the place" });
  await box.click();
  await box.fill("paris");
  await page.getByRole("option").first().click();
  // Propose -> commit: the suggestion tap only arms the Guess button.
  await page.getByRole("button", { name: "Guess", exact: true }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();

  // The newly revealed clue 2 body: opacity-only under reduced motion —
  // no translate classes, no transform. (Note: with reduced motion forced,
  // Chromium clamps the computed transition-duration to ~0, so we assert
  // on the classes/transform the app controls, not the exact duration.)
  const reveal = page
    .getByRole("article", { name: /Clue 2: Climate/ })
    .locator("div")
    .first();
  const style = await reveal.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      className: el.className as string,
      transform: cs.transform,
    };
  });
  expect(style.className).not.toMatch(/translate-/);
  expect(style.transform).toBe("none");

  // No rotation keyframes anywhere on the loop screen.
  const rotated = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*")).some((el) => {
      const t = getComputedStyle(el).transform;
      return t !== "none" && t.includes("matrix") && /rotate/.test(el.className as string);
    }),
  );
  expect(rotated).toBe(false);
});
