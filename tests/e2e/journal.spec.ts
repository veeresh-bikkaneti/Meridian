import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Journal — "What the land remembers" (docs/journal-spec.md §8), adapted
 * from the v2 overlay spec to main's INLINE surface (owner ruling Q1):
 * the journal lives in the #home-journal section of the home page; the
 * home Journal card names the current set and its READ THE ENTRY button
 * scroll-jumps to the section and focuses it.
 *
 * The browser clock is mocked (page.clock) to a fixed instant whose
 * 2-hour window index lands on a pure-geography triple, so the expected
 * set is known exactly: entry number, shared geography, 3 notes.
 * Advancing the mocked clock by one window must advance the displayed
 * set on its own — no reload — unless focus is inside the card or the
 * section, where the swap is deferred until focus leaves (spec §6).
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const WINDOW_MS = 7_200_000;
const SET_COUNT = 36;

/** Set geography by cycle index (spec §2/§3 set order). */
function geographyForIndex(index: number): string {
  if (index < 9) return "Lincoln, Nebraska";
  if (index < 13) return "Lincoln Region, Nebraska";
  if (index < 19) return "Nebraska";
  if (index < 25) return "United States";
  if (index < 33) return "The World";
  return "Field Notes";
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
 * dataset (src/components/home-journal.data.ts) — the same source the
 * app renders. Returns the set's notes in order as { id, href } pairs.
 */
const JOURNAL_DATA = readFileSync(
  path.resolve("src/components/home-journal.data.ts"),
  "utf8",
);
function expectedNotes(index: number): { id: string; href: string }[] {
  const setsPart = JOURNAL_DATA.slice(JOURNAL_DATA.indexOf("JOURNAL_SETS"));
  const idLists = [...setsPart.matchAll(/"noteIds": \[([^\]]*)\]/g)].map((m) =>
    [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!),
  );
  const hrefById = new Map<string, string>();
  for (const m of JOURNAL_DATA.matchAll(/"id": "([^"]+)"[\s\S]*?"sourceHref": "([^"]+)"/g)) {
    if (!hrefById.has(m[1]!)) hrefById.set(m[1]!, m[2]!);
  }
  return idLists[index]!.map((id) => ({ id, href: hrefById.get(id)! }));
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

test("current set renders inline: card line, section header, notes with confidence lines, footer", async ({
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

  const section = page.getByTestId("journal-section");
  await expect(section).toHaveAttribute("id", "home-journal");
  // The section header is the set's shared geography.
  await expect(section.getByTestId("journal-geography")).toHaveText(geography);

  // The set's notes: count = set size, one shared geography eyebrow.
  const notes = section.getByTestId("journal-note");
  await expect(notes).toHaveCount(3);
  const eyebrows = await notes.locator(".hv5-label").allTextContents();
  expect(eyebrows.length).toBe(await notes.count());
  for (const eyebrow of eyebrows) {
    expect(eyebrow).toBe(geography);
  }

  // Every rendered note: non-empty story, exactly one citation link with
  // the dataset's href, and a full confidence line (tier word + basis).
  const expected = expectedNotes(index);
  expect(expected.length).toBe(3);
  for (let i = 0; i < expected.length; i++) {
    const note = notes.nth(i);
    const story = await note.locator("p").nth(1).textContent();
    expect(story?.trim().length, `note ${i} story`).toBeGreaterThan(0);
    const link = note.locator("a");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", expected[i]!.href);
    await expect(note.locator(".hv5-journal-confidence")).toHaveText(
      /^(Confidence: Verified — government or university source\.|Confidence: Cited — named source recorded in the catalog\.)$/,
    );
  }

  // Footer: entry number + plain-text countdown.
  await expect(section.getByTestId("journal-footer")).toHaveText(
    new RegExp(`^Entry ${index + 1} of 36 · Next entry in \\d+:\\d{2}$`),
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

test("mocked clock advanced 2h advances the displayed set without reload", async ({ page }) => {
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

  // Advance one full window: the boundary timer recomputes the set.
  await page.clock.fastForward(WINDOW_MS);

  const nextIndex = (index + 1) % SET_COUNT;
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    `Now showing: ${geographyForIndex(nextIndex)} · 3 field notes`,
    { timeout: 10_000 },
  );
  await expect(section.getByTestId("journal-footer")).toHaveText(
    new RegExp(`^Entry ${nextIndex + 1} of 36 · Next entry in \\d+:\\d{2}$`),
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
  // Index 8 is the last Lincoln triple; the next set is the first region
  // triple, so the card line's geography text provably changes once the
  // deferred set lands.
  const { time } = fixedInstantAt(8);
  await page.clock.install({ time });
  await loadHome(page, time);

  const line = page.getByTestId("journal-now-showing");
  const before = "Now showing: Lincoln, Nebraska · 3 field notes";
  await expect(line).toHaveText(before);
  const section = page.getByTestId("journal-section");
  const footer = section.getByTestId("journal-footer");
  const entryNow = new RegExp(`^Entry 9 of 36 · Next entry in \\d+:\\d{2}$`);
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

  // Focus leaves the section → the deferred set is applied.
  await page.getByTestId("home-heading").focus();
  await expect(line).toHaveText("Now showing: Lincoln Region, Nebraska · 3 field notes", {
    timeout: 10_000,
  });
  await expect(footer).toHaveText(
    new RegExp(`^Entry 10 of 36 · Next entry in \\d+:\\d{2}$`),
  );
});

test("the final remainder set shows its single note as Field Notes", async ({ page }) => {
  const { time } = fixedInstantAt(35);
  await page.clock.install({ time });
  await loadHome(page, time);

  // Mixed remainder sets carry no count on the card line (spec §5 form).
  await expect(page.getByTestId("journal-now-showing")).toHaveText(
    "Now showing: Field Notes",
  );
  const section = page.getByTestId("journal-section");
  await expect(section.getByTestId("journal-geography")).toHaveText("Field Notes");
  await expect(section.getByTestId("journal-note")).toHaveCount(1);
  await expect(section.getByTestId("journal-footer")).toHaveText(
    /^Entry 36 of 36 · Next entry in \d+:\d{2}$/,
  );
  const expected = expectedNotes(35);
  expect(expected.length).toBe(1);
  await expect(section.getByTestId("journal-note").locator("a")).toHaveAttribute(
    "href",
    expected[0]!.href,
  );
});
