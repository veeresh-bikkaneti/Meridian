import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective unlimited-mode deploy-gate E2E.
 *
 * Deterministic puzzles via the `?loop-puzzle=<index>` seam (inert in
 * production — an absent or invalid value deals from the deck):
 *   ?loop-puzzle=218 -> Ankara (geonames:323786)
 *   ?loop-puzzle=219 -> Tarija (geonames:3903320)
 *
 * The unlimited model: mysteries deal from a shuffled 387-puzzle deck
 * persisted under `meridian.loop.v2` (no UTC-day keying). The retired
 * `?loop-date=` seam is gone.
 *
 * The map is the primary guess surface: the jump search flies the camera
 * and opens the confirm sheet; tapping the map resolves the nearest
 * labeled place through the E2E seam (`__loopMap` on the map element).
 * The built Pages artifact is served from disk (see helpers.ts); the loop
 * data (manifest, clues, names index) ships in dist/client/loop/.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Force the clipboard share path (mirrors endgame-share.spec.ts): the
  // native sheet is unavailable in headless Chromium.
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    } catch {
      /* navigator.share stays; the test asserts the path taken instead */
    }
  });
  await serveBuiltArtifact(context);
});

/** Open the GeoDetective; `puzzle` pins the deal via the ?loop-puzzle= seam. */
async function openLoop(page: import("playwright/test").Page, puzzle?: string) {
  await page.goto(puzzle ? `${BASE}?loop-puzzle=${puzzle}` : BASE);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({ timeout: 30_000 });
  // The first clue card is visible once the clue file loads.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  // The Detective's Atlas map is the primary guess surface.
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

function searchBox(page: import("playwright/test").Page) {
  return page.getByRole("combobox", { name: "Search the map" });
}

/**
 * Jump-search to a place (flies the camera + opens the confirm sheet),
 * then confirm. The jump never burns a guess by itself — only the sheet's
 * button does.
 */
async function guessViaMap(page: import("playwright/test").Page, query: string) {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option").first();
  // The 11 MB name index parses on first focus; allow headroom on slow VMs.
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  // Jump auto-selects: the confirm bottom sheet opens.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** The v2 store blob from the page's localStorage. */
async function loopStore(page: import("playwright/test").Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("meridian.loop.v2")!));
}

/** Resolve the open mystery's target entry from the guess index. */
async function targetEntry(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    const clue = await fetch(`loop/clues/${store.current.index}.json`).then((r) => r.json());
    const names = await fetch("loop/names.json").then((r) => r.json());
    return names.find((e: { id: string }) => e.id === clue.placeId) as {
      n: string;
      id: string;
      r: string;
    };
  });
}

/**
 * Guess the resolved target through the search box. The query is the
 * entry's normalized name; the exact option is disambiguated by region so
 * a same-named bigger city can never steal the pick.
 */
async function guessTarget(
  page: import("playwright/test").Page,
  entry: { n: string; r: string },
) {
  const box = searchBox(page);
  await box.click();
  await box.fill(entry.n);
  const options = page.getByRole("option").filter({ hasText: entry.r });
  await expect(options.first()).toBeVisible({ timeout: 30_000 });
  const texts = await options.allTextContents();
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const suffix = `, ${entry.r}`;
  let idx = texts.findIndex(
    (t) => t.endsWith(suffix) && norm(t.slice(0, t.length - suffix.length)) === entry.n,
  );
  if (idx === -1) idx = 0;
  await options.nth(idx).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** Famous-place queries guaranteed not to be the target (by place id). */
async function wrongQueries(
  page: import("playwright/test").Page,
  targetId: string,
  count = 5,
): Promise<string[]> {
  return page.evaluate(
    async ({ targetId, count }: { targetId: string; count: number }) => {
      const names = await fetch("loop/names.json").then((r) => r.json());
      const cands = [
        "paris",
        "tokyo",
        "sydney",
        "cairo",
        "new york",
        "london",
        "moscow",
        "beijing",
        "mumbai",
        "lagos",
      ];
      const out: string[] = [];
      for (const q of cands) {
        const e = names.find((x: { n: string }) => x.n === q);
        if (e && e.id !== targetId) out.push(q);
        if (out.length === count) break;
      }
      return out;
    },
    { targetId, count },
  );
}

/** Drive the map camera deterministically through the E2E seam. */
async function jumpCamera(
  page: import("playwright/test").Page,
  lon: number,
  lat: number,
  zoom: number,
) {
  await page.evaluate(
    ([lo, la, z]) => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap: { jumpTo(o: unknown): void };
      };
      el.__loopMap.jumpTo({ center: [lo, la], zoom: z });
    },
    [lon, lat, zoom],
  );
}

/** Tap the map canvas center (resolves the nearest labeled place). */
async function tapMapCenter(page: import("playwright/test").Page) {
  await page.locator('[data-testid="loop-map"] canvas').click();
}

