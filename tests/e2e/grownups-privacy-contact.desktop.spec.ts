import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * 2026-10-21 review remediation (P0-3, P1-5, P2-11 + the contact form).
 *
 * Unit tests cover the pieces; this proves the home page wires them up in
 * the built artifact: the footer reaches /privacy and /contact by in-app
 * navigation (the static Pages mirror has no deep-link server, so that is
 * how real visitors get there), the contact form is hidden behind the
 * grown-up gate, it fails closed while flags.json has no contactEndpoint,
 * and "Begin exploring" starts a round instead of only scrolling.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("footer links reach the privacy notice and the tour stays reachable", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("take-tour-link")).toBeVisible();
  // Footer kids-privacy promise: factual claims only, never a "COPPA
  // compliant" badge (see the comment in game-app.tsx).
  const note = page.getByTestId("kids-privacy-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText(/no tracking cookies/i);
  await expect(note).not.toContainText(/compliant/i);
  await page.getByTestId("privacy-link").click();
  await expect(page).toHaveURL(/\/privacy$/);
  // The COPPA posture is the headline claim; lock the wording a parent reads.
  await expect(page.getByText(/every visitor as a child/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact us" }).first()).toBeVisible();
});

test("contact form sits behind the grown-up gate and fails closed until switched on", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("contact-link").click();
  await expect(page).toHaveURL(/\/contact$/);

  // The form must not render before the gate is passed.
  const gate = page.getByTestId("grownup-gate");
  await expect(gate).toBeVisible();
  await expect(page.getByTestId("contact-form")).toHaveCount(0);

  const question = await page.locator(".agep-question").textContent();
  const m = question?.match(/(\d+) × (\d+)/);
  expect(m).not.toBeNull();
  for (const d of String(Number(m![1]) * Number(m![2]))) await page.keyboard.press(d);
  await page.keyboard.press("Enter");

  const form = page.getByTestId("contact-form");
  await expect(form).toBeVisible();
  await expect(page.getByTestId("contact-kid-note")).toBeVisible();
  await form.locator("select").selectOption("bug");
  await form.locator("textarea").fill("The map froze on level 2");
  await form.getByRole("button", { name: /send/i }).click();
  // Shipped flags.json has no contactEndpoint, so nothing is posted and the
  // page says so honestly rather than pretending the message was sent.
  await expect(page.getByTestId("contact-error")).toContainText("isn't switched on yet");
});

test("Begin exploring starts a Globe round", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("begin-exploring").click();
  await expect(page.locator(".satellite-map")).toBeVisible();
});
