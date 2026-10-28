import { test, expect } from "playwright/test";
import type { BrowserContext, Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  commitHit,
  commitMiss,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  NO_IDLE,
} from "./helpers";

/**
 * "Start over" reset E2E (manifest 2026-10-28, §5/§6; built Pages artifact).
 *
 * - Home flow: due deck → dialog (locked copy incl. "This cannot be
 *   undone.") → Esc / "Keep my history" change nothing → confirm →
 *   success toast → the card flips to its empty state in place (no
 *   reload) → storage read-back: cleared keys absent, kept keys
 *   byte-identical.
 * - Visibility: no control when the deck is empty; the opener also
 *   renders on the caught-up card (deck total > 0).
 * - Reload proof: open flags seeded in storage are wiped by the reset,
 *   so a reload lands on the picker — no wiped edition auto-opens.
 * - ReviewComplete surface: the same control, visibility from a fresh
 *   deck read; resetting there empties the deck seen back home.
 * - Editions-paused variant (D13): bank → Editions (paused, NOT End
 *   game) → reset → session/run/drop all absent, no Resume on Home →
 *   reopen the edition → the post-reopen session re-read has no
 *   pre-reset banks → End game summary shows only post-reset play.
 * - TrailScreen entry (D14c): after a reset, Cold Trail opens on a
 *   fresh case with the fresh star wallet.
 *
 * Seeding follows the card-redesign idiom (addInitScript, seed-once);
 * the reload test seeds by one-shot evaluate instead, because an init
 * script would re-seed the wiped keys after the reset's reload.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";

const LOCKED_SUB =
  "This clears your misses to practise again, every place you have seen or cleared, your learning growth, your GeoDetective streaks and solved cases, your Cold Trail case and stars, any game you left in the middle, and your score for today. Your badges stay. Your grown-up choices stay. This cannot be undone.";

async function setupContext(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, learningOutcomes: true },
      }),
      contentType: "application/json; charset=utf-8",
    });
  });
}

test.beforeEach(async ({ context }) => {
  await setupContext(context);
});

/** One deck card (Lincoln) — due when nextDueAt is 0, caught-up when future. */
function deckSeed(nextDueAt: number) {
  return {
    v: 1,
    entries: {
      "e2e-deck-lincoln": {
        v: 1,
        place: {
          id: "e2e-deck-lincoln",
          name: "Lincoln",
          lon: -96.7,
          lat: 40.83,
          story: "Nebraska's capital, named for Abraham Lincoln.",
          difficulty: 2,
          edition: "state",
          regionId: "nebraska",
          regionName: "Nebraska",
          subdivision: "Nebraska",
          sourceLabel: "E2E",
          sourceHref: "https://example.com",
          mapMode: "flat",
          regionBounds: [-104.05, 39.99, -95.31, 43.0],
          radiusKm: 75,
        },
        streak: 0,
        nextDueAt,
        lastReviewedAt: 0,
        reviews: 0,
      },
    },
  };
}

const LOOP_SEED = {
  deck: { deck: [3, 1], cycle: 1, cycleCompleted: 0 },
  current: {
    index: 0,
    cycle: 1,
    guesses: [],
    status: "playing",
    cluesRevealed: 1,
    completedAt: null,
    streakEndedAt: null,
    completedCycle: false,
  },
  streak: 3,
  bestStreak: 5,
  totals: { solved: 4, lost: 1 },
};

const LEARNING_SEED = {
  v: 1,
  records: {
    "e2e-deck-lincoln": {
      v: 1,
      placeId: "e2e-deck-lincoln",
      attempts: [
        { at: 1, hit: false, distanceKm: 90, radiusKm: 75, edition: "state", regionId: "nebraska", score: 0 },
      ],
    },
  },
  regionNames: { nebraska: "Nebraska" },
  daysPlayed: ["2026-10-28"],
};

