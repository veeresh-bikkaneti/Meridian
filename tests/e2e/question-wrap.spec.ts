import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * Question-bubble wrapping (the "Fairchild Air Forc..." bug): long
 * qualified place names must wrap instead of single-line-truncating.
 * An unreadable question is an unfair game.
 *
 * Determinism: the no-repeat seen store (localStorage
 * `meridian:seen:v2:<edition>:<regionId>:<band>`) is pre-seeded with every pool id
 * EXCEPT the target, so the country run deals Fairchild Air Force Base
 * first. Pool ids are computed from the same shipped source files.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const TARGET_ID = "gn-7261152";
const TARGET_LABEL = "Fairchild Air Force Base, Washington";

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
  // Curated country starters are part of the dealt pool too — leaving them
  // out of the seen store makes the seeding non-deterministic.
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

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
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

test("country: 'Fairchild Air Force Base, Washington' wraps, never truncates", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(APP);
  await seedSeenExcept(page);
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expectAim(page);

  // Expanded view: the full qualified name is rendered and visible.
  const heading = page.getByRole("heading", { name: TARGET_LABEL });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  expect(((await heading.textContent()) ?? "").trim()).toBe(TARGET_LABEL);
  expect(await isFullyVisible(page, `h2:text-is("${TARGET_LABEL}")`)).toBe(true);

  // Evidence for Veeresh: screenshot of the wrapped bubble.
  await page
    .locator("div", { has: heading })
    .first()
    .screenshot({ path: "evidence/question-wrap-bubble.png" });

  // Collapsed view (Cartographer's Plate PR3): the name folds away
  // entirely — honest, never clamped. The toggle names its consequence.
  await page.getByRole("button", { name: "Hide place name" }).click();
  const toggle = page.getByRole("button", { name: "Show place name" });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const folded = page.locator(".bubble-scroll-wrap");
  await expect(folded).toBeHidden();
  // The full name is gone from the accessibility tree while folded…
  await expect(page.getByRole("heading", { name: TARGET_LABEL })).toBeHidden();
  // …and comes back intact on expand.
  await toggle.click();
  const headingAgain = page.getByRole("heading", { name: TARGET_LABEL });
  await expect(headingAgain).toBeVisible({ timeout: 10_000 });
  expect(await isFullyVisible(page, `h2:text-is("${TARGET_LABEL}")`)).toBe(true);

  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
});
