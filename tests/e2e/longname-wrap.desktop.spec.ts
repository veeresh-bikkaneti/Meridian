import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitPin,
  tapHitsMap,
} from "./helpers";

/**
 * Cartographer's Plate PR1 — wrap-foundation E2E gate.
 *
 * Doctrine: "names are the payload; containers flex, names never do."
 * Every surface renders the FULL place name — never an ellipsis. The ONE
 * existing `truncate` (GeoDetective guess list) is deleted in this PR; this
 * spec proves zero ellipsis + no horizontal overflow on all four surfaces
 * using the REAL longest names from the spec §11 fixtures:
 *
 *   - question bubble (expanded h2 + collapsed p): the 106-char
 *     country-qualified Dysart label (raw name is 97 chars — the longest
 *     country-chunk name in the dataset)
 *   - result-card reveal (answer h2 + pin-compare-line): same 106-char label
 *   - GeoDetective bottom-sheet h2 + guess-list row: the 98-char rendered
 *     "United Townships Of Dysart … And Clyde, Canada" (worst case) plus
 *     the 24-char unbreakable "Staronizhestebliyevskaya" (must not overflow
 *     horizontally even though it has no break opportunities)
 *   - GeoDetective reveal answer h2: 43-char "Huntington Beach, California,
 *     United States" (longest loop target display name)
 *
 * Matrix: 360 / 768 / 1280 px widths × light / dark (prefers-color-scheme)
 * × reduced-motion on/off. `data-name-tier` is NOT asserted (PR2). Frozen
 * E2E seams (`difficulty-chip`, `pin-compare-line`, `miss-headline`,
 * `growth-line`, `score-breakdown`) are asserted present, never renamed.
 *
 * Determinism: main editions seed the no-repeat seen store
 * (`meridian:seen:v2:country:canada:medium`) with every pool id EXCEPT the
 * target, so the Canada country run deals the Dysart label first (mirrors
 * tests/e2e/question-wrap.spec.ts). GeoDetective pins the deal with the
 * `?loop-puzzle=` seam and reaches the sheet/guess list through the
 * jump-search box (the 98-char and 24-char names are in the names index).
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

// 97-char raw name → 106-char country-qualified label ("…, Ontario").
const TARGET_ID = "gn-13680011";
const TARGET_LABEL =
  "United Townships of Dysart, Dudley, Harcourt, Guilford, Harburn, Bruton, Havelock, Eyre and Clyde, Ontario";

// 98-char rendered worst case (GeoDetective names index, title-cased).
const LOOP_WORST_ID = "geonames:13680011";
const LOOP_WORST_NAME =
  "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada";
// 24-char unbreakable — must wrap at the overflow edge, never spill.
const LOOP_UNBREAKABLE_ID = "geonames:488713";
const LOOP_UNBREAKABLE_NAME = "Staronizhestebliyevskaya, Russia";
// Longest GeoDetective target display name (clue index 7).
const LOOP_ANSWER_NAME = "Huntington Beach, California, United States";

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
  const re =
    /place\(\s*\n\s*"(\w+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"([a-z0-9-]+)",/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) out.push(`${m[2]}-${m[3]}`);
  }
  return out;
}

function canadaCountryPoolIds(): string[] {
  const manifest = JSON.parse(
    readFileSync("src/game/data/geonames/manifest.json", "utf8"),
  ) as { regions: Record<string, { edition: string }> };
  const ids = [...curatedIds("country", "canada")];
  for (const [rid, r] of Object.entries(manifest.regions)) {
    if (rid === "canada" || r.edition === "state") ids.push(...chunkIds(rid));
  }
  return ids;
}

async function seedSeenExcept(page: Page): Promise<void> {
  const allIds = canadaCountryPoolIds();
  expect(allIds, `target ${TARGET_ID} must be in the pool`).toContain(TARGET_ID);
  const seen = allIds.filter((id) => id !== TARGET_ID);
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  await page.evaluate(
    ([k, ids]: [string, string[]]) =>
      localStorage.setItem(k, JSON.stringify(ids)),
    [`${SEEN_PREFIX}country:canada:medium`, seen] as [string, string[]],
  );
}

/**
 * The PR1 contract for a name element: the FULL expected text renders,
 * computed text-overflow is never "ellipsis", the element never overflows
 * horizontally (unbreakables wrap at the overflow edge), and it stays
 * inside the viewport horizontally.
 */
