import { chromium } from "/workspace/nav-home-fix/node_modules/playwright/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:8091/";
const out = [];
const browser = await chromium.launch({ channel: "chrome", args: ["--disable-dev-shm-usage"] });
const screens = [
  ["home", null],
  ["geodetective", (p) => p.getByRole("button", { name: /^GeoDetective:/ }).click()],
  ["coldtrail", (p) => p.getByRole("button", { name: /^Cold Trail:/ }).click()],
  ["whylearn", (p) => p.getByRole("button", { name: /^Why Do We Learn This\?/ }).click()],
  ["country-list", (p) => p.locator("#home-editions").getByRole("button", { name: /Country/ }).first().click()],
  ["credits", "credits"],
  ["privacy", "privacy"],
];
for (const [w,h] of [[390,844],[1280,800]]) for (const [name, act] of screens) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + (typeof act === "string" ? act : ""), { waitUntil: "networkidle", timeout: 90000 }).catch(()=>{});
    await page.waitForTimeout(2000);
    if (typeof act === "function") { await act(page); await page.waitForTimeout(5000); }
    const d = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const cs = getComputedStyle(main), bs = getComputedStyle(document.body);
      const mb = main.getBoundingClientRect();
      const h1 = main.querySelector("h1"); const h1cs = h1 && getComputedStyle(h1);
      const btns = [...main.querySelectorAll("button, a")].filter(b => /home|back|edition|all games|exit|leave/i.test((b.textContent||"") + (b.getAttribute("aria-label")||""))).slice(0,6).map(b => { const r = b.getBoundingClientRect(); const c = getComputedStyle(b); return { text: b.textContent.trim().replace(/\s+/g," ").slice(0,40), aria: b.getAttribute("aria-label"), x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), bg: c.backgroundColor, border: c.borderTopWidth + " " + c.borderTopColor, radius: c.borderTopLeftRadius, font: c.fontSize + " " + c.fontFamily.split(",")[0] }; });
      const eyebrow = h1 ? h1.previousElementSibling : null;
      return { mainCls: main.className.slice(0,140), mainMaxW: cs.maxWidth, mainW: Math.round(mb.width), mainBg: cs.backgroundColor, mainBgImg: cs.backgroundImage.slice(0,80), bodyBg: bs.backgroundColor, bodyBgImg: bs.backgroundImage.slice(0,80), h1: h1 ? { text: h1.textContent.trim().slice(0,40), font: h1cs.fontSize + " " + h1cs.fontFamily.split(",")[0], cls: h1.className.slice(0,60) } : null, eyebrow: eyebrow ? eyebrow.textContent.trim().slice(0,50) : null, docH: document.documentElement.scrollHeight, back: btns };
    });
    await page.screenshot({ path: `/workspace/nav-home-shots/screen-${name}-${w}x${h}.png`, fullPage: name !== "home" });
    out.push({ name, w, h, ...d });
  } catch (e) { out.push({ name, w, h, error: String(e).slice(0,200) }); }
  await ctx.close();
}
fs.writeFileSync("/workspace/nav-home-shots/screens.json", JSON.stringify(out, null, 1));
await browser.close(); console.log("done");
