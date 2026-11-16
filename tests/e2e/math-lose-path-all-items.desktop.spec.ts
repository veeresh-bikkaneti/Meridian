import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * L1 lose path, gate flip (feat/lose-path-all-items) — desktop.
 *
 * Generalising the fair-share pilot (feat/fair-share-lose-path):
 * a wrong pick on ANY item that has a solved summary now shows
 * the answer-first line — "The answer is X — here's how." — and
 * then plays the item's existing act-3 narrated solved summary.
 * On this branch's base the summary system exists only for Math
 * at ages 7-10, so this spec walks three newly flipped Math items
 * end to end (the first case dealt, skip-count; the last of the
 * wave-1 cases, big-quotients; and a wave-3 scene item,
 * fair-parts), plus the two kinds of control that must NOT
 * reveal: a Math band with no summaries on this base (10-18) and
 * a subject with no summary system on this base (Physics, 7-10).
 * The pilot item's own walk stays in
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
  for (let guard = 0; guard < 13; guard++) {
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

test("wrong pick on skip-count (newly flipped) reveals the answer line, then the solved summary", async ({
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

  // The wrong pick ("6"; the answer is "8").
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "6", exact: true })
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

test("wrong pick on big-quotients (newly flipped, last case dealt) reveals its own answer line", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  await solveForwardTo(page, "math-number:division:big-quotients");

  // The wrong pick ("146"; the answer is "156").
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "146", exact: true })
    .click();

  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 156 — here's how.");
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene")).toHaveAttribute("data-phase", "solved");
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("Every shelf holds 100 and 50 and 6: 156 books!");

  expect(errors).toEqual([]);
});

test("wrong pick on fair-parts (newly flipped, a wave-3 scene item) reveals its own answer line", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  await solveForwardTo(page, "math-number:fractions:fair-parts");

  // The wrong pick ("1/2"; the answer is "1/4").
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "1/2", exact: true })
    .click();

  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 1/4 — here's how.");
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene")).toHaveAttribute("data-phase", "solved");
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("One part of four equal parts is 1/4 of the pizza!");

  expect(errors).toEqual([]);
});

test("control: a wrong pick on a Math 10-18 case (no summary on this base) behaves exactly as before", async ({
  page,
  context,
}) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openSubject(page, "subject-row-math", "math-case", "math-answer-card");
  await expect(page.getByTestId("math-case")).toHaveAttribute(
    "data-item",
    "math-number:tables:multi-digit",
  );

  // The wrong pick ("961"; the answer is "1,081").
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "961", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("math-result")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("control: a wrong pick on a Physics 7-10 case (no summary system on this base) behaves exactly as before", async ({
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

  // The wrong pick ("To the left"; the answer is "To the right").
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: "To the left", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("physics-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("physics-result")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene")).toHaveCount(0);

  expect(errors).toEqual([]);
});
