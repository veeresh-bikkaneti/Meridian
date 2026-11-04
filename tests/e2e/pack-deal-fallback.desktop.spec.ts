import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * REGRESSION — GeoDetective deck identity (issue #336; owner report
 * 2026-11-03: a core case, index 186 Vladivostok, was dealt in a
 * session the player had set to the Capitals deck).
 *
 * The fallback itself is design-of-record (docs/story-packs.md §0: a
 * pack is additive, never load-bearing — if a pack fetch fails, the
 * game plays the core game). The defect was the SILENCE: nothing on
 * the case screen named the deck the open case came from, so a core
 * case dealt under a Capitals pick looked like a Capitals case.
 *
 * The invariant pinned here: a core case is never PRESENTED as a
 * Capitals case.
 *
 * Presentation (owner wording cure, 2026-11-04 — the first version's
 * "Deck: X" header label + shelf line + fallback notice spoke over
 * each other and confused the owner): exactly ONE plain sentence,
 * in one place (data-testid "case-source-line"), names where the
 * open case came from. A healthy case gets "This case is from …";
 * a fallback case gets the fallback notice in the same spot, and
 * while it is up the shelf's own status line stays empty so only
 * one message speaks. There is no "Deck:" header label any more.
 * (a) control — manifest healthy: the chip tap deals the pack head
 *     (431), stamped "capitals", and the source sentence names the
 *     Capitals deck.
 * (b) fallback — the deal path's manifest fetch dies after the
 *     shelf's own fetch (the two are separate fetches of the same
 *     URL): core 186 IS dealt (§0), BUT the one sentence is the
 *     fallback notice and the shelf line is silent.
 * (c) the pick remains "capitals" after a fallback deal, so the
 *     next deal retries the pack — and once the manifest recovers,
 *     that next deal deals the pack case, the source sentence names
 *     the Capitals deck again.
 *
 * Scenario mirrors the live screenshot: the loop store holds a
 * FINISHED case, the player's stored pick is the Capitals pack
 * (activeDeckId "capitals"), the pack deck's head is 431, and the
 * core deck's head is 186.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
const REAL_PACK_MANIFEST = readFileSync(
  path.resolve("public/packs/capitals/manifest.json"),
  "utf8",
);
const FALLBACK_NOTICE =
  "Capitals couldn’t load just now — this case is from All cases instead. Your next case will try Capitals again.";
const PACK_SOURCE_LINE = "This case is from your Capitals deck.";
const CORE_SOURCE_LINE = "This case is from All cases.";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/**
 * Serve the real pack manifest to the first requester (the shelf),
 * then abort every later request (the deal path's resolution) until
 * `state.recovered` flips true. Returns the mutable state so a test
 * can let the pack "come back" mid-scenario.
 */
async function stubPackManifestDiesAfterFirstFetch(
  page: import("playwright/test").Page,
): Promise<{ recovered: boolean }> {
  const state = { recovered: false };
  let served = 0;
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    served += 1;
    if (state.recovered || served === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: REAL_PACK_MANIFEST,
      });
    } else {
      await route.abort();
    }
  });
  return state;
}

async function stubPackManifestAlways(
  page: import("playwright/test").Page,
): Promise<void> {
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: REAL_PACK_MANIFEST,
    });
  });
}

/** Seed: finished case on the desk, Capitals picked, pack head 431,
 * core head 186 — the owner's screenshot state, minimized. */
async function seedFinishedCaseWithCapitalsPick(
  page: import("playwright/test").Page,
): Promise<void> {
  const clue218 = JSON.parse(
    readFileSync(path.resolve("dist/client/loop/clues/218.json"), "utf8"),
  ) as { placeId: string };
  await page.addInitScript(
    (placeId) => {
      // One-shot per tab: a reload inside a scenario must keep the
      // state the scenario played into, not re-seed over it.
      if (sessionStorage.getItem("meridian.packFallbackSeeded")) return;
      sessionStorage.setItem("meridian.packFallbackSeeded", "1");
      localStorage.setItem(
        "meridian.loop.v2",
        JSON.stringify({
          deck: { deck: [186], cycle: 1, cycleCompleted: 0 },
          packDecks: {
            capitals: { deck: [431, 388], cycle: 1, cycleCompleted: 5 },
          },
          activeDeckId: "capitals",
          current: {
            index: 218,
            cycle: 1,
            guesses: [
              { name: "Ankara", placeId, distKm: 0, octant: "north", warmer: null },
            ],
            status: "won",
            cluesRevealed: 1,
            completedAt: "2026-11-03",
            streakEndedAt: null,
            completedCycle: false,
          },
          streak: 1,
          bestStreak: 1,
          totals: { solved: 3, lost: 0 },
        }),
      );
    },
    clue218.placeId,
  );
}

