import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  commitMiss,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  resultCard,
  NO_IDLE,
} from "./helpers";

/**
 * End-game share E2E: the "Share score" button on the run summary.
 *
 * Two paths through the same ShareButton helper:
 * 1. Clipboard path (desktop Chromium, `navigator.share` removed): click
 *    "Share score" → the exact session share text lands on the clipboard,
 *    button feedback is "Copied ✓".
 * 2. Native-share path (`navigator.share` stubbed via addInitScript):
 *    the stub is called exactly once with { title, text, url }, the
 *    clipboard is left untouched, feedback is "Shared ✓".
 *
 * Both runs play exactly one place (a guaranteed miss), then end the game
 * through the "End game" control — the same end-game flow as
 * session-score.spec.ts. The expected share text is rebuilt from the
 * session/run storage the app itself writes, mirroring shareText().
 */

const SITE_URL = "https://veeresh-bikkaneti.github.io/Meridian/";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the question-labels and PWA specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

/** Init script: remove the native share sheet so the clipboard path runs. */
function noNativeShare(): void {
  try {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  } catch {
    /* navigator.share stays; the test asserts the path taken instead */
  }
}

/** Init script: stub the native share sheet, recording its calls. */
function stubNativeShare(): void {
  (window as unknown as { __shareCalls: unknown[] }).__shareCalls = [];
  Object.defineProperty(navigator, "share", {
    value: (data: unknown) => {
      (window as unknown as { __shareCalls: unknown[] }).__shareCalls.push(data);
      return Promise.resolve();
    },
    configurable: true,
  });
}

async function newSharePage(
  browser: Browser,
  initScript: () => void,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await serveBuiltArtifact(context);
  await context.addInitScript(initScript);
  const page = await context.newPage();
  return { context, page };
}

interface DifficultyBucket {
  score: number;
  places: number;
  hits: number;
}

interface RegionScore {
  regionName: string;
  score: number;
}

interface ShareInputs {
  dateKey: string;
  regionName: string;
  totalScore: number;
  placesPlayed: number;
  bestStreak: number;
  byDifficulty: Record<string, DifficultyBucket>;
  regions: RegionScore[];
}

/** The app's session/run records, read from the storage it wrote. */
async function readShareInputs(page: Page): Promise<ShareInputs> {
  return page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem("meridian.session") ?? "null");
    const run = JSON.parse(sessionStorage.getItem("meridian.run") ?? "null");
    return {
      dateKey: run.dateKey as string,
      regionName: run.regionName as string,
      totalScore: session.totalScore as number,
      placesPlayed: session.placesPlayed as number,
      bestStreak: session.bestStreak as number,
      byDifficulty: session.byDifficulty as Record<string, DifficultyBucket>,
      regions: session.regions as RegionScore[],
    };
  });
}

const PICKER_DIFFICULTIES = ["easy", "medium", "hard"] as const;
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * Mirrors sessionShareText() for the session payload: the three-line
 * session contract (`meridian <date>` / the site URL on its own line /
 * totals — no per-place emoji strip, no place names), then the breakdown
 * the app appends — one line per played difficulty mode (easy → medium →
 * hard), then one line of per-region totals in first-seen order. Rendered
 * straight from the same session record the end-game screen banks, never
 * recomputed: mirrors sessionShareText() exactly.
 */
function expectedShareText(input: ShareInputs): string {
  const [year, month, day] = input.dateKey.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  const when =
    new Date().getUTCFullYear() === year
      ? `${monthName} ${day}`
      : `${monthName} ${day}, ${year}`;
  const averagePerPlace =
    input.placesPlayed > 0 ? Math.round(input.totalScore / input.placesPlayed) : 0;
  const streak =
    input.bestStreak >= 2 ? ` · 🔥 ${input.bestStreak} best streak` : "";
  const lines = [
    `meridian ${when}\n` +
      `${SITE_URL}\n` +
      `${input.totalScore.toLocaleString("en-US")} over ${input.placesPlayed} places · ` +
      `${averagePerPlace} avg/place${streak} · ${input.regionName}`,
  ];
  // Unplayed modes are omitted — never shown as 0%.
  for (const mode of PICKER_DIFFICULTIES) {
    const bucket = input.byDifficulty?.[mode];
    if (!bucket || bucket.places <= 0) continue;
    const rate = Math.round((100 * bucket.hits) / bucket.places);
    lines.push(
      `${DIFFICULTY_LABELS[mode]} ${bucket.hits}/${bucket.places} ` +
        `(${rate}%) · ` +
        `${bucket.score.toLocaleString("en-US")} pts`,
    );
  }
  if (input.regions && input.regions.length > 0) {
    lines.push(
      input.regions
        .map((r) => `${r.regionName} ${r.score.toLocaleString("en-US")}`)
        .join(" · "),
    );
  }
  return lines.join("\n");
}

