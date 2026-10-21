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
  assert.ok((rules.get("/assets/maplibre-gl-*") ?? []).includes("! Cache-Control"));
});
