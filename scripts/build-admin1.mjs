/**
 * build-admin1.mjs — one-time vendoring step for admin-1 boundary chunks.
 *
 * WHAT: builds the lazy per-country admin-1 chunks for the 7 narrow-scope
 * countries (EG/FR/DE/IT/JP/MX/GB) plus property-strips the existing 5-country
 * file, from Natural Earth 10m admin-1 (public domain).
 *
 * WHY 10m: Step-0 verification (2026-10-05) proved the NE 50m file covers only
 * 9 countries (AU/BR/CA/CN/ID/IN/RU/US/ZA) — all 7 gap countries are missing.
 * NE 10m is the same public-domain provenance as the existing vendored file
 * (no per-file license bookkeeping, no ODbL share-alike), so it wins over
 * GeoBoundaries gbOpen for the narrow scope. See docs/admin1-gap-ticket.md §5.
 *
 * SOURCE (pinned — the script never fetches; the operator downloads once):
 *   https://github.com/nvkelso/natural-earth-vector
 *   geojson/ne_10m_admin_1_states_provinces.geojson
 *   SHA256 22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5
 *   40,726,851 bytes (GitHub raw, 2026-10-05)
 *
 * Step-0 record (NE 50m, for the ticket):
 *   geojson/ne_50m_admin_1_states_provinces.geojson
 *   SHA256 69a0e06e640b2d505858ae1cb63034e4677f3000b35a98e16312932b98c426b9
 *   2,325,694 bytes; 294 features; distinct iso_a2 = AU BR CA CN ID IN RU US ZA
 *   (the in-code "only 9 countries" comment was correct). EG/FR/DE/IT/JP/MX/GB
 *   all missing — hence this script.
 *
 * PIPELINE per country: filter iso_a2 → per-feature adaptive Douglas-Peucker
 * simplify (each feature binary-searched to ≈ TARGET_VERTS_PER_FEATURE;
 * genuine NE 50m measures 108–1084 verts/feature, typically 130–260, so the
 * new chunks match the existing 50m visual density while small features keep
 * their detail) → slim properties {name, iso_a2} (kills the ~119 dead NE
 * properties) → bbox computed from the SIMPLIFIED geometry, padded by one
 * quantization quantum (exact pre-filter for the shipped geometry) →
 * TopoJSON (quantization 1e4; topojson-server, pinned in package.json) →
 * src/map/data/admin1/<iso2>.json.
 *
 * The existing src/map/data/ne-50m-admin-1.json (AU/BR/CA/CN/IN, GeoJSON) is
 * rewritten in place with the same slim schema {name, iso_a2, bbox, geometry}
 * (GeoJSON-native top-level bbox). It stays GeoJSON; only the 7 new chunks
 * are TopoJSON (repo convention for vendored boundaries: world-atlas,
 * us-atlas). Chunk loaders read bbox from feature.bbox ?? properties.bbox.
 *
 * USAGE: node scripts/build-admin1.mjs --source /tmp/ne10m-admin1.geojson
 * The raw 40 MB source is NEVER committed (vendored input only).
 * Deterministic: re-running on the same source yields byte-identical output.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { topology } from "topojson-server";
import { feature as topoFeature } from "topojson-client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Pinned source identity (fail-closed: mismatch refuses to build) ---
const EXPECTED_SHA256 =
  "22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5";
const EXPECTED_BYTES = 40726851;

// --- Narrow scope: the 7 gameplay-gap countries (ticket §2) ---
const TARGETS = ["eg", "fr", "de", "it", "jp", "mx", "gb"];
// Countries kept in the legacy 5-country file (rewritten slim, same path).
const LEGACY_KEPT = ["au", "br", "ca", "cn", "in"];

// Per-feature vertex budget — genuine NE 50m admin-1 measures 108–1084
// verts/feature across its 9 countries (typically 130–260; CA's 1084 is
// Arctic-coastline outlier). Each feature over budget is binary-searched to
// just under it; Douglas-Peucker sheds vertices in clumps, so measured
// per-country averages land at 73–203 (EG 125, FR 192, DE 104, IT 158,
// JP 203, MX 129, GB 73 — GB's features are genuinely tiny unitaries, most
// passing through untouched). Small features keep their 10m detail; large
// ones match 50m density. Deterministic.
const TARGET_VERTS_PER_FEATURE = 300;
// TopoJSON quantization: 1e4 steps over a country bbox ≈ 0.001° ≈ 100 m —
// an order of magnitude below the simplification epsilon, so quantization
// adds no visible or point-in-polygon-relevant error.
const QUANTIZATION = 1e4;

function usage() {
  console.error("usage: node scripts/build-admin1.mjs --source <ne10m-admin1.geojson>");
  process.exit(2);
}

function parseArgs(argv) {
  const idx = argv.indexOf("--source");
  if (idx === -1 || !argv[idx + 1]) usage();
  return { source: argv[idx + 1] };
}

// --- Douglas-Peucker (perpendicular distance), plain [x, y] rings ---------
function perpDistSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
}

function douglasPeucker(points, eps) {
  const epsSq = eps * eps;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop();
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistSq(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsSq) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/** Simplify one closed ring; guarantees a valid LinearRing (≥4 positions). */
function simplifyRing(ring, eps) {
  const open = ring.slice(0, -1);
  if (open.length <= 4) return ring.map((p) => [p[0], p[1]]);
  let pts = douglasPeucker(open, eps);
  if (pts.length < 3) pts = [open[0], open[Math.floor(open.length / 2)], open[open.length - 1]];
  const first = pts[0];
  pts.push([first[0], first[1]]);
  return pts;
}

