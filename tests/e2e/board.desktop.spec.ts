import { test, expect } from "playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * /board — live scrum board + feature map (feat/live-scrum-board).
 *
 * Runs against the built Pages artifact. The GitHub API is mocked to
 * FAIL in every test here: the board must render all 8 lanes and all 46
 * stories from the snapshot alone, say it is showing the snapshot, and
 * never depend on the live fetch. The feature-request endpoint is
 * mocked too — the spec proves the form posts to /api/feature-request,
 * not that Discord received anything.
 */
test.setTimeout(180_000);

const BOARD_URL = "http://127.0.0.1:4123/Meridian/board?idle-ms=3600000";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // SPA fallback for the deep link (same pattern as the credits spec:
  // the static mirror has no deep-link server in this harness).
  const shell = readFileSync("dist/client/_shell.html");
  await context.route("**/Meridian/board*", async (route) => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ status: 200, body: shell, contentType: "text/html; charset=utf-8" });
    }
    return route.fallback();
  });
  // GitHub live data: fail it. The snapshot must carry the page.
  await context.route("https://api.github.com/**", async (route) => route.abort());
});

async function openBoard(page: import("playwright/test").Page) {
  await page.goto(BOARD_URL);
  await expect(page.getByTestId("board-page")).toBeVisible();
  await expect(page.getByTestId("board-live-line")).toContainText("snapshot");
}

test("board at 390px: list view renders all 8 lanes from the snapshot, no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);

  // Scrum columns carry the snapshot counts (18 done / 10 in progress /
  // 18 not started) even with GitHub unreachable.
  await expect(page.getByTestId("scrum-column-done").getByTestId("story-card")).toHaveCount(18);
  await expect(page.getByTestId("scrum-column-in-progress").getByTestId("story-card")).toHaveCount(10);
  await expect(page.getByTestId("scrum-column-not-started").getByTestId("story-card")).toHaveCount(18);

  await page.getByTestId("list-view-toggle").click();
  const list = page.getByTestId("board-list-view");
  await expect(list.getByTestId("board-lane")).toHaveCount(8);
  await expect(list.getByTestId("story-card")).toHaveCount(46);
  await expect(list).toContainText("Detective core");
  await expect(list).toContainText("Infra and process");

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("board at desktop: form posts to /api/feature-request (mocked)", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let postedUrl = "";
  let postedBody = "";
  await context.route("**/api/feature-request", async (route) => {
    postedUrl = route.request().url();
    postedBody = route.request().postData() ?? "";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, stored: true }),
    });
  });
  await openBoard(page);

  const form = page.getByTestId("feature-request-form");
  await form.locator("textarea").fill("A quiz about famous rivers, please");
  await form.locator("select").first().selectOption("7-10");
  await form.locator("select").nth(1).selectOption("Geography");
  await form.getByRole("button", { name: "Send idea" }).click();

  await expect(page.getByTestId("feature-request-sent")).toBeVisible();
  expect(postedUrl).toContain("/api/feature-request");
  const payload = JSON.parse(postedBody) as { idea: string; ageGroup: string; subject: string };
  expect(payload.idea).toBe("A quiz about famous rivers, please");
  expect(payload.ageGroup).toBe("7-10");
  expect(payload.subject).toBe("Geography");
  // No personal-data fields exist in the payload, by design.
  expect(Object.keys(payload).sort()).toEqual(["ageGroup", "idea", "subject", "turnstileToken", "website"]);
});

test("board 3D map: dragging the canvas changes the view, edges are drawn", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBoard(page);

  const canvas = page.getByTestId("feature-map-canvas");
  await expect(canvas).toBeVisible();
  // The snapshot encodes exactly 8 explicit PR-wait dependency edges.
  await expect(canvas).toHaveAttribute("data-edge-count", "8");

  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no box");
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
  await page.waitForTimeout(600);
  const before = await page.screenshot({ clip });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.38, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const after = await page.screenshot({ clip });
  expect(before.equals(after)).toBe(false);
});

