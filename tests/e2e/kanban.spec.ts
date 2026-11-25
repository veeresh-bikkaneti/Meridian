import { test, expect } from "playwright/test";
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

test("a story that is not in the snapshot appears from the API alone, in two requests", async ({
  page,
  context,
}) => {
  const githubUrls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("api.github.com")) githubUrls.push(request.url());
  });
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\?/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          number: 9001,
          state: "open",
          draft: false,
          merged_at: null,
          title: "feat: FW-99.9 not in the ledger",
          head: { ref: "feat/fw-99.9-lighthouse" },
          labels: [{ name: "C:Atlas" }],
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
  // Ledger-only rows stay off the board while GitHub answers.
  await expect(page.getByText("TD-01.1", { exact: true })).toHaveCount(0);
  await expect.poll(() => githubUrls.length).toBe(2);
  expect(githubUrls.filter((url) => /\/pulls\/\d+/.test(url))).toEqual([]);
  expect(githubUrls.filter((url) => /[?&]page=/.test(url))).toEqual([]);
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

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(KANBAN_URL);
  await expect(page.locator(".kb-stamp")).toHaveText(/Live · fetched \d{2}:\d{2}/);

  // The backfill map keys #571 as TD-02.5 even though neither
  // its title nor its branch carries the number.
  await expect(page.locator(".kb-story", { hasText: "TD-02.5" })).toBeVisible();
  // The map also wins over #614's head.ref, which names TD-10.1.
  await expect(page.locator(".kb-story", { hasText: "TD-10.5" })).toBeVisible();
  await expect(page.locator(".kb-story", { hasText: "TD-10.1" })).toHaveCount(0);
  // #616 has no determinable number: it stays under Unnumbered.
  const unknown = page.locator(".kb-story", { hasText: "credits-link click" });
  await expect(unknown).toBeVisible();
  await expect(unknown).toHaveAttribute("data-group", "Unnumbered");
  await expect(page.locator(".kb-group", { hasText: "Unnumbered" }).first()).toBeVisible();

  // The lane counts are the census (ledger + map + window):
  // 19 stories and 47 tasks — distinct numbers, and neither is
  // the 3-pull fixture window length.
  await expect(page.getByRole("button", { name: /19 stories, 47 tasks/ })).toBeVisible();
  await expect(
    page.getByText("Counts include the checked-in ledger plus the last 100 updated PRs"),
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
