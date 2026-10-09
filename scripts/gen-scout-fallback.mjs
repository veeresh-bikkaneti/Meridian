#!/usr/bin/env node
/**
 * Generate public/scout-fallback.svg — the static outline fallback for
 * Scout Map (PBI-4). If even the outline WebGL render fails, the game
 * still works on this pre-baked equirectangular world outline with the
 * pin-drop UI intact (the mapping is linear, so taps invert exactly).
 *
 * Source: the same countries-50m TopoJSON the globe mesh consumes
 * (world-atlas, via topojson-client) — coast mesh only, simplified by
 * coordinate rounding. No labels anywhere (repo rule).
 *
 * Budget: the output must stay ≤ 100 kB (SRE constraint). The script
 * asserts the budget and fails loudly if it regresses.
 *
 * Usage: node scripts/gen-scout-fallback.mjs
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { mesh } = require("topojson-client");

const W = 1440;
const H = 720;
const BUDGET_BYTES = 100 * 1024;
const OUT = new URL("../public/scout-fallback.svg", import.meta.url);

/** Degrees of rounding for simplification — 0.25° ≈ 28 km at the equator. */
const ROUND_DEG = 0.25;
/** Douglas-Peucker tolerance in degrees — the main size lever. */
const DP_TOLERANCE_DEG = 0.9;

const world = JSON.parse(
  readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"),
);
const coast = mesh(world, world.objects.countries, (a, b) => a === b);

const x = (lon) => ((lon + 180) / 360) * W;
const y = (lat) => ((90 - lat) / 180) * H;
const r1 = (n) => Math.round(n * 10) / 10;

function simplifyLine(coords) {
  const pts = [];
  let prevLon = null;
  for (const [lon, lat] of coords) {
    const rlon = Math.round(lon / ROUND_DEG) * ROUND_DEG;
    const rlat = Math.round(lat / ROUND_DEG) * ROUND_DEG;
    // Break the path across the antimeridian so no line streaks the map.
    if (prevLon !== null && Math.abs(rlon - prevLon) > 180) {
      pts.push(null);
    }
    const last = pts[pts.length - 1];
    if (!last || last[0] !== rlon || last[1] !== rlat) pts.push([rlon, rlat]);
    prevLon = rlon;
  }
  return pts;
}

/** Perpendicular distance from point p to segment ab, in degrees. */
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(pts, tolerance) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const paths = [];
for (const line of coast.coordinates) {
  // Simplify in degree space (before projection) so tolerance is uniform.
  for (const segment of splitAntimeridian(line)) {
    const reduced = douglasPeucker(simplifyLine(segment), DP_TOLERANCE_DEG);
    // Drop specks: a 2-point segment after simplification is noise.
    if (reduced.length < 3) continue;
    paths.push(
      reduced.map(([lon, lat], i) => `${i ? "L" : "M"}${r1(x(lon))},${r1(y(lat))}`).join(""),
    );
  }
}

/** Split a lon/lat line into segments at antimeridian crossings. */
function splitAntimeridian(coords) {
  const segments = [];
  let current = [];
  let prevLon = null;
  for (const [lon, lat] of coords) {
    if (prevLon !== null && Math.abs(lon - prevLon) > 180 && current.length) {
      segments.push(current);
      current = [];
    }
    current.push([lon, lat]);
    prevLon = lon;
  }
  if (current.length) segments.push(current);
  return segments;
}

// Graticule every 30° — pure decoration, keeps the fallback readable.
const grat = [];
for (let lon = -180; lon < 180; lon += 30) {
  grat.push(`M${r1(x(lon))},0L${r1(x(lon))},${H}`);
}
for (let lat = -60; lat <= 60; lat += 30) {
  grat.push(`M0,${r1(y(lat))}L${W},${r1(y(lat))}`);
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="World outline map">` +
  `<title>World outline</title><desc>Equirectangular world coastline outline used as the Scout Map static fallback.</desc>` +
  `<rect width="${W}" height="${H}" fill="#070b14"/>` +
  `<g stroke="#2a3a58" stroke-width="1" fill="none" opacity="0.55"><path d="${grat.join("")}"/></g>` +
  `<g stroke="#8fb0e0" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
  paths.map((d) => `<path d="${d}"/>`).join("") +
  `</g></svg>\n`;

writeFileSync(OUT, svg);
const bytes = statSync(OUT).size;
console.log(`wrote ${OUT.pathname}: ${paths.length} coast paths, ${(bytes / 1024).toFixed(1)} kB`);
if (bytes > BUDGET_BYTES) {
  console.error(`BUDGET EXCEEDED: ${bytes} bytes > ${BUDGET_BYTES} bytes`);
  process.exit(1);
}
