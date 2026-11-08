import { test, expect, type BrowserContext } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Detective reduced-motion gate (U9, BUILD-SCOPE §2.5 / council Q2
 * §11), running in the `reduced` project (reducedMotion: "reduce"):
 *
 * - the pair is present when the case opens;
 * - a scripted pointer pause berths Holmes by CUT — his placement
 *   changes to "berth" while the walk transition is absent (the
 *   wrapper's transition is "none" / 0s and the host reports
 *   walk:cut), after the longer 600 ms reduced-motion pause;
 * - audio requests still fire: reduced motion mutes animation, never
 *   sound, so Watson's clue-1 read plays exactly as in the full build.
 *
 * Speech is sped to 3x via the U5/U6 smoke pattern (a play() patch
 * that also records every clip src) so the clue ladder reaches the
 * guessing phase in test time. The flag is flipped on by route
 * interception only — the committed flags.json stays false.
 */

const APP = "http://127.0.0.1:4123/Meridian/?loop-puzzle=137";

async function fulfillFlagsOn(context: BrowserContext) {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair: true,
        },
      }),
    });
  });
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await context.addInitScript(() => {
    const w = window as unknown as { __detectivePlays: string[] };
    w.__detectivePlays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__detectivePlays.push(this.currentSrc || this.src || "");
      try {
        this.playbackRate = 3;
      } catch {
        /* rate is a speed-up only — a refusal must not break play */
      }
      return orig.call(this);
    };
  });
});

test("reduced motion: pair present, berth by cut, audio still fires", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);

  const reduced = await page.evaluate(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduced).toBe(true);

  await page.goto(APP);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("heading", { name: "GeoDetective" }),
  ).toBeVisible();
  // The pair is present at the case open (station cluster at the card).
  const station = page.getByTestId("detective-station");
  await expect(station).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() => station.getAttribute("data-degradation"))
    .toContain("walk:cut");
  // A click on the heading supplies the first gesture the speech
  // player's unlock waits for (the U5 smoke pattern).
  await page.getByRole("heading", { name: "GeoDetective" }).click();

  // Audio unaffected by reduced motion: Watson's clue-1 read fires.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as { __detectivePlays: string[] })
              .__detectivePlays,
        ),
      { timeout: 30_000 },
    )
    .toEqual(
      expect.arrayContaining([
        expect.stringContaining("audio/detective/case-137/clue-1.mp3"),
      ]),
    );

  // The ladder reaches the guessing phase: the map-side host mounts
  // with Holmes docked.
  const host = page.getByTestId("detective-host");
  await expect
    .poll(() => host.getAttribute("data-phase"), { timeout: 60_000 })
    .toBe("SEARCH_IDLE");
  await expect
    .poll(() => host.getAttribute("data-holmes-placement"))
    .toBe("dock");

  // Scripted pointer pause near (but not on) the dock: Holmes berths.
  const map = page.getByTestId("loop-map");
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  const wrapper = page.getByTestId("detective-holmes-wrapper");
  const dockTransform = await wrapper.evaluate(
    (el) => getComputedStyle(el).transform,
  );
  const px = box!.x + 170;
  const py = box!.y + box!.height - 190;
  await page.mouse.move(px, py, { steps: 6 });
  await page.mouse.move(px + 2, py + 1, { steps: 2 });

  await expect
    .poll(() => host.getAttribute("data-holmes-placement"), {
      timeout: 20_000,
    })
    .toBe("berth");

  // …and he arrived by CUT: no walk transition on his wrapper, and
  // the host still reports the cut walk mode. (The computed duration
  // is asserted as ≈0, not the literal "0s": under reduced-motion
  // emulation Chromium clamps it to ~1e-05s — the same clamp the
  // geodetective.reduced spec documents. The inline style is the
  // value the app itself controls: "none".)
  const cut = await wrapper.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      inlineTransition: (el as HTMLElement).style.transition,
      durationS: parseFloat(cs.transitionDuration) || 0,
      transform: cs.transform,
      walkMode: el.getAttribute("data-walk-mode"),
    };
  });
  expect(cut.walkMode).toBe("cut");
  expect(cut.inlineTransition).toBe("none");
  expect(cut.durationS).toBeLessThan(0.01);
  expect(cut.transform).not.toBe(dockTransform);
});
