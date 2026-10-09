import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Clean Round badge E2E (#113 BLOCK 1 + BLOCK 2).
 *
 * - The badge is earned ONLY on an 11-13 no-hint WIN, awarded from the
 *   deal-time band snapshot (never the live band).
 * - Losses never earn it (the award copy celebrates figuring it out —
 *   it must not fire on a failed round).
 * - A mid-run band change cannot mis-award in either direction.
 * - The badge has a visible surface: it renders in the win reveal.
 *
 * Deterministic puzzle via the `?loop-puzzle=` seam (inert in production):
 *   ?loop-puzzle=218 -> Ankara (geonames:323786)
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
const PROFILE_KEY = "meridian.ageProfile.v1";
const BADGES_KEY = "meridian.passport.badges.v1";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Seed an active age profile before page load. */
async function seedProfile(
  context: import("playwright/test").BrowserContext,
  band: "5-7" | "8-10" | "11-13",
) {
  await context.addInitScript((b: string) => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: b,
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 1,
      }),
    );
  }, band);
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

/** Earned badge ids from the page's localStorage. */
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

test("Clean Round: 11-13 no-hint win earns it and shows it in the reveal", async ({
  page,
}) => {
  // No profile seeded → unset resolves to the 11-13 full-access band.
  await openLoop(page, "218"); // Ankara
  const entry = await targetEntry(page);
  await guessTarget(page, entry); // one correct guess, zero hints

  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 15_000 });
  // BLOCK 2: the badge has a visible surface for the kid.
  const badge = page.getByTestId("clean-round-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("Clean Round");
  await expect(badge).toContainText("without a single hint");
  // Persisted to the Passport store.
  expect(await earnedBadgeIds(page)).toContain("clean-round");
  // Cosmetic only: no score terms in the badge records.
  const raw = await page.evaluate((key: string) => localStorage.getItem(key)!, BADGES_KEY);
  expect(raw).not.toMatch(/"points"|"score"/);
});

test("Clean Round badge never overlaps the win-reveal CTA", async ({ page }) => {
  await openLoop(page, "218"); // Ankara
  const entry = await targetEntry(page);
  await guessTarget(page, entry);

  const badge = page.getByTestId("clean-round-badge");
  await expect(badge).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500); // let the reveal transition settle
  const badgeBox = await badge.boundingBox();
  // The badge must not cover the reveal's primary action.
  const cta = page.locator("button").last();
  await expect(cta).toBeVisible();
  const ctaBox = await cta.boundingBox();
  if (!badgeBox || !ctaBox) throw new Error("missing box (clean-round-badge vs CTA)");
  const ix = Math.max(0, Math.min(badgeBox.x + badgeBox.width, ctaBox.x + ctaBox.width) - Math.max(badgeBox.x, ctaBox.x));
  const iy = Math.max(0, Math.min(badgeBox.y + badgeBox.height, ctaBox.y + ctaBox.height) - Math.max(badgeBox.y, ctaBox.y));
  console.log(`clean-round-badge vs CTA: overlap=${(ix * iy).toFixed(1)}px²`);
  expect(ix * iy).toBe(0);
});

test("Clean Round: a loss never earns it, even hint-free on 11-13", async ({ page }) => {
  await openLoop(page, "218"); // Ankara
  const entry = await targetEntry(page);
  for (const q of await wrongQueries(page, entry.id)) {
    await guessViaMap(page, q);
  }
  await expect(page.getByText("Out of guesses")).toBeVisible({ timeout: 15_000 });
  // BLOCK 2: no badge on a failed round — no surface, no record.
  await expect(page.getByTestId("clean-round-badge")).toHaveCount(0);
  expect(await earnedBadgeIds(page)).not.toContain("clean-round");
});

test("Clean Round: mid-run band change cannot mis-award (#113 BLOCK 1)", async ({
  page,
  context,
}) => {
  // Deal the mystery on 8-10 (snapshot band = 8-10).
  await seedProfile(context, "8-10");
  await openLoop(page, "218"); // Ankara

  // Grown-up flips to 11-13 mid-mystery. The deal-time snapshot must govern.
  await page.evaluate(() => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: "11-13",
        updatedAt: new Date().toISOString(),
        changeCount: 1,
        schemaVersion: 1,
      }),
    );
  });

  // Win with zero hints — the live band is 11-13, but the deal band was 8-10.
  const entry = await targetEntry(page);
  await guessTarget(page, entry);
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 15_000 });

  // No mis-award in either direction: no surface, no record.
  await expect(page.getByTestId("clean-round-badge")).toHaveCount(0);
  expect(await earnedBadgeIds(page)).not.toContain("clean-round");
});
