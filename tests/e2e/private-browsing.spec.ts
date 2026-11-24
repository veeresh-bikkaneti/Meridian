import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * TD-16.1 — age band and subject progress when storage is unavailable.
 *
 * Private browsing is not one behaviour. Android Chrome's private
 * session keeps site data until the last private tab closes. iOS
 * Safari's private session can refuse Web Storage instead: setItem
 * throws QuotaExceededError against a zero quota, and on some
 * versions every call throws SecurityError. This spec emulates both
 * refusals in the page, before the app boots, and drives the real
 * screens. The stores reach storage only through the storage port
 * (the age-profile slot's throwing backend, and subject progress's
 * fail-soft port). Nothing here stubs those stores.
 *
 * Contract under test:
 * - The age band survives the visit. A refused write keeps the
 *   choice in the store's in-memory fallback, so leaving Why Learn
 *   and coming back still shows the picked band. A reload cannot
 *   resurrect it, because nothing was stored, and the ask returns.
 * - Progress fails soft. A solved case still finishes. The port
 *   drops the write, so Math's Reset stays disabled — the screen
 *   does not pretend the solve was saved. No call throws into the
 *   page.
 *
 * Registered twice in playwright.config.ts: private-browsing-chromium
 * always, private-browsing-webkit only when WebKit is installed.
 * The file matches neither the desktop nor the mobile project.
 */

test.setTimeout(150_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

type StorageMode = "quota" | "throw-all";

async function installBlockedStorage(context: BrowserContext, mode: StorageMode) {
  // Patch Storage.prototype, not the window properties. The object
  // stays a real Storage (replacing it crashes the renderer on this
  // browser). Page scripts still see the refusal; both local and
  // session storage share the prototype, which is what a private
  // session that blocks Web Storage does.
  await context.addInitScript((which: StorageMode) => {
    const deny = (name: "QuotaExceededError" | "SecurityError") => {
      const message =
        name === "QuotaExceededError"
          ? "Failed to execute setItem on Storage: Setting the value exceeded the quota."
          : "The operation is insecure.";
      throw new DOMException(message, name);
    };
    const proto = Storage.prototype;
    const appKey = (key: unknown) => typeof key === "string" && key.indexOf("meridian") !== -1;
    // Reads and writes of the app's own keys refuse. Other keys
    // stay empty and quiet: this browser calls Storage from native
    // input code, and a throw on those calls kills the renderer.
    // length and key stay non-throwing for the same reason. The
    // app's port and the age-profile slot only touch meridian keys,
    // so the refusal still reaches them.
    if (which === "throw-all") {
      proto.getItem = function (key: string) {
        if (appKey(key)) deny("SecurityError");
        return null;
      };
      proto.setItem = function (key: string) {
        if (appKey(key)) deny("SecurityError");
      };
      proto.removeItem = function (key: string) {
        if (appKey(key)) deny("SecurityError");
      };
      proto.clear = function () {
        deny("SecurityError");
      };
      proto.key = function () {
        return null;
      };
      Object.defineProperty(proto, "length", {
        configurable: true,
        get() {
          return 0;
        },
      });
      return;
    }
    proto.getItem = function () {
      return null;
    };
    proto.setItem = function () {
      deny("QuotaExceededError");
    };
    proto.removeItem = function () {
      deny("QuotaExceededError");
    };
    proto.clear = function () {
      deny("QuotaExceededError");
    };
    proto.key = function () {
      return null;
    };
    Object.defineProperty(proto, "length", {
      configurable: true,
      get() {
        return 0;
      },
    });
  }, mode);
}

async function setup(context: BrowserContext, mode: StorageMode) {
  await installBlockedStorage(context, mode);
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

/** The emulation is still in force: a write does not land. */
async function assertStorageRefuses(page: Page, mode: StorageMode) {
  const probe = await page.evaluate(() => {
    let setName = "ok";
    try {
      localStorage.setItem("meridian.probe", "1");
    } catch (err) {
      setName = err instanceof DOMException ? err.name : "thrown";
    }
    let got: string | null = "threw";
    try {
      got = localStorage.getItem("meridian.ageProfile.v1");
    } catch {
      got = "threw";
    }
    return { setName, got };
  });
  if (mode === "quota") {
    expect(probe.setName).toBe("QuotaExceededError");
    expect(probe.got).toBeNull();
  } else {
    expect(probe.setName).toBe("SecurityError");
    expect(probe.got).toBe("threw");
  }
}

async function armSheetDismiss(page: Page) {
  // The read-aloud arrival sheet holds the page when storage has no
  // answer. A throwing read makes the tutorial look already seen, so
  // the sheet is first and it covers Why Learn. Answering Never is
  // the player's path; the handler runs only while the sheet is up,
  // including after a reload wipes the in-memory answer.
  await page.addLocatorHandler(
    page.locator('[data-prompt-id="read-aloud-sheet"]'),
    async (sheet) => {
      await sheet.getByRole("button", { name: /Never/ }).click();
    },
  );
}

async function openWhyLearn(page: Page) {
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

async function proveBandAndProgress(page: Page, mode: StorageMode) {
  await assertStorageRefuses(page, mode);
  await openWhyLearn(page);
  await expect(page.getByTestId("band-pills")).toBeVisible();
  await expect(page.getByTestId("band-selected-pill")).toHaveCount(0);

  await page.getByTestId("band-pill-7-10").click();
  await expect(page.getByTestId("band-selected-pill")).toHaveText("Ages 7-10");
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 7-10");

  await page.getByTestId("subject-row-math").click();
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toBeVisible();
  await expect(mathCase).toHaveAttribute("data-band", "7-10");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:groups:skip-count");
  await page.getByTestId("math-answer-card").getByRole("button", { name: "8", exact: true }).click();
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
  await expect(page.getByTestId("math-result")).toContainText("You got it!");

  // Leave and come back inside the same document. The band is not
  // in storage — the probe above already proved the write throws —
  // so the pill only comes back if the memory fallback held it.
  await page.getByRole("button", { name: "Meridian home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();
  await openWhyLearn(page);
  await expect(page.getByTestId("band-selected-pill")).toHaveText("Ages 7-10");
  // The solve went through the progress port. The write was
  // dropped, so the screen must not show a saved reset.
  await expect(page.getByTestId("subject-reset-math")).toBeDisabled();

  await page.reload();
  await assertStorageRefuses(page, mode);
  await openWhyLearn(page);
  await expect(page.getByTestId("band-pills")).toBeVisible();
  await expect(page.getByTestId("band-selected-pill")).toHaveCount(0);
  await expect(page.getByTestId("subject-reset-math")).toBeDisabled();
}

test("quota refusal: the age band survives the visit and progress fails soft", async ({
  page,
  context,
}) => {
  await setup(context, "quota");
  await armSheetDismiss(page);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await expect(page.getByTestId("home-heading")).toBeVisible();
  await proveBandAndProgress(page, "quota");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("throwing storage: the age band survives the visit and progress fails soft", async ({
  page,
  context,
}) => {
  await setup(context, "throw-all");
  await armSheetDismiss(page);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await expect(page.getByTestId("home-heading")).toBeVisible();
  await proveBandAndProgress(page, "throw-all");
  expect(errors, errors.join("\n")).toEqual([]);
});
