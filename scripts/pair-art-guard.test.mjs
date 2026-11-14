// pair-art-guard.test.mjs — NEGATIVE gates for the pair-art harness
// (Meridian PR #366, character re-skin PR A).
//
// Owner test-design law (Veeresh, 2026-11-08; review-pipeline rule 15):
// test cases include positive AND negative scenarios, MAINLY NEGATIVE;
// a gate that only passes is not a gate; happy-path-only checks do not
// count as coverage. Every check below therefore carries BOTH a real-set
// assertion AND, where the brief marks one, a sabotage control on a
// SYNTHETIC fixture in a temp dir proving the same gate function bites.
// The shipped assets are never mutated.
//
// The six contractual check names:
//   neg/faces-distinct · neg/no-baked-props · neg/plate-palms-open
//   neg/budget-bites · neg/gaze-no-answer · neg/decoded-bites
//
// Tooling: node builtins only. PNG decoding is done here with
// node:zlib — the repo has no pngjs (checked node_modules at c76bc08);
// scripts/kidtest-smoke.mjs parses PNG headers manually and the kidtest
// harness decodes via browser canvas, neither of which a node test can
// reuse. The shipped set is palette PNGs (colour type 3, bit depth 8,
// non-interlaced) plus two RGBA silhouettes (type 6); the decoder below
// covers types 2/3/6 at bit depth 8, all five row filters.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inflateSync, deflateSync } from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ART_DIR = path.join(repoRoot, "public/assets/detective/pair-art");
const LOCK_PATH = path.join(repoRoot, "docs/pair-art/ASSET_LOCK.json");
const SPEC_PATH = path.join(repoRoot, "docs/pair-art/MODEL_SHEET_SPEC.md");

const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ART_DIR, "manifest.json"), "utf8"));
const specText = fs.readFileSync(SPEC_PATH, "utf8");

/* ------------------------------------------------------------------ */
/* Minimal PNG codec (builtins only)                                   */
/* ------------------------------------------------------------------ */

function pngSize(buf) {
  // Same header read scripts/kidtest-smoke.mjs performs.
  assert.equal(buf.toString("ascii", 1, 4), "PNG", "not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buf) {
  assert.equal(buf.toString("ascii", 1, 4), "PNG", "not a PNG");
  let off = 8;
  let ihdr = null, palette = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        bitDepth: data[8], colorType: data[9], interlace: data[12],
      };
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  assert.ok(ihdr, "missing IHDR");
  assert.equal(ihdr.bitDepth, 8, "decoder supports bit depth 8 only");
  assert.equal(ihdr.interlace, 0, "decoder supports non-interlaced only");
  const bpp = ihdr.colorType === 6 ? 4 : ihdr.colorType === 2 ? 3 : 1;
  const { width: W, height: H } = ihdr;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = W * bpp;
  const px = new Uint8Array(H * stride);
  let rp = 0;
  for (let y = 0; y < H; y++) {
    const filter = raw[rp++];
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const v = raw[rp++];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      row[i] =
        filter === 0 ? v :
        filter === 1 ? (v + a) & 255 :
        filter === 2 ? (v + b) & 255 :
        filter === 3 ? (v + ((a + b) >> 1)) & 255 :
        filter === 4 ? (v + paeth(a, b, c)) & 255 :
        (() => { throw new Error(`unknown PNG filter ${filter}`); })();
    }
  }
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (ihdr.colorType === 3) {
      const idx = px[i];
      out[i * 4] = palette[idx * 3];
      out[i * 4 + 1] = palette[idx * 3 + 1];
      out[i * 4 + 2] = palette[idx * 3 + 2];
      out[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255;
    } else if (ihdr.colorType === 2) {
      out.set(px.subarray(i * 3, i * 3 + 3), i * 4);
      out[i * 4 + 3] = 255;
    } else {
      out.set(px.subarray(i * 4, i * 4 + 4), i * 4);
    }
  }
  return { width: W, height: H, data: out };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// Lossless RGBA encoder used ONLY for synthetic sabotage fixtures.
