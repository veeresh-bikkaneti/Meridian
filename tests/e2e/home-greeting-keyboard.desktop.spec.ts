import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Home greeting — keyboard / screen-reader pin (#214).
 *
 * The sibling pin (home-visual-layout.desktop.spec.ts) drives the
 * storyteller greeting with a pointer tap only, and its header says so
 * honestly. This pin closes that disclosed limit: it opens and
 * dismisses the greeting with NO pointer input at all, on a fresh
 * first-visit profile (tutorial invite up — the owner's exact path).
 *
 * What it proves:
 *   - the figure (a native <button>) is reachable by Tab alone, with a
 *     real :focus-visible ring, and Enter/Space on it dismisses the
 *     tutorial invite and starts the greeting on that same gesture;
 *   - the greeting bubble is a role="status" live region with a
 *     non-empty caption, fully inside the viewport;
 *   - the dismiss control is announced by its name ("Dismiss the
 *     storyteller's greeting", never the "×" glyph), measures the
 *     designed 44×44px, and is reachable by continuing to Tab — in
 *     DOM/focus order after the figure, with no keyboard trap;
 *   - keyboard dismissal removes the bubble AND returns focus to the
 *     first edition control (dismissBubble's focus return), asserted
 *     on document.activeElement, not just on the bubble disappearing.
 *   - the second release path too: the invite's own "Not now" button,
 *     activated with Space, also starts the greeting.
 *
 * Determinism choices:
 *   - Sound is seeded OFF (localStorage meridian.sound=off, the same
 *     seed mobile-home-overlap.spec.ts uses). The greeting then waits
 *     in its text phase with the bubble held open instead of racing
 *     the audio clock (clip length + 1.5s hold, 12s cap). Audio is
 *     not what this pin is about; the open/dismiss/focus route is.
 *   - The test waits for the storyteller-assets.json response before
 *     the first keypress, so the greeting audio slot has resolved and
 *     the bubble's hold is the stable one (see above).
 *   - Tab counts are never hard-coded: tabUntil() walks until the
 *     target is focused (bounded, with the focus trail in the failure
 *     message), so an extra stop above the banner cannot flake it.
 *
 * Honest limits:
 *   - The dismiss button's onClick always passes viaKeyboard=true, so
 *     focus return also fires for pointer dismissal in the app; this
 *     pin proves the keyboard outcome, not a modality distinction.
 *   - There is no Escape-to-dismiss for the home bubble (verified in
 *     storyteller-home.tsx: the only keydown listener is the
 *     first-gesture starter). Keyboard dismissal is Tab + Enter/Space
 *     on the dismiss button — that is the route pinned here.
 */
test.setTimeout(240_000);

const APP = "http://127.0.0.1:4123/Meridian/";

interface FocusInfo {
  tag: string;
  testid: string | null;
  label: string | null;
  text: string;
}

async function focusInfo(page: Page): Promise<FocusInfo | null> {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    return {
      tag: a.tagName,
      testid: a.getAttribute("data-testid"),
      label: a.getAttribute("aria-label"),
      text: (a.textContent ?? "").trim().slice(0, 60),
    };
  });
}

/** Press Tab (or Shift+Tab) until `pred` matches the focused element. */
async function tabUntil(
  page: Page,
  pred: (el: FocusInfo) => boolean,
  what: string,
  max = 40,
): Promise<{ tabs: number; el: FocusInfo }> {
  const trail: (FocusInfo | null)[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const el = await focusInfo(page);
    trail.push(el);
    if (el && pred(el)) return { tabs: i + 1, el };
  }
  throw new Error(
    `tabUntil: ${what} not focused after ${max} Tabs. Trail: ${JSON.stringify(trail)}`,
  );
}

async function openFreshHome(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await serveBuiltArtifact(context);
  await context.addInitScript(() => {
    try {
      localStorage.setItem("meridian.sound", "off");
    } catch {
      /* private mode — the pin's assertions do not depend on storage */
    }
  });
  const page = await context.newPage();
  const assetsSeen = page
    .waitForResponse((r) => r.url().includes("storyteller-assets.json"), {
      timeout: 15_000,
    })
    .catch(() => null);
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-home")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("tutorial-invite")).toBeVisible({
    timeout: 15_000,
  });
  await assetsSeen;
  return page;
}

/** After keyboard dismissal, focus must land on the first edition control. */
async function expectFocusReturned(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return "body";
          if (a.closest('[data-testid="tour-stop-difficulty"]')) return "difficulty";
          if (a.getAttribute("data-testid") === "home-heading") return "heading";
          return `${a.tagName}:${a.getAttribute("data-testid") ?? a.getAttribute("aria-label") ?? ""}`;
        }),
      { timeout: 5_000 },
    )
    .toMatch(/^(difficulty|heading)$/);
}

