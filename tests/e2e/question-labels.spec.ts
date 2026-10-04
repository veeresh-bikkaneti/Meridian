import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  dropButton,
  resultCard,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * Question disambiguation labels (Veeresh's spec):
 * - globe:   "Oia, South Aegean, Greece"  (place + state + country;
 *            subdivision is a pin-down clue on every globe question)
 * - country: "Austin, Texas"      (place + state, whole-US run)
 * - state:   "Omaha"              (bare name, unchanged)
 *
 * Determinism: the no-repeat seen store (localStorage
 * `meridian:seen:v2:<edition>:<regionId>:<band>`) is pre-seeded with every pool id
 * EXCEPT the target, so poolForNewRun deals the target first. The pool is
 * computed from the same source files the app ships, so the seeding can
 * never silently diverge from the dealt pool.
 *
 * Difficulty: the targets below (Austin, Omaha) are tier 1, so the tests
 * pick the Easy band (tiers 1–2) before starting the run — with the default
 * Medium band (2–4) the tier filter removes tier-1 places before the
 * dealer's pool is built and the seeding trick cannot force them first.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

function chunkIds(regionId: string): string[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/chunks/${regionId}.json`, "utf8"),
  ) as { places: { id: string }[] };
  return d.places.map((p) => p.id);
}

/** Curated starter ids for one edition+region (id = `${regionId}-${slug}`). */
function curatedIds(edition: string, regionId: string): string[] {
  const src = readFileSync("src/game/starters.ts", "utf8");
  const out: string[] = [];
  const re = /place\(\s*\n\s*"(\w+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"([a-z0-9-]+)",/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) out.push(`${m[2]}-${m[3]}`);
  }
  return out;
}

function usCountryPoolIds(): string[] {
  const manifest = JSON.parse(
    readFileSync("src/game/data/geonames/manifest.json", "utf8"),
  ) as { regions: Record<string, { edition: string }> };
  const ids = [...curatedIds("country", "united-states")];
  for (const [rid, r] of Object.entries(manifest.regions)) {
    if (r.edition === "state" || rid === "united-states") ids.push(...chunkIds(rid));
  }
  return ids;
}

/** Mark every pool place seen except the target, so it is dealt first. */
async function seedSeenExcept(
  page: Page,
  edition: string,
  regionId: string,
  keepId: string,
  allIds: string[],
  band: "easy" | "medium" | "hard" = "medium",
): Promise<void> {
  const key = `${SEEN_PREFIX}${edition}:${regionId}:${band}`;
  const seen = allIds.filter((id) => id !== keepId);
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  expect(allIds, `target ${keepId} must be in the pool`).toContain(keepId);
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [key, seen] as [string, string[]],
  );
}

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** Current question from the aim live region ("Find X."). */
async function readLiveQuestion(page: Page): Promise<string> {
  const live = page.locator('p.sr-only[aria-live="polite"]');
  await expect(live).toContainText(/^Find .+\.$/, { timeout: 15_000 });
  return ((await live.textContent()) ?? "").trim();
}

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
  // feature (same filter as the PWA spec).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("globe: bubble and result card show 'Oia, South Aegean, Greece'", async ({ page }) => {
  const errors = collectErrors(page);
  const allIds = [...curatedIds("globe", "globe"), ...chunkIds("globe")];

  await page.goto(APP);
  await seedSeenExcept(page, "globe", "globe", "globe-oia", allIds);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);

  // The question bubble (sighted) and the live region (screen reader) agree.
  await expect(
    page.getByRole("heading", { name: "Oia, South Aegean, Greece" }),
  ).toBeVisible({ timeout: 15_000 });
  expect(await readLiveQuestion(page)).toBe("Find Oia, South Aegean, Greece.");

  // What you were asked matches what you're shown: drop a pin anywhere and
  // the result card title carries the same qualified label.
  await dismissTileOverlayIfPresent(page);
  await page.mouse.click(500, 400);
  await expect(dropButton(page)).toBeEnabled({ timeout: 10_000 });
  await dropButton(page).click();
  await expect
    .poll(() => readPhase(page), { timeout: 30_000 })
    .toMatch(/^(story|done)$/);
  const card = resultCard(page);
  await expect(card.getByRole("heading", { name: "Oia, South Aegean, Greece" })).toBeVisible({
    timeout: 60_000,
  });

  expectCleanConsole(errors);
});

test("country: whole-US run shows 'Austin, Texas'", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto(APP);
  await seedSeenExcept(page, "country", "united-states", "gn-4671654", usCountryPoolIds(), "easy");
  // Austin is tier 1: the Easy band (1–2) keeps it in the dealt pool.
  await page
    .getByRole("group", { name: "How do you want to grow your map today?" })
    .getByRole("button", { name: "Easy" })
    .click();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expectAim(page);

  await expect(
    page.getByRole("heading", { name: "Austin, Texas" }),
  ).toBeVisible({ timeout: 15_000 });
  expect(await readLiveQuestion(page)).toBe("Find Austin, Texas.");

  expectCleanConsole(errors);
});

test("state: Nebraska run shows the bare name 'Omaha'", async ({ page }) => {
  const errors = collectErrors(page);
  const allIds = [...curatedIds("state", "nebraska"), ...chunkIds("nebraska")];

  await page.goto(APP);
  await seedSeenExcept(page, "state", "nebraska", "gn-5074472", allIds, "easy");
  // Omaha is tier 1: the Easy band (1–2) keeps it in the dealt pool.
  await page
    .getByRole("group", { name: "How do you want to grow your map today?" })
    .getByRole("button", { name: "Easy" })
    .click();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await expectAim(page);

  const heading = page.getByRole("heading", { name: "Omaha" });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  // Bare name: no country/state qualifier appended.
  expect(((await heading.textContent()) ?? "").trim()).toBe("Omaha");
  expect(await readLiveQuestion(page)).toBe("Find Omaha.");

  expectCleanConsole(errors);
});
