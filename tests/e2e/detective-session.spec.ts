import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  BASE,
  assertSubsequence,
  currentPhase,
  detectivePlays,
  entryByName,
  fulfillFlagsFlank,
  fulfillFlagsWalk,
  installDetectiveRecorder,
  waitForPhase,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

/**
 * PR 2b gate — session + moments, played in the owner's shape.
 *
 * (tap WIN / tap LOSS) The named gap, closed: in tap mode (read-
 * aloud "sometimes", band 8–10, sound on, flank on) the ending
 * lines are HELD, never played silently past the kid — the result
 * card carries a "Listen to the ending" button that releases the
 * whole burst (win lines + debrief / answer + truce exchange).
 * Negative first: before that tap, none of the ending clips may
 * appear in the play record at all.
 *
 * (session) One tab visit = one full opening: bench + duet +
 * announcement at the session's first case only. Case 2 opens
 * quietly — no bench, no duet, no second announcement — with a
 * "Case 2" stamp.
 *
 * (staging) With production flags (staging + walk, flank OFF), a
 * case played without ever touching the map still completes its
 * staging — in tap mode (item 5) and with sound OFF (the muted
 * trap): the bench never stands mid-case.
 *
 * Speech is observed on the harness's play() record (detective-
 * u10); phases/stages on the host roots' data attributes.
 */

test.setTimeout(600_000);

const CASE = 137; // Henderson, Nevada — the seam case.
const ANSWER_ID = "geonames:5505411";

async function seedOwnerPref(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    localStorage.setItem(
      "meridian.readAloudPref.v1",
      JSON.stringify({
        schemaVersion: 1,
        value: "sometimes",
        updatedAt: new Date().toISOString(),
      }),
    );
  });
}

async function detectiveOnly(page: Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) =>
    u.includes("/audio/detective/"),
  );
}

async function playCount(page: Page, clipPart: string): Promise<number> {
  return (await detectiveOnly(page)).filter((u) => u.includes(clipPart))
    .length;
}

async function openCase(page: Page, index: number): Promise<void> {
  await page.goto(`${BASE}?loop-puzzle=${index}`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(page.getByRole("article", { name: /Clue 1:/ })).toBeVisible({
    timeout: 30_000,
  });
}

/** Open the seam case in flank mode and wait out the bench. */
async function openTapCase(page: Page, index: number): Promise<void> {
  await openCase(page, index);
  await expect(page.getByTestId("detective-bench")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("detective-bench")).toHaveCount(0, {
    timeout: 60_000,
  });
}

async function releaseHeldClue(page: Page, clueClip: string): Promise<void> {
  const listen = page
    .getByRole("button", { name: "Listen to this clue" })
    .first();
  await expect(listen).toBeVisible({ timeout: 30_000 });
  await listen.click();
  await expect
    .poll(async () => (await playCount(page, clueClip)) > 0, {
      timeout: 45_000,
    })
    .toBe(true);
}

/** Pick through the jump search and confirm the guess in the sheet. */
async function guess(page: Page, entryId: string, query: string): Promise<void> {
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill(query);
  const option = page.locator(
    `li[role="option"][data-entry-id="${entryId}"]`,
  );
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

async function stagingStage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="detective-station"]');
    return el?.getAttribute("data-staging") ?? null;
  });
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/* ------------------------------------------------------------------ */
/* Tap-mode endings (item 1)                                           */
/* ------------------------------------------------------------------ */

test("(tap WIN) solve in 2: the ending is held, then released whole by the ending Listen", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  // Mid-case, no ending Listen exists.
  expect(await page.getByTestId("detective-ending-listen").count()).toBe(0);
  await releaseHeldClue(page, `case-${CASE}/clue-1.mp3`);

  const lasVegas = entryByName("las vegas");
  await guess(page, lasVegas.id, "las vegas");
  await expect(page.getByText(/Guess 2 of/).first()).toBeVisible({
    timeout: 30_000,
  });
  await waitForPhase(page, "SEARCH_IDLE", 60_000);
  await releaseHeldClue(page, `case-${CASE}/clue-2.mp3`);

  await guess(page, ANSWER_ID, "henderson");
  await waitForPhase(page, "CELEBRATE", 60_000);

  // NEGATIVE: every ending line is held — none has played.
  const heldPlays = await detectiveOnly(page);
  for (const clip of [
    "fixed/win-holmes.mp3",
    "fixed/win-watson.mp3",
    "fixed/debrief-frame.mp3",
    "names/5505411.mp3",
    "fixed/debrief-close.mp3",
  ]) {
    expect(
      heldPlays.some((u) => u.includes(clip)),
      `before the ending Listen tap, ${clip} must be held, not played`,
    ).toBe(false);
  }

  // The release surface is on the result card; one tap plays the
  // whole burst in order.
  const endingListen = page.getByRole("button", {
    name: "Listen to the ending",
  });
  await expect(endingListen).toBeVisible({ timeout: 30_000 });
  await endingListen.click();
  await expect
    .poll(async () => await detectiveOnly(page), { timeout: 60_000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringContaining("fixed/debrief-close.mp3"),
      ]),
    );
  const plays = await detectiveOnly(page);
  assertSubsequence(plays, [
    "fixed/win-holmes.mp3",
    "fixed/win-watson.mp3",
    "fixed/debrief-frame.mp3",
    "names/5505411.mp3",
    "fixed/debrief-close.mp3",
  ]);
  expect(await watchdogSeeks(page)).toBe(0);
  console.log("[session tap WIN] ending held, then released whole");
});

