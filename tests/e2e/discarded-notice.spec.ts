import { test, expect, type BrowserContext, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  commitHit,
  clickNextPlace,
  readPhase,
  dismissTileOverlayIfPresent,
  NO_IDLE,
  MC2_RUN_KEY,
} from "./helpers";
import { SCORING_VERSION } from "../../src/game/scoring.ts";
import { CHALLENGE_REGION_ID, encodeChallenge } from "../../src/game/challenge.ts";
import { DISCARDED_NOTICE_KEY } from "../../src/game/session.ts";

/**
 * Discarded-run notice (Wave 1 P0 Item 1, manifest 2026-10-29 §2 Item 1).
 *
 * One shared notice on home: a reason keyword + the played score/places,
 * per cause — inactivity, new day, scoring changed, challenges off —
 * each paired with negative assertions for the other causes' keywords.
 * The pre-existing live note ("Your game ended after 2 minutes of
 * inactivity") carries no score/places, so it cannot satisfy these tests.
 *
 * Clock rule (manifest §1 amendment 4): page.clock.install({ time })
 * BEFORE goto, all play at the frozen clock origin, lastActivityAt pinned
 * to the clock origin, windows asserted (warning by ~100s, kill/home by
 * ~130s), never point values. Sound seeded off; storage fresh per test
 * (Playwright context); sessionStorage and localStorage are separate
 * stores, so a same-context new page shares localStorage but starts
 * with fresh sessionStorage — the closed-tab model for 1B.
 *
 * RED tests: 1A, 1B, 1C, 1D, 1E, 1G(3), 1I(1), 1I(2).
 * GUARD tests (pass pre-fix vacuously, never failing-first evidence):
 * 1F, 1F2, 1H(1), 1H(2), 1I(3).
 */

test.setTimeout(300_000);

const APP = "http://127.0.0.1:4123/Meridian/";
const APP_NO_IDLE = `${APP}?idle-ms=${NO_IDLE}`;
/** Frozen clock origin: noon UTC, so +3 min / +1 day stay in known days. */
const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Sound off + tutorial already seen + first-win Parade already
  // celebrated, for every page in the context (including 1B's second
  // page). The Parade is a full-screen overlay that blocks Next place
  // until dismissed; it is not under test here, and seeding its flag
  // is the repo's own pattern (game-sfx, reset-history, tapstart).
  // Never touches the discarded record.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("meridian.sound", "off");
      localStorage.setItem("meridian.tutorialSeen", "1");
      localStorage.setItem("meridian.firstWinCelebrated", "1");
    } catch {
      /* storage blocked: tests do not depend on these seeds */
    }
  });
});

function notice(page: Page) {
  return page.getByTestId("discarded-notice");
}

async function readSessionTotals(page: Page): Promise<{
  totalScore: number;
  placesPlayed: number;
} | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    if (!raw) return null;
    const s = JSON.parse(raw) as { totalScore: number; placesPlayed: number };
    return { totalScore: s.totalScore, placesPlayed: s.placesPlayed };
  });
}

async function readRunResultsSum(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.run");
    if (!raw) return 0;
    const run = JSON.parse(raw) as {
      results: { score: number }[];
    };
    return (run.results ?? []).reduce((sum, r) => sum + r.score, 0);
  });
}

/**
 * Wait for the aim phase and a settled map zoom (mirrors startGlobeRun,
 * with longer polls: the shared VM runs these suites under contention
 * from sibling builders, and a 30 s zoom poll flakes there).
 */
async function waitForAim(page: Page): Promise<void> {
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 60_000 }).toBe("aim");
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 60_000 },
    )
    .not.toBeNull();
}

async function startNebraskaRun(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: "State" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: /Nebraska/ }).click();
  await waitForAim(page);
}

async function startGlobeRunClocked(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await waitForAim(page);
}

/**
 * Bank places until the session holds at least `minPlaces` places.
 * commitHit banks exactly one hit per call plus any misses it burns
 * along the way, so the loop stops on the session count, not the call
 * count — the notice must match the session's actual totals.
 */
