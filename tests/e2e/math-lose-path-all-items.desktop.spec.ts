import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * L1 lose path, gate flip (feat/lose-path-all-items) — desktop.
 *
 * Generalising the fair-share pilot (feat/fair-share-lose-path):
 * on ANY item that has a solved summary, the SECOND DISTINCT
 * wrong pick shows the answer-first line — "The answer is X —
 * here's how." — and then plays the item's existing act-3
 * narrated solved summary. The first wrong pick keeps the plain
 * "Not quite" feedback (owner decision, 2026-11-19), so each
 * walk below takes one wrong pick, asserts no reveal, then
 * takes a second, different wrong pick and asserts the reveal.
 * The gate is a property of the item: it is true exactly when
 * the item is playable for the band asked about and its scene
 * description carries a summary. On this branch's rebased base
 * that covers 37 Math item×band pairs — 22 for ages 7-10, 13
 * for ages 10-18 and 2 for ages 18+ — so this spec walks three
 * newly flipped Math items end to end (the first case dealt,
 * skip-count; the last of the wave-1 cases, big-quotients; and
 * a wave-3 scene item, fair-parts), plus the two kinds of
 * control that must NOT reveal: a Math 10-18 overflow item
 * with no scene description and so no summary
 * (two-digit-divisors, reached by solving forward through the
 * 13 cases dealt before it) and a hook-free other-subject case
 * (Physics, ages 7-10: its scene and summary exist for the win
 * path, but its wrapper passes no loseReveal hook, so a wrong
 * pick leaves the scene in its setup phase and reveals
 * nothing). The pilot item's own walk stays in
 * math-fair-share-lose-path.desktop.spec.ts.
 */
test.setTimeout(600_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "lose-path-all-items-shots";

const CORRECT: Record<string, string> = {
  "math-number:groups:skip-count": "8",
  "math-number:groups:equal-groups": "24",
  "math-number:tables:buses": "4",
  "math-number:place:hundreds-tens-ones": "345",
  "math-number:place:compare": "385",
  "math-number:place:round": "300",
  "math-number:place:ten-times": "700",
  "math-number:tables:facts": "28",
  "math-number:tables:big-products": "1,008",
  "math-number:division:fair-share": "3",
  "math-number:division:unknown-factor": "5",
  "math-number:division:remainders": "5",
  "math-number:division:big-quotients": "156",
  "math-number:tables:multi-digit": "1,081",
  "math-applied:measure:convert-metric": "2,400",
  "math-number:fractions:percent": "56",
  "math-applied:geometry:scale-drawing": "8",
  "math-number:division:standard-algorithm": "156",
  "math-number:fractions:multiply": "1/3",
  "math-number:fractions:divide": "8",
  "math-applied:measure:accuracy": "2.48",
  "math-applied:rates:unit-rate": "1.6",
  "math-applied:rates:constant-speed": "5",
  "math-applied:rates:one-step": "7",
  "math-applied:rates:two-step": "5",
  "math-applied:trig:bearings": "37°",
};

async function setup(context: BrowserContext, band: string) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    ({ key, band }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band,
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    { key: PROFILE_KEY, band },
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

async function openSubject(page: Page, row: string, caseTestId: string, cardTestId: string) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId(row).click();
  await expect(page.getByTestId(caseTestId)).toBeVisible();
  await expect(page.getByTestId(cardTestId)).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

/** Solve forward, case by case, until the named item is dealt. */
async function solveForwardTo(page: Page, item: string) {
  for (let guard = 0; guard < 14; guard++) {
    const current = await page.getByTestId("math-case").getAttribute("data-item");
    if (current === item) return;
    const correct = CORRECT[current!];
    expect(correct, `a known correct pick for ${current}`).toBeTruthy();
    await page
      .getByTestId("math-answer-card")
      .getByRole("button", { name: correct!, exact: true })
      .click();
    await dismissCelebration(page);
    await expect(page.getByTestId("math-result")).toBeVisible();
    await page.getByRole("button", { name: /Next case/ }).click();
    await expect(page.getByTestId("math-answer-card")).toBeVisible();
  }
  throw new Error(`never dealt ${item}`);
}

test("second wrong pick on skip-count (newly flipped) reveals the answer line, then the solved summary", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  await expect(page.getByTestId("math-case")).toHaveAttribute(
    "data-item",
    "math-number:groups:skip-count",
  );

  const scene = page.getByTestId("clue-scene");
  await expect(scene).toHaveAttribute("data-phase", "setup");
  // Answer-blind before the pick: no reveal, no summary, no line.
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);

  // The FIRST wrong pick ("6"; the answer is "8") keeps today's
  // behaviour: "Not quite", the picks stay live, nothing reveals.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-phase", "setup");

  // The SECOND distinct wrong pick ("10") reveals.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "10", exact: true })
    .click();

  const reveal = page.getByTestId("math-lose-reveal");
  await expect(reveal).toBeVisible();
  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 8 — here's how.");
  // It is not a win: no result section, no celebration copy.
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(reveal).not.toContainText("You got it!");

  // The same act 3 the win path plays.
  await expect(scene).toHaveAttribute("data-phase", "solved");
  await expect(scene).toHaveAttribute("data-summary", "playing");
  await expect(page.getByTestId("clue-summary-play")).toBeVisible();
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("Counting in fives finds the groups fast");
  await expect
    .poll(async () => (await page.getByTestId("clue-scene-caption").innerText()).trim().length, {
      timeout: 12_000,
    })
    .toBeGreaterThan(0);
  await scene.screenshot({ path: `${SHOTS}/skip-count-lose-reveal-desktop.png` });

  expect(errors).toEqual([]);
});