function encodePng({ width: W, height: H, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const readImg = (file) => decodePng(fs.readFileSync(path.join(ART_DIR, file)));
const md5File = (p) => createHash("md5").update(fs.readFileSync(p)).digest("hex");

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pair-art-guard-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/* ------------------------------------------------------------------ */
/* 1. neg/faces-distinct                                               */
/*                                                                     */
/* No two of the 22 face files (11 per character) may be byte- or     */
/* pixel-identical. The pre-cure set shipped surprised ≡ wonder for   */
/* both characters (recorded in ASSET_LOCK notes); this gate makes    */
/* that ship impossible. Head parts are NOT faces: holmes-head.png    */
/* is the neutral face plate by design and is out of this set.        */
/* ------------------------------------------------------------------ */

function identicalFacePairs(dir, files) {
  const decoded = files.map((f) => {
    const p = path.join(dir, f);
    return { file: f, md5: md5File(p), img: decodePng(fs.readFileSync(p)) };
  });
  const pairs = [];
  for (let i = 0; i < decoded.length; i++) {
    for (let j = i + 1; j < decoded.length; j++) {
      const a = decoded[i], b = decoded[j];
      if (a.md5 === b.md5) {
        pairs.push({ a: a.file, b: b.file, by: "md5" });
        continue;
      }
      if (a.img.width === b.img.width && a.img.height === b.img.height) {
        let same = true;
        for (let k = 0; k < a.img.data.length; k++) {
          if (a.img.data[k] !== b.img.data[k]) { same = false; break; }
        }
        if (same) pairs.push({ a: a.file, b: b.file, by: "pixels" });
      }
    }
  }
  return pairs;
}

const FACE_FILES = fs
  .readdirSync(ART_DIR)
  .filter((f) => /^(holmes|watson)-face-.+\.png$/.test(f))
  .sort();

test("neg/faces-distinct — real set: all 22 faces pairwise distinct (md5 AND pixels)", () => {
  assert.equal(FACE_FILES.length, 22, `expected 22 face files, found ${FACE_FILES.length}`);
  const pairs = identicalFacePairs(ART_DIR, FACE_FILES);
  assert.deepEqual(pairs, [], `identical face pairs: ${JSON.stringify(pairs)}`);
});

test("neg/faces-distinct — sabotage: a face copied over another FAILS the check", (t) => {
  const dir = tmpDir(t);
  // Byte-identical copy under a different face name.
  fs.copyFileSync(path.join(ART_DIR, "holmes-face-wonder.png"), path.join(dir, "holmes-face-wonder.png"));
  fs.copyFileSync(path.join(ART_DIR, "holmes-face-wonder.png"), path.join(dir, "holmes-face-surprised.png"));
  const byMd5 = identicalFacePairs(dir, ["holmes-face-wonder.png", "holmes-face-surprised.png"]);
  assert.ok(byMd5.length >= 1 && byMd5[0].by === "md5", `copy not flagged: ${JSON.stringify(byMd5)}`);
  // Pixel-identical but byte-different (re-encoded RGBA) must also bite.
  const re = encodePng(readImg("holmes-face-wonder.png"));
  fs.writeFileSync(path.join(dir, "holmes-face-surprised.png"), re);
  assert.notEqual(md5File(path.join(dir, "holmes-face-surprised.png")), md5File(path.join(dir, "holmes-face-wonder.png")));
  const byPx = identicalFacePairs(dir, ["holmes-face-wonder.png", "holmes-face-surprised.png"]);
  assert.ok(byPx.length >= 1 && byPx[0].by === "pixels", `re-encode not flagged: ${JSON.stringify(byPx)}`);
});

/* ------------------------------------------------------------------ */
/* 2. neg/no-baked-props                                               */
/*                                                                     */
/* No prop (notebook, glass, pencil) may be baked into a torso/head   */
/* part or a pose plate where the rig can hide it (notebook: false /  */
/* glass: null poses). Zones and bands come from the cure records:    */
/*                                                                     */
/* - Notebook-brown zone: cure commit 016b289 (inpaint of Watson's    */
/*   baked hand + notebook). The plate diff bbox of that cure is      */
/*   vb x[25,74] y[80,114] on Watson plates (figure px x[50,148]      */
/*   y[160,228] at 2 px/vb); the torso hand cluster sat at            */
/*   vb (40.5, 95.5). Pre-cure notebook-brown colours in the zone:    */
/*   (138,85,51) (116,72,43) (131,76,41) (83,39,19) — the band below. */
/*   Recorded cure: read/think/celebrate-jump zone counts             */
/*   709/709/675 -> 0, clap already ~1. This band measures            */
/*   946 pre-cure on read and 0/0/0/3 post-cure (read/think/          */
/*   celebrate/clap) — same verdict, band stated here in full.        */
/*   Parts are scanned through the same figure-space zone, mapped    */
/*   into each part's file pixels via its ASSET_LOCK rect_vb.         */
/*   Faces/hats do not intersect the zone (their rects sit above      */
/*   y=80 vb) — they are still enumerated so the scan is every        */
/*   torso/head part, with the empty intersection reported.           */
/* - Pale-lens glass: prop-glass.png's lens colour is exactly         */
/*   (190,220,228) (400 px in the prop). Band below is that colour    */
/*   widened to the plates' painted register. Recorded cure:         */
/*   baked-glass box pale-lens -> 0 (<=1) on every Holmes plate;      */
/*   glass plates carry the one prop glass (measured 241-322 px       */
/*   here, Watson celebrate-jump 111 px). Whole-file scans are used   */
/*   for parts/plates because the cured whole-file values are 0 on    */
/*   every part and 0/0/10 on the glass=null plates — a baked glass   */
/*   would add ~240-400 px, materially above either threshold.        */
/* - Pencil-yellow: the art cure round split the pencil out of the   */
/*   combined prop. prop-notebook-pencil.png is now notebook-ONLY    */
/*   (0 pencil-band px, asserted exactly below) and the pencil ships */
/*   as its own part, prop-pencil.png — same canvas and rect_vb as   */
/*   the notebook, so it overlays it pixel-exactly — carrying the    */
/*   pencil's recorded colour exactly (201,162,39): 112 px in        */
/*   prop-pencil.png, the band widened by ±12/±12/±14. A pencil      */
/*   zone DOES exist on the plates: on every pencil-present plate    */
/*   (walk / station-idle / pout 112 px, notebook-mark 59 px) the    */
/*   pencil sits at plate px x[200,213] y[197,219], the notebook's   */
/*   lower-right edge; PENCIL_ZONE_PLATE_BOX is that measured bbox   */
/*   with margin. Spec §4.2: the pencil is absent in gasp and        */
/*   high-five, so both plates are asserted at exactly 0 pencil-     */
/*   band px, in the zone AND whole-file. Measured on the real       */
/*   parts: 0 px everywhere. The notebook band is NOT applied to     */
/*   Holmes:                                                          */
/*   his plaid coat sits inside it (7,698 px on holmes-torso.png),    */
/*   so it cannot discriminate a notebook there — the notebook is     */
/*   Watson's prop (spec §4.2) and the gate scans its owner.          */
/* ------------------------------------------------------------------ */

const NB_BAND = (r, g, b, a) => a > 10 && r >= 75 && r <= 145 && g >= 35 && g <= 90 && b >= 15 && b <= 55 && r > g && g > b;
const LENS_BAND = (r, g, b, a) => a > 10 && r >= 170 && r <= 215 && g >= 195 && g <= 238 && b >= 205 && b <= 248 && b >= g && g >= r;
const PENCIL_BAND = (r, g, b, a) => a > 10 && Math.abs(r - 201) <= 12 && Math.abs(g - 162) <= 12 && Math.abs(b - 39) <= 14;
const SKIN_BAND_TEXT = lock.arm_palm_measurements_cure.band;

function countBand(img, band, box = null) {
  const { width: W, height: H, data } = img;
  const [x0, y0, x1, y1] = box ?? [0, 0, W, H];
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const i = (y * W + x) * 4;
      if (band(data[i], data[i + 1], data[i + 2], data[i + 3])) n++;
    }
  }
  return n;
}