const COLDTRAIL_SEED = { v: 2, caseIndex: 3, stars: 7, solved: 2, current: null };

const BADGES_SEED = [
  { id: "clean-round", earnedAt: "2026-10-09T12:00:00.000Z", schemaVersion: 1 },
];

/** Seed-once init script: the full pre-reset storage picture. */
async function seedStoresOn(page: Page, nextDueAt = 0) {
  await page.addInitScript(
    ({ deck, loop, learning, coldtrail, badges }) => {
      const put = (k: string, v: unknown) => {
        if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
      };
      put("meridian:review-deck:v1", deck);
      put("meridian:learning:v1", learning);
      put("meridian:seen:v2:globe:globe:medium", ["a", "b"]);
      put("meridian:seen:v1:2026-10-01:globe:globe", ["old"]);
      put("meridian:cleared:v1:globe:globe:medium", "1");
      put("meridian.loop.v2", loop);
      put("meridian.coldtrail.v2", coldtrail);
      put("meridian.coldtrail.v1", { v: 1, caseIndex: 2, stars: 9, solved: 3 });
      put("meridian.passport.badges.v1", badges);
      if (!localStorage.getItem("meridian.palette")) {
        localStorage.setItem("meridian.palette", "standard");
      }
      if (!localStorage.getItem("meridian.loop.v1")) {
        localStorage.setItem("meridian.loop.v1", '{"archive":true}');
      }
    },
    {
      deck: deckSeed(nextDueAt),
      loop: LOOP_SEED,
      learning: LEARNING_SEED,
      coldtrail: COLDTRAIL_SEED,
      badges: BADGES_SEED,
    },
  );
}

async function gotoHome(page: Page) {
  await page.goto(APP_URL);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
}

async function localGet(page: Page, key: string) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

async function sessionGet(page: Page, key: string) {
  return page.evaluate((k) => sessionStorage.getItem(k), key);
}

const CLEARED_LOCAL_KEYS = [
  "meridian:review-deck:v1",
  "meridian:learning:v1",
  "meridian:seen:v2:globe:globe:medium",
  "meridian:seen:v1:2026-10-01:globe:globe",
  "meridian:cleared:v1:globe:globe:medium",
  "meridian.loop.v2",
  "meridian.loop.open",
  "meridian.coldtrail.v1",
  "meridian.coldtrail.v2",
  "meridian.coldtrail.open",
];

async function expectStoresCleared(page: Page) {
  for (const key of CLEARED_LOCAL_KEYS) {
    expect(await localGet(page, key), `cleared key absent: ${key}`).toBeNull();
  }
  // Kept stores byte-identical.
  expect(await localGet(page, "meridian.passport.badges.v1")).toBe(JSON.stringify(BADGES_SEED));
  expect(await localGet(page, "meridian.palette")).toBe("standard");
  expect(await localGet(page, "meridian.loop.v1")).toBe('{"archive":true}');
}

