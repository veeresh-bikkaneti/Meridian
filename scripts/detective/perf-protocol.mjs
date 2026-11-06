#!/usr/bin/env node
/**
 * perf-protocol.mjs — the K4 performance protocol for the Holmes &
 * Watson waypoint companion (U10, BUILD-SCOPE §5 / council K4).
 *
 * WHAT THIS IS — stated honestly, in the output as well: a THROTTLED
 * HEADLESS Chromium run. CPU is throttled 4× over CDP, the viewport is
 * 360×640 at DPR 2.6 — a Moto G Power-class PROXY, not a physical
 * device. Numbers here can fail the companion on this proxy; they
 * cannot certify it on real hardware. Battery is NOT MEASURED in
 * headless and is reported as such, never as a pass.
 *
 * The session: flag ON (intercepted flags.json), case 137 via the
 * seam, ~10 minutes of scripted play — the clue ladder (two guesses)
 * plus repeated pan / pause / berth cycles — while an in-page sampler
 * records rAF frame deltas, long tasks, and heap. Threshold rows
 * (council K4):
 *   median FPS ≥ 58 during pan+companion windows
 *   p95 frame time ≤ 18 ms (same windows)
 *   zero >50 ms long tasks attributable to companion code
 *   heap growth < 10 MB over the session
 *   no rAF activity with a still pointer for 60 s
 *   battery delta — NOT MEASURED (headless)
 *
 * Long-task attribution: headless Chromium's longtask entries carry
 * no reliable JS attribution, so "attributable to companion code" is
 * assessed as entries that START inside a companion-active window
 * (berth walk / berthed / pan-with-companion) — and the raw total is
 * reported beside it, with the attribution caveat printed.
 *
 * Usage: node scripts/detective/perf-protocol.mjs [--minutes=10]
 * Requires a prior `npm run build:pages` (serves dist/client) and a
 * Chromium: PLAYWRIGHT_CHROMIUM_EXECUTABLE or the VM's cached build.
 */

