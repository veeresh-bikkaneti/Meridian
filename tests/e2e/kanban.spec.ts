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
 * (real data, recorded 2026-11-23) through page.route — the
 * recent pulls list, a pulls/{n} fallback, and branches — and
 * proves the overlay reproduces the snapshot's Done picture
 * exactly: 2 stories in Done, 11 architecture subtasks Done.
 * A numbered pull and branch in auto-sync.json move their
 * subtasks without a kanban.json edit, and the C: seat chip
 * renders on the story card. No test in this file ever reaches
 * the real GitHub.
 */
test.setTimeout(180_000);

const KANBAN_URL = "http://127.0.0.1:4123/Meridian/kanban";

const pullsFixture = JSON.parse(
  readFileSync("src/build-board/__fixtures__/github/pulls-by-number.json", "utf8"),
) as { pulls: Record<string, unknown> };
const branchesFixture = JSON.parse(
  readFileSync("src/build-board/__fixtures__/github/branches.json", "utf8"),
) as { branches: unknown[] };
const autoSync = JSON.parse(
  readFileSync("src/build-board/__fixtures__/github/auto-sync.json", "utf8"),
) as { pulls: unknown[]; branches: unknown[] };

/** Serve the recorded GitHub responses for this test's context. */
async function serveGithubFixtures(context: import("playwright/test").BrowserContext) {
  // Recent pulls list (one call). A number the recording doesn't
  // hold falls through to pulls/{n}; a miss there is a 404,
  // which fails the whole live check.
  await context.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\?/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(autoSync.pulls),
    }),
  );
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
      body: JSON.stringify([...branchesFixture.branches, ...autoSync.branches]),
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

test("auto-matched pull and branch move their cards, and the seat chip fits", async ({
  page,
  context,
}) => {
  await serveGithubFixtures(context);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await openKanban(page);
    await expect(page.locator(".kb-stamp")).toHaveText(/live · checked/);

    const story = page.locator('.kb-story[data-story-id="arch-pages"]');
    const chip = story.locator('.kb-chip-seat[data-seat-tag="C:Opera"]');
    await chip.scrollIntoViewIfNeeded();
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText("C:Opera");
    const fit = await chip.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const card = el.closest(".kb-card");
      const cardRect = card?.getBoundingClientRect();
      return {
        chipOverflow: el.scrollWidth - el.clientWidth,
        left: rect.left,
        right: rect.right,
        cardLeft: cardRect?.left ?? 0,
        cardRight: cardRect?.right ?? 0,
        cardOverflow: card ? card.scrollWidth - card.clientWidth : 99,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(fit.pageOverflow).toBeLessThanOrEqual(1);
    expect(fit.chipOverflow).toBeLessThanOrEqual(1);
    expect(fit.cardOverflow).toBeLessThanOrEqual(1);
    expect(fit.left).toBeGreaterThanOrEqual(fit.cardLeft - 1);
    expect(fit.right).toBeLessThanOrEqual(fit.cardRight + 1);

    await expandAllStories(page);
    const retire = page.locator(".kb-sub", { hasText: "TD-09.1" });
    await expect(retire.locator('.kb-chip-col[data-col="In review"]')).toBeVisible();
    await expect(retire.getByRole("link", { name: "finishes #577" })).toBeVisible();
    const cva = page.locator(".kb-sub", { hasText: "TD-10.2" });
    await expect(cva.locator('.kb-chip-col[data-col="In progress"]')).toBeVisible();
  }
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