test("board 3D map: clicking a story block highlights its dependency chain", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBoard(page);

  const canvas = page.getByTestId("feature-map-canvas");
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no box");

  // Aim at the "Holmes and Watson in math" block using the projected
  // node points the map publishes on the canvas — the story with the
  // richest recorded chain (it waits on PR 434 + PR 430). A couple of
  // nearby retries cover a front block shadowing the exact pixel.
  await page.waitForTimeout(800);
  const rawPoints = await canvas.getAttribute("data-node-points");
  if (!rawPoints) throw new Error("map published no node points");
  const points = JSON.parse(rawPoints) as { t: string; x: number; y: number }[];
  const target = points.find((p) => p.t === "Holmes and Watson in math");
  if (!target) throw new Error("node points do not include the math story");
  const selection = page.getByTestId("map-selection");
  let found = "";
  for (const dy of [0, -0.012, 0.012, -0.025, 0.025]) {
    await page.mouse.click(box.x + box.width * target.x, box.y + box.height * (target.y + dy));
    await page.waitForTimeout(250);
    found = await page.evaluate(
      () => document.querySelector('[data-testid="map-selection"]')?.textContent ?? "",
    );
    if (found.startsWith("Selected: Holmes and Watson in math.")) break;
  }
  expect(found).toContain("Waits on (explicit PR waits):");
  expect(found).toContain("Clue pacing and one voice at a time");
  expect(found).toContain("Math subject screen, 3 items per age group");
  expect(found).toContain("Shared voice channel (one speaker at a time)");
  await expect(canvas).toHaveAttribute("data-selected-story", "Holmes and Watson in math");
  await expect(selection).toContainText("Waits on (explicit PR waits):");
});

