import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitPin,
  clickNextPlace,
  readPhase,
} from "./helpers";

/**
 * TEST cell — fix PR "storyteller greeting home-only"
 * (branch fix/storyteller-greeting-home-only).
 *
 * Owner ruling 2026-10-11: the storyteller greeting banner ("Gather round,
 * explorer! Every place hides a story. And this one? This one is a legend.")
 * is the storyteller's home-page narration — it must ONLY ever display on
 * the home page alongside the storyteller, never on the result card (where
 * it overlapped the card header) or anywhere else.
 *
 * Black-box journeys on a phone viewport (390×844):
 *  (a) home page → the storyteller home banner IS present;
 *  (b) play globe → drop pin → result card → the greeting banner is ABSENT
 *      and the result header has no overlapping dock element;
 *  (c) the result card still works (verdict headline visible, Next place
 *      advances) — behavior otherwise identical.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const GREETING_SNIPPET = "Gather round, explorer!";

/**
 * Verification 2026-10-11: helpers.commitMiss taps (500, 400), which is
 * off-viewport on a 390px phone — the pin never drops and the Drop button
 * stays disabled. Same contract (a near-certain miss, advance on a rare
 * hit), but tapping the visible globe at (195, 523), verified to place a
 * pin on 390×844.
 */
async function commitMissMobile(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { phase } = await commitPin(page, 195, 523);
    if (phase === "done") return;
    // Rare hit: move on and try the next place.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMissMobile: hit three places in a row");
}

test("home page shows the storyteller home banner", async ({ page }) => {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  // The home banner host (figure + greeting) renders on the home page.
  await expect(page.getByTestId("storyteller-home")).toBeVisible({
    timeout: 20_000,
  });
});

test("result card never renders the greeting banner", async ({ page }) => {
  await startGlobeRun(page);
  await commitMissMobile(page);
  // The result card mounts.
  const card = page.locator('section[aria-label="Result"]');
  await expect(card).toBeVisible({ timeout: 20_000 });

  // The greeting banner is absent — no dock narration on the result card.
  await expect(page.getByTestId("storyteller-narration")).toHaveCount(0);
  await expect(page.getByText(GREETING_SNIPPET)).toHaveCount(0);

  // The header is clean: no absolutely-positioned dock overlapping it.
  const header = card.locator(".result-header");
  await expect(header).toBeVisible();
  const dockOverlap = await page.evaluate(() => {
    const h = document.querySelector(".result-header");
    if (!h) return "no-header";
    const hr = h.getBoundingClientRect();
    // Any storyteller dock element intersecting the header rect?
    const docks = Array.from(
      document.querySelectorAll(".storyteller-dock"),
    ).filter((d) => {
      const r = d.getBoundingClientRect();
      return r.bottom > hr.top && r.top < hr.bottom && r.width > 0;
    });
    return docks.length;
  });
  expect(dockOverlap, "no storyteller dock may overlap the result header").toBe(
    0,
  );
});

test("result card still works without the greeting banner", async ({
  page,
}) => {
  await startGlobeRun(page);
  await commitMissMobile(page);
  const card = page.locator('section[aria-label="Result"]');
  await expect(card).toBeVisible({ timeout: 20_000 });
  // Verdict headline renders (the card's own content is intact).
  await expect(card.locator(".verdict-headline").first()).toBeVisible();
  // Advancing still works.
  await page.getByRole("button", { name: /next place/i }).click();
  await expect
    .poll(async () => {
      const phase = await page.evaluate(() =>
        document.documentElement.getAttribute("data-phase"),
      );
      return phase;
    }, { timeout: 20_000 })
    .not.toBe("story");
});
