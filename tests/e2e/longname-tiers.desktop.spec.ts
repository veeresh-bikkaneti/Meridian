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
 * Cartographer's Plate PR2 — tiers + tokens + rows E2E gate.
 *
 * Doctrine: "names are the payload; containers flex, names never do."
 * React sets `data-name-tier` from the full label length (short ≤26,
 * medium 27–60, long ≥61); CSS styles per tier. This spec proves, against
 * the REAL longest names from the spec §11 fixtures:
 *
 *   - `data-name-tier` values on every tiered surface (question bubble,
 *     reveal answer heading, ledger TRUE SPOT, dossier rows, bottom
 *     sheet, GeoDetective reveal answer)
 *   - tier styling actually applies (computed font-size/weight per tier,
 *     brass hairline frame on long)
 *   - the meta band locks the difficulty chip (in the band, 11px floor,
 *     never compacts — same box at every tier)
 *   - dossier guess rows (grid, brass "№ N", FIRST GUESS tag on row 1
 *     only, trend words on the rest, bearing arrow + octant, single
 *     accessible list item)
 *   - the pin-compare ledger is a real <dl> with stacked DT/DD entries,
 *     YOUR PIN quiet with the sentence-case "near " qualifier (NOT
 *     italic), TRUE SPOT gold + tiered
 *   - grade chip bands in BOTH unit contexts: a USA mystery (Detroit)
 *     grades in miles, a non-USA mystery (Geneva) in kilometers — the
 *     150–160 km disagreement window proves which ruler applied
 *   - anchor bolding's strict rule: ", Canada" bolds, ", Ontario" does
 *     not; the name stays a single element (no double-announce)
 *   - zero-width-space display refinement never corrupts text
 *
 * Matrix: 360 / 768 / 1280 px widths × light / dark × reduced-motion.
 * Frozen E2E seams (`difficulty-chip`, `pin-compare-line`,
 * `miss-headline`, `growth-line`, `score-breakdown`) are asserted
 * present, never renamed.
 *
 * Determinism: main editions seed the no-repeat seen store with every
 * pool id EXCEPT the target (mirrors longname-wrap.spec.ts). GeoDetective
 * pins the deal with the `?loop-puzzle=` seam and guesses through the
 * jump-search box.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

// ---- Canada country run (non-USA → km): the 106-char label, long tier ----
const CA_TARGET_ID = "gn-13680011";
const CA_TARGET_LABEL =
  "United Townships of Dysart, Dudley, Harcourt, Guilford, Harburn, Bruton, Havelock, Eyre and Clyde, Ontario";

// ---- Nebraska state run (USA → miles): 21-char name, short tier ----
const NE_TARGET_ID = "gn-7259430";
const NE_TARGET_NAME = "Offutt Air Force Base";

// ---- GeoDetective fixtures ----
const LOOP_WORST_ID = "geonames:13680011";
const LOOP_WORST_NAME =
  "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada"; // 98 chars
const LOOP_UNBREAKABLE_ID = "geonames:488713";
const LOOP_UNBREAKABLE_NAME = "Staronizhestebliyevskaya, Russia"; // 32 chars
const LOOP_ANSWER_NAME = "Huntington Beach, California, United States"; // 43 chars

// Grade-band disagreement window: 150–160 km from the target reads
// "So Close" on the miles ruler (≤100 mi) but "Nearly There" on the km
// ruler (>150 km) — proving which unit the chip used.
const DETROIT_ID = "geonames:4990729"; // idx 47, USA → miles
const DETROIT_WINDOW_ID = "geonames:5166177"; // Parma, Ohio — 150.4 km ≈ 93.5 mi
const GENEVA_WINDOW_ID = "geonames:3021372"; // Dijon, France — 150.7 km
const FAR_IDS = [
  "geonames:1796236", // Shanghai
  "geonames:1814906", // Chongqing
  "geonames:1815286", // Chengdu
  "geonames:1816670", // Beijing
];
const FAR_QUERIES = ["shanghai", "chongqing", "chengdu", "beijing"];

