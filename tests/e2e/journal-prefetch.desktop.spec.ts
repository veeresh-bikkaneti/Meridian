import { test, expect, type BrowserContext, type CDPSession, type Page, type Route } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact, readPhase } from "./helpers";
import {
  closeEntry,
  expectPlaying,
  fixedInstant,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMedia,
  trackJournalRequests,
} from "./journal-player.helpers";

test.setTimeout(240_000);

/**
 * Journal prefetch E2E — desktop (lazy-load scenario 2).
 *
 * While a round is active, the current entry's movie and the next
 * window's (B8: one entry per 30-minute window) are warmed in the
 * background (CORS fetch + drain into the HTTP cache); a later tap
 * plays instantly. Tap-to-load is unchanged.
 *
 * Harness limit (proven by the Step 0b real-server probe in
 * ~/workspace/journal-prefetch-probe/): Playwright route-interception
 * fulfills bypass the HTTP cache entirely, so an intercepted tap ALWAYS
 * re-requests through the route handler even when warm. These specs
 * therefore assert that prefetch requests happen (when, how many,
 * which entries, and under which gating) and that taps play — cache
 * reuse itself (zero additional transfers on the tap) is proven by the
 * real-server probe, not by this suite. The manifest NOT being
 * re-fetched on tap (memoized loader) is asserted as the observable
 * reuse signal this harness can see.
 */

/** Start a globe round from the already-loaded home page. */
async function startRound(page: Page): Promise<void> {
  // The journal specs freeze the clock; gameplay timers (map mount,
  // zoom settle) need real time, so resume from the fixed instant —
  // the 30 min journal window still cannot cross during the test.
  await page.clock.resume();
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** End the round and return home. */
async function endRound(page: Page): Promise<void> {
  await page.getByTestId("end-game-button").click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
}

/** The built manifest bytes, for the delayed-manifest tests. */
const MANIFEST_BODY = readFileSync(
  path.resolve("dist/client/videos/journal-manifest.json"),
);

/**
 * Delay the manifest response so the loading state (spinner + text) is
 * observable. Fulfilled from the built file — NOT route.continue():
 * a page-route continue() goes to the real network (nothing listens on
 * :4123; serveBuiltArtifact only fulfills via its own route), so the
 * fetch would fail and the player would land in the error state.
 */
async function delayManifest(page: Page, ms = 800): Promise<void> {
  await page.route("**/videos/journal-manifest.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: MANIFEST_BODY,
    });
  });
}

/** The mp4 URL for a note id. */
function clipUrl(id: string): string {
  return `https://veeresh-bikkaneti.github.io/meridian-media/journal/${id}.mp4`;
}

/**
 * Note ids in catalog (rotation) order, parsed from the generated
 * dataset — the same source the app renders. B8: one entry per
 * 30-minute window, so the "next" entry is the following id.
 */
const NOTE_IDS: string[] = (() => {
  const data = readFileSync(
    path.resolve("src/components/home-journal.data.ts"),
    "utf8",
  );
  const notesPart = data.slice(0, data.indexOf("JOURNAL_SETS"));
  return [...notesPart.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]!);
})();

/** The entry showing in the window after `id`'s (wraps at the cycle end). */
function nextNoteId(id: string): string {
  const i = NOTE_IDS.indexOf(id);
  return NOTE_IDS[(i + 1) % NOTE_IDS.length]!;
}

/** The 2 s h264+AAC fixture, for the delayed-route abort tests. */
const FIXTURE_MP4 = readFileSync(path.resolve("tests/e2e/fixtures/journal-player-test.mp4"));

/**
 * Range-aware mp4 fulfill with a delay, so the warm is provably still
 * in flight when the test hides the tab / ends the round (mirrors
 * journal-player.helpers fulfillMp4, which is not exported).
 */
async function fulfillMp4Delayed(route: Route, bytes: Buffer, delayMs: number): Promise<void> {
  try {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const range = route.request().headers()["range"];
    const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
    if (m) {
      const start = parseInt(m[1]!, 10);
      const end = m[2] ? Math.min(parseInt(m[2], 10), bytes.length - 1) : bytes.length - 1;
      if (Number.isFinite(start) && start >= 0 && start <= end) {
        await route.fulfill({
          status: 206,
          contentType: "video/mp4",
          headers: {
            "accept-ranges": "bytes",
            "content-range": `bytes ${start}-${end}/${bytes.length}`,
          },
          body: bytes.subarray(start, end + 1),
        });
        return;
      }
    }
    await route.fulfill({
      status: 200,
      contentType: "video/mp4",
      headers: { "accept-ranges": "bytes" },
      body: bytes,
    });
  } catch {
    // The warm was aborted while the fulfill was delayed — the route is
    // gone; nothing to do.
  }
}

