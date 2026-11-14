import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  ACK_POOL,
  BASE,
  detectivePlays,
  entryByName,
  fulfillFlagsFlank,
  installDetectiveRecorder,
  watchdogSeeks,
} from "./detective-u10";

/**
 * PR 2a cure 3 — the tap-mode silent guess, pinned at the PLAYED level.
 *
 * The defect (Game Player BLOCK, twice; host hunt HOST-HUNT.md): in
 * TAP MODE — the owner's own configuration, read-aloud preference
 * "sometimes", so clue reads are held until the kid taps Listen — a
 * guess confirmed after Holmes has named the pick gets NO spoken
 * reaction. The guess commits (marker, counter, next clue card) and
 * the case moves on in silence, in BOTH confirm windows: while the
 * name clip is still playing, and in the first instant after it
 * ends. The auto-mode specs (detective-selection-read.spec.ts) pass
 * the same beats because there the guess is spent inside the pick
 * read's own ladder step; in tap mode the Listen-released chain has
 * already drained, so the confirm arrives as a fresh spend at a
 * resting machine — the path this spec exercises and no other spec
 * did.
 *
 * Both tests seed the owner's preference BEFORE first load, run the
 * flank layout at 390 px, release the held clue chain with ONE
 * Listen tap (as a player does), then:
 *
 * - (during) pick Las Vegas and tap "Guess this place" while the
 *   name clip is still playing → `fixed/suspicion.mp3` must play,
 *   the name must have been read exactly once, the case must show
 *   Guess 2, and clue 2's chain must be the one Listen releases
 *   next (the case continued).
 * - (after) pick Paris, wait for the name element's own `ended`
 *   flag, tap "Guess this place" in the next breath → the same
 *   assertions.
 *
 * Speech is observed on the harness's play() record (detective-u10),
 * never on DOM state alone. The sandbox proves the play path
 * executes; it cannot prove audible sound. Pre-cure, both tests fail
 * on the suspicion assertion — the reaction is never even attempted
 * in tap mode (see the cure-3 capsule in BRANCH_STATUS.md).
 */

test.setTimeout(600_000);

const CASE = 137; // Henderson, Nevada — the seam case.

/** The owner's read-aloud preference, seeded before first load (the
 * Game Player's seed): "sometimes" puts the surface in tap mode. */
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

/** Open the seam case in flank mode and wait out the bench — the
 * host hunt's proven tap-mode entry (the station-root opener cannot
 * be used: in flank mode that root is display:none). */
async function openTapCase(page: Page, index: number): Promise<void> {
  // Set before navigation so it survives any page load on the way in.
  await page.addInitScript(() => {
    const w = window as unknown as { __benchSeen?: boolean };
    w.__benchSeen = false;
    const obs = new MutationObserver(() => {
      if (document.querySelector('[data-testid="detective-bench"]')) {
        w.__benchSeen = true;
        obs.disconnect();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
  await page.goto(`${BASE}?loop-puzzle=${index}`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });
  // This spec is about the pick read, not the intro: give the bench a
  // moment to show (a page-side flag catches even a brief showing),
  // then wait until it is gone. A case that opens without the bench
  // goes straight on.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __benchSeen?: boolean }).__benchSeen === true,
        ),
      { timeout: 8_000 },
    )
    .toBe(true)
    .catch(() => undefined);
  await expect(page.getByTestId("detective-bench")).toHaveCount(0, {
    timeout: 60_000,
  });
}

/** One tap on Watson releases the held chain for the current clue
 * (the Listen chip is retired: owner, 2026-11-10, "tapping on
 * character will repeat the line"); assert that clue's read played. */
async function releaseHeldClue(page: Page, clueClip: string): Promise<void> {
  const watson = page.getByTestId("detective-watson-replay").first();
  await expect(watson).toBeVisible({ timeout: 30_000 });
  await watson.click();
  await expect
    .poll(async () => (await playCount(page, clueClip)) > 0, {
      timeout: 45_000,
    })
    .toBe(true);
}

/** Pick a place through the jump search and STOP at the sheet — no
 * guess spent yet (mirrors detective-selection-read.spec.ts). */
async function pickOnly(page: Page, entryId: string, query: string) {
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill(query);
  const option = page.locator(
    `li[role="option"][data-entry-id="${entryId}"]`,
  );
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
}

/** The assertions both confirm windows share: the reaction played,
 * the pick was named exactly once, the guess counted, and the case
 * continued — clue 2's chain is what Listen releases next. */
async function expectReactionAndContinuation(
  page: Page,
  nameClip: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const plays = await detectiveOnly(page);
      const nameAt = plays.findIndex((u) => u.includes(nameClip));
      if (nameAt < 0) return false;
      return plays.slice(nameAt + 1).some((u) => ACK_POOL.test(u));
    }, { timeout: 30_000 })
    .toBe(true);
  expect(await playCount(page, nameClip)).toBe(1);
  await expect(page.getByText(/Guess 2 of/).first()).toBeVisible({
    timeout: 30_000,
  });
  // Tap mode holds the next clue's read until Listen, so the ladder
  // stays on that read instead of resting in SEARCH_IDLE.
  await expect(page.getByRole("article", { name: /^Clue 2: Climate$/ })).toBeVisible({
    timeout: 60_000,
  });
  await releaseHeldClue(page, `case-${CASE}/clue-2.mp3`);
  expect(await watchdogSeeks(page)).toBe(0);
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("(during) tap mode: a guess confirmed while the pick's name is still playing keeps its spoken reaction", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  await releaseHeldClue(page, `case-${CASE}/clue-1.mp3`);

  const lasVegas = entryByName("las vegas");
  const NAME_CLIP = "names/5506956.mp3"; // Las Vegas — has a clip.
  await pickOnly(page, lasVegas.id, "las vegas");

  // The name read has STARTED (its play() is on the record) — confirm
  // in the same breath, while the clip is still playing.
  await expect
    .poll(async () => (await playCount(page, NAME_CLIP)) > 0, {
      timeout: 45_000,
    })
    .toBe(true);
  await page.getByRole("button", { name: "Guess this place" }).click();

  await expectReactionAndContinuation(page, NAME_CLIP);
});

