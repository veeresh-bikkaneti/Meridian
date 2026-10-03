import { test, expect, type BrowserContext, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  readRun,
} from "./helpers";

/**
 * Crash-loop breaker E2E (crash-investigation branch).
 *
 * The game stamps `meridian.cleanExit="0"` on every run write and flips it
 * to "1" only on `pagehide`. A process kill (jetsam/WebKit) never fires
 * pagehide, so the boot effect can tell a kill apart from a normal unload:
 * a "0" flag means the previous page died mid-game — clear the stale run
 * and land on the menu instead of auto-resuming into the same crash path.
 * A missing flag (pre-update runs) counts as clean.
 *
 * (a) seed saved run + cleanExit="0" → menu shows, game does NOT auto-start,
 *     the stale run is cleared and the flag re-armed to "1".
 * (b) seed saved run + cleanExit="1" → the run resumes as before.
 * (c) start a run, reload normally (pagehide fires) → resume still works.
 *
 * React #418 is a pre-existing flaky hydration warning on unmodified loads
 * (sibling crew's `fix/reload-reveal-restore` area), so it is excluded from
 * the clean-console assertion here, exactly as in pwa.spec.ts.
 */

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const RUN_KEY = "meridian.run";
const CLEAN_EXIT_KEY = "meridian.cleanExit";

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

function expectCleanConsole(errors: string[]) {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant).toEqual([]);
}

/** Capture a real, resumable saved-run payload from a live globe run. */
async function captureSavedRun(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await startGlobeRun(page);
  const run = await readRun(page);
  expect(run.phase, "captured run must be resumable").not.toBe("summary");
  const raw = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    RUN_KEY,
  );
  await page.close();
  expect(raw, "run must be persisted to sessionStorage").not.toBeNull();
  return raw as string;
}

async function seed(context: BrowserContext,
  runJson: string,
  flag: "0" | "1",
): Promise<void> {
  await context.addInitScript(
    ({ json, flag: f }: { json: string; flag: string }) => {
      sessionStorage.setItem("meridian.run", json);
      sessionStorage.setItem("meridian.cleanExit", f);
    },
    { json: runJson, flag },
  );
}

test("kill simulation: cleanExit=0 lands on the menu, clears the stale run, re-arms clean", async ({
  context,
}) => {
  const runJson = await captureSavedRun(context);
  await seed(context, runJson, "0");

  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(APP_URL);

  // The game does NOT auto-start: the menu is the landing.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await expect(page.locator(".satellite-map")).toHaveCount(0);

  // The stale run was cleared and the flag re-armed to clean, so this
  // landing is never stuck dirty.
  const afterRun = await page.evaluate((key) => sessionStorage.getItem(key), RUN_KEY);
  const afterFlag = await page.evaluate((key) => sessionStorage.getItem(key), CLEAN_EXIT_KEY);
  expect(afterRun, "stale run cleared").toBeNull();
  expect(afterFlag, "flag re-armed").toBe("1");

  expectCleanConsole(errors);
  await page.close();
});

test("clean exit: cleanExit=1 resumes the saved run exactly as before", async ({
  context,
}) => {
  const runJson = await captureSavedRun(context);
  await seed(context, runJson, "1");

  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(APP_URL);

  // The run auto-resumes: game screen mounts, aim phase.
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  expectCleanConsole(errors);
  await page.close();
});

test("normal reload: pagehide stamps clean, so the run still resumes", async ({
  context,
  page,
}) => {
  const errors = collectErrors(page);
  await startGlobeRun(page);

  // The live page holds dirty state while the game is in flight.
  const dirtyFlag = await page.evaluate((key) => sessionStorage.getItem(key), CLEAN_EXIT_KEY);
  expect(dirtyFlag, "writeRun stamps dirty while the game is live").toBe("0");

  // A normal reload fires pagehide -> flag flips to "1" -> boot resumes.
  await page.reload();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  expectCleanConsole(errors);
});
