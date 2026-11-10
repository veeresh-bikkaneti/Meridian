/**
 * Flank (STAGE): Holmes's frozen slot at the clue card + the Listen
 * first-tap cure.
 *
 * - Geometry (390 / 768 / 1280, live case): Holmes at the flank,
 *   Watson at his station, clue-text overlap 0 px² (AuditTrail),
 *   the bench gone, no Holmes on the map. Row at 768/1280 (Holmes
 *   left of the card), bookend strip at 390 (both figures above
 *   the card, Listen in the middle). At 390 a wrong guess deals
 *   clue 2 — the strip moves above it and still covers no clue
 *   text (the in-flow proof: the strip takes layout space, it
 *   does not overlay the previous card).
 * - Listen first tap (tap mode, 390): the Listen tap is the FIRST
 *   post-mount gesture — one tap plays the held clue sequence
 *   (the cure; the two-tap flow in detective-sound.spec.ts (f) is
 *   the defect this replaces). Play is proven by the harness's
 *   play() record (an Audio element played a detective clip) —
 *   this sandbox cannot prove audible sound, and the report says
 *   so; it never says the clip was heard.
 * - Flag-off run (staging on, flank off): today's behaviour
 *   unchanged — no flank, no strip, no slot, bench slot still
 *   standing, baseline card widths.
 *
 * The flag is flipped ON by route interception only (fulfillFlagsFlank,
 * detective-u10.ts) — the committed flags.json stays false.
 * Screenshots land in the test's own output folder (test-results/).
 */
import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  AuditTrail,
  detectivePlays,
  entryByName,
  fulfillFlagsFlank,
  fulfillFlagsStaging,
  guessByEntryId,
  installDetectiveRecorder,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

test.setTimeout(240_000);

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Open the seam case WITHOUT the speech-unlock taps, so the bench
 * stage (CASE_OPEN, before the questions load) is still on screen. */
async function openCaseOnBench(page: Page, index: number) {
  await page.goto(`${BASE}?loop-puzzle=${index}`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("detective-bench")).toBeVisible({
    timeout: 20_000,
  });
}

/** The u10 gesture-unlock loop: tap the heading until a detective
 * clip actually plays (a tap before the listener arms is missed —
 * under the STAGE cure the listener is armed at player creation,
 * so the first tap lands). */
async function unlockSpeech(page: Page) {
  const heading = page.getByRole("heading", { name: "GeoDetective" });
  const count = async () =>
    (await detectivePlays(page)).filter((u) =>
      u.includes("/audio/detective/"),
    ).length;
  for (let attempt = 0; attempt < 8; attempt++) {
    await heading.click();
    try {
      await expect.poll(count, { timeout: 4_000 }).toBeGreaterThan(0);
      return;
    } catch {
      /* tap again */
    }
  }
  throw new Error("speech never unlocked after 8 verified gesture taps");
}

async function detectiveOnly(page: Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) =>
    u.includes("/audio/detective/"),
  );
}

function countIn(list: string[], needle: string): number {
  return list.filter((u) => u.includes(needle)).length;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0.5 && h > 0.5;
}

type FlankGeometry = {
  innerWidth: number;
  card: Box | null;
  flankMode: string | null;
  holmesRow: Box | null;
  holmesStrip: Box | null;
  watsonStation: Box | null;
  watsonStrip: Box | null;
  strip: Box | null;
  holmesMapCount: number;
  benchCount: number;
  stripSlotCount: number;
};