// Figure-space notebook zone (Watson vb) -> box inside one part file,
// via the part's placement rect in ASSET_LOCK runtime_files.
const NB_ZONE_VB = { x0: 25, y0: 80, x1: 74, y1: 114 };
function notebookZoneBoxForPart(rectVb, w, h) {
  const [rx0, ry0, rx1, ry1] = rectVb;
  const sx = w / (rx1 - rx0), sy = h / (ry1 - ry0);
  const box = [
    Math.max(0, Math.floor((NB_ZONE_VB.x0 - rx0) * sx)),
    Math.max(0, Math.floor((NB_ZONE_VB.y0 - ry0) * sy)),
    Math.min(w, Math.ceil((NB_ZONE_VB.x1 - rx0) * sx)),
    Math.min(h, Math.ceil((NB_ZONE_VB.y1 - ry0) * sy)),
  ];
  return box[2] > box[0] && box[3] > box[1] ? box : null; // null: zone does not intersect this part
}
const NB_ZONE_PLATE_BOX = [NB_ZONE_VB.x0 * 2, NB_ZONE_VB.y0 * 2, NB_ZONE_VB.x1 * 2, NB_ZONE_VB.y1 * 2]; // plates are full figures at 2 px/vb
const NB_THRESHOLD = 10; // cured values: plates 0/0/0/3, parts <=4

// Spec §4.2: Watson holds notebook + pencil in gasp and high-five,
// but the pencil appears with the notebook EXCEPT in those two poses.
const PENCIL_ABSENT_PLATES = [
  "watson-pose-gasp.png", "watson-pose-high-five.png",
];
// Pencil zone on Watson plates (plate px at 2 px/vb): the measured
// pencil bbox on the pencil-present plates — x[200,213] y[197,219] on
// walk / station-idle / pout — with margin on every side.
const PENCIL_ZONE_PLATE_BOX = [196, 192, 218, 224];

const WATSON_NOTEBOOK_OFF_PLATES = [
  "watson-pose-read.png", "watson-pose-think.png",
  "watson-pose-celebrate-jump.png", "watson-pose-clap.png",
];
const WATSON_NOTEBOOK_ON_PLATES = [
  "watson-pose-walk.png", "watson-pose-station-idle.png", "watson-pose-notebook-mark.png",
  "watson-pose-gasp.png", "watson-pose-high-five.png", "watson-pose-pout.png",
];
const HOLMES_GLASS_NULL_PLATES = [
  "holmes-pose-celebrate-jump.png", "holmes-pose-high-five.png", "holmes-pose-clap.png",
];
const HOLMES_GLASS_ON_PLATES = [
  "holmes-pose-dock.png", "holmes-pose-walk.png", "holmes-pose-search.png",
  "holmes-pose-berth-think.png", "holmes-pose-ack.png", "holmes-pose-announce.png",
  "holmes-pose-gaze-up.png", "holmes-pose-card-look.png", "holmes-pose-pout.png",
];

function bakedPropReport() {
  const report = { notebookZone: {}, lens: {}, pencil: {}, pencilPlates: {}, violations: [] };
  // Notebook zone — every Watson runtime part (mapped) + plates (direct).
  for (const entry of lock.runtime_files.filter((e) => e.character === "watson")) {
    const img = readImg(entry.file);
    const box = notebookZoneBoxForPart(entry.rect_vb, img.width, img.height);
    const n = box ? countBand(img, NB_BAND, box) : 0;
    report.notebookZone[entry.file] = box ? n : "zone does not intersect part rect (0 by construction)";
    if (box && n > NB_THRESHOLD) report.violations.push(`notebook-brown ${n}px in zone of ${entry.file} (> ${NB_THRESHOLD})`);
    const p = countBand(img, PENCIL_BAND);
    report.pencil[entry.file] = p;
    if (p > 4) report.violations.push(`pencil-yellow ${p}px in ${entry.file} (> 4)`);
    const l = countBand(img, LENS_BAND);
    report.lens[entry.file] = l;
    if (entry.file !== "watson-pose-celebrate-jump.png" && l > 10) {
      report.violations.push(`pale-lens ${l}px in ${entry.file} (> 10)`);
    }
  }
  for (const f of WATSON_NOTEBOOK_OFF_PLATES) {
    const n = countBand(readImg(f), NB_BAND, NB_ZONE_PLATE_BOX);
    report.notebookZone[f] = n;
    if (n > NB_THRESHOLD) report.violations.push(`notebook-brown ${n}px in baked zone of ${f} (notebook:false pose)`);
  }
  // Pencil absence on the §4.2 plates: exactly 0 in the pencil zone
  // AND exactly 0 whole-file — any pencil-band px at all is a violation.
  for (const f of PENCIL_ABSENT_PLATES) {
    const img = readImg(f);
    const zone = countBand(img, PENCIL_BAND, PENCIL_ZONE_PLATE_BOX);
    const whole = countBand(img, PENCIL_BAND);
    report.pencilPlates[f] = { zone, whole };
    if (zone !== 0) report.violations.push(`pencil-yellow ${zone}px in pencil zone of ${f} (spec §4.2: pencil absent in gasp and high-five, must be 0)`);
    if (whole !== 0) report.violations.push(`pencil-yellow ${whole}px in ${f} (spec §4.2: pencil absent in gasp and high-five, must be 0)`);
  }
  // Holmes — glass on every runtime part (whole file) + glass=null plates.
  for (const entry of lock.runtime_files.filter((e) => e.character === "holmes")) {
    const l = countBand(readImg(entry.file), LENS_BAND);
    report.lens[entry.file] = l;
    if (l > 10) report.violations.push(`pale-lens ${l}px in ${entry.file} (> 10)`);
  }
  for (const f of HOLMES_GLASS_NULL_PLATES) {
    const l = countBand(readImg(f), LENS_BAND);
    report.lens[f] = l;
    if (l > 16) report.violations.push(`pale-lens ${l}px in ${f} (glass=null pose, > 16)`);
  }
  for (const f of fs.readdirSync(ART_DIR).filter((x) => x.startsWith("watson-pose-"))) {
    if (WATSON_NOTEBOOK_OFF_PLATES.includes(f)) continue;
    const l = countBand(readImg(f), LENS_BAND);
    report.lens[f] = l;
    if (f !== "watson-pose-celebrate-jump.png" && l > 10) {
      report.violations.push(`pale-lens ${l}px in ${f} (Watson glass only in celebrate-jump, > 10)`);
    }
  }
  return report;
}