async function playAtLeast(
  page: Page,
  minPlaces: number,
): Promise<{ totalScore: number; placesPlayed: number }> {
  for (let guard = 0; guard < 12; guard++) {
    const totals = await readSessionTotals(page);
    if (totals && totals.placesPlayed >= minPlaces) return totals;
    await dismissTileOverlayIfPresent(page);
    await commitHit(page);
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error(`playAtLeast: session never reached ${minPlaces} places`);
}

function placesText(places: number): string {
  return places === 1 ? "1 place" : `${places} places`;
}

/**
 * The paired assertion: keyword + score/places in the SAME test, plus
 * the negative assertions for the other causes' keywords.
 */
async function expectNotice(
  page: Page,
  keyword: string,
  forbidden: string[],
  totals: { totalScore: number; placesPlayed: number },
): Promise<void> {
  const el = notice(page);
  await expect(el).toHaveCount(1);
  await expect(el).toBeVisible();
  const text = ((await el.textContent()) ?? "").toLowerCase();
  expect(text).toContain(keyword);
  expect(text).toContain(placesText(totals.placesPlayed));
  expect(text).toContain(totals.totalScore.toLocaleString("en-US"));
  for (const word of forbidden) {
    expect(text, `notice must not contain ${word}`).not.toContain(word);
  }
}

/** Idle-kill at the frozen origin: warning by ~100s, home by ~130s. */
async function idleKill(page: Page): Promise<void> {
  await page.clock.runFor(100_000);
  await expect(page.getByText("Still there?")).toBeVisible({ timeout: 10_000 });
  await page.clock.runFor(30_000);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 10_000,
  });
}

test("1A idle kill shows one notice with the played score and places", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  const totals = await playAtLeast(page, 3);
  expect(totals.totalScore).toBeGreaterThan(0);
  await idleKill(page);
  await expectNotice(page, "inactivity", ["new day", "scoring", "challenges"], totals);
});

test("1B closed-tab idle expiry reopens to a notice, not silent home", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  const totals = await playAtLeast(page, 1);
  expect(totals.totalScore).toBeGreaterThan(0);
  // Close the tab (context kept): sessionStorage dies with the tab,
  // localStorage survives — the durable record is the only bridge.
  await page.close();
  // SAME-CONTEXT new page only: a fresh context would wipe even a
  // correct localStorage record. Clock at origin + 3 min: past expiry,
  // same UTC day (not a new-day case).
  const reopened = await context.newPage();
  await reopened.clock.install({ time: T0 + 180_000 });
  await reopened.goto(APP);
  await expect(reopened.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expectNotice(reopened, "inactivity", ["new day", "scoring", "challenges"], totals);
  // Consume-on-show: reload yields no second notice.
  await reopened.reload();
  await expect(notice(reopened)).toHaveCount(0);
  await reopened.close();
});

test("1C yesterday's game reopens to a new-day notice with yesterday's score", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startGlobeRunClocked(page, APP);
  const totals = await playAtLeast(page, 1);
  expect(totals.totalScore).toBeGreaterThan(0);
  // Model yesterday's game: shift only the stored day keys back one day
  // (real play, real totals — the boot day stays the frozen origin, so
  // the saved game is from the previous UTC day).
  await page.evaluate(() => {
    const runRaw = sessionStorage.getItem("meridian.run");
    if (runRaw) {
      const run = JSON.parse(runRaw) as { dateKey: string };
      run.dateKey = "2026-10-27";
      sessionStorage.setItem("meridian.run", JSON.stringify(run));
    }
    const sessionRaw = sessionStorage.getItem("meridian.session");
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as { dateKey: string };
      session.dateKey = "2026-10-27";
      sessionStorage.setItem("meridian.session", JSON.stringify(session));
    }
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expectNotice(page, "new day", ["inactivity", "scoring", "challenges"], totals);
});

