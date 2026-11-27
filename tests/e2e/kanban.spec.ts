import { test, expect } from "playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * /kanban — the build board. GitHub is the source of truth when
 * the public API answers. api.github.com is aborted by default,
 * so the snapshot tests run the offline path: kanban.json under
 * "Offline snapshot from <asOf>". The live tests serve both
 * GitHub endpoints with page.route and never reach the real API.
 */
test.setTimeout(180_000);

const KANBAN_URL = "http://127.0.0.1:4123/Meridian/kanban";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  const shell = readFileSync("dist/client/_shell.html");
  await context.route("**/Meridian/kanban*", async (route) => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({
        status: 200,
        body: shell,
        contentType: "text/html; charset=utf-8",
      });
    }
    return route.fallback();
  });
  await context.route("https://api.github.com/**", async (route) => route.abort());
  // The flags, for this spec only: the shipped flags.json verbatim
  // plus buildKanban on — and pwaUpdateToast off, so no service
  // worker registers: the viewport test navigates repeatedly in
  // one context, and a SW-controlled navigation is not a
  // navigation request, so the shell fulfilment above would miss
  // it and the artifact server would answer its raw 404.
  // Registered last, so this wins dispatch over the hermetic
  // default serveBuiltArtifact installed.
  const flags = JSON.parse(readFileSync("public/flags.json", "utf8")) as {
    flags: Record<string, boolean>;
  };
  flags.flags.buildKanban = true;
  flags.flags.pwaUpdateToast = false;
  await context.route("**/flags.json*", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(flags),
    }),
  );
});

async function openKanban(page: import("playwright/test").Page) {
  await page.goto(KANBAN_URL);
  await expect(page.locator(".kb-story").first()).toBeVisible();
  await expect(page.locator(".kb-story")).toHaveCount(18);
}

/** Expand every story card on the board. */
async function expandAllStories(page: import("playwright/test").Page) {
  await page.locator(".kb-expand").evaluateAll((buttons) => {
    for (const button of buttons) {
      if (button.getAttribute("aria-expanded") === "false") {
        (button as HTMLElement).click();
      }
    }
  });
  await expect(page.locator(".kb-sub").first()).toBeVisible();
}

test("no page-level horizontal overflow and 18 story cards at five viewports", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await openKanban(page);
    await expect(page.getByRole("heading", { name: "Build board" })).toBeVisible();
    await expect(page.locator(".kb-col")).toHaveCount(5);
    for (const col of ["Backlog", "Blocked", "In progress", "In review", "Done"]) {
      await expect(page.locator(`.kb-col[data-col="${col}"]`)).toHaveCount(1);
    }
    // The board scrolls inside its own container; the page never
    // scrolls sideways, at any width. Story numbers are on the
    // cards; expanding shows every subtask number too.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
    await expect(page.getByText("TD-01", { exact: true })).toBeVisible();
    await expandAllStories(page);
    await expect(page.getByText("TD-01.1", { exact: true })).toBeVisible();
    await expect(page.locator(".kb-num")).toHaveCount(63);
    const expanded = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(expanded.scrollWidth).toBeLessThanOrEqual(expanded.innerWidth);
  }
  // The real shell, not a mock frame: the shared header + footer.
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("footer").first()).toBeVisible();
});