test("neg/no-baked-props — real set: no notebook/glass/pencil baked where the rig hides it", (t) => {
  const r = bakedPropReport();
  t.diagnostic(`notebook zone: ${JSON.stringify(r.notebookZone)}`);
  t.diagnostic(`pale-lens: ${JSON.stringify(r.lens)}`);
  t.diagnostic(`pencil-yellow (Watson parts): ${JSON.stringify(r.pencil)}`);
  t.diagnostic(`pencil-yellow (pencil-absent plates, zone/whole): ${JSON.stringify(r.pencilPlates)}`);
  // Positive controls: the bands must FIND the props where they belong,
  // or a zero reading everywhere would prove nothing.
  for (const f of WATSON_NOTEBOOK_ON_PLATES) {
    const n = countBand(readImg(f), NB_BAND, NB_ZONE_PLATE_BOX);
    assert.ok(n > 100, `positive control: notebook zone of ${f} should read >100, got ${n}`);
  }
  for (const f of HOLMES_GLASS_ON_PLATES) {
    const n = countBand(readImg(f), LENS_BAND);
    assert.ok(n >= 50, `positive control: ${f} should carry the prop glass (>=50 lens px), got ${n}`);
  }
  assert.ok(countBand(readImg("watson-pose-celebrate-jump.png"), LENS_BAND) >= 50, "positive control: Watson celebrate-jump carries the handed-off glass");
  // Pencil split (art cure round): the positive control hunts the
  // pencil in its own part, prop-pencil.png — the combined prop no
  // longer carries it.
  const propPencilPx = countBand(readImg("prop-pencil.png"), PENCIL_BAND);
  t.diagnostic(`prop-pencil.png pencil-band px: ${propPencilPx}`);
  assert.ok(propPencilPx >= 50, `positive control: pencil band finds the prop pencil in prop-pencil.png, got ${propPencilPx}`);
  // Negative: the notebook alone must carry no pencil at all.
  const notebookOnlyPx = countBand(readImg("prop-notebook-pencil.png"), PENCIL_BAND);
  t.diagnostic(`prop-notebook-pencil.png pencil-band px: ${notebookOnlyPx}`);
  assert.equal(notebookOnlyPx, 0, `prop-notebook-pencil.png is notebook-only after the pencil split: pencil-band px must be 0, got ${notebookOnlyPx}`);
  // Negative: spec §4.2 — pencil absent in gasp and high-five, in the
  // measured pencil zone and anywhere else on the plate.
  for (const f of PENCIL_ABSENT_PLATES) {
    assert.equal(r.pencilPlates[f].zone, 0, `pencil zone of ${f} must read 0 pencil-band px (spec §4.2: pencil absent), got ${r.pencilPlates[f].zone}`);
    assert.equal(r.pencilPlates[f].whole, 0, `${f} must carry 0 pencil-band px whole-file (spec §4.2: pencil absent), got ${r.pencilPlates[f].whole}`);
  }
  assert.deepEqual(r.violations, [], `baked-prop violations: ${r.violations.join("; ")}`);
});

test("neg/no-baked-props — sabotage: prop-coloured patch composited into a torso copy is caught", (t) => {
  const dir = tmpDir(t);
  const torso = lock.runtime_files.find((e) => e.file === "watson-torso.png");
  const img = readImg("watson-torso.png");
  const box = notebookZoneBoxForPart(torso.rect_vb, img.width, img.height);
  assert.ok(box, "torso must intersect the notebook zone");
  // Paint a 30x30 notebook-brown patch inside the zone (a baked notebook fragment).
  for (let y = box[1] + 10; y < box[1] + 40; y++) {
    for (let x = box[0] + 10; x < box[0] + 40; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = 116; img.data[i + 1] = 72; img.data[i + 2] = 43; img.data[i + 3] = 255;
    }
  }
  const fixture = path.join(dir, "watson-torso.png");
  fs.writeFileSync(fixture, encodePng(img));
  const reread = decodePng(fs.readFileSync(fixture));
  const n = countBand(reread, NB_BAND, box);
  t.diagnostic(`sabotaged torso zone reads ${n} notebook-brown px (threshold ${NB_THRESHOLD})`);
  assert.ok(n > NB_THRESHOLD, `sabotage did not bite: zone read ${n}`);
  // And the lens scan bites the same way on a Holmes part copy.
  const hImg = readImg("holmes-torso.png");
  for (let y = 60; y < 80; y++) {
    for (let x = 30; x < 50; x++) {
      const i = (y * hImg.width + x) * 4;
      hImg.data[i] = 190; hImg.data[i + 1] = 220; hImg.data[i + 2] = 228; hImg.data[i + 3] = 255;
    }
  }
  const lensN = countBand(hImg, LENS_BAND);
  assert.ok(lensN > 10, `lens sabotage did not bite: read ${lensN}`);
  // And the pencil-absence plate scan bites: a pencil-coloured patch
  // painted inside the pencil zone of a gasp-plate copy must read
  // > 0 where the real plate reads exactly 0 (zone AND whole file).
  const gImg = readImg("watson-pose-gasp.png");
  for (let y = 200; y < 216; y++) {
    for (let x = 198; x < 214; x++) {
      const i = (y * gImg.width + x) * 4;
      gImg.data[i] = 201; gImg.data[i + 1] = 162; gImg.data[i + 2] = 39; gImg.data[i + 3] = 255;
    }
  }
  const gFixture = path.join(dir, "watson-pose-gasp.png");
  fs.writeFileSync(gFixture, encodePng(gImg));
  const gReread = decodePng(fs.readFileSync(gFixture));
  const gZone = countBand(gReread, PENCIL_BAND, PENCIL_ZONE_PLATE_BOX);
  const gWhole = countBand(gReread, PENCIL_BAND);
  t.diagnostic(`sabotaged gasp plate reads ${gZone} pencil-band px in the pencil zone, ${gWhole} whole-file (real plate: 0/0)`);
  assert.ok(gZone > 0, `pencil sabotage did not bite in the zone scan: read ${gZone}`);
  assert.ok(gWhole > 0, `pencil sabotage did not bite in the whole-file scan: read ${gWhole}`);
});