async function flankGeometry(page: Page, clue: number): Promise<FlankGeometry> {
  return page.evaluate((clueIndex) => {
    const r = (el: Element | null): Box | null => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        width: Math.round(b.width),
        height: Math.round(b.height),
      };
    };
    const flank = document.querySelector('[data-testid="detective-flank"]');
    return {
      innerWidth: window.innerWidth,
      card: r(
        document.querySelector(`article[aria-label^="Clue ${clueIndex}:"]`),
      ),
      flankMode: flank?.getAttribute("data-flank-mode") ?? null,
      holmesRow: r(
        document.querySelector(
          '[data-testid="detective-flank"] [data-detective="holmes"] svg',
        ),
      ),
      holmesStrip: r(
        document.querySelector(
          '[data-testid="detective-flank-strip"] [data-detective="holmes"] svg',
        ),
      ),
      watsonStation: r(
        document.querySelector(
          '[data-testid="detective-station"] [data-detective="watson"] svg',
        ),
      ),
      watsonStrip: r(
        document.querySelector(
          '[data-testid="detective-flank-strip"] [data-detective="watson"] svg',
        ),
      ),
      strip: r(document.querySelector('[data-testid="detective-flank-strip"]')),
      holmesMapCount: document.querySelectorAll(
        '[data-testid="detective-holmes-wrapper"]',
      ).length,
      benchCount: document.querySelectorAll('[data-testid="detective-bench"]')
        .length,
      stripSlotCount: document.querySelectorAll(
        '[data-testid="detective-strip-slot"]',
      ).length,
    };
  }, clue);
}

/** Scroll the active card into view and let the anchor re-measure. */
async function centreCard(page: Page, clue: number) {
  await page.evaluate((clueIndex) => {
    document
      .querySelector(`article[aria-label^="Clue ${clueIndex}:"]`)
      ?.scrollIntoView({ block: "center" });
  }, clue);
  await page.waitForTimeout(700);
}

const WIDTHS = [
  {
    name: "phone 390",
    width: 390,
    height: 844,
    mode: "strip",
    cardX: 20,
    cardW: 350,
    holmesX: 20,
    watsonX: 270,
  },
  {
    name: "tablet 768",
    width: 768,
    height: 1024,
    mode: "row",
    cardX: 88,
    cardW: 562,
    holmesX: 12,
    watsonX: 656,
  },
  {
    name: "desktop 1280",
    width: 1280,
    height: 950,
    mode: "row",
    cardX: 276,
    cardW: 610,
    holmesX: 194,
    watsonX: 892,
  },
] as const;