function simplifyGeometry(geom, eps) {
  // NOTE: Polygon coordinates are [ring, ...] — do NOT wrap in an extra
  // array (a past revision did `[geom.coordinates]` and produced doubly
  // nested, invalid Polygons; caught by the bbox validation probe).
  if (geom.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geom.coordinates.map((ring) => simplifyRing(ring, eps)),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geom.coordinates.map((rings) => rings.map((ring) => simplifyRing(ring, eps))),
  };
}

/**
 * Simplify one feature's geometry to ≈ TARGET_VERTS_PER_FEATURE via
 * binary-searched epsilon (vertex count is monotonic decreasing in eps).
 * Features already under budget pass through untouched. Deterministic.
 */
function simplifyToBudget(geom) {
  const orig = countVerts(geom);
  if (orig <= TARGET_VERTS_PER_FEATURE) return geom;
  let lo = 0.001;
  let hi = 0.15;
  let best = simplifyGeometry(geom, hi);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const g = simplifyGeometry(geom, mid);
    if (countVerts(g) > TARGET_VERTS_PER_FEATURE) {
      lo = mid; // need more simplification
    } else {
      hi = mid;
      best = g;
    }
  }
  return best;
}

function bboxOfGeometry(geom) {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const polys = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  for (const ring of polys) {
    for (const [x, y] of ring) {
      if (x < w) w = x;
      if (y < s) s = y;
      if (x > e) e = x;
      if (y > n) n = y;
    }
  }
  return [w, s, e, n];
}

function countVerts(geom) {
  const polys = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  return polys.reduce((acc, ring) => acc + ring.length, 0);
}