async function openLoopOnReveal(page: import("playwright/test").Page): Promise<void> {
  await page.goto(BASE);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pack-shelf-status")).toHaveText(
    "Tap a deck chip to start your next case.",
  );
  const pack = page.getByTestId("pack-chip-capitals");
  await expect(pack).toBeVisible({ timeout: 15_000 });
  await expect(pack).toHaveAttribute("aria-pressed", "true");
}

async function readStore(page: import("playwright/test").Page): Promise<any> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("meridian.loop.v2")!));
}

async function waitForPlaying(page: import("playwright/test").Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
      return s.current && s.current.status === "playing";
    },
    { timeout: 30_000 },
  );
}

test("control: pack manifest healthy -> chip tap deals the pack head (431), source sentence names Capitals", async ({
  page,
}) => {
  await stubPackManifestAlways(page);
  await seedFinishedCaseWithCapitalsPick(page);
  await openLoopOnReveal(page);

  await page.getByTestId("pack-chip-capitals").click();
  await waitForPlaying(page);
  const store = await readStore(page);
  expect(store.current.index).toBe(431);
  expect(store.current.deckId).toBe("capitals");
  expect(store.activeDeckId).toBe("capitals");
  // The one deck signal: a plain sentence naming where this case
  // came from — the Capitals deck, because it really is one.
  await expect(page.getByTestId("case-source-line")).toHaveText(PACK_SOURCE_LINE);
  // The old multi-signal header label is gone entirely.
  await expect(page.getByTestId("case-deck-label")).toHaveCount(0);
});

test("fallback: deal-path manifest fetch dies -> core 186 dealt, the one sentence is the fallback notice, shelf line silent", async ({
  page,
}) => {
  await stubPackManifestDiesAfterFirstFetch(page);
  await seedFinishedCaseWithCapitalsPick(page);
  await openLoopOnReveal(page);

  await page.getByTestId("pack-chip-capitals").click();
  await waitForPlaying(page);
  const store = await readStore(page);
  // §0 holds: the core case IS dealt (the core deck's head), stamped
  // as a core case, while the pick stays "capitals".
  expect(store.current.index).toBe(186);
  expect(store.current.deckId).toBeUndefined();
  expect(store.activeDeckId).toBe("capitals");
  // The fix: the screen never presents this core case as a Capitals
  // case — the ONE deck signal is the fallback notice, in plain
  // words, spoken via role="status".
  const notice = page.getByTestId("case-source-line");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(FALLBACK_NOTICE);
  await expect(notice).toHaveAttribute("role", "status");
  // No second signal competes with it: no "Deck:" header label, and
  // the shelf's next-case line is suppressed while the notice is up.
  await expect(page.getByTestId("case-deck-label")).toHaveCount(0);
  await expect(page.getByTestId("pack-shelf-status")).toHaveText("");
});

test("pick survives a fallback deal: the next deal retries the pack and deals it once it recovers", async ({
  page,
}) => {
  const manifestState = await stubPackManifestDiesAfterFirstFetch(page);
  await seedFinishedCaseWithCapitalsPick(page);
  await openLoopOnReveal(page);

  // First deal falls back to core 186 under the Capitals pick.
  await page.getByTestId("pack-chip-capitals").click();
  await waitForPlaying(page);
  let store = await readStore(page);
  expect(store.current.index).toBe(186);
  // The pick itself is untouched by the fallback — that is what makes
  // the next deal a retry of the pack rather than a silent switch.
  expect(store.activeDeckId).toBe("capitals");
  await expect(page.getByTestId("pack-chip-capitals")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("case-source-line")).toHaveText(FALLBACK_NOTICE);

  // Finish the fallback case on the desk (same minimized shape the
  // seed uses for a won case) and let the pack manifest recover.
  const clue186 = JSON.parse(
    readFileSync(path.resolve("dist/client/loop/clues/186.json"), "utf8"),
  ) as { placeId: string };
  await page.evaluate((placeId) => {
    const s = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    s.current = {
      ...s.current,
      guesses: [
        { name: "Vladivostok", placeId, distKm: 0, octant: "north", warmer: null },
      ],
      status: "won",
      cluesRevealed: 1,
      completedAt: "2026-11-03",
    };
    localStorage.setItem("meridian.loop.v2", JSON.stringify(s));
  }, clue186.placeId);
  manifestState.recovered = true;
  await page.reload();
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 30_000 });
  // The reveal of the fallback case still names its real source:
  // the plain core sentence (the deal-time notice itself belongs to
  // the session that dealt it and does not survive the reload).
  await expect(page.getByTestId("case-source-line")).toHaveText(CORE_SOURCE_LINE);

  // The next deal retries the pack — and now deals it.
  await page.getByTestId("pack-chip-capitals").click();
  await waitForPlaying(page);
  store = await readStore(page);
  expect(store.current.index).toBe(431);
  expect(store.current.deckId).toBe("capitals");
  expect(store.activeDeckId).toBe("capitals");
  await expect(page.getByTestId("case-source-line")).toHaveText(PACK_SOURCE_LINE);
});
