// Render scene.html frame by frame into PNGs (deterministic: each frame
// is window.film.render(t), not wall-clock playback).
//
//   python3 -m http.server 8123            # from the repo root, other terminal
//   node scripts/why-learn-film/capture.mjs [band] [outDir] [--stills]
//
// band: 7-10 | 10-18 | 18+ (default 10-18). --stills writes only the
// poster (t=0) and the still (t=4); --at=1.5,2.5 writes chosen times. Uses the repo's playwright; set
// CHROME_PATH to point at a local Chrome/Chromium if playwright's own
// browser isn't installed. Chrome needs WebGL (headless uses SwiftShader).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const stills = args.includes("--stills");
const [band = "10-18", out = `film-frames-${band.replace("+", "plus")}`] = args.filter((a) => !a.startsWith("--"));
const base = process.env.SCENE_URL ?? "http://localhost:8123/scripts/why-learn-film/scene.html";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1094, height: 616 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.error("page:", m.text()); });
await page.goto(`${base}?capture=1&band=${encodeURIComponent(band)}`);
await page.evaluate(() => window.film.ready);
const canvas = page.locator("#film");

const at = args.find((a) => a.startsWith("--at="));
const times = stills ? [["poster", 0], ["still", 4]] : at ? at.slice(5).split(",").map((t) => [`t-${t}`, Number(t)]) : null;
if (times) {
  for (const [name, t] of times) {
    await page.evaluate((t) => window.film.render(t), t);
    await canvas.screenshot({ path: join(out, `${name}.png`) });
  }
} else {
  const { duration, fps } = await page.evaluate(() => ({ duration: window.film.duration, fps: window.film.fps }));
  const n = Math.round(duration * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.film.render(t), i / fps);
    await canvas.screenshot({ path: join(out, `f${String(i).padStart(4, "0")}.png`) });
  }
}
await browser.close();
console.log(`wrote ${times ? times.length : "all"} frame(s) to ${out}`);
