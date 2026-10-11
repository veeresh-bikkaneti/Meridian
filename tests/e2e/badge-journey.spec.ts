import { test, expect } from "playwright/test";
import { mkdir } from "node:fs/promises";
import { serveBuiltArtifact } from "./helpers";

/**
 * Badge REGRESSION cell (PR #126: fix/storyteller-tap-start-and-mute).
 *
 * The badge system (src/game/passport/badges.ts) is untouched by this
 * branch — these are black-box journeys proving it still works end to
 * end after the storyteller narration/mute + Ko-fi cloud changes.
 *
 * Asserted user-visible outcomes (not DOM internals):
 *  - A real GeoDetective win (11-13, no hints) shows the "Clean Round"
 *    badge in the win reveal, and the badge shows up on the home
 *    GeoDetective card when the kid returns.
 *  - Tapping the badge chip on the home card reveals its blurb
 *    (touch-accessible, #113 BLOCK).
 *  - A loss earns nothing: no badge surface, no home badge row.
 *
 * Run at 390px (mobile) and 1280px (desktop). Screenshots are the PR
 * evidence: tests/e2e/badge-evidence/<WxH>/.
 *
 * Deterministic puzzle via the `?loop-puzzle=` seam (inert in production):
 *   ?loop-puzzle=218 -> Ankara (geonames:323786)
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
const BADGES_KEY = "meridian.passport.badges.v1";
const EVIDENCE_DIR = "tests/e2e/badge-evidence";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function evidence(name: string): Promise<string> {
  await mkdir(`${EVIDENCE_DIR}`, { recursive: true });
  return `${EVIDENCE_DIR}/${name}`;
}

/** Seed an already-earned Clean Round badge before page load. */
async function seedEarnedBadge(context: import("playwright/test").BrowserContext) {
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "meridian.passport.badges.v1",
      JSON.stringify([
        { id: "clean-round", earnedAt: "2026-10-09T12:00:00.000Z", schemaVersion: 1 },
      ]),
    );
  });
}

/** Open the GeoDetective; `puzzle` pins the deal via the ?loop-puzzle= seam. */
async function openLoop(page: import("playwright/test").Page, puzzle?: string) {
  await page.goto(puzzle ? `${BASE}?loop-puzzle=${puzzle}` : BASE);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

function searchBox(page: import("playwright/test").Page) {
  return page.getByRole("combobox", { name: "Search the map" });
}

/** Resolve the open mystery's target entry from the guess index. */
async function targetEntry(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    const clue = await fetch(`loop/clues/${store.current.index}.json`).then((r) => r.json());
    const names = await fetch("loop/names.json").then((r) => r.json());
    return names.find((e: { id: string }) => e.id === clue.placeId) as {
      n: string;
      id: string;
    };
  });
}

/** Guess the resolved target through the search box (exact entry id). */
async function guessTarget(
  page: import("playwright/test").Page,
  entry: { n: string; id: string },
) {
  const box = searchBox(page);
  await box.click();
  await box.fill(entry.n);
  const option = page.locator(`li[role="option"][data-entry-id="${entry.id}"]`);
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** Five wrong guesses (never the target) for the loss path. */
async function wrongQueries(
  page: import("playwright/test").Page,
  targetId: string,
): Promise<string[]> {
  return page.evaluate(async ({ targetId }: { targetId: string }) => {
    const names = await fetch("loop/names.json").then((r) => r.json());
    const cands = ["paris", "tokyo", "sydney", "cairo", "new york"];
    const out: string[] = [];
    for (const q of cands) {
      const hit = names.find(
        (e: { n: string; id: string }) =>
          e.n.toLowerCase().startsWith(q) && e.id !== targetId,
      );
      if (hit) out.push(hit.n);
      if (out.length === 5) break;
    }
    return out;
  }, { targetId });
}

async function guessViaMap(page: import("playwright/test").Page, query: string) {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** Earned badge ids from the page's localStorage (persistence proof). */
async function earnedBadgeIds(page: import("playwright/test").Page): Promise<string[]> {
  return page.evaluate((key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return (JSON.parse(raw) as { id: string }[]).map((b) => b.id);
    } catch {
      return [];
    }
  }, BADGES_KEY);
}

for (const [w, h] of [[390, 844], [1280, 800]] as const) {
  const tag = `${w}x${h}`;

  test(`${tag}: win earns Clean Round — badge in the reveal, then on the home card`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    // No profile seeded → unset resolves to the 11-13 full-access band.
    await openLoop(page, "218"); // Ankara
    const entry = await targetEntry(page);
    await guessTarget(page, entry); // one correct guess, zero hints

    await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 15_000 });

    // The kid SEES the badge: correct achievement, correct copy.
    const badge = page.getByTestId("clean-round-badge");
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText("🏅 Clean Round");
    await expect(badge).toContainText("without a single hint");
    await page.screenshot({ path: await evidence(`${tag}-reveal-badge.png`) });

    // Persisted across the session.
    expect(await earnedBadgeIds(page)).toContain("clean-round");

    // Back home: the badge lives on the GeoDetective dossier card.
    await page.getByRole("button", { name: "Back to editions" }).click();
    const card = page.locator('[data-testid="tour-stop-geodetective"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const row = card.getByTestId("earned-badges");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("Clean Round");
    await card.screenshot({ path: await evidence(`${tag}-home-card-badge.png`) });
  });

  test(`${tag}: tapping the home badge chip reveals its blurb (touch-accessible)`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await seedEarnedBadge(context);
    await page.goto(BASE);

    const card = page.locator('[data-testid="tour-stop-geodetective"]');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const row = card.getByTestId("earned-badges");
    await expect(row).toBeVisible({ timeout: 30_000 });

    // #113 BLOCK: the blurb is not hover-only — tapping the chip shows it.
    const blurb = page.getByTestId("badge-blurb-clean-round");
    await expect(blurb).toHaveCount(0);
    await page.getByTestId("badge-chip-clean-round").click();
    await expect(blurb).toBeVisible({ timeout: 10_000 });
    await expect(blurb).toContainText("without a single hint");
    await card.screenshot({ path: await evidence(`${tag}-home-card-blurb.png`) });

    // Tapping again hides it.
    await page.getByTestId("badge-chip-clean-round").click();
    await expect(blurb).toHaveCount(0);
  });

  test(`${tag}: a loss earns nothing — no badge in the reveal, none on the card`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await openLoop(page, "218"); // Ankara
    const entry = await targetEntry(page);
    for (const q of await wrongQueries(page, entry.id)) {
      await guessViaMap(page, q);
    }
    await expect(page.getByText("Out of guesses")).toBeVisible({ timeout: 15_000 });

    // No badge surface on a failed round, and no record.
    await expect(page.getByTestId("clean-round-badge")).toHaveCount(0);
    expect(await earnedBadgeIds(page)).not.toContain("clean-round");

    // And no badge row on the home card afterwards.
    await page.getByRole("button", { name: "Back to editions" }).click();
    const card = page.locator('[data-testid="tour-stop-geodetective"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByTestId("earned-badges")).toHaveCount(0);
  });
}
