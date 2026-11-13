// Paints the five people-and-places stills. No paid image model, no text.
// Each picture uses only the place's own shapes. Run from the repo root.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";

const W = 1152;
const H = 768;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "images", "journals", "people-places");

function make() {
  return { w: W, h: H, px: Buffer.alloc(W * H * 4, 255) };
}

function plot(img, x, y, r, g, b, a) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  const t = a / 255;
  img.px[i] = Math.round(img.px[i] * (1 - t) + r * t);
  img.px[i + 1] = Math.round(img.px[i + 1] * (1 - t) + g * t);
  img.px[i + 2] = Math.round(img.px[i + 2] * (1 - t) + b * t);
}

function vgrad(img, y0, y1, c0, c1) {
  const top = Math.max(0, y0);
  const bot = Math.min(img.h, y1);
  for (let y = top; y < bot; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const r = c0[0] + (c1[0] - c0[0]) * t;
    const g = c0[1] + (c1[1] - c0[1]) * t;
    const b = c0[2] + (c1[2] - c0[2]) * t;
    for (let x = 0; x < img.w; x++) plot(img, x, y, r, g, b, 255);
  }
}

function disc(img, cx, cy, rad, r, g, b, a) {
  const x0 = Math.max(0, Math.floor(cx - rad));
  const x1 = Math.min(img.w - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad));
  const y1 = Math.min(img.h - 1, Math.ceil(cy + rad));
  const r2 = rad * rad;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d > r2) continue;
      const fall = 1 - Math.sqrt(d) / rad;
      plot(img, x, y, r, g, b, a * fall * fall);
    }
  }
}

function rect(img, x, y, w, h, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(img.w, Math.ceil(x + w));
  const y1 = Math.min(img.h, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) plot(img, xx, yy, r, g, b, a);
  }
}

function line(img, x0, y0, x1, y1, thick, r, g, b, a = 255) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    disc(img, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick, r, g, b, a);
  }
}

function poly(img, points, r, g, b) {
  let minY = img.h;
  let maxY = 0;
  for (const p of points) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(img.h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const bpt = points[(i + 1) % points.length];
      if ((a[1] <= y && bpt[1] > y) || (bpt[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (bpt[1] - a[1]);
        xs.push(a[0] + t * (bpt[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i]));
      const x1 = Math.min(img.w - 1, Math.floor(xs[i + 1]));
      for (let x = x0; x <= x1; x++) plot(img, x, y, r, g, b, 255);
    }
  }
}

function grain(img) {
  for (let y = 0; y < img.h; y += 2) {
    for (let x = 0; x < img.w; x += 2) {
      const n = ((x * 374761393 + y * 668265263) ^ 0x9e3779b9) >>> 0;
      const j = (n % 17) - 8;
      plot(img, x, y, 90, 70, 40, j > 0 ? 18 : 10);
    }
  }
}

function sky(img) {
  vgrad(img, 0, H, [244, 214, 170], [168, 198, 214]);
  disc(img, 180, 120, 90, 255, 236, 196, 90);
  disc(img, 820, 90, 140, 255, 255, 255, 40);
  disc(img, 980, 160, 100, 255, 255, 255, 28);
}

function water(img, y) {
  vgrad(img, y, H, [126, 176, 196], [70, 120, 150]);
  for (let i = 0; i < 6; i++) {
    const yy = y + 30 + i * 48;
    rect(img, 0, yy, W, 3, 220, 236, 240, 50);
  }
}

function akashi(img) {
  sky(img);
  water(img, 470);
  const deck = 430;
  const left = 280;
  const right = 870;
  rect(img, 40, deck, W - 80, 18, 176, 186, 190, 255);
  rect(img, left, 210, 28, deck - 210, 150, 162, 168, 255);
  rect(img, right, 210, 28, deck - 210, 150, 162, 168, 255);
  rect(img, left - 18, 200, 64, 16, 130, 142, 148, 255);
  rect(img, right - 18, 200, 64, 16, 130, 142, 148, 255);
  line(img, 70, deck, left + 14, 208, 3, 70, 78, 84, 220);
  line(img, left + 14, 208, (left + right) / 2, deck + 8, 3, 70, 78, 84, 220);
  line(img, (left + right) / 2, deck + 8, right + 14, 208, 3, 70, 78, 84, 220);
  line(img, right + 14, 208, W - 70, deck, 3, 70, 78, 84, 220);
  line(img, 90, deck + 6, left + 10, 250, 2, 90, 98, 104, 160);
  line(img, left + 18, 250, 560, deck + 4, 2, 90, 98, 104, 160);
  line(img, 590, deck + 4, right + 8, 250, 2, 90, 98, 104, 160);
  line(img, right + 18, 250, W - 90, deck + 6, 2, 90, 98, 104, 160);
}

function archHole(img, cx, bottom, rad, r, g, b) {
  const x0 = Math.max(0, Math.floor(cx - rad));
  const x1 = Math.min(img.w - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(bottom - rad));
  const y1 = Math.min(img.h - 1, Math.floor(bottom));
  const r2 = rad * rad;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - bottom;
      if (dx * dx + dy * dy <= r2) plot(img, x, y, r, g, b, 255);
    }
  }
}

