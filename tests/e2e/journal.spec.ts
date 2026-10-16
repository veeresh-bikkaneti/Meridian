import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Journal — "What the land remembers" (docs/journal-spec.md §8).
 *
 * The browser clock is mocked (page.clock) to a fixed instant whose
 * 2-hour window index lands on a pure-geography triple, so the expected
 * set is known exactly: entry number, shared geography, 3 notes.
 * Advancing the mocked clock by one window must advance the displayed
 * set on its own — no reload.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const WINDOW_MS = 7_200_000;
const SET_COUNT = 36;

/** Pure-set geography by cycle index (spec §2/§3 set order). */
function geographyForIndex(index: number): string {
  if (index < 9) return "Lincoln, Nebraska";
  if (index < 13) return "Lincoln Region, Nebraska";
  if (index < 19) return "Nebraska";
  if (index < 25) return "United States";
  return "The World";
}

/** A fixed instant in a pure-triple window (index < 33), with its index. */
function fixedInstant(): { time: Date; index: number } {
  let t = Date.UTC(2026, 9, 16, 12, 0, 0);
  let index = Math.floor(t / WINDOW_MS) % SET_COUNT;
  while (index >= 33) {
    t += WINDOW_MS;
    index = Math.floor(t / WINDOW_MS) % SET_COUNT;
  }
  return { time: new Date(t), index };
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadHome(page: Page, time: Date): Promise<void> {
  await page.context().addInitScript(
    (seeds: Record<string, string>) => {
      try {
        for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
      } catch {
        /* private mode — ignore */
      }
    },
    {
      "meridian.grandpaTour.lastDate": dateKey(time),
      "meridian.tutorialSeen": "1",
    },
  );
  await page.goto(APP);
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  // Let boot timers (which the mocked clock holds) drain a little.
  await page.clock.runFor(1_000);
}

test("opens from the card: current set's notes, one geography, Esc returns focus", async ({
  page,
}) => {
  const { time, index } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
  const geography = geographyForIndex(index);

  // The card names the current set.
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    `Now showing: ${geography} · 3 field notes`,
  );

  await page.getByTestId("journal-open").click();
  const view = page.getByTestId("journal-view");
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute("role", "dialog");
  await expect(view).toHaveAttribute("aria-modal", "true");
  await expect(view.getByRole("heading", { name: "What the land remembers" })).toBeVisible();

  // The set's notes: count = set size, one shared geography eyebrow.
  const notes = view.getByTestId("journal-note");
  await expect(notes).toHaveCount(3);
  const eyebrows = await notes.locator(".journal-note-eyebrow").allTextContents();
  for (const eyebrow of eyebrows) {
    expect(eyebrow).toBe(geography.toUpperCase());
  }
  // Every note carries a citation link (new tab) and a textual confidence.
  const firstLink = notes.first().locator("a");
  await expect(firstLink).toHaveAttribute("target", "_blank");
  await expect(firstLink).toHaveAttribute("rel", "noreferrer");
  await expect(notes.first()).toContainText(/Confidence: (Verified|Cited) — /);

  // Footer: entry number + plain-text countdown.
  await expect(view.locator(".journal-footer")).toHaveText(
    new RegExp(`^Entry ${index + 1} of 36 · Next entry in \\d+:\\d{2}$`),
  );

  // Esc closes and focus returns to the invoking card button (the host
  // returns focus inside requestAnimationFrame — drain the mocked rAF).
  await page.keyboard.press("Escape");
  await page.clock.runFor(200);
  await expect(view).toBeHidden();
  await expect(page.getByTestId("journal-open")).toBeFocused();
});

test("opens from the nav JOURNAL; the close button returns focus to it", async ({ page }) => {
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);

  await page.getByTestId("journal-open-nav").click();
  const view = page.getByTestId("journal-view");
  await expect(view).toBeVisible();
  await expect(view.getByTestId("journal-note")).toHaveCount(3);

  await page.getByTestId("journal-close").click();
  await page.clock.runFor(200);
  await expect(view).toBeHidden();
  await expect(page.getByTestId("journal-open-nav")).toBeFocused();
});

test("mocked clock advanced 2h advances the displayed set without reload", async ({ page }) => {
  const { time, index } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);

  // Record the first set from the open view.
  await page.getByTestId("journal-open").click();
  const view = page.getByTestId("journal-view");
  await expect(view).toBeVisible();
  const firstTitle = await view.getByTestId("journal-note").first().locator("h3").textContent();
  await page.keyboard.press("Escape");
  await page.clock.runFor(200);
  await expect(view).toBeHidden();

  // Focus must leave the card, or rotation is (correctly) deferred (§6).
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });

  // Advance one full window: the boundary timer recomputes the set.
  await page.clock.fastForward(WINDOW_MS);

  const nextIndex = (index + 1) % SET_COUNT;
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    `Now showing: ${geographyForIndex(nextIndex)} · 3 field notes`,
    { timeout: 10_000 },
  );

  await page.getByTestId("journal-open").click();
  await expect(view).toBeVisible();
  await expect(view.locator(".journal-footer")).toHaveText(
    new RegExp(`^Entry ${nextIndex + 1} of 36 · Next entry in \\d+:\\d{2}$`),
  );
  const nextTitle = await view.getByTestId("journal-note").first().locator("h3").textContent();
  expect(nextTitle).not.toBe(firstTitle);
});