async function openDialog(page: Page) {
  const opener = page.getByTestId("reset-history-open").first();
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  const dialog = page.getByTestId("reset-history-confirm");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

/**
 * Wait for the map's intro/framing to settle before tapping (the
 * review-deck spec's pattern): the spot's screen point moves with the
 * camera until the zoom stabilises.
 */
async function waitForMapSettled(page: Page) {
  const map = page.locator(".satellite-map");
  await expect(map).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

test("home: dialog copy, Esc/Keep change nothing, confirm wipes and flips the card in place", async ({
  page,
}) => {
  await seedStoresOn(page);
  await gotoHome(page);
  const section = page.getByTestId("tour-stop-review");
  await expect(section).toBeVisible();
  await expect(page.getByTestId("deck-due-count")).toHaveText("1 card due");
  await expect(page.getByTestId("reset-history-open")).toHaveCount(1);

  // S3: nothing is deleted before the confirm; the dialog carries the
  // locked copy and takes focus.
  const dialog = await openDialog(page);
  await expect(dialog).toHaveAttribute("role", "alertdialog");
  await expect(dialog.getByRole("heading")).toHaveText("Start over?");
  await expect(dialog).toContainText(LOCKED_SUB);
  // D17: the undo clause is its own sentence in the rendered dialog.
  const dialogText = (await dialog.textContent()) ?? "";
  expect(dialogText).toContain("This cannot be undone.");
  await expect(dialog.getByTestId("reset-history-confirm-clear")).toHaveText("Yes, start over");
  await expect(dialog.getByTestId("reset-history-cancel")).toHaveText("Keep my history");
  const focusInDialog = await dialog.evaluate((el) => el === document.activeElement);
  expect(focusInDialog, "focus moves into the dialog on open").toBe(true);
  expect(await localGet(page, "meridian:review-deck:v1")).not.toBeNull();

  // S4: Esc changes nothing.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await localGet(page, "meridian:review-deck:v1")).not.toBeNull();
  await expect(page.getByTestId("deck-due-count")).toHaveText("1 card due");

  // S4: "Keep my history" changes nothing, and focus returns to the opener.
  const dialog2 = await openDialog(page);
  await dialog2.getByTestId("reset-history-cancel").click();
  await expect(dialog2).toHaveCount(0);
  expect(await localGet(page, "meridian:review-deck:v1")).not.toBeNull();
  const focusBack = await page.evaluate(
    () => document.activeElement?.getAttribute("data-testid"),
  );
  expect(focusBack).toBe("reset-history-open");

  // Confirm: success toast, the card flips to its empty state in place
  // (no reload), and the storage read-back matches the manifest §2 set.
  const dialog3 = await openDialog(page);
  await dialog3.getByTestId("reset-history-confirm-clear").click();
  await expect(page.getByTestId("reset-history-toast")).toHaveText(
    "All cleared. You are starting fresh.",
    { timeout: 10_000 },
  );
  await expect(section).toContainText("Miss a place and it'll land here for review.");
  await expect(page.getByTestId("deck-due-count")).toHaveCount(0);
  await expect(page.getByTestId("reset-history-open")).toHaveCount(0);
  await expectStoresCleared(page);
});

test("visibility: no control with an empty deck; opener renders when caught up", async ({
  browser,
}) => {
  // Empty deck (no deck key at all): the card renders (flag on) with the
  // empty copy, but no reset control anywhere (S5).
  {
    const context = await browser.newContext();
    try {
      await setupContext(context);
      const fresh = await context.newPage();
      await gotoHome(fresh);
      await expect(fresh.getByTestId("tour-stop-review")).toContainText(
        "Miss a place and it'll land here for review.",
      );
      await expect(fresh.getByTestId("reset-history-open")).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
  // Caught-up (entries exist, none due): the opener still renders —
  // visibility is deck total > 0, not due > 0 (D10).
  {
    const context = await browser.newContext();
    try {
      await setupContext(context);
      const fresh = await context.newPage();
      await seedStoresOn(fresh, Date.now() + 30 * 24 * 3600 * 1000);
      await gotoHome(fresh);
      await expect(fresh.getByTestId("tour-stop-review")).toContainText("All caught up!");
      await expect(fresh.getByTestId("reset-history-open")).toHaveCount(1);
    } finally {
      await context.close();
    }
  }
});

test("reload proof: wiped open flags do not auto-open an edition after reload", async ({
  page,
}) => {
  await gotoHome(page);
  // One-shot evaluate seeding (NOT addInitScript): an init script would
  // re-seed the wiped keys on the post-reset reload and void the proof.
  await page.evaluate(
    ({ deck, loop, coldtrail }) => {
      localStorage.setItem("meridian:review-deck:v1", JSON.stringify(deck));
      localStorage.setItem("meridian.loop.v2", JSON.stringify(loop));
      localStorage.setItem("meridian.loop.open", "1");
      localStorage.setItem("meridian.coldtrail.v2", JSON.stringify(coldtrail));
      localStorage.setItem("meridian.coldtrail.open", "1");
    },
    { deck: deckSeed(0), loop: LOOP_SEED, coldtrail: COLDTRAIL_SEED },
  );
  // Pre-reset proof the seed is live: the loop open flag auto-opens
  // GeoDetective on boot (GameApp restores the screen from the flag).
  await page.reload();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 20_000,
  });
  // Leave GeoDetective (leaving clears the loop flag itself). The
  // seeded coldtrail flag is still live, so the app routes to Cold
  // Trail next — GameApp's precedence is loop > coldtrail > home;
  // landing there is itself proof the second flag was live. Leave it
  // too ("← All games" clears its flag), then Home renders.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "← All games" }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("deck-due-count")).toHaveText("1 card due");
  await page.evaluate(() => {
    localStorage.setItem("meridian.loop.open", "1");
    localStorage.setItem("meridian.coldtrail.open", "1");
  });

  const dialog = await openDialog(page);
  await dialog.getByTestId("reset-history-confirm-clear").click();
  await expect(page.getByTestId("reset-history-toast")).toBeVisible({ timeout: 10_000 });
  expect(await localGet(page, "meridian.loop.open")).toBeNull();
  expect(await localGet(page, "meridian.coldtrail.open")).toBeNull();

  // Reload: home lands on the picker (no wiped edition auto-opens) and
  // the deck is still empty.
  await page.reload();
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("tour-stop-review")).toContainText(
    "Miss a place and it'll land here for review.",
  );
  await expect(page.getByTestId("reset-history-open")).toHaveCount(0);
  expect(await localGet(page, "meridian.loop.v2")).toBeNull();
  expect(await localGet(page, "meridian.coldtrail.v2")).toBeNull();
});

test("ReviewComplete: reset there empties the deck seen back home", async ({ page }) => {
  await seedStoresOn(page);
  await gotoHome(page);
  const start = page.getByRole("button", { name: "Review my misses: Start review" });
  await expect(start).toBeVisible();
  await start.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await waitForMapSettled(page);
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("story");
  await clickNextPlace(page);
  const complete = page.getByTestId("review-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  await expect(complete).toContainText("You remembered 1 of 1.");

  // The deck still holds the (rescheduled) card, so the control renders
  // on ReviewComplete from a fresh deck read (D16).
  const dialog = await openDialog(page);
  await expect(dialog).toContainText("This cannot be undone.");
  await dialog.getByTestId("reset-history-confirm-clear").click();
  await expect(page.getByTestId("reset-history-toast")).toHaveText(
    "All cleared. You are starting fresh.",
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("reset-history-open")).toHaveCount(0);
  expect(await localGet(page, "meridian:review-deck:v1")).toBeNull();

  // Back home: the card shows the empty state.
  await page.getByRole("button", { name: "Back to editions" }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("tour-stop-review")).toContainText(
    "Miss a place and it'll land here for review.",
  );
  await expectStoresCleared(page);
});

test("Editions-paused variant: reset discards the paused run and its banks for good", async ({
  page,
}) => {
  await seedStoresOn(page);
  // The first-win celebration overlay would cover the result card's
  // Next button; the flag that suppresses it is a KEPT key (the reset
  // must not clear it), so pre-setting it changes nothing under test.
  await page.addInitScript(() => {
    localStorage.setItem("meridian.firstWinCelebrated", "1");
  });
  await startGlobeRun(page, NO_IDLE);
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  const preReset = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { totalScore: number; placesPlayed: number }) : null;
  });
  expect(preReset).not.toBeNull();
  expect(preReset!.placesPlayed).toBeGreaterThanOrEqual(1);
  expect(preReset!.totalScore).toBeGreaterThan(0);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Editions = paused, NOT End game: the run and the session survive.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  expect(await sessionGet(page, "meridian.session")).not.toBeNull();
  expect(await sessionGet(page, "meridian.run")).not.toBeNull();
  // The GeoDetective card offers its Resume variant pre-reset (seeded
  // in-progress mystery) — the on-Home resume offer the reset must end.
  await expect(
    page.getByRole("button", { name: "GeoDetective: Resume your case" }),
  ).toBeVisible();

  const dialog = await openDialog(page);
  await dialog.getByTestId("reset-history-confirm-clear").click();
  await expect(page.getByTestId("reset-history-toast")).toBeVisible({ timeout: 10_000 });

  // D13 sentinel: session, run, and drop are all absent.
  expect(await sessionGet(page, "meridian.session")).toBeNull();
  expect(await sessionGet(page, "meridian.run")).toBeNull();
  expect(await sessionGet(page, "meridian.drop")).toBeNull();
  // No Resume is offered on Home anymore.
  await expect(
    page.getByRole("button", { name: "GeoDetective: Resume your case" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "GeoDetective: Solve a mystery" }),
  ).toBeVisible();

  // Reopen the same edition: a fresh run, and the post-reopen session
  // re-read has NO pre-reset banks (seedSessionFromRun must find no run).
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  const reopened = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw
      ? (JSON.parse(raw) as { totalScore: number; placesPlayed: number; regions: unknown[] })
      : null;
  });
  expect(reopened).not.toBeNull();
  expect(reopened!.placesPlayed).toBe(0);
  expect(reopened!.totalScore).toBe(0);
  expect(reopened!.regions).toEqual([]);

  // Post-reset play only, then End game: the summary matches the
  // post-reset session exactly (its count is read back, not assumed —
  // a commit can burn a place). Any resurrected pre-reset bank would
  // inflate both numbers past the post-reset session's own record.
  await dismissTileOverlayIfPresent(page);
  await commitMiss(page);
  const postReset = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { totalScore: number; placesPlayed: number }) : null;
  });
  expect(postReset).not.toBeNull();
  expect(postReset!.placesPlayed).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "End game" }).click();
  const summary = page.getByRole("dialog", { name: "Game summary" });
  await expect(summary).toBeVisible({ timeout: 15_000 });
  const breakdown = page.getByTestId("summary-edition-breakdown");
  await expect(breakdown).toContainText("Globe");
  await expect(breakdown).toContainText(
    `· ${postReset!.placesPlayed} ${postReset!.placesPlayed === 1 ? "place" : "places"}`,
  );
  const ended = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { placesPlayed: number }) : null;
  });
  expect(ended!.placesPlayed).toBe(postReset!.placesPlayed);
});

