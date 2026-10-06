import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * CometMascot E2E — desktop (1440×900, fine pointer, full motion).
 *
 * Covers: renders bottom-right at 120–140px without covering CTAs,
 * boop reaction fires, dizzy easter egg (4 boops), cursor tracking works,
 * greeting shows once per day, autoplay gate (audio held until gesture),
 * sound-off speaker opt-in, no console errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const LAST_DATE_KEY = "meridian.cometGreeting.lastDate";
const SOUND_KEY = "meridian.sound";

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const yesterdayKey = () => localKey(new Date(Date.now() - 86_400_000));
const todayKey = () => localKey(new Date());

function expectedIndex(): number {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - jan1.getTime()) / 86_400_000) % 12;
}

async function loadHome(
  page: Page,
  opts: { lastDate?: string; sound?: "on" | "off" } = {},
): Promise<string[]> {
  await page.context().addInitScript(
    ({ lastDate, sound }: { lastDate?: string; sound?: string }) => {
      try {
        // Set-if-absent: a reload must see the values the app itself wrote,
        // otherwise the once-per-day gate can't be tested across reloads.
        if (lastDate && !localStorage.getItem("meridian.cometGreeting.lastDate"))
          localStorage.setItem("meridian.cometGreeting.lastDate", lastDate);
        if (sound && !localStorage.getItem("meridian.sound"))
          localStorage.setItem("meridian.sound", sound);
      } catch {
        /* private mode — ignore */
      }
    },
    opts,
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("comet-mascot")).toBeVisible({ timeout: 20_000 });
  return errors;
}

/** The mascot must never sit on top of a CTA tap target. */
async function expectCtasUncovered(page: Page) {
  const ctas = [
    page.getByRole("button", { name: /solve a mystery|resume your case/i }),
    page.getByRole("button", { name: "Choose a state" }),
    page.getByRole("button", { name: "Choose a country" }),
    page.getByRole("button", { name: "Play the globe" }),
    page.getByTestId("sound-toggle"),
  ];
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const box = await cta.boundingBox();
    expect(box, "CTA has a bounding box").not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const top = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el as HTMLElement).outerHTML.slice(0, 120) : "none";
      },
      [cx, cy],
    );
    expect(
      top.includes("comet-mascot") || top.includes("comet-greeting"),
      `CTA center covered by mascot: ${top}`,
    ).toBe(false);
  }
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("renders bottom-right at desktop size without covering CTAs", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey() });
  const box = await page.getByTestId("comet-mascot").boundingBox();
  expect(box).not.toBeNull();
  // 120–140px desktop.
  expect(box!.width).toBeGreaterThanOrEqual(120);
  expect(box!.width).toBeLessThanOrEqual(140);
  // Bottom-right: within 40px of the viewport corner.
  const vp = page.viewportSize()!;
  expect(vp.width - (box!.x + box!.width)).toBeLessThanOrEqual(40);
  expect(vp.height - (box!.y + box!.height)).toBeLessThanOrEqual(40);
  await expectCtasUncovered(page);
  expectCleanConsole(errors);
});

test("boop fires the squash reaction and resets", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey() });
  const mascot = page.getByTestId("comet-mascot");
  await mascot.click();
  await expect(mascot).toHaveAttribute("data-state", "booped");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 5000 });
  expectCleanConsole(errors);
});

test("four quick boops trigger the dizzy easter egg", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey() });
  const mascot = page.getByTestId("comet-mascot");
  for (let i = 0; i < 4; i++) {
    await mascot.click({ delay: 60 });
  }
  await expect(mascot).toHaveAttribute("data-state", "dizzy", { timeout: 5000 });
  await expect(page.locator(".comet-svg")).toHaveAttribute("data-eyes", "dizzy");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 8000 });
  expectCleanConsole(errors);
});

test("cursor tracking turns the head toward the pointer", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey() });
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-tracking", "on");
  const pupils = page.getByTestId("comet-pupils");
  // Top-left corner: far outside the 70px dead zone → head turns NW.
  await page.mouse.move(60, 60);
  await expect
    .poll(async () => pupils.getAttribute("style"), { timeout: 5000 })
    .not.toContain("translate(0px, 0px)");
  const turned = await pupils.getAttribute("style");
  expect(turned).toContain("-"); // NW = negative x/y offsets
  // Back onto the mascot: inside the dead zone → neutral pose.
  const box = await mascot.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect
    .poll(async () => pupils.getAttribute("style"), { timeout: 5000 })
    .toContain("translate(0px, 0px)");
  expectCleanConsole(errors);
});

test("greeting shows once per local day", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey() });
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-greeting-index", String(expectedIndex()));
  const text = await page.getByTestId("comet-greeting-text").getAttribute("aria-label");
  expect(text).toBeTruthy();
  expect(text!.length).toBeGreaterThan(20);

  // Reload same day → no greeting.
  await page.reload();
  await expect(page.getByTestId("comet-mascot")).toBeVisible();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);

  // Next day → greeting returns.
  await page.evaluate((key) => localStorage.setItem(key, "2000-01-01"), LAST_DATE_KEY);
  await page.reload();
  await expect(page.getByTestId("comet-greeting")).toBeVisible();
  expectCleanConsole(errors);
});

test("autoplay gate: audio waits for the first gesture, then plays in sync", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey(), sound: "on" });
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-sound", "on");
  // No interaction yet → audio held.
  await expect(bubble).toHaveAttribute("data-audio", "idle");
  // First gesture anywhere → audio starts (or cleanly fails over).
  await page.mouse.click(200, 200);
  await expect
    .poll(async () => bubble.getAttribute("data-audio"), { timeout: 15_000 })
    .not.toBe("idle");
  const state = await bubble.getAttribute("data-audio");
  expect(["playing", "ended"]).toContain(state);
  expectCleanConsole(errors);
});

test("sound off: text greeting with speaker opt-in that leaves the toggle alone", async ({
  page,
}) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey(), sound: "off" });
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-sound", "off");
  const speaker = page.getByTestId("comet-greeting-speaker");
  await expect(speaker).toBeVisible();
  await speaker.click();
  await expect
    .poll(async () => bubble.getAttribute("data-audio"), { timeout: 15_000 })
    .not.toBe("idle");
  // The global toggle is untouched by the opt-in.
  const sound = await page.evaluate(() => localStorage.getItem("meridian.sound"));
  expect(sound).toBe("off");
  expectCleanConsole(errors);
});

test("tap dismisses the greeting instantly", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: yesterdayKey(), sound: "off" });
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await bubble.click();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  // Mascot stays put — only the bubble dismisses.
  await expect(page.getByTestId("comet-mascot")).toBeVisible();
  expectCleanConsole(errors);
});

test("no greeting when already greeted today", async ({ page }) => {
  const errors = await loadHome(page, { lastDate: todayKey() });
  await expect(page.getByTestId("comet-mascot")).toBeVisible();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  expectCleanConsole(errors);
});
