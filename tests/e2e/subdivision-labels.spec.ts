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
 * DRAFT — skipped until Crew 1 rebuilds the chunks with the `subdivision`
 * field stamped (branch feat/difficulty-tiers). Unskip once
 * src/game/data/geonames/chunks/india.json carries subdivision display
 * names; the target record gn-1257851 sits at 14.16°N, 75.03°E (Sagara,
 * Shimoga district, Karnataka), so the expected label is "Sāgar, Karnataka".
 *
 * Motivation (Veeresh's live report): "Sāgar" in the India edition is
 * ambiguous — Sagar in Madhya Pradesh vs Sagara in Karnataka. The country
 * edition label must carry the subdivision: "{Place}, {Subdivision}".
 *
 * Determinism: the no-repeat seen store (localStorage
 * `meridian:seen:v2:<edition>:<regionId>`) is pre-seeded with every pool id
 * EXCEPT the target, so poolForNewRun deals the target first. The pool is
 * computed from the same source files the app ships, so the seeding can
 * never silently diverge from the dealt pool.
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

/** Mark every pool place seen except the target, so it is dealt first. */
async function seedSeenExcept(
  page: Page,
  edition: string,
  regionId: string,
  keepId: string,
  allIds: string[],
): Promise<void> {
  const key = `${SEEN_PREFIX}${edition}:${regionId}`;
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

test.skip("country: India edition shows 'Sāgar, {Subdivision}'", async ({ page }) => {
  const errors = collectErrors(page);
  const targetId = "gn-1257851"; // Sāgar
  const allIds = [...curatedIds("country", "india"), ...chunkIds("india")];

  await page.goto(APP);
  await seedSeenExcept(page, "country", "india", targetId, allIds);
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "India" }).click();
  await page.getByRole("button", { name: "Play entire India" }).click();
  await expectAim(page);

  // The question bubble carries the subdivision qualifier — bare "Sāgar"
  // is the ambiguity Veeresh reported, so assert the two-part shape with
  // a non-empty subdivision, not just a prefix match.
  const heading = page.getByRole("heading", { name: /^Sāgar, / });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  const label = (((await heading.textContent()) ?? "").trim());
  expect(label, "question bubble must show {Place}, {Subdivision}").toMatch(
    /^Sāgar, \S.+$/,
  );
  expect(await readLiveQuestion(page)).toBe(`Find ${label}.`);

  // What you were asked matches what you're shown: the result card title
  // carries the same qualified label (both come from buildQuestionLabel).
  await dismissTileOverlayIfPresent(page);
  await page.mouse.click(500, 400);
  await expect(dropButton(page)).toBeEnabled({ timeout: 10_000 });
  await dropButton(page).click();
  await expect
    .poll(() => readPhase(page), { timeout: 30_000 })
    .toMatch(/^(story|done)$/);
  const card = resultCard(page);
  await expect(card.getByRole("heading", { name: label })).toBeVisible({
    timeout: 60_000,
  });

  expectCleanConsole(errors);
});
