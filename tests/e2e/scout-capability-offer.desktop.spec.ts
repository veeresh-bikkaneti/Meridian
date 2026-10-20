/**
 * Scout Map capability auto-switch E2E — CONVERTED 2026-10-20.
 *
 * This file pinned the capability OFFER dialog ("a capability-detected
 * weak device gets a CHOICE, never a silent routing"). The owner
 * superseded that directive — "Auto-switch silently on weak devices
 * (my decision stands)" — so the dialog is gone and a fresh scout
 * qualification now applies SILENTLY at boot:
 *
 * - probe-weak (this VM's SwiftShader) → session starts in Scout; an
 *   AUTO record is stored (source preserved, NO accepted flag) that
 *   decays after 7 days.
 * - low-memory (spoofed: capable GPU + 1 GB) → same, source low-memory.
 * - a legacy ACCEPTED record (written by the removed dialog) still
 *   stands forever — it was a person's answer.
 * - a decayed auto record + still-weak device → re-qualified silently
 *   (fresh auto record); + now-capable device → back to full.
 * - a settled MANUAL full record on a weak device → the WS-4 tile
 *   failure still switches the visit to scout, and the stored manual
 *   record is untouched (issue #154 item 6 lineage).
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  APP_NO_IDLE,
} from "./helpers";
import {
  readMapMode,
  readStoredMapMode,
  seedManualMode,
  spoofCapableDevice,
  spoofLowMemoryDevice,
  starfield,
} from "./scout-helpers";

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  // Production boot behavior: do NOT suppress the auto-switch.
  await serveBuiltArtifact(context, { suppressScoutOffer: false });
});

test("probe-weak → silent scout at boot (auto record, no dialog, no accepted flag)", async ({
  context,
}) => {
  // No spoof: this VM's Chromium IS the weak device (SwiftShader probe).
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("scout-boot-offer")).toHaveCount(0);

  // The auto-switch persisted an AUTO record: the qualifying source is
  // kept for telemetry, and nobody answered anything (no accepted).
  const stored = await readStoredMapMode(page);
  expect(stored).toMatchObject({ mode: "scout", source: "probe" });
  expect((stored as unknown as Record<string, unknown>)?.accepted).toBeUndefined();

  // The lighter trail actually mounts when a run starts.
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("scout");
  await page.close();
});

test("low-memory → silent scout with the low-memory source", async ({ context }) => {
  // Capable GPU (probe passes) + 1 GB → the "low-memory" source, isolated.
  await spoofLowMemoryDevice(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  const stored = await readStoredMapMode(page);
  expect(stored).toMatchObject({ mode: "scout", source: "low-memory" });
  expect((stored as unknown as Record<string, unknown>)?.accepted).toBeUndefined();

  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("scout");
  await page.close();
});

test("manual FULL record + weak probe → starts full, no auto-switch", async ({
  context,
}) => {
  // The brief's boot pin: a stored manual record wins over a fresh
  // qualification, and boot never rewrites it — the record after the
  // run starts (a second navigation + boot) is byte-identical to the
  // seeded one, setAt included.
  await seedManualMode(context, "full");
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  const seeded = await readStoredMapMode(page);
  expect(seeded).toMatchObject({ mode: "full", source: "manual" });

  await startGlobeRun(page);
  expect(await readMapMode(page)).toBe("full");
  expect(await readStoredMapMode(page)).toEqual(seeded);
  await page.close();
});

test("legacy accepted scout, 400 days old → still stands, never re-asked", async ({ context }) => {
  // Records the removed dialog wrote on accept carry accepted: true.
  // They are a person's answer: they never decay, however old.
  await context.addInitScript(() => {
    localStorage.setItem(
      "meridian:map-mode",
      JSON.stringify({
        mode: "scout",
        source: "probe",
        setAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
        accepted: true,
      }),
    );
  });
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  // The stored choice stands untouched (boot never rewrites it).
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "scout",
    source: "probe",
    accepted: true,
  });
  // ...and it is what actually mounts.
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("scout");
  await page.close();
});

test("decayed auto record + still-weak device → silently re-qualified (fresh auto record)", async ({
  context,
}) => {
  // Seed an 8-day-old probe scout record: decay treats it as absent, so
  // the fresh probe re-qualifies — silently, with a fresh setAt.
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
  const bootAt = Date.now();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  const stored = await readStoredMapMode(page);
  expect(stored).toMatchObject({ mode: "scout", source: "probe" });
  expect(stored?.setAt).toBeGreaterThanOrEqual(bootAt - 5_000);
  await page.close();
});

test("decayed auto record + now-capable device → back to full", async ({
  context,
}) => {
  // The other half of the decay promise: a device that later probes
  // clean returns to the full map.
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
  await spoofCapableDevice(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  await startGlobeRun(page);
  expect(await readMapMode(page)).toBe("full");
  await expect(starfield(page)).toHaveCount(1);
  await page.close();
});

test("weak-device boot: the greeting still arrives (no dialog to wait for)", async ({
  context,
}) => {
  // Converted from the old "greeting waits while the dialog is open"
  // pin: with no dialog, the greeting must simply arrive once boot
  // qualification settles. The first-run tutorial invite also gates
  // the greeting — dismiss it if present.
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  const inviteDismiss = page.getByRole("button", { name: "Not now" });
  if (await inviteDismiss.isVisible().catch(() => false)) {
    await inviteDismiss.click();
  }
  await expect(page.getByTestId("storyteller-home-bubble")).toBeVisible({
    timeout: 30_000,
  });
  await page.close();
});

test("settled manual full → WS-4 tile failure: visit switches to scout, manual record untouched", async ({
  context,
}) => {
  test.setTimeout(240_000);
  // A weak device whose player settled on FULL by hand (the old
  // dialog's decline wrote exactly this record). Mirrors
  // ws4-tile-fallback.desktop.spec.ts: every satellite tile fails.
  await seedManualMode(context, "full");
  await context.route("**/server.arcgisonline.com/**", (route) => route.abort());
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "full",
    source: "manual",
  });

  // The run starts on the full map, the pictures fail, and the game
  // offers its one "Try again" (WS-4 Phase 1, owner decision 2026-10-15).
  await startGlobeRun(page, 0);
  const card = page.getByRole("alert").filter({
    hasText:
      "The map pictures won't load right now. Check your internet, then tap Try again.",
  });
  await expect(card).toBeVisible({ timeout: 60_000 });

  // The retry fails too, so this visit switches to Scout Map — but the
  // WS-4 switch stores nothing, so a network failure never overwrites
  // the player's settled choice.
  await card.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => readMapMode(page), { timeout: 90_000 }).toBe("scout");
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "full",
    source: "manual",
  });

  // The switch note arrives at the next natural break, after the reveal.
  await commitMiss(page);
  await expect(
    page.getByText("We switched to Scout Map so you can keep playing."),
  ).toBeVisible({ timeout: 30_000 });
  await page.close();
});