function main() {
  const { source } = parseArgs(process.argv.slice(2));
  const raw = readFileSync(source);
  if (raw.length !== EXPECTED_BYTES) {
    throw new Error(
      `source size mismatch: got ${raw.length}, expected ${EXPECTED_BYTES} — refusing to build`,
    );
  }
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== EXPECTED_SHA256) {
    throw new Error(`source SHA256 mismatch: got ${sha} — refusing to build`);
  }

  const fc = JSON.parse(raw.toString("utf8"));
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error("source is not a GeoJSON FeatureCollection");
  }

  const byIso = new Map();
  for (const f of fc.features) {
    const iso = String(f.properties?.iso_a2 ?? "").toLowerCase();
    if (!byIso.has(iso)) byIso.set(iso, []);
    byIso.get(iso).push(f);
  }

  // Fail-closed schema contract: every target country must be present.
  for (const iso of [...TARGETS, ...LEGACY_KEPT]) {
    const feats = byIso.get(iso);
    if (!feats || feats.length === 0) {
      throw new Error(`source has no features for iso_a2=${iso} — refusing to build`);
    }
  }

  const summary = [];

  // --- 7 new per-country TopoJSON chunks ---
  const outDir = join(ROOT, "src", "map", "data", "admin1");
  mkdirSync(outDir, { recursive: true });

  for (const iso of TARGETS) {
    const feats = byIso.get(iso);
    let vertsBefore = 0;
    let vertsAfter = 0;
    // Pass 1: simplify everything; collect per-feature bboxes.
    const simplified = feats.map((f) => {
      const geom = simplifyToBudget(f.geometry);
      vertsBefore += countVerts(f.geometry);
      vertsAfter += countVerts(geom);
      return {
        name: f.properties.name,
        iso_a2: String(f.properties.iso_a2).toUpperCase(),
        geom,
        bbox: bboxOfGeometry(geom),
      };
    });
    // Pass 2: the quantization grid is GLOBAL to the topology (one
    // transform for the whole country), so the pad must be a global
    // quantum: max rounding nudge = globalSpan / (2 * (Q - 1)) < pad.
    let gw = Infinity, gs = Infinity, ge = -Infinity, gn = -Infinity;
    for (const s of simplified) {
      const [w, s0, e, n] = s.bbox;
      if (w < gw) gw = w;
      if (s0 < gs) gs = s0;
      if (e > ge) ge = e;
      if (n > gn) gn = n;
    }
    const pad = Math.max(ge - gw, gn - gs) / QUANTIZATION;
    const slim = {
      type: "FeatureCollection",
      features: simplified.map((s) => {
        const [w, s0, e, n] = s.bbox;
        return {
          type: "Feature",
          properties: {
            name: s.name,
            iso_a2: s.iso_a2,
            // Padded: quantization can nudge a coordinate outward; the bbox
            // must never exclude a real vertex (it is only a pre-filter —
            // geoContains decides).
            bbox: [w - pad, s0 - pad, e + pad, n + pad],
          },
          geometry: s.geom,
        };
      }),
    };
    const topo = topology({ admin1: slim }, QUANTIZATION);
    const out = JSON.stringify(topo);
    const path = join(outDir, `${iso}.json`);
    writeFileSync(path, out);
    summary.push({ iso, features: feats.length, vertsBefore, vertsAfter, bytes: out.length, path });
  }

  // --- Legacy 5-country file: property-strip in place (stays GeoJSON) ---
  // Derived from the repo's own vendored file (geometry preserved
  // byte-identically; only the 119 dead properties are dropped and the
  // per-feature bbox is recomputed from the shipped geometry).
  const legacyPath = join(ROOT, "src", "map", "data", "ne-50m-admin-1.json");
  const legacy50m = JSON.parse(readFileSync(legacyPath, "utf8"));
  const legacyFeats = legacy50m.features.filter((f) =>
    LEGACY_KEPT.includes(String(f.properties?.iso_a2 ?? "").toLowerCase()),
  );
  if (legacyFeats.length === 0) throw new Error("legacy file lost its 5 countries");
  const slimLegacy = {
    type: "FeatureCollection",
    name: "ne_50m_admin_1_states_provinces",
    crs: legacy50m.crs,
    features: legacyFeats.map((f) => {
      const [w, s, e, n] = bboxOfGeometry(f.geometry);
      return {
        type: "Feature",
        bbox: [w, s, e, n],
        properties: {
          name: f.properties.name,
          iso_a2: String(f.properties.iso_a2).toUpperCase(),
        },
        geometry: f.geometry,
      };
    }),
  };
  const legacyOut = JSON.stringify(slimLegacy);
  writeFileSync(legacyPath, legacyOut);

  // --- Report ---
  console.log("country | features | verts before → after | bytes");
  for (const r of summary) {
    console.log(
      `${r.iso} | ${r.features} | ${r.vertsBefore} → ${r.vertsAfter} ` +
        `(${(100 * r.vertsAfter / r.vertsBefore).toFixed(1)}%) | ${r.bytes}`,
    );
  }
  console.log(`legacy ne-50m-admin-1.json: ${legacyFeats.length} features | ${legacyOut.length} bytes`);

  verifyOutputs(summary, legacyFeats.length);
  console.log("DONE");
}

