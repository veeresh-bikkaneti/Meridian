/**
 * Scout Map boot-offer E2E (PBI-6 + Phase A UX contract).
 *
 * Contract: data-testid="scout-boot-offer" fires ONLY when the
 * map-attributed prior-crash flag is set, once per boot. The explicit
 * decline button ("Keep full map") records a permanent manual full choice.
 * Esc / scrim click merely DISMISS the dialog without persisting anything
 * (a stray tap is not a choice) — the dialog may re-fire next boot.
 * Focus is trapped while open.
 *
 * PBI-6 dependency: fails until the dev implements the offer modal.
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
  readStoredMapMode,
  seedCrashOffer,
  seedManualMode,
  spoofCapableDevice,
} from "./scout-helpers";

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  // This spec exercises the boot dialog itself — do NOT suppress it.
  await serveBuiltArtifact(context, { suppressScoutOffer: false });
});

test("offer modal appears exactly once per boot when the crash flag is set", async ({
  context,
}) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  expect(await modal.count()).toBe(1);

  // Decline via the "Keep full map" explicit choice.
  await modal.getByRole("button", { name: "Keep full map" }).click();
  await expect(modal).toBeHidden();

  // No re-fire within the same boot.
  await page.waitForTimeout(3_000);
  await expect(modal).toBeHidden();

  // The decline retires the offer flag (see the decline-retires test):
  // a fresh boot after declining shows no modal.
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(3_000);
  await expect(modal).toBeHidden();
  await page.close();
});

test("Esc dismisses WITHOUT persisting (not a choice)", async ({ context }) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();

  // Esc is a dismissal, not a choice: nothing is persisted.
  expect(await readStoredMapMode(page)).toBeNull();

  // The dialog may re-fire on the next boot (fresh crash flag).
  await seedCrashOffer(context);
  await page.reload();
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test("scrim click dismisses WITHOUT persisting (not a choice)", async ({ context }) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });

  // Click the overlay outside the dialog box itself: the dialog's
  // bounding box subtracted from the overlay's; click the center of the
  // leftover region. If the dialog fills the overlay there is no scrim
  // to click and the contract's scrim-decline is untestable by click.
  const clicked = await modal.evaluate((overlay) => {
    const dialog =
      overlay.querySelector('[role="dialog"]') ?? overlay;
    const o = overlay.getBoundingClientRect();
    const d = dialog.getBoundingClientRect();
    // A strip above the dialog is scrim in the standard centered-modal
    // layout; fall back to the overlay's top-left corner padding.
    const y = d.top > o.top + 8 ? (o.top + d.top) / 2 : o.top + 4;
    const x = (o.left + o.right) / 2;
    const el = document.elementFromPoint(x, y);
    if (el && (el === overlay || overlay.contains(el) && !dialog.contains(el))) {
      (el as HTMLElement).click();
      return true;
    }
    // Last resort: dispatch on the overlay itself at scrim coordinates —
    // a correct implementation closes when the click target is the scrim.
    overlay.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
    );
    return true;
  });
  expect(clicked).toBe(true);
  await expect(modal).toBeHidden({ timeout: 10_000 });

  // Scrim click is a dismissal, not a choice: nothing is persisted.
  expect(await readStoredMapMode(page)).toBeNull();

  // The dialog may re-fire on the next boot (fresh crash flag).
  await seedCrashOffer(context);
  await page.reload();
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test("focus is trapped inside the modal while open", async ({ context }) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });

  // Initial focus lands inside the modal (poll: the focus effect runs
  // just after first paint, so a single synchronous check can race it).
  await expect
    .poll(() => modal.evaluate((m) => m.contains(document.activeElement)), {
      timeout: 10_000,
    })
    .toBe(true);

  // Tab through more times than there are focusable elements: focus must
  // never escape the modal.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const inside = await modal.evaluate((m) => m.contains(document.activeElement));
    expect(inside, `focus escaped the modal on Tab #${i + 1}`).toBe(true);
  }

  // Shift+Tab wraps too.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Shift+Tab");
    const inside = await modal.evaluate((m) => m.contains(document.activeElement));
    expect(inside, `focus escaped the modal on Shift+Tab #${i + 1}`).toBe(true);
  }
  await page.close();
});

test("declining retires the offer: no modal on the next boot", async ({
  context,
}) => {
  await seedCrashOffer(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  const modal = offerModal(page);
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await modal.getByRole("button", { name: "Keep full map" }).click();
  await expect(modal).toBeHidden();

  // The decline must retire the offer — "Keep full map" must not nag on
  // every subsequent boot. The decline is stored as the user's explicit
  // manual "full" choice (dev's call per the contract): on a weak device
  // the next boot's fresh probe would otherwise re-fire the dialog.
  expect(await readStoredMapMode(page)).toMatchObject({
    mode: "full",
    source: "manual",
  });

  // Asserted behaviorally: no modal on the next boot.
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(3_000);
  await expect(modal).toBeHidden();
  await page.close();
});

test("fail-closed: NO offer on a clean boot without the crash flag", async ({
  context,
}) => {
  // The harness VM reads as a weak device (SwiftShader) — spoof a capable
  // device so "clean boot" genuinely means capable.
  await spoofCapableDevice(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  // Settle: the offer fires at boot, so "never appears" needs a wait.
  await page.waitForTimeout(5_000);
  await expect(offerModal(page)).toBeHidden();

  // And still none once a run is underway.
  await startGlobeRun(page);
  await expect(offerModal(page)).toBeHidden();
  expect(await readPhase(page)).toBe("aim");
  await page.close();
});

test("manual override suppresses the offer path", async ({ context }) => {
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