test("TrailScreen entry after reset: fresh case, fresh star wallet", async ({ page }) => {
  await seedStoresOn(page);
  await gotoHome(page);
  const dialog = await openDialog(page);
  await dialog.getByTestId("reset-history-confirm-clear").click();
  await expect(page.getByTestId("reset-history-toast")).toBeVisible({ timeout: 10_000 });
  expect(await localGet(page, "meridian.coldtrail.v2")).toBeNull();

  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  // Fresh wallet: the seeded 7 stars / case 4 / 2 solves are gone.
  await expect(page.getByTestId("coldtrail-stars")).toHaveText("⭐ 2");
  // Storage read-back: loadColdtrail() returns a fresh store WITHOUT
  // persisting it (src/game/coldtrail/store.ts — only the v1 migration
  // path saves), so after a wipe the key is legitimately absent until
  // the first case action saves. Absence IS the wiped state; if a
  // store IS present it must be the fresh one — a resurrected seed
  // (case 4 / 2 solves / 7 stars) fails here.
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("meridian.coldtrail.v2");
    return raw ? JSON.parse(raw) : null;
  });
  if (stored !== null) {
    expect(stored.caseIndex).toBe(0);
    expect(stored.solved).toBe(0);
    expect(stored.current).toBeNull();
  }
});