async function expectFullName(
  page: Page,
  locator: string,
  expectedText: string,
): Promise<void> {
  const el = page.locator(locator).first();
  await expect(el).toBeVisible({ timeout: 15_000 });
  expect(((await el.textContent()) ?? "").trim()).toBe(expectedText);
  const c = await el.evaluate((node) => {
    const style = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    return {
      textOverflow: style.textOverflow,
      overflowWrap: style.overflowWrap,
      scrollW: node.scrollWidth,
      clientW: node.clientWidth,
      left: r.left,
      right: r.right,
      innerW: window.innerWidth,
    };
  });
  expect(c.textOverflow, `${locator}: text-overflow must never be ellipsis`).not.toBe(
    "ellipsis",
  );
  expect(
    c.overflowWrap,
    `${locator}: .place-name must apply (overflow-wrap: break-word)`,
  ).toBe("break-word");
  expect(
    c.scrollW,
    `${locator}: name must not overflow horizontally (scrollWidth ${c.scrollW} > clientWidth ${c.clientW})`,
  ).toBeLessThanOrEqual(c.clientW + 1);
  expect(
    c.left,
    `${locator}: name must start inside the viewport`,
  ).toBeGreaterThanOrEqual(-1);
  expect(
    c.right,
    `${locator}: name must end inside the viewport`,
  ).toBeLessThanOrEqual(c.innerW + 1);
}

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/**
 * Vancouver, BC — ~3,300 km from the Ontario target (a guaranteed miss) and
 * a pool place, so the pin reverse-geocodes and the pin-compare-line
 * renders (ocean pins fail closed to no line — observed in the first E2E
 * pass). Projected through the __project E2E seam so the tap point is
 * deterministic at every viewport.
 */
const MISS_LON = -123.11934;
const MISS_LAT = 49.24966;

async function missPointOnNamedPlace(page: Page): Promise<{ x: number; y: number }> {
  const p = await page.locator(".satellite-map").evaluate(
    (el, [lon, lat]: [number, number]) => {
      const hook = (
        el as unknown as {
          __project?: (lo: number, la: number) => { x: number; y: number } | null;
        }
      ).__project;
      const s = hook?.(lon, lat) ?? null;
      if (!s) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
    },
    [MISS_LON, MISS_LAT] as [number, number],
  );
  expect(p, "the __project seam must resolve the miss point").not.toBeNull();
  expect(
    await tapHitsMap(page, p!.x, p!.y),
    "miss tap point must hit the map canvas, not chrome",
  ).toBe(true);
  return p!;
}

// ---- GeoDetective helpers (mirror geodetective.spec.ts) ----

