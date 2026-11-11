/**
 * render-rig-sheet.mjs — U4 evidence sheet for the Holmes & Watson rigs.
 *
 * Renders EVERY pose of both production rigs (src/game/loop/detective/
 * DetectivePair.tsx) into one HTML sheet on a real satellite-tile
 * backdrop — a crop of the approved mockup's real-page frame grab
 * (~/workspace/meridian-detective-evidence/loop-frame-search.png) — then
 * screenshots it with Playwright:
 *   - rig-sheet-u4.png      desktop-width sheet, all 21 poses + a
 *                           high-five pair aligned on HIGH_FIVE_CONTACT
 *   - rig-sheet-u4-390.png  390 px strip of the key poses (read, search,
 *                           berth-think, high-five, pout) at game scale
 * Output goes to ~/workspace/meridian-detective-evidence/.
 *
 * Run:  node scripts/detective/render-rig-sheet.mjs
 * Env:  PLAYWRIGHT_CHROMIUM_EXECUTABLE overrides the chromium binary.
 */
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVIDENCE = join(homedir(), "workspace", "meridian-detective-evidence");

/* .tsx transpile hook — same pattern as the src unit tests. */
const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.tsx')) {",
  "    const { readFileSync } = await import('node:fs');",
  "    const ts = await import(TS_URL);",
  "    const out = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");
register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const { HolmesRig, WatsonRig, HOLMES_POSES, WATSON_POSES, HIGH_FIVE_CONTACT } =
  await import("../../src/game/loop/detective/DetectivePair.tsx");

const rigCss = readFileSync(join(REPO_ROOT, "src/game/loop/detective/detective.css"), "utf8");

/* Satellite backdrop: crop a tile-only desert area out of the approved
 * frame grab — inside the map, away from both characters, labels,
 * the clue card and the attribution bar. */
const backdropBuf = await sharp(join(EVIDENCE, "loop-frame-search.png"))
  .extract({ left: 195, top: 855, width: 270, height: 125 })
  .jpeg({ quality: 82 })
  .toBuffer();
const backdrop = `data:image/jpeg;base64,${backdropBuf.toString("base64")}`;

/* Display sizes: Holmes 148 px tall; Watson 111 px — exactly 75%. */
const H_W = 100; // Holmes display width  -> height 148.3
const W_W = 106; // Watson display width  -> height 110.8
const holmes = (pose, facing = "right", speaking = false) =>
  `<div class="rig rig-h" style="width:${H_W}px">${renderToString(createElement(HolmesRig, { pose, facing, speaking }))}</div>`;
const watson = (pose, facing = "right", speaking = false) =>
  `<div class="rig rig-w" style="width:${W_W}px">${renderToString(createElement(WatsonRig, { pose, facing, speaking }))}</div>`;

/* High-five pair: align the exported contact points. Holmes faces
 * right (contact at internal x=99 of 120), Watson faces left — his base
 * art, unflipped — with contact at internal x=15 of 134. Both hands
 * must land on the same page point. */
function highFivePair(scale = 1) {
  const hW = H_W * scale;
  const wW = W_W * scale;
  const hScale = hW / 120;
  const wScale = wW / 134;
  const contactX = 150 * scale; // page x of the joined hands
  const contactY = 26 * scale; // page y of the joined hands
  const hLeft = contactX - HIGH_FIVE_CONTACT.holmes.x * hScale;
  const hTop = contactY - HIGH_FIVE_CONTACT.holmes.y * hScale;
  const wLeft = contactX - HIGH_FIVE_CONTACT.watson.x * wScale;
  const wTop = contactY - HIGH_FIVE_CONTACT.watson.y * wScale;
  return `<div class="pair" style="width:${320 * scale}px;height:${190 * scale}px">
    <div class="rig abs" style="left:${hLeft}px;top:${hTop}px;width:${hW}px">${renderToString(createElement(HolmesRig, { pose: "high-five", facing: "right" }))}</div>
    <div class="rig abs" style="left:${wLeft}px;top:${wTop}px;width:${wW}px">${renderToString(createElement(WatsonRig, { pose: "high-five", facing: "left" }))}</div>
    <div class="spark" style="left:${contactX}px;top:${contactY}px">✦</div>
  </div>`;
}

