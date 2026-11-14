import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Physics subject — through the why-learn card and subject picker.
 *
 * The Physics row is ready in the picker; tapping it opens a physics
 * case dealt for the player's age band (profile seeded in
 * localStorage). One case per tested band is played to the result.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

type Band = "7-10" | "10-18" | "18+";

async function setup(context: BrowserContext, band: Band) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    ({ key, b }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: b,
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    { key: PROFILE_KEY, b: band },
  );
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function openPhysicsCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  const row = page.getByTestId("subject-row-physics");
  await expect(row).toBeEnabled();
  await row.click();
  await expect(page.getByTestId("physics-case")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

test("10-18 physics case plays through to the result", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openPhysicsCase(page);
  const physicsCase = page.getByTestId("physics-case");
  await expect(physicsCase).toHaveAttribute("data-band", "10-18");
  await expect(physicsCase).toHaveAttribute("data-item", "physics:arrive:unit-rate");
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: "The 8 metres in 2 seconds cart", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
  await expect(page.getByTestId("physics-used-in")).toContainText("You just used this in…");
  expect(errors).toEqual([]);
});

test("18+ physics case plays through to the result", async ({ page, context }) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openPhysicsCase(page);
  const physicsCase = page.getByTestId("physics-case");
  await expect(physicsCase).toHaveAttribute("data-band", "18+");
  await expect(physicsCase).toHaveAttribute("data-item", "physics:ramp:adult-ratio");
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: "Boom B", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
  expect(errors).toEqual([]);
});

/** Correct button label for every item on the path to a new item. */
const CORRECT_BY_ITEM: Record<string, string> = {
  "physics:push:which-way": "To the right",
  "physics:push:equal-pushes": "8",
  "physics:magnet:flip": "They now push apart",
  "physics:drop:down": "Down into the bucket",
  "physics:arrive:unit-rate": "The 8 metres in 2 seconds cart",
  "physics:ramp:slope-ratio": "Ramp B",
  "physics:magnet:closer": "The closer pair",
  "physics:push:mass": "The lighter cart",
};

/**
 * Answer each dealt case correctly (with "Next case") until the target
 * item is dealt, then answer it. Caps the walk so a missing target
 * fails fast instead of wrapping forever.
 */
async function playToItem(page: Page, targetId: string) {
  const physicsCase = page.getByTestId("physics-case");
  for (let step = 0; step < 6; step++) {
    const current = await physicsCase.getAttribute("data-item");
    if (current === targetId) return;
    const correct = CORRECT_BY_ITEM[current ?? ""];
    expect(correct, `no correct choice mapped for ${current}`).toBeDefined();
    await page
      .getByTestId("physics-answer-card")
      .getByRole("button", { name: correct!, exact: true })
      .click();
    await dismissCelebration(page);
    await expect(page.getByTestId("physics-result")).toBeVisible();
    await page.getByRole("button", { name: "Next case" }).click();
    await expect(physicsCase).not.toHaveAttribute("data-item", current ?? "");
  }
  throw new Error(`target item ${targetId} was not dealt within 6 cases`);
}

test("7-10 new physics item plays through to the result", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openPhysicsCase(page);
  const physicsCase = page.getByTestId("physics-case");
  await expect(physicsCase).toHaveAttribute("data-band", "7-10");
  await playToItem(page, "physics:drop:down");
  await expect(physicsCase).toHaveAttribute("data-item", "physics:drop:down");
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: "Down into the bucket", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
  await expect(page.getByTestId("physics-used-in")).toContainText("You just used this in…");
  expect(errors).toEqual([]);
});

test("10-18 new physics item plays through to the result", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openPhysicsCase(page);
  const physicsCase = page.getByTestId("physics-case");
  await expect(physicsCase).toHaveAttribute("data-band", "10-18");
  await playToItem(page, "physics:push:mass");
  await expect(physicsCase).toHaveAttribute("data-item", "physics:push:mass");
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: "The lighter cart", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
  await expect(page.getByTestId("physics-used-in")).toContainText("You just used this in…");
  expect(errors).toEqual([]);
});
