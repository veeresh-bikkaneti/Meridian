import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Journal — "What the land remembers" (docs/journal-spec.md §8), adapted
 * from the v2 overlay spec to main's INLINE surface (owner ruling Q1):
 * the journal lives in the #home-journal section of the home page; the
 * home Journal card names the current entry and its READ THE ENTRY button
 * scroll-jumps to the section and focuses it.
 *
 * The browser clock is mocked (page.clock) to a fixed instant whose
 * 30-minute window index lands on one note, so the expected entry is
 * known exactly: entry number, geography, 1 note. Advancing the mocked
 * clock by one window must advance the displayed entry on its own —
 * no reload — unless focus is inside the card or the section, where
 * the swap is deferred until focus leaves (spec §6). With singletons
 * (B8) there is no straddle: a window boundary always swaps the whole
 * displayed entry, never part of a set.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const WINDOW_MS = 1_800_000;
const ENTRY_COUNT = 106;

/** Entry geography by cycle index (spec §2 ring order, one note per window). */
function geographyForIndex(index: number): string {
  if (index < 29) return "Lincoln, Nebraska";
  if (index < 43) return "Lincoln Region, Nebraska";
  if (index < 62) return "Nebraska";
  if (index < 81) return "United States";
  return "The World";
}

/** A fixed instant, with its window index (any window shows one entry). */
function fixedInstant(): { time: Date; index: number } {
  const t = Date.UTC(2026, 9, 16, 12, 0, 0);
  const index = Math.floor(t / WINDOW_MS) % ENTRY_COUNT;
  return { time: new Date(t), index };
}

/** A fixed instant whose window index is exactly `target`. */
function fixedInstantAt(target: number): { time: Date; index: number } {
  let t = Date.UTC(2026, 9, 16, 12, 0, 0);
  while (Math.floor(t / WINDOW_MS) % ENTRY_COUNT !== target) t += WINDOW_MS;
  return { time: new Date(t), index: target };
}

/**
 * The expected entry contents, derived from the committed generated
 * dataset (src/components/home-journal.data.ts) — the same source the
 * app renders. Returns the note at `index` in catalog order as
 * { id, href }.
 */
const JOURNAL_DATA = readFileSync(
  path.resolve("src/components/home-journal.data.ts"),
  "utf8",
);
function expectedNote(index: number): { id: string; href: string } {
  const notesPart = JOURNAL_DATA.slice(0, JOURNAL_DATA.indexOf("JOURNAL_SETS"));
  const ids = [...notesPart.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]!);
  const hrefById = new Map<string, string>();
  for (const m of JOURNAL_DATA.matchAll(/"id": "([^"]+)"[\s\S]*?"sourceHref": "([^"]+)"/g)) {
    if (!hrefById.has(m[1]!)) hrefById.set(m[1]!, m[2]!);
  }
  const id = ids[index]!;
  return { id, href: hrefById.get(id)! };
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

test("current entry renders inline: card line, section header, note with confidence line, footer", async ({
  page,
}) => {
  const { time, index } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
  const geography = geographyForIndex(index);

  // The card names the current entry.
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    `Now showing: ${geography} · 1 field note`,
  );

  const section = page.getByTestId("journal-section");
  await expect(section).toHaveAttribute("id", "home-journal");
  // The section header is the entry's geography.
  await expect(section.getByTestId("journal-geography")).toHaveText(geography);

  // The entry's note: one note, one geography eyebrow.
  const notes = section.getByTestId("journal-note");
  await expect(notes).toHaveCount(1);
  const eyebrows = await notes.locator(".hv5-label").allTextContents();
  expect(eyebrows.length).toBe(await notes.count());
  for (const eyebrow of eyebrows) {
    expect(eyebrow).toBe(geography);
  }

  // The rendered note: non-empty story, exactly one citation link with
  // the dataset's href, and a full confidence line (tier word + basis).
  const expected = expectedNote(index);
  const note = notes.nth(0);
  const story = await note.locator("p").nth(1).textContent();
  expect(story?.trim().length, "note story").toBeGreaterThan(0);
  const link = note.locator("a");
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("href", expected.href);
  await expect(note.locator(".hv5-journal-confidence")).toHaveText(
    /^(Confidence: Verified — government or university source\.|Confidence: Cited — named source recorded in the catalog\.)$/,
  );

  // Footer: entry number + plain-text countdown.
  await expect(section.getByTestId("journal-footer")).toHaveText(
    new RegExp(`^Entry ${index + 1} of 106 · Next entry in \\d+:\\d{2}$`),
  );
});

