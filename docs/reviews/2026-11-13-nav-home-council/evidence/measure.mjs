import { chromium } from "/workspace/nav-home-fix/node_modules/playwright/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:8091/";
const VPS = [[320,568],[375,667],[390,844],[768,1024],[1024,768],[1280,800]];
const out = [];
const browser = await chromium.launch({ channel: "chrome", args: ["--disable-dev-shm-usage"] });
for (const q of ["", "?scale=1"]) for (const [w,h] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + q, { waitUntil: "networkidle", timeout: 90000 }).catch(()=>{});
  await page.waitForSelector(".hv5-grid2", { timeout: 60000 });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const grids = {};
    for (const sel of [".hv5-grid2", ".hv5-grid3"]) {
      const g = document.querySelector(sel); if (!g) continue;
      const cs = getComputedStyle(g);
      const cols = cs.gridTemplateColumns.split(" ").length;
      const items = [...g.children].map((c) => {
        const pic = c.querySelector(".hv5-pic, .hv5-art");
        return { id: c.getAttribute("data-testid") || c.getAttribute("aria-labelledby") || c.tagName + (c.getAttribute("aria-hidden") ? "[aria-hidden placeholder]" : ""), cls: c.className, ...r(c), pic: pic ? { cls: pic.className, ...r(pic) } : null };
      });
      grids[sel] = { cols, tmpl: cs.gridTemplateColumns, gridW: Math.round(g.getBoundingClientRect().width), items };
    }
    return { grids, docW: document.documentElement.scrollWidth, globe: !!document.querySelector(".hv5-globe-zone canvas") };
  });
  const name = `home${q ? "-scale" : ""}-${w}x${h}.png`;
  await page.screenshot({ path: `/workspace/nav-home-shots/${name}`, fullPage: true });
  out.push({ q, w, h, shot: name, ...data });
  await ctx.close();
}
fs.writeFileSync("/workspace/nav-home-shots/home-measure.json", JSON.stringify(out, null, 1));
await browser.close();
console.log("done", out.length);
