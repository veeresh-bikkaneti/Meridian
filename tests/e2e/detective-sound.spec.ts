import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  collectAudioRequests,
  detectivePlays,
  fulfillFlagsOn,
  installDetectiveRecorder,
  openSeamCase,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

/**
 * Sound Everywhere gate (PR C, staging rework council Q6 — the owner's
 * order: "mute and unmute should be available in each game edition, and
 * click on character should also act as mute or unmute").
 *
 * - (a) The existing SoundToggle now renders in-screen in GeoDetective
 *   (LoopScreen) and Cold Trail (TrailScreen); toggling flips the ONE
 *   persisted key `meridian.sound` both ways.
 * - (b) Tap-Holmes DURING a pair read stops the speaking clip
 *   immediately (the playing element is paused within 1 s of the tap —
 *   the old 1 Hz poll is gone), flushes the queued lines (ack/decode
 *   never play), and latches the slashed-speaker badge on the pair
 *   cluster. A second tap unmutes, clears the badge, and does NOT
 *   resume the stopped line.
 * - (c) Tap-Watson keeps its shipped replay behaviour and never mutes.
 * - (d) Tap-Holmes never fires a replay (the two hitboxes are separate
 *   elements; plays record is unchanged by a Holmes tap).
 * - (e) The pair-cluster speaker chip is a ≥44 px SoundToggle instance
 *   wired to the same master key: it mutes/unmutes and drives the
 *   badge, and it stays in sync with the Holmes alias.
 *
 * Speech is observed on the harness's play() record (detective-u10.ts).
 * The detectivePair flag is already true in the committed flags.json;
 * fulfillFlagsOn is kept for harness consistency with the sibling
 * detective specs.
 */

test.setTimeout(240_000);

const BASE = "http://127.0.0.1:4123/Meridian/";
const CLUE = "case-137/clue-1.mp3";
const ACK = "fixed/ack-1.mp3";
const DECODE = "fixed/decode-geography.mp3";

async function detectiveOnly(page: import("playwright/test").Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) => u.includes("/audio/detective/"));
}

function countIn(list: string[], needle: string): number {
  return list.filter((u) => u.includes(needle)).length;
}

async function soundKey(page: import("playwright/test").Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("meridian.sound"));
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("(a) GeoDetective in-screen toggle flips the persisted key both ways", async ({ page }) => {
  await page.goto(`${BASE}?loop-puzzle=137`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  const toggle = page.getByTestId("sound-toggle-loop");
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const box = await toggle.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);

  await toggle.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("on");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  console.log("[sound-a] LoopScreen toggle flipped meridian.sound off → on");
});

test("(a) Cold Trail in-screen toggle flips the persisted key both ways", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  const toggle = page.getByTestId("sound-toggle-trail");
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("on");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  console.log("[sound-a] TrailScreen toggle flipped meridian.sound off → on");
});

