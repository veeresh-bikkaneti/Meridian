import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";
import {
  assertSubsequence,
  collectAudioRequests,
  detectivePlays,
  fulfillFlagsOn,
  installDetectiveRecorder,
  watchdogSeeks,
} from "./detective-u10";

/**
 * Detective stations gate (U10, BUILD-SCOPE §2.4 / §5): Watson stands
 * AT the active clue card and the opening speech chain fires in the
 * authored order, on a real Capitals case reached through the real
 * path — home → GeoDetective → the Capitals shelf chip → the case.
 *
 * The pack manifest is stubbed down to a single case (387, Abu Dhabi —
 * the capitals-flags.mobile.spec.ts pattern) so the dealt pack case is
 * deterministic; its clue file and audio are the real shipped ones.
 * Any pack case would do — all 110 carry full audio — the stub exists
 * so the order assertions can name the exact files.
 *
 * Order is asserted on the NETWORK log (every detective mp3 request,
 * in issue order) and cross-checked on the play() record. Watson's
 * station adjacency is asserted on live DOM rects while clue 1 plays.
 */

test.setTimeout(240_000);

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

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installDetectiveRecorder(context, 3);
});

test("Capitals case via the shelf: duet → clue 1 → ack → decode, Watson at the card", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  const requests = collectAudioRequests(page);
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SINGLE_CASE_MANIFEST),
    });
  });
  // Seed a finished core case (the pack-shelf pattern): the reveal's
  // shelf is where a chip tap starts the next case at once.
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
              { name: "Ankara", placeId, distKm: 0, octant: "north", warmer: null },
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
  await expect(page.getByTestId("pack-shelf-status")).toHaveText(
    "Tap a deck chip to start your next case.",
  );
  await page.getByTestId("pack-chip-capitals").click();
  await expect(
    page.getByText("Your case: find the capital of United Arab Emirates."),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });

  // The pair mounts at the station for the fresh deal.
  const station = page.getByTestId("detective-station");
  await expect(station).toBeVisible({ timeout: 20_000 });
  // First gesture for the speech unlock (U5/U9 pattern).
  await page.getByRole("heading", { name: "GeoDetective" }).click();

  // --- speech order: duet → clue 1 → ack → decode-geography --------
  const needles = [
    "fixed/instructions-holmes.mp3",
    "fixed/instructions-watson.mp3",
    "case-387/clue-1.mp3",
    "fixed/ack-1.mp3",
    "fixed/decode-geography.mp3",
  ];
  await expect
    .poll(() => detectivePlays(page), { timeout: 90_000 })
    .toEqual(expect.arrayContaining(needles.map((n) => expect.stringContaining(n))));
  const plays = await detectivePlays(page);
  const playIdx = assertSubsequence(plays, needles);
  // The network log must tell the same story, in the same order.
  await expect
    .poll(() => requests.length, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(needles.length);
  const netIdx = assertSubsequence(requests, needles);
  console.log(
    `[stations] play order idx=${playIdx.join(",")} network order idx=${netIdx.join(",")} watchdogSeeks=${await watchdogSeeks(page)}`,
  );

  // --- Watson's station sits at the active clue card ---------------
  // Measure while the station is mounted (clue phases keep it up).
  const geo = await page.evaluate(() => {
    const stationEl = document.querySelector('[data-testid="detective-station"]');
    const card = document.querySelector('article[aria-label^="Clue 1:"]');
    if (!stationEl || !card) return null;
    const s = stationEl.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const overlapX = Math.max(0, Math.min(s.right, c.right) - Math.max(s.left, c.left));
    const overlapY = Math.max(0, Math.min(s.bottom, c.bottom) - Math.max(s.top, c.top));
    const dx = Math.max(c.left - s.right, s.left - c.right, 0);
    const dy = Math.max(c.top - s.bottom, s.top - c.bottom, 0);
    return {
      station: { left: s.left, top: s.top, right: s.right, bottom: s.bottom },
      card: { left: c.left, top: c.top, right: c.right, bottom: c.bottom },
      gap: Math.hypot(dx, dy),
      overlapArea: overlapX * overlapY,
    };
  });
  expect(geo).not.toBeNull();
  console.log(`[stations] station/card geometry=${JSON.stringify(geo)}`);
  // Within ~120 px of the card…
  expect(geo!.gap).toBeLessThanOrEqual(120);
  // …and never over the card's text box.
  expect(geo!.overlapArea).toBe(0);
});