test("(after) tap mode: a guess confirmed just after the pick's name ends keeps its spoken reaction", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  await releaseHeldClue(page, `case-${CASE}/clue-1.mp3`);

  const paris = entryByName("paris");
  const NAME_CLIP = "names/2988507.mp3"; // Paris — has a clip.
  await pickOnly(page, paris.id, "paris");

  // Wait for the name clip to fully end — the tracked element's own
  // `ended` flag, the same signal the player's queue drains on (no
  // fixed sleep) — then confirm in the next breath. This is the Game
  // Player's blocked timing.
  await expect
    .poll(
      async () =>
        page.evaluate((clip) => {
          const w = window as unknown as {
            __detectiveAudios?: HTMLMediaElement[];
          };
          const el = (w.__detectiveAudios ?? []).find((a) =>
            (a.currentSrc || a.src || "").includes(clip),
          );
          return el ? el.ended : false;
        }, NAME_CLIP),
      { timeout: 90_000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "Guess this place" }).click();

  await expectReactionAndContinuation(page, NAME_CLIP);
});

test("tap mode: opening cards stay shut past the clue watchdog until Watson is heard", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await context.addInitScript(() => {
    localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: "7-10",
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 2,
      }),
    );
  });
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  await expect(page.getByRole("article", { name: /^Clue 1: Geography$/ })).toBeVisible();
  await expect(page.getByRole("article", { name: "Clue 2: Climate (locked)" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Clue 3: History (locked)" })).toBeVisible();

  // Past CLUE_PRESENT_WATCHDOG_MS (30s). The opening must still be one card.
  await page.waitForTimeout(32_000);
  await expect(page.getByRole("article", { name: /^Clue 1: Geography$/ })).toBeVisible();
  await expect(page.getByRole("article", { name: "Clue 2: Climate (locked)" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Clue 3: History (locked)" })).toBeVisible();

  await releaseHeldClue(page, `case-${CASE}/clue-1.mp3`);
  await expect(page.getByRole("article", { name: /^Clue 2: Climate$/ })).toBeVisible({
    timeout: 120_000,
  });
});

/** The 7-10 band, tap mode (the Watson read waits for a tap). */
async function seedBand710(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: "7-10",
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 2,
      }),
    );
  });
}

/** Clue cards that are open (not "(locked)"), by their article names. */
async function openClueNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('article[aria-label^="Clue"]'))
      .map((el) => el.getAttribute("aria-label") ?? "")
      .filter((name) => !name.includes("(locked)")),
  );
}