/* ------------------------------------------------------------------ */
/* 3. neg/plate-palms-open                                             */
/*                                                                     */
/* The high-five PLATES must agree with the parts: the skin cluster   */
/* nearest HIGH_FIVE_CONTACT must sit within <=3 rig px of the        */
/* anchor AND be an OPEN PALM — bbox >=10 vb wide AND >=10 vb tall    */
/* AND skin fill ratio (cluster px / bbox area) <= 0.85. A closed     */
/* fist is a compact near-disc: small bbox, fill near the disc's.     */
/*                                                                     */
/* Skin band: ASSET_LOCK arm_palm_measurements_cure.band, parsed      */
/* below — not retyped. Cluster logic: connected clusters of          */
/* >=40 px (the kidtest harness's floor). The painted hand is         */
/* dithered: finger skin streaks are split by 1-2 px keyline/dither   */
/* gaps, so connectivity is computed on a 3x3-dilated mask while      */
/* centroid / bbox / fill are computed on the RAW band pixels of      */
/* the merged cluster. This reproduces the harness's own plate        */
/* numbers: Holmes cluster 230 raw px here vs 229 skin px in the      */
/* lock's palm measurement; plate errors 0.30 / 1.03 rig px here vs   */
/* 0.72 / 0.71 recorded for the cure's band reading — both <= 3.      */
/* Rig px = vb units x 104 / viewBox height (Holmes 178, Watson 140). */
/* ------------------------------------------------------------------ */

function parseSkinBand(text) {
  const m = text.match(/R (\d+)-(\d+), G (\d+)-(\d+), B (\d+)-(\d+), R-G (\d+)-(\d+), G-B (\d+)-(\d+)/);
  assert.ok(m, `cannot parse skin band from ASSET_LOCK: ${text}`);
  const n = m.slice(1).map(Number);
  return (r, g, b, a) =>
    a > 10 && r >= n[0] && r <= n[1] && g >= n[2] && g <= n[3] && b >= n[4] && b <= n[5] &&
    r - g >= n[6] && r - g <= n[7] && g - b >= n[8] && g - b <= n[9];
}
const SKIN_BAND = parseSkinBand(SKIN_BAND_TEXT);

function palmMeasure(img, anchorVb, vbHeight) {
  const { width: W, height: H, data } = img;
  const skin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (SKIN_BAND(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3])) skin[i] = 1;
  }
  // Dilated mask for connectivity only (bridges 1-2 px dither gaps).
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!skin[y * W + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) dil[ny * W + nx] = 1;
        }
      }
    }
  }
  const ax = anchorVb[0] * 2, ay = anchorVb[1] * 2; // plates at 2 px/vb
  const windowPx = 30 * 2; // kidtest window: centroid within 30 vb of anchor
  const seen = new Uint8Array(W * H);
  let best = null;
  for (let s = 0; s < W * H; s++) {
    if (!dil[s] || seen[s]) continue;
    const queue = [s];
    seen[s] = 1;
    const rawPts = [];
    while (queue.length) {
      const cur = queue.pop();
      if (skin[cur]) rawPts.push(cur);
      const cx = cur % W, cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (dil[ni] && !seen[ni]) { seen[ni] = 1; queue.push(ni); }
        }
      }
    }
    if (rawPts.length < 40) continue;
    let sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (const p of rawPts) {
      const x = p % W, y = (p / W) | 0;
      sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const cx = sx / rawPts.length, cy = sy / rawPts.length;
    const distPx = Math.hypot(cx - ax, cy - ay);
    if (distPx > windowPx) continue;
    if (!best || distPx < best.distPx) {
      best = {
        distPx, clusterPx: rawPts.length,
        centroidVb: [cx / 2, cy / 2],
        bboxVb: [(x1 - x0 + 1) / 2, (y1 - y0 + 1) / 2],
        fill: rawPts.length / ((x1 - x0 + 1) * (y1 - y0 + 1)),
      };
    }
  }
  if (!best) return null;
  const errVb = best.distPx / 2;
  return { ...best, errRigPx: errVb * (104 / vbHeight) };
}

function palmVerdict(img, anchorVb, vbHeight) {
  const m = palmMeasure(img, anchorVb, vbHeight);
  if (!m) return { ok: false, reason: "no skin cluster >=40 px within 30 vb of the anchor", measure: null };
  const checks = {
    anchor: m.errRigPx <= 3,
    openPalm: m.bboxVb[0] >= 10 && m.bboxVb[1] >= 10 && m.fill <= 0.85,
  };
  return { ok: checks.anchor && checks.openPalm, checks, measure: m };
}

const HIGH_FIVE = [
  { file: "holmes-pose-high-five.png", anchor: [99, 25], vbHeight: 178 },
  { file: "watson-pose-high-five.png", anchor: [15, 21], vbHeight: 140 },
];

