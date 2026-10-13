#!/usr/bin/env node
/**
 * perf-globe-easy.mjs — lab measurement of "Easy path on Globe" on a
 * throttled phone-class profile.
 *
 *   npm run build:pages
 *   node scripts/perf-globe-easy.mjs                 # 5 runs, median
 *   node scripts/perf-globe-easy.mjs --runs 3 --json
 *
 * What it does, per run (fresh browser context → cold HTTP cache, no
 * service worker, empty storage):
 *   1. serves dist/client over a REAL loopback HTTP server at
 *      http://127.0.0.1:4123/Meridian/ with gzip Content-Encoding (the e2e
 *      helper's `serveBuiltArtifact` fulfils responses from disk inside
 *      Playwright, which bypasses the network stack — CDP throttling would not
 *      apply to it, so it cannot be used for this measurement);
 *   2. attaches a CDP session and applies
 *        Emulation.setCPUThrottlingRate  rate 4
 *        Network.emulateNetworkConditions "Slow 4G"
 *          (latency 150 ms, down 1.6 Mbit/s, up 750 kbit/s — the DevTools /
 *           Lighthouse "Slow 4G" preset);
 *   3. loads the app, taps "Easy", taps "Play the globe", and waits for the
 *      first interactive question (see MILESTONES below);
 *   4. records transfer (CDP Network.loadingFinished encodedDataLength, i.e.
 *      bytes on the wire after compression) and samples the JS heap.
 *
 * MILESTONES (all ms from the navigation start, performance.now() clock of
 * the page, so they include the throttling):
 *   homeReady      the "Play the globe" button is visible and enabled.
 *   questionText   the aim-phase live region reads "Find <place>." AND the
 *                  persisted run phase is "aim" (the question is on screen).
 *   questionReady  questionText AND the MapLibre canvas is visible — the
 *                  child answers by tapping the map, so this is the first
 *                  question they can actually answer. HEADLINE number.
 *   Also reported: clickToQuestion = questionReady - the moment of the
 *   "Play the globe" tap (the cost of the Globe data + map start).
 *
 * Fidelity caveats — read before quoting numbers:
 *   - Lab only. The CPU throttle is a multiplier on this VM's CPU, not a
 *     real phone; it ranks changes, it does not predict a specific device.
 *   - Imagery tiles (server.arcgisonline.com) are stubbed with a 1x1 PNG, the
 *     same compensation tests/e2e/helpers.ts uses (the host is unreachable
 *     from the VM). Real tile traffic is therefore NOT in "bytes
 *     transferred"; only the app's own requests are.
 *   - JS heap peak is sampled every 50 ms with Runtime.getHeapUsage; it is a
 *     lower bound of the true peak (a short spike between samples is missed).
 *   - Service workers are blocked: this measures a first, cold visit.
 *
 * Env: PERF_CHROMIUM overrides the browser executable.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = resolve(process.env.PERF_DIST ?? join(REPO, "dist", "client"));
const PORT = 4123;
const BASE = "/Meridian/";
const ORIGIN = `http://127.0.0.1:${PORT}`;

const CPU_RATE = 4;
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((750 * 1024) / 8),
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".webmanifest"]);

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64",
);

function parseArgs(argv) {
  const args = { runs: 5, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--runs" && argv[i + 1]) args.runs = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
    else {
      console.error("usage: perf-globe-easy.mjs [--runs N] [--json]");
      process.exit(2);
    }
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error("--runs must be a positive integer");
  return args;
}

/** In-memory static server: gzip once per file, serve with Content-Encoding. */
function startServer() {
  const cache = new Map();
  const load = (file) => {
    let hit = cache.get(file);
    if (!hit) {
      const raw = readFileSync(file);
      const ext = extname(file).toLowerCase();
      hit = {
        type: MIME[ext] ?? "application/octet-stream",
        raw,
        gz: COMPRESSIBLE.has(ext) ? gzipSync(raw, { level: 6 }) : null,
      };
      cache.set(file, hit);
    }
    return hit;
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", ORIGIN);
    let p = decodeURIComponent(url.pathname);
    if (p === "/Meridian" || p === "/Meridian/") p = "/_shell.html";
    else if (p.startsWith(BASE)) p = p.slice(BASE.length);
    if (p.endsWith("/")) p += "_shell.html";
    const file = normalize(join(DIST, p));
    if (!file.startsWith(DIST + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    const { type, raw, gz } = load(file);
    const wantsGzip = gz && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
    const body = wantsGzip ? gz : raw;
    res.writeHead(200, {
      "content-type": type,
      "content-length": body.length,
      "cache-control": "no-store",
      ...(wantsGzip ? { "content-encoding": "gzip" } : {}),
      vary: "accept-encoding",
    });
    res.end(body);
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(PORT, "127.0.0.1", () => ok(server));
  });
}

function chromiumPath() {
  for (const p of [process.env.PERF_CHROMIUM, "/opt/meta-chromium/chrome", "/opt/pw-browsers/chromium"]) {
    if (p && existsSync(p)) return p;
  }
  return undefined; // let Playwright resolve its own
}

async function oneRun(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await context.route("https://server.arcgisonline.com/**", (route) =>
    route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);

  // Transfer accounting: only same-origin requests (tiles are stubbed).
  const reqs = new Map();
  cdp.on("Network.requestWillBeSent", (e) => {
    reqs.set(e.requestId, { url: e.request.url, type: e.type, encoded: 0 });
  });
  cdp.on("Network.responseReceived", (e) => {
    const r = reqs.get(e.requestId);
    if (r) {
      r.type = e.type;
      r.status = e.response.status;
    }
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.encoded = e.encodedDataLength;
  });

  let peakHeap = 0;
  let stopSampling = false;
  const sampler = (async () => {
    while (!stopSampling) {
      try {
        const { usedSize } = await cdp.send("Runtime.getHeapUsage");
        if (usedSize > peakHeap) peakHeap = usedSize;
      } catch {
        // page navigating — skip this sample
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  })();

  await page.addInitScript(() => {
    window.__tClick = null;
  });
  const t0 = Date.now();
  await page.goto(`${ORIGIN}${BASE}?idle-ms=3600000`, { waitUntil: "commit" });

  const playBtn = page.getByRole("button", { name: "Play the globe" });
  await playBtn.waitFor({ state: "visible", timeout: 120_000 });
  const homeReady = await page.evaluate(() => performance.now());

  const easy = page
    .getByRole("group", { name: "How do you want to grow your map today?" })
    .getByRole("button", { name: "Easy" });
  await easy.click();
  const tClick = await page.evaluate(() => {
    window.__tClick = performance.now();
    return window.__tClick;
  });
  await playBtn.click();

  const live = page.locator('p.sr-only[aria-live="polite"]');
  await live.filter({ hasText: /^Find .+\.$/ }).waitFor({ state: "attached", timeout: 180_000 });
  await page.waitForFunction(
    () => {
      const raw = sessionStorage.getItem("meridian.run");
      return raw ? JSON.parse(raw).phase === "aim" : false;
    },
    undefined,
    { timeout: 60_000 },
  );
  const questionTextReady = await page.evaluate(() => performance.now());
  // The child answers by tapping the map, so the question is only
  // interactive once the map canvas exists too.
  await page.locator(".maplibregl-canvas").first().waitFor({ state: "visible", timeout: 120_000 });
  const questionReady = await page.evaluate(() => performance.now());
  const choice = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.run");
    return raw ? JSON.parse(raw).difficultyChoice : null;
  });
  const wall = Date.now() - t0;

  // One last heap read at the interactive moment, then stop sampling.
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  if (usedSize > peakHeap) peakHeap = usedSize;
  stopSampling = true;
  await sampler;

  const finished = [...reqs.values()].filter((r) => r.encoded > 0 || r.status);
  const isJs = (r) => r.type === "Script" || /\.m?js(\?|$)/.test(r.url);
  const jsReqs = finished.filter(isJs);
  const out = {
    choice,
    homeReadyMs: Math.round(homeReady),
    clickToQuestionMs: Math.round(questionReady - tClick),
    questionTextMs: Math.round(questionTextReady),
    questionReadyMs: Math.round(questionReady),
    wallMs: wall,
    jsBytesTransferred: jsReqs.reduce((s, r) => s + r.encoded, 0),
    jsRequestCount: jsReqs.length,
    totalBytesTransferred: finished.reduce((s, r) => s + r.encoded, 0),
    peakJsHeapBytes: peakHeap,
    topJs: jsReqs
      .sort((a, b) => b.encoded - a.encoded)
      .map((r) => ({ url: r.url.replace(ORIGIN, ""), encoded: r.encoded })),
  };
  await context.close();
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const mb = (n) => `${(n / 1048576).toFixed(2)} MiB`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(DIST, "_shell.html"))) {
    console.error(`no build at ${DIST} — run \`npm run build:pages\` first`);
    process.exit(1);
  }
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ["--disable-dev-shm-usage"],
  });
  const version = browser.version();
  const runs = [];
  try {
    for (let i = 0; i < args.runs; i++) {
      const r = await oneRun(browser);
      runs.push(r);
      if (!args.json) {
        console.log(
          `run ${i + 1}/${args.runs}: interactive ${r.questionReadyMs} ms (question text ${r.questionTextMs} ms) ` +
            `(home ${r.homeReadyMs} ms, tap→interactive ${r.clickToQuestionMs} ms) · ` +
            `JS ${r.jsBytesTransferred.toLocaleString("en-US")} B in ${r.jsRequestCount} reqs · ` +
            `heap peak ${mb(r.peakJsHeapBytes)} · choice=${r.choice}`,
        );
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const keys = [
    "homeReadyMs",
    "clickToQuestionMs",
    "questionTextMs",
    "questionReadyMs",
    "jsBytesTransferred",
    "totalBytesTransferred",
    "peakJsHeapBytes",
  ];
  const med = Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))]));
  const summary = {
    scenario: "Easy path on Globe, cold load",
    profile: { cpuThrottleRate: CPU_RATE, network: "Slow 4G", ...SLOW_4G, viewport: "390x844" },
    browser: `Chromium ${version}`,
    runs: args.runs,
    median: med,
    perRun: runs,
  };
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(`\nMedian of ${args.runs} (Chromium ${version}, 4x CPU, Slow 4G)`);
  console.log(`  home ready (Play button usable):  ${med.homeReadyMs} ms`);
  console.log(`  tap Play → interactive question: ${med.clickToQuestionMs} ms`);
  console.log(`  question text on screen:          ${med.questionTextMs} ms`);
  console.log(`  first interactive question:       ${med.questionReadyMs} ms (text + map canvas)`);
  console.log(`  JS bytes transferred (gzip wire): ${med.jsBytesTransferred.toLocaleString("en-US")}`);
  console.log(`  all bytes transferred:            ${med.totalBytesTransferred.toLocaleString("en-US")}`);
  console.log(`  peak JS heap (sampled 50 ms):     ${mb(med.peakJsHeapBytes)}`);
  console.log("\nJS requests in run 1 (bytes on the wire):");
  for (const r of runs[0].topJs) console.log(`  ${String(r.encoded.toLocaleString("en-US")).padStart(10)}  ${r.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
