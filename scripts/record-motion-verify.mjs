/**
 * Motion-verify screen recordings (owner constitutional rule 2026-10-11).
 *
 * Records the key black-box journeys on the BUILT dist (dist/client) with
 * Playwright video capture — real-time speed, one journey per clip — so the
 * owner can watch the eased motions actually playing before Chitti review.
 *
 * Usage: node scripts/record-motion-verify.mjs [--only <name>]
 * Output: docs/motion-verify/<name>-<width>px.mp4 (converted from webm)
 *
 * Flow: build:pages → test → RECORD (this) → owner watches → Chitti.
 * No recording = the testing did not happen.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "../tests/e2e/helpers.ts";
import { installSfxStub } from "../tests/e2e/sfx-stub.ts";

const BASE = "http://127.0.0.1:4123/Meridian/";
const OUT_DIR = path.resolve("docs/motion-verify");
const RAW_DIR = path.join(OUT_DIR, "raw-webm");

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/meta-chromium/chrome",
  args: ["--disable-dev-shm-usage"],
});

/** Record one journey; returns the mp4 path. */
async function record(name, width, height, options, journey) {
  if (only && name !== only) return null;
  console.log(`▶ recording ${name} @${width}x${height}`);
  const { fullMapMode, ...ctxOptions } = options;
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: RAW_DIR, size: { width, height } },
    ...ctxOptions,
  });
  if (fullMapMode) {
    // PBI-3: headless WebGL probe fails → scout mode → celebration renders
    // motionOff. Pin full mode so the recording shows the real cascade.
    await context.addInitScript(() => {
      localStorage.setItem(
        "meridian:map-mode",
        JSON.stringify({ mode: "full", source: "manual", setAt: Date.now() }),
      );
    });
  }
  await serveBuiltArtifact(context);
  await installSfxStub(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await journey(page);
  } finally {
    const video = page.video();
    await page.close();
    // Finalize the webm, then convert to mp4 (H.264, yuv420p — plays
    // everywhere, including GitHub blob previews).
    const webm = await video.path();
    const mp4 = path.join(OUT_DIR, `${name}-${width}px.mp4`);
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      webm,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      mp4,
    ]);
    rmSync(webm, { force: true });
    await context.close();
    console.log(
      `  ✓ ${path.basename(mp4)}${errors.length ? ` (pageerrors: ${errors.join("; ")})` : ""}`,
    );
    return mp4;
  }
}

const results = [];

// 1. Home atlas entrance — the uneven 60–100ms cascade at desktop.
results.push(
  await record("home-entrance", 1280, 800, {}, async (page) => {
    await page.goto(BASE);
    await page.waitForTimeout(2500); // the full cascade settles
    // Scroll once so the editions block (tour stop) is in frame.
    await page.locator('[data-testid="tour-stop-editions"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
  }),
);

// 2. Edition-card press — the 80ms glide press + 200ms pop-over release,
// held long enough to SEE, then the immediate navigation.
results.push(
  await record("edition-press", 1280, 800, {}, async (page) => {
    await page.goto(BASE);
    await page.waitForTimeout(2200);
    const btn = page
      .locator('[data-testid="tour-stop-editions"]')
      .getByRole("button", { name: "Choose a state" });
    await btn.scrollIntoViewIfNeeded();
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600); // hold the press: watch it land
    await page.mouse.up(); // mouse-up completes the click → navigation fires
    await page.waitForTimeout(500); // watch the pop-over release
    await page
      .getByRole("heading", { name: "State", exact: true })
      .waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
  }),
);

// 3. GeoDetective clue stagger — two wrong guesses, clues cascade in at
// 400ms + uneven 50–70ms index delays.
results.push(
  await record("clue-stagger", 390, 844, {}, async (page) => {
    await page.goto(`${BASE}?loop-puzzle=218`);
    await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
    await page.getByRole("heading", { name: "GeoDetective" }).waitFor({ timeout: 30000 });
    await page.getByRole("article", { name: /Clue 1: Geography/ }).waitFor({ timeout: 30000 });
    for (const q of ["paris", "tokyo"]) {
      const box = page.getByRole("combobox", { name: "Search the map" });
      await box.click();
      await box.fill(q);
      await page.getByRole("option").first().click();
      await page.getByRole("button", { name: "Guess this place" }).click();
      await page.waitForTimeout(1500); // watch the newly revealed clue rise
    }
    await page.waitForTimeout(1000);
  }),
);

// 4. Celebration pop — the app's one overshoot + child cascade.
results.push(
  await record("celebration-pop", 390, 844, { fullMapMode: true }, async (page) => {
    await page.goto(`${BASE}?celebration=session-milestone`);
    await page.getByTestId("celebration-overlay").waitFor({ timeout: 15000 });
    await page.waitForTimeout(2500); // card pop + 55/120/195ms cascade
  }),
);

// 5. Grandpa tasting tour (mobile) — compass pop, walk, kettle beat, settle.
// Fresh-visit tour auto-runs ≤10s; the recording covers it plus the settle.
results.push(
  await record("grandpa-tour-beats", 390, 844, {}, async (page) => {
    await page.goto(BASE);
    await page.waitForTimeout(14000);
  }),
);

// 6. Reduced-motion pass — OS setting on: zero animation, fully usable.
results.push(
  await record(
    "reduced-motion",
    390,
    844,
    { reducedMotion: "reduce" },
    async (page) => {
      await page.goto(BASE);
      await page.waitForTimeout(1200);
      await page.locator('[data-testid="tour-stop-editions"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await page
        .locator('[data-testid="tour-stop-editions"]')
        .getByRole("button", { name: "Choose a state" })
        .click();
      await page
        .getByRole("heading", { name: "State", exact: true })
        .waitFor({ timeout: 10000 });
      await page.waitForTimeout(800);
      // Celebration under reduced motion: no confetti, no pop, readable.
      await page.goto(`${BASE}?celebration=session-milestone`);
      await page.getByTestId("celebration-overlay").waitFor({ timeout: 15000 });
      await page.waitForTimeout(1500);
    },
  ),
);

await browser.close();
rmSync(RAW_DIR, { force: true, recursive: true });
const made = results.filter(Boolean);
console.log(`\nDone — ${made.length} clips in ${OUT_DIR}/`);
for (const m of made) console.log(" -", m);