/** Click "Share result" (clipboard path) and return the shared text. */
async function sharedText(page: import("playwright/test").Page): Promise<string> {
  await page.getByRole("button", { name: "Share result" }).click();
  await expect(page.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

async function guessCount(page: import("playwright/test").Page): Promise<number> {
  return page.getByRole("region", { name: "Your guesses" }).getByRole("listitem").count().catch(() => 0);
}

/** Ring features on the deduction surface. Polls until the GeoJSON source
 * exists, finishes (re)tiling after setData, and reports its features —
 * all three are asynchronous, so a single read races. */
async function ringFeatureCount(page: import("playwright/test").Page): Promise<number> {
  const handle = await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap?: {
          getSource(id: string): unknown;
          querySourceFeatures(id: string): unknown[];
        };
      } | null;
      const m = el?.__loopMap;
      if (!m || !m.getSource("loop-rings")) return 0;
      try {
        return m.querySourceFeatures("loop-rings").length;
      } catch {
        return 0;
      }
    },
    undefined,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as number;
}

/** Expected share heading for a mystery completed right now (UTC). */
function expectedShareHeading(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `meridian geodetective ${month} ${now.getUTCDate()}`;
}

test("loop-puzzle seam pins the puzzle; header shows the case number", async ({ page }) => {
  await openLoop(page, "218");
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toContainText(
    "capital of Turkey",
  );
  // Unlimited era: the header is the case counter, not a UTC date.
  await expect(page.getByText("Case #1")).toBeVisible();
  await expect(page.getByText(/· UTC/)).toHaveCount(0);
  // The seam skips the deck: no pop, deck still full.
  const store = await loopStore(page);
  expect(store.current.index).toBe(218);
  expect(store.deck.deck).toHaveLength(387);
});

test("win path: seam deal, clues unlock in order, share formats, streak, Next mystery deals a different puzzle", async ({
  page,
}) => {
  await openLoop(page, "218"); // Ankara

  // Clue 1 visible; clue 2 locked before any guess.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toContainText(
    "capital of Turkey",
  );
  await expect(page.getByRole("article", { name: /Clue 2: Climate \(locked\)/ })).toContainText(
    "Unlocks after your next guess.",
  );

  // Wrong guess 1: Paris via the map. Far from Ankara -> red square in share.
  await guessViaMap(page, "paris");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your guesses" }).getByText("Paris, France"),
  ).toBeVisible();
  // The deduction surface drew the miss ring.
  expect(await ringFeatureCount(page)).toBeGreaterThan(0);

  // Clue 2 unlocked after the first guess; clue 3 still locked.
  await expect(
    page.getByRole("article", { name: /Clue 2: Climate/ }).getByText("Unlocks after"),
  ).toHaveCount(0);
  await expect(page.getByRole("article", { name: /Clue 3: History \(locked\)/ })).toContainText(
    "Unlocks after your next guess.",
  );

  // Duplicate: Paris again must not consume a guess.
  await guessViaMap(page, "paris");
  // The confirm still opens (the sheet doesn't know); confirming is rejected.
  await expect(page.getByText(/You already guessed Paris/)).toBeVisible();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(1);

  // Correct guess: Ankara.
  await guessViaMap(page, "ankara");
  await expect(page.getByRole("heading", { name: "Ankara, Türkiye" })).toBeVisible();
  await expect(page.getByText("🎯 You found it!")).toBeVisible();
  await expect(page.getByText("Solved in 2 of 5 guesses.")).toBeVisible();
  await expect(page.getByText("🔥 Streak: 1")).toBeVisible();

  // All clues revealed on a finished mystery (no locked cards promising a next guess).
  await expect(page.getByText("Unlocks after your next guess.")).toHaveCount(0);

  // Completion persisted: streak, totals, share date.
  const won = await loopStore(page);
  expect(won.streak).toBe(1);
  expect(won.totals).toEqual({ solved: 1, lost: 0 });
  expect(won.current.status).toBe("won");
  expect(won.deck.cycleCompleted).toBe(1);

  // Share text: heading with the UTC completion date, site URL, graded grid.
  const share = await sharedText(page);
  expect(share).toContain(expectedShareHeading());
  expect(share).toContain("https://veeresh-bikkaneti.github.io/Meridian/");
  expect(share).toContain("🟥🟩⬜⬜⬜ solved in 2");

  // The hook: "🔎 Next mystery" deals a DIFFERENT puzzle from the real deck.
  await page.getByRole("button", { name: "🔎 Next mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Guess 1 of 5")).toBeVisible();
  const next = await loopStore(page);
  expect(next.current.index).not.toBe(218);
  expect(next.deck.deck).toHaveLength(386);
  expect(next.current.status).toBe("playing");
  await expect(page.getByText("Case #2")).toBeVisible();
});

