import { test, expect } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, commitHit } from "./helpers";

/**
 * Read-aloud "Always" E2E (owner 2026-10-09: honor "Always" across ALL bands).
 *
 * The old code gated auto-play on `mode === "auto"` (5-7 only), so a kid who
 * chose "Always" on 8-10/11-13 never heard anything — a broken promise.
 * Fixed: "always" auto-plays on every card in every band when sound is on;
 * the sound toggle is the only off switch (it cancels speechSynthesis).
 *
 * speechSynthesis is stubbed (headless Chromium has no audio): the stub
 * records speak()/cancel() calls so the tests assert the ATTEMPT, not
 * audible output.
 */

const PROFILE_KEY = "meridian.ageProfile.v1";
const PREF_KEY = "meridian.readAloudPref.v1";

test.beforeEach(async ({ context }) => {
  // Stub speechSynthesis before any page script runs: record speak/cancel.
  await context.addInitScript(() => {
    const calls: { speak: number; cancel: number } = { speak: 0, cancel: 0 };
    (window as any).__speechCalls = calls;
    const stub = {
      speak: (_u: unknown) => {
        calls.speak += 1;
      },
      cancel: () => {
        calls.cancel += 1;
      },
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: stub,
      configurable: true,
    });
  });
  await serveBuiltArtifact(context);
});

async function seedProfileAndPref(
  context: import("playwright/test").BrowserContext,
  band: "5-7" | "8-10" | "11-13",
  pref: "always" | "sometimes" | "never",
) {
  await context.addInitScript(
    ({ b, p }: { b: string; p: string }) => {
      window.localStorage.setItem(
        "meridian.ageProfile.v1",
        JSON.stringify({
          status: "active",
          band: b,
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 1,
        }),
      );
      window.localStorage.setItem(
        "meridian.readAloudPref.v1",
        JSON.stringify({
          schemaVersion: 1,
          value: p,
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    { b: band, p: pref },
  );
}

async function speechCalls(page: import("playwright/test").Page) {
  return page.evaluate(
    () => (window as any).__speechCalls as { speak: number; cancel: number },
  );
}

/** Reveal a story card: start a globe run and commit a HIT (phase "story"). */
async function revealCard(page: import("playwright/test").Page) {
  await startGlobeRun(page);
  // A hit reaches phase "story" — the story card carries the read-aloud
  // button (misses go to phase "done" and skip it).
  await commitHit(page);
  // The result card (story phase) carries the read-aloud button.
  await expect(
    page.getByRole("button", { name: /Listen to the story|Pause the story/ }),
  ).toBeVisible({ timeout: 20_000 });
}

test("Always on 11-13: auto-play is attempted on card reveal", async ({
  page,
  context,
}) => {
  await seedProfileAndPref(context, "11-13", "always");
  await page.setViewportSize({ width: 1440, height: 900 });
  await revealCard(page);
  // The broken promise: 11-13 (mode "off") never attempted speak before.
  await expect
    .poll(async () => (await speechCalls(page)).speak, { timeout: 10_000 })
    .toBeGreaterThan(0);
});

test("Always on 8-10: auto-play is attempted on card reveal", async ({
  page,
  context,
}) => {
  await seedProfileAndPref(context, "8-10", "always");
  await page.setViewportSize({ width: 1440, height: 900 });
  await revealCard(page);
  await expect
    .poll(async () => (await speechCalls(page)).speak, { timeout: 10_000 })
    .toBeGreaterThan(0);
});

test("Mute toggle cancels in-progress narration (the only off switch)", async ({
  page,
  context,
}) => {
  await seedProfileAndPref(context, "11-13", "always");
  await page.setViewportSize({ width: 1440, height: 900 });
  await revealCard(page);
  await expect
    .poll(async () => (await speechCalls(page)).speak, { timeout: 10_000 })
    .toBeGreaterThan(0);
  // Mute: the toggle must actually cancel speechSynthesis, not just flip
  // the flag. Use the in-game toggle (reachable mid-game). The hit's
  // celebration overlay sits above everything, so dispatch the click
  // directly — this test targets the mute mechanism (toggle →
  // setSoundEnabled(false) → speechSynthesis.cancel()), not overlay
  // dismissal.
  const toggle = page.getByTestId("sound-toggle-game");
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await toggle.dispatchEvent("click");
  await expect
    .poll(async () => (await speechCalls(page)).cancel, { timeout: 10_000 })
    .toBeGreaterThan(0);
});

test("Sometimes on 11-13: no auto-play (tap-to-play only)", async ({
  page,
  context,
}) => {
  await seedProfileAndPref(context, "11-13", "sometimes");
  await page.setViewportSize({ width: 1440, height: 900 });
  await revealCard(page);
  // Give any would-be autoplay a chance to fire, then assert silence.
  await page.waitForTimeout(3000);
  expect((await speechCalls(page)).speak).toBe(0);
  // …but the button stays visible and tappable (the kid's tool).
  await expect(
    page.getByRole("button", { name: /Listen to the story/ }),
  ).toBeVisible();
});
