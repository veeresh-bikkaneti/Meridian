/**
 * Issue #332: an unknown-memory scout upgrade remounts the map. If focus
 * was on the map wrapper, the new wrapper takes it back. The upgrade
 * also writes no map-mode record (issue #334).
 */
import { test, expect } from "playwright/test";
import {
  APP_NO_IDLE,
  serveBuiltArtifact,
  spoofUnknownMemoryDevice,
} from "./helpers";
import { mapWrapper, readMapMode, readStoredMapMode } from "./scout-helpers";

test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  // No capable-device spoof: that one reports deviceMemory and boots full.
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
  await spoofUnknownMemoryDevice(context);
});

test("upgrade remount returns focus to the map wrapper and stores nothing", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(mapWrapper(page)).toBeVisible({ timeout: 60_000 });

  // Focus the scout wrapper as soon as the intro releases it, before the
  // soak fires. The soak is 3s after the first idle and the globe intro
  // is shorter than that, so there is a settled scout aim to focus.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector(".satellite-map") as HTMLElement | null;
          if (!el) return "missing";
          const mode = el.getAttribute("data-map-mode");
          if (mode === "full") return "upgraded-before-focus";
          if (mode !== "scout") return "not-scout";
          if (el.hasAttribute("inert") || el.getAttribute("aria-hidden") === "true") return "inert";
          el.focus();
          return document.activeElement === el ? "focused" : "unfocused";
        }),
      { timeout: 90_000, intervals: [50, 100, 200, 500] },
    )
    .toBe("focused");

  await expect.poll(() => readMapMode(page), { timeout: 30_000 }).toBe("full");

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector(".satellite-map");
          return el !== null && document.activeElement === el;
        }),
      { timeout: 10_000 },
    )
    .toBe(true);

  expect(await readStoredMapMode(page)).toBeNull();
});