test("(tap LOSS) five misses: the answer + truce are held, then released by the ending Listen", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  const misses = ["las vegas", "paris", "tokyo", "sydney", "cairo"];
  for (let i = 0; i < misses.length; i++) {
    await releaseHeldClue(page, `case-${CASE}/clue-${i + 1}.mp3`);
    const entry = entryByName(misses[i]!);
    await guess(page, entry.id, misses[i]!);
    if (i < misses.length - 1) {
      await expect(
        page.getByText(new RegExp(`Guess ${i + 2} of`)).first(),
      ).toBeVisible({ timeout: 30_000 });
      await waitForPhase(page, "SEARCH_IDLE", 60_000);
    }
  }
  await waitForPhase(page, "TRUCE", 90_000);

  // NEGATIVE: the answer read and both truce lines are held.
  const heldPlays = await detectiveOnly(page);
  expect(
    heldPlays.some((u) => u.includes(`case-${CASE}/answer.mp3`)),
    "the answer read must be held, not silently skipped",
  ).toBe(false);
  expect(
    heldPlays.some((u) => u.includes("fixed/truce-")),
    "no truce line may play before the ending Listen tap",
  ).toBe(false);

  const endingListen = page.getByRole("button", {
    name: "Listen to the ending",
  });
  await expect(endingListen).toBeVisible({ timeout: 30_000 });
  await endingListen.click();
  await expect
    .poll(async () => await detectiveOnly(page), { timeout: 60_000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/fixed\/truce-holmes-\d\.mp3/),
      ]),
    );
  const plays = await detectiveOnly(page);
  assertSubsequence(plays, [
    `case-${CASE}/answer.mp3`,
    "fixed/truce-watson-",
    "fixed/truce-holmes-",
  ]);
  // The case stays closed and at rest after the release.
  expect(await currentPhase(page)).toBe("TRUCE");
  expect(await watchdogSeeks(page)).toBe(0);
  console.log("[session tap LOSS] answer + truce held, then released");
});

test("(tap WIN 1280) solve at guess 3: celebrates, and the ending Listen releases", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 1280, height: 800 });

  await openTapCase(page, CASE);
  const misses = ["las vegas", "paris"];
  for (let i = 0; i < misses.length; i++) {
    await releaseHeldClue(page, `case-${CASE}/clue-${i + 1}.mp3`);
    const entry = entryByName(misses[i]!);
    await guess(page, entry.id, misses[i]!);
    await expect(
      page.getByText(new RegExp(`Guess ${i + 2} of`)).first(),
    ).toBeVisible({ timeout: 30_000 });
    await waitForPhase(page, "SEARCH_IDLE", 60_000);
  }
  await releaseHeldClue(page, `case-${CASE}/clue-3.mp3`);
  await guess(page, ANSWER_ID, "henderson");
  await waitForPhase(page, "CELEBRATE", 60_000);
  const endingListen = page.getByRole("button", {
    name: "Listen to the ending",
  });
  await expect(endingListen).toBeVisible({ timeout: 30_000 });
  await endingListen.click();
  await expect
    .poll(async () => (await playCount(page, "fixed/win-holmes.mp3")) > 0, {
      timeout: 60_000,
    })
    .toBe(true);
  console.log("[session tap WIN 1280] solve-at-3 celebrated + released");
});

