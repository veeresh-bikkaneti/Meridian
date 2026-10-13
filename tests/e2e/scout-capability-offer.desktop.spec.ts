/**
 * Scout Map capability-offer E2E — the owner directive: a
 * capability-detected weak device gets a CHOICE dialog, never a silent
 * routing.
 *
 * Paths walked:
 * - probe-weak (this VM's SwiftShader) → dialog with probe copy →
 *   accept lands scout (auto, source preserved for decay).
 * - decline → manual "full" stored (never decays) → no re-prompt on the
 *   next boot.
 * - low-memory (spoofed: capable GPU + 1 GB) → dialog with memory copy.
 * - decayed auto record → the dialog re-appears (fresh re-qualification).
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  APP_NO_IDLE,
} from "./helpers";
import {
  offerModal,
  readMapMode,
  readStoredMapMode,
  seedManualMode,
  spoofLowMemoryDevice,
} from "./scout-helpers";

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  // These specs exercise the boot dialog itself — do NOT suppress it.
  await serveBuiltArtifact(context, { suppressScoutOffer: false });
});

test("probe-weak → capability dialog → accept lands scout", async ({
  context,
}) => {
  // No spoof: this VM's Chromium IS the weak device (SwiftShader probe).
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal).toHaveAttribute("data-offer-source", "probe");
  await expect(modal).toContainText("may struggle with the full map");

  await modal.getByRole("button", { name: "Use Scout Map" }).click();
  await expect(modal).toBeHidden();

  // Accept stores the auto scout assignment with the source preserved
  // (so it still decays after 7 days).
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "scout",
    source: "probe",
  });

  // The lighter trail actually mounts when a run starts.
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("scout");
  expect(await readPhase(page)).toBe("aim");
  await page.close();
});

test("decline → manual full stored, never re-prompts", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await modal.getByRole("button", { name: "Keep full map" }).click();
  await expect(modal).toBeHidden();

  // The user's explicit choice: manual full — never decays.
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "full",
    source: "manual",
  });

  // Next boot: the stored choice stands — no dialog, no nag.
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(3_000);
  await expect(modal).toBeHidden();
  await page.close();
});

test("low-memory → dialog with memory copy", async ({ context }) => {
  // Capable GPU (probe passes) + 1 GB → the "low-memory" source, isolated.
  await spoofLowMemoryDevice(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal).toHaveAttribute("data-offer-source", "low-memory");
  await expect(modal).toContainText("low on memory");

  // Accepting a low-memory offer stores source "low-memory" (decays).
  await modal.getByRole("button", { name: "Use Scout Map" }).click();
  await expect(modal).toBeHidden();
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "scout",
    source: "low-memory",
  });
  await page.close();
});

test("decayed auto record → dialog re-appears on fresh probe", async ({
  context,
}) => {
  // Seed an 8-day-old probe scout record: decay treats it as absent, so
  // the fresh probe re-qualifies and the choice dialog appears again.
  await context.addInitScript(() => {
    localStorage.setItem(
      "meridian:map-mode",
      JSON.stringify({
        mode: "scout",
        source: "probe",
        setAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      }),
    );
  });
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal).toHaveAttribute("data-offer-source", "probe");
  await page.close();
});

test("manual full suppresses the capability dialog entirely", async ({
  context,
}) => {
  await seedManualMode(context, "full");
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(5_000);
  await expect(offerModal(page)).toBeHidden();
  await page.close();
});