test("tap mode, 7-10: past the clue watchdog after a wrong first guess, no extra card opens", async ({
  page,
  context,
}) => {
  await seedOwnerPref(context);
  await seedBand710(context);
  await fulfillFlagsFlank(context);
  await installDetectiveRecorder(context);
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  await expect(page.getByRole("article", { name: /^Clue 1: Geography$/ })).toBeVisible();

  // A wrong first guess (the case is Henderson, Nevada).
  const paris = entryByName("paris");
  await pickOnly(page, paris.id, "paris");
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText(/Guess 2 of/).first()).toBeVisible({ timeout: 30_000 });

  // The ladder presents the new clue 4 on its own turn.
  await expect(page.getByRole("article", { name: /^Clue 4: The Hook$/ })).toBeVisible({
    timeout: 60_000,
  });
  const before = await openClueNames(page);
  expect(before.length).toBeLessThanOrEqual(4);

  // Past CLUE_PRESENT_WATCHDOG_MS (30 s) with Watson's read still waiting
  // for a tap: that wait is not a stall, so the watchdog adds nothing.
  await page.waitForTimeout(32_000);
  expect(await openClueNames(page)).toEqual(before);
});

test("tap mode: tap Watson, then pick a place while he is still reading — never two voices at once", async ({
  page,
  context,
}, testInfo) => {
  await seedOwnerPref(context);
  await fulfillFlagsFlank(context);
  // Real-time playback (rate 1) so Watson is still reading at the pick.
  await installDetectiveRecorder(context, 1);
  await context.addInitScript(() => {
    const w = window as unknown as {
      __voiceMax: number;
      __voiceOverlap: Array<{ started: string; others: string[] }>;
      __watsonCutAtPick?: boolean;
      __detectiveAudios?: HTMLMediaElement[];
    };
    w.__voiceMax = 0;
    w.__voiceOverlap = [];
    // At every speech start, count the OTHER clips still sounding.
    document.addEventListener(
      "play",
      (e) => {
        const startedEl = e.target as HTMLMediaElement;
        const started = startedEl.currentSrc || startedEl.src || "";
        const others = (w.__detectiveAudios ?? []).filter(
          (a) => a !== startedEl && !a.paused && !a.ended,
        );
        w.__voiceOverlap.push({
          started,
          others: others.map((a) => a.currentSrc || a.src || ""),
        });
        // Voice clips live under case-*/ and names/. Home-screen
        // films and sfx can overlap; they must not count as voices.
        const isVoice = (src: string) =>
          /\/names\//.test(src) || /\/case-\d+\//.test(src);
        const voiceOthers = others.filter((a) =>
          isVoice(a.currentSrc || a.src || ""),
        );
        const voiceCount = (isVoice(started) ? 1 : 0) + voiceOthers.length;
        w.__voiceMax = Math.max(w.__voiceMax, voiceCount);
      },
      true,
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });

  await openTapCase(page, CASE);
  await releaseHeldClue(page, `case-${CASE}/clue-1.mp3`);

  const lasVegas = entryByName("las vegas");
  const NAME_CLIP = "names/5506956.mp3";
  await pickOnly(page, lasVegas.id, "las vegas");
  await expect
    .poll(async () => (await playCount(page, NAME_CLIP)) > 0, { timeout: 45_000 })
    .toBe(true);

  // Watson's clip was cut for Holmes (paused or already finished), and at
  // no speech start were two clips sounding.
  const watsonSounding = await page.evaluate(() => {
    const w = window as unknown as { __detectiveAudios?: HTMLMediaElement[] };
    return (w.__detectiveAudios ?? []).some(
      (a) => (a.currentSrc || a.src).includes("/clue-") && !a.paused && !a.ended,
    );
  });
  expect(watsonSounding).toBe(false);
  const voice = await page.evaluate(() => {
    const w = window as unknown as {
      __voiceMax: number;
      __voiceOverlap: Array<{ started: string; others: string[] }>;
    };
    return { voiceMax: w.__voiceMax, overlap: w.__voiceOverlap ?? [] };
  });
  const overlapJson = JSON.stringify(voice.overlap, null, 2);
  console.log("voice overlap", overlapJson);
  await testInfo.attach("voice-overlap", {
    body: overlapJson,
    contentType: "application/json",
  });
  expect(voice.voiceMax, `overlaps: ${overlapJson}`).toBeLessThanOrEqual(1);
});
