import { test, expect, type Page } from "playwright/test";
import { mkdir } from "node:fs/promises";
import { serveBuiltArtifact } from "./helpers";

/**
 * Fix G — mascot tap while the banner is stuck in `entering`.
 *
 * The tutorial invite holds `started` false, so the 150ms beat never runs
 * and a figure tap used to render nothing. This tap is the gesture that
 * must release the lock and show the greeting.
 *
 * Project: mobile (390×844, touch). Screenshots land in
 * /workspace/screenshots for the review packet.
 */
test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const SHOTS = "/workspace/screenshots";

const GREETINGS = [
  "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?",
  "New day, new tales hiding in the hills. Shall we go find one?",
  "Psst… the rivers told me a secret this morning. Want to hear it?",
  "Somewhere out there, a mountain is keeping a story warm. Let's go find it.",
  "The winds brought rumors from faraway cities today. Curious?",
  "Every dot on this map has a tale. Which one shall we wake up first?",
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function expectedGreeting(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return GREETINGS[day % GREETINGS.length]!;
}

async function seedTourSeen(page: Page): Promise<void> {
  await page.context().addInitScript((day: string) => {
    try {
      localStorage.setItem("meridian.grandpaTour.lastDate", day);
    } catch {
      /* private mode */
    }
  }, todayKey());
}

test("figure tap during the tutorial invite leaves entering and shows the greeting", async ({
  page,
}) => {
  await mkdir(SHOTS, { recursive: true });
  await seedTourSeen(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  await page.goto(APP);
  const host = page.getByTestId("storyteller-home");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("tutorial-invite")).toBeVisible({ timeout: 10_000 });

  // The bug: phase stays entering for the whole time the invite is up.
  await expect
    .poll(async () => host.getAttribute("data-phase"), { timeout: 3_000 })
    .toBe("entering");

  await page.screenshot({
    path: `${SHOTS}/storyteller-entering-before-tap.png`,
    fullPage: false,
  });

  await page.getByTestId("storyteller-figure").click();

  await expect
    .poll(async () => host.getAttribute("data-phase"), { timeout: 8_000 })
    .not.toBe("entering");

  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 8_000 });
  await expect(caption).toContainText(expectedGreeting());

  const phase = await host.getAttribute("data-phase");
  await page.screenshot({
    path: `${SHOTS}/storyteller-entering-after-tap.png`,
    fullPage: false,
  });

  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
  expect(phase === "entering", `phase still entering after tap (${phase})`).toBe(false);
});