test("1D retired scoring version reopens to a scoring-changed notice, never recomputed", async ({
  page,
}) => {
  await startNebraskaRun(page, APP_NO_IDLE);
  const totals = await playAtLeast(page, 1);
  expect(totals.totalScore).toBeGreaterThan(0);
  // A shipped version bump: the stored results carry a stale version,
  // same edition/region/difficulty, same day. Scores are never recomputed.
  await page.evaluate((stale) => {
    const raw = sessionStorage.getItem("meridian.run");
    if (!raw) throw new Error("no saved run to retire");
    const run = JSON.parse(raw) as {
      results: { scoringVersion: number }[];
    };
    for (const r of run.results) r.scoringVersion = stale;
    sessionStorage.setItem("meridian.run", JSON.stringify(run));
  }, SCORING_VERSION + 1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expectNotice(page, "scoring changed", ["inactivity", "new day", "challenges"], totals);
});

test("1E challenges-off deletion reopens to a challenges-off notice", async ({
  page,
  context,
}) => {
  // Flag off before boot: the saved challenge-region run is cleared.
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, friendChallenges: false, learningOutcomes: true },
      }),
    });
  });
  await startNebraskaRun(page, APP_NO_IDLE);
  const totals = await playAtLeast(page, 1);
  expect(totals.totalScore).toBeGreaterThan(0);
  // Model a saved challenge-region run: only the region sentinel changes;
  // edition, day, difficulty and results are the real played game.
  await page.evaluate((challengeRegionId) => {
    const raw = sessionStorage.getItem("meridian.run");
    if (!raw) throw new Error("no saved run to mark as a challenge");
    const run = JSON.parse(raw) as { regionId: string };
    run.regionId = challengeRegionId;
    sessionStorage.setItem("meridian.run", JSON.stringify(run));
  }, CHALLENGE_REGION_ID);
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expectNotice(page, "challenges", ["inactivity", "new day", "scoring"], totals);
});

test("1G(3) discarded notice never shows 0 places, 0 score, or an unearned score", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  const totals = await playAtLeast(page, 3);
  expect(totals.totalScore).toBeGreaterThan(0);
  await idleKill(page);
  const el = notice(page);
  await expect(el).toHaveCount(1);
  const text = (await el.textContent()) ?? "";
  expect(text).toContain(placesText(totals.placesPlayed));
  expect(text).toContain(totals.totalScore.toLocaleString("en-US"));
  expect(text).not.toContain("0 places");
  expect(text).not.toMatch(/scored 0 points/);
});

test("1I(1) discard with nothing scored still notices, honestly saying nothing was scored", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  // No place committed: the session exists (run start banks nothing),
  // the run holds no results — the notice must not invent a score.
  await idleKill(page);
  const el = notice(page);
  await expect(el).toHaveCount(1);
  const text = ((await el.textContent()) ?? "").toLowerCase();
  expect(text).toContain("inactivity");
  expect(text).toContain("not scored anything yet");
  expect(text).not.toContain("0 places");
  for (const word of ["new day", "scoring", "challenges"]) {
    expect(text).not.toContain(word);
  }
});

test("1I(2) discarded notice covers the whole session, not just the last run", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startGlobeRunClocked(page, APP);
  await playAtLeast(page, 1);
  // Switch editions mid-session (no End game): the session banks both.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await waitForAim(page);
  await playAtLeast(page, 2);
  const totals = await readSessionTotals(page);
  expect(totals).not.toBeNull();
  expect(totals!.placesPlayed).toBeGreaterThanOrEqual(2);
  const lastRunSum = await readRunResultsSum(page);
  // Precondition: the session total really spans both editions.
  expect(totals!.totalScore).toBeGreaterThan(lastRunSum);
  await idleKill(page);
  await expectNotice(page, "inactivity", ["new day", "scoring", "challenges"], totals!);
});

test("1I(2)-boot reload after idle expiry shows whole-session totals, not last-run-only", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startGlobeRunClocked(page, APP);
  await playAtLeast(page, 1);
  // Switch editions mid-session (no End game): the session banks both.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await waitForAim(page);
  await playAtLeast(page, 2);
  const totals = await readSessionTotals(page);
  expect(totals).not.toBeNull();
  expect(totals!.placesPlayed).toBeGreaterThanOrEqual(2);
  const lastRunSum = await readRunResultsSum(page);
  // Precondition: the session total really spans both editions, so a
  // last-run-only notice cannot match it.
  expect(totals!.totalScore).toBeGreaterThan(lastRunSum);
  // Boot expiry without touching the clock: backdate the session's
  // lastActivityAt past the 120 s idle timeout, then reload in the same
  // tab (sessionStorage survives; the session ref starts null at boot).
  // The installed clock survives the reload at T0, so boot sees the
  // session as live-but-expired. Pre-fix this notice showed last-run-only
  // totals. UNVERIFIED (VM EPERM fault blocks browser runs).
  await page.evaluate((aged) => {
    const raw = sessionStorage.getItem("meridian.session");
    if (!raw) throw new Error("no saved session to age");
    const session = JSON.parse(raw) as { lastActivityAt: number };
    session.lastActivityAt = aged;
    sessionStorage.setItem("meridian.session", JSON.stringify(session));
  }, T0 - 180_000);
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expectNotice(page, "inactivity", ["new day", "scoring", "challenges"], totals!);
});

