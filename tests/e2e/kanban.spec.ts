import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * /kanban — the build board (item 10, round 2): the hidden,
 * flag-gated Kanban of 18 plain-English stories and their 45
 * subtasks, with the live GitHub overlay over the snapshot.
 *
 * Runs against the built Pages artifact. The board ships dark:
 * FLAG_DEFAULTS has buildKanban false, so this spec fulfils
 * flags.json with the shipped payload plus buildKanban true —
 * this spec only; production is untouched.
 *
 * api.github.com is ABORTED by default here, so tests that do
 * not serve the fixtures run the overlay's honest fallback path
 * deterministically: the snapshot picture under its snapshot
 * stamp. The fixture-live test instead serves the recorded
 * GitHub responses from src/build-board/__fixtures__/github/
 * (real data, recorded 2026-11-23) through page.route — one
 * handler per pulls/{n} lookup and one for branches — and
 * proves the overlay reproduces the snapshot's Done picture
 * exactly: 2 stories in Done, 11 architecture subtasks Done.
 * No test in this file ever reaches the real GitHub.
 */
test.setTimeout(180_000);

const KANBAN_URL = "http://127.0.0.1:4123/Meridian/kanban";

const pullsFixture = JSON.parse(
  readFileSync("src/build-board/__fixtures__/github/pulls-by-number.json", "utf8"),
) as { pulls: Record<string, unknown> };
const branchesFixture = JSON.parse(
  readFileSync("src/build-board/__fixtures__/github/branches.json", "utf8"),
) as { branches: unknown };

/** Serve the recorded GitHub responses for this test's context. */
async function serveGithubFixtures(context: import("playwright/test").BrowserContext) {
  // One handler for every pulls/{n} lookup: the number comes
  // from the URL, the body from the recorded fixture. A number
  // the recording doesn't hold is a 404 — which fails the whole
  // live check, exactly as a missing PR would against the API.
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\/\d+/, async (route) => {
    const match = /\/pulls\/(\d+)/.exec(route.request().url());
    const body = match ? pullsFixture.pulls[match[1]] : undefined;
    if (body === undefined) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Not Found" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/branches(\?|$)/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(branchesFixture.branches),
    }),
  );
}

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
    // scrolls sideways, at any width.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  }
  // The real shell, not a mock frame: the shared header + footer.
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("footer").first()).toBeVisible();
});

test("fixture-live overlay: Done holds exactly 2 stories and 11 architecture subtasks", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Registered after the beforeEach abort, so these win dispatch
  // for their endpoints.
  await serveGithubFixtures(context);
  await openKanban(page);

  // The stamp turns live once the recorded check completes.
  await expect(page.locator(".kb-stamp")).toHaveText(/live · checked/);

  // The Done column holds exactly 2 story cards.
  await expect(page.locator('.kb-col[data-col="Done"] .kb-story')).toHaveCount(2);

  // Expanded, the architecture lane shows exactly 11 subtasks
  // whose column chip says Done — the snapshot's own picture,
  // reproduced by the overlay from the recorded responses.
  await expandAllStories(page);
  await expect(
    page.locator('.kb-story[data-lane="architecture"] .kb-sub .kb-chip-col[data-col="Done"]'),
  ).toHaveCount(11);
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