test("a story that is not in the snapshot appears from the API alone, within the request budget", async ({
  page,
  context,
}) => {
  const githubUrls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("api.github.com")) githubUrls.push(request.url());
  });
  // TD-08.7 deep tier, exercised with fixtures: page 1 is full
  // (100 rows), so one deep page is read; page 2 is short, so
  // paging stops. The budget for this first load is 3 calls:
  // pulls page 1 + pulls page 2 + branches. The 5-page cap is
  // pinned in the unit tests, not here.
  const pullsPage = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      number: start + i,
      state: "open",
      draft: false,
      merged_at: null,
      title: "feat: FW-99.9 not in the ledger",
      head: { ref: "feat/fw-99.9-lighthouse" },
      labels: [{ name: "C:Atlas" }],
    }));
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\?/, async (route) => {
    const url = route.request().url();
    const body = /[?&]page=/.test(url) ? pullsPage(9200, 3) : pullsPage(9001, 100);
    if (/[?&]page=/.test(url)) {
      // One open pull mentions #590, so that bug is In progress;
      // #478 has no open pull and stays Backlog. The title keeps
      // the "not in the ledger" text the card assertion looks for.
      body[0] = {
        ...body[0],
        title: "feat: FW-99.9 not in the ledger, refs #590",
      };
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/issues\?/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          number: 590,
          state: "open",
          title: "Narration silent on the phone",
          html_url: "https://github.com/veeresh-bikkaneti/Meridian/issues/590",
          labels: [{ name: "bug" }],
        },
        {
          number: 478,
          state: "open",
          title: "Ledger-linked bug still gets its own card",
          html_url: "https://github.com/veeresh-bikkaneti/Meridian/issues/478",
          labels: [{ name: "bug" }],
        },
        {
          number: 9999,
          state: "open",
          title: "A pull request, not an issue",
          html_url: "https://github.com/veeresh-bikkaneti/Meridian/pull/9999",
          pull_request: { url: "https://api.github.com/repos/veeresh-bikkaneti/Meridian/pulls/9999" },
          labels: [{ name: "bug" }],
        },
      ]),
    }),
  );
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/branches(\?|$)/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ name: "chore/td-08.4-kanban-github-derived" }]),
    }),
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(KANBAN_URL);
  const fresh = page.locator(".kb-story", { hasText: "FW-99.9" });
  await expect(fresh).toBeVisible();
  await expect(fresh).toContainText("not in the ledger");
  await expect(fresh.locator('.kb-chip-seat[data-seat-tag="C:Atlas"]')).toHaveText("C:Atlas");
  await expect(page.locator(".kb-story", { hasText: "TD-08.4" })).toBeVisible();
  await expect(page.locator(".kb-stamp")).toHaveText(/Live · fetched \d{2}:\d{2}/);
  // Commit 4: ledger stories render in live mode, with columns
  // derived from GitHub. TD-01 has no live evidence, so its
  // filed Done subtask falls back to Backlog ("not verified
  // live") and the story sits in Backlog. All 18 ledger stories
  // plus the two GitHub-only cards (FW-99.9, TD-08.4) render.
  await expect(page.locator(".kb-story")).toHaveCount(20);
  const td01Num = page.locator('section.kb-col[data-col="Backlog"] .kb-story .kb-num', {
    hasText: /^TD-01$/,
  });
  await expect(td01Num).toBeVisible();
  // TD-01.1 is a subtask row inside the collapsed TD-01 story,
  // not a top-level card.
  await expect(page.getByText("TD-01.1", { exact: true })).toHaveCount(0);
  // Both open bugs appear as bug cards, including #478, which the
  // ledger already links; the pull row in the issues payload does not.
  await expect(page.locator(".kb-bug")).toHaveCount(2);
  const bug590 = page.locator('.kb-bug[data-bug-id="590"]');
  await expect(bug590).toBeVisible();
  await expect(bug590.locator(".kb-chip-bug")).toHaveText("Bug");
  await expect(bug590.locator('a[href*="/issues/590"]')).toBeVisible();
  await expect(
    page.locator('section.kb-col[data-col="In progress"] .kb-bug[data-bug-id="590"]'),
  ).toBeVisible();
  await expect(
    page.locator('section.kb-col[data-col="Backlog"] .kb-bug[data-bug-id="478"]'),
  ).toBeVisible();
  await expect(page.locator(".kb-count-note")).toContainText("2 open bugs");
  await expect.poll(() => githubUrls.length).toBe(4);
  expect(githubUrls.filter((url) => /\/pulls\/\d+/.test(url))).toEqual([]);
  const pages = githubUrls.flatMap((url) => /[?&]page=(\d+)/.exec(url)?.[1] ?? []);
  expect(pages).toEqual(["2"]);
});

