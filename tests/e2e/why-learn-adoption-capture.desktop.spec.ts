import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * ADOPTION MOCK capture spec (staging only — never a PR).
 *
 * Drives the real built app with the Why Learn adoption staging
 * edits (Lanes A–D composed) and records the three composed
 * screens at five viewports into captures/ at the worktree root:
 *   (a) picker — sticker skin + subject colours + stamps + Grandpa
 *   (b) math case at the hunch step (flap down over the scene)
 *   (c) math result — hunch named back + stamp earned + flap lifted
 *
 * Seeds: age profile band 7-10, read-aloud pref "never", and the
 * subject-progress store with Math + Chemistry fully solved for
 * band 7-10 (ids read from the subjects' own items.ts records, so
 * the Lane A band-complete derivation earns real stamps).
 */
test.setTimeout(600_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const PREF_KEY = "meridian.readAloudPref.v1";
const PROGRESS_KEY = "meridian.subject-progress.v1";
const BAND = "7-10";

const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  { name: "320x568", width: 320, height: 568 },
] as const;

function bandIds(subject: string, band: string): string[] {
  const src = readFileSync(`src/subjects/${subject}/items.ts`, "utf8");
  const ids: string[] = [];
  const re = /"id": "([^"]+)",\s*\n\s*"group": "([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[2] === band) ids.push(m[1]);
  }
  return ids;
}

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  const progress = {
    math: bandIds("math", BAND),
    chemistry: bandIds("chemistry", BAND),
  };
  await context.addInitScript(
    ({ profileKey, prefKey, progressKey, progressDoc }) => {
      window.localStorage.setItem(
        profileKey,
        JSON.stringify({
          status: "active",
          band: "7-10",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
      window.localStorage.setItem(
        prefKey,
        JSON.stringify({
          schemaVersion: 1,
          value: "never",
          updatedAt: new Date().toISOString(),
        }),
      );
      window.localStorage.setItem(progressKey, JSON.stringify(progressDoc));
    },
    { profileKey: PROFILE_KEY, prefKey: PREF_KEY, progressKey: PROGRESS_KEY, progressDoc: progress },
  );
}

async function openPicker(page: Page) {
  await page.goto(APP_URL);
  await page.waitForTimeout(700);
  // Fallback only: the pref seed should keep the first-visit
  // read-aloud ask from mounting at all.
  const never = page.getByRole("button", { name: "Never", exact: true });
  if (await never.isVisible().catch(() => false)) {
    await never.click();
  }
  const card = page.getByTestId("home-card-why-learn");
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

test("why-learn adoption mock — composed screens at five viewports", async ({ context, page }) => {
  await setup(context);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // (a) Picker: sticker skin + colour tokens + stamps + Grandpa.
    await openPicker(page);
    await expect(
      page.getByTestId("subject-row-math").locator(".wl-stamp-chip"),
    ).toBeVisible();
    await expect(
      page.getByTestId("subject-row-chemistry").locator(".wl-stamp-chip"),
    ).toBeVisible();
    await expect(
      page.getByTestId("subject-row-physics").locator(".wl-stamp-chip"),
    ).toHaveCount(0);
    await page.waitForTimeout(1800); // rise cascade + stamp-in settle
    await page.screenshot({ path: `captures/picker-${vp.name}.png`, fullPage: true });

    // (b) Math case at the hunch step: flap down, clue, hunch card.
    await page.getByTestId("subject-row-math").click();
    await expect(page.getByTestId("math-case")).toBeVisible();
    await expect(page.getByTestId("math-scene-flap")).toBeVisible();
    await expect(page.getByTestId("math-hunch-card")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `captures/hunch-${vp.name}.png`, fullPage: true });

    // (c) Lift the flap, hunch wrong (6), answer right (8): result
    // band names the hunch back, stamp earned, scene solved/open.
    await page.getByTestId("math-scene-flap").click();
    await page.waitForTimeout(600); // 380ms hinge + settle
    await expect(page.getByTestId("math-scene-flap")).toHaveCount(0);
    await page
      .getByTestId("math-hunch-card")
      .getByRole("button", { name: "6", exact: true })
      .click();
    const answers = page.getByTestId("math-answer-card");
    await expect(answers).toBeVisible();
    await answers.getByRole("button", { name: "8", exact: true }).click();
    await dismissCelebration(page);
    const result = page.getByTestId("math-result");
    await expect(result).toBeVisible();
    await expect(result.locator(".wl-stamp-case")).toBeVisible();
    await expect(result.locator(".wl-hunch-line")).toContainText("You guessed");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `captures/result-${vp.name}.png`, fullPage: true });
  }
});