import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MINUTES = Number(
  (process.argv.find((a) => a.startsWith("--minutes=")) ?? "--minutes=10").split("=")[1],
);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.join(ROOT, "dist/client");
const BASE = "http://127.0.0.1:4123/Meridian/";
const EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 2.6,
    hasTouch: true,
    isMobile: true,
  });
  // Capable-device spoof (same signals as tests/e2e/helpers.ts): the
  // VM's SwiftShader renderer would otherwise read as a weak device.
  await context.addInitScript(() => {
    const NVIDIA =
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)";
    const R = 0x9246;
    const V = 0x9245;
    const proto = HTMLCanvasElement.prototype;
    const origGetContext = proto.getContext;
    proto.getContext = function (type, opts) {
      const ctx = origGetContext.call(this, type, opts);
      if (ctx && (type === "webgl" || type === "webgl2")) {
        const origGetExtension = ctx.getExtension.bind(ctx);
        const origGetParameter = ctx.getParameter.bind(ctx);
        ctx.getExtension = (name) =>
          name === "WEBGL_debug_renderer_info"
            ? { UNMASKED_RENDERER_WEBGL: R, UNMASKED_VENDOR_WEBGL: V }
            : origGetExtension(name);
        ctx.getParameter = (p) =>
          p === R ? NVIDIA : p === V ? "Google Inc. (NVIDIA)" : origGetParameter(p);
      }
      return ctx;
    };
    Object.defineProperty(Navigator.prototype, "deviceMemory", {
      get: () => 8,
      configurable: true,
    });
    // Speech speed-up + freeze watchdog: same harness compensations as
    // the E2E gates (detached Audio elements tracked via play()).
    const w = window;
    w.__perfPlays = [];
    const audios = [];
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      w.__perfPlays.push(this.currentSrc || this.src || "");
      if (!audios.includes(this)) audios.push(this);
      try {
        this.playbackRate = 4;
      } catch { /* speed-up only */ }
      return origPlay.call(this);
    };
    const seen = new WeakMap();
    setInterval(() => {
      for (const el of audios) {
        const src = el.currentSrc || el.src || "";
        if (!src.includes("/audio/detective/") || el.paused || el.ended) continue;
        const prev = seen.get(el);
        if (!prev || prev.ct !== el.currentTime) {
          seen.set(el, { ct: el.currentTime, stallMs: 0 });
          continue;
        }
        prev.stallMs += 400;
        if (prev.stallMs > 2400) {
          if (Number.isFinite(el.duration) && el.duration > 0) {
            try {
              el.currentTime = Math.max(0, el.duration - 0.02);
            } catch { /* fall through */ }
          }
          if (!Number.isFinite(el.duration) || el.duration <= 0) {
            try {
              el.dispatchEvent(new Event("ended"));
            } catch { /* leave it */ }
          }
          seen.delete(el);
        }
      }
    }, 400);
    // Samplers: rAF frame deltas (timestamped), long tasks, and a
    // companion-activity flag the protocol sets around its cycles.
    w.__perf = { frames: [], longTasks: [], companionActive: false, rafCallbacks: 0 };
    let last = performance.now();
    const tick = (now) => {
      w.__perf.rafCallbacks += 1;
      w.__perf.frames.push({ t: now, dt: now - last, active: w.__perf.companionActive });
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          w.__perf.longTasks.push({
            start: e.startTime,
            duration: e.duration,
            active: w.__perf.companionActive,
          });
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch { /* longtask unsupported — reported as unmeasured */ }
  });
  // Serve the built artifact from disk (the helpers.ts model).
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "server.arcgisonline.com") {
      return route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      if (url.pathname.endsWith("/ingest") || url.hostname.includes("crash")) {
        return route.fulfill({ status: 204, body: "" });
      }
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
      return route.fulfill({
        status: 200,
        body,
        contentType: MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
  // Flag ON by interception (registered after the artifact route).
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair: true,
        },
      }),
    });
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const phase = () =>
    page.evaluate(() => {
      const el =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      return el?.getAttribute("data-phase") ?? null;
    });
  const placement = () =>
    page.evaluate(() => {
      const el =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      return el?.getAttribute("data-holmes-placement") ?? null;
    });
  async function waitFor(cond, timeoutMs, label) {
    const t0 = Date.now();
    for (;;) {
      if (await cond()) return;
      if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label}`);
      await sleep(200);
    }
  }
  const setActive = (on) =>
    page.evaluate((v) => {
      window.__perf.companionActive = v;
    }, on);
  const heap = () =>
    page.evaluate(() =>
      performance.memory ? performance.memory.usedJSHeapSize : null,
    );

  console.log(`[perf] protocol start ${startedAt} — throttled headless Chromium, CPU 4×, 360×640 @ DPR 2.6 (Moto G Power-class PROXY, not a physical device)`);
  await page.goto(`${BASE}?loop-puzzle=137`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await page.getByRole("heading", { name: "GeoDetective" }).waitFor({ timeout: 30_000 });
  // Verified first gesture (same race the E2E harness documents): the
  // player's gesture listener arms only after its audio-manifest
  // fetch resolves, and under 4× CPU throttling that fetch is slow —
  // a single early click is missed and the speech queue waits
  // forever. Tap the heading until a detective clip actually plays.
  await page.getByTestId("detective-station").waitFor({ timeout: 30_000 });
  for (let tap = 0; tap < 12; tap++) {
    await page.getByRole("heading", { name: "GeoDetective" }).click();
    await sleep(700);
    const played = await page.evaluate(() =>
      (window.__perfPlays ?? []).some((s) => s.includes("/audio/detective/")),
    );
    if (played) break;
    if (tap === 11) throw new Error("first gesture never unlocked speech (no detective play observed)");
  }
  await waitFor(async () => (await phase()) === "SEARCH_IDLE", 180_000, "SEARCH_IDLE (clue 1 ladder)");
  const heapStart = await heap();
  console.log(`[perf] clue 1 ladder done; heap start = ${heapStart}`);

  const sessionEnd = Date.now() + MINUTES * 60_000;
  let cycles = 0;
  let guesses = 0;
  // Scripted session: alternate companion cycles (pan + pause/berth)
  // with ladder progress (a miss, then keep cycling). The final 60 s
  // are reserved for the still-pointer idle measurement.
  while (Date.now() < sessionEnd - 75_000) {
    const map = page.getByTestId("loop-map");
    await map.scrollIntoViewIfNeeded();
    const box = await map.boundingBox();
    if (!box) throw new Error("map has no box");
    const px = box.x + box.width * 0.5;
    const py = box.y + box.height * 0.45;
    await setActive(true);
    // Pan: drag the map.
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 120, py + 60, { steps: 10 });
    await page.mouse.up();
    await sleep(600);
    // Pause: hover still until he berths (or the window expires).
    await page.mouse.move(px, py, { steps: 6 });
    await page.mouse.move(px + 2, py + 1, { steps: 2 });
    try {
      await waitFor(async () => (await placement()) === "berth", 6_000, "berth");
    } catch { /* remote/hide cycles are part of the session too */ }
    await sleep(1200);
    await setActive(false);
    cycles += 1;
    // Every third cycle, spend a guess to climb the clue ladder.
    if (cycles % 3 === 0 && guesses < 2 && (await phase()) === "SEARCH_IDLE") {
      const names = ["las vegas", "paris"];
      const q = names[guesses];
      const search = page.getByRole("combobox", { name: "Search the map" });
      await search.click();
      await search.fill(q);
      const option = page.getByRole("option").first();
      await option.waitFor({ timeout: 30_000 });
      await option.click();
      await page.getByRole("dialog").waitFor({ timeout: 15_000 });
      await page.getByRole("button", { name: "Guess this place" }).click();
      guesses += 1;
      await waitFor(async () => (await phase()) === "SEARCH_IDLE", 180_000, "SEARCH_IDLE (next clue)");
    }
  }

  // Idle window: still pointer, 60 s — count rAF callbacks.
  const rafBefore = await page.evaluate(() => window.__perf.rafCallbacks);
  const idleStart = Date.now();
  while (Date.now() - idleStart < 60_000 && Date.now() < sessionEnd + 60_000) {
    await sleep(1000);
  }
  const rafAfter = await page.evaluate(() => window.__perf.rafCallbacks);
  const heapEnd = await heap();

  const perf = await page.evaluate(() => window.__perf);
  await browser.close();

  const activeFrames = perf.frames.filter((f) => f.active && f.dt > 0 && f.dt < 1000);
  const dts = activeFrames.map((f) => f.dt).sort((a, b) => a - b);
  const medianDt = dts.length ? dts[Math.floor(dts.length / 2)] : null;
  const p95Dt = dts.length ? dts[Math.floor(dts.length * 0.95)] : null;
  const medianFps = medianDt ? 1000 / medianDt : null;
  const longOver50 = perf.longTasks.filter((t) => t.duration > 50);
  const longActive = longOver50.filter((t) => t.active);
  const heapGrowthMB =
    heapStart !== null && heapEnd !== null ? (heapEnd - heapStart) / 1_048_576 : null;
  const idleRaf = rafAfter - rafBefore;

  const rows = [
    {
      gate: "median FPS during pan+companion",
      threshold: "≥ 58",
      measured: medianFps === null ? "no active frames" : medianFps.toFixed(1),
      verdict: medianFps !== null && medianFps >= 58 ? "PASS" : "FAIL",
    },
    {
      gate: "p95 frame time during pan+companion",
      threshold: "≤ 18 ms",
      measured: p95Dt === null ? "no active frames" : `${p95Dt.toFixed(1)} ms`,
      verdict: p95Dt !== null && p95Dt <= 18 ? "PASS" : "FAIL",
    },
    {
      gate: "long tasks >50 ms in companion windows",
      threshold: "0",
      measured: `${longActive.length} in companion windows (${longOver50.length} total >50 ms in session; attribution = window overlap, headless longtask carries no JS attribution)`,
      verdict: longActive.length === 0 ? "PASS" : "FAIL",
    },
    {
      gate: "heap growth over the session",
      threshold: "< 10 MB",
      measured: heapGrowthMB === null ? "performance.memory unavailable" : `${heapGrowthMB.toFixed(2)} MB`,
      verdict: heapGrowthMB !== null && heapGrowthMB < 10 ? "PASS" : "FAIL",
    },
    {
      gate: "rAF activity with a still pointer (60 s)",
      threshold: "0 callbacks",
      measured: `${idleRaf} rAF callbacks in the idle window (the sampler's own rAF loop accounts for ~1/frame of these — see note)`,
      verdict: "MEASURED — see note",
    },
    {
      gate: "battery delta vs companion-off",
      threshold: "≤ 10%",
      measured: "NOT MEASURED — headless Chromium exposes no battery drain",
      verdict: "NOT MEASURED",
    },
  ];

  console.log("\n=== K4 PERF PROTOCOL — RESULTS ===");
  console.log("Environment: throttled headless Chromium (CDP CPU throttle 4×), viewport 360×640, DPR 2.6 — a Moto G Power-class PROXY, not a physical device.");
  console.log(`Session: ${MINUTES} min scripted, case 137, flag ON; companion cycles=${cycles}, guesses=${guesses}, active frames sampled=${activeFrames.length}, total frames=${perf.frames.length}`);
  console.log(
    "Idle-rAF note: the in-page sampler itself runs a rAF loop (that is how frames are measured), so the idle count includes the sampler's own callbacks plus the host auto-kill tracker's SEARCH-phase rAF feed and any MapLibre activity; the count is reported raw, and the row is marked MEASURED rather than passed/failed on a number the harness itself inflates.",
  );
  for (const r of rows) {
    console.log(`| ${r.gate} | threshold ${r.threshold} | measured ${r.measured} | ${r.verdict} |`);
  }
  console.log(JSON.stringify({ startedAt, minutes: MINUTES, cycles, guesses, rows, medianFps, p95Dt, heapGrowthMB, idleRaf }, null, 2));
}

main().catch((err) => {
  console.error(`[perf] protocol FAILED to run: ${err.message}`);
  process.exit(1);
});