/**
 * Replace the beforeEach mp4 stub with a delayed one (30 s: warms are
 * provably still in flight when the test hides the tab / ends the
 * round, even when the end-game sequence runs slow on a contended VM —
 * the 15 s delay lost that race in the full-suite run). The manifest
 * route (serveBuiltArtifact) is untouched — unrouteAll only removes
 * page routes.
 */
async function delayMp4(page: Page, ms = 30_000): Promise<void> {
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/meridian-media/journal/*.mp4", (route) =>
    fulfillMp4Delayed(route, FIXTURE_MP4, ms),
  );
}

interface ReqEvent {
  url: string;
  kind: "request" | "finished" | "failed";
  t: number;
  status?: number;
  failure?: string;
}

/** Request/response/failure events for journal media + manifest, with wall-clock timestamps. */
function trackAll(page: Page): ReqEvent[] {
  const events: ReqEvent[] = [];
  const isJournal = (u: string) =>
    u.includes("meridian-media/journal/") || u.includes("videos/journal-manifest.json");
  page.on("request", (r) => {
    if (isJournal(r.url())) events.push({ url: r.url(), kind: "request", t: Date.now() });
  });
  page.on("response", (res) => {
    if (isJournal(res.url()))
      events.push({ url: res.url(), kind: "finished", t: Date.now(), status: res.status() });
  });
  page.on("requestfailed", (r) => {
    if (isJournal(r.url()))
      events.push({ url: r.url(), kind: "failed", t: Date.now(), failure: r.failure()?.errorText });
  });
  return events;
}

const mediaReqs = (ev: ReqEvent[]) =>
  ev.filter((e) => e.kind === "request" && e.url.includes("meridian-media/journal/"));
const failedMedia = (ev: ReqEvent[]) =>
  ev.filter((e) => e.kind === "failed" && e.url.includes("meridian-media/journal/"));
const finishedMedia = (ev: ReqEvent[]) =>
  ev.filter((e) => e.kind === "finished" && e.url.includes("meridian-media/journal/"));
const finishedMediaAfter = (ev: ReqEvent[], at: number) =>
  ev.filter(
    (e) => e.kind === "finished" && e.url.includes("meridian-media/journal/") && e.t > at,
  );

/**
 * Hide the tab, by the strongest method this headless Chromium allows:
 * (a) real tab switch (second tab to front), (b) CDP lifecycle
 * "passive", (c) CDP lifecycle "frozen", (d) synthetic override of
 * document.visibilityState + a dispatched visibilitychange event (tests
 * the app's listener itself; the browser transition is Chromium's job).
 * Returns which method actually produced visibilityState === "hidden".
 * NOTE: (a) alone does NOT hide in headless new mode — the background
 * tab still reports "visible". (b)/(c) are tried before (d).
 */
async function hideTab(
  page: Page,
  context: BrowserContext,
): Promise<{ method: string; visibilityState: string; other: Page | null }> {
  const vis = () => page.evaluate(() => document.visibilityState);
  // (a) real tab switch
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(1000);
  if ((await vis()) === "hidden") return { method: "real-tab-switch", visibilityState: "hidden", other };
  // (b)/(c) CDP lifecycle states
  const cdp: CDPSession = await context.newCDPSession(page);
  for (const state of ["passive", "frozen"]) {
    try {
      await cdp.send("Page.setWebLifecycleState", { state });
      await page.waitForTimeout(500);
      if ((await vis()) === "hidden") return { method: `cdp-${state}`, visibilityState: "hidden", other };
    } catch {
      // CDP rejected the transition — fall through to the next method.
    }
  }
  // (d) synthetic: override the property the app reads, dispatch the event
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  return { method: "synthetic-dispatch", visibilityState: await vis(), other };
}

async function showTab(page: Page, other: Page | null): Promise<string> {
  await page.evaluate(() => {
    try {
      delete (document as unknown as Record<string, unknown>)["visibilityState"];
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new Event("visibilitychange"));
  });
  if (other) {
    await page.bringToFront();
    await other.close().catch(() => undefined);
  }
  await page.waitForTimeout(500);
  return page.evaluate(() => document.visibilityState);
}

test.beforeEach(async ({ page, context }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("(i) no movie bytes before gameplay starts: no media, no manifest, no video", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const section = page.getByTestId("journal-section");
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid^="journal-play-"]').first()).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
  await expect(page.locator("video")).toHaveCount(0);
});

test("(ii)+(iii) prefetch fires only after a round starts, at most the first 2 entries", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  // B8: the current window's entry + the next window's — at most two warms.
  const allowed = new Set([clipUrl(ids[0]!), clipUrl(nextNoteId(ids[0]!))]);
  // Nothing before the round, even given time.
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);

  await startRound(page);
  await expect.poll(() => media.length, { timeout: 20_000 }).toBeGreaterThan(0);
  // Let any second warm land.
  await page.waitForTimeout(3_000);
  for (const url of media) {
    expect(allowed.has(url)).toBe(true);
  }
  expect(new Set(media).size).toBeLessThanOrEqual(2);
  // The current entry's clip is always among the warms.
  expect(media).toContain(clipUrl(ids[0]!));
  // Prefetch also warms the memoized manifest cache: exactly one fetch.
  expect(manifest).toHaveLength(1);
});