test("neg/plate-palms-open — real plates: palm on anchor (<=3 rig px) and OPEN (bbox >=10x10 vb, fill <=0.85)", (t) => {
  for (const hf of HIGH_FIVE) {
    // Anchor + viewBox come from the lock, not from this file's constants alone.
    assert.deepEqual(lock.high_five_contact_vb[hf.file.startsWith("holmes") ? "holmes" : "watson"], hf.anchor);
    const v = palmVerdict(readImg(hf.file), hf.anchor, hf.vbHeight);
    t.diagnostic(`${hf.file}: ${JSON.stringify(v.measure)} checks=${JSON.stringify(v.checks)}`);
    assert.ok(v.ok, `${hf.file} palm verdict failed: ${JSON.stringify(v)}`);
  }
});

test("neg/plate-palms-open — sabotage: a filled skin disc at the anchor FAILS the open-palm check", (t) => {
  const dir = tmpDir(t);
  const hf = HIGH_FIVE[0];
  const img = readImg(hf.file);
  const [ax, ay] = [hf.anchor[0] * 2, hf.anchor[1] * 2];
  // Clear the real hand (disc r=30 px), then draw the rig's flat hand
  // disc: r=4.6 vb = 9.2 natural px of solid skin colour at the anchor.
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (Math.hypot(x - ax, y - ay) <= 30) img.data[i + 3] = 0;
      if (Math.hypot(x - ax, y - ay) <= 9) {
        img.data[i] = 230; img.data[i + 1] = 160; img.data[i + 2] = 110; img.data[i + 3] = 255;
      }
    }
  }
  const fixture = path.join(dir, hf.file);
  fs.writeFileSync(fixture, encodePng(img));
  const v = palmVerdict(decodePng(fs.readFileSync(fixture)), hf.anchor, hf.vbHeight);
  t.diagnostic(`sabotage disc: ${JSON.stringify(v.measure)} checks=${JSON.stringify(v.checks)}`);
  assert.ok(v.measure, "disc should still measure as a cluster");
  assert.ok(v.checks.anchor, "disc sits ON the anchor — the failure must come from the open-palm limb");
  assert.equal(v.checks.openPalm, false, "filled disc must FAIL the open-palm check");
  assert.equal(v.ok, false);
});

/* ------------------------------------------------------------------ */
/* 4. neg/budget-bites  +  6. neg/decoded-bites                         */
/*                                                                     */
/* The budget gates themselves get negative controls: fed a           */
/* violation, the gate must FAIL. The gate functions below are the    */
/* SAME functions the real-set assertions use — no duplicate logic.   */
/* Runtime entries are the ASSET_LOCK runtime_files (44 files; pose   */
/* plates + silhouettes are docs/test assets, excluded per the lock's */
/* own note). Decoded size = width x height x 4 bytes, decimal MB —   */
/* the lock's own arithmetic (44 runtime files -> 2.436 MB).          */
/* manifest.json's byte fields are NOT used here: these gates        */
/* measure the files on disk directly (statSync + PNG header) and    */
/* read ASSET_LOCK.json as the source of truth — the lock is the     */
/* audit record, its runtime byte fields match disk, and the         */
/* lock-honesty limb in evaluateRuntimeBudget fails the gate if      */
/* its recorded total ever stops matching the disk total.            */
/* ------------------------------------------------------------------ */

const RUNTIME_BUDGET_BYTES = 500_000;
const DECODED_BUDGET_MB = 32;

function evaluateRuntimeBudget(entries, recordedTotalBytes, budgetBytes = RUNTIME_BUDGET_BYTES) {
  const failures = [];
  const total = entries.reduce((s, e) => s + e.bytes, 0);
  if (total > budgetBytes) failures.push(`runtime total ${total} B exceeds budget ${budgetBytes} B`);
  if (recordedTotalBytes !== total) {
    failures.push(`lock honesty: recorded total ${recordedTotalBytes} B != disk total ${total} B`);
  }
  for (const e of entries) {
    if (typeof e.bytes !== "number" || e.bytes <= 0) failures.push(`entry ${e.file} has no positive byte size`);
  }
  return { total, failures };
}

function evaluateDecoded(entries, budgetMB = DECODED_BUDGET_MB) {
  const totalMB = entries.reduce((s, e) => s + e.width * e.height * 4, 0) / 1e6;
  const failures = [];
  if (totalMB > budgetMB) failures.push(`decoded total ${totalMB.toFixed(3)} MB exceeds budget ${budgetMB} MB`);
  return { totalMB, failures };
}

function realRuntimeEntries() {
  return lock.runtime_files.map((e) => {
    const p = path.join(ART_DIR, e.file);
    const size = pngSize(fs.readFileSync(p));
    // The lock's recorded dimensions must match the file header too.
    assert.equal(size.width, e.width, `${e.file}: lock width ${e.width} != header ${size.width}`);
    assert.equal(size.height, e.height, `${e.file}: lock height ${e.height} != header ${size.height}`);
    return { file: e.file, bytes: fs.statSync(p).size, width: size.width, height: size.height };
  });
}

test("neg/budget-bites — real set passes (positive control)", (t) => {
  const entries = realRuntimeEntries();
  const r = evaluateRuntimeBudget(entries, lock.budgets.runtime_total_bytes);
  t.diagnostic(`real runtime total ${r.total} B of ${RUNTIME_BUDGET_BYTES} B; lock recorded ${lock.budgets.runtime_total_bytes} B`);
  assert.equal(lock.budgets.runtime_budget_bytes, RUNTIME_BUDGET_BYTES);
  assert.deepEqual(r.failures, []);
});