test("second wrong pick on big-quotients (newly flipped, last case dealt) reveals its own answer line", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  await solveForwardTo(page, "math-number:division:big-quotients");

  // The first wrong pick ("146"; the answer is "156") reveals
  // nothing; the second distinct wrong pick ("166") reveals.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "146", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "166", exact: true })
    .click();

  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 156 — here's how.");
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene")).toHaveAttribute("data-phase", "solved");
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("Every shelf holds 100 and 50 and 6: 156 books!");

  expect(errors).toEqual([]);
});

test("second wrong pick on fair-parts (newly flipped, a wave-3 scene item) reveals its own answer line", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  await solveForwardTo(page, "math-number:fractions:fair-parts");

  // The first wrong pick ("1/2"; the answer is "1/4") reveals
  // nothing; the second distinct wrong pick ("1/3") reveals.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "1/2", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "1/3", exact: true })
    .click();

  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 1/4 — here's how.");
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene")).toHaveAttribute("data-phase", "solved");
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("One part of four equal parts is 1/4 of the pizza!");

  expect(errors).toEqual([]);
});

test("control: a wrong pick on a Math 10-18 overflow case (no summary) behaves exactly as before", async ({
  page,
  context,
}) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  // two-digit-divisors is dealt 14th in the 10-18 registry order
  // (index 13), so solve forward through the 13 cases before it.
  await solveForwardTo(page, "math-number:division:two-digit-divisors");
  await expect(page.getByTestId("math-case")).toHaveAttribute(
    "data-item",
    "math-number:division:two-digit-divisors",
  );

  // The wrong pick ("12"; the answer is "13").
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "12", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("math-result")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("control: a wrong pick on a Physics 7-10 case (no loseReveal hook on this base) behaves exactly as before", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-physics", "physics-case", "physics-answer-card");
  await expect(page.getByTestId("physics-case")).toHaveAttribute(
    "data-item",
    "physics:push:which-way",
  );

  // Physics has a scene on this base (the win path's): it stands
  // in its setup phase before the pick, with no summary text.
  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);

  // The wrong pick ("To the left"; the answer is "To the right").
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: "To the left", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("physics-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("physics-result")).toHaveCount(0);
  // No reveal: the scene stays in setup and no summary stands.
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);

  expect(errors).toEqual([]);
});