test("(iv-a) no prefetch under Save-Data", async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(window.navigator, "connection", {
      value: { saveData: true, effectiveType: "4g" },
      configurable: true,
    });
  });
  // The init script above only applies to pages loaded after it is
  // added, so reload under it (clock + seeds are re-applied by loadHome
  // in beforeEach already; the reload keeps the frozen clock).
  const { time } = fixedInstant();
  await loadHome(page, time);
  const { media, manifest } = trackJournalRequests(page);
  await startRound(page);
  await page.waitForTimeout(5_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
});

test("(iv-b) no prefetch on a slow-2g connection", async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(window.navigator, "connection", {
      value: { saveData: false, effectiveType: "slow-2g" },
      configurable: true,
    });
  });
  const { time } = fixedInstant();
  await loadHome(page, time);
  const { media, manifest } = trackJournalRequests(page);
  await startRound(page);
  await page.waitForTimeout(5_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
});

test("(v) no prefetch after gameplay ends", async ({ page }) => {
  const { media } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  await startRound(page);
  await expect.poll(() => media.length, { timeout: 20_000 }).toBeGreaterThan(0);
  await endRound(page);
  // The entry is unchanged after the round; a stale warm would show up here.
  expect(await shownNoteIds(page)).toEqual(ids);
  const countAtEnd = media.length;
  expect(countAtEnd).toBeGreaterThan(0);
  await page.waitForTimeout(5_000);
  expect(media.length).toBe(countAtEnd);
});

test("(vi) a prefetched entry's tap plays, without re-fetching the manifest", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  await startRound(page);
  await expect
    .poll(() => media.filter((u) => u === clipUrl(ids[0]!)).length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  await endRound(page);
  expect(await shownNoteIds(page)).toEqual(ids);
  const manifestBeforeTap = manifest.length;
  const video = await openEntry(page, ids[0]!);
  await expectPlaying(video);
  // The memoized manifest is reused: the tap fetches no manifest.
  expect(manifest.length).toBe(manifestBeforeTap);
  await closeEntry(page, ids[0]!);
});