test("neg/budget-bites — sabotage (i): a set padded past 500,000 B FAILS the gate", (t) => {
  const dir = tmpDir(t);
  // Synthetic fixture: two real files, one padded with 600,000 zero
  // bytes (byte size is what the budget gates; the PNG header is intact).
  const a = fs.readFileSync(path.join(ART_DIR, "holmes-torso.png"));
  const b = fs.readFileSync(path.join(ART_DIR, "watson-torso.png"));
  fs.writeFileSync(path.join(dir, "a.png"), a);
  fs.writeFileSync(path.join(dir, "b.png"), Buffer.concat([b, Buffer.alloc(600_000)]));
  const entries = ["a.png", "b.png"].map((f) => ({ file: f, bytes: fs.statSync(path.join(dir, f)).size }));
  const recorded = entries.reduce((s, e) => s + e.bytes, 0); // honest record, blown budget
  const r = evaluateRuntimeBudget(entries, recorded);
  t.diagnostic(`padded fixture total ${r.total} B -> failures: ${r.failures.join("; ")}`);
  assert.ok(r.failures.some((f) => f.includes("exceeds budget")), "padded set must FAIL on the budget limb");
});

test("neg/budget-bites — sabotage (ii): a lock that understates the real bytes FAILS the gate", () => {
  const entries = realRuntimeEntries();
  const honest = entries.reduce((s, e) => s + e.bytes, 0);
  const r = evaluateRuntimeBudget(entries, honest - 1000);
  assert.ok(r.failures.some((f) => f.includes("lock honesty")), `understated lock must FAIL: ${JSON.stringify(r.failures)}`);
});

test("neg/decoded-bites — real set passes (positive control)", (t) => {
  const entries = realRuntimeEntries();
  const r = evaluateDecoded(entries);
  t.diagnostic(`real decoded total ${r.totalMB.toFixed(3)} MB of ${DECODED_BUDGET_MB} MB (lock records ${lock.budgets.decoded_total_MB} MB)`);
  assert.ok(Math.abs(r.totalMB - lock.budgets.decoded_total_MB) < 0.001, "decoded measure must reproduce the lock's 2.436 MB");
  assert.deepEqual(r.failures, []);
});

test("neg/decoded-bites — sabotage: a synthetic set decoded past 32 MB FAILS the gate", (t) => {
  const dir = tmpDir(t);
  // A 3000x3000 RGBA PNG decodes to 36 MB and compresses small.
  const W = 3000, H = 3000;
  const big = encodePng({ width: W, height: H, data: new Uint8Array(W * H * 4) });
  const p = path.join(dir, "big.png");
  fs.writeFileSync(p, big);
  const size = pngSize(fs.readFileSync(p));
  const r = evaluateDecoded([{ file: "big.png", width: size.width, height: size.height }]);
  t.diagnostic(`fixture on disk ${fs.statSync(p).size} B, decoded ${r.totalMB.toFixed(1)} MB -> failures: ${r.failures.join("; ")}`);
  assert.ok(r.failures.some((f) => f.includes("decoded")), "oversized decoded set must FAIL");
});

/* ------------------------------------------------------------------ */
/* 5. neg/gaze-no-answer                                               */
/*                                                                     */
/* HONEST SCOPE: at PR A there is no runtime answer coordinate on a   */
/* sheet, so this gate proves the two things a sheet CAN prove:       */
/* (a) STRUCTURAL — no file in the pair-art set carries an            */
/*     answer-coordinate field. The seven legitimate host-prop keys   */
/*     (spec §4.1/§9.3: caseIndex, cluesRevealed, status, sheetOpen,  */
/*     lastGuessPlaceId, freshDeal, answerPlaceId) are the allowlist; */
/*     answerPlaceId is a NAME in the architecture, never a value in  */
/*     these files — any key beyond the allowlist that names an       */
/*     answer/target/coordinate, and any string value carrying a     */
/*     lat,lng pair, fails.                                           */
/* (b) DIRECTIONAL CONSISTENCY — for every pose plate, the face's     */
/*     gaze direction measured from its face file must not CONTRADICT */
/*     the direction the spec's verb table declares for that pose     */
/*     (§5.2 pose->face, §6.2 face targets), and must never be a      */
/*     map-directed downward-outward aim except where the declared    */
/*     target is the character's own prop (reading/marking).          */
/*                                                                     */
/* Measurement: dark-feature centroid in the eye band (top 45% of     */
/* the face file; dark = alpha>100, R<80, G<65, B<55 — brows + eyes   */
/* + pupils travel together in this painted register), aligned into   */
/* figure px via the manifest faceBox, expressed as a shift in vb     */
/* from the same character's NEUTRAL face. Tolerance 0.75 vb:         */
/* |dy| <= 0.75 reads "centred" — centred contradicts nothing and     */
/* aims nowhere. A face whose pupils are not present by design is     */
/* reported NOT MEASURED by name, never passed silently: `delighted`  */
/* is a CLOSED happy eye arc (§6.2) — it has no pupils to measure,    */
/* so its 6 plates are NOT MEASURED.                                  */
/* ------------------------------------------------------------------ */

const HOST_PROP_ALLOWLIST = [
  "caseIndex", "cluesRevealed", "status", "sheetOpen",
  "lastGuessPlaceId", "freshDeal", "answerPlaceId",
];

function scanForAnswerFields(root) {
  const violations = [];
  const keyIsForbidden = (k) => {
    const lk = k.toLowerCase();
    if (HOST_PROP_ALLOWLIST.includes(k)) return false;
    if (lk.includes("answer")) return true;
    if (lk === "lat" || lk === "lng" || lk === "lon") return true;
    if (/latitude|longitude|targetx|targety|coordinate/.test(lk)) return true;
    return false;
  };
  const walk = (o, at) => {
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (keyIsForbidden(k)) violations.push(`forbidden key ${at}.${k}`);
        walk(v, `${at}.${k}`);
      }
    } else if (typeof o === "string") {
      if (/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/.test(o)) {
        violations.push(`lat,lng-looking value at ${at}: ${o.slice(0, 60)}`);
      }
    }
  };
  walk(root, "$");
  return violations;
}

