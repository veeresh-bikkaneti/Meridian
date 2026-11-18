import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Band-switch regression (Why Learn D1, 2026-11-18): the band
 * control now lives in the hero title block, and its collapsed
 * set state is the selected-band pill. This spec drives the real
 * flow with NO seeded band:
 *
 *   unset → pick Ages 7-10 in the title block → the selected
 *   pill reads "Ages 7-10" and every card's count equals the
 *   7-10 dealing → tap the pill → pick Ages 18+ → the pill
 *   reads "Ages 18+" and every count equals the 18+ dealing.
 *
 * Expected counts are the picker's own dealing, mirrored from
 * the app data: pickerRows (src/subjects/shared/picker-rows.ts)
 * counts each released module's units filtered by band
 * (unit.group === band) — math 22 / physics 12 / chemistry 5 /
 * general knowledge 5 / social studies 4 / journals 8 at 7-10,
 * and 3 / 3 / 3 / 2 / 3 / 1 at 18+. If the picker ever deals the
 * wrong band (e.g. the filter stops applying the picked band),
 * the counts stay at the previous band's values and this spec
 * fails — that is the regression it pins.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

const EXPECTED_COUNTS: Record<string, Record<string, string>> = {
  "7-10": {
    math: "22 cases",
    physics: "12 cases",
    chemistry: "5 cases",
    "general-knowledge": "5 cases",
    "social-studies": "4 cases",
    journals: "8 cases",
  },
  "18+": {
    math: "3 cases",
    physics: "3 cases",
    chemistry: "3 cases",
    "general-knowledge": "2 cases",
    "social-studies": "3 cases",
    journals: "1 case",
  },
};

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  // No profile seed: the band starts unset, on purpose.
}

async function openPicker(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-row-math")).toBeVisible({ timeout: 30_000 });
}

async function expectCounts(page: Page, band: string) {
  for (const [id, label] of Object.entries(EXPECTED_COUNTS[band])) {
    await expect(
      page.getByTestId(`subject-row-${id}`).locator(".why-learn-chip"),
      `${id} count at ${band}`,
    ).toHaveText(label);
  }
}

async function runFlow(page: Page) {
  // Unset: the three pills are in the title block; there is no
  // selected pill and exactly one band control on the page.
  await expect(page.getByTestId("band-pills")).toBeVisible();
  await expect(page.getByTestId("band-selected-pill")).toHaveCount(0);
  await expect(page.getByTestId("age-band-control")).toHaveCount(1);
  await expect(
    page.locator('.screen-hero-band [data-testid="age-band-control"]'),
    "the one band control lives in the hero title block",
  ).toHaveCount(1);

  // Pick Ages 7-10: the pill names the pick, the list re-deals.
  await page.getByTestId("band-pill-7-10").click();
  await expect(page.getByTestId("band-selected-pill")).toHaveText("Ages 7-10");
  await expect(page.getByTestId("band-selected-pill")).toHaveAttribute(
    "aria-label",
    "Age band: Ages 7-10. Tap to change band.",
  );
  await expect(page.getByTestId("band-pills")).toHaveCount(0);
  await expectCounts(page, "7-10");

  // Tap the pill: the pills re-open in place, current band marked.
  await page.getByTestId("band-selected-pill").click();
  await expect(page.getByTestId("band-pills")).toBeVisible();
  await expect(page.getByTestId("band-pill-7-10")).toHaveAttribute("aria-pressed", "true");

  // Graduate to Ages 18+: pill and counts follow the new band.
  await page.getByTestId("band-pill-18+").click();
  await expect(page.getByTestId("band-selected-pill")).toHaveText("Ages 18+");
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 18+");
  await expectCounts(page, "18+");
}

test("title-block band switch re-deals the picker (1280x800)", async ({ page, context }) => {
  await setup(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPicker(page);
  await runFlow(page);
});

test("title-block band switch re-deals the picker (390x844)", async ({ page, context }) => {
  await setup(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPicker(page);
  await runFlow(page);
});