test("1F GUARD deliberate End game then reload shows plain home with no lost-game notice", async ({
  page,
}) => {
  await startGlobeRunClocked(page, APP_NO_IDLE);
  await playAtLeast(page, 1);
  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(notice(page)).toHaveCount(0);
});

test("1F2 GUARD an idle-killed game shows its notice at most once across reloads", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  await playAtLeast(page, 1);
  await idleKill(page);
  await expect(notice(page)).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(notice(page)).toHaveCount(0);
});

test("1H(1) GUARD successful resume shows no notice and restores play", async ({
  page,
}) => {
  await startNebraskaRun(page, APP_NO_IDLE);
  await playAtLeast(page, 1);
  await page.reload();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await expect(notice(page)).toHaveCount(0);
});

test("1H(2) GUARD fresh player with no saved game sees no notice", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(notice(page)).toHaveCount(0);
});

test("1I(3) GUARD dismissed discarded notice stays dismissed on reload", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  await playAtLeast(page, 1);
  await idleKill(page);
  const el = notice(page);
  await expect(el).toHaveCount(1);
  await el.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(notice(page)).toHaveCount(0);
});

test("visual notice at 360x740 and 390x844 does not overlap its neighbours", async ({
  page,
}) => {
  await page.clock.install({ time: T0 });
  await startNebraskaRun(page, APP);
  const totals = await playAtLeast(page, 1);
  await idleKill(page);
  await expectNotice(page, "inactivity", ["new day", "scoring", "challenges"], totals);
  for (const [width, height] of [
    [360, 740],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    const el = notice(page);
    await expect(el).toBeVisible();
    const boxes = await page.evaluate(() => {
      const note = document.querySelector('[data-testid="discarded-notice"]');
      const dismiss = note?.querySelector("button");
      const globe = Array.from(document.querySelectorAll("button")).find((b) =>
        (b.textContent ?? "").includes("Play the globe"),
      );
      const rect = (e: Element | null | undefined) => {
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return { note: rect(note), dismiss: rect(dismiss), globe: rect(globe) };
    });
    expect(boxes.note).not.toBeNull();
    expect(boxes.dismiss).not.toBeNull();
    // Dismiss is a real 44×44 tap target (a11y floor), not just inside the card.
    expect(boxes.dismiss!.width).toBeGreaterThanOrEqual(44);
    expect(boxes.dismiss!.height).toBeGreaterThanOrEqual(44);
    // Dismiss sits inside its own card.
    expect(boxes.dismiss!.x).toBeGreaterThanOrEqual(boxes.note!.x - 1);
    expect(boxes.dismiss!.y).toBeGreaterThanOrEqual(boxes.note!.y - 1);
    expect(boxes.dismiss!.x + boxes.dismiss!.width).toBeLessThanOrEqual(
      boxes.note!.x + boxes.note!.width + 1,
    );
    expect(boxes.dismiss!.y + boxes.dismiss!.height).toBeLessThanOrEqual(
      boxes.note!.y + boxes.note!.height + 1,
    );
    // The card never overlaps the edition button below it. The globe
    // button must be present: a missing button used to skip this check.
    expect(boxes.globe).not.toBeNull();
    const overlap =
      boxes.note!.x < boxes.globe!.x + boxes.globe!.width &&
      boxes.note!.x + boxes.note!.width > boxes.globe!.x &&
      boxes.note!.y < boxes.globe!.y + boxes.globe!.height &&
      boxes.note!.y + boxes.note!.height > boxes.globe!.y;
    expect(overlap).toBe(false);
    await page.screenshot({
      path: `tests/e2e/evidence/discarded-notice-${width}.png`,
    });
  }
});

/**
 * Fix round, M1 (silent mc2 discard): a saved friend-challenge mc2 run
 * dropped at boot (flag off, or unresumable) must notice with the mc2
 * run's OWN totals — challenge runs never bank into the session.
 * Synthetic mc2 seeds are minimal valid Run shapes per readRunFrom
 * (edition/region/dateKey/index/hits/phase/results); the flag-off path
 * checks the flag before resumability, so only readRunFrom validity
 * matters there. The unresumable path is forced by a dateKey mismatch.
 * cleanExit is seeded on every navigation (proven mc2-boot pattern) so
 * these boots stay on the clean path, never the crash-loop breaker.
 */
function mc2RunJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    edition: "globe",
    regionId: "globe",
    regionName: "Globe",
    dateKey: "2026-10-30",
    index: 0,
    hits: 0,
    phase: "aim",
    results: [
      { distanceKm: 40, hit: true, score: 100 },
      { distanceKm: 120, hit: true, score: 50 },
    ],
    ...overrides,
  });
}