for (const w of WIDTHS) {
  test(`flank geometry + zero overlap (${w.name})`, async ({
    page,
    context,
  }) => {
    await fulfillFlagsFlank(context);
    await installDetectiveRecorder(context, 3);
    await page.setViewportSize({ width: w.width, height: w.height });
    await openCaseOnBench(page, 137);
    await unlockSpeech(page);
    await waitForSearchIdle(page);
    const trail = new AuditTrail();
    await trail.collect(page, `${w.name} SEARCH_IDLE clue 1`);
    await centreCard(page, 1);
    const g = await flankGeometry(page, 1);
    console.log(`[flank ${w.name}] ${JSON.stringify(g)}`);
    expect(g.card).not.toBeNull();
    // Dock stand-down: no Holmes on the map; bench gone (flank
    // engaged); the slot exists (flag on) even in row mode.
    expect(g.holmesMapCount).toBe(0);
    expect(g.benchCount).toBe(0);
    expect(g.stripSlotCount).toBe(1);
    // Card geometry (tolerance ±2 px for rounding).
    expect(Math.abs(g.card!.x - w.cardX)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.card!.width - w.cardW)).toBeLessThanOrEqual(2);
    if (w.mode === "row") {
      expect(g.flankMode).toBe("row");
      expect(g.strip).toBeNull();
      expect(g.holmesRow).not.toBeNull();
      expect(g.watsonStation).not.toBeNull();
      expect(Math.abs(g.holmesRow!.x - w.holmesX)).toBeLessThanOrEqual(2);
      expect(g.holmesRow!.width).toBe(70);
      expect(g.holmesRow!.height).toBe(104);
      expect(Math.abs(g.watsonStation!.x - w.watsonX)).toBeLessThanOrEqual(2);
      expect(g.watsonStation!.width).toBe(100);
      // Gaps ≥ 6 px to each figure; Holmes vertically centred
      // on the card, like Watson's station.
      expect(g.card!.x - (g.holmesRow!.x + g.holmesRow!.width)).toBeGreaterThanOrEqual(6);
      expect(g.watsonStation!.x - (g.card!.x + g.card!.width)).toBeGreaterThanOrEqual(6);
      const holmesCentre = g.holmesRow!.y + g.holmesRow!.height / 2;
      const cardCentre = g.card!.y + g.card!.height / 2;
      expect(Math.abs(holmesCentre - cardCentre)).toBeLessThanOrEqual(2);
    } else {
      expect(g.flankMode).toBeNull();
      expect(g.strip).not.toBeNull();
      expect(g.holmesStrip).not.toBeNull();
      expect(g.watsonStrip).not.toBeNull();
      expect(g.watsonStation).toBeNull();
      expect(Math.abs(g.holmesStrip!.x - w.holmesX)).toBeLessThanOrEqual(2);
      expect(g.holmesStrip!.width).toBe(70);
      expect(Math.abs(g.watsonStrip!.x - w.watsonX)).toBeLessThanOrEqual(2);
      expect(g.watsonStrip!.width).toBe(100);
      // The strip stands above the card with clear air between.
      expect(g.card!.y - (g.strip!.y + g.strip!.height)).toBeGreaterThanOrEqual(8);
      // Strip spans the card width: Holmes at its left end,
      // Watson at its right end.
      expect(Math.abs(g.strip!.x - g.card!.x)).toBeLessThanOrEqual(2);
      expect(
        Math.abs(g.strip!.x + g.strip!.width - (g.card!.x + g.card!.width)),
      ).toBeLessThanOrEqual(2);
    }
    await page.screenshot({ path: test.info().outputPath(`flank-${w.width}.png`) });
    console.log(
      `[flank ${w.name}] geometry OK, overlap 0 px² over ${trail.samples} pair samples`,
    );

    // 390 only: a wrong guess deals clue 2 — the strip moves
    // above it and still covers no clue text (the in-flow proof).
    if (w.width === 390) {
      await guessByEntryId(page, entryByName("las vegas").id, "las vegas");
      await waitForSearchIdle(page, 120_000);
      await trail.collect(page, "phone 390 SEARCH_IDLE clue 2");
      await centreCard(page, 2);
      const g2 = await flankGeometry(page, 2);
      console.log(`[flank phone 390 clue 2] ${JSON.stringify(g2)}`);
      expect(g2.card).not.toBeNull();
      expect(g2.strip).not.toBeNull();
      expect(Math.abs(g2.card!.x - 20)).toBeLessThanOrEqual(2);
      expect(Math.abs(g2.card!.width - 350)).toBeLessThanOrEqual(2);
      expect(g2.card!.y - (g2.strip!.y + g2.strip!.height)).toBeGreaterThanOrEqual(8);
      expect(g2.holmesMapCount).toBe(0);
      await page.screenshot({ path: test.info().outputPath(`flank-390-clue2.png`) });
      console.log(
        `[flank phone 390] clue-2 strip OK, overlap 0 px² over ${trail.samples} pair samples`,
      );
    }
  });
}