const cell = (label, inner) => `<figure class="cell"><div class="stage">${inner}</div><figcaption>${label}</figcaption></figure>`;

const sheetHtml = `<!doctype html><html><head><meta charset="utf8"><style>
  * { margin:0; box-sizing:border-box; }
  body { font-family: system-ui, sans-serif; background:#101418; color:#f4ecda; }
  header { padding:14px 18px 4px; }
  header h1 { font-size:17px; letter-spacing:.04em; }
  header p { font-size:12px; opacity:.75; margin-top:3px; }
  h2 { font-size:13px; letter-spacing:.14em; padding:12px 18px 6px; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:0 12px; }
  .cell { border-radius:8px; overflow:hidden; background:#1a2129; }
  .stage { height:178px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:8px;
           background-image:url("${backdrop}"); background-size:cover; background-position:center; }
  .stage .pair { position:relative; }
  figcaption { font-size:11.5px; padding:6px 8px; letter-spacing:.03em; }
  .rig svg { width:100%; height:auto; }
  .abs { position:absolute; }
  .spark { position:absolute; transform:translate(-50%,-50%); color:#f4c542; font-size:30px;
           text-shadow:0 0 6px rgba(0,0,0,.5); }
  ${rigCss}
</style></head><body>
<header><h1>HOLMES &amp; WATSON — PRODUCTION RIGS (U4)</h1>
<p>Real satellite backdrop (crop of loop-frame-search.png) · true game size · Holmes 148px, Watson 111px (75%)</p></header>
<h2>HOLMES — 12 POSES</h2>
<div class="grid">${HOLMES_POSES.map((p) => cell(`H · ${p}`, holmes(p, "right", p === "ack"))).join("")}</div>
<h2>WATSON — 9 POSES</h2>
<div class="grid">${WATSON_POSES.map((p) => cell(`W · ${p}`, watson(p, "right", p === "read"))).join("")}</div>
<h2>HIGH-FIVE — CONTACT POINTS ALIGNED (HIGH_FIVE_CONTACT)</h2>
<div class="grid">${cell("pair · high-five", highFivePair(1))}</div>
</body></html>`;

const stripHtml = `<!doctype html><html><head><meta charset="utf8"><style>
  * { margin:0; box-sizing:border-box; }
  body { font-family: system-ui, sans-serif; background:#101418; color:#f4ecda; width:390px; }
  .row { padding:8px 10px 2px; }
  .stage { height:210px; display:flex; align-items:flex-end; justify-content:center; gap:6px; padding-bottom:8px;
           border-radius:8px; background-image:url("${backdrop}"); background-size:cover; background-position:center; }
  .stage .pair { position:relative; }
  figcaption, .cap { font-size:12.5px; padding:5px 2px 0; letter-spacing:.03em; }
  .rig svg { width:100%; height:auto; }
  .abs { position:absolute; }
  .spark { position:absolute; transform:translate(-50%,-50%); color:#f4c542; font-size:34px; text-shadow:0 0 6px rgba(0,0,0,.5); }
  ${rigCss}
</style></head><body>
<div class="row"><div class="stage">${watson("read", "right", true)}</div><div class="cap">WATSON · read (speaking) — 390px</div></div>
<div class="row"><div class="stage">${holmes("search")}</div><div class="cap">HOLMES · search — glass DOWN</div></div>
<div class="row"><div class="stage">${holmes("berth-think")}</div><div class="cap">HOLMES · berth-think — chin on fist</div></div>
<div class="row"><div class="stage">${highFivePair(1.05)}</div><div class="cap">PAIR · high-five — hands meet</div></div>
<div class="row"><div class="stage">${holmes("pout")}${watson("pout", "left")}</div><div class="cap">PAIR · pout</div></div>
</body></html>`;

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  join(homedir(), ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.setContent(sheetHtml, { waitUntil: "load" });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(EVIDENCE, "rig-sheet-u4.png"), fullPage: true });
  const strip = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await strip.setContent(stripHtml, { waitUntil: "load" });
  await strip.waitForTimeout(350);
  await strip.screenshot({ path: join(EVIDENCE, "rig-sheet-u4-390.png"), fullPage: true });
} finally {
  await browser.close();
}
console.log("wrote", join(EVIDENCE, "rig-sheet-u4.png"), "and", join(EVIDENCE, "rig-sheet-u4-390.png"));