async function routeFriendChallenges(context: BrowserContext, on: boolean): Promise<void> {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, friendChallenges: on, learningOutcomes: true },
      }),
    });
  });
}

async function seedCleanExit(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("meridian.cleanExit", "1");
    } catch {
      /* storage blocked */
    }
  });
}

async function expectHome(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
}

test("1E-mc2 flag-off mc2 discard shows a challenges notice with the mc2 run's own totals", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, false);
  await seedCleanExit(context);
  await page.goto(APP_NO_IDLE);
  await expectHome(page);
  await page.evaluate(
    ({ key, json }) => {
      sessionStorage.setItem(key, json);
    },
    { key: MC2_RUN_KEY, json: mc2RunJson() },
  );
  await page.reload();
  await expectHome(page);
  await expectNotice(page, "challenges", ["inactivity", "new day", "scoring"], {
    totalScore: 150,
    placesPlayed: 2,
  });
});

test("1E-mc2-dual mc2 notice wins over a stale shadow, which survives for the next boot", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, false);
  await seedCleanExit(context);
  await page.goto(APP_NO_IDLE);
  await expectHome(page);
  // Stale-but-under-24h shadow: yesterday's dateKey (new-day branch
  // would fire) with a 23h-old timestamp (survives the L3 24h expiry).
  const shadowAgeMs = 23 * 3600 * 1000;
  await page.evaluate(
    ({ mc2Key, shadowKey, mc2, shadow }) => {
      sessionStorage.setItem(mc2Key, mc2);
      localStorage.setItem(shadowKey, shadow);
    },
    {
      mc2Key: MC2_RUN_KEY,
      shadowKey: DISCARDED_NOTICE_KEY,
      mc2: mc2RunJson(),
      shadow: JSON.stringify({
        totalScore: 999,
        placesPlayed: 9,
        dateKey: "2000-01-01",
        lastActivityAt: Date.now() - shadowAgeMs,
      }),
    },
  );
  await page.reload();
  await expectHome(page);
  // Boot 1: the mc2 notice wins; the shadow's text must not leak in.
  await expectNotice(page, "challenges", ["inactivity", "new day", "scoring"], {
    totalScore: 150,
    placesPlayed: 2,
  });
  const elText = ((await notice(page).textContent()) ?? "").toLowerCase();
  expect(elText, "shadow totals must not leak into the mc2 notice").not.toContain("999");
  // DEFER (manifest choice): the preserved shadow survives boot 1 —
  // skipped, never shown, therefore never consumed.
  const shadowAfter = await page.evaluate(
    (key) => localStorage.getItem(key),
    DISCARDED_NOTICE_KEY,
  );
  expect(shadowAfter, "preserved shadow must survive boot 1").not.toBeNull();
  // Boot 2: dismiss + reload shows the deferred shadow notice.
  await notice(page).getByRole("button", { name: "Dismiss" }).click();
  await page.reload();
  await expectHome(page);
  await expectNotice(page, "new day", ["inactivity", "challenges", "scoring"], {
    totalScore: 999,
    placesPlayed: 9,
  });
});

