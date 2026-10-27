import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * 2026-10-21 review remediation (P0-3, P1-5, P2-11 + the contact form)
 * + 2026-10-27 Home UX polish (unified Scout Map pill, whole-card journal
 * & grown-ups click, high-visibility inline links, and navbar CONTACT).
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
  // Cure-round copy pin (see the contact test below): the promise is
  // about players only — grown-ups using the contact form do send a
  // message — so the "from players" qualifier must stay in the copy.
  await expect(note).toContainText(/from players/i);
  await expect(note).not.toContainText(/compliant/i);
  await page.getByTestId("privacy-link").click();
  await expect(page).toHaveURL(/\/privacy$/);
  // The COPPA posture is the headline claim; lock the wording a parent reads.
  await expect(page.getByText(/every visitor as a child/i).first()).toBeVisible();
  // Contact-message disclosures (review follow-up on #207, cure round):
  // delivery is PARKED, so the page says the form is not switched on yet
  // and describes delivery in the future tense — the processor is named,
  // retention is stated, the server will keep nothing, and the gate is
  // NOT presented as verified parental consent.
  await expect(page.getByText(/The form is not switched on yet/i)).toBeVisible();
  await expect(page.getByText(/Discord will receive the message/i)).toBeVisible();
  await expect(page.getByText(/within 90 days/i).first()).toBeVisible();
  await expect(page.getByText(/Our server will keep nothing/i)).toBeVisible();
  await expect(page.getByText(/not a parental-consent mechanism/i)).toBeVisible();
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
  // Cure-round copy pins: this assertion and the footer "from players"
  // assertion above pin the cure-round copy, so a copy-only un-parking
  // regression (removing the parked note, or the qualifier) fails the
  // suite. The parked note renders inside the form, after the gate.
  await expect(page.getByTestId("contact-parked-note")).toBeVisible();
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

test("home UX polish across 6 viewports: unified map-mode pill, whole-card journal & grownups click, inline links, and navbar CONTACT", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const viewports = [
    [320, 568],
    [375, 667],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1280, 800],
  ] as const;

  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("map-mode-button")).toBeVisible();
  const notNow = page.getByRole("button", { name: "Not now" });
  if ((await notNow.count()) > 0) {
    await notNow.click();
    await expect(page.getByTestId("tutorial-invite")).toHaveCount(0);
  }

  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));

    // Header nav items >=44px tall and 0 overlap
    const navItems = page.locator("header.hv5-nav button, header.hv5-nav a");
    const count = await navItems.count();
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < count; i++) {
      const b = (await navItems.nth(i).boundingBox())!;
      expect(b.height, `${w}x${h} nav item #${i} height`).toBeGreaterThanOrEqual(43.5);
      boxes.push(b);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        expect(ox * oy, `${w}x${h} nav overlap`).toBeLessThan(1);
      }
    }

    const navContact = page.getByTestId("nav-contact-link");
    const cBox = (await navContact.boundingBox())!;
    expect(cBox.width).toBeGreaterThanOrEqual(44);
    expect(cBox.height).toBeGreaterThanOrEqual(44);
  }

  // 1. Unified map-mode pill button contains map-mode-indicator inside map-mode-button
  const mapBtn = page.getByTestId("map-mode-button");
  const indicator = mapBtn.getByTestId("map-mode-indicator");
  await mapBtn.scrollIntoViewIfNeeded();
  const btnBox = (await mapBtn.boundingBox())!;
  expect(btnBox.width).toBeGreaterThanOrEqual(44);
  expect(btnBox.height).toBeGreaterThanOrEqual(44);
  await indicator.click();
  await expect(page.getByTestId("map-mode-popover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map-mode-popover")).toHaveCount(0);

  // 2. Whole-card click on "What the land remembers" heading & illustration scrolls & focuses #home-journal
  const journalCard = page.getByTestId("journal-card");
  await journalCard.scrollIntoViewIfNeeded();
  const journalH2 = (await journalCard.locator("h2", { hasText: "What the land remembers" }).boundingBox())!;
  await page.mouse.click(journalH2.x + journalH2.width / 2, journalH2.y + journalH2.height / 2);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
    .toBe("home-journal");

  await journalCard.scrollIntoViewIfNeeded();
  const journalArt = (await journalCard.locator(".hv5-art").boundingBox())!;
  await page.mouse.click(journalArt.x + journalArt.width / 2, journalArt.y + journalArt.height / 2);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
    .toBe("home-journal");

  // 3. Navbar GET INVOLVED scrolls & focuses #home-grownups ("For grown-ups" card)
  const getInvolvedBtn = page.locator("header.hv5-nav nav").getByRole("button", { name: "GET INVOLVED" });
  await getInvolvedBtn.scrollIntoViewIfNeeded();
  await getInvolvedBtn.click();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
    .toBe("home-grownups");

  // 4. Whole-card click on "For grown-ups" heading & illustration opens the grown-up math gate modal
  const grownupsCard = page.getByTestId("grownups-card");
  await grownupsCard.scrollIntoViewIfNeeded();
  const grownupsH2 = (await grownupsCard.locator("h2", { hasText: "For grown-ups" }).boundingBox())!;
  await page.mouse.click(grownupsH2.x + grownupsH2.width / 2, grownupsH2.y + grownupsH2.height / 2);
  await expect(page.getByTestId("grownup-gate")).toBeVisible();
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);

  await grownupsCard.scrollIntoViewIfNeeded();
  const grownupsArt = (await grownupsCard.locator(".hv5-art").boundingBox())!;
  await page.mouse.click(grownupsArt.x + grownupsArt.width / 2, grownupsArt.y + grownupsArt.height / 2);
  await expect(page.getByTestId("grownup-gate")).toBeVisible();
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);

  // 5. Inline links inside "For grown-ups" navigate independently without opening the home modal
  await grownupsCard.scrollIntoViewIfNeeded();
  await grownupsCard.getByRole("link", { name: "privacy notice" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.goBack();
  await expect(grownupsCard).toBeVisible();

  await grownupsCard.scrollIntoViewIfNeeded();
  await grownupsCard.getByRole("link", { name: "contact us" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await page.goBack();
  await expect(grownupsCard).toBeVisible();

  // 6. Top navbar CONTACT link right after ABOUT navigates to /contact
  const navContact = page.getByTestId("nav-contact-link");
  await navContact.scrollIntoViewIfNeeded();
  await expect(navContact).toBeVisible();
  await navContact.click();
  await expect(page).toHaveURL(/\/contact$/);
});