test("READ THE ENTRY scrolls to the journal section and focuses it", async ({ page }) => {
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);

  const section = page.getByTestId("journal-section");
  await page.getByTestId("journal-open").click();
  // The shipped scroll-jump pattern: the section receives focus and is
  // scrolled into view (smooth scroll — wait for it to settle in view).
  await expect(section).toBeFocused();
  await expect(section).toBeInViewport({ timeout: 10_000 });
});

test("mocked clock advanced 30 min advances the displayed entry without reload", async ({ page }) => {
  const { time, index } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);

  const section = page.getByTestId("journal-section");
  const firstTitle = await section
    .getByTestId("journal-note")
    .first()
    .locator("h3")
    .textContent();

  // Focus must not be inside the card or the section, or rotation is
  // (correctly) deferred (§6).
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });

  // Advance one full window: the boundary timer recomputes the entry.
  await page.clock.fastForward(WINDOW_MS);

  const nextIndex = (index + 1) % ENTRY_COUNT;
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    `Now showing: ${geographyForIndex(nextIndex)} · 1 field note`,
    { timeout: 10_000 },
  );
  await expect(section.getByTestId("journal-footer")).toHaveText(
    new RegExp(`^Entry ${nextIndex + 1} of 106 · Next entry in \\d+:\\d{2}$`),
  );
  const nextTitle = await section
    .getByTestId("journal-note")
    .first()
    .locator("h3")
    .textContent();
  expect(nextTitle).not.toBe(firstTitle);
});

test("deferral: the window rolls while focus is INSIDE the section — no swap until focus leaves", async ({
  page,
}) => {
  // Index 28 is the last Lincoln note; the next window is the first
  // region note, so the card line's geography text provably changes
  // once the deferred entry lands.
  const { time } = fixedInstantAt(28);
  await page.clock.install({ time });
  await loadHome(page, time);

  const line = page.getByTestId("journal-now-showing");
  const before = "Now showing: Lincoln, Nebraska · 1 field note";
  await expect(line).toHaveText(before);
  const section = page.getByTestId("journal-section");
  const footer = section.getByTestId("journal-footer");
  const entryNow = new RegExp(`^Entry 29 of 106 · Next entry in \\d+:\\d{2}$`);
  await expect(footer).toHaveText(entryNow);
  const firstTitle = await section
    .getByTestId("journal-note")
    .first()
    .locator("h3")
    .textContent();

  // Focus inside the section, then the boundary passes: the reader's
  // entry must NOT be swapped (spec §6). This is the negative test for
  // the deferral — a build that applies rotation immediately fails here.
  await section.focus();
  await expect(section).toBeFocused();
  await page.clock.fastForward(WINDOW_MS);
  await expect(line).toHaveText(before);
  await expect(footer).toHaveText(entryNow);
  await expect(section.getByTestId("journal-note").first().locator("h3")).toHaveText(
    firstTitle!,
  );

  // Focus leaves the section → the deferred entry is applied.
  await page.getByTestId("home-heading").focus();
  await expect(line).toHaveText("Now showing: Lincoln Region, Nebraska · 1 field note", {
    timeout: 10_000,
  });
  await expect(footer).toHaveText(
    new RegExp(`^Entry 30 of 106 · Next entry in \\d+:\\d{2}$`),
  );
});

test("the final window wraps to the first entry (no remainder set, B8)", async ({ page }) => {
  const { time } = fixedInstantAt(105);
  await page.clock.install({ time });
  await loadHome(page, time);

  // The last window shows the final note (galapagos, world ring).
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    "Now showing: The World · 1 field note",
  );
  const section = page.getByTestId("journal-section");
  await expect(section.getByTestId("journal-geography")).toHaveText("The World");
  await expect(section.getByTestId("journal-note")).toHaveCount(1);
  await expect(section.getByTestId("journal-footer")).toHaveText(
    /^Entry 106 of 106 · Next entry in \d+:\d{2}$/,
  );
  const expected = expectedNote(105);
  await expect(section.getByTestId("journal-note").locator("a")).toHaveAttribute(
    "href",
    expected.href,
  );

  // Advancing one window wraps the cycle to the first entry — with
  // singletons there is no straddle and no remainder set to land on.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.clock.fastForward(WINDOW_MS);
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    "Now showing: Lincoln, Nebraska · 1 field note",
    { timeout: 10_000 },
  );
  await expect(section.getByTestId("journal-footer")).toHaveText(
    /^Entry 1 of 106 · Next entry in \d+:\d{2}$/,
  );
  const first = expectedNote(0);
  await expect(section.getByTestId("journal-note").locator("a")).toHaveAttribute(
    "href",
    first.href,
  );
});
