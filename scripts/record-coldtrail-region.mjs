/**
 * Screen-recording driver for the Cold Trail region-context black-box journey.
 *
 * Constitutional law: every visual/black-box/E2E run produces a screen
 * recording of the actual test session on the built app. This script drives
 * the built Pages artifact (dist/, served from disk at 127.0.0.1:4123/Meridian/)
 * at 390×844 with video capture on:
 *
 *   1. Open Cold Trail → 3 sighting cards, each showing its 🌍 Region line.
 *   2. Place + lock 3 rings (tap map → "Yes, keep it").
 *   3. Tap the map for the interception guess → confirm → score reveal.
 *
 * Run: node scripts/record-coldtrail-region.mjs
 * Output: /tmp/coldtrail-region-recording/ (video .webm + screenshots)
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);
const DIST = join(ROOT, "dist", "client");
const BASE = "http://127.0.0.1:4123/Meridian/";
const OUT_DIR = "/tmp/coldtrail-region-recording";

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function serveBuiltArtifact(context) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "server.arcgisonline.com") {
      return route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return route.continue();
    }
    let p = decodeURIComponent(url.pathname);
    if (p === "/Meridian" || p === "/Meridian/") p = "/_shell.html";
    else if (p.startsWith("/Meridian/")) p = p.slice("/Meridian/".length);
    if (p.endsWith("/")) p += "_shell.html";
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST + path.sep) && file !== DIST) {
      return route.fulfill({ status: 403, body: "forbidden" });
    }
    try {
      const body = await readFile(file);
      const ct = file.endsWith(".html")
        ? "text/html"
        : file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".json")
              ? "application/json"
              : "application/octet-stream";
      return route.fulfill({ status: 200, body, contentType: ct });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
}

async function mapTap(page, tap) {
  // Bounding-box mouse tap: bypasses Playwright's actionability/scroll
  // machinery, which can hang on the live map canvas. Coordinates match the
  // spec's element-relative positions.
  const box = await page.getByTestId("loop-map").boundingBox();
  if (!box) throw new Error("loop-map has no bounding box");
  await page.mouse.click(box.x + tap.x, box.y + tap.y);
}

async function placeAndLockRing(page, tap) {
  await page.getByTestId("place-ring-btn").first().click();
  await mapTap(page, tap);
  await page.getByTestId("confirm-ring-btn").click();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: OUT_DIR, size: { width: 390, height: 844 } },
  });
  await serveBuiltArtifact(context);
  const page = await context.newPage();

  // 1. Open Cold Trail; hold on the sightings so the Region lines are readable.
  await page.goto(BASE);
  await page.getByRole("button", { name: "❄️ Start the trail" }).click();
  await page.getByTestId("sighting-card").first().waitFor({ timeout: 30_000 });
  await page.getByTestId("loop-map").waitFor({ state: "visible", timeout: 30_000 });
  const regions = await page.getByTestId("sighting-region").allTextContents();
  console.log("region lines:", JSON.stringify(regions));
  await page.waitForTimeout(2500);

  // 2. Place + lock 3 rings, clustered for genuine triple-overlap.
  await placeAndLockRing(page, { x: 300, y: 250 });
  await page.waitForTimeout(600);
  await placeAndLockRing(page, { x: 315, y: 240 });
  await page.waitForTimeout(600);
  await placeAndLockRing(page, { x: 285, y: 265 });
  await page.waitForTimeout(1500);
  console.log(
    "after 3 locks: place-ring-btns =",
    await page.getByTestId("place-ring-btn").count(),
    "| hint =",
    JSON.stringify(await page.getByTestId("map-hint").textContent()),
  );

  // 3. Interception tap → confirm → score reveal.
  await mapTap(page, { x: 200, y: 200 });
  await page.waitForTimeout(2000);
  console.log(
    "intercept-confirm count:",
    await page.getByTestId("intercept-confirm").count(),
  );
  await page.screenshot({ path: join(OUT_DIR, "pre-intercept.png") });
  await page.getByTestId("intercept-confirm-btn").click();
  await page.getByTestId("coldtrail-reveal").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT_DIR, "reveal.png") });

  await context.close();
  await browser.close();
  console.log("recording saved to", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