test("neg/gaze-no-answer — (a) structural: manifest + lock carry no answer-coordinate field", () => {
  assert.deepEqual(scanForAnswerFields(manifest), []);
  assert.deepEqual(scanForAnswerFields(lock), []);
  // Sabotage control for the scanner itself: a planted target field bites.
  const planted = JSON.parse(JSON.stringify(manifest));
  planted.characters.holmes.targetX = 12;
  planted.notes2 = { answerLat: 41.0 };
  const v = scanForAnswerFields(planted);
  assert.ok(v.length >= 2, `scanner must flag planted fields, got ${JSON.stringify(v)}`);
});

// Pose -> face assignments are spec §5.2; declared gaze targets are
// §6.2's words (reading/marking: eyes on the character's OWN prop;
// wonder: eye lifted; thinking: gaze slightly aside; the rest: no
// directed target — centred/forward).
const POSE_GAZE = [
  // [character, pose, plate file, face kind, declared]
  ["holmes", "dock", "holmes-pose-dock.png", "neutral", "centred"],
  ["holmes", "walk", "holmes-pose-walk.png", "focused", "centred"],
  ["holmes", "search", "holmes-pose-search.png", "focused", "centred"],
  ["holmes", "berth-think", "holmes-pose-berth-think.png", "thinking", "aside"],
  ["holmes", "ack", "holmes-pose-ack.png", "attentive", "centred"],
  ["holmes", "announce", "holmes-pose-announce.png", "hushed", "centred"],
  ["holmes", "gaze-up", "holmes-pose-gaze-up.png", "wonder", "up"],
  ["holmes", "card-look", "holmes-pose-card-look.png", "reading", "down-own-prop"],
  ["holmes", "celebrate-jump", "holmes-pose-celebrate-jump.png", "delighted", "not-measured"],
  ["holmes", "high-five", "holmes-pose-high-five.png", "delighted", "not-measured"],
  ["holmes", "clap", "holmes-pose-clap.png", "delighted", "not-measured"],
  ["holmes", "pout", "holmes-pose-pout.png", "pout", "none-declared"],
  ["watson", "walk", "watson-pose-walk.png", "neutral", "centred"],
  ["watson", "read", "watson-pose-read.png", "reading", "down-own-prop"],
  ["watson", "think", "watson-pose-think.png", "thinking", "aside"],
  ["watson", "station-idle", "watson-pose-station-idle.png", "neutral", "centred"],
  ["watson", "notebook-mark", "watson-pose-notebook-mark.png", "marking", "down-own-prop"],
  ["watson", "gasp", "watson-pose-gasp.png", "surprised", "centred"],
  ["watson", "celebrate-jump", "watson-pose-celebrate-jump.png", "delighted", "not-measured"],
  ["watson", "high-five", "watson-pose-high-five.png", "delighted", "not-measured"],
  ["watson", "clap", "watson-pose-clap.png", "delighted", "not-measured"],
  ["watson", "pout", "watson-pose-pout.png", "pout", "none-declared"],
];

function eyeBandCentroid(img) {
  const { width: W, height: H, data } = img;
  const bandH = Math.floor(H * 0.45);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < bandH; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 100 && data[i] < 80 && data[i + 1] < 65 && data[i + 2] < 55) {
        sx += x; sy += y; n++;
      }
    }
  }
  return n >= 30 ? { cx: sx / n, cy: sy / n, n } : null;
}

const GAZE_TOL_VB = 0.75;

test("neg/gaze-no-answer — (b) per-pose: measured gaze never contradicts the declared target, never aims at the map", (t) => {
  // The pose->face table above must match the spec's §5.2 tables.
  for (const [, pose, , face] of POSE_GAZE) {
    const row = new RegExp("`\\|?\\s*" + pose + "`\\s*\\|\\s*`" + face + "`");
    assert.ok(row.test(specText), `spec §5.2 row for ${pose} -> ${face} not found`);
  }
  const baselines = {};
  for (const ch of ["holmes", "watson"]) {
    const info = manifest.characters[ch].faces.neutral;
    const c = eyeBandCentroid(readImg(info.file));
    assert.ok(c, `${ch} neutral face must be measurable`);
    baselines[ch] = { x: c.cx + info.faceBox.x, y: c.cy + info.faceBox.y };
  }
  const rows = [];
  const failures = [];
  for (const [ch, pose, plate, face, declared] of POSE_GAZE) {
    assert.ok(fs.existsSync(path.join(ART_DIR, plate)), `plate missing: ${plate}`);
    if (declared === "not-measured") {
      rows.push(`${ch}/${pose}: declared=${declared} face=${face} -> NOT MEASURED (delighted = closed eye arc, §6.2 — no pupils)`);
      continue;
    }
    const info = manifest.characters[ch].faces[face];
    const c = eyeBandCentroid(readImg(info.file));
    if (!c) {
      rows.push(`${ch}/${pose}: declared=${declared} face=${face} -> NOT MEASURED (eye band under threshold)`);
      continue;
    }
    const dx = (c.cx + info.faceBox.x - baselines[ch].x) / 2; // figure px -> vb (2 px/vb)
    const dy = (c.cy + info.faceBox.y - baselines[ch].y) / 2;
    const measured = dy <= -GAZE_TOL_VB ? "up" : dy >= GAZE_TOL_VB ? "down" : "centred";
    let verdict = "PASS";
    if (declared === "up" && measured === "down") verdict = "FAIL (declared up, measured down)";
    if (declared === "down-own-prop" && measured === "up") verdict = "FAIL (declared down at own prop, measured up)";
    if (measured === "down" && Math.abs(dx) >= 1.5 && declared !== "down-own-prop") {
      verdict = "FAIL (map-directed downward-outward aim)";
    }
    if (verdict !== "PASS") failures.push(`${ch}/${pose}: ${verdict} dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);
    rows.push(
      `${ch}/${pose}: declared=${declared} face=${face} measured=${measured} (dx=${dx.toFixed(2)} vb, dy=${dy.toFixed(2)} vb) -> ${verdict}`,
    );
  }
  for (const r of rows) t.diagnostic(r);
  assert.deepEqual(failures, [], `gaze contradictions: ${failures.join("; ")}`);
});
