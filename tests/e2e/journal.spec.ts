import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
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

/** A fixed instant whose window index is exactly `target`. */
function fixedInstantAt(target: number): { time: Date; index: number } {
  let t = Date.UTC(2026, 9, 16, 12, 0, 0);
  while (Math.floor(t / WINDOW_MS) % SET_COUNT !== target) t += WINDOW_MS;
  return { time: new Date(t), index: target };
}

/**
 * The expected set contents, derived from the committed generated
 * dataset (src/game/journal-data.ts) — the same source the app renders.
 * Returns the set's notes in order as { placeId, href } pairs.
 */
const JOURNAL_DATA = readFileSync(path.resolve("src/game/journal-data.ts"), "utf8");
function expectedNotes(index: number): { placeId: string; href: string }[] {
  const setsPart = JOURNAL_DATA.slice(JOURNAL_DATA.indexOf("JOURNAL_SETS"));
  const idLists = [...setsPart.matchAll(/"noteIds": \[([^\]]*)\]/g)].map((m) =>
    [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!),
  );
  const hrefById = new Map<string, string>();
  for (const m of JOURNAL_DATA.matchAll(/"placeId": "([^"]+)"[\s\S]*?"href": "([^"]+)"/g)) {
    if (!hrefById.has(m[1]!)) hrefById.set(m[1]!, m[2]!);
  }
  return idLists[index]!.map((placeId) => ({ placeId, href: hrefById.get(placeId)! }));
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
  expect(eyebrows.length).toBe(await notes.count());
  for (const eyebrow of eyebrows) {
    expect(eyebrow).toBe(geography.toUpperCase());
  }
  // Every note carries a citation link (new tab) and a textual confidence.
  const firstLink = notes.first().locator("a");
  await expect(firstLink).toHaveAttribute("target", "_blank");
  await expect(firstLink).toHaveAttribute("rel", "noreferrer");
  await expect(notes.first()).toContainText(/Confidence: (Verified|Cited) — /);

  // The first note's citation href is exactly the catalog href the
  // generated dataset records for this window's first note.
  const expected = expectedNotes(index);
  await expect(firstLink).toHaveAttribute("href", expected[0]!.href);

  // Every rendered note: non-empty story, exactly one citation link with
  // the dataset's href, and a full confidence line (tier word + basis).
  for (let i = 0; i < expected.length; i++) {
    const note = notes.nth(i);
    const story = await note.locator(".journal-note-story").textContent();
    expect(story?.trim().length, `note ${i} story`).toBeGreaterThan(0);
    const link = note.locator("a");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", expected[i]!.href);
    await expect(note.locator(".journal-confidence")).toHaveText(
      /^(Confidence: Verified — government or university source\.|Confidence: Cited — named source recorded in the catalog\.)$/,
    );
  }

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

test("deferral: the window rolls while the view is OPEN — the open entry does not change", async ({
  page,
}) => {
  const { time, index } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);

  await page.getByTestId("journal-open").click();
  const view = page.getByTestId("journal-view");
  await expect(view).toBeVisible();
  const footer = view.locator(".journal-footer");
  const entryNow = new RegExp(`^Entry ${index + 1} of 36 · Next entry in \\d+:\\d{2}$`);
  await expect(footer).toHaveText(entryNow);
  const firstTitle = await view.getByTestId("journal-note").first().locator("h3").textContent();

  // The boundary passes under the open view: the reader's entry must NOT
  // be swapped (spec §6). This is the negative test for the deferral —
  // a build that applies rotation immediately fails here.
  await page.clock.fastForward(WINDOW_MS);
  await expect(footer).toHaveText(entryNow);
  await expect(view.getByTestId("journal-note").first().locator("h3")).toHaveText(firstTitle!);

  // Closing the view releases the deferred set: reopening shows the
  // next entry, with different notes.
  await page.getByTestId("journal-close").click();
  await page.clock.runFor(200);
  await expect(view).toBeHidden();

  const nextIndex = (index + 1) % SET_COUNT;
  await page.getByTestId("journal-open").click();
  await expect(view).toBeVisible();
  await expect(footer).toHaveText(
    new RegExp(`^Entry ${nextIndex + 1} of 36 · Next entry in \\d+:\\d{2}$`),
  );
  const nextTitle = await view.getByTestId("journal-note").first().locator("h3").textContent();
  expect(nextTitle).not.toBe(firstTitle);
});

test("deferral: the window rolls while focus is INSIDE the card — the card line does not change until focus leaves", async ({
  page,
}) => {
  // Index 8 is the last Lincoln triple; the next set is the first region
  // triple, so the card line's geography text provably changes once the
  // deferred set lands.
  const { time } = fixedInstantAt(8);
  await page.clock.install({ time });
  await loadHome(page, time);

  const line = page.getByTestId("journal-now-showing");
  const before = "Now showing: Lincoln, Nebraska · 3 field notes";
  await expect(line).toHaveText(before);

  // Focus inside the card, then the boundary passes: no swap under focus.
  await page.getByTestId("journal-open").focus();
  await page.clock.fastForward(WINDOW_MS);
  await expect(line).toHaveText(before);

  // Focus leaves the card → the deferred set is applied.
  await page.getByTestId("home-heading").focus();
  await expect(line).toHaveText("Now showing: Lincoln Region, Nebraska · 3 field notes", {
    timeout: 10_000,
  });
});
