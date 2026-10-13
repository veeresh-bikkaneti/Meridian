/**
 * Scout Map capability-offer E2E — the owner directive: a
 * capability-detected weak device gets a CHOICE dialog, never a silent
 * routing.
 *
 * Paths walked:
 * - probe-weak (this VM's SwiftShader) → dialog with probe copy →
 *   accept lands scout (accepted: true, source preserved; never decays).
 * - decline → manual "full" stored (never decays) → no re-prompt on the
 *   next boot.
 * - low-memory (spoofed: capable GPU + 1 GB) → dialog with memory copy.
 * - accepted choice, even 400 days old → the dialog never re-appears.
 * - decayed auto record nobody answered → the dialog re-appears (fresh
 *   re-qualification).
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

  // Accept stores the scout assignment with the source preserved and
  // accepted: true — a person's answer, so it never decays.
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "scout",
    source: "probe",
    accepted: true,
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
  await expect(modal).toContainText("doesn't have much memory");

  // Accepting a low-memory offer stores source "low-memory", accepted.
  await modal.getByRole("button", { name: "Use Scout Map" }).click();
  await expect(modal).toBeHidden();
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "scout",
    source: "low-memory",
    accepted: true,
  });
  await page.close();
});

test("accepted scout, 400 days old → never re-offered", async ({ context }) => {
  // The old behavior re-asked after 7 days. An accepted choice must stand
  // on a still-weak device (this VM's SwiftShader) however old it is.
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
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(3_000);
  await expect(offerModal(page)).toBeHidden();
  // The stored choice stands untouched (boot never rewrites it).
  expect(await readStoredMapMode(page)).toMatchObject({ mode: "scout", source: "probe", accepted: true });
  // ...and it is what actually mounts.
  await startGlobeRun(page);
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("scout");
  await page.close();
});

test("decayed auto record nobody answered → dialog re-appears on fresh probe", async ({
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

test("greeting waits while the choice dialog is open (UX BLOCK 2)", async ({
  context,
}) => {
  // No spoof: this VM's Chromium IS the weak device (SwiftShader probe),
  // so the capability dialog opens on boot.
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });

  // While the dialog is open, the storyteller greeting must stay quiet:
  // no bubble behind the modal.
  const bubble = page.getByTestId("storyteller-home-bubble");
  await page.waitForTimeout(3_000);
  await expect(bubble).toBeHidden();

  // Resolve the dialog (decline = explicit full choice); the greeting may
  // then start on the now-quiet home screen. The first-run tutorial invite
  // also gates the greeting — dismiss it if present.
  await modal.getByRole("button", { name: "Keep full map" }).click();
  await expect(modal).toBeHidden();
  const inviteDismiss = page.getByRole("button", { name: "Not now" });
  if (await inviteDismiss.isVisible().catch(() => false)) {
    await inviteDismiss.click();
  }
  await expect(bubble).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test("scrim dismiss writes nothing: dialog re-fires next boot (UX BLOCK 1)", async ({
  context,
}) => {
  // No spoof: this VM's Chromium IS the weak device (SwiftShader probe).
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });

  // Dismiss via the scrim (click the overlay outside the dialog box).
  const clicked = await modal.evaluate((overlay) => {
    const dialog = overlay.querySelector('[role="dialog"]') ?? overlay;
    const o = overlay.getBoundingClientRect();
    const d = dialog.getBoundingClientRect();
    const y = d.top > o.top + 8 ? (o.top + d.top) / 2 : o.top + 4;
    const x = (o.left + o.right) / 2;
    const el = document.elementFromPoint(x, y);
    if (el && (el === overlay || (overlay.contains(el) && !dialog.contains(el)))) {
      (el as HTMLElement).click();
      return true;
    }
    overlay.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
    );
    return true;
  });
  expect(clicked).toBe(true);
  await expect(modal).toBeHidden({ timeout: 10_000 });

  // A stray tap is not a choice: nothing persisted.
  expect(await readStoredMapMode(page)).toBeNull();

  // Next boot on the still-weak device: the dialog re-fires.
  await page.reload();
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal).toHaveAttribute("data-offer-source", "probe");
  await page.close();
});