function archRow(img, y, h, count, x0, x1, stone) {
  const span = x1 - x0;
  const slot = span / count;
  rect(img, x0, y, span, h, stone[0], stone[1], stone[2], 255);
  for (let i = 0; i < count; i++) {
    const cx = x0 + slot * i + slot / 2;
    const rad = Math.min(slot * 0.42, h * 0.72);
    archHole(img, cx, y + h - 1, rad, 176, 206, 214);
  }
}

function pont(img) {
  sky(img);
  water(img, 560);
  vgrad(img, 500, 580, [196, 176, 140], [168, 150, 116]);
  const stone = [186, 164, 130];
  archRow(img, 470, 110, 6, 180, 980, stone);
  archRow(img, 360, 100, 11, 210, 950, [176, 154, 122]);
  archRow(img, 280, 70, 35, 230, 930, [168, 146, 116]);
  rect(img, 230, 250, 700, 22, 150, 128, 100, 255);
}

function eratosthenes(img) {
  sky(img);
  poly(img, [[0, 520], [W, 470], [W, H], [0, H]], 214, 196, 150);
  vgrad(img, 500, H, [90, 150, 176], [48, 96, 130]);
  rect(img, 0, 500, 620, 80, 214, 196, 150, 255);
  disc(img, 760, 430, 280, 120, 168, 140, 70);
  for (let i = 0; i < 8; i++) {
    const x = 80 + i * 58;
    const h = 40 + ((i * 17) % 36);
    rect(img, x, 500 - h, 40, h, 214 - i * 4, 170, 120, 255);
    rect(img, x + 8, 500 - h - 10, 24, 12, 180, 140, 100, 255);
  }
  rect(img, 250, 420, 6, 80, 90, 70, 48, 255);
  poly(img, [[256, 500], [330, 500], [256, 470]], 120, 96, 60);
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const x = 160 + t * 780;
    const y = 150 + Math.sin(t * Math.PI) * 36;
    disc(img, x, y, 3, 90, 120, 110, 180);
  }
}

function andean(img) {
  vgrad(img, 0, H, [232, 206, 168], [168, 188, 196]);
  poly(img, [[0, 620], [180, 380], [340, 560], [520, 260], [700, 520], [860, 300], [W, 480], [W, H], [0, H]], 120, 132, 112);
  poly(img, [[0, 680], [220, 500], [400, 640], [620, 420], [840, 600], [W, 460], [W, H], [0, H]], 168, 150, 112);
  poly(img, [[0, 740], [300, 620], [560, 700], [900, 580], [W, 660], [W, H], [0, H]], 196, 170, 120);
  const road = [
    [40, 730],
    [180, 700],
    [140, 720],
    [320, 680],
    [280, 710],
    [500, 690],
    [460, 720],
    [700, 680],
    [860, 660],
    [1040, 680],
  ];
  for (let i = 0; i < road.length - 1; i++) {
    line(img, road[i][0], road[i][1], road[i + 1][0], road[i + 1][1], 7, 92, 64, 40, 230);
  }
}

function aconcagua(img) {
  vgrad(img, 0, H, [186, 206, 220], [236, 214, 180]);
  poly(img, [[0, 620], [260, 520], [480, 560], [700, 480], [W, 560], [W, H], [0, H]], 150, 140, 120);
  poly(img, [[160, 660], [380, 420], [520, 300], [700, 130], [860, 360], [1040, 660]], 120, 128, 132);
  poly(img, [[650, 210], [700, 130], [755, 220]], 236, 240, 242);
}

const scenes = {
  "akashi-span": akashi,
  "pont-du-gard": pont,
  "eratosthenes-earth": eratosthenes,
  "andean-roads": andean,
  "aconcagua-height": aconcagua,
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function pngBytes(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    const row = y * (img.w * 4 + 1);
    raw[row] = 0;
    img.px.copy(raw, row + 1, y * img.w * 4, (y + 1) * img.w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "pp-stills-"));
try {
  for (const [name, draw] of Object.entries(scenes)) {
    const img = make();
    draw(img);
    grain(img);
    const png = join(scratch, `${name}.png`);
    const webp = join(outDir, `${name}.webp`);
    writeFileSync(png, pngBytes(img));
    execFileSync(
      "ffmpeg",
      ["-y", "-hide_banner", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-quality", "80", webp],
      { stdio: "inherit" },
    );
    console.log(webp);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
