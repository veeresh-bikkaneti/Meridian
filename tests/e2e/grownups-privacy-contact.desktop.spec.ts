import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * 2026-10-21 review remediation (P0-3, P1-5, P2-11 + the contact form)
 * and 2026-10-27 contact webhook enablement.
 *
 * Unit tests cover the pieces; this proves the home page wires them up in
 * the built artifact: the footer reaches /privacy and /contact by in-app
 * navigation (the static Pages mirror has no deep-link server, so that is
 * how real visitors get there), the contact form is hidden behind the
 * grown-up gate, submitting posts to the configured contactEndpoint and
 * shows a confirmation message to all users that we received their request
 * and will get back to them, and "Begin exploring" starts a round instead
 * of only scrolling.
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
  // The promise is about players only — grown-ups using the contact form do
  // send a message — so the "from players" qualifier must stay in the copy.
  await expect(note).toContainText(/from players/i);
  await expect(note).not.toContainText(/compliant/i);
  await page.getByTestId("privacy-link").click();
  await expect(page).toHaveURL(/\/privacy$/);
  // The COPPA posture is the headline claim; lock the wording a parent reads.
  await expect(page.getByText(/every visitor as a child/i).first()).toBeVisible();
  // Contact-message disclosures: the processor is named, retention is stated,
  // the server keeps nothing, and the gate is NOT presented as verified
  // parental consent.
  await expect(page.getByText(/The form is not switched on yet/i)).toHaveCount(0);
  await expect(page.getByText(/Discord receives the message/i)).toBeVisible();
  await expect(page.getByText(/within 90 days/i).first()).toBeVisible();
  await expect(page.getByText(/Our server keeps nothing/i)).toBeVisible();
  await expect(page.getByText(/not a parental-consent mechanism/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact us" }).first()).toBeVisible();
});

test("contact form sits behind the grown-up gate and shows confirmation message to all users", async ({
  context,
  page,
}) => {
  const postedPayloads: unknown[] = [];
  let stubStored = true;
  await context.route("https://meridian.knowledgetest.workers.dev/api/contact", async (route) => {
    postedPayloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, stored: stubStored }),
    });
  });

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
  await expect(page.getByTestId("contact-parked-note")).toHaveCount(0);
  await expect(page.getByTestId("contact-kid-note")).toBeVisible();

  // Case 1: stored: true -> confirmation message shown and form reset
  await form.locator("select").selectOption("bug");
  await form.locator("textarea").fill("The map froze on level 2");
  await form.getByRole("button", { name: /send/i }).click();

  const sentBanner = page.getByTestId("contact-sent");
  await expect(sentBanner).toBeVisible();
  await expect(sentBanner).toContainText(
    "Thanks — we received your request and will get back to you.",
  );
  expect(postedPayloads).toEqual([{ topic: "bug", message: "The map froze on level 2", website: "" }]);
  await expect(form.locator("textarea")).toHaveValue("");

  // Case 2: stored: false -> ALL users still get the same confirmation message
  stubStored = false;
  await form.locator("select").selectOption("other");
  await form.locator("textarea").fill("Follow-up question from a teacher");
  await form.getByRole("button", { name: /send/i }).click();
  await expect(form.locator("textarea")).toHaveValue("");
  expect(postedPayloads).toHaveLength(2);
  await expect(sentBanner).toBeVisible();
  await expect(sentBanner).toContainText(
    "Thanks — we received your request and will get back to you.",
  );
});

test("contact form fails closed if flags.json omits contactEndpoint", async ({ context, page }) => {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ flags: { globeTierSplit: true }, version: 1 }),
    });
  });

  await page.goto(APP_NO_IDLE);
  await page.getByTestId("contact-link").click();
  await expect(page).toHaveURL(/\/contact$/);

  const question = await page.locator(".agep-question").textContent();
  const m = question?.match(/(\d+) × (\d+)/);
  expect(m).not.toBeNull();
  for (const d of String(Number(m![1]) * Number(m![2]))) await page.keyboard.press(d);
  await page.keyboard.press("Enter");

  const form = page.getByTestId("contact-form");
  await expect(form).toBeVisible();
  await form.locator("select").selectOption("bug");
  await form.locator("textarea").fill("Checking kill-switch behavior");
  await form.getByRole("button", { name: /send/i }).click();
  await expect(page.getByTestId("contact-error")).toContainText("isn't switched on yet");
});

test("Begin exploring starts a Globe round", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("begin-exploring").click();
  await expect(page.locator(".satellite-map")).toBeVisible();
});