function chunkIds(regionId: string): string[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/chunks/${regionId}.json`, "utf8"),
  ) as { places: { id: string }[] };
  return d.places.map((p) => p.id);
}

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

function nebraskaStatePoolIds(): string[] {
  return [...curatedIds("state", "nebraska"), ...chunkIds("nebraska")];
}

async function seedSeenExcept(
  page: Page,
  key: string,
  allIds: string[],
  targetId: string,
): Promise<void> {
  expect(allIds, `target ${targetId} must be in the pool`).toContain(targetId);
  const seen = allIds.filter((id) => id !== targetId);
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  await page.evaluate(
    ([k, ids]: [string, string[]]) =>
      localStorage.setItem(k, JSON.stringify(ids)),
    [key, seen] as [string, string[]],
  );
}

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  // The fly-to-region camera settles within ~500ms of phase "aim"; wait
  // 1s so __project taps land where expected (a tap during the flight
  // projected Vancouver to the Arctic at 1280px).
  await page.waitForTimeout(1000);
}

const MISS_LON = -123.11934;
const MISS_LAT = 49.24966;
// Western Nebraska — on-screen when the map is zoomed to the state (the
// Vancouver point is off-screen there). ~650 km from Offutt AFB: a miss.
const NE_MISS_LON = -103.5;
const NE_MISS_LAT = 41.7;

async function dismissBubble(page: Page): Promise<void> {
  // The expanded bubble can cover the projected tap point; hiding it
  // leaves the map clear. The reveal is unaffected.
  await page.getByRole("button", { name: "Hide question" }).click();
  await expect(
    page.getByRole("button", { name: "Show question" }),
  ).toBeVisible({ timeout: 15_000 });
}

async function missPointOnNamedPlace(
  page: Page,
  lon: number = MISS_LON,
  lat: number = MISS_LAT,
): Promise<{ x: number; y: number }> {
  const p = await page.locator(".satellite-map").evaluate(
    (el, [plon, plat]: [number, number]) => {
      const hook = (
        el as unknown as {
          __project?: (lo: number, la: number) => { x: number; y: number } | null;
        }
      ).__project;
      const s = hook?.(plon, plat) ?? null;
      if (!s) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
    },
    [lon, lat] as [number, number],
  );
  expect(p, "the __project seam must resolve the miss point").not.toBeNull();
  expect(
    await tapHitsMap(page, p!.x, p!.y),
    "miss tap point must hit the map canvas, not chrome",
  ).toBe(true);
  return p!;
}

// ---- GeoDetective helpers ----

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

async function guessById(page: Page, query: string, entryId: string): Promise<void> {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.locator(`li[role="option"][data-entry-id="${entryId}"]`);
  await expect(option).toBeVisible({ timeout: 60_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

async function openSheetFor(page: Page, query: string, entryId: string): Promise<void> {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.locator(`li[role="option"][data-entry-id="${entryId}"]`);
  await expect(option).toBeVisible({ timeout: 60_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
}

/** Lose a mystery with 5 guesses; the closest is the window guess. */
async function loseWithWindowGuess(
  page: Page,
  windowQuery: string,
  windowId: string,
): Promise<void> {
  await guessById(page, windowQuery, windowId);
  for (let i = 0; i < FAR_IDS.length; i++) {
    await guessById(page, FAR_QUERIES[i]!, FAR_IDS[i]!);
  }
}

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

/** Strip zero-width spaces: the display string may carry break hints. */
function stripZwsp(s: string): string {
  return s.replace(/\u200B/g, "");
}

async function expectTier(
  page: Page,
  locator: string,
  tier: "short" | "medium" | "long",
): Promise<void> {
  const el = page.locator(locator).first();
  await expect(el).toBeVisible({ timeout: 15_000 });
  await expect(el).toHaveAttribute("data-name-tier", tier);
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

        test("question card: long tier + locked meta band (Canada, km)", async ({
          page,
        }) => {
          await page.goto(APP);
          await seedSeenExcept(
            page,
            `${SEEN_PREFIX}country:canada:medium`,
            canadaCountryPoolIds(),
            CA_TARGET_ID,
          );
          await page.getByRole("button", { name: "Choose a country" }).click();
          await page.getByRole("button", { name: "Canada" }).click();
          await expectAim(page);

          // Long tier on the 106-char label.
          await expectTier(page, "h2.place-name", "long");
          const h2 = page.locator("h2.place-name").first();
          const cs = await h2.evaluate((node) => {
            const s = getComputedStyle(node);
            return {
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              borderTopWidth: s.borderTopWidth,
              borderBottomWidth: s.borderBottomWidth,
              textOverflow: s.textOverflow,
            };
          });
          expect(cs.fontSize, "long tier sets 16px").toBe("16px");
          expect(cs.fontWeight, "long tier is Fraunces 500").toBe("500");
          expect(
            cs.borderTopWidth,
            "long tier carries the brass hairline frame",
          ).not.toBe("0px");
          expect(cs.borderBottomWidth, "frame is above AND below").not.toBe("0px");
          expect(cs.textOverflow, "never an ellipsis").not.toBe("ellipsis");

          // Full text survives the display refinement byte-identical
          // (this label has no /, –, - break chars).
          expect(stripZwsp((await h2.textContent()) ?? "").trim()).toBe(
            CA_TARGET_LABEL,
          );

          // Anchor bolding: ", Ontario" is NOT a country → no bold.
          expect(
            await h2.locator("strong.place-name-anchor").count(),
            "no anchor tail for a subdivision tail",
          ).toBe(0);

          // Meta-band lock: the chip lives in the band at the 11px floor.
          const chip = page.getByTestId("difficulty-chip");
          await expect(chip).toBeVisible();
          const chipBox = await chip.evaluate((node) => {
            const s = getComputedStyle(node);
            const r = node.getBoundingClientRect();
            const band = node.closest(".name-meta")?.getBoundingClientRect();
            return {
              fontSize: s.fontSize,
              whiteSpace: s.whiteSpace,
              width: r.width,
              bandTop: band?.top,
              chipTop: r.top,
            };
          });
          expect(chipBox.fontSize, "chip never shrinks below 11px").toBe("11px");
          expect(chipBox.whiteSpace, "chip never compacts").toBe("nowrap");
          expect(
            Math.abs((chipBox.bandTop ?? 0) - chipBox.chipTop) < 24,
            "chip sits in the meta band row",
          ).toBe(true);

          // The eyebrow survives at every tier.
          await expect(page.locator(".name-eyebrow").first()).toBeVisible();
        });

        test("question card: short tier reads miles on a USA play", async ({
          page,
        }) => {
          await page.goto(APP);
          await seedSeenExcept(
            page,
            `${SEEN_PREFIX}state:nebraska:medium`,
            nebraskaStatePoolIds(),
            NE_TARGET_ID,
          );
          await page.getByRole("button", { name: "Choose a country" }).click();
          await page.getByRole("button", { name: "United States" }).click();
          await page.getByRole("button", { name: "Nebraska" }).click();
          await expectAim(page);

          // Short tier on the 21-char name.
          await expectTier(page, "h2.place-name", "short");
          const h2 = page.locator("h2.place-name").first();
          expect(stripZwsp((await h2.textContent()) ?? "").trim()).toBe(
            NE_TARGET_NAME,
          );
          const weight = await h2.evaluate(
            (node) => getComputedStyle(node).fontWeight,
          );
          expect(weight, "short tier is Fraunces 600 (placard)").toBe("600");

          // Miss → the headline reads MILES on a USA play + the grade chip.
          // The bubble is dismissed first so the tap point can't hide
          // under the chrome; western Nebraska is on-screen in the
          // state-zoomed map (Vancouver is not).
          await dismissBubble(page);
          const miss = await missPointOnNamedPlace(page, NE_MISS_LON, NE_MISS_LAT);
          const { phase } = await commitPin(page, miss.x, miss.y);
          expect(phase, "the western-Nebraska tap must be a miss").toBe("done");
          const headline = page.getByTestId("miss-headline");
          await expect(headline).toBeVisible({ timeout: 15_000 });
          const headlineText = (await headline.textContent()) ?? "";
          expect(headlineText, "USA play reads miles").toMatch(/mi\b/);
          expect(headlineText, "USA play never reads km").not.toMatch(/km\b/);
          const chip = page.locator(
            'section[aria-label="Result"] .grade-chip',
          );
          await expect(chip).toBeVisible();
          expect(await chip.getAttribute("aria-label")).toBe("Grade: miss");
        });

        test("reveal ledger: real <dl>, quiet near, gold TRUE SPOT (Canada, km)", async ({
          page,
        }) => {
          await page.goto(APP);
          await seedSeenExcept(
            page,
            `${SEEN_PREFIX}country:canada:medium`,
            canadaCountryPoolIds(),
            CA_TARGET_ID,
          );
          await page.getByRole("button", { name: "Choose a country" }).click();
          await page.getByRole("button", { name: "Canada" }).click();
          await expectAim(page);
          await dismissBubble(page);
          // Fixed viewport center tap (not __project): sits deep inside
          // Canada at every matrix width, far from the Ontario target
          // (a miss), and near pool places (resolvable for the ledger).
          // __project proved unreliable at 1280px (projected Vancouver
          // to the map center while the tap landed in the Arctic).
          const vp = page.viewportSize() ?? { width: 1280, height: 800 };
          const cx = Math.round(vp.width / 2);
          const cy = Math.round(vp.height / 2);
          expect(
            await tapHitsMap(page, cx, cy),
            "center tap must hit the map canvas, not chrome",
          ).toBe(true);
          const { phase } = await commitPin(page, cx, cy);
          expect(phase).toBe("done");

          const ledger = page.getByTestId("pin-compare-line");
          await expect(ledger).toBeVisible({ timeout: 15_000 });
          expect(await ledger.evaluate((n) => n.tagName), "real <dl>").toBe("DL");

          // Stacked entries: DT small-caps eyebrow ABOVE DD.
          const dts = ledger.locator("dt");
          expect(await dts.count()).toBe(2);
          expect(
            ((await dts.nth(0).textContent()) ?? "").trim().toLowerCase(),
          ).toBe("your pin");
          expect(
            ((await dts.nth(1).textContent()) ?? "").trim().toLowerCase(),
          ).toBe("true spot");
          const order = await ledger.evaluate((dl) => {
            const tags: string[] = [];
            dl.querySelectorAll("dt, dd").forEach((el) =>
              tags.push(el.tagName),
            );
            return tags;
          });
          expect(order, "DT above DD, stacked").toEqual(["DT", "DD", "DT", "DD"]);

          // YOUR PIN: quiet, sentence-case "near " qualifier — NOT italic.
          // The qualifier names the nearest pool place to the actual pin
          // (an honest "near <place>"); the shape is what's asserted, not
          // the specific place.
          const yourPin = ledger.locator("dd").nth(0);
          const yourPinText = ((await yourPin.textContent()) ?? "").trim();
          expect(yourPinText).toMatch(/^near [^,]+, British Columbia$/);
          const qualifierStyle = await ledger
            .locator(".near-qualifier")
            .first()
            .evaluate((n) => getComputedStyle(n).fontStyle);
          expect(qualifierStyle, "near is never italic").not.toBe("italic");

          // TRUE SPOT: tiered Fraunces with the full answer name.
          const trueSpot = ledger.locator("dd").nth(1);
          await expect(trueSpot).toHaveAttribute("data-name-tier", "long");
          expect(
            stripZwsp((await trueSpot.textContent()) ?? "").trim(),
          ).toBe(CA_TARGET_LABEL);
          const goldMark = await ledger
            .locator(".truespot-mark")
            .first()
            .evaluate((n) => getComputedStyle(n).backgroundColor);
          expect(goldMark, "gold answer-mark motif").toBe("rgb(242, 193, 78)");

          // Frozen seams survive the redesign.
          await expect(page.getByTestId("miss-headline")).toBeVisible();
          const headlineText =
            (await page.getByTestId("miss-headline").textContent()) ?? "";
          expect(headlineText, "non-USA play reads km").toMatch(/km\b/);
        });

        test("geodetective dossier rows: 98-char guess, FIRST GUESS tag, anchor bold", async ({
          page,
        }) => {
          await openLoop(page, "7");

          // Bottom sheet: the 98-char worst case, long tier.
          await openSheetFor(page, "dysart", LOOP_WORST_ID);
          const sheetH2 = page.locator('div[role="dialog"] h2.place-name');
          await expectTier(page, 'div[role="dialog"] h2.place-name', "long");
          expect(stripZwsp((await sheetH2.textContent()) ?? "").trim()).toBe(
            LOOP_WORST_NAME,
          );

          // Anchor bolding, strict rule: ", Canada" bolds…
          const anchor = sheetH2.locator("strong.place-name-anchor");
          expect(await anchor.count()).toBe(1);
          expect(((await anchor.textContent()) ?? "").trim()).toBe(", Canada");
          const anchorWeight = await anchor.evaluate(
            (n) => getComputedStyle(n).fontWeight,
          );
          expect(parseInt(anchorWeight, 10)).toBeGreaterThan(500);
          const anchorColor = await anchor.evaluate(
            (n) => getComputedStyle(n).color,
          );
          const h2Color = await sheetH2.evaluate(
            (n) => getComputedStyle(n).color,
          );
          expect(anchorColor, "weight-only, no color change").toBe(h2Color);

          // …and the screen reader gets the name ONCE (no double-announce).
          // Via CDP's accessibility tree: exactly one heading node carries
          // the full name — the nested <strong> keeps the name a single
          // element, so no SR can announce it twice.
          const cdp = await page.context().newCDPSession(page);
          const axTree = await cdp.send("Accessibility.getFullAXTree", {});
          const headingsNamedFull = (function count(nodes: any[]): number {
            let n = 0;
            for (const node of nodes ?? []) {
              if (node.role?.value === "heading" && node.name?.value === LOOP_WORST_NAME) n++;
              n += count(node.children ?? []);
            }
            return n;
          })(axTree.nodes);
          expect(
            headingsNamedFull,
            "exactly one heading exposes the full name — single-announce, never doubled",
          ).toBe(1);

          // ARIA carries the raw name — never the display refinement.
          expect(
            await page
              .locator('div[role="dialog"]')
              .getAttribute("aria-label"),
          ).toBe(`Guess ${LOOP_WORST_NAME}?`);
          expect(
            await sheetH2.getAttribute("aria-label"),
            "no aria-label on the static name (visible text == accessible name)",
          ).toBeNull();

          await page.getByRole("button", { name: "Guess this place" }).click();

          // Dossier row: grid, brass number, FIRST GUESS tag, tier.
          const row = page.locator(
            'section[aria-label="Your guesses"] li.dossier-row',
          );
          await expect(row).toBeVisible({ timeout: 15_000 });
          const rowLabel = await row.getAttribute("aria-label");
          expect(
            rowLabel?.startsWith(`Guess 1: ${LOOP_WORST_NAME}. First guess. `),
            "single accessible list item: guess, name, trend, distance",
          ).toBe(true);
          expect(rowLabel).toMatch(
            /, (north|south|east|west|northeast|northwest|southeast|southwest)\.$/,
          );
          expect(
            await row.locator(".dossier-num").textContent(),
            "brass dossier number",
          ).toContain("№ 1");
          await expectTier(
            page,
            'section[aria-label="Your guesses"] li span.place-name',
            "long",
          );
          const tag = row.locator(".first-guess-tag");
          await expect(tag).toBeVisible();
          expect(((await tag.textContent()) ?? "").trim().toLowerCase()).toBe(
            "first guess",
          );
          expect(
            await row.locator(".dossier-trend").count(),
            "row 1 never gets a trend word",
          ).toBe(0);
          // Bearing arrow + octant label, grouped with the distance.
          await expect(row.locator(".dossier-bearing-arrow")).toBeVisible();
          expect(
            ((await row.locator(".dossier-octant").textContent()) ?? "").trim(),
          ).not.toBe("");

          // The unbreakable wraps at the overflow edge — medium tier here.
          await openSheetFor(page, "staronizhestebliyevskaya", LOOP_UNBREAKABLE_ID);
          await expectTier(page, 'div[role="dialog"] h2.place-name', "medium");
          const unb = page.locator('div[role="dialog"] h2.place-name');
          const unbBox = await unb.evaluate((n) => ({
            scrollW: n.scrollWidth,
            clientW: n.clientWidth,
          }));
          expect(
            unbBox.scrollW,
            "unbreakable must not overflow horizontally",
          ).toBeLessThanOrEqual(unbBox.clientW + 1);
          // ", Russia" IS a country → the strict rule bolds it.
          expect(await unb.locator("strong.place-name-anchor").count()).toBe(1);
          await page.getByRole("button", { name: "Guess this place" }).click();

          // Row 2 gets a trend word; row 1 keeps FIRST GUESS.
          const rows = page.locator(
            'section[aria-label="Your guesses"] li.dossier-row',
          );
          expect(await rows.count()).toBe(2);
          expect(await rows.nth(1).locator(".first-guess-tag").count()).toBe(1);
          const trend = (
            (await rows.nth(0).locator(".dossier-trend").textContent()) ?? ""
          )
            .trim()
            .toLowerCase();
          expect(["warmer", "colder"], "row 2+ gets a trend word").toContain(
            trend,
          );
        });

        test("geodetective reveal: answer tier + grade chip (win, idx 7)", async ({
          page,
        }) => {
          await openLoop(page, "7");
          const entry = await targetEntry(page);
          const box = searchBox(page);
          await box.click();
          await box.fill(entry.n);
          const option = page.locator(
            `li[role="option"][data-entry-id="${entry.id}"]`,
          );
          await expect(option).toBeVisible({ timeout: 60_000 });
          await option.click();
          await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
          await page.getByRole("button", { name: "Guess this place" }).click();

          const won = page.locator('section[aria-label="You won"]');
          await expect(won).toBeVisible({ timeout: 30_000 });
          const answerH2 = won.locator("h2.place-name");
          await expectTier(page, 'section[aria-label="You won"] h2.place-name', "medium");
          expect(
            stripZwsp((await answerH2.textContent()) ?? "").trim(),
          ).toBe(LOOP_ANSWER_NAME);
          const chip = won.locator(".grade-chip");
          await expect(chip).toBeVisible();
          expect(await chip.getAttribute("aria-label")).toBe("Grade: Bullseye");
          expect(((await chip.textContent()) ?? "").trim()).toContain("Bullseye");
        });

        test("grade chip bands: USA mystery grades in MILES (Detroit idx 47)", async ({
          page,
        }) => {
          await openLoop(page, "47");
          // Lose with the closest guess at 150.4 km ≈ 93.5 mi: the miles
          // ruler says So Close (≤100 mi); the km ruler would say Nearly
          // There (>150 km).
          await loseWithWindowGuess(page, "parma", DETROIT_WINDOW_ID);
          const lost = page.locator('section[aria-label="Out of guesses"]');
          await expect(lost).toBeVisible({ timeout: 30_000 });
          const chip = lost.locator(".grade-chip");
          await expect(chip).toBeVisible();
          expect(await chip.getAttribute("aria-label")).toBe("Grade: So Close");
          expect(((await chip.textContent()) ?? "").trim()).toContain("🏆");
        });

        test("grade chip bands: non-USA mystery grades in KM (Geneva idx 13)", async ({
          page,
        }) => {
          await openLoop(page, "13");
          // Lose with the closest guess at 150.7 km: the km ruler says
          // Nearly There (>150 km); the miles ruler would say So Close.
          await loseWithWindowGuess(page, "dijon", GENEVA_WINDOW_ID);
          const lost = page.locator('section[aria-label="Out of guesses"]');
          await expect(lost).toBeVisible({ timeout: 30_000 });
          const chip = lost.locator(".grade-chip");
          await expect(chip).toBeVisible();
          expect(await chip.getAttribute("aria-label")).toBe("Grade: Nearly There");
        });
      });
    }
  }
}
