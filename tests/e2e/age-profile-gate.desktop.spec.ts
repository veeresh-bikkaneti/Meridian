import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Age-profile gate/picker overlay E2E (fix/age-profile-studio review findings).
 *
 * Locks the P0 fix: the gate/picker is a full-viewport overlay
 * (position: fixed), so tapping "For grown-ups" shows it immediately —
 * never below the fold — and the home page underneath is inert
 * (Comet's banner, footer link, edition cards all non-interactive).
 *
 * Also covers the P1/P2 interaction fixes end to end:
 * - keyboard Enter on the gate input checks exactly once (no double-fire);
 * - the picker selection ring follows the tapped card;
 * - Esc backs out of the change-confirm dialog;
 * - the change toast never names the band ("Saved ✅");
 * - focus returns to the invoking "For grown-ups" control on close.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Pre-seed an ACTIVE profile so Save stages the change-confirm dialog
  // (a fresh/unset profile saves straight through with no confirm).
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: "8-10",
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        pendingBand: null,
        schemaVersion: 1,
      }),
    );
  });
});

test("grown-ups gate opens as a viewport overlay; picker flow is band-invisible", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);

  const footerLink = page.getByTestId("grownups-link");
  await expect(footerLink).toBeVisible();
  await footerLink.click();

  // P0: the gate replaces the screen — fixed overlay, top of the viewport,
  // never below the fold.
  const gate = page.getByTestId("grownup-gate");
  await expect(gate).toBeVisible();
  expect(await gate.evaluate((el) => getComputedStyle(el).position)).toBe(
    "fixed",
  );
  const box = await gate.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(900); // desktop viewport height

  // Background is inert while the gate is open.
  await expect(page.locator("div[inert]")).toHaveCount(1);

  // Answer the gate with the physical keyboard: read the question, type
  // the product, Enter while the (readonly) input is focused — the
  // keydown check is the single path, so check() must run exactly once.
  const question = await page.locator(".agep-question").textContent();
  const m = question?.match(/What is (\d+) × (\d+)\?/);
  expect(m).not.toBeNull();
  const answer = String(Number(m![1]) * Number(m![2]));
  await page.getByTestId("gate-answer").click();
  for (const d of answer) await page.keyboard.press(d);
  await page.keyboard.press("Enter");

  const picker = page.getByTestId("age-picker");
  await expect(picker).toBeVisible();

  // P1: the selection ring follows the tapped card (8-10 preselected → tap
  // the third card, the ring moves off the preselected one).
  const cards = picker.locator(".agep-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(1)).toHaveClass(/agep-card-checked/);
  await cards.nth(2).click();
  await expect(cards.nth(2)).toHaveClass(/agep-card-checked/);
  await expect(cards.nth(1)).not.toHaveClass(/agep-card-checked/);

  // Save → confirm dialog carries the per-band consequence line; Esc backs
  // out to the picker with no change.
  await page.getByTestId("agep-save").click();
  const confirm = page.getByTestId("agep-confirm-change");
  await expect(confirm).toBeVisible();
  await expect(confirm.locator(".agep-note")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).not.toBeVisible();
  await expect(picker).toBeVisible();

  // Save → Switch → the toast never names the band, and focus returns to
  // the invoking control.
  await page.getByTestId("agep-save").click();
  await page.getByTestId("agep-confirm-switch").click();
  const toast = page.getByTestId("agep-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("Saved ✅");
  await expect(picker).not.toBeVisible();
  await expect(page.locator("div[inert]")).toHaveCount(0);
  await expect(footerLink).toBeFocused();
});