test("board issues page at 390px: groups by story, unmapped stays unmapped (network mocked)", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // The beforeEach shell pattern (**/Meridian/board*) does not cross the
  // "/" before "issues", so fulfil the SPA shell for this deep link too.
  const shell = readFileSync("dist/client/_shell.html");
  await context.route("**/Meridian/board/issues*", async (route) => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ status: 200, body: shell, contentType: "text/html; charset=utf-8" });
    }
    return route.fallback();
  });
  // Registered after beforeEach's abort route, so this one wins for
  // api.github.com: pulls payload for the pulls URL, issues payload
  // (including a PR-shaped item that must be filtered out) otherwise.
  await context.route("https://api.github.com/**", async (route) => {
    const url = route.request().url();
    const body = url.includes("/pulls")
      ? [
          { number: 434, state: "closed", merged_at: "2026-11-13T10:00:00Z", title: "Math screen PR" },
          { number: 430, state: "open", merged_at: null, title: "Voice channel PR" },
          { number: 999, state: "open", merged_at: null, title: "Unmapped PR" },
        ]
      : [
          {
            number: 344,
            state: "open",
            title: "A known open issue",
            html_url: "https://github.com/veeresh-bikkaneti/Meridian/issues/344",
          },
          {
            number: 999,
            state: "open",
            title: "Unmapped issue",
            html_url: "https://github.com/veeresh-bikkaneti/Meridian/issues/999",
          },
          { number: 436, state: "open", title: "PR smuggled via the issues endpoint", pull_request: { url: "x" } },
        ];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("http://127.0.0.1:4123/Meridian/board/issues?idle-ms=3600000");
  await expect(page.getByTestId("issues-page")).toBeVisible();

  const math = page.getByTestId("work-group").filter({ hasText: "Math subject screen" });
  await expect(math.getByTestId("work-item")).toHaveCount(1);
  await expect(math).toContainText("Math screen PR");
  await expect(math).toContainText("Merged");

  // PR 430 belongs to both stories whose snapshot entry lists it.
  await expect(
    page.getByTestId("work-group").filter({ hasText: "Clue pacing" }).getByTestId("work-item"),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("work-group").filter({ hasText: "Shared voice channel" }).getByTestId("work-item"),
  ).toHaveCount(1);

  const known = page.getByTestId("work-group").filter({ hasText: "Open issues 344 and 319" });
  await expect(known.getByTestId("work-item")).toHaveCount(1);
  await expect(known).toContainText("A known open issue");

  const unmapped = page.getByTestId("unmapped-group");
  await expect(unmapped.getByTestId("work-item")).toHaveCount(2);
  await expect(unmapped).toContainText("Unmapped PR");
  await expect(unmapped).toContainText("Unmapped issue");

  // The PR-shaped item from the issues endpoint is not an issue.
  await expect(page.getByTestId("issues-page")).not.toContainText("PR smuggled via the issues endpoint");

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("board with reduced motion: lands on the list view, no 3D canvas", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    await serveBuiltArtifact(context);
    const shell = readFileSync("dist/client/_shell.html");
    await context.route("**/Meridian/board*", async (route) => {
      if (route.request().isNavigationRequest()) {
        return route.fulfill({ status: 200, body: shell, contentType: "text/html; charset=utf-8" });
      }
      return route.fallback();
    });
    await context.route("https://api.github.com/**", async (route) => route.abort());
    const page = await context.newPage();
    await page.goto(BOARD_URL);
    await expect(page.getByTestId("board-page")).toBeVisible();
    await expect(page.getByTestId("board-list-view")).toBeVisible();
    await expect(page.getByTestId("board-list-view").getByTestId("story-card")).toHaveCount(46);
    await expect(page.getByTestId("feature-map-canvas")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

/** Total story cards across the three scrum columns. */
async function scrumCardCount(page: import("playwright/test").Page): Promise<number> {
  let n = 0;
  for (const status of ["not-started", "in-progress", "done"]) {
    n += await page.getByTestId(`scrum-column-${status}`).getByTestId("story-card").count();
  }
  return n;
}

/** The number in the header's Blocked tile (the fifth tile). */
async function readBlockedTile(page: import("playwright/test").Page): Promise<number> {
  const tile = page.locator(".board-tile").filter({ hasText: "Blocked" });
  await expect(tile).toHaveCount(1);
  return Number(((await tile.locator("b").textContent()) ?? "").trim());
}

test("board v2 search: a distinctive title word narrows the scrum columns", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBoard(page);
  const total = await scrumCardCount(page);
  expect(total).toBe(46);

  // "jitter" matches exactly one story across title/lane/owner in the
  // snapshot (verified against snapshot.json): "Held-finger jitter fix
  // on the clue berth". GitHub is aborted in this spec, so the snapshot
  // set is the set being searched.
  await page.locator(".board-search input").fill("jitter");
  const line = page.getByText(/Showing \d+ of \d+ stories/);
  await expect(line).toHaveText(`Showing 1 of ${total} stories`);
  const columns = page.locator(".board-columns");
  await expect(columns.getByTestId("story-card")).toHaveCount(1);
  await expect(columns).toContainText("Held-finger jitter fix on the clue berth");
  await expect(columns).not.toContainText("Physics spec");

  await page.locator(".board-search input").fill("");
  await expect(line).toHaveCount(0);
  await expect.poll(() => scrumCardCount(page)).toBe(total);
});

test("board v2 blocked-only filter: visible cards match the Blocked tile count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBoard(page);
  const total = await scrumCardCount(page);
  const blocked = await readBlockedTile(page);
  expect(blocked).toBeGreaterThan(0);
  expect(blocked).toBeLessThan(total);

  const toggle = page.getByRole("button", { name: "Blocked only" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Showing \d+ of \d+ stories/)).toHaveText(
    `Showing ${blocked} of ${total} stories`,
  );
  await expect.poll(() => scrumCardCount(page)).toBe(blocked);

  // Snapshot-specific title check, safe here because GitHub is aborted
  // in this spec so no live overlay can land: "Truce pennant port" has
  // no linked PRs of its own and waits (snapshot waitsOnIds) on two
  // in-progress stories, so it is blocked; "Physics spec" is done.
  const columns = page.locator(".board-columns");
  await expect(columns).toContainText("Truce pennant port");
  await expect(columns).not.toContainText("Physics spec");
});

test("board v2 inspector: card title opens it, Escape closes and returns focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBoard(page);

  const card = page.getByTestId("scrum-column-not-started").getByTestId("story-card").first();
  const titleButton = card.locator(".board-card-title-button");
  const title = ((await titleButton.textContent()) ?? "").trim();
  expect(title.length).toBeGreaterThan(0);
  await titleButton.click();

  const aside = page.locator(".board-inspector");
  await expect(aside).toBeVisible();
  await expect(aside.locator("h3")).toHaveText(title);
  await expect(aside).toContainText("Why this status:");
  await expect(aside).toContainText(
    /Snapshot status|Done —|In progress —|Keeps the snapshot status/,
  );
  await expect(aside.getByRole("button", { name: "Close story inspector" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(aside).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() ?? ""))
    .toBe(title);
});

test("board v2 at 390px: columns scroll inside their container, inspector stacks below", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  const internal = await page.evaluate(() => {
    const el = document.querySelector(".board-columns")!;
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  expect(internal.scroll).toBeGreaterThan(internal.client);

  const card = page.getByTestId("scrum-column-not-started").getByTestId("story-card").first();
  await card.locator(".board-card-title-button").click();
  const aside = page.locator(".board-inspector");
  await expect(aside).toBeVisible();
  const boxes = await page.evaluate(() => {
    const cols = document.querySelector(".board-columns")!.getBoundingClientRect();
    const ins = document.querySelector(".board-inspector")!.getBoundingClientRect();
    return { colsBottom: cols.bottom, asideTop: ins.top };
  });
  expect(boxes.asideTop).toBeGreaterThanOrEqual(boxes.colsBottom - 4);
  await page.keyboard.press("Escape");
  await expect(aside).toHaveCount(0);

  await page.getByTestId("list-view-toggle").click();
  const list = page.getByTestId("board-list-view");
  await expect(list.getByTestId("board-lane")).toHaveCount(8);
});

test("home loads no board code: no board chunks, feature-map chunk, or Turnstile requests", async ({
  page,
}) => {
  const urls: string[] = [];
  page.on("request", (req) => urls.push(req.url()));
  await page.goto(APP_NO_IDLE);
  await page.waitForTimeout(3000);
  expect(urls.filter((u) => /board-[A-Za-z0-9_-]+\.js/.test(u) || /feature-map-/.test(u))).toEqual(
    [],
  );
  expect(urls.filter((u) => u.includes("challenges.cloudflare.com"))).toEqual([]);
});

test("board v2 phase A screenshots (snapshot data, GitHub mocked off)", async ({ page }) => {
  const dir = path.resolve("..", "screenshots-A");
  mkdirSync(dir, { recursive: true });

  await page.setViewportSize({ width: 1280, height: 1600 });
  await openBoard(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(dir, "board-desktop.png") });

  // A story with linked PRs (355–358) and a status-why line.
  const doneCard = page
    .getByTestId("scrum-column-done")
    .getByTestId("story-card")
    .filter({ hasText: "Holmes and Watson pair in the game" });
  await doneCard.locator(".board-card-title-button").click();
  const aside = page.locator(".board-inspector");
  await expect(aside).toBeVisible();
  await expect(aside).toContainText("PR 355");
  await aside.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(dir, "inspector-open.png") });
  await page.keyboard.press("Escape");
  await expect(aside).toHaveCount(0);

  await page.getByRole("heading", { name: "Dependencies" }).scrollIntoViewIfNeeded();
  await expect(page.locator(".board-dep-row").first()).toBeVisible();
  await page.screenshot({ path: path.join(dir, "dependency-list.png") });

  // Resize the loaded page instead of re-navigating to the same URL:
  // a second goto lands on the app service worker and serves its 404
  // body in this harness. The responsive rules are pure CSS, so a
  // resize is the honest 390px render of the same page.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector(".board-columns")!;
        return el.scrollWidth > el.clientWidth;
      }),
    )
    .toBe(true);
  // Frame the scrum board itself: at 390px the header + Next 3 moves
  // fill the first screen, so scroll the columns into view — the
  // second column peeking at the right edge is the scroll cue.
  await page.getByRole("heading", { name: "Scrum board" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(dir, "board-390.png") });
});

test("no Home or game screen links to /board", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  // Home renders the game shell; give it a moment to mount, then check
  // the whole DOM for any board link.
  await page.waitForTimeout(3000);
  const boardLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]")).filter((a) =>
      (a.getAttribute("href") ?? "").includes("/board"),
    ).length;
  });
  expect(boardLinks).toBe(0);
});