test("real deck deal: loss path, streak reset, Next mystery deals a different puzzle", async ({
  page,
}) => {
  // No seam: a genuine deck deal pops the deck.
  await openLoop(page);
  const dealt = await loopStore(page);
  expect(dealt.deck.deck).toHaveLength(386);
  expect(dealt.current.status).toBe("playing");
  const firstIndex = dealt.current.index as number;

  // Five wrong guesses, none of which can be the target.
  const entry = await targetEntry(page);
  for (const q of await wrongQueries(page, entry.id)) {
    await guessViaMap(page, q);
  }

  await expect(page.getByText("Out of guesses")).toBeVisible();
  // Cold start: no streak to name, so no reset line — but the loss is recorded.
  await expect(page.getByText(/Streak reset/)).toHaveCount(0);
  // The answer is looked up from the guess index on a loss.
  await expect(page.getByRole("heading", { name: entry.r })).toBeVisible({ timeout: 15_000 });
  // No locked cards remain on a finished mystery.
  await expect(page.getByText("Unlocks after your next guess.")).toHaveCount(0);

  const lost = await loopStore(page);
  expect(lost.streak).toBe(0);
  expect(lost.totals).toEqual({ solved: 0, lost: 1 });

  const share = await sharedText(page);
  expect(share).toContain(expectedShareHeading());
  expect(share).toMatch(/🟥{5} not solved/);

  // Next mystery: a different real-deck puzzle, deck shrinks again.
  await page.getByRole("button", { name: "🔎 Next mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  const next = await loopStore(page);
  expect(next.current.index).not.toBe(firstIndex);
  expect(next.deck.deck).toHaveLength(385);
  await expect(page.getByText("Case #2")).toBeVisible();
});

test("real deck deal: win path via the resolved target", async ({ page }) => {
  await openLoop(page);
  const entry = await targetEntry(page);
  await guessTarget(page, entry);

  await expect(page.getByText("🎯 You found it!")).toBeVisible();
  await expect(page.getByText("Solved in 1 of 5 guesses.")).toBeVisible();
  await expect(page.getByText("🔥 Streak: 1")).toBeVisible();

  const share = await sharedText(page);
  expect(share).toContain(expectedShareHeading());
  expect(share).toContain("🟩⬜⬜⬜⬜ solved in 1");

  // Next mystery deals onward from the deck.
  const wonIndex = (await loopStore(page)).current.index as number;
  await page.getByRole("button", { name: "🔎 Next mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  const next = await loopStore(page);
  expect(next.current.index).not.toBe(wonIndex);
  expect(next.streak).toBe(1);
});

test("map tap selects the nearest labeled place; sheet confirm burns the guess", async ({
  page,
}) => {
  await openLoop(page, "218");

  // Fly to Paris deterministically, then tap the canvas center.
  await jumpCamera(page, 2.35, 48.85, 10);
  await tapMapCenter(page);

  // The confirm sheet names the resolved place; nothing guessed yet.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Paris", { timeout: 15_000 });
  expect(await guessCount(page)).toBe(0);

  // Cancel burns nothing.
  await page.getByRole("button", { name: "Not this one" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await guessCount(page)).toBe(0);

  // Tap again, confirm this time.
  await tapMapCenter(page);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(1);
});

test("ocean tap selects nothing and hints", async ({ page }) => {
  await openLoop(page, "218");

  // Mid-Atlantic at low zoom: no labeled place within tap range.
  await jumpCamera(page, -30, 30, 3);
  await tapMapCenter(page);

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/isn’t a labeled place/)).toBeVisible();
  expect(await guessCount(page)).toBe(0);
});

test("reload mid-game resumes the open mystery without re-dealing", async ({ page }) => {
  await openLoop(page, "218");
  await guessViaMap(page, "tokyo");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await ringFeatureCount(page)).toBeGreaterThan(0);

  await page.reload();
  // Reload-restore: the in-progress mystery comes back, not a reset.
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your guesses" }).getByText("Tokyo, Japan"),
  ).toBeVisible();
  // The ring repaints from the persisted guess coordinates.
  expect(await ringFeatureCount(page)).toBeGreaterThan(0);
  // Clue 2 is still unlocked after the restore.
  await expect(
    page.getByRole("article", { name: /Clue 2: Climate/ }).getByText("Unlocks after"),
  ).toHaveCount(0);
  // Resume never pops the deck again.
  const store = await loopStore(page);
  expect(store.current.index).toBe(218);
  expect(store.deck.deck).toHaveLength(387);
});

test("reload on a finished reveal re-renders the reveal, not a fresh deal", async ({
  page,
}) => {
  await openLoop(page, "218");
  await guessViaMap(page, "ankara");
  await expect(page.getByText("🎯 You found it!")).toBeVisible();

  await page.reload();
  // The reveal re-renders: same mystery acknowledged, streak intact.
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Solved in 1 of 5 guesses.")).toBeVisible();
  await expect(page.getByText("🔥 Streak: 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "🔎 Next mystery" })).toBeVisible();
  // Not a fresh deal: no guess input on a finished mystery.
  await expect(page.getByRole("combobox", { name: "Search the map" })).toHaveCount(0);
  const store = await loopStore(page);
  expect(store.current.index).toBe(218);
  expect(store.current.status).toBe("won");
});

test("leave and return: menu shows the resume variant; reload doesn't hijack", async ({
  page,
}) => {
  await openLoop(page, "218");
  await guessViaMap(page, "paris");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();

  // Leave explicitly: the menu offers to resume the case.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "▶️ Resume your case" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "▶️ Resume your case" })).toBeVisible({
    timeout: 30_000,
  });
  // The loop screen (not the menu's edition card) is closed: no map, no search.
  await expect(page.getByTestId("loop-map")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Search the map" })).toHaveCount(0);

  // Resuming restores the in-progress mystery.
  await page.getByRole("button", { name: "▶️ Resume your case" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
});

test("edition card shows the streak after a win", async ({ page }) => {
  await openLoop(page, "218");
  await guessViaMap(page, "ankara");
  await expect(page.getByText("🎯 You found it!")).toBeVisible();

  await page.getByRole("button", { name: "Editions" }).click();
  const card = page.getByRole("article").filter({ hasText: "GeoDetective" });
  await expect(card.getByText("🔥 Streak: 1")).toBeVisible();
  // The finished mystery is acknowledged: fresh deal, not resume.
  await expect(card.getByRole("button", { name: "🔎 Solve a mystery" })).toBeVisible();
});

test("loop state is namespaced: v2 key only, endless-run keys untouched, v1 archive inert", async ({
  page,
}) => {
  await openLoop(page, "218");
  await guessViaMap(page, "paris");

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain("meridian.loop.v2");
  expect(keys).not.toContain("meridian.run");
  expect(keys).not.toContain("meridian.drop");

  const store = await loopStore(page);
  expect(store.current.index).toBe(218);
  expect(store.current.guesses).toHaveLength(1);
  expect(store.current.status).toBe("playing");
  // Map-era guesses persist coordinates for the rings.
  expect(store.current.guesses[0].lon).toBeCloseTo(2.35, 1);
});

test("daily-era v1 archive is left untouched by an unlimited session", async ({
  page,
  context,
}) => {
  const v1 = JSON.stringify({
    "2026-10-01": { guesses: [], status: "won", cluesRevealed: 2 },
  });
  await context.addInitScript((blob) => {
    try {
      localStorage.setItem("meridian.loop.v1", blob);
    } catch {
      /* ignore */
    }
  }, v1);

  await openLoop(page, "218");
  await guessViaMap(page, "ankara");
  await expect(page.getByText("🎯 You found it!")).toBeVisible();
  await page.getByRole("button", { name: "🔎 Next mystery" }).click();
  await expect(page.getByText("Guess 1 of 5")).toBeVisible({ timeout: 30_000 });

  // The v1 archive is byte-identical; the unlimited session started clean.
  const after = await page.evaluate(() => localStorage.getItem("meridian.loop.v1"));
  expect(after).toBe(v1);
  const store = await loopStore(page);
  expect(store.streak).toBe(1);
  expect(store.totals).toEqual({ solved: 1, lost: 0 });
});

test("copy regression: no daily-era language anywhere in the edition", async ({
  page,
}) => {
  await openLoop(page, "218");
  const body = page.locator("body");
  await expect(body).not.toContainText(/today's mystery/i);
  await expect(body).not.toContainText(/midnight UTC/i);
  await expect(body).not.toContainText(/see you tomorrow/i);
  await expect(body).not.toContainText(/tomorrow's mystery/i);

  await guessViaMap(page, "ankara");
  await expect(page.getByText("🎯 You found it!")).toBeVisible();
  const reveal = page.locator("body");
  await expect(reveal).not.toContainText(/today's mystery/i);
  await expect(reveal).not.toContainText(/midnight UTC/i);
  await expect(reveal).not.toContainText(/see you tomorrow/i);
  await expect(reveal).not.toContainText(/tomorrow's mystery/i);
});

test("unknown search consumes nothing; no-match message is friendly", async ({ page }) => {
  await openLoop(page, "218");

  const box = searchBox(page);
  await box.click();
  await box.fill("xqzzy-not-a-place");
  await expect(page.getByText(/No places match/)).toBeVisible();
  // Enter with no suggestions must not submit (and there is no Guess button).
  await box.press("Enter");
  await expect(page.getByText("Guess 1 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(0);
});
