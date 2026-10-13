import { expect, type Page } from "playwright/test";
import { clickNextPlace, commitPin, readPhase } from "./helpers";

/**
 * Shared helpers for the WS-0 Globe band-switch specs
 * (globe-band-switch.desktop.spec.ts, globe-promotion-offline.desktop.spec.ts).
 * Kept out of helpers.ts, which these specs must not edit.
 */

const DROP_KEY = "meridian.drop";

/** The id of the place the last committed pin answered. */
export async function readDropPlaceId(page: Page): Promise<string | null> {
  return page.evaluate((k) => {
    const raw = sessionStorage.getItem(k);
    const drop = raw ? JSON.parse(raw) : null;
    return typeof drop?.placeId === "string" ? (drop.placeId as string) : null;
  }, DROP_KEY);
}

/**
 * The one-time "Your first discovery!" overlay (status region, "Close
 * celebration" button) appears on the player's first hit of the session and
 * does not auto-dismiss. It blocks "Next place", so close it the way a player
 * would. No-op when absent.
 */
export async function dismissDiscoveryIfPresent(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible()) {
    await close.click();
    await expect(close).toBeHidden({ timeout: 10_000 });
  }
}

/**
 * Answer the current question with the (500, 400) miss tap and record the id
 * of every place answered, in order. The tap is a miss unless a Globe place
 * sits inside its 750 km radius; then the player advances past the hit (as
 * commitMiss does) and the answered id is recorded too. Returns the answered
 * ids; the last one is the miss.
 */
export async function answerMissRecorded(page: Page): Promise<string[]> {
  const answered: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const { phase } = await commitPin(page, 500, 400);
    const id = await readDropPlaceId(page);
    if (id) answered.push(id);
    if (phase === "done") return answered;
    // Rare hit: close the first-discovery overlay if it is up, then advance.
    await dismissDiscoveryIfPresent(page);
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("answerMissRecorded: (500, 400) hit three places in a row");
}
