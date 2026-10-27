/**
 * public/_headers contract (review findings P2-8/9, COPPA analytics
 * decision 2026-10-21). Guards against silent regressions such as a
 * tracker host creeping back into the CSP or hashed assets losing their
 * immutable cache.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");

/** Minimal _headers parser: { path → [header lines] }. */
function parse(text) {
  const rules = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = line.trim();
      rules.set(current, []);
    } else if (current) rules.get(current).push(line.trim());
  }
  return rules;
}
const rules = parse(raw);
const global = rules.get("/*") ?? [];
const header = (name) => global.find((l) => l.toLowerCase().startsWith(name.toLowerCase() + ":"))?.split(/:\s*/).slice(1).join(":");

test("baseline security headers are set for every path", () => {
  assert.equal(header("X-Frame-Options"), "DENY");
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.ok(header("Referrer-Policy"));
  assert.equal(header("Cross-Origin-Opener-Policy"), "same-origin");
  assert.match(header("Strict-Transport-Security") ?? "", /max-age=\d{7,}/);
  const pp = header("Permissions-Policy") ?? "";
  for (const f of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) assert.ok(pp.includes(f), f);
});

test("CSP: frame-ancestors none, only the allowed third parties, no trackers", () => {
  const csp = header("Content-Security-Policy") ?? "";
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /script-src [^;]*https:\/\/static\.cloudflareinsights\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/cloudflareinsights\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/server\.arcgisonline\.com/);
  assert.match(csp, /connect-src 'self'/);
  for (const banned of ["google", "clarity", "doubleclick", "facebook"]) {
    assert.ok(!csp.toLowerCase().includes(banned), `CSP must not allow ${banned}`);
  }
});

test("hashed /assets/* are immutable; sw.js and flags.json always revalidate", () => {
  assert.ok((rules.get("/assets/*") ?? []).some((l) => /immutable/.test(l)));
  for (const p of ["/sw.js", "/flags.json"]) {
    assert.ok((rules.get(p) ?? []).some((l) => /no-cache/.test(l)), p);
  }
  // Un-hashed files under /assets/ detach the immutable header AND set their
  // own value in the same block. Detach alone is not enough: Cloudflare
  // documents `! ` as removing a default header, so detaching also removed
  // the platform's own public, max-age=0, must-revalidate and the carved
  // files shipped with no Cache-Control at all (PR #203 bug, live-verified
  // 2026-10-21; fixed in PR #212). Detachments run before sets within a
  // rule, so the set is the path's only value and nothing comma-joins.
  for (const p of [
    "/assets/maplibre-gl-worker.mjs",
    "/assets/maplibre-gl-shared.mjs",
    "/assets/storyteller/storyteller-assets.json",
  ]) {
    assert.deepEqual(
      rules.get(p),
      ["! Cache-Control", "Cache-Control: public, max-age=0, must-revalidate"],
      p,
    );
  }
});

test("asset-served / and /index.html keep their literal s-maxage value (drift pin)", () => {
  // These two rules only ever reach an ASSET-SERVED copy of the document;
  // the live site's HTML is rendered by the Worker, which sends
  // HTML_CACHE_CONTROL ("public, max-age=0, must-revalidate", NO s-maxage)
  // from src/start.ts instead. The divergence is deliberate and
  // owner-ruled (WI-18, 2026-10-22) — pin the asset literal so an edit
  // here cannot silently drift the two values together or apart.
  for (const p of ["/", "/index.html"]) {
    assert.deepEqual(
      rules.get(p),
      ["Cache-Control: public, max-age=0, s-maxage=60, must-revalidate"],
      p,
    );
  }
});

// ---------------------------------------------------------------------------
// #213: parse-and-simulate pin. The parser above keys rules by pattern, so
// it cannot prove what a browser actually receives: Cloudflare applies
// EVERY matching rule in file order, runs all detachments before all sets
// within one rule, the first set replaces the response's current value,
// and later sets append (the values comma-join). This section replays
// those documented semantics and pins the single effective Cache-Control
// for every path class — including the absence of any rule for /audio/*.
// ---------------------------------------------------------------------------

/** Order-preserving parser: [{ pattern, ops: [{kind, name, value}] }]. */
function parseOrdered(text) {
  const out = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), ops: [] };
      out.push(current);
    } else if (current) {
      const t = line.trim();
      if (t.startsWith("!")) {
        current.ops.push({ kind: "detach", name: t.slice(1).trim().toLowerCase() });
      } else {
        const i = t.indexOf(":");
        current.ops.push({ kind: "set", name: t.slice(0, i).trim().toLowerCase(), value: t.slice(i + 1).trim() });
      }
    }
  }
  return out;
}

function patternMatches(pattern, path) {
  if (pattern === "/*") return true;
  if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

/** Simulate Cloudflare's rule application; returns the effective
 *  Cache-Control as a list of set values ([] = this file sets none). */
function effectiveCacheControl(ordered, path) {
  let values = [];
  for (const rule of ordered) {
    if (!patternMatches(rule.pattern, path)) continue;
    // Within one rule, detachments run before sets.
    for (const op of rule.ops) if (op.kind === "detach" && op.name === "cache-control") values = [];
    for (const op of rule.ops) {
      if (op.kind !== "set" || op.name !== "cache-control") continue;
      if (values.length === 0) values = [op.value]; // first set replaces
      else values.push(op.value); // later sets append (comma-join)
    }
  }
  return values;
}

const ordered = parseOrdered(raw);

test("#213 simulation: hashed /assets/* get the single immutable value", () => {
  assert.deepEqual(effectiveCacheControl(ordered, "/assets/index-a1b2c3d4.js"), [
    "public, max-age=31536000, immutable",
  ]);
});

test("#213 simulation: the 3 carved files end with ONE revalidate value, never immutable", () => {
  for (const p of [
    "/assets/maplibre-gl-worker.mjs",
    "/assets/maplibre-gl-shared.mjs",
    "/assets/storyteller/storyteller-assets.json",
  ]) {
    assert.deepEqual(effectiveCacheControl(ordered, p), ["public, max-age=0, must-revalidate"], p);
  }
});

test("#213 simulation: update/kill-switch files are no-cache", () => {
  for (const p of ["/sw.js", "/flags.json", "/build-meta.json", "/manifest.webmanifest"]) {
    assert.deepEqual(effectiveCacheControl(ordered, p), ["no-cache"], p);
  }
});

test("#213 simulation: HTML entry points keep their explicit values", () => {
  for (const p of ["/", "/index.html"]) {
    assert.deepEqual(effectiveCacheControl(ordered, p), ["public, max-age=0, s-maxage=60, must-revalidate"], p);
  }
  for (const p of ["/offline", "/offline.html", "/_shell.html"]) {
    assert.deepEqual(effectiveCacheControl(ordered, p), ["public, max-age=0, must-revalidate"], p);
  }
});

test("#213 simulation: no rule covers /audio/* or other unlisted paths (never immutable)", () => {
  for (const p of ["/audio/narration/sample.mp3", "/icons/icon-192.png", "/favicon.svg", "/og.jpg"]) {
    assert.deepEqual(effectiveCacheControl(ordered, p), [], p);
  }
});