/** Shared second half: with the bubble up, Tab to dismiss and dismiss it. */
async function dismissByKeyboard(page: Page, key: "Enter" | "Space"): Promise<void> {
  const bubble = page.getByTestId("storyteller-home-bubble");
  await expect(bubble).toBeVisible({ timeout: 15_000 });
  await expect(bubble).toHaveAttribute("role", "status");
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).not.toHaveText("");

  // Bubble fully inside the viewport at desktop width.
  const bBox = await bubble.boundingBox();
  expect(bBox, "bubble box").not.toBeNull();
  expect(bBox!.x).toBeGreaterThanOrEqual(0);
  expect(bBox!.x + bBox!.width).toBeLessThanOrEqual(1440);

  // Screen-reader view of the dismiss control: announced by its name,
  // never the "×" glyph, and sized at the designed 44×44px target.
  const dismiss = page.getByTestId("storyteller-home-dismiss");
  await expect(dismiss).toHaveAccessibleName("Dismiss the storyteller's greeting");
  const dBox = await dismiss.boundingBox();
  expect(dBox, "dismiss box").not.toBeNull();
  expect(Math.round(dBox!.width)).toBe(44);
  expect(Math.round(dBox!.height)).toBe(44);

  // DOM/reading order inside the host: figure comes before the bubble.
  const order = await page.evaluate(() => {
    const figure = document.querySelector('[data-testid="storyteller-figure"]');
    const bub = document.querySelector('[data-testid="storyteller-home-bubble"]');
    if (!figure || !bub) return "missing";
    return figure.compareDocumentPosition(bub) & Node.DOCUMENT_POSITION_FOLLOWING
      ? "figure-before-bubble"
      : "bubble-before-figure";
  });
  expect(order).toBe("figure-before-bubble");

  // Continue tabbing from wherever focus is — the dismiss control must
  // be reachable, and the bubble must still be up when we get there.
  await tabUntil(page, (el) => el.testid === "storyteller-home-dismiss", "dismiss button");
  await expect(dismiss).toBeFocused();
  await expect(bubble).toBeVisible();

  await page.keyboard.press(key);
  await expect(bubble).toHaveCount(0, { timeout: 10_000 });
  await expectFocusReturned(page);

  // No trap, no ghost stop: tabbing on from the returned focus moves
  // somewhere new, and the removed dismiss button never reappears.
  const before = await focusInfo(page);
  await page.keyboard.press("Tab");
  const after = await focusInfo(page);
  expect(after?.testid).not.toBe("storyteller-home-dismiss");
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
}

test("greeting opens and dismisses by keyboard alone (figure path, Enter)", async ({
  browser,
}) => {
  const page = await openFreshHome(browser);

  // Held, not hidden: while the invite is up the bubble is absent.
  await expect(page.getByTestId("storyteller-home-bubble")).toHaveCount(0);

  const figure = page.getByTestId("storyteller-figure");
  await expect(figure).toBeVisible();
  // Screen-reader-style reachability: a button whose name names the
  // storyteller (the label is phase-dependent: "The storyteller", or
  // "Pause/Resume the greeting" while audio plays — sound is off here,
  // so the resting label applies).
  await expect(
    page.getByRole("button", { name: /storyteller/i }),
  ).toBeVisible();

  await tabUntil(page, (el) => el.testid === "storyteller-figure", "storyteller figure");
  await expect(figure).toBeFocused();
  // The focus arrived by keyboard — a real :focus-visible ring, not a
  // scripted .focus() (which would not match :focus-visible).
  const focusVisible = await page.evaluate(() =>
    document.activeElement?.matches(":focus-visible"),
  );
  expect(focusVisible).toBe(true);

  await page.keyboard.press("Enter");
  // That one gesture dismisses the invite AND starts the greeting.
  await expect(page.getByTestId("tutorial-invite")).toBeHidden({ timeout: 10_000 });

  await dismissByKeyboard(page, "Enter");
  await page.context().close();
});

test("greeting opens via the invite's own button and dismisses by keyboard (Space)", async ({
  browser,
}) => {
  const page = await openFreshHome(browser);

  await tabUntil(page, (el) => el.text === "Not now", "invite Not now button");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("tutorial-invite")).toBeHidden({ timeout: 10_000 });

  // Dismissing the invite releases the greeting on its own — the
  // bubble arrives with no further gesture.
  await dismissByKeyboard(page, "Space");
  await page.context().close();
});
