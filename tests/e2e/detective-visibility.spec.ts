import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";
import {
  currentPhase,
  fulfillFlagsOn,
  installDetectiveRecorder,
  openSeamCase,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * Detective visibility gate (prod-pair fix, 2026-11-06): the pair must
 * be VISIBLE — not merely present in the DOM — in a real player's
 * viewport, and the two figures must never paint over each other.
 *
 * Why this spec exists: the live build (main 1b38cb3, detectivePair
 * ON) shipped with Holmes entirely hidden behind Watson at the map
 * dock (same bottom-left origin; Watson's 100 px figure box covers
 * Holmes's 70 px box, and the dock's z-index paints Watson on top),
 * and with both the clue-card station and the dock starting below
 * the fold at phone AND desktop widths. Every earlier gate asserted
 * DOM presence + bounding boxes, which pass for an off-screen or
 * fully occluded figure. This spec asserts the two things that were
 * never checked: viewport intersection and figure-vs-figure overlap,
 * at a desktop width AND 390 px, on a core case AND a Capitals case.
 */

test.setTimeout(300_000);

interface PairGeometry {
  phase: string | null;
  holmes: { left: number; top: number; right: number; bottom: number } | null;
  watson: { left: number; top: number; right: number; bottom: number } | null;
  holmesInView: number; // fraction of the figure's area inside the viewport
  watsonInView: number;
  overlapArea: number; // Holmes ∩ Watson, px²
}

/** Measure the pair's ARTWORK (the svg inside each figure host) in
 * client coordinates, wherever the pair currently renders (station
 * cluster or map portal). */
async function pairGeometry(page: Page): Promise<PairGeometry> {
  return page.evaluate(() => {
    const rectOf = (who: string) => {
      const svg = document.querySelector(`[data-detective="${who}"] svg`);
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const inView = (
      r: { left: number; top: number; right: number; bottom: number } | null,
    ) => {
      if (!r) return 0;
      const area = (r.right - r.left) * (r.bottom - r.top);
      if (area <= 0) return 0;
      const iw =
        Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
      const ih =
        Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (iw <= 0 || ih <= 0) return 0;
      return (iw * ih) / area;
    };
    const holmes = rectOf("holmes");
    const watson = rectOf("watson");
    let overlapArea = 0;
    if (holmes && watson) {
      const ox =
        Math.min(holmes.right, watson.right) -
        Math.max(holmes.left, watson.left);
      const oy =
        Math.min(holmes.bottom, watson.bottom) -
        Math.max(holmes.top, watson.top);
      if (ox > 0 && oy > 0) overlapArea = ox * oy;
    }
    const surface =
      document.querySelector('[data-testid="detective-station"]') ??
      document.querySelector('[data-testid="detective-host"]');
    return {
      phase: surface?.getAttribute("data-phase") ?? null,
      holmes,
      watson,
      holmesInView: inView(holmes),
      watsonInView: inView(watson),
      overlapArea,
    };
  });
}

/** Poll until BOTH figures are substantially inside the viewport and
 * share zero pixels; fail with the last geometry seen. */
async function expectPairVisibleAndSeparate(
  page: Page,
  label: string,
  minInView = 0.55,
) {
  let last: PairGeometry | null = null;
  await expect
    .poll(
      async () => {
        last = await pairGeometry(page);
        return (
          last.holmes !== null &&
          last.watson !== null &&
          last.holmesInView >= minInView &&
          last.watsonInView >= minInView &&
          last.overlapArea === 0
        );
      },
      { timeout: 45_000 },
    )
    .toBe(true)
    .catch(() => false);
  const ok =
    last !== null &&
    (last as PairGeometry).holmesInView >= minInView &&
    (last as PairGeometry).watsonInView >= minInView &&
    (last as PairGeometry).overlapArea === 0;
  expect(
    ok,
    `${label}: pair must be in the viewport and unoccluded — last geometry: ${JSON.stringify(last)}`,
  ).toBe(true);
}

/** Scroll the map fully into view, the way a player does to guess. */
async function showMap(page: Page) {
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="loop-map"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
}

/** Scroll the active clue card into view — Watson's station stands
 * in the gutter beside it, so this is how a player sees him during
 * the guessing phases after the station cure (2026-11-08). */
async function showStation(page: Page) {
  await page.evaluate(() => {
    document
      .querySelector('article[aria-label^="Clue 1:"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
}

/** Poll until ONE named figure is substantially inside the viewport
 * and shares zero pixels with the other. Used for the guessing
 * phases, where the pair is split (Holmes at the map dock, Watson
 * at the clue-card station) and no single scroll position frames
 * both — each figure is proven in its own place instead. */
async function expectFigureInView(
  page: Page,
  who: "holmes" | "watson",
  label: string,
  minInView = 0.9,
) {
  let last: PairGeometry | null = null;
  await expect
    .poll(
      async () => {
        last = await pairGeometry(page);
        const rect = who === "holmes" ? last.holmes : last.watson;
        const frac = who === "holmes" ? last.holmesInView : last.watsonInView;
        return rect !== null && frac >= minInView && last.overlapArea === 0;
      },
      { timeout: 45_000 },
    )
    .toBe(true)
    .catch(() => false);
  const l = last as PairGeometry | null;
  const frac = l ? (who === "holmes" ? l.holmesInView : l.watsonInView) : 0;
  expect(
    l !== null && frac >= minInView && l.overlapArea === 0,
    `${label}: ${who} must be in the viewport and unoccluded — last geometry: ${JSON.stringify(last)}`,
  ).toBe(true);
}

const WIDTHS = [
  { name: "desktop 1280", width: 1280, height: 950 },
  { name: "phone 390", width: 390, height: 844 },
] as const;

for (const w of WIDTHS) {
  test(`core case: pair visible + unoccluded at station and dock (${w.name})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 3);
      const page = await context.newPage();
      await fulfillFlagsOn(context);
      // Case 137 (Henderson) via the seam — the core case with full
      // audio, same case the companion gates use.
      await openSeamCase(page, 137);

      // Station (case open / clue read): the reading moment must be
      // ON SCREEN — the pair stands at the clue card, in view,
      // side by side, sharing no pixels.
      await expectPairVisibleAndSeparate(page, `station @ ${w.name}`);

      // Search: the pair SPLITS (station cure, 2026-11-08) — Holmes
      // alone at the map dock, Watson holding his station beside
      // the clue card. The player scrolls to the map to guess:
      // Holmes stands in view there, alone and unoccluded. Then
      // the player scrolls back to the clues: Watson stands in
      // view at his station. (Before the cure both figures stood
      // at the dock together; that shared-dock expectation is what
      // the owner's defect report retired.)
      await waitForSearchIdle(page, 120_000);
      expect(await currentPhase(page)).toBe("SEARCH_IDLE");
      await showMap(page);
      await expectFigureInView(page, "holmes", `search dock @ ${w.name}`, 0.9);
      // Watson must NOT be on the map in the guessing phase.
      await expect(page.getByTestId("detective-dock")).toHaveCount(0);
      await showStation(page);
      await expectFigureInView(page, "watson", `search station @ ${w.name}`, 0.9);
    } finally {
      await context.close();
    }
  });
}

const SINGLE_CASE_MANIFEST = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 1,
  generatedAt: "2026-11-04T00:00:00.000Z",
  loopIndexes: [387],
  loopTiers: [3],
  coldtrailFile: "cases.capitals.generated.json",
};

for (const w of WIDTHS) {
  test(`Capitals case: pair visible + unoccluded at station and dock (${w.name})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 3);
      const page = await context.newPage();
      await fulfillFlagsOn(context);
      await page.route("**/packs/capitals/manifest.json", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(SINGLE_CASE_MANIFEST),
        });
      });
      // The stations spec's path: seed a finished core case, then the
      // shelf chip deals the pack case (387, Abu Dhabi) at once.
      const clue218 = JSON.parse(
        readFileSync(path.resolve("dist/client/loop/clues/218.json"), "utf8"),
      ) as { placeId: string };
      await page.addInitScript(
        (placeId) => {
          localStorage.setItem(
            "meridian.loop.v2",
            JSON.stringify({
              deck: { deck: [100], cycle: 1, cycleCompleted: 3 },
              current: {
                index: 218,
                cycle: 1,
                guesses: [
                  {
                    name: "Ankara",
                    placeId,
                    distKm: 0,
                    octant: "north",
                    warmer: null,
                  },
                ],
                status: "won",
                cluesRevealed: 1,
                completedAt: "2026-11-03",
                streakEndedAt: null,
                completedCycle: false,
              },
              streak: 1,
              bestStreak: 1,
              totals: { solved: 3, lost: 0 },
            }),
          );
        },
        clue218.placeId,
      );
      await page.goto("http://127.0.0.1:4123/Meridian/");
      await page
        .getByRole("button", { name: "GeoDetective: Solve a mystery" })
        .click();
      await expect(page.getByText("🎯 You found it!")).toBeVisible({
        timeout: 30_000,
      });
      await page.getByTestId("pack-chip-capitals").click();
      await expect(
        page.getByRole("article", { name: /Clue 1:/ }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("detective-station")).toBeVisible({
        timeout: 20_000,
      });
      // First gesture for the speech unlock (the u10 pattern).
      await page.getByRole("heading", { name: "GeoDetective" }).click();

      await expectPairVisibleAndSeparate(page, `pack station @ ${w.name}`);

      await waitForSearchIdle(page, 120_000);
      expect(await currentPhase(page)).toBe("SEARCH_IDLE");
      // Same split as the core case: Holmes alone at the map dock,
      // Watson at his clue-card station (station cure, 2026-11-08).
      await showMap(page);
      await expectFigureInView(page, "holmes", `pack search dock @ ${w.name}`, 0.9);
      await expect(page.getByTestId("detective-dock")).toHaveCount(0);
      await showStation(page);
      await expectFigureInView(page, "watson", `pack search station @ ${w.name}`, 0.9);
    } finally {
      await context.close();
    }
  });
}
