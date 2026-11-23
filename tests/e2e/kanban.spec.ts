import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * /kanban — the build board (item 10): the hidden, flag-gated
 * Kanban of the 45 handover work items, with the live GitHub
 * overlay over the bundled snapshot.
 *
 * Runs against the built Pages artifact. The board ships dark:
 * FLAG_DEFAULTS has buildKanban false, so this spec fulfils
 * flags.json with the shipped payload plus buildKanban true —
 * this spec only; production is untouched.
 *
 * api.github.com is ABORTED by default here, so every test that
 * does not fulfil it runs the overlay's honest fallback path
 * deterministically: the snapshot picture under its
 * "snapshot from <date>" stamp. The live test fulfils the pulls
 * and branches endpoints with fixture JSON instead — PR 571 as
 * an open draft — and proves its card moves to In progress and
 * the stamp turns live. No test in this file ever reaches the
 * real GitHub.
 *
 * The snapshot baseline is locked to the seed (src/build-board/
 * kanban.json): 45 cards, 19 of them in Backlog.
 */
test.setTimeout(180_000);

const KANBAN_URL = "http://127.0.0.1:4123/Meridian/kanban";
const CARD_571_TITLE = "Phase 1 Part B: game-app onto storage port (prompt 01)";

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
  await expect(page.locator(".kb-card").first()).toBeVisible();
}

test("renders all 45 cards in five columns inside the shared shell, at four viewports", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await openKanban(page);
    await expect(page.getByRole("heading", { name: "Build board" })).toBeVisible();
    await expect(page.locator(".kb-card")).toHaveCount(45);
    await expect(page.locator(".kb-col")).toHaveCount(5);
    for (const col of ["Backlog", "Blocked", "In progress", "In review", "Done"]) {
      await expect(page.locator(`.kb-col[data-col="${col}"]`)).toHaveCount(1);
    }
    // The real shell, not a mock frame: the shared header + footer.
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("footer").first()).toBeVisible();
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

  // The stamp never claims liveness: it names the snapshot's date.
  await expect(page.locator(".kb-stamp")).toHaveText(/snapshot from \d{4}-\d{2}-\d{2}/);
  await expect(page.locator(".kb-card")).toHaveCount(45);
  // The snapshot's own picture: PR 571's card still sits in
  // In review, where the snapshot put it.
  await expect(
    page.locator('.kb-col[data-col="In review"] .kb-card', { hasText: CARD_571_TITLE }),
  ).toHaveCount(1);
  // The overlay DID try — fallback honesty, not absence of the feed.
  await expect.poll(() => githubCalled).toBe(true);
});

test("live overlay: PR 571 open as a draft moves its card to In progress", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Fixture GitHub: PR 571 open + draft on its branch, and the
  // branch list carrying that branch. Registered after the
  // beforeEach abort, so these win dispatch for their endpoints.
  await context.route(
    "https://api.github.com/repos/veeresh-bikkaneti/Meridian/pulls*",
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            number: 571,
            state: "open",
            draft: true,
            merged_at: null,
            head: { ref: "phase1/ports-part-b" },
          },
        ]),
      }),
  );
  await context.route(
    "https://api.github.com/repos/veeresh-bikkaneti/Meridian/branches*",
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ name: "main" }, { name: "phase1/ports-part-b" }]),
      }),
  );
  await openKanban(page);

  await expect(
    page.locator('.kb-col[data-col="In progress"] .kb-card', { hasText: CARD_571_TITLE }),
  ).toHaveCount(1);
  await expect(
    page.locator('.kb-col[data-col="In review"] .kb-card', { hasText: CARD_571_TITLE }),
  ).toHaveCount(0);
  await expect(page.locator(".kb-card")).toHaveCount(45);
  // And the stamp says so: live, with the time it was checked.
  await expect(page.locator(".kb-stamp")).toHaveText(/live · checked/);
});

test("free to claim shows only Backlog cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openKanban(page);

  await page.getByRole("button", { name: /Free to claim/ }).click();

  // Every card still on the board lives in the Backlog column —
  // the seed's 19 — and no other column holds a card.
  await expect(page.locator('.kb-col:not([data-col="Backlog"]) .kb-card')).toHaveCount(0);
  await expect(page.locator('.kb-col[data-col="Backlog"] .kb-card')).toHaveCount(19);
  await expect(page.locator(".kb-card")).toHaveCount(19);
});