test("backfilled numbers show live, genuine unknowns stay Unnumbered, counts are a census", async ({
  page,
  context,
}) => {
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\?/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          number: 571,
          state: "closed",
          draft: false,
          merged_at: "2026-11-23T17:00:00Z",
          title: "Phase 1 Part B: game-app onto the storage port",
          head: { ref: "phase1/ports-part-b" },
          labels: [],
        },
        {
          number: 614,
          state: "open",
          draft: true,
          merged_at: null,
          title: "chore: drop the baselined shims",
          head: { ref: "chore/td-10.1-drop-baselined-shims" },
          labels: [],
        },
        {
          number: 616,
          state: "closed",
          draft: false,
          merged_at: "2026-11-24T15:00:00Z",
          title: "test(e2e): settle the boot splash before the credits-link click",
          head: { ref: "vibe/credits-link-dup-700c6b" },
          labels: [],
        },
      ]),
    }),
  );
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/branches(\?|$)/, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/issues\?/, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(KANBAN_URL);
  await expect(page.locator(".kb-stamp")).toHaveText(/Live · fetched \d{2}:\d{2}/);

  // The backfill map keys #571 as TD-02.5 even though neither
  // its title nor its branch carries the number. TD-02.5 is a
  // ledger subtask, so its card folds into the TD-02 story:
  // expanding the story shows the row with the #571 chip, and
  // no top-level card carries the id.
  await expect(page.locator('[data-story-id="TD-02.5"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: /Show subtasks for TD-02 / })
    .click();
  const td025 = page.locator(".kb-subs li", { hasText: "TD-02.5" });
  await expect(td025).toBeVisible();
  await expect(td025.locator('a[href*="/pull/571"]')).toBeVisible();
  // The map also wins over #614's head.ref, which names TD-10.1.
  // TD-10.5 is not a ledger subtask, so it stays a card.
  await expect(page.locator(".kb-story", { hasText: "TD-10.5" })).toBeVisible();
  await expect(page.locator(".kb-story", { hasText: "TD-10.1" })).toHaveCount(0);
  // #616 has no determinable number: it stays under Unnumbered.
  const unknown = page.locator(".kb-story", { hasText: "credits-link click" });
  await expect(unknown).toBeVisible();
  await expect(unknown).toHaveAttribute("data-group", "Unnumbered");
  await expect(page.locator(".kb-group", { hasText: "Unnumbered" }).first()).toBeVisible();

  // The lane counts are the census (ledger + map + window):
  // 19 stories and 47 tasks — distinct numbers, and neither is
  // the 3-pull fixture window length. Lanes follow the ledger:
  // Architecture is TD-01..07 and TD-09 (8/23), Tech debt is
  // TD-10..16 plus TD-08 / TD-08.1 / TD-10.5 (8/17). The window's
  // numbered cards sit on those lanes: TD-02.5 and TD-10.5.
  await expect(page.getByRole("button", { name: /19 stories, 47 tasks/ })).toBeVisible();

  const tab = (label: string) =>
    page.getByRole("group", { name: "Swimlane" }).getByRole("button", { name: label });
  await expect(tab("Tech debt · 8 stories, 17 tasks")).toBeVisible();
  await expect(tab("Architecture · 8 stories, 23 tasks")).toBeVisible();
  await expect(tab("Product · 3 stories, 7 tasks")).toBeVisible();
  const numberedCards = page.locator('.kb-story[data-group="numbered"]');
  await tab("Tech debt · 8 stories, 17 tasks").click();
  await expect(numberedCards).toHaveCount(1);
  await expect(numberedCards.and(page.locator('[data-lane="tech-debt"]'))).toHaveCount(1);
  await expect(page.locator(".kb-story", { hasText: "TD-10.5" })).toBeVisible();
  await tab("Architecture · 8 stories, 23 tasks").click();
  // TD-02.5 folded into its story, so no numbered card remains
  // on this lane; the TD-02 story itself is still here.
  await expect(numberedCards).toHaveCount(0);
  await expect(page.locator(".kb-story .kb-num", { hasText: /^TD-02$/ })).toBeVisible();
  await tab("Product · 3 stories, 7 tasks").click();
  await expect(numberedCards).toHaveCount(0);
  await expect(
    page.getByText("Counts include the checked-in ledger plus the last 500 updated PRs"),
  ).toBeVisible();
});

