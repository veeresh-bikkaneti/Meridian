#!/usr/bin/env node
/**
 * Kid-test SMOKE RUN (PR A) — the automatic half of the pair-art gate,
 * run outside a browser against whatever plates exist right now.
 *
 *   node scripts/kidtest-smoke.mjs [--plates <dir>] [--out <file>]
 *
 * What it honestly measures, per width (390 / 768 / 1280 / 1920):
 *   - Figure px: the plate's natural pixel size, read from the image
 *     file header, and the band it will be rendered in. The rendered
 *     rect itself is measured by tests/e2e/pair-art-kidtest.spec.ts.
 *   - Face px: computed ONLY from a faceBox in the plates'
 *     manifest.json (fractions of the plate) × the maximum in-band
 *     figure height. No faceBox → NOT RUN. Nothing is estimated from
 *     the artwork by eye.
 *   - Coverage px²: NOT RUN here, on purpose — coverage is only a real
 *     number against the built game's real clue layout, which the
 *     Playwright spec measures. A number invented in this script
 *     would be a fabrication, so the table says NOT RUN and names the
 *     spec that owns the measure.
 *
 * Missing plates are reported NOT RUN with the reason, per plate. An
 * honest empty table is a PASS for PR A; the full gate runs at PR D.
 * This script always runs to completion (exit 0) unless it cannot
 * write its report at all.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const PLATE_DIR = path.resolve(argValue("--plates") ?? path.join(repoRoot, "public/assets/detective/pair-art"));
const OUT = path.resolve(argValue("--out") ?? path.join(repoRoot, "docs/pair-art/KIDTEST_SMOKE.md"));

const WIDTHS = [
  { width: 390, bandMin: 112, bandMax: 128, faceFloor: 38 },
  { width: 768, bandMin: 128, bandMax: 144, faceFloor: 44 },
  { width: 1280, bandMin: 144, bandMax: 160, faceFloor: 48 },
  { width: 1920, bandMin: 160, bandMax: 176, faceFloor: 52 },
];
const FIGURE_PLATES = ["holmes-standing", "watson-standing"];
/** The art builder delivers pose plates; a `*-standing` plate wins,
 * else the in-play pose is the figure of record. */
const FIGURE_FALLBACKS = {
  "holmes-standing": ["holmes-pose-dock", "holmes-pose-berth-think"],
  "watson-standing": ["watson-pose-station-idle", "watson-pose-read"],
};
const DISTRACTOR_PLATES = ["tracker-standing", "jolly-standing"];
const IMAGE_EXT = /\.(png|webp|jpe?g|gif)$/i;
const resolveFigure = (canonical) =>
  byId.get(canonical) ?? (FIGURE_FALLBACKS[canonical] ?? []).map((f) => byId.get(f)).find(Boolean);