async function openLoop(page: Page, puzzle: string): Promise<void> {
  await page.goto(`${APP.split("?")[0]}?loop-puzzle=${puzzle}&idle-ms=3600000`);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

function searchBox(page: Page) {
  return page.getByRole("combobox", { name: "Search the map" });
}

/** Jump-search a names-index entry by id; the confirm bottom sheet opens. */
async function openSheetFor(page: Page, query: string, entryId: string): Promise<void> {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.locator(`li[role="option"][data-entry-id="${entryId}"]`);
  // The 11 MB name index parses on first focus; allow headroom on slow VMs.
  await expect(option).toBeVisible({ timeout: 60_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
}

/** Resolve the open mystery's target entry from the guess index. */
async function targetEntry(page: Page) {
  return page.evaluate(async () => {
    const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    const clue = await fetch(`loop/clues/${store.current.index}.json`).then((r) =>
      r.json(),
    );
    const names = await fetch("loop/names.json").then((r) => r.json());
    return names.find((e: { id: string }) => e.id === clue.placeId) as {
      n: string;
      id: string;
      r: string;
    };
  });
}

/** Guess the resolved target through the search box (win path). */
async function guessTarget(page: Page, entry: { n: string; id: string }) {
  const box = searchBox(page);
  await box.click();
  await box.fill(entry.n);
  const option = page.locator(`li[role="option"][data-entry-id="${entry.id}"]`);
  await expect(option).toBeVisible({ timeout: 60_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

// ---- Matrix: 360 / 768 / 1280 × light / dark × reduced-motion ----

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const SCHEMES = ["dark", "light"] as const;
const MOTIONS = ["no-preference", "reduce"] as const;

for (const vp of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    for (const motion of MOTIONS) {
      test.describe(`${vp.width}px · ${scheme} · ${motion}`, () => {
        test.use({
          viewport: vp,
          colorScheme: scheme,
          reducedMotion: motion,
        });

        test("question bubble + reveal: 106-char label never ellipsizes", async ({
          page,
        }) => {
          await page.goto(APP);
          await seedSeenExcept(page);
          await page.getByRole("button", { name: "Choose a country" }).click();
          // Canada has no admin1 subdivisions, so choosing it opens the
          // country run DIRECTLY (game-app.tsx: no "Play entire Canada"
          // button exists — that header action only renders for the
          // admin1-drilled countries like the United States).
          await page.getByRole("button", { name: "Canada" }).click();
          await expectAim(page);

          // Expanded view: the full 106-char qualified label wraps.
          await expectFullName(page, "h2.place-name", TARGET_LABEL);

          // Frozen seam: the difficulty chip is untouched by this PR.
          await expect(page.getByTestId("difficulty-chip")).toBeVisible();

          // Collapsed view: the name still wraps instead of truncating.
          await page.getByRole("button", { name: "Collapse question" }).click();
          await expectFullName(page, "p.place-name", TARGET_LABEL);

          // Re-open, commit a guaranteed miss on a NAMED place, and check the
          // reveal card: answer heading + pin-compare-line both carry full
          // names. (A mid-ocean pin fail-closes to no pin-compare-line, so
          // the miss targets Vancouver through the __project seam.)
          await page.getByRole("button", { name: "Expand question" }).click();
          const miss = await missPointOnNamedPlace(page);
          const { phase } = await commitPin(page, miss.x, miss.y);
          expect(phase, "the Vancouver tap must be a miss (done phase)").toBe("done");

          const card = page.locator('section[aria-label="Result"]');
          await expect(card).toBeVisible({ timeout: 15_000 });
          await expectFullName(
            page,
            'section[aria-label="Result"] h2.place-name',
            TARGET_LABEL,
          );
          // Frozen seam: the pin-compare-line testid is untouched.
          const pinLine = page.getByTestId("pin-compare-line");
          await expect(pinLine).toBeVisible({ timeout: 15_000 });
          const pinText = ((await pinLine.textContent()) ?? "").trim();
          expect(
            pinText,
            "pin-compare-line names the true spot with the full label",
          ).toContain(TARGET_LABEL);
          await expectFullName(
            page,
            '[data-testid="pin-compare-line"]',
            pinText,
          );
          // Frozen seam: the miss headline is untouched by this PR.
          await expect(page.getByTestId("miss-headline")).toBeVisible();
        });

        test("geodetective: 98-char guess + unbreakable wrap, reveal full", async ({
          page,
        }) => {
          await openLoop(page, "7");

          // Bottom sheet: the 98-char worst case renders in full.
          await openSheetFor(page, "dysart", LOOP_WORST_ID);
          await expectFullName(
            page,
            'div[role="dialog"] h2.place-name',
            LOOP_WORST_NAME,
          );
          await page.getByRole("button", { name: "Guess this place" }).click();

          // Guess list: the row keeps the full name (the deleted truncate).
          await expectFullName(
            page,
            'section[aria-label="Your guesses"] li span.place-name',
            LOOP_WORST_NAME,
          );

          // Unbreakable: no break opportunities, still no horizontal spill.
          await openSheetFor(page, "staronizhestebliyevskaya", LOOP_UNBREAKABLE_ID);
          await expectFullName(
            page,
            'div[role="dialog"] h2.place-name',
            LOOP_UNBREAKABLE_NAME,
          );
          await page.getByRole("button", { name: "Guess this place" }).click();

          // Win the mystery; the reveal answer heading renders in full.
          await guessTarget(page, await targetEntry(page));
          const won = page.locator('section[aria-label="You won"]');
          await expect(won).toBeVisible({ timeout: 30_000 });
          await expectFullName(
            page,
            'section[aria-label="You won"] h2.place-name',
            LOOP_ANSWER_NAME,
          );
        });
      });
    }
  }
}
