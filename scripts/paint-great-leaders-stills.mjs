#!/usr/bin/env node
// Paints the three great-leaders stills when no watercolor file already exists.
// No text. Objects stay inside each clip's picture note.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1152;
const H = 768;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "images", "journals", "great-leaders");

function hash(x, y) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function clamp(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function create() {
  return Buffer.alloc(W * H * 3);
}

function blend(buf, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  const k = a > 1 ? 1 : a;
  buf[i] = clamp(buf[i] * (1 - k) + r * k);
  buf[i + 1] = clamp(buf[i + 1] * (1 - k) + g * k);
  buf[i + 2] = clamp(buf[i + 2] * (1 - k) + b * k);
}

function sky(buf, top, horizon, bottom) {
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const c = t < 0.62 ? lerp(top, horizon, t / 0.62) : lerp(horizon, bottom, (t - 0.62) / 0.38);
    for (let x = 0; x < W; x++) blend(buf, x, y, c[0], c[1], c[2], 1);
  }
}

function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function rect(buf, x0, y0, x1, y1, color, a = 1) {
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(W - 1, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(H - 1, Math.ceil(y1));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) blend(buf, x, y, color[0], color[1], color[2], a);
  }
}

function ellipse(buf, cx, cy, rx, ry, color, a = 1) {
  const xa = Math.max(0, Math.floor(cx - rx));
  const xb = Math.min(W - 1, Math.ceil(cx + rx));
  const ya = Math.max(0, Math.floor(cy - ry));
  const yb = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) blend(buf, x, y, color[0], color[1], color[2], a * (1 - d * 0.15));
    }
  }
}

function wash(buf, spots) {
  for (const spot of spots) ellipse(buf, spot[0], spot[1], spot[2], spot[3], spot[4], spot[5]);
}

function grain(buf) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = (hash(x, y) % 19) - 9;
      const i = (y * W + x) * 3;
      buf[i] = clamp(buf[i] + n);
      buf[i + 1] = clamp(buf[i + 1] + n);
      buf[i + 2] = clamp(buf[i + 2] + n * 0.7);
    }
  }
}

function vignette(buf) {
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const d = Math.min(1, (dx * dx + dy * dy) / 1.35);
      const edge = d * d * 0.22;
      const i = (y * W + x) * 3;
      buf[i] = clamp(buf[i] * (1 - edge) + 244 * edge);
      buf[i + 1] = clamp(buf[i + 1] * (1 - edge) + 236 * edge);
      buf[i + 2] = clamp(buf[i + 2] * (1 - edge) + 214 * edge);
    }
  }
}

function column(buf, x, y0, y1) {
  rect(buf, x - 16, y0, x + 16, y1, [214, 206, 190], 1);
  rect(buf, x - 6, y0, x + 2, y1, [186, 176, 158], 0.55);
  ellipse(buf, x, y0, 22, 10, [232, 226, 210], 1);
  ellipse(buf, x, y1, 24, 9, [176, 166, 148], 1);
}

function seatedStatue(buf) {
  rect(buf, 488, 330, 530, 560, [176, 166, 148], 1);
  rect(buf, 520, 470, 740, 518, [186, 176, 156], 1);
  rect(buf, 540, 350, 650, 472, [244, 241, 232], 1);
  ellipse(buf, 596, 324, 30, 32, [248, 246, 238], 1);
  rect(buf, 545, 440, 720, 495, [236, 232, 220], 1);
  rect(buf, 690, 485, 735, 600, [226, 220, 206], 1);
}

function figure(buf, x, y, scale, robe) {
  ellipse(buf, x, y - 78 * scale, 16 * scale, 18 * scale, [232, 196, 166], 1);
  rect(buf, x - 22 * scale, y - 58 * scale, x + 22 * scale, y + 48 * scale, robe, 1);
  rect(buf, x - 8 * scale, y + 48 * scale, x - 1 * scale, y + 92 * scale, [90, 72, 58], 1);
  rect(buf, x + 2 * scale, y + 48 * scale, x + 9 * scale, y + 92 * scale, [90, 72, 58], 1);
}

function lincoln(buf) {
  sky(buf, [186, 214, 232], [244, 228, 196], [214, 206, 176]);
  rect(buf, 0, 600, W, H, [196, 204, 176], 1);
  wash(buf, [
    [180, 180, 220, 80, [255, 244, 220], 0.28],
    [980, 140, 180, 70, [255, 236, 210], 0.22],
  ]);
  rect(buf, 180, 200, 972, 620, [246, 244, 238], 1);
  rect(buf, 160, 170, 992, 220, [250, 248, 242], 1);
  rect(buf, 470, 250, 700, 600, [196, 186, 166], 1);
  for (const x of [230, 300, 370, 440, 760, 830, 900, 970]) column(buf, x, 230, 600);
  seatedStatue(buf);
}

function jhansi(buf) {
  sky(buf, [168, 206, 224], [244, 214, 170], [186, 168, 120]);
  ellipse(buf, 576, 620, 620, 180, [168, 150, 96], 1);
  ellipse(buf, 430, 520, 280, 120, [150, 132, 84], 1);
  rect(buf, 300, 300, 860, 470, [176, 140, 96], 1);
  rect(buf, 280, 270, 400, 470, [160, 124, 84], 1);
  rect(buf, 760, 250, 900, 470, [160, 124, 84], 1);
  rect(buf, 470, 360, 560, 470, [120, 92, 64], 1);
  wash(buf, [[620, 160, 200, 60, [255, 232, 190], 0.25]]);
  figure(buf, 470, 560, 1.15, [176, 64, 58]);
  figure(buf, 560, 590, 0.72, [214, 164, 72]);
}

function netaji(buf) {
  sky(buf, [176, 208, 220], [236, 220, 186], [196, 186, 150]);
  rect(buf, 0, 560, W, H, [186, 176, 146], 1);
  rect(buf, 250, 250, 902, 600, [214, 186, 150], 1);
  rect(buf, 300, 300, 500, 430, [168, 196, 206], 0.85);
  rect(buf, 652, 300, 852, 430, [168, 196, 206], 0.85);
  rect(buf, 520, 390, 632, 600, [96, 72, 56], 1);
  rect(buf, 220, 230, 932, 270, [186, 150, 112], 1);
}

function paint(name, draw) {
  const out = join(outDir, `${name}.webp`);
  if (existsSync(out) && process.argv.includes("--skip-existing")) return out;
  const buf = create();
  draw(buf);
  grain(buf);
  vignette(buf);
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgb24",
      "-video_size",
      `${W}x${H}`,
      "-i",
      "pipe:0",
      "-frames:v",
      "1",
      out,
    ],
    { input: buf },
  );
  if (encoded.status !== 0) {
    console.error(encoded.stderr?.toString() ?? "");
    process.exit(encoded.status || 1);
  }
  console.log(out);
  return out;
}

mkdirSync(outDir, { recursive: true });
paint("lincoln-memorial", lincoln);
paint("jhansi-fort", jhansi);
paint("netaji-bhawan", netaji);