/** Natural pixel size from the file header — PNG, WebP, JPEG, GIF. */
function imageSize(buf) {
  if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { format: "PNG", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X" && buf.length >= 30) {
      return { format: "WebP", w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    }
    if (kind === "VP8 " && buf.length >= 30) {
      return { format: "WebP", w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (kind === "VP8L" && buf.length >= 25) {
      const b = buf.readUInt32LE(21);
      return { format: "WebP", w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
    }
    return null;
  }
  if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { format: "GIF", w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { format: "JPEG", h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  return null;
}

/* ---------------- inventory ---------------- */
const dirExists = existsSync(PLATE_DIR);
const files = dirExists ? readdirSync(PLATE_DIR).filter((f) => IMAGE_EXT.test(f)) : [];
const byId = new Map();
for (const file of files) {
  const id = file.replace(IMAGE_EXT, "");
  const buf = readFileSync(path.join(PLATE_DIR, file));
  byId.set(id, { id, file, bytes: buf.length, size: imageSize(buf) });
}
let faceBoxes = {};
const manifestPath = path.join(PLATE_DIR, "manifest.json");
if (existsSync(manifestPath)) {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const [file, entry] of Object.entries(parsed.plates ?? {})) {
      if (entry && typeof entry === "object" && entry.faceBox) faceBoxes[file] = entry.faceBox;
    }
  } catch {
    faceBoxes = {}; // malformed manifest: face measure stays NOT RUN, noted below
  }
}
const manifestNote = !existsSync(manifestPath)
  ? "no manifest.json in the plate dir — face boxes unavailable"
  : Object.keys(faceBoxes).length === 0
    ? "manifest.json present but carries no faceBox entries (or is unreadable)"
    : `manifest.json face boxes for: ${Object.keys(faceBoxes).join(", ")}`;

const missingReason = (id) =>
  dirExists ? `no ${id}.(png|webp|jpg) in ${path.relative(repoRoot, PLATE_DIR)}` : `plate directory ${path.relative(repoRoot, PLATE_DIR)} does not exist yet`;

/* ---------------- per-plate, per-width rows ---------------- */
function rowsFor(plate) {
  return WIDTHS.map(({ width, bandMin, bandMax, faceFloor }) => {
    if (!plate) {
      return { width, figure: "NOT RUN", face: "NOT RUN", coverage: "NOT RUN", verdict: "NOT RUN" };
    }
    const natural = plate.size ? `${plate.size.w}×${plate.size.h} natural` : "size unreadable";
    const figure = `${bandMax} render target (band ${bandMin}–${bandMax}); ${natural}`;
    const box = faceBoxes[plate.file];
    let face, faceVerdict;
    if (box) {
      const facePx = Math.round(box.h * bandMax);
      face = `${facePx} (faceBox h ${box.h} × ${bandMax})`;
      faceVerdict = facePx >= faceFloor ? "PASS" : `FAIL (< ${faceFloor} floor)`;
    } else {
      face = "NOT RUN";
      faceVerdict = "NOT RUN (no faceBox)";
    }
    const sizeVerdict = plate.size ? "READY (rendered rect measured by the spec)" : "NOT RUN (size unreadable)";
    return {
      width,
      figure,
      face,
      coverage: "NOT RUN (spec-only measure)",
      verdict: `size: ${sizeVerdict} · face: ${faceVerdict} · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts`,
    };
  });
}

/* ---------------- report ---------------- */
const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push("# Kid test — SMOKE results (PR A)");
lines.push("");
lines.push(`Run: ${today} · Script: \`scripts/kidtest-smoke.mjs\` · Plates: \`${path.relative(repoRoot, PLATE_DIR)}/\``);
lines.push("");
lines.push(
  "This is the smoke run: automatic measures only, on whatever plates exist today. " +
    "The human trials (find / identity / expression with 30 kids per cell) run at PR D " +
    "per `scripts/kidtest-protocol.md`. NOT RUN means the measure could not be taken — " +
    "never a pass, never a fail, and never a made-up number.",
);
lines.push("");
lines.push(`Face-box source: ${manifestNote}.`);
lines.push("");
lines.push("## Plate inventory");
lines.push("");
if (!dirExists || files.length === 0) {
  lines.push(`No plates found. ${missingReason("holmes-standing")}.`);
} else {
  lines.push("| Plate | File | Format | Natural size | Bytes |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const p of byId.values()) {
    lines.push(
      `| ${p.id} | ${p.file} | ${p.size?.format ?? "?"} | ${p.size ? `${p.size.w}×${p.size.h}` : "unreadable"} | ${p.bytes} |`,
    );
  }
}
lines.push("");
const facePlateIds = [...byId.keys()].filter((id) => id.startsWith("holmes-face-"));
if (facePlateIds.length > 0) {
  lines.push(
    `Face plates present (${facePlateIds.length}): ${facePlateIds.map((id) => id.replace("holmes-face-", "")).join(", ")}. ` +
      (Object.keys(faceBoxes).length > 0
        ? "Face HEIGHT is measured below from the manifest faceBox entries (see the per-width table)."
        : "Face HEIGHT is still NOT RUN below: the plates ship as separate face crops and no faceBox / scale mapping " +
          "from face plate to figure has been published in a manifest.json yet."),
  );
  lines.push("");
}
const expectedIds = [...FIGURE_PLATES, ...DISTRACTOR_PLATES];
const missingIds = expectedIds.filter((id) =>
  FIGURE_FALLBACKS[id] ? !resolveFigure(id) : !byId.has(id),
);
if (facePlateIds.length === 0) missingIds.push("holmes-face-*");
if (missingIds.length > 0) {
  lines.push("Missing expected plates (each is NOT RUN below, with this reason):");
  lines.push("");
  for (const id of missingIds) lines.push(`- \`${id}\` — ${missingReason(id)}`);
  lines.push("");
}

for (const id of FIGURE_PLATES) {
  const plate = resolveFigure(id);
  lines.push(`## ${id}${plate ? "" : " — NOT RUN"}`);
  lines.push("");
  if (!plate) lines.push(`NOT RUN — ${missingReason(id)}.`);
  else if (plate.id !== id)
    lines.push(`Figure of record: \`${plate.file}\` (pose plate — no dedicated ${id} plate delivered).`);
  lines.push("");
  lines.push("| Width | Figure px | Face px | Coverage px² | Verdict per measure |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of rowsFor(plate)) {
    lines.push(`| ${r.width} | ${r.figure} | ${r.face} | ${r.coverage} | ${r.verdict} |`);
  }
  lines.push("");
}

lines.push("## What this smoke run does NOT cover");
lines.push("");
lines.push("- Rendered figure rects and clue-text coverage: measured by `tests/e2e/pair-art-kidtest.spec.ts` against the built game page (real map, real clue layout).");
lines.push("- Find / identity / expression scores: human trials with kid panellists, PR D, recorded in `docs/pair-art/KIDTEST_RESULTS.md`.");
lines.push("");
const anyPlate = FIGURE_PLATES.some((id) => resolveFigure(id));
lines.push(
  anyPlate
    ? "**Smoke verdict: RAN** — numbers above are the measured/computed values for the plates present; every NOT RUN row names its reason."
    : "**Smoke verdict: RAN, EMPTY** — the harness works and reports honestly; no figure plates exist yet, so every measure is NOT RUN. For PR A that is a pass.",
);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`kidtest-smoke: wrote ${path.relative(repoRoot, OUT)}`);
console.log(`plates found: ${files.length} · missing expected: ${missingIds.length} (${missingIds.join(", ") || "none"})`);
console.log(
  FIGURE_PLATES.some((id) => resolveFigure(id))
    ? "verdict: RAN"
    : "verdict: RAN, EMPTY (all measures NOT RUN — no figure plates yet)",
);
