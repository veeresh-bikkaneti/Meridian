import { test, expect } from "playwright/test";
import {
  commitPin,
  dismissTileOverlayIfPresent,
  readPhase,
  serveBuiltArtifact,
} from "./helpers";
import {
  collectAudioRequests,
  detectivePlays,
  entryByName,
  fulfillFlagsOn,
  guessByEntryId,
  installDetectiveRecorder,
  openSeamCase,
  waitForPhase,
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
 * Cure round (panel round 1) additions:
 * - (f) TAP speech mode at the station (read-aloud pref "never"
 *   forces the tap row of the degradation matrix): the Listen
 *   button, the speaker chip and the station Holmes-mute are
 *   pairwise non-overlapping at a 390 px viewport, and each centre
 *   click does its own job — Listen plays the held clue sequence,
 *   Holmes mutes, the chip unmutes and mutes.
 * - (g) NOTE_MARK (the split placement: Watson at the station,
 *   Holmes at the dock, after every miss) renders exactly ONE
 *   detective-sound-chip and at most one muted badge.
 * - (h) Preset-off boot: meridian.sound="off" in storage before
 *   load → the muted badge is up at first paint where the pair
 *   renders and no detective speech plays; turning sound on from
 *   the pair chip clears the badge.
 * - (i) The summary celebration line honours the sound gate: with
 *   sound preset off, the line never starts and the celebration
 *   frame still settles. The MID-LINE mute itself is unit-proven
 *   (summary-celebration-line.test.ts: gate re-check after the
 *   manifest await, mid-line pause + settle, dispose unsubscribes)
 *   because it cannot be staged on this page: the summary dialog
 *   is modal — it intercepts pointer events over the in-game
 *   toggle and focus is trapped inside the dialog (probe-verified
 *   in the cure round: 40 Tabs cycle only the dialog's controls),
 *   so no master-mute surface is reachable while the line plays.
 *   No toggle is added to the dialog (council boundary).
 * - (j) THREE-WIDTH placement (cure 12, owner amendment 2026-11-06 —
 *   "you didnt test in all devices. desktop, mobile, tab."): the
 *   in-screen SoundToggle instances (sound-toggle-loop in
 *   GeoDetective, sound-toggle-trail in Cold Trail) are checked at
 *   390 px (phone), 768 px (tablet) and 1280 px (desktop): visible,
 *   ≥44×44 px, fully inside the viewport width, and overlapping no
 *   other visible interactive element on the screen. Placement
 *   only — the behaviour is (a)'s.
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
  await expect(holmesBtn).toHaveAttribute("aria-label", "Turn sound off");
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
  await expect(unmuteBtn).toHaveAttribute("aria-label", "Turn sound on");
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
  // Watson holds his clue-card station in SEARCH_IDLE (station cure,
  // 2026-11-08), so his replay control is the STATION form — it no
  // longer lives inside the map. Holmes alone is map-scoped below.
  const watsonBtn = page.getByTestId("detective-watson-replay");
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
  // Holmes's mute alias stays on the map (he docks alone now); the
  // muted badge latches on the STATION cluster, because that is the
  // cluster rendering while Watson holds his station — so the badge
  // is asserted page-wide, not inside the map.
  const playsBeforeHolmes = (await detectiveOnly(page)).length;
  const holmesBtn = map.getByTestId("detective-holmes-mute");
  await expect(holmesBtn).toHaveCount(1, { timeout: 15_000 });
  await holmesBtn.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(1, {
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
  // The chip rides the station cluster in the guessing phases (the
  // station cluster is the one rendering), so it is page-scoped too.
  const chip = page.getByTestId("detective-sound-chip");
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
  await expect(holmesBtn).toHaveAttribute("aria-label", "Turn sound off");

  await chip.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(1, {
    timeout: 10_000,
  });
  console.log("[sound-e] pair chip flipped the same meridian.sound key both ways, badge followed");
});

/* ------------------------------------------------------------------ */
/* Cure round (panel round 1)                                        */
/* ------------------------------------------------------------------ */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0.5 && h > 0.5;
}

/** Click the CENTRE of a station-phase control (chip / Holmes-mute)
 * while the pair is at the clue-card station (READING / the thinking
 * beat): poll the phase at 30 ms cadence and fire a raw mouse click
 * at the element's live centre the moment both line up — the tap-mode
 * station windows are dwell-timed (600 ms beats), so the click must
 * be armed before the window opens. */
async function clickStationControl(
  page: import("playwright/test").Page,
  testId: string,
  timeout = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  const loc = page.getByTestId(testId);
  while (Date.now() < deadline) {
    const phase = await currentPhase(page);
    if (phase === "READING" || phase === "THINKING_BEAT") {
      if ((await loc.count()) === 1) {
        const box = await loc.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          return;
        }
      }
    }
    await page.waitForTimeout(30);
  }
  throw new Error(`station window for ${testId} never opened`);
}