test("a 403 shows the offline snapshot banner", async ({ page, context }) => {
  await context.route(/api\.github\.com\/.*/, async (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "rate limit" }),
    }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(KANBAN_URL);
  await expect(page.locator(".kb-stamp")).toHaveText(/Offline snapshot from 2026-11-23/);
  await expect(page.locator(".kb-story")).toHaveCount(18);
});

test("falls back to the snapshot, labelled, when the live check cannot complete", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let githubCalled = false;
  page.on("request", (r) => {
    if (r.url().includes("api.github.com")) githubCalled = true;
  });
  await openKanban(page);

  // The stamp never claims liveness: it names the snapshot,
  // whichever snapshot stage is showing.
  await expect(page.locator(".kb-stamp")).toHaveText(/snapshot (from|·)/);
  await expect(page.locator(".kb-story")).toHaveCount(18);
  // The overlay DID try — fallback honesty, not absence of the feed.
  await expect.poll(() => githubCalled).toBe(true);
});

test("free to claim marks exactly the 18 free subtasks", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openKanban(page);

  await page.getByRole("button", { name: /Free to claim/ }).click();

  // Free-to-claim mode shows the stories that hold a free
  // subtask, auto-expanded, each free subtask badged — 18 of
  // them on the snapshot, and no two overlap in owns.
  await expect(page.locator(".kb-chip-free")).toHaveCount(18);
  await expect(page.locator(".kb-sub-free")).toHaveCount(18);
});

test("the board polls every 5 minutes while visible and keeps the last good state when a poll fails (TD-08.7)", async ({
  page,
  context,
}) => {
  await page.clock.install();
  let failing = false;
  const githubUrls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("api.github.com")) githubUrls.push(request.url());
  });
  const answer = (body: unknown) => async (route: import("@playwright/test").Route) =>
    failing
      ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\?/, answer([]));
  await context.route(
    /api\.github\.com\/repos\/[^/]+\/[^/]+\/branches(\?|$)/,
    answer([{ name: "chore/td-08.4-kanban-github-derived" }]),
  );
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/issues\?/, answer([]));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(KANBAN_URL);
  await expect(page.locator(".kb-stamp")).toHaveText(/Live · fetched \d{2}:\d{2}/);
  const firstRound = githubUrls.length;
  assert.equal(firstRound, 3);

  // Five minutes on, visible, healthy: one steady-state round
  // makes exactly 3 calls (pulls + branches + issues).
  await page.clock.fastForward(5 * 60_000);
  await expect.poll(() => githubUrls.length).toBe(firstRound + 3);
  await expect(page.locator(".kb-stamp")).toHaveText(/Live · fetched \d{2}:\d{2}/);

  // Five minutes on, visible: the tick refetches. The pulls
  // call fails first, so the failed round costs exactly one
  // call and the whole check fails; the board keeps the last
  // good live state with a stale stamp instead of flipping to
  // the offline snapshot.
  failing = true;
  await page.clock.fastForward(5 * 60_000);
  await expect(page.locator(".kb-stamp")).toContainText("last check failed");
  await expect.poll(() => githubUrls.length).toBe(firstRound + 4);
  await expect(page.locator(".kb-story").first()).toBeVisible();

  // Five minutes on, hidden: no round at all.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(5 * 60_000);
  await page.waitForTimeout(50);
  assert.equal(githubUrls.length, firstRound + 4);

  // Visible again: the visibility re-check refetches at once,
  // and the next 5-minute tick refetches again — one failed
  // pulls call each.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => githubUrls.length).toBe(firstRound + 5);
  await page.clock.fastForward(5 * 60_000);
  await expect.poll(() => githubUrls.length).toBe(firstRound + 6);
});