test("1E-mc2-GUARD-aim resumable normal run restores and retires the mc2 notice", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, false);
  await seedCleanExit(context);
  await startNebraskaRun(page, APP_NO_IDLE);
  const totals = await playAtLeast(page, 1);
  expect(totals.totalScore).toBeGreaterThan(0);
  // Copy (don't move) the played run into the mc2 slot: the normal run
  // stays resumable underneath.
  await page.evaluate((mc2Key) => {
    const raw = sessionStorage.getItem("meridian.run");
    if (!raw) throw new Error("no saved run to copy to mc2");
    sessionStorage.setItem(mc2Key, raw);
  }, MC2_RUN_KEY);
  await page.reload();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("1E-mc2-GUARD-mc1 resumable challenge run restores and retires the mc2 notice", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, true);
  await seedCleanExit(context);
  // A REAL mc1 challenge run: an mc1 link boots straight into the game
  // (mc1 boot commits at once), saving a genuine challenge-region run
  // under the normal key. Mutating a played Nebraska run's regionId
  // instead does NOT resume — its pool stays Nebraska while the
  // challenge region deals globe, tripping the fail-closed pool guard.
  // Golden fixture route (mc2-boot spec's cross-format test).
  const GOLDEN_MC1_IDS = ["gn-1579635", "gn-13665104", "gn-2526780", "gn-3574116", "gn-160950"];
  const mc1Hash = encodeChallenge(GOLDEN_MC1_IDS, SCORING_VERSION);
  await page.goto(`${APP_NO_IDLE}${mc1Hash}`);
  await waitForAim(page);
  const savedRun = await page.evaluate(() => sessionStorage.getItem("meridian.run"));
  expect(savedRun, "mc1 link must save a challenge run").toBeTruthy();
  expect(JSON.parse(savedRun as string).regionId).toBe(CHALLENGE_REGION_ID);
  // Unresumable mc2 save underneath (yesterday's dateKey), flag ON.
  await page.evaluate(
    ({ mc2Key, mc2 }) => {
      sessionStorage.setItem(mc2Key, mc2);
    },
    { mc2Key: MC2_RUN_KEY, mc2: mc2RunJson({ dateKey: "2000-01-01" }) },
  );
  await page.reload();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("1E-mc2-summary-flagoff finished mc2 challenge clears silently with flag off", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, false);
  await seedCleanExit(context);
  await page.goto(APP_NO_IDLE);
  await expectHome(page);
  await page.evaluate(
    ({ key, json }) => {
      sessionStorage.setItem(key, json);
    },
    { key: MC2_RUN_KEY, json: mc2RunJson({ phase: "summary" }) },
  );
  await page.reload();
  await expectHome(page);
  await expect(notice(page)).toHaveCount(0);
});

test("1E-mc2-summary-unresumable finished mc2 challenge clears silently when unresumable", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, true);
  await seedCleanExit(context);
  await page.goto(APP_NO_IDLE);
  await expectHome(page);
  await page.evaluate(
    ({ key, json }) => {
      sessionStorage.setItem(key, json);
    },
    { key: MC2_RUN_KEY, json: mc2RunJson({ dateKey: "2000-01-01", phase: "summary" }) },
  );
  await page.reload();
  await expectHome(page);
  await expect(notice(page)).toHaveCount(0);
});

test("1E-mc2-unresumable unresumable mc2 save shows a challenges notice", async ({
  page,
  context,
}) => {
  await routeFriendChallenges(context, true);
  await seedCleanExit(context);
  await page.goto(APP_NO_IDLE);
  await expectHome(page);
  await page.evaluate(
    ({ key, json }) => {
      sessionStorage.setItem(key, json);
    },
    { key: MC2_RUN_KEY, json: mc2RunJson({ dateKey: "2000-01-01" }) },
  );
  await page.reload();
  await expectHome(page);
  await expectNotice(page, "challenges", ["inactivity", "new day", "scoring"], {
    totalScore: 150,
    placesPlayed: 2,
  });
});

test("1B GUARD context check: a fresh context sees no notice (record is context-local)", async ({
  browser,
}) => {
  // Sanity guard for the 1B model itself: localStorage does not leak
  // across contexts, so a fresh context must show plain home.
  const fresh = await browser.newContext();
  try {
    await serveBuiltArtifact(fresh);
    const freshPage = await fresh.newPage();
    await freshPage.goto(APP_NO_IDLE);
    await expect(freshPage.getByRole("button", { name: "Play the globe" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(notice(freshPage)).toHaveCount(0);
    await freshPage.close();
  } finally {
    await fresh.close();
  }
});
