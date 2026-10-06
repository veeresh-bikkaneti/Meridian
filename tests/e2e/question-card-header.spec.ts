import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
} from "./helpers";
import type { Page } from "playwright/test";

// PR2 (Cartographer's Plate) inserts zero-width spaces after /, –, - in
// DISPLAY strings (spec §3) — never in data or ARIA. Strip them before
// comparing textContent to the data label.
const stripZwsp = (s: string): string => s.replace(/​/g, "");

/**
 * Question-card fixes (Veeresh's 2026-10-04 bug report):
 *
 * Bug 1 — "name is still showing .....": long qualified labels must render
 * in full, never ellipsized. line-clamp-3 still cut "West
 * Cambridge/Harvard Square, Massachusetts" to "West Cambridge/Harvard
 * Square,...". The bubble now grows vertically (max-height + scroll safety
 * valve only for pathological names).
 *
 * Bug 2 — "show the edition name once edition is selected": the card
 * header now carries the edition type — "Country · United States",
 * "State · Nebraska", "Globe" — in the existing uppercase micro-header
 * style. Verified across all three editions and a mid-session switch.
 *
 * Determinism for the long-label test: the no-repeat seen store
 * (localStorage `meridian:seen:v2:<edition>:<regionId>:<band>`) is
 * pre-seeded with every pool id EXCEPT the target, so the country run
 * deals West Cambridge/Harvard Square first. Pool ids are computed from
 * the same shipped source files.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const TARGET_ID = "gn-13286806";
const TARGET_LABEL = "West Cambridge/Harvard Square, Massachusetts";

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

async function seedSeenExcept(page: Page): Promise<void> {
  const allIds = usCountryPoolIds();
  expect(allIds, `target ${TARGET_ID} must be in the pool`).toContain(TARGET_ID);
  const seen = allIds.filter((id) => id !== TARGET_ID);
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [`${SEEN_PREFIX}country:united-states:medium`, seen] as [string, string[]],
  );
}

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** True when the element's text is fully visible (not ellipsized/clipped). */
async function isFullyVisible(page: Page, locator: string): Promise<boolean> {
  return page.locator(locator).evaluate((el) => {
    const style = getComputedStyle(el);
    const noEllipsis =
      style.textOverflow !== "ellipsis" || style.whiteSpace !== "nowrap";
    const noClip = el.scrollWidth <= el.clientWidth + 1;
    return noEllipsis && noClip;
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    if (!e.message.includes("Minified React error #418")) errors.push(e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function playCountryUS(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expectAim(page);
}

async function playState(page: Page, stateName: string): Promise<void> {
  await page.getByRole("button", { name: "Choose a state" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: stateName }).click();
  await expectAim(page);
}

async function playGlobe(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);
}

test("country: 'West Cambridge/Harvard Square, Massachusetts' renders in full — no ellipsis", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(APP);
  await seedSeenExcept(page);
  await playCountryUS(page);

  // The full qualified label Veeresh screenshotted as truncated.
  const heading = page.getByRole("heading", { name: TARGET_LABEL });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  expect(stripZwsp((await heading.textContent()) ?? "").trim()).toBe(TARGET_LABEL);
  expect(await isFullyVisible(page, `h2:text-is("${TARGET_LABEL}")`)).toBe(true);

  // Collapsed view: still no ellipsis.
  await page.getByRole("button", { name: "Collapse question" }).click();
  const collapsed = page.locator(`p:text-is("${TARGET_LABEL}")`);
  await expect(collapsed).toBeVisible({ timeout: 10_000 });
  expect(await isFullyVisible(page, `p:text-is("${TARGET_LABEL}")`)).toBe(true);

  expect(errors, `console/page errors: ${JSON.stringify(errors)}`).toEqual([]);
});

test("header identifies the edition: Country · United States", async ({ page }) => {
  collectErrors(page);
  await page.goto(APP);
  await playCountryUS(page);
  await expect(
    page.getByText("Country · United States", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
});

test("header identifies the edition: State · Nebraska", async ({ page }) => {
  collectErrors(page);
  await page.goto(APP);
  await playState(page, "Nebraska");
  await expect(
    page.getByText("State · Nebraska", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
});

test("header identifies the edition: Globe", async ({ page }) => {
  collectErrors(page);
  await page.goto(APP);
  await playGlobe(page);
  // The bubble header, not the menu button: scope to the question bubble.
  // PR2: the eyebrow is now .name-eyebrow (uppercase via CSS, not the
  // Tailwind `uppercase` class).
  const header = page.locator("p.name-eyebrow", { hasText: "Globe" }).first();
  await expect(header).toBeVisible({ timeout: 15_000 });
  expect(((await header.textContent()) ?? "").trim()).toBe("Globe");
});

test("mid-session edition switch updates the header", async ({ page }) => {
  collectErrors(page);
  await page.goto(APP);
  await playState(page, "Nebraska");
  await expect(
    page.getByText("State · Nebraska", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  // Switch editions mid-session (cumulative session stays alive).
  await page.getByRole("button", { name: "Editions" }).click();
  await playCountryUS(page);
  await expect(
    page.getByText("Country · United States", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("State · Nebraska", { exact: true }),
  ).toHaveCount(0);
});
