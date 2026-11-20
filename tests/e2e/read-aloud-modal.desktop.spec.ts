import { expect, test, type Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Read-aloud sheet as a TRUE ARRIVAL MODAL (owner direction,
 * 2026-11-20). On main the first-visit sheet is a fixed overlay with
 * no backdrop and no scroll lock: the home page behind it stays live,
 * so a first-visit kid can tap straight past the one question the
 * sheet exists to ask. The modal variant holds the page until one of
 * the three choices is picked:
 *
 * - a backdrop covers the page (a tap lands on it, never behind it),
 * - the home page is inert while the sheet is up,
 * - scrolling is locked and focus is trapped inside the sheet,
 * - there is no dismiss-without-choosing (no backdrop-click close,
 *   no Escape close),
 * - arrival only: the sheet lives solely in Home's first-visit
 *   queue, so it can never appear over a run or a case.
 *
 * The choices, their wording and their persistence
 * (meridian.readAloudPref.v1) are unchanged from main.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const PREF_KEY = "meridian.readAloudPref.v1";

/** Walk the first-visit queue the way a player does until the
 *  read-aloud sheet is the visible prompt. */
async function reachSheet(page: Page) {
  const queue = page.getByTestId("first-visit-queue");
  await expect(queue).toBeVisible();
  if ((await queue.getAttribute("data-prompt-id")) === "tour-invite") {
    await queue.getByRole("button", { name: "Not now" }).click();
  }
  await expect(queue).toHaveAttribute("data-prompt-id", "read-aloud-sheet");
  return queue;
}

async function storedPref(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { value?: string }).value ?? null;
    } catch {
      return null;
    }
  }, PREF_KEY);
}

test("arrival modal: backdrop holds the page, focus trapped, no dismiss without choosing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(APP_NO_IDLE);

  const sheet = await reachSheet(page);

  // The modal layer is up: dialog semantics + backdrop + the sheet
  // itself in the modal seat.
  await expect(sheet).toHaveAttribute("data-modal", "true");
  await expect(sheet).toHaveAttribute("role", "alertdialog");
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet).toHaveAccessibleName(/read aloud|stories/i);
  const backdrop = page.getByTestId("first-visit-modal-backdrop");
  await expect(backdrop).toBeVisible();

  // Scroll is locked while the sheet is up.
  const overflowWhileUp = await page.evaluate(() => ({
    body: document.body.style.overflow,
    root: document.documentElement.style.overflow,
  }));
  expect(overflowWhileUp.body, "body scroll locked").toBe("hidden");
  expect(overflowWhileUp.root, "root scroll locked").toBe("hidden");

  // The page behind is inert: the Begin exploring control sits under
  // an inert ancestor, and a hit test at its centre lands on the
  // backdrop or the sheet — never on the control itself.
  const begin = page.getByTestId("begin-exploring");
  await expect(begin).toBeVisible();
  const held = await begin.evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    let inert = false;
    while (node) {
      if (node.inert) inert = true;
      node = node.parentElement;
    }
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      inert,
      hitTestId: hit?.getAttribute("data-testid") ?? hit?.className ?? "",
    };
  });
  expect(held.inert, "hero control under an inert ancestor").toBe(true);
  expect(held.hitTestId, "hit test lands on the modal layer").not.toContain("begin-exploring");

  // A real click in the corner lands on the backdrop: nothing
  // dismisses, nothing starts, no preference is written.
  await page.mouse.click(8, 8);
  await expect(sheet).toBeVisible();
  expect(await storedPref(page), "backdrop click writes no preference").toBeNull();

  // Escape is not a dismiss either.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  expect(await storedPref(page), "Escape writes no preference").toBeNull();

  // Focus starts inside the sheet and Tab keeps it there, both ways.
  const focusInsideSheet = () =>
    sheet.evaluate((el) => el.contains(document.activeElement));
  await expect.poll(focusInsideSheet, { message: "focus starts inside the sheet" }).toBe(true);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(await focusInsideSheet(), `Tab #${i + 1} keeps focus in the sheet`).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await focusInsideSheet(), "Shift+Tab keeps focus in the sheet").toBe(true);

  // Picking a choice is the only way out — and it persists.
  await sheet.getByRole("button", { name: /Sometimes/ }).click();
  await expect(page.locator('[data-prompt-id="read-aloud-sheet"]')).toHaveCount(0);
  await expect(backdrop).toHaveCount(0);
  expect(await storedPref(page), "Sometimes persists").toBe("sometimes");

  // The hold is fully released: scroll restored, page live again.
  const overflowAfter = await page.evaluate(() => document.body.style.overflow);
  expect(overflowAfter, "scroll lock released").not.toBe("hidden");

  // Returning visit: no sheet, no backdrop, the page is live.
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("begin-exploring")).toBeVisible();
  await expect(page.getByTestId("first-visit-modal-backdrop")).toHaveCount(0);
  const queueAfter = page.getByTestId("first-visit-queue");
  if ((await queueAfter.count()) > 0) {
    await expect(queueAfter).not.toHaveAttribute("data-prompt-id", "read-aloud-sheet");
  }

  // Into a round: the sheet never appears over the in-progress game.
  await begin.click();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.getByTestId("first-visit-queue")).toHaveCount(0);
  await expect(page.getByTestId("first-visit-modal-backdrop")).toHaveCount(0);
});

for (const choice of [
  { name: /Always/, value: "always" },
  { name: /Never/, value: "never" },
] as const) {
  test(`arrival modal: "${choice.value}" dismisses, persists, and never re-asks`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP_NO_IDLE);

    const sheet = await reachSheet(page);
    await sheet.getByRole("button", { name: choice.name }).click();
    await expect(page.locator('[data-prompt-id="read-aloud-sheet"]')).toHaveCount(0);
    await expect(page.getByTestId("first-visit-modal-backdrop")).toHaveCount(0);
    expect(await storedPref(page), `${choice.value} persists`).toBe(choice.value);

    await page.goto(APP_NO_IDLE);
    await expect(page.getByTestId("begin-exploring")).toBeVisible();
    await expect(page.getByTestId("first-visit-modal-backdrop")).toHaveCount(0);
    const queueAfter = page.getByTestId("first-visit-queue");
    if ((await queueAfter.count()) > 0) {
      await expect(queueAfter).not.toHaveAttribute("data-prompt-id", "read-aloud-sheet");
    }
  });
}

/**
 * Owner captures (mocks are always full page): with CAPTURE_MODAL=1
 * this writes the modal's full-page captures at the four owner
 * widths into docs/motion-verify/. Skipped in normal runs so CI
 * never churns the committed captures.
 */
test("captures: modal full-page at 1280, 768, 390, 320", async ({ page }) => {
  test.skip(process.env.CAPTURE_MODAL !== "1", "captures are produced on demand only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [1280, 800],
    [768, 1024],
    [390, 844],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(APP_NO_IDLE);
    await reachSheet(page);
    await page.screenshot({
      path: `docs/motion-verify/read-aloud-modal-full-${width}px.png`,
      fullPage: true,
    });
    await page.evaluate((key) => localStorage.removeItem(key), PREF_KEY);
  }
});
