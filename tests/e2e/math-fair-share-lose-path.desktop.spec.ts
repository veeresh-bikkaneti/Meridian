import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * L1 lose path (feat/fair-share-lose-path) — desktop.
 *
 * One item only: the second distinct wrong pick on fair-share
 * (Math, ages 7-10) shows the answer-first line — "The answer
 * is 3 — here's how." — and then plays the item's existing act-3
 * narrated solved summary (scene in its solved phase, the
 * performance under way, the full script standing as text). The
 * first wrong pick keeps the plain "Not quite" feedback (owner
 * decision, 2026-11-19). A right pick on fair-share is the win
 * path exactly as before.
 *
 * AMENDED by feat/lose-path-all-items (the gate flip): the very
 * next case (unknown-factor) is no longer a no-reveal control —
 * it carries a summary too, so its second distinct wrong pick
 * now reveals as well, and the second half of the first test
 * below asserts exactly that. The no-reveal controls (a Math 10-18 overflow
 * item with no summary, and a subject whose wrapper passes no
 * loseReveal hook on this base) live in
 * math-lose-path-all-items.desktop.spec.ts.
 */
test.setTimeout(600_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "fair-share-lose-path-shots";

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
};

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    ({ key }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: "7-10",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    { key: PROFILE_KEY },
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

async function openCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
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

test("second wrong pick on fair-share reveals the answer line, then the solved summary", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await solveForwardTo(page, "math-number:division:fair-share");

  const scene = page.getByTestId("clue-scene");
  await expect(scene).toHaveAttribute("data-phase", "setup");
  // Answer-blind before the pick: no reveal, no summary, no line.
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);

  // The FIRST wrong pick ("2"; the answer is "3") reveals
  // nothing: "Not quite", picks live, scene still in setup.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "2", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-phase", "setup");

  // The SECOND distinct wrong pick ("4") reveals.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "4", exact: true })
    .click();

  // 1. The answer-first line.
  const reveal = page.getByTestId("math-lose-reveal");
  await expect(reveal).toBeVisible();
  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 3 — here's how.");
  // It is not a win: no result section, no celebration copy.
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(reveal).not.toContainText("You got it!");

  // 2. The same act 3 the win path plays: solved phase, the
  // performance under way, captions stepping, the full script
  // standing as text with its closing line.
  await expect(scene).toHaveAttribute("data-phase", "solved");
  await expect(scene).toHaveAttribute("data-summary", "playing");
  await expect(page.getByTestId("clue-summary-play")).toBeVisible();
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("Every friend has 3 snacks");
  await expect
    .poll(async () => (await page.getByTestId("clue-scene-caption").innerText()).trim().length, {
      timeout: 12_000,
    })
    .toBeGreaterThan(0);
  await scene.screenshot({ path: `${SHOTS}/fair-share-lose-reveal-desktop.png` });

  // AMENDED by the gate flip: the very next case (unknown-factor)
  // carries a summary too, so its second distinct wrong pick now
  // reveals the same way — it is no longer a no-reveal control.
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("math-case")).toHaveAttribute(
    "data-item",
    "math-number:division:unknown-factor",
  );
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  // First wrong pick ("4"; the answer is "5"): no reveal. (This
  // also proves the count reset with the case — fair-share's two
  // wrongs must not carry over.)
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "4", exact: true })
    .click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  // Second distinct wrong pick ("6"): the reveal.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  await expect(page.getByTestId("math-lose-answer")).toHaveText("The answer is 5 — here's how.");
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-text")).toBeVisible();
  await expect(page.getByTestId("clue-scene")).toHaveAttribute("data-phase", "solved");

  expect(errors).toEqual([]);
});

test("right pick on fair-share is the win path exactly as before", async ({ page, context }) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await solveForwardTo(page, "math-number:division:fair-share");

  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "3", exact: true })
    .click();
  await dismissCelebration(page);

  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("You got it!");
  await expect(result).toContainText("The answer is 3.");
  await expect(result).toContainText("12 snacks ÷ 4 friends = 3 snacks each.");
  // The lose line never appears on the win path.
  await expect(page.getByTestId("math-lose-reveal")).toHaveCount(0);
  await expect(page.getByTestId("math-lose-answer")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene")).toHaveAttribute("data-phase", "solved");
  await expect(page.getByTestId("clue-summary-text")).toBeVisible();

  expect(errors).toEqual([]);
});