test("(reactions OFF) tap-mode loss: nothing is held and no ending Listen is offered", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  // The flank flag shape with the pairReactions kill-switch OFF.
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair: true,
          hostsStaging: true,
          watsonWalk: true,
          detectiveFlank: true,
          pairReactions: false,
        },
      }),
    });
  });
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  const misses = ["las vegas", "paris", "tokyo", "sydney", "cairo"];
  for (let i = 0; i < misses.length; i++) {
    await releaseHeldClue(page, `case-${CASE}/clue-${i + 1}.mp3`);
    const entry = entryByName(misses[i]!);
    await guess(page, entry.id, misses[i]!);
    if (i < misses.length - 1) {
      await expect(
        page.getByText(new RegExp(`Guess ${i + 2} of`)).first(),
      ).toBeVisible({ timeout: 30_000 });
      await waitForPhase(page, "SEARCH_IDLE", 60_000);
    }
  }
  await waitForPhase(page, "TRUCE", 90_000);
  await page.waitForTimeout(2_000);
  // The shipped behaviour with the switch off: the case rests
  // silently and there is nothing to release.
  expect(await page.getByTestId("detective-ending-listen").count()).toBe(0);
  expect(await playCount(page, "fixed/truce-")).toBe(0);
  console.log("[session reactions OFF] silent rest, no ending Listen");
});

/* ------------------------------------------------------------------ */
/* Session gating (item 2)                                             */
/* ------------------------------------------------------------------ */

test("(session) bench + duet + announcement once; case 2 opens quiet with a stamp", async ({
  page,
  context,
}) => {
  await fulfillFlagsWalk(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  // Case 1 of the session: the full opening.
  await openCase(page, CASE);
  await expect(page.getByTestId("detective-bench")).toBeVisible({
    timeout: 20_000,
  });
  await waitForSearchIdle(page, 120_000);
  expect(await playCount(page, "fixed/instructions-holmes.mp3")).toBe(1);
  expect(await playCount(page, "fixed/instructions-watson.mp3")).toBe(1);
  expect(await playCount(page, "fixed/lets-find-clues.mp3")).toBe(1);
  // No stamp on the session's first case.
  expect(await page.getByTestId("detective-case-stamp").count()).toBe(0);

  // Win it and move on.
  await guess(page, ANSWER_ID, "henderson");
  await waitForPhase(page, "CELEBRATE", 60_000);
  await page
    .getByRole("button", { name: /Next mystery/ })
    .click({ timeout: 30_000 });

  // Case 2: the stamp shows the session's second case…
  await expect(page.getByTestId("detective-case-stamp")).toBeVisible({
    timeout: 30_000,
  });
  expect(
    await page.getByTestId("detective-case-stamp").textContent(),
  ).toContain("Case 2");
  // …and the opening stays quiet: no bench at any sampled moment,
  // no second duet, no second announcement.
  const benchSamples: boolean[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 5_000) {
    benchSamples.push((await page.getByTestId("detective-bench").count()) > 0);
    await page.waitForTimeout(250);
  }
  expect(benchSamples.every((b) => !b)).toBe(true);
  await waitForSearchIdle(page, 120_000);
  expect(await playCount(page, "fixed/instructions-holmes.mp3")).toBe(1);
  expect(await playCount(page, "fixed/instructions-watson.mp3")).toBe(1);
  expect(await playCount(page, "fixed/lets-find-clues.mp3")).toBe(1);
  console.log("[session] case 2 quiet + stamped; duet/announcement stayed at 1");
});

/* ------------------------------------------------------------------ */
/* Staging completion (item 5)                                         */
/* ------------------------------------------------------------------ */

test("(tap staging) search-box play with no map touch: staging completes mid-case", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await fulfillFlagsWalk(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openCase(page, CASE);
  await expect(page.getByTestId("detective-bench")).toBeVisible({
    timeout: 20_000,
  });
  await releaseHeldClue(page, `case-${CASE}/clue-1.mp3`);
  const lasVegas = entryByName("las vegas");
  await guess(page, lasVegas.id, "las vegas");
  await waitForPhase(page, "SEARCH_IDLE", 60_000);
  // The cure: the stage reaches "gone" and the bench unmounts while
  // the case is still being played — Holmes is on the map, not
  // standing in the slot reading as "case over".
  await expect
    .poll(() => stagingStage(page), { timeout: 30_000 })
    .toBe("gone");
  expect(await page.getByTestId("detective-bench").count()).toBe(0);
  console.log("[session tap staging] stage gone mid-case, bench unmounted");
});

test("(muted) sound off: CASE_OPEN exits and staging completes silently", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem("meridian.sound", "off");
  });
  await fulfillFlagsWalk(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openCase(page, CASE);
  // The muted trap, cured: the ladder leaves CASE_OPEN on its own…
  await waitForPhase(page, "SEARCH_IDLE", 60_000);
  // …and staging completes with no map interaction and no sound.
  await expect
    .poll(() => stagingStage(page), { timeout: 30_000 })
    .toBe("gone");
  expect(await page.getByTestId("detective-bench").count()).toBe(0);
  expect(await detectiveOnly(page)).toEqual([]);
  console.log("[session muted] ladder + staging completed, zero plays");
});