test("(vii) a non-prefetched entry's tap loads only that clip, with the spinner", async ({
  page,
}) => {
  // Delay the manifest so the loading state (spinner + text) is observable.
  await delayManifest(page);
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  // No round started, so nothing was prefetched: the single shown
  // entry is the non-prefetched tap target.
  const only = ids[0]!;
  const playButton = page.getByTestId(`journal-play-${only}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  await expect(page.getByTestId(`journal-loading-spinner-${only}`)).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId(`journal-loading-${only}`)).toHaveText("Loading the movie…");
  const video = page.getByTestId(`journal-movie-${only}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  // Only that clip's bytes moved, plus the one manifest fetch.
  expect(new Set(media)).toEqual(new Set([clipUrl(only)]));
  expect(manifest).toHaveLength(1);
  await closeEntry(page, only);
});

test("(viii-a) entry text stays on in closed, loading, and playing phases", async ({
  page,
}) => {
  await delayManifest(page);
  const ids = await shownNoteIds(page);
  const first = ids[0]!;
  const section = page.getByTestId("journal-section");
  const note = section.getByTestId("journal-note").first();
  // The entry text lives in .hv5-entry-text (h3 place, where, story,
  // source link) — outside the player figure, so its <p> indices never
  // shift when the figure swaps in a status <p> (loading / error).
  const assertTextOn = async () => {
    const text = note.locator(".hv5-entry-text");
    await expect(text.locator("h3")).not.toBeEmpty();
    await expect(text.locator("p").nth(0)).not.toBeEmpty();
    await expect(text.locator("p").nth(1)).not.toBeEmpty();
    await expect(text.locator("a").first()).toBeVisible();
  };
  // Closed.
  await assertTextOn();
  // Loading.
  const playButton = page.getByTestId(`journal-play-${first}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  await expect(page.getByTestId(`journal-loading-spinner-${first}`)).toBeVisible({
    timeout: 5_000,
  });
  await assertTextOn();
  // Playing.
  const video = page.getByTestId(`journal-movie-${first}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  await assertTextOn();
  await closeEntry(page, first);
});

test("(viii-b) entry text stays on in the error phase", async ({ page }) => {
  const ids = await shownNoteIds(page);
  const first = ids[0]!;
  // This entry's clip fails outright; the tap must degrade to the error
  // state with the still + text, not a blank card.
  await page.route(`**/meridian-media/journal/${first}.mp4`, (route) => route.abort());
  const section = page.getByTestId("journal-section");
  const note = section.getByTestId("journal-note").first();
  const playButton = page.getByTestId(`journal-play-${first}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  await expect(page.getByTestId(`journal-error-${first}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(`journal-player-retry-${first}`)).toBeVisible();
  const text = note.locator(".hv5-entry-text");
  await expect(text.locator("h3")).not.toBeEmpty();
  await expect(text.locator("p").nth(0)).not.toBeEmpty();
  await expect(text.locator("p").nth(1)).not.toBeEmpty();
  await expect(text.locator("a").first()).toBeVisible();
  await expect(note.locator("img").first()).toBeVisible();
});

test("(ix) hiding the tab mid-warm aborts the in-flight warms", async ({
  page,
  context,
}) => {
  // 30 s delay: the warms are provably still in flight when the tab hides.
  await delayMp4(page);
  const ev = trackAll(page);
  await startRound(page);
  await expect.poll(() => mediaReqs(ev).length, { timeout: 20_000 }).toBeGreaterThan(0);
  // Let any second warm start.
  await page.waitForTimeout(500);
  const started = mediaReqs(ev).length;
  expect(started).toBeLessThanOrEqual(2);
  const hideAt = Date.now();
  const { visibilityState, other } = await hideTab(page, context);
  expect(visibilityState).toBe("hidden");
  // Premise: no warm finished before the hide — the abort has something
  // in flight to kill (the 30 s fulfill cannot have landed yet).
  expect(finishedMedia(ev)).toEqual([]);
  // Aborted warms fail fast (net::ERR_ABORTED); none finish after the
  // hide, and none start. The 20 s poll tolerates slow requestfailed
  // delivery on a contended VM (the 15 s fulfill would land first if
  // the abort had not fired, so a timeout here still means no abort).
  await expect
    .poll(() => failedMedia(ev).length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);
  expect(finishedMediaAfter(ev, hideAt)).toEqual([]);
  expect(mediaReqs(ev).length).toBe(started);
  await showTab(page, other);
  await endRound(page);
});

test("(x) ending the round with a warm in flight aborts the fetch", async ({
  page,
}) => {
  // 30 s delay: the warms are provably still in flight when the round ends.
  await delayMp4(page);
  const ev = trackAll(page);
  await startRound(page);
  await expect.poll(() => mediaReqs(ev).length, { timeout: 20_000 }).toBeGreaterThan(0);
  // Let any second warm start.
  await page.waitForTimeout(500);
  const started = mediaReqs(ev).length;
  expect(started).toBeLessThanOrEqual(2);
  await page.getByTestId("end-game-button").click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  // run becomes null in onSummaryDone in the same commit that returns
  // home; the effect cleanup (abort) runs before home paints. Use the
  // home-visible moment as the run-null landmark.
  const runNullAt = Date.now();
  // Premise: no warm finished before the round ended — the abort has
  // something in flight to kill (the 30 s fulfill cannot have landed yet).
  expect(finishedMedia(ev)).toEqual([]);
  // The abort landmark is Done, not End game: the in-flight warms fail
  // (aborted) once the round ends; none finish after, none start. The
  // 20 s poll tolerates slow requestfailed delivery on a contended VM
  // (the 15 s fulfill would land first if the abort had not fired, so
  // a timeout here still means no abort).
  await expect
    .poll(() => failedMedia(ev).length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);
  expect(finishedMediaAfter(ev, runNullAt)).toEqual([]);
  expect(mediaReqs(ev).length).toBe(started);
});

test("(xi) entering GeoDetective triggers prefetch for the current entry", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  // B8: the current window's entry + the next window's — at most two warms.
  const allowed = new Set([clipUrl(ids[0]!), clipUrl(nextNoteId(ids[0]!))]);
  // Nothing before entry, even given time.
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);

  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => media.length, { timeout: 20_000 }).toBeGreaterThan(0);
  // Let any second warm land.
  await page.waitForTimeout(3_000);
  for (const url of media) {
    expect(allowed.has(url)).toBe(true);
  }
  expect(new Set(media).size).toBeLessThanOrEqual(2);
  // The current entry's clip is always among the warms.
  expect(media).toContain(clipUrl(ids[0]!));
  // Prefetch also warms the memoized manifest cache: exactly one fetch.
  expect(manifest).toHaveLength(1);
});