test("(b) tap-Holmes during a read stops speech immediately, badge latches, unmute does not resume", async ({
  page,
  context,
}) => {
  // Slow playback (0.25×): the clue read is genuinely in flight at tap
  // time — proven by the record holding the clue and no ack/decode yet.
  await installDetectiveRecorder(context, 0.25);
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await page.getByRole("article", { name: /Clue 1:/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await expect
    .poll(async () => countIn(await detectiveOnly(page), CLUE), { timeout: 120_000 })
    .toBe(1);
  const inFlight = await detectiveOnly(page);
  expect(countIn(inFlight, ACK)).toBe(0);
  expect(countIn(inFlight, DECODE)).toBe(0);

  // Holmes is at the clue-card station (READING) — tap his figure.
  const holmesBtn = page.getByTestId("detective-holmes-mute");
  await expect(holmesBtn).toHaveCount(1, { timeout: 15_000 });
  await expect(holmesBtn).toHaveAttribute("aria-label", "Mute sound");
  const box = await holmesBtn.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // The persisted key flips and the speaking clip is paused within
  // 1 s of the tap — same-event stop, not the old 1 Hz poll's leak.
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const audios = (window as unknown as { __detectiveAudios?: HTMLMediaElement[] })
            .__detectiveAudios ?? [];
          const clue = audios.find((a) => (a.currentSrc || a.src || "").includes("clue-1"));
          return clue ? clue.paused : null;
        }),
      { timeout: 1_000 },
    )
    .toBe(true);
  // The slashed-speaker badge latches on the pair cluster.
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(1, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("detective-muted-badge")).toBeVisible();

  // Queue flushed: the ack and decode of this clue never play.
  await page.waitForTimeout(3000);
  const afterMute = await detectiveOnly(page);
  expect(countIn(afterMute, CLUE)).toBe(1);
  expect(countIn(afterMute, ACK)).toBe(0);
  expect(countIn(afterMute, DECODE)).toBe(0);

  // Second tap (wherever Holmes now stands) unmutes and clears the
  // badge — and the stopped line does NOT resume mid-way.
  const unmuteBtn = page.getByTestId("detective-holmes-mute");
  await expect(unmuteBtn).toHaveCount(1, { timeout: 30_000 });
  await expect(unmuteBtn).toHaveAttribute("aria-label", "Unmute sound");
  await unmuteBtn.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("on");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(0, {
    timeout: 10_000,
  });
  await page.waitForTimeout(2500);
  const afterUnmute = await detectiveOnly(page);
  expect(countIn(afterUnmute, CLUE)).toBe(1);
  expect(countIn(afterUnmute, ACK)).toBe(0);
  console.log(
    `[sound-b] Holmes tap stopped the read in-event, queue flushed, badge latched then cleared, no resume; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

test("(c)+(d)+(e) Watson tap replays without muting; Holmes tap mutes without replaying; chip drives the same key", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  const requests = collectAudioRequests(page);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);

  const map = page.getByTestId("loop-map");

  // --- (c) tap-Watson: replay fires, sound stays ON, no badge ---
  const watsonBtn = map.getByTestId("detective-watson-replay");
  await expect(watsonBtn).toHaveCount(1, { timeout: 30_000 });
  await watsonBtn.click();
  await expect
    .poll(async () => countIn(await detectiveOnly(page), DECODE), { timeout: 60_000 })
    .toBe(2);
  expect(countIn(requests, CLUE)).toBeGreaterThanOrEqual(1);
  expect(await soundKey(page)).not.toBe("off");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(0);
  console.log("[sound-c] Watson tap replayed the chain; sound stayed on, no badge");

  // --- (d) tap-Holmes at the dock: mutes, badge appears, NO replay ---
  const playsBeforeHolmes = (await detectiveOnly(page)).length;
  const holmesBtn = map.getByTestId("detective-holmes-mute");
  await expect(holmesBtn).toHaveCount(1, { timeout: 15_000 });
  await holmesBtn.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(map.getByTestId("detective-muted-badge")).toHaveCount(1, {
    timeout: 10_000,
  });
  await page.waitForTimeout(2500);
  const playsAfterHolmes = (await detectiveOnly(page)).length;
  expect(playsAfterHolmes).toBe(playsBeforeHolmes);
  console.log(
    `[sound-d] Holmes tap muted with badge; plays unchanged (${playsBeforeHolmes} → ${playsAfterHolmes})`,
  );

  // --- (e) the pair chip: same key, ≥44 px, unmute clears the badge,
  //         and the Holmes alias stays in sync with it ---
  const chip = map.getByTestId("detective-sound-chip");
  await expect(chip).toHaveCount(1, { timeout: 15_000 });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  const chipBox = await chip.boundingBox();
  expect(chipBox).not.toBeNull();
  expect(Math.min(chipBox!.width, chipBox!.height)).toBeGreaterThanOrEqual(44);
  // Sync proof: the screen-level GeoDetective toggle also shows muted.
  await expect(page.getByTestId("sound-toggle-loop")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await chip.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("on");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(holmesBtn).toHaveAttribute("aria-label", "Mute sound");

  await chip.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(map.getByTestId("detective-muted-badge")).toHaveCount(1, {
    timeout: 10_000,
  });
  console.log("[sound-e] pair chip flipped the same meridian.sound key both ways, badge followed");
});
