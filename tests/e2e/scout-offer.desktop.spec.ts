/**
 * Scout Map prior-crash boot E2E — CONVERTED 2026-10-20.
 *
 * This file pinned the PBI-6 boot OFFER dialog (data-testid=
 * "scout-boot-offer": decline / Esc / scrim / focus-trap semantics).
 * The owner's ruling — "Auto-switch silently on weak devices (my
 * decision stands)" — removed the dialog entirely: a map-attributed
 * prior crash now switches the session to Scout SILENTLY at boot and
 * persists an auto record (source "prior-crash", never manual, never
 * accepted) that decays after 7 days like every auto record.
 *
 * What survives from the old contract, re-pinned against the new one:
 * the crash flag is one-shot, a standing record is never rewritten at
 * boot, a clean boot writes nothing, and a manual record beats the
 * crash flag. The dialog-specific tests (Esc/scrim/focus) are gone
 * because the behavior they pinned no longer exists.
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  APP_NO_IDLE,
} from "./helpers";
import {
  readMapMode,
  readStoredMapMode,
  seedCrashOffer,
  seedManualMode,
  spoofCapableDevice,
} from "./scout-helpers";

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  // Production boot behavior: do NOT suppress the auto-switch.
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
});

test("prior crash → silent scout at boot: auto record written, no dialog, scout mounts", async ({
  context,
}) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  // Home is directly usable — nothing modal gates the first visit.
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("scout-boot-offer")).toHaveCount(0);

  // The boot persisted an AUTO record: qualifying source kept, and it
  // is nobody's answer (no accepted flag — it decays after 7 days).
  const stored = await readStoredMapMode(page);
  expect(stored).toMatchObject({ mode: "scout", source: "prior-crash" });
  expect((stored as unknown as Record<string, unknown>)?.accepted).toBeUndefined();

  // And the session really is in Scout when a run starts.
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("scout");
  await page.close();
});

test("the crash flag is one-shot: the next boot stands on the stored record, unrewritten", async ({
  context,
}) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  const first = await readStoredMapMode(page);
  expect(first).toMatchObject({ mode: "scout", source: "prior-crash" });

  // Reload: the breadcrumb was consumed at the first boot, so no fresh
  // qualification happens — the stored record stands and boot does NOT
  // rewrite it (a rewrite would refresh setAt and defeat the decay).
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  const second = await readStoredMapMode(page);
  expect(second).toMatchObject({ mode: "scout", source: "prior-crash" });
  expect(second?.setAt).toBe(first?.setAt);
  await page.close();
});

test("fail-closed: a clean boot without the crash flag writes nothing and stays full", async ({
  context,
}) => {
  // Spoof a capable device so "clean boot" genuinely means capable.
  await spoofCapableDevice(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  expect(await readStoredMapMode(page)).toBeNull();

  await startGlobeRun(page);
  expect(await readMapMode(page)).toBe("full");
  await page.close();
});

test("manual override beats the crash flag", async ({ context }) => {
  await seedManualMode(context, "full");
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  // The stored manual choice stands; the crash flag changes nothing.
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "full",
    source: "manual",
  });
  await startGlobeRun(page);
  expect(await readMapMode(page)).toBe("full");
  await page.close();
});