/**
 * Play exactly one place (a guaranteed miss), capture its name from the
 * result card, then end the game via the End-game control. Resolves with
 * the summary dialog and the played place's name (for the no-spoiler
 * assertion).
 */
async function playOnePlaceAndEndGame(page: Page): Promise<{
  dialog: import("playwright/test").Locator;
  placeName: string;
}> {
  await startGlobeRun(page, NO_IDLE);
  await dismissTileOverlayIfPresent(page);
  await commitMiss(page);
  const placeName =
    (await resultCard(page).locator("h2").first().textContent())?.trim() ?? "";
  expect(placeName.length, "result card showed the played place's name").toBeGreaterThan(0);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();
  return { dialog, placeName };
}

test("end-game share: clipboard path copies the exact session share text", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { context, page } = await newSharePage(browser, noNativeShare);
  const errors = collectErrors(page);
  try {
    await page.goto("http://127.0.0.1:4123/Meridian/");
    expect(await page.evaluate(() => typeof navigator.share)).not.toBe("function");
    const { dialog, placeName } = await playOnePlaceAndEndGame(page);

    // The summary shows the session total we expect the text to carry.
    const inputs = await readShareInputs(page);
    const expected = expectedShareText(inputs);
    const shownTotal = (await dialog.locator("p.text-5xl").textContent())?.trim();
    expect(shownTotal).toBe(`${inputs.totalScore}`);

    const shareButton = dialog.getByRole("button", { name: "Share score" });
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Exact payload on the clipboard.
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(expected);
    expect(clip.startsWith("meridian ")).toBe(true);
    expect(clip).toContain(`\n${SITE_URL}\n`);
    expect(clip).toContain(inputs.totalScore.toLocaleString("en-US"));
    expect(clip).not.toContain(placeName);

    // Button + live-region feedback.
    await expect(
      dialog.getByRole("button", { name: "Copied ✓", exact: true }),
    ).toBeVisible();
    await expect(dialog.locator('p[aria-live="polite"]')).toContainText("Copied ✓");

    expectCleanConsole(errors);
  } finally {
    await context.close();
  }
});

test("end-game share: mocked navigator.share is called once, clipboard untouched", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { context, page } = await newSharePage(browser, stubNativeShare);
  const errors = collectErrors(page);
  try {
    await page.goto("http://127.0.0.1:4123/Meridian/");
    expect(await page.evaluate(() => typeof navigator.share)).toBe("function");
    const { dialog, placeName } = await playOnePlaceAndEndGame(page);

    const inputs = await readShareInputs(page);
    const expected = expectedShareText(inputs);

    // Sentinel on the clipboard: the native path must not write it over.
    const SENTINEL = "MERIDIAN-E2E-CLIPBOARD-SENTINEL";
    await page.evaluate((s) => navigator.clipboard.writeText(s), SENTINEL);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SENTINEL);

    await dialog.getByRole("button", { name: "Share score" }).click();

    const calls = await page.evaluate(
      () => (window as unknown as { __shareCalls: unknown[] }).__shareCalls,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ title: "Meridian score", text: expected, url: SITE_URL });

    await expect(
      dialog.getByRole("button", { name: "Shared ✓", exact: true }),
    ).toBeVisible();
    await expect(dialog.locator('p[aria-live="polite"]')).toContainText("Shared ✓");

    // Clipboard untouched by the native-share path.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SENTINEL);
    expect(placeName.length).toBeGreaterThan(0);

    expectCleanConsole(errors);
  } finally {
    await context.close();
  }
});