test("(f) tap mode: Listen, chip and Holmes-mute are pairwise separate at the station; each centre click does its own job", async ({
  page,
  context,
}) => {
  // Force the tap row of the degradation matrix the way the shipped
  // specs seed the kid's preference: read-aloud "never" vetoes
  // autoplay, so speech is tap-to-play and the Listen button shows.
  await context.addInitScript((v: string) => {
    localStorage.setItem(
      "meridian.readAloudPref.v1",
      JSON.stringify({
        schemaVersion: 1,
        value: v,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, "never");
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  // Armed BEFORE navigation (addInitScript): the tap-mode case-open
  // station window is a single ~700 ms thinking beat starting
  // ~200 ms after the pair mounts (measured in the cure round), so
  // the sampler and the beat watcher must already be running when
  // the case opens — a test-side install after mount loses the
  // race. The same script scrolls the clue card into view the
  // moment it exists (at 390x844 it mounts below the fold; the
  // host re-anchors the cluster on scroll, as it does for a kid).
  await context.addInitScript(() => {
    const w = window as unknown as {
      __stationSamples: Array<{
        phase: string | null;
        speech: string | null;
        listen: Box;
        chip: Box;
        mute: Box;
      }>;
      __beatClick: { box: Box; hitOk: boolean } | null;
    };
    w.__stationSamples = [];
    w.__beatClick = null;
    const rect = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    let scrolled = false;
    setInterval(() => {
      if (!scrolled) {
        const card = document.querySelector('article[aria-label^="Clue 1:"]');
        if (card) {
          scrolled = true;
          card.scrollIntoView({ block: "center" });
        }
      }
      const root =
        document.querySelector('[data-testid="detective-station"]') ??
        document.querySelector('[data-testid="detective-host"]');
      const phase = root?.getAttribute("data-phase") ?? null;
      if (phase === "THINKING_BEAT" && !w.__beatClick) {
        const mute = document.querySelector(
          '[data-testid="detective-holmes-mute"]',
        ) as HTMLElement | null;
        if (mute) {
          const box = rect(mute);
          // The centre hit-test, taken in the same instant: the
          // topmost element at the button's centre must be the
          // button itself — then the click is dispatched on it
          // in-page, because this ~700 ms beat is shorter than a
          // test-side round-trip reliably lands in (measured).
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          w.__beatClick = { box, hitOk: hit === mute };
          if (hit === mute) mute.click();
        }
      }
      const listen = document.querySelector('[data-testid="detective-listen"]');
      const chip = document.querySelector('[data-testid="detective-sound-chip"]');
      const mute = document.querySelector('[data-testid="detective-holmes-mute"]');
      if (!listen || !chip || !mute) return;
      w.__stationSamples.push({
        phase,
        speech: root?.getAttribute("data-speech-mode") ?? null,
        listen: rect(listen),
        chip: rect(chip),
        mute: rect(mute),
      });
    }, 15);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}?loop-puzzle=137`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1:/ })).toBeVisible({
    timeout: 30_000,
  });
  // Either host root proves the pair rendered (tap drains fast —
  // the station may already have handed over to the map root).
  await expect(
    page.locator('[data-testid="detective-station"], [data-testid="detective-host"]'),
  ).toBeVisible({ timeout: 20_000 });

  // The station Holmes-mute's centre click mutes — on the clue-1
  // thinking beat. Later station windows cannot be used for this:
  // after a guess, the tap-mode ladder (selection read ->
  // NOTE_MARK -> ask-next -> clue read) drains silently INSIDE the
  // 2 s ring absence, so the pair is hidden for that whole sequence
  // (phase-log verified in the cure round) and returns straight to
  // SEARCH_IDLE. And the clue-1 window itself is a single ~700 ms
  // beat starting ~200 ms after CASE_OPEN (measured in the cure
  // round) — too fast for test-side polling to find and click, so
  // an in-page watcher (15 ms cadence) hit-tests the mute's centre
  // and clicks it the instant the beat opens (see the init script).
  let beatClick: { box: Box; hitOk: boolean } | null = null;
  for (let i = 0; i < 300 && !beatClick; i++) {
    beatClick = await page.evaluate(
      () =>
        (
          window as unknown as {
            __beatClick: { box: Box; hitOk: boolean } | null;
          }
        ).__beatClick,
    );
    if (!beatClick) await page.waitForTimeout(20);
  }
  expect(beatClick).not.toBeNull();
  expect(beatClick!.hitOk).toBe(true);
  expect(beatClick!.box.y).toBeGreaterThanOrEqual(0);
  expect(beatClick!.box.y + beatClick!.box.height).toBeLessThanOrEqual(844.5);
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(1, {
    timeout: 10_000,
  });
  // SoundToggle aria semantics on the alias: pressed == sound on.
  await expect(page.getByTestId("detective-holmes-mute")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("detective-holmes-mute")).toHaveAttribute(
    "aria-label",
    "Turn sound on",
  );
  console.log("[sound-f] station Holmes centre click muted; badge latched");

  await waitForSearchIdle(page);

  // Geometry verdict from the sampler's station moments.
  const samples = await page.evaluate(
    () =>
      (
        window as unknown as {
          __stationSamples: Array<{
            phase: string | null;
            speech: string | null;
            listen: Box;
            chip: Box;
            mute: Box;
          }>;
        }
      ).__stationSamples,
  );
  expect(samples.length).toBeGreaterThan(0);
  // The geometry guarantee binds the LIVE tap state — the moments a
  // player can actually tap (Listen exists only in tap mode). The
  // sampler also catches post-mute transition frames (speech
  // already "off", Listen on its way out while the anchor chases
  // the scroll): not a tappable state, excluded from the verdict.
  const tapSamples = samples.filter((s) => s.speech === "tap");
  expect(tapSamples.length).toBeGreaterThan(0);
  for (const s of tapSamples) {
    expect(boxesOverlap(s.listen, s.chip), `listenxchip overlap in ${s.phase}`).toBe(false);
    expect(boxesOverlap(s.listen, s.mute), `listenxmute overlap in ${s.phase}`).toBe(false);
    expect(boxesOverlap(s.chip, s.mute), `chipxmute overlap in ${s.phase}`).toBe(false);
    // 390 px fit: every control fully inside the viewport width.
    for (const b of [s.listen, s.chip, s.mute]) {
      expect(b.x).toBeGreaterThanOrEqual(-0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(390.5);
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    }
  }
  console.log(
    `[sound-f] ${tapSamples.length} live tap-mode samples (${samples.length} total incl. transition frames), pairwise non-overlapping at 390px (phases: ${[...new Set(tapSamples.map((s) => s.phase))].join(",")})`,
  );

  // The chip's centre click unmutes — same key, badge clears.
  const chip = page.getByTestId("detective-sound-chip");
  await expect(chip).toHaveCount(1, { timeout: 15_000 });
  await chip.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("on");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("detective-holmes-mute")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  console.log("[sound-f] chip centre click unmuted; badge cleared");

  // A wrong guess deals clue 2 (its chain is held in tap mode) —
  // Listen's centre click then plays the held clue sequence. TWO
  // taps, by design of the player's first-gesture unlock: in tap
  // mode nothing has called playClip yet, so the gesture listener
  // arms only when the FIRST tap's playHeldSequence reaches the
  // clip — that tap parks in waitForGesture, and the second tap's
  // pointerdown is the gesture that unlocks it (a kid taps again;
  // the replay's restart semantics make the second tap start the
  // sequence from item 1).
  await guessByEntryId(page, entryByName("las vegas").id, "las vegas");
  await waitForSearchIdle(page, 120_000);
  await page.getByRole("article", { name: /Clue 2:/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const listenBox = await page.getByTestId("detective-listen").boundingBox();
  expect(listenBox).not.toBeNull();
  expect(listenBox!.y).toBeGreaterThanOrEqual(0);
  expect(listenBox!.y + listenBox!.height).toBeLessThanOrEqual(844.5);
  await page.mouse.click(
    listenBox!.x + listenBox!.width / 2,
    listenBox!.y + listenBox!.height / 2,
  );
  await page.waitForTimeout(600);
  await page.mouse.click(
    listenBox!.x + listenBox!.width / 2,
    listenBox!.y + listenBox!.height / 2,
  );
  await expect
    .poll(async () => countIn(await detectiveOnly(page), "case-137/clue-2.mp3"), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);
  // The chain's second link: an ack (acks rotate per clue — clue 2
  // draws ack-2 — so the family prefix is the honest needle).
  await expect
    .poll(async () => countIn(await detectiveOnly(page), "fixed/ack-"), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);
  console.log("[sound-f] Listen centre click played the held clue-2 sequence");

  // And the chip's centre click mutes again — same key both ways.
  await chip.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("off");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(1, {
    timeout: 10_000,
  });
  console.log("[sound-f] chip centre click muted again on the same key");
});


test("(g) NOTE_MARK split placement renders exactly one chip and at most one badge", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 4);
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  // In-page sampler: chip/badge counts by phase, 25 ms cadence —
  // NOTE_MARK is a 900 ms dwell, sampled many times per entry.
  await page.evaluate(() => {
    const w = window as unknown as {
      __chipSamples: Array<{ phase: string | null; chips: number; badges: number }>;
    };
    w.__chipSamples = [];
    setInterval(() => {
      const root =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      w.__chipSamples.push({
        phase: root?.getAttribute("data-phase") ?? null,
        chips: document.querySelectorAll('[data-testid="detective-sound-chip"]').length,
        badges: document.querySelectorAll('[data-testid="detective-muted-badge"]').length,
      });
    }, 25);
  });
  await waitForSearchIdle(page);

  // Miss: Las Vegas — the selection read ends in NOTE_MARK, the one
  // split-placement state (Watson station, Holmes dock).
  await guessByEntryId(page, entryByName("las vegas").id, "las vegas");
  await waitForPhase(page, "NOTE_MARK", 60_000);
  // Let the beat finish and the ladder return to guessing, so the
  // sampler holds the full NOTE_MARK window.
  await waitForSearchIdle(page, 120_000);

  const samples = await page.evaluate(
    () =>
      (
        window as unknown as {
          __chipSamples: Array<{ phase: string | null; chips: number; badges: number }>;
        }
      ).__chipSamples,
  );
  const noteMark = samples.filter((s) => s.phase === "NOTE_MARK");
  expect(noteMark.length).toBeGreaterThan(0);
  for (const s of noteMark) {
    expect(s.chips).toBe(1);
    expect(s.badges).toBeLessThanOrEqual(1);
  }
  console.log(
    `[sound-g] NOTE_MARK sampled ${noteMark.length}× — chip == 1 and badge ≤ 1 in every sample`,
  );
});

test("(h) preset-off boot: badge at first paint, no speech; turning sound on clears the badge", async ({
  page,
  context,
}) => {
  // The persisted key is OFF before any app code runs.
  await context.addInitScript(() => {
    localStorage.setItem("meridian.sound", "off");
  });
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  await page.goto(`${BASE}?loop-puzzle=137`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1:/ })).toBeVisible({
    timeout: 30_000,
  });
  // Where the pair renders, the muted badge is already latched —
  // first paint, no interaction needed. (The speech-mode attribute
  // is read off whichever host root is mounted: with sound off the
  // ladder drains silently and Holmes reaches the map dock fast
  // while Watson settles at his station, so either root may be the
  // one on screen — both carry the attribute.)
  const pairRoot = page.locator(
    '[data-testid="detective-station"], [data-testid="detective-host"]',
  );
  await expect(pairRoot.first()).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el =
            document.querySelector('[data-testid="detective-station"]') ??
            document.querySelector('[data-testid="detective-host"]');
          return el?.getAttribute("data-speech-mode") ?? null;
        }),
      { timeout: 20_000 },
    )
    .toBe("off");
  const badge = page.getByTestId("detective-muted-badge");
  await expect(badge).toHaveCount(1, { timeout: 10_000 });
  await expect(badge).toBeVisible();
  // No detective speech at all while preset off.
  await page.waitForTimeout(2500);
  expect(await detectiveOnly(page)).toEqual([]);
  console.log("[sound-h] preset-off boot: badge latched at first paint, zero detective plays");

  // Turning sound on from the pair chip clears the badge.
  const chip = page.getByTestId("detective-sound-chip");
  await expect(chip).toHaveCount(1, { timeout: 10_000 });
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect.poll(() => soundKey(page), { timeout: 10_000 }).toBe("on");
  await expect(page.getByTestId("detective-muted-badge")).toHaveCount(0, {
    timeout: 10_000,
  });
  console.log("[sound-h] chip unmute cleared the badge");
});


test("(i) summary celebration: sound preset off — the line never starts and the frame still settles", async ({
  page,
  context,
}) => {
  // Preset OFF before load (the (h) pattern, on the summary path):
  // the celebration's spoken line is gated at play time, so it
  // never starts; the choreography still completes and the frame
  // settles (the yield releases). The mid-line case is unit-proven
  // — see this spec's header for why it cannot be staged here.
  await context.addInitScript(() => {
    localStorage.setItem("meridian.sound", "off");
  });
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  // A one-place State run (Nebraska), ended to the summary — the
  // detective-summary.spec.ts flow on this spec's own surface.
  await page.goto(BASE);
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await commitPin(page, 500, 400);
  await page.getByRole("button", { name: "Next place" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  const frame = page.getByTestId("summary-detective-celebration");
  await expect(frame).toBeVisible({ timeout: 20_000 });
  await expect(frame).toHaveAttribute("data-mode", "animated");

  // The frame settles (choreography completes, yield releases)…
  await expect(frame).not.toHaveAttribute("data-celebration", "active", {
    timeout: 20_000,
  });
  await expect(frame).toHaveAttribute("data-step", "settle");
  // …and the celebration line was never even requested or played.
  const plays = await detectiveOnly(page);
  expect(countIn(plays, "score-celebration")).toBe(0);
  console.log(
    `[sound-i] preset-off summary: frame settled with zero celebration-line plays; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

/* ------------------------------------------------------------------ */
/* Cure 12 (owner amendment, 2026-11-06): three-width placement of    */
/* the in-screen toggles. For each screen and each width the toggle   */
/* must be visible, ≥44×44 px, inside the viewport width, and clear   */
/* of every other visible interactive element (the overlap sweep      */
/* runs in-page in one pass — no per-element round-trips).            */
/* ------------------------------------------------------------------ */

const WIDTHS = [390, 768, 1280] as const;

async function expectTogglePlaced(
  page: import("playwright/test").Page,
  testId: string,
  width: number,
): Promise<void> {
  const toggle = page.getByTestId(testId);
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  const result = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return null;
    const box = (e: Element): Box => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const mine = box(el);
    const others: Array<{ tag: string; box: Box }> = [];
    const all = document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"]',
    );
    for (const other of all) {
      if (other === el || el.contains(other) || other.contains(el)) continue;
      const style = getComputedStyle(other);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const b = box(other);
      if (b.width <= 0 || b.height <= 0) continue;
      others.push({
        tag:
          other.getAttribute("data-testid") ??
          other.getAttribute("aria-label") ??
          other.tagName,
        box: b,
      });
    }
    return { mine, others };
  }, testId);
  expect(result, `${testId} at ${width}px: element present`).not.toBeNull();
  const { mine, others } = result!;
  expect(mine.width, `${testId} at ${width}px: width ≥44`).toBeGreaterThanOrEqual(44);
  expect(mine.height, `${testId} at ${width}px: height ≥44`).toBeGreaterThanOrEqual(44);
  expect(mine.x, `${testId} at ${width}px: left edge in viewport`).toBeGreaterThanOrEqual(-0.5);
  expect(
    mine.x + mine.width,
    `${testId} at ${width}px: right edge in viewport`,
  ).toBeLessThanOrEqual(width + 0.5);
  for (const other of others) {
    expect(
      boxesOverlap(mine, other.box),
      `${testId} at ${width}px overlaps ${other.tag}`,
    ).toBe(false);
  }
  console.log(
    `[sound-j] ${testId} at ${width}px: ${Math.round(mine.width)}x${Math.round(mine.height)} at x=${Math.round(mine.x)}, clear of ${others.length} interactive elements`,
  );
}

test("(j) LoopScreen toggle placement at phone, tablet and desktop widths", async ({ page }) => {
  await page.goto(`${BASE}?loop-puzzle=137`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    await expectTogglePlaced(page, "sound-toggle-loop", width);
  }
});

test("(j) TrailScreen toggle placement at phone, tablet and desktop widths", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    await expectTogglePlaced(page, "sound-toggle-trail", width);
  }
});