/**
 * Build-time quality gate: decodes every written chunk (and the legacy
 * file) and asserts structural validity. Fails the build instead of
 * shipping malformed geometries (this caught a doubly-nested Polygon bug
 * during development).
 */
function verifyOutputs(summary, legacyCount) {
  const failures = [];
  const isFiniteBbox = (b) =>
    Array.isArray(b) && b.length === 4 && b.every((v) => Number.isFinite(v));

  for (const r of summary) {
    const topo = JSON.parse(readFileSync(r.path, "utf8"));
    const fc = topoFeature(topo, topo.objects.admin1);
    if (fc.features.length !== r.features) {
      failures.push(`${r.iso}: decoded ${fc.features.length} features, expected ${r.features}`);
    }
    for (const f of fc.features) {
      const p = f.properties ?? {};
      if (typeof p.name !== "string" && p.name !== null) {
        failures.push(`${r.iso}: bad name ${JSON.stringify(p.name)}`);
      }
      if (p.iso_a2 !== r.iso.toUpperCase()) {
        failures.push(`${r.iso}: bad iso_a2 ${JSON.stringify(p.iso_a2)}`);
      }
      if (!isFiniteBbox(p.bbox)) {
        failures.push(`${r.iso}/${p.name}: non-finite properties.bbox`);
        continue;
      }
      const polys =
        f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          if (ring.length < 4) failures.push(`${r.iso}/${p.name}: ring with ${ring.length} positions`);
          const c0 = ring[0];
          const c1 = ring[ring.length - 1];
          if (c0[0] !== c1[0] || c0[1] !== c1[1]) {
            failures.push(`${r.iso}/${p.name}: unclosed ring`);
          }
        }
      }
      // Every decoded vertex must lie inside the (padded) bbox.
      const [w, s, e, n] = p.bbox;
      const check = (coords) => {
        for (const pt of coords) {
          if (!Array.isArray(pt[0])) {
            if (pt[0] < w || pt[0] > e || pt[1] < s || pt[1] > n) {
              failures.push(`${r.iso}/${p.name}: vertex outside bbox`);
              return;
            }
          } else check(pt);
        }
      };
      check(f.geometry.coordinates);
    }
  }

  const legacy = JSON.parse(
    readFileSync(join(ROOT, "src", "map", "data", "ne-50m-admin-1.json"), "utf8"),
  );
  if (legacy.features.length !== legacyCount) {
    failures.push(`legacy: ${legacy.features.length} features, expected ${legacyCount}`);
  }
  for (const f of legacy.features) {
    const keys = Object.keys(f.properties ?? {}).sort().join(",");
    if (keys !== "iso_a2,name") failures.push(`legacy: unexpected props {${keys}}`);
    if (!isFiniteBbox(f.bbox)) failures.push("legacy: non-finite top-level bbox");
  }

  if (failures.length > 0) {
    throw new Error(`build verification FAILED:\n- ${failures.slice(0, 20).join("\n- ")}`);
  }
  console.log(`verify: ${summary.length} chunks + legacy file OK`);
}

main();
