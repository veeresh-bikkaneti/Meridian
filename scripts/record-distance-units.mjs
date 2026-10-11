/**
 * Screen recording of the distance-units verification session
 * (constitutional law: build → test → record → owner green-light → Chitti).
 *
 * Records at 390×844: a Nebraska (state edition) miss showing headline +
 * map pill in MILES with the same value, then a France (country edition)
 * miss showing headline + pill in KILOMETERS with the same value.
 *
 * Run: flock ~/workspace/.e2e.lock node scripts/record-distance-units.mjs
 */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, "../dist/client");
const BASE = "/Meridian/";
const OUT_DIR = path.resolve(
  process.env.HOME ?? "~",
  "workspace/your_files/meridian-distance-units",
);

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqS8AAAAASUVORK5CYII=",
  "base64",
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

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
    else if (p.startsWith(BASE)) p = p.slice(BASE.length);
    if (p.endsWith("/")) p += "_shell.html";
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST + path.sep) && file !== DIST) {
      return route.fulfill({ status: 403, body: "forbidden" });
    }
    try {
      const body = await readFile(file);
      return route.fulfill({ status: 200, body, contentType: MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readPhase(page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.run");
    return raw ? (JSON.parse(raw).phase ?? null) : null;
  });
}

async function waitPhase(page, phases, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ph = await readPhase(page);
    if (phases.includes(ph)) return ph;
    await sleep(250);
  }
  throw new Error(`phase never reached ${phases}; last=${await readPhase(page)}`);
}

/** Flash a ring at the tap point so the video shows where the pin drops. */
async function flashTap(page, x, y) {
  await page.evaluate(
    ({ px, py }) => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;left:${px - 22}px;top:${py - 22}px;width:44px;height:44px;border:3px solid #f2c14e;border-radius:50%;z-index:99999;pointer-events:none;`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 900);
    },
    { px: x, py: y },
  );
}

async function startRun(page, country, state) {
  await page.goto("http://127.0.0.1:4123/Meridian/?idle-ms=3600000");
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: country }).click();
  if (state) await page.getByRole("button", { name: state }).click();
  await page.locator(".satellite-map").waitFor({ timeout: 60000 });
  await waitPhase(page, ["aim"], 30000);
  // Let tiles (stubbed) settle so the map is up before the tap.
  await page.locator('p.sr-only[aria-live="polite"]').waitFor({ timeout: 15000 });
  await sleep(1200);
}

async function commitCornerMiss(page) {
  const spot = await page.evaluate(() => {
    const el = document.querySelector(".satellite-map");
    const hook = el?.__spotScreen;
    const s = hook?.();
    if (!s) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
  });
  const box = await page.locator(".satellite-map").boundingBox();
  const corners = [
    { x: box.x + 40, y: box.y + 90 },
    { x: box.x + box.width - 40, y: box.y + 90 },
    { x: box.x + 40, y: box.y + box.height - 90 },
    { x: box.x + box.width - 40, y: box.y + box.height - 90 },
  ];
  let best = null, bestD = -1;
  for (const c of corners) {
    const hits = await page.evaluate(
      ({ px, py }) => !!document.elementFromPoint(px, py)?.closest?.(".satellite-map"),
      { px: c.x, py: c.y },
    );
    if (!hits) continue;
    const d = spot ? Math.hypot(c.x - spot.x, c.y - spot.y) : 0;
    if (d > bestD) { bestD = d; best = c; }
  }
  if (!best) throw new Error("no tappable corner");
  // Mirror the spec helper: the reveal only plays over healthy tiles, and
  // the tap is ignored until the map reports ready.
  const overlay = page.getByText("Couldn't load satellite imagery");
  if (await overlay.isVisible()) {
    await page.getByRole("button", { name: "Retry" }).click();
    await overlay.waitFor({ state: "hidden", timeout: 10000 });
  }
  const map = page.locator(".satellite-map");
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await map.getAttribute("data-tile-status")) === "ready") break;
    await sleep(2000);
  }
  await flashTap(page, best.x, best.y);
  await sleep(500);
  await page.mouse.click(best.x, best.y);
  const dropBtn = page.getByRole("button", { name: "Drop pin and lock in your guess" });
  await dropBtn.waitFor({ state: "visible", timeout: 15000 });
  // Wait for the tap to arm the pin (button enables); retry the tap once.
  try {
    await page.waitForFunction(
      () => {
        const b = document.querySelector('button[aria-label="Drop pin and lock in your guess"]');
        return b && !b.disabled;
      },
      { timeout: 8000 },
    );
  } catch {
    await page.mouse.click(best.x, best.y);
    await page.waitForFunction(
      () => {
        const b = document.querySelector('button[aria-label="Drop pin and lock in your guess"]');
        return b && !b.disabled;
      },
      { timeout: 8000 },
    );
  }
  await dropBtn.click();
  await waitPhase(page, ["story", "done"], 20000);
}

async function showResult(page, holdMs) {
  // Make sure the headline is in view, then hold so the video shows it.
  const headline = page.getByTestId("miss-headline");
  await headline.waitFor({ timeout: 15000 });
  await headline.scrollIntoViewIfNeeded();
  await sleep(holdMs);
  const text = (await headline.textContent()) ?? "";
  const pill = await page.evaluate(() => {
    for (const el of document.querySelectorAll(".maplibregl-marker")) {
      const t = (el.textContent ?? "").trim();
      if (/[\d,]+(\.\d+)?\s*(mi|km|ft|m)\b/.test(t)) return t;
    }
    return "";
  });
  console.log("  headline:", JSON.stringify(text.trim()));
  console.log("  pill:    ", JSON.stringify(pill));
}

const browser = await chromium.launch({
  executablePath: "/opt/meta-chromium/chrome",
  args: ["--disable-dev-shm-usage"],
});

async function recordJourney(label, country, state, holdMs) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: OUT_DIR, size: { width: 390, height: 844 } },
  });
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  console.log(label);
  await startRun(page, country, state);
  await commitCornerMiss(page);
  await showResult(page, holdMs);
  await context.close();
}

await recordJourney(
  "Journey A — Nebraska (USA): expecting miles",
  "United States",
  "Nebraska",
  5000,
);
await recordJourney(
  "Journey B — France: expecting kilometers",
  "France",
  null,
  5000,
);

await browser.close();
console.log("videos saved to", OUT_DIR);