// Retired by the owner, 2026-11-10: the pair no longer vanishes while the sheet is up, there is no Listen chip or pair speaker chip, and a tap on Holmes repeats the line (the one mute is the screen's top-left toggle). Superseded by detective-owner-spec.spec.ts.
test.skip("Listen first tap plays the held clue sequence (tap mode, 390)", async ({
  page,
  context,
}) => {
  // Force the tap row of the degradation matrix the way the shipped
  // specs seed the kid's preference: read-aloud "never" vetoes
  // autoplay, so speech is tap-to-play and the Listen button shows.
  await context.addInitScript((v: string) => {
    localStorage.setItem(
      "meridian.readAloudPref.v1",
      JSON.stringify({
        schemaVersion: 1,
        value: v,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, "never");
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsFlank(context);
  await page.setViewportSize({ width: 390, height: 844 });
  // The Listen tap below is the FIRST post-mount gesture: no
  // heading unlock taps, no other clicks — the "Solve a mystery"
  // click lands before the host (and its player) mounts.
  await page.goto(`${BASE}?loop-puzzle=137`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });
  const listenButton = page.getByRole("button", {
    name: "Listen to this clue",
  });
  await expect(listenButton).toBeVisible({ timeout: 30_000 });
  // The strip is up and Listen rides in its middle.
  const stripBox = await page
    .getByTestId("detective-flank-strip")
    .boundingBox();
  expect(stripBox).not.toBeNull();
  const listenBox = await listenButton.boundingBox();
  expect(listenBox).not.toBeNull();
  expect(listenBox!.x).toBeGreaterThanOrEqual(stripBox!.x + 70);
  expect(listenBox!.x + listenBox!.width).toBeLessThanOrEqual(
    stripBox!.x + stripBox!.width - 100,
  );
  // ONE tap. Before the cure this tap only armed the gesture
  // listener and nothing played until a second tap.
  await listenButton.click();
  await expect
    .poll(async () => countIn(await detectiveOnly(page), "case-137/clue-1.mp3"), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(async () => countIn(await detectiveOnly(page), "fixed/ack-"), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);
  console.log(
    `[flank listen] ONE tap played the held clue-1 sequence (clue + ack); watchdogSeeks=${await watchdogSeeks(page)}`,
  );

  // Strip controls stay pairwise separate at 390 (the sound-spec
  // (f) geometry guarantee, in the strip layout): Listen, chip,
  // Holmes-mute — each fully inside the viewport, ≥44 px.
  const chipBox = await page.getByTestId("detective-sound-chip").boundingBox();
  const muteBox = await page
    .getByTestId("detective-holmes-mute")
    .boundingBox();
  expect(chipBox).not.toBeNull();
  expect(muteBox).not.toBeNull();
  const listen = await page.getByTestId("detective-listen").boundingBox();
  expect(listen).not.toBeNull();
  expect(boxesOverlap(listen!, chipBox!)).toBe(false);
  expect(boxesOverlap(listen!, muteBox!)).toBe(false);
  expect(boxesOverlap(chipBox!, muteBox!)).toBe(false);
  for (const b of [listen!, chipBox!, muteBox!]) {
    expect(b.x).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: test.info().outputPath(`flank-390-tap-listen.png`) });
  console.log("[flank listen] strip controls pairwise separate at 390px");
});

for (const w of WIDTHS) {
  test(`flag-off run is today's behaviour (${w.name})`, async ({
    page,
    context,
  }) => {
    await fulfillFlagsStaging(context);
    await installDetectiveRecorder(context, 3);
    await page.setViewportSize({ width: w.width, height: w.height });
    await openCaseOnBench(page, 137);
    await unlockSpeech(page);
    await waitForSearchIdle(page);
    const g = await flankGeometry(page, 1);
    console.log(`[flank-off ${w.name}] ${JSON.stringify(g)}`);
    // No flank, no strip, no slot — and the bench slot still
    // stands (no map interaction yet, exactly as shipped).
    expect(g.flankMode).toBeNull();
    expect(g.strip).toBeNull();
    expect(g.holmesStrip).toBeNull();
    expect(g.holmesRow).toBeNull();
    expect(g.stripSlotCount).toBe(0);
    expect(g.benchCount).toBe(1);
    // Baseline card widths (measured pre-change).
    const cardW = w.width === 390 ? 232 : 610;
    expect(g.card).not.toBeNull();
    expect(Math.abs(g.card!.width - cardW)).toBeLessThanOrEqual(2);
    expect(g.watsonStation).not.toBeNull();
    const watsonX = w.width === 390 ? 258 : w.width === 768 ? 636 : 892;
    expect(Math.abs(g.watsonStation!.x - watsonX)).toBeLessThanOrEqual(2);
    console.log(`[flank-off ${w.name}] today's behaviour unchanged`);
  });
}
